import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {JailStorageInterface} from "@waf/Jail/JailStorageInterface";
import {Log} from "@waf/Log";
import {JailStorageMemory} from "@waf/Jail/JailStorageMemory";
import {IJailStorageFileConfig, JailStorageFile} from "@waf/Jail/JailStorageFile";
import {IBannedIPItem} from "@waf/WAFMiddleware";
import {Metrics} from "@waf/Metrics/Metrics";
import {Metric} from "prom-client";
import {Request, Response} from "express-serve-static-core";
import {CompositeRule, ICompositeRuleConfig} from "@waf/Jail/Rules/CompositeRule";
import {IStaticRuleConfig, StaticRule} from "@waf/Jail/Rules/StaticRule";
import {FlexibleRule, IFlexibleRuleConfig} from "@waf/Jail/Rules/FlexibleRule";
import {AbstractRule, IAbstractRuleConfig} from "@waf/Jail/Rules/AbstractRule";
import * as promClient from "prom-client";
import {Singleton} from "@waf/Utils/Singleton";
import {IJailStorageOperatorConfig, JailStorageOperator} from "@waf/Jail/JailStorageOperator";
import {SenderLoop} from "@waf/Utils/SenderLoop";

export class JailManager extends Singleton<JailManager, []>{
    private readonly storeInterval: NodeJS.Timeout = null;

    protected blockedIPsLoaded: Record<string, BanInfo> = {}

    protected blockedIPsAdded: Record<string, BanInfo> = {}

    protected rules: AbstractRule[] = [];

    private metrics: Metric[] = [];

    public constructor(
        private readonly config: IJailManagerConfig,
        private readonly storage?: JailStorageInterface,
        private readonly metricsInstance?: Metrics,
        private readonly logger?: LoggerInterface,
    ) {
        super();
        this.config = Object.assign({
            storage: {
                driver: 'memory',
                driverConfig: {}
            }
        }, config);

        if (!logger) {
            this.logger = Log.instance.withCategory('app.Jail.JailManager')
        }

        this.storage = this.createStorageFromConfig(this.config.storage.driver, this.config.storage.driverConfig);

        if(!metricsInstance) {
            this.metricsInstance = Metrics.get();
        }

        this.loadRules();
        if(this.metricsInstance.isEnabled()) {
            this.bootstrapMetrics();
        }
    }
    public async bootstrap() {
        await this.loadDataFromStorage();
        await this.startLoadingLoop(this.config?.loadInterval * 1000 || 30000);
        await this.startFlushingLoop(this.config?.flushInterval * 1000 || 30000);
    }

    public onStop() {
        if(this.storeInterval) {
            clearInterval(this.storeInterval);
        }
    }

    private createStorageFromConfig(driverName: string, driverConfig: any) {
        switch (driverName) {
            case 'file':
                return new JailStorageFile(driverConfig);
            case 'operator':
                return new JailStorageOperator(driverConfig);
            case 'memory':
                this.logger.warn('Use InMemory storage');
                return new JailStorageMemory(driverConfig);
        }

    }

    public bootstrapMetrics() {
        this.metrics['blocked'] = new promClient.Counter({
            name: 'waf_jail_reject_blocked',
            help: 'Count of users who rejected because he blocked',
            labelNames: ['country', 'city'],
            registers: [this.metricsInstance.getRegisters()]
        });
        this.metrics['reject_static'] = new promClient.Counter({
            name: 'waf_jail_reject_static',
            help: 'Count of users who rejected by static ip blocked',
            labelNames: ['country', 'city'],
            registers: [this.metricsInstance.getRegisters()]
        });
        this.metrics['reject_and_ban'] = new promClient.Counter({
            name: 'waf_jail_reject_by_rule',
            help: 'Count of users who rejected and banned because of rule',
            labelNames: ['country', 'city', 'ruleId'],
            registers: [this.metricsInstance.getRegisters()]
        });
        this.metrics['storage_all_ips'] = new promClient.Counter({
            name: 'waf_jail_storage_all_ips',
            help: 'Count of users who rejected and banned because of rule',
            labelNames: ['country', 'city', 'ruleId'],
            registers: [this.metricsInstance.getRegisters()]
        });
        this.metrics['storage_data'] = new promClient.Gauge({
            name: 'waf_jail_storage_data',
            help: 'How many data in storage grouped by ruleId, country, city, isBlocked',
            labelNames: ['country', 'city', 'ruleId', 'isBlocked', 'escalationCount'],
            registers: [this.metricsInstance.getRegisters()]
        });
    }


    public async check(clientIp: string, country: string, city: string, req: Request, requestId: string, res: Response): Promise<boolean> {
        if(this.config.enabled === false) {
            this.logger.trace('JailManager skip by disabled');
            return false;
        }

        const blockedUser = this.getBlockedIp(clientIp);

        if (blockedUser !== false) {
            if (blockedUser.unbanTime > Date.now()) {
                this.metrics['blocked']?.inc({country, city});
                this.logger.trace('Request from baned IP rejected', [blockedUser.ip, blockedUser.metadata?.country, blockedUser.metadata?.city]);
                return true;
            }
        }

        const promiseList = this.rules.map((ruleItem: AbstractRule) => {
            return ruleItem.use(clientIp, country, city, req, requestId);
        })

        const result: (false | true | IBannedIPItem)[] = await Promise.all(promiseList);
        if (result.some(x => x === true)) {
            this.metrics['reject_static']?.inc({country, city});
            this.logger.trace('Rejected by static rule');
            return true;
        }
        // @ts-ignore
        const jailObjects: IBannedIPItem[] = result.filter(x => typeof x === 'object' );
        if(jailObjects.length !== 0) {
            await Promise.all(jailObjects.map(async (bannedIPItem) => {
                await this.blockIp(bannedIPItem.ip, bannedIPItem.duration,bannedIPItem.escalationRate, {
                    ruleId: bannedIPItem.ruleId,
                    country: country,
                    city: city,
                    requestIds: bannedIPItem.requestIds.join(',')
                });
                this.metrics['reject_and_ban']?.inc({country, city, ruleId: bannedIPItem.ruleId});
            }));
            return true;
        }

        return false;
    }

    public async blockIp(ip: string, duration: number = 60, escalationRate: number = 1.0, metadata: IBanInfoMetaData): Promise<void> {
        if (!Object.prototype.hasOwnProperty.call(this.blockedIPsAdded, ip)) {
            if(Object.prototype.hasOwnProperty.call(this.blockedIPsLoaded, ip)) {
                this.blockedIPsAdded[ip] = Object.assign({}, this.blockedIPsLoaded[ip]) // copy object form loaded
                this.blockedIPsAdded[ip].escalationCount++
            } else {
                this.blockedIPsAdded[ip] = {
                    ip,
                    unbanTime: 0,
                    escalationCount: 0,
                    metadata
                }
            }
        } else {
            this.blockedIPsAdded[ip].escalationCount++
        }

        this.blockedIPsAdded[ip].metadata = metadata;
        const unbanTime = Date.now() + this.calculateBanTime(this.blockedIPsAdded[ip].escalationCount, duration, escalationRate) * 1000;
        this.blockedIPsAdded[ip]['unbanTime'] = unbanTime;
        this.logger.info(`IP ${ip} blocked until ${new Date(unbanTime).toISOString()}`, {escalationCount: this.blockedIPsAdded[ip].escalationCount});
        if(this.config?.flushAlways) {
            await this.flushDataToStorage();
        }

    }

    private calculateBanTime(hitCount: number, baseBanDuration: number = 60, rate: number = 1.5): number {
        return baseBanDuration * Math.pow(rate, hitCount+1);
    }


    public getBlockedIp(ip: string): false | BanInfo {
        return this.blockedIPsAdded[ip] ?? ( this.blockedIPsLoaded[ip] ?? false );
    }

    public getAllBlockedIp() {
        return Object.values(this.blockedIPsLoaded);
    }


    public deleteBlockedIp(ip: string): boolean {
        const bannedUser: BanInfo | false = this.blockedIPsLoaded[ip] ?? false;
        if (bannedUser === false) {
            return false;
        }
        this.blockedIPsLoaded[ip].unbanTime = Date.now() - 1;

        return true
    }

    public loadRules() {
        this.rules = [];
        for (const ruleItem of this.config.filterRules) {
            switch (ruleItem.type) {
                case CompositeRule.ID:
                    this.rules.push(new CompositeRule(<ICompositeRuleConfig>ruleItem));
                    break;
                case StaticRule.ID:
                    this.rules.push(new StaticRule(<IStaticRuleConfig>ruleItem));
                    break;
                case FlexibleRule.ID:
                    this.rules.push(new FlexibleRule(<IFlexibleRuleConfig>ruleItem));
                    break;

                default:
                    throw new Error('Can not found observer or rule type - ' + ruleItem.type)
            }
        }
        this.logger.info('Loaded ' + this.rules.length + ' rules');
    }

    protected async startLoadingLoop(loadInterval: number|undefined) {
        new SenderLoop().start(async () => {
            await this.loadDataFromStorage();
            return true;
        }, loadInterval);
    }

    protected async loadDataFromStorage() {
        const rawJailList:BanInfo[] = await this.storage.load().catch(e => {
            this.logger.error('Can not load data from storage', e);
            return Object.values(this.blockedIPsLoaded);
        });
        this.logger.info('Loaded ' + rawJailList.length + ' ips from storage');
        this.blockedIPsLoaded = Object.fromEntries(rawJailList.map(item => [item.ip, item]))
        this.reCalculateStorageMetrics();
    }

    protected async startFlushingLoop(flushingInterval: number|undefined) {
        new SenderLoop().start(async () => {
            await this.flushDataToStorage();
            return true;
        }, flushingInterval);
    }

    protected async flushDataToStorage() {
        const sendData = Object.values(this.blockedIPsAdded);
        if(sendData.length === 0) {
            return;
        }
        this.logger.info('Flushing ' + sendData.length + ' ips to storage');
        this.blockedIPsAdded = {};
        await this.storage.save(sendData, Object.values(this.blockedIPsLoaded)).catch((e) => {
            this.logger.error('Can not sand data to storage', e);
            Object.assign(this.blockedIPsAdded, sendData.map(item => [item.ip, item]));
        });
        this.reCalculateStorageMetrics();
    }

    public reCalculateStorageMetrics() {
        const counts = new Map<string, number>();

        for (const entry of Object.values(this.blockedIPsLoaded)) {
            const { ruleId, country, city } = entry.metadata;
            const isBlocked = Date.now() < entry.unbanTime;
            const key = `${ruleId}|||${country}|||${city}|||${isBlocked}|||${entry.escalationCount}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        for (const [key, value] of counts.entries()) {
            const [ruleId, country, city, isBlocked, escalationCount] = key.split('|||');
            this.metrics['storage_data']?.set({ ruleId, country, city, isBlocked, escalationCount}, value);
        }
    }

    protected delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


}

export interface IJailManagerConfig {
    enabled: boolean;
    storage?: {
        driver?: string;
        driverConfig?: IJailStorageFileConfig | IJailStorageOperatorConfig;
    },
    loadInterval?: number;
    flushInterval?: number;
    flushAlways?: boolean;
    filterRules: IAbstractRuleConfig[]
}

export type BanInfo = {
    ip: string;
    unbanTime: number;
    escalationCount: number;
    metadata: IBanInfoMetaData
};


interface IBanInfoMetaData  {
    [key: string]: string
}
