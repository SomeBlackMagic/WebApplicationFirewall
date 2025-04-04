import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {Log} from "@waf/Log";
import * as core from "express-serve-static-core";
import * as client from "prom-client";
import {Request, Response} from "express-serve-static-core";
import {HttpBasicAuth, IHttpBasicAuthConfig} from "@waf/Utils/HttpBasicAuth";
import {env} from "@waf/Utils/Env";
import crypto from 'crypto';
import express_prom_bundle from "express-prom-bundle";
import {Registry} from "prom-client";
import {Singleton} from "@waf/Utils/Singleton";

export class Metrics extends Singleton<Metrics, []>{

    public constructor(
        private readonly config: IMetricsConfig,
        private readonly webApp: core.Express,
        private registerMetrics?: Registry,
        private readonly logger?: LoggerInterface
    ) {
        super();
        if(!logger) {
            this.logger = Log.instance.withCategory('metrics');
        }
    }

    public bootstrap(registry?: Registry) {
        if(!this.config.enabled) {
            return false;
        }
        if(!registry) {
            this.registerMetrics = new Registry();
        }
        client.collectDefaultMetrics({
            register: this.registerMetrics,
            prefix: 'waf_',
            gcDurationBuckets: [0.1, 0.2, 0.3],
            labels: { INSTANCE_ID: env('WAF_INSTANCE_ID', crypto.createHash('md5').update(process.pid.toString()).digest('hex'))},
        });
        this.registerMetrics.setDefaultLabels({ INSTANCE_ID: env('WAF_INSTANCE_ID', crypto.createHash('md5').update(process.pid.toString()).digest('hex'))})
        this.registerEndpoint();
    }


    private registerEndpoint() {
        this.webApp.use(express_prom_bundle({
            autoregister: false,
            includeMethod: true,
            includePath: false,
            includeStatusCode: true,
            includeUp: false,
            promRegistry: this.registerMetrics,
            httpDurationMetricName: 'waf_http_duration_seconds'
        }));
        const auth = new HttpBasicAuth(this.config.auth);
        this.webApp.get('/waf/metrics', auth.authentication.bind(auth), async (req: Request, res: Response) => {
            try {
                res.set('Content-Type', this.registerMetrics.contentType);
                res.end(await this.registerMetrics.metrics());
            } catch (err) {
                res.status(500).end(err.message);
            }
        })
    }

    public getRegisters(): Registry {
        return this.registerMetrics;
    }

    public isEnabled(): boolean {
        return this.config.enabled;
    }
}

export interface IMetricsConfig {
    enabled: boolean,
    auth: IHttpBasicAuthConfig
}
