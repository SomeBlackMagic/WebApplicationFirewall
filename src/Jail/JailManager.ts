import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import assert from "node:assert";
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

export class JailManager extends Singleton<JailManager, []>{
    private readonly storeInterval: NodeJS.Timeout = null;

    private blockedIPs: Record<string, BanInfo> = {}

    private rules: AbstractRule[] = [];

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

        this.storage.load().then((rawJailList) => {
            this.blockedIPs = Object.fromEntries(rawJailList.map(item => [item.ip, item]))
            this.logger.info('Loading ban list on boot', Object.keys(this.blockedIPs).length);
        });
        this.storeInterval = setInterval(() => {
            this.syncDataWithStorage();
        }, this.config?.syncInterval || 5000);
        this.loadRules();
        if(this.metricsInstance.isEnabled()) {
            this.bootstrapMetrics();
        }
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
            labelNames: ['country', 'city'],
            registers: [this.metricsInstance.getRegisters()]
        });
    }


    public async check(clientIp: string, country: string, city: string, req: Request, res: Response): Promise<boolean> {
        if(this.config.enabled === false) {
            this.logger.trace('JailManager skip by disabled');
            return false;
        }

        const blockedUser = this.getBlockedIp(clientIp);

        if (blockedUser !== false) {
            if (blockedUser.unbanTime > Date.now()) {
                this.metrics['blocked']?.inc({country, city});
                this.logger.trace('Request from baned IP rejected', [blockedUser.ip, blockedUser.geoCountry, blockedUser.geoCountry]);
                return true;
            }
        }

        const promiseList = this.rules.map((ruleItem: AbstractRule) => {
            return ruleItem.use(clientIp, country, city, req, res);
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
                await this.blockIp(bannedIPItem.ip, bannedIPItem.duration,bannedIPItem.escalationRate);
            }));
            this.metrics['reject_and_ban']?.inc({country, city});
            return true;
        }

        return false;
    }

    public async blockIp(ip: string, duration: number = 60, escalationRate: number = 1.0, country: string = 'unknown', city: string = 'unknown'): Promise<void> {
        if (!Object.prototype.hasOwnProperty.call(this.blockedIPs, ip)) {
            this.blockedIPs[ip] = {
                ip: ip,
                escalationCount: 0,
                geoCountry: country,
                geoCity: city,
                unbanTime: 0
            }
        } else {
            this.blockedIPs[ip].escalationCount++
        }
        const unbanTime = Date.now() + this.calculateBanTime(this.blockedIPs[ip].escalationCount, duration, escalationRate) * 1000;
        this.blockedIPs[ip]['unbanTime'] = unbanTime;
        this.logger.info(`IP ${ip} blocked until ${new Date(unbanTime).toISOString()}`, {escalationCount: this.blockedIPs[ip].escalationCount});
        if(this.config?.syncAlways) {
            await this.syncDataWithStorage();
        }

    }

    private calculateBanTime(hitCount: number, baseBanDuration: number = 60, rate: number = 1.5): number {
        return baseBanDuration * Math.pow(rate, hitCount+1);
    }


    public getBlockedIp(ip: string): false | BanInfo {
        return this.blockedIPs[ip] ?? false;
    }

    public getAllBlockedIp() {
        return Object.values(this.blockedIPs);
    }


    public deleteBlockedIp(ip: string): boolean {
        const bannedUser: BanInfo | false = this.blockedIPs[ip] ?? false;
        if (bannedUser === false) {
            return false;
        }
        this.blockedIPs[ip].unbanTime = Date.now() - 1;

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

    private async syncDataWithStorage() {
        const rawJailList = await this.storage.load()
        const gropedJails = Object.fromEntries(rawJailList.map(item => [item.ip, item]));
        this.blockedIPs = this.mergeBanLists(this.blockedIPs, gropedJails)
        await this.storage.save(Object.values(this.blockedIPs))
    }

    private mergeBanLists(
        list1: Record<string, BanInfo>,
        list2: Record<string, BanInfo>
    ): Record<string, BanInfo> {
        const mergedList: Record<string, BanInfo> = {...list1};

        for (const ip in list2) {
            if (mergedList[ip]) {
                // If IP already exists, we update the data if UNBANTIME is more
                if (list2[ip].unbanTime > mergedList[ip].unbanTime) {
                    mergedList[ip] = {...mergedList[ip], ...list2[ip]};
                    this.logger.info('Update ban time for ' + list2[ip].ip, new Date(list2[ip].unbanTime).toISOString());
                }
            } else {
                // If IP is not, add to the list
                mergedList[ip] = list2[ip];
                this.logger.info('Add new ip observed from storage', list2[ip]);
            }
        }

        return mergedList;
    }

}

export interface IJailManagerConfig {
    enabled: boolean;
    storage?: {
        driver?: string;
        driverConfig?: IJailStorageFileConfig;
    },
    syncInterval?: number;
    syncAlways?: boolean;
    filterRules: IAbstractRuleConfig[]
}

export type BanInfo = {
    ip: string;
    unbanTime: number;
    escalationCount: number;
    geoCountry: string;
    geoCity: string;
};
