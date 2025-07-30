import {RequestHandler} from "express";
import {NextFunction, Request, Response} from "express-serve-static-core";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {GeoIP2} from "@waf/GeoIP2";
import {JailManager} from "@waf/Jail/JailManager";
import {Log} from "@waf/Log";
import * as promClient from "prom-client";
import {Metrics} from "@waf/Metrics/Metrics";
import {Metric} from "prom-client";
import {IWhitelistConfig, Whitelist} from "@waf/Static/Whitelist";
import {Blacklist, IBlacklistConfig} from "@waf/Static/Blacklist";
import fs from "fs";
import { merge } from 'lodash';


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
        this.config = merge({
            mode: 'audit',
            bannedResponse: {
                httpCode: 429,
                json: JSON.stringify({
                    "message": "You have been banned for too many attempts or suspicious activity.",
                    "error": "Banned"
                }),
                html: "<h1>You have been banned for too many attempts or suspicious activity.</h1>",
            },
            detectClientIp: {
                headers: []
            },
            detectClientCountry: {
                method: 'geoip'
            },
            detectClientCity: {
                method: 'geoip'
            },
            detectClientRequestId: {
                header: 'x-request-id'
            },

        }, config);

        if(!metricsInstance) {
            this.metricsInstance = Metrics.get();
        }

        if (!jailManager) {
            this.jailManager = JailManager.get();
        }

        if (!whitelist) {
            this.whitelist = Whitelist.get();
        }

        if (!blacklist) {
            this.blacklist = Blacklist.get();
        }

        if (!log) {
            this.log = Log.instance.withCategory('app.WAFMiddleware')
        }

        if (!geoIP2) {
            this.geoIP2 = GeoIP2.get();
        }

        if(this.metricsInstance.isEnabled()) {
            this.bootstrapMetrics();
        }

        if(this.config.bannedResponse?.htmlLink) {
            this.bootstrapBannedResponse();
        }
    }

    public bootstrapBannedResponse() {
        this.log.info('Loading banned response HTML from', this.config.bannedResponse.htmlLink);

        const url = this.config.bannedResponse.htmlLink;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            // Load from remote URL
            fetch(url)
                .then(response => response.text())
                .then(html => {
                    this.config.bannedResponse.html = html;
                })
                .catch(error => {
                    this.log.error('Failed to load banned response HTML from URL', error);
                });
        } else {
            // Load from filesystem
            try {
                this.config.bannedResponse.html = fs.readFileSync(url, 'utf8');
            } catch (error) {
                this.log.error('Failed to load banned response HTML from file', error);
            }
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
            const requestId = this.detectRequestId(req);

            if(this.whitelist.check(clientIp, country, city)) {
                this.metrics['whitelist']?.inc({country, city});
                next();
                return;
            }

            if(this.blacklist.check(clientIp, country, city)) {
                this.metrics['blacklist']?.inc({country, city});
                this.log.trace('Request from blacklist  IP rejected', [clientIp, country, city]);
                this.createRejectResponse(this.config.bannedResponse.httpCode, req, res, next);
                return;
            }

            if(await this.jailManager.check(clientIp, country, city, req, requestId)) {
                this.metrics['jail_reject']?.inc({country, city});
                this.log.trace('Request from jail IP rejected', [clientIp, country, city]);
                this.createRejectResponse(this.config.bannedResponse.httpCode, req, res, next);
                return;
            }

            next();
        };
    }

    private createRejectResponse(code: number, req: Request, res: Response, next: NextFunction): Response|void {
        if(this.config.mode == 'audit') {
            this.log.warn('The request was passed on to proxy server in audit mode');
            next();
            return;
        }
        res.status(code);
        const acceptsJson = req.accepts('json');
        const acceptsHtml = req.accepts('html');

        if (acceptsJson && !acceptsHtml) {
            res.json(this.config.bannedResponse.json);
        } else {
            res.send(this.config.bannedResponse.html);
        }
    }

    // ----------------------------
    // Function for obtaining a real IP client
    // ----------------------------
    protected readonly realIPHeadersList = [
        'x-original-forwarded-for',
        'x-original-real-ip',
        'x-client-ip',
        'x-forwarded',
        'x-remote-ip',
        'x-remote-addr',
        'x-proxyuser-ip',
        'true-client-ip',
        'x-real-ip',
        'x-forwarded-for',
        'x-forwarded',
        'x-cluster-client-ip',
        'forwarded-for',
        'forwarded',
        'x-client-ip',
        'client-ip',
        'x-forwarded-for-ip',
    ]

    public detectClientIp(req: Request) {
        for (const header of [...this.config.detectClientIp.headers, ...this.realIPHeadersList]) {
            if (
                typeof req.headers[header] !== "undefined" &&
                req.headers[header] !== ''
            ) {
                return this.fetchFirstIpFromString(req.headers[header] as string);
            }
        }
        return req.ip;
    }

    private fetchFirstIpFromString(ip: string): string {
        return ip.split(',')[0]?.trim();
    }

    public detectClientCountry(req: Request, ip: string): string {
        switch (this.config?.detectClientCountry?.method) {
            case 'header':
                return req.header(this.config.detectClientCountry.header) || 'not-detected';
            case 'geoip':
                return this.geoIP2.getCountry(ip)?.country?.isoCode || 'not-detected';
            default:
                this.log.error('This method of detection country is not supported. Available methods: geoip, header. Default: geoip.');
                return 'not-detected';
        }

    }

    public detectClientCity(req: Request, ip: string): string {
        switch (this.config?.detectClientCity?.method) {
            case 'header':
                return req.header(this.config.detectClientCountry.header) || 'not-detected';
            case 'geoip':
                return this.geoIP2.getCity(ip)?.city?.names?.en || 'not-detected';
            default:
                this.log.error('This method of detection city is not supported. Available methods: geoip, header. Default: geoip.');
                return 'not-detected';
        }

    }

    public detectRequestId(req: Request) {
        return req.header(this.config.detectClientRequestId.header) || 'not-detected';
    }
}

export interface IWAFMiddlewareConfig {
    mode?: "normal" | "audit",
    whitelist?: IWhitelistConfig,
    blacklist?: IBlacklistConfig,

    bannedResponse?: {
        httpCode?: number,
        json: string,
        html?: string,
        htmlLink?: string,
    },

    detectClientIp?: {
        headers?: string[];
    },

    detectClientCountry?: {
        method: 'header' | 'geoip'
        header?: string;
    },

    detectClientCity?: {
        method: 'header' | 'geoip'
        header?: string;
    },

    detectClientRequestId?: {
        header?: string;
    }

}

export interface IBannedIPItem {
    ruleId: string;
    ip: string;
    duration: number;
    escalationRate: number;
    requestIds: string[];
}
