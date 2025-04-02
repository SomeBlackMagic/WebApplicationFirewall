import {RequestHandler} from "express";
import {NextFunction, Request, Response} from "express-serve-static-core";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {GeoIP2} from "@waf/GeoIP2";
import {Whitelist} from "@waf/Whitelist";
import {FlexibleRule, IFlexibleRuleConfig} from "@waf/Rules/FlexibleRule";
import {AbstractRule, IAbstractRuleConfig} from "@waf/Rules/AbstractRule";
import {JailManager} from "@waf/Jail/JailManager";
import {Log} from "@waf/Log";
import {CompositeRule, ICompositeRuleConfig} from "@waf/Rules/CompositeRule";
import {IStaticRuleConfig, StaticRule} from "@waf/Rules/StaticRule";
import * as promClient from "prom-client";
import {Metrics} from "@waf/Metrics/Metrics";
import {Metric} from "prom-client";

export class WAFMiddleware {

    private rules: AbstractRule[] = [];

    private metrics: Metric[] = [];

    public constructor(
        private readonly config: IWAFMiddlewareConfig,
        private readonly jailManager?: JailManager,
        private readonly whitelist?: Whitelist,
        private readonly metricsInstance?: Metrics,
        private readonly geoIP2?: GeoIP2,
        private readonly log?: LoggerInterface,
    ) {
        if (!this.config?.detectClientIp?.headers) {
            if (!this.config?.detectClientIp) {
                this.config.detectClientIp = {};
            }
            this.config.detectClientIp.headers = [];
        }
        if(!metricsInstance) {
            this.metricsInstance = Metrics.instance;
        }

        if (!jailManager) {
            this.jailManager = JailManager.instance;
        }

        if (!whitelist) {
            this.whitelist = Whitelist.instance;
        }

        if (!log) {
            this.log = Log.instance.withCategory('app.WAFMiddleware')
        }

        if (!geoIP2) {
            this.geoIP2 = GeoIP2.instance;
        }

        if(!this.config?.detectClientCountry) {
            this.config.detectClientCountry = {method: 'geoip'}
        }

        if(!this.config?.detectClientCity) {
            this.config.detectClientCity = {method: 'geoip'}
        }
        if(this.metricsInstance.isEnabled()) {
            this.bootstrapMetrics();
        }
    }


    public bootstrapMetrics() {
        this.metrics['whitelist'] = new promClient.Counter({
            name: 'waf_middleware_whitelist',
            help: 'Count of users who allowed by whitelist',
            labelNames: ['country', 'city'],
            registers: [this.metricsInstance.getRegisters()]
        });
        this.metrics['reject_static'] = new promClient.Counter({
            name: 'waf_middleware_reject_static',
            help: 'Count of rejected by static',
            labelNames: ['country', 'city'],
            registers: [this.metricsInstance.getRegisters()]
        });
        this.metrics['reject_and_ban'] = new promClient.Counter({
            name: 'waf_middleware_reject_and_ban',
            help: 'Count of rejected by static',
            labelNames: ['country', 'city'],
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['jail_banned_user_request'] = new promClient.Counter({
            name: 'waf_middleware_jail_banned_user_request',
            help: 'Count of rejected by jail manager - user is banned',
            labelNames: ['country', 'city'],
            registers: [this.metricsInstance.getRegisters()]
        });
    }

    public use(): RequestHandler {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            const clientIp = this.detectClientIp(req);
            const country = this.detectClientCountry(req, clientIp);
            const city = this.detectClientCity(req, clientIp);

            if(this.whitelist.check(clientIp, country, city)) {
                this.metrics['whitelist']?.inc({country, city});
                next();
                return;
            }


            const blockedUser = this.jailManager.getBlockedIp(clientIp);

            if (blockedUser !== false) {
                if (blockedUser.unbanTime > Date.now()) {
                    this.metrics['jail_banned_user_request']?.inc({country, city});
                    this.log.trace('Request from baned IP rejected', [blockedUser.ip, blockedUser.geoCountry, blockedUser.geoCountry]);
                    res.sendStatus(429);
                    return;
                }
            }

            const promiseList = this.rules.map((ruleItem: AbstractRule) => {
                return ruleItem.use(clientIp, country, city, req, res);
            })

            const result: (false | true | IBannedIPItem)[] = await Promise.all(promiseList);
            if (result.some(x => x === true)) {
                this.metrics['reject_static']?.inc({country, city});
                res.sendStatus(429);
                return;
            }
            // @ts-ignore
            const jailObjects: IBannedIPItem[] = result.filter(x => typeof x === 'object' );
            if(jailObjects.length !== 0) {
                await Promise.all(jailObjects.map(async (bannedIPItem) => {
                    await this.jailManager.blockIp(bannedIPItem.ip, bannedIPItem.duration,bannedIPItem.escalationRate);
                }));
                this.metrics['reject_and_ban']?.inc({country, city});
                res.sendStatus(429);
                return;
            }

            next();
        };
    }


    public loadRules(rulesConfig: IAbstractRuleConfig[]) {
        this.rules = [];
        for (const rule of rulesConfig) {
            switch (rule.type) {
                case CompositeRule.ID:
                    this.rules.push(new CompositeRule(<ICompositeRuleConfig>rule));
                    break;
                case StaticRule.ID:
                    this.rules.push(new StaticRule(<IStaticRuleConfig>rule));
                    break;
                case FlexibleRule.ID:
                    this.rules.push(new FlexibleRule(<IFlexibleRuleConfig>rule));
                    break;

                default:
                    throw new Error('Can not found observer or rule type - ' + rule.type)
            }

        }
        return true;
    }

// ----------------------------
// Function for obtaining a real IP client
// ----------------------------
    public detectClientIp(req: Request) {
        if (this.config.detectClientIp.headers.length > 0) {
            for (const header of this.config.detectClientIp.headers) {
                if (typeof req.headers[header] !== "undefined") {
                    return req.headers[header];
                }
            }
        }

        // If there is a X-Forwarded-FR, we return the first IP from the list
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            // @ts-ignore
            const ips = forwarded.split(',').map(ip => ip.trim());
            if (ips.length) {
                return ips[0];
            }
        }
        return req.ip;
    }

    public detectClientCountry(req: Request, ip: string): string {
        switch (this.config?.detectClientCountry?.method) {
            case 'header':
                return req.header(this.config.detectClientCountry.header) || 'not-detected';
            case 'geoip':
                return this.geoIP2.getCountry(ip)?.country?.names?.en || 'not-detected';
            default:
                this.log.error('This method of detection country is not supported. Available methods: geoip, header. Default: geoip.');
                return 'not-detected';
        }

    }

    public detectClientCity(req: Request, ip: string): string {
        switch (this.config?.detectClientCity?.method) {
            case 'header':
                return req.header(this.config.detectClientCountry.header);
            case 'geoip':
                return this.geoIP2.getCity(ip)?.city?.names?.en || 'not-detected';
            default:
                this.log.error('This method of detection city is not supported. Available methods: geoip, header. Default: geoip.');
                return 'not-detected';
        }

    }

}

export interface IWAFMiddlewareConfig {

    detectClientIp?: {
        headers?: string[];
    }

    detectClientCountry?: {
        method: 'header' | 'geoip'
        header?: string;
    }
    detectClientCity?: {
        method: 'header' | 'geoip'
        header?: string;
    }


}

export interface IBannedIPItem {
    ruleId: string;
    ip: string;
    duration: number;
    escalationRate: number;
    requestId?: number;
}
