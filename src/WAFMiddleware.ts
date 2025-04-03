import {RequestHandler} from "express";
import {NextFunction, Request, Response} from "express-serve-static-core";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {GeoIP2} from "@waf/GeoIP2";
import {JailManager} from "@waf/Jail/JailManager";
import {Log} from "@waf/Log";
import * as promClient from "prom-client";
import {Metrics} from "@waf/Metrics/Metrics";
import {Metric} from "prom-client";
import {Whitelist} from "@waf/Static/Whitelist";
import {Blacklist} from "@waf/Static/Blacklist";

export class WAFMiddleware {

    private metrics: Metric[] = [];

    public constructor(
        private readonly config: IWAFMiddlewareConfig,
        private readonly jailManager?: JailManager,
        private readonly whitelist?: Whitelist,
        private readonly blacklist?: Blacklist,
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

        if (!blacklist) {
            this.blacklist = Blacklist.instance;
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
        this.metrics['blacklist'] = new promClient.Counter({
            name: 'waf_middleware_blacklist',
            help: 'Count of users who rejected by blacklist',
            labelNames: ['country', 'city'],
            registers: [this.metricsInstance.getRegisters()]
        });
        this.metrics['jail_reject'] = new promClient.Counter({
            name: 'waf_middleware_jail_reject_request',
            help: 'Count of rejected by Jail Manager - user is banned',
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

            if(this.blacklist.check(clientIp, country, city)) {
                this.metrics['blacklist']?.inc({country, city});
                this.log.trace('Request from blacklist  IP rejected', [clientIp, country, city]);
                res.sendStatus(429);
                return;
            }

            if(await this.jailManager.check(clientIp, country, city, req, res)) {
                this.metrics['jail_reject']?.inc({country, city});
                this.log.trace('Request from jail IP rejected', [clientIp, country, city]);
                res.sendStatus(429);
                return;
            }

            next();
        };
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
