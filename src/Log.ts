
import {LogLevel} from "@elementary-lab/logger/src/Types";
import {Logger} from "@elementary-lab/logger/src/Logger";
import {ConsoleTarget} from "@elementary-lab/logger/src/Targets/ConsoleTarget";
import {CategoryExtension} from "@elementary-lab/logger/src/Extensions/CategoryExtension";
import {AbstractTarget} from "@elementary-lab/logger/src/Targets/AbstractTarget";
import {env, envBoolean, envNumber} from "@waf/Utils/Env";


export class Log {

    static #instance: Log;

    public static get instance(): Log {
        if (!Log.#instance) {
            Log.#instance = new Log();
        }

        return Log.#instance;
    }

    public static set instance(obj: Log) {
        if(!Log.#instance) {
            Log.#instance = obj;
            return;
        }

        throw new Error('Log is already instantiated.');
    }

    private obj: Logger;

    public constructor(targets?: AbstractTarget[]) {
        if(!targets) {
            targets = [
                new ConsoleTarget({
                    enabled: true,
                    include: env('WAF_LOG_CATEGORY_INCLUDE', '') ? env('WAF_LOG_CATEGORY_INCLUDE', '').split(',') : [],
                    exclude: env('WAF_LOG_CATEGORY_EXCLUDE', '') ? env('WAF_LOG_CATEGORY_EXCLUDE', '').split(',') : [],
                    levels: [
                        LogLevel.EMERGENCY,
                        LogLevel.ERROR,
                        LogLevel.WARNING,
                        LogLevel.NOTICE,
                        LogLevel.INFO,
                        ...envBoolean('WAF_LOG_DEBUG', false) ? [LogLevel.DEBUG] : [],
                        ...envBoolean('WAF_LOG_TRACE', false) ? [LogLevel.TRACE] : [],
                        ...envBoolean('WAF_LOG_PROFILE', false) ? [LogLevel.PROFILE] : [],
                    ]
                })
            ];
        }
        this.obj = new Logger({
            targets: targets,
            traceLevel: 0,
            flushByTimeInterval: envNumber('WAF_LOG_FLUSH_INTERVAL', 1000, 2)
        })
    }

    public withCategory(categoryName: string): CategoryExtension {
        return this.obj.withCategory(categoryName);
    }

    public info(message: string, context?: any, category: string = 'app') {
        this.obj.info(message, context, category);
    }

    public debug(message: string, context?: any, category: string = 'app') {
        this.obj.debug(message, context, category);
    }

    public profile(message: string, context?: any, category: string = 'app') {
        this.obj.profile(message, context, category);
    }

    public warn(message: string, context?: any, category: string = 'app') {
        this.obj.warn(message, context, category);
    }

    public error(message: string, context?: any, category: string = 'app') {
        this.obj.error(message, context, category);
    }

    public emergency(message: string, context?: any, category: string = 'app') {
        this.obj.emergency(message, context, category);
    }
}
