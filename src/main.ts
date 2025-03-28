
import {createProxyMiddleware} from 'http-proxy-middleware';
import express from "express";
import audit from 'express-requests-logger'
import {IWAFMiddlewareConfig, WAFMiddleware} from "@waf/WAFMiddleware";
import {IJailManagerConfig, JailManager} from "@waf/Jail/JailManager";
import {IWhitelistConfig, Whitelist} from "@waf/Whitelist";
import {IAbstractRuleConfig} from "@waf/Rules/AbstractRule";
import {Api, IApiConfig} from "@waf/Api";
import {ConfigLoader} from "@waf/ConfigLoader";
import {GeoIP2} from "@waf/GeoIP2";
import {envBoolean} from "@waf/Utils";
import {Log} from "@waf/Log";


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

console.log('Start Application:', process.env.APP_VERSION);

interface AppConfig {
    proxy: {
        host: string;
    }
    wafMiddleware: IWAFMiddlewareConfig,
    jailManager: IJailManagerConfig
    whitelist: IWhitelistConfig,
    rules: IAbstractRuleConfig[]
    api: IApiConfig

}

(async () => {
    const appConfig = await new ConfigLoader().load<AppConfig>()

    await GeoIP2.instance.init()
    JailManager.build(appConfig.jailManager);
    Whitelist.build(appConfig.whitelist);

    const waf = new WAFMiddleware(appConfig.wafMiddleware);
    waf.loadRules(appConfig.rules)


    const app = express();
    app.disable('x-powered-by');

    const api = new Api(appConfig.api, app);
    api.bootstrap();


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
        JailManager.instance?.onStop();
        // @ts-ignore
        await process.flushLogs();
        process.exit(0);
    })();
}

function uncaughtExceptionHandler(error: Error, origin: any) {
    Log.instance.error('Uncaught Exception', error);
    (async () => {
        JailManager.instance?.onStop();
        // @ts-ignore
        await process.flushLogs();
        process.exit(99);
    })();
}

function uncaughtRejectionHandler(reason: unknown, promise: Promise<unknown>) {
    Log.instance.error('Uncaught Rejection', reason);
    (async () => {
        JailManager.instance?.onStop();
        // @ts-ignore
        await process.flushLogs();
        process.exit(99);
    })();
}

