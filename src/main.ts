'use strict'
import {createProxyMiddleware} from 'http-proxy-middleware';
import express from "express";
import audit from 'express-requests-logger'
import {IWAFMiddlewareConfig, WAFMiddleware} from "@waf/WAFMiddleware";
import {IJailManagerConfig, JailManager} from "@waf/Jail/JailManager";
import {Api, IApiConfig} from "@waf/Api";
import {ConfigLoader} from "@waf/ConfigLoader";
import {GeoIP2} from "@waf/GeoIP2";
import {env, envBoolean} from "@waf/Utils/Env";
import {Log} from "@waf/Log";
import cookieParser from 'cookie-parser';
import sourceMapSupport from 'source-map-support'
import {IMetricsConfig, Metrics} from "@waf/Metrics/Metrics";
import {IWhitelistConfig, Whitelist} from "@waf/Static/Whitelist";
import {Blacklist, IBlacklistConfig} from "@waf/Static/Blacklist";
import {ISentryConfig, Sentry} from "@waf/Sentry";
import {UnderAttackMiddleware} from "@waf/UnderAttack/UnderAttackMiddleware";
import bodyParser from 'body-parser';
sourceMapSupport.install()



// /*catches ctrl+c event*/
process.on('SIGINT', exitHandler.bind(null, {exit: true, code:'SIGINT'}));
process.on('SIGQUIT', exitHandler.bind(null, {exit: true, code:'SIGQUIT'}));

/*catches uncaught exceptions*/
process.on('uncaughtException', uncaughtExceptionHandler);
process.on('unhandledRejection', uncaughtRejectionHandler);


/*catches "kill pid" (for example: nodemon restart)*/
process.on('SIGUSR1', exitHandler.bind(null, {exit: true, code:'SIGUSR1'}));
process.on('SIGUSR2', exitHandler.bind(null, {exit: true, code:'SIGUSR2'}));
process.on('SIGTERM', exitHandler.bind(null, {exit: true, code:'SIGTERM'}));

console.log('Start Application:', '__DEV_DIRTY__');

interface AppConfig {
    proxy: {
        host: string;
    }
    wafMiddleware: IWAFMiddlewareConfig,
    jailManager: IJailManagerConfig
    api: IApiConfig,
    metrics: IMetricsConfig,
    sentry: ISentryConfig

}


(async () => {
    const appConfig = await new ConfigLoader().load<AppConfig>()
    Sentry.build(appConfig.sentry, "__DEV_DIRTY__");
    await GeoIP2.build().init();

    const app = express();
    app.use(cookieParser())
    app.use(bodyParser.json())
    app.disable('x-powered-by');

    const api = new Api(appConfig.api, app);

    Metrics.build(appConfig.metrics, app).bootstrap();

    await JailManager.build(appConfig.jailManager).bootstrap();

    Whitelist.buildInstance(appConfig?.wafMiddleware?.whitelist ?? {})
    Blacklist.buildInstance(appConfig?.wafMiddleware?.blacklist ?? {})
    UnderAttackMiddleware.build(appConfig?.wafMiddleware?.underAttack ?? {})

    api.bootstrap();

    const waf = new WAFMiddleware(appConfig.wafMiddleware ?? {});

    app.get('/waf/healthz', (req, res) => {
        res.send("Hello from WAF server!");
    });

    // We use WAF Middleware to all routes
    app.use(waf.use());

    if (envBoolean('WAF_AUDIT', false) == true) {
        app.use(audit({
            excludeURLs: [
                "/waf/healthz"
            ],
            // excludeHeaders: ["accept", "sec-fetch-mode", "accept-encoding", "accept-language"],
            response: {
                audit: envBoolean('WAF_AUDIT_RESPONSE', false)  == true,
            },
            request: {
                audit: envBoolean('WAF_AUDIT_REQUEST', false)  == true,
            },
            // shouldSkipAuditFunc: function (req: Request, res: Response) {
            //     return res.statusCode !== 200
            //     // return false;
            // }
        }));
    }

    app.use('/', createProxyMiddleware({
        target: appConfig.proxy.host,
        changeOrigin: false
    }));

    const port = 3000;
    app.listen(port, () => {
        Log.instance.info("WAF server started on port " + port);
    });
})();


function exitHandler() {
    Log.instance.info('On stop');
    (async () => {
        JailManager.get().onStop();
        // @ts-ignore
        await process.flushLogs();
        process.exit(0);
    })();
}

function uncaughtExceptionHandler(error: Error, origin: any) {


    Log.instance.error('Uncaught Exception', error);
    (async () => {
        try {
            Sentry.get().captureException(error);
            await Sentry.get().getClient().flush();
            JailManager.get().onStop();
        } catch (e: Error | any) {
            console.error(e);
        }
        // @ts-ignore
        await process.flushLogs();
        process.exit(99);
    })();
}

function uncaughtRejectionHandler(reason: unknown, promise: Promise<unknown>) {
    Log.instance.error('Uncaught Rejection', reason);
    (async () => {
        try {
            Sentry.get()?.captureException(reason);
            await Sentry.get()?.getClient()?.flush();
            JailManager.get().onStop();
        } catch (e: Error | any) {
            console.error(e);
        }

        // @ts-ignore
        await process.flushLogs();
        process.exit(99);
    })();
}

