import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {Log} from "@waf/Log";
import {IStaticFilterConfig, StaticFilter} from "@waf/Static/StaticFilter";

export class Whitelist extends StaticFilter {
    static #instance: Whitelist;

    public static build(...args: [any, ...any[]]) {
        Whitelist.instance = new Whitelist(...args);
    }

    public static get instance(): Whitelist {
        return Whitelist.#instance;
    }

    public static set instance(obj: Whitelist) {
        if(!Whitelist.#instance) {
            Whitelist.#instance = obj;
            return;
        }

        throw new Error('Whitelist is already instantiated.');
    }


    public constructor(
        config: IWhitelistConfig,
        log?: LoggerInterface,
    ) {
        super();
        this.config = config;
        if(!log) {
            this.log = Log.instance.withCategory('app.Whitelist');
        }
    }

}

export interface IWhitelistConfig extends IStaticFilterConfig {
    ips?: string[],
    ipSubnet?: string[],
    geoCountry?: string[],
    geoCity?: string[]
}
