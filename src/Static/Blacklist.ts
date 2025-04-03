import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {Log} from "@waf/Log";
import {IStaticFilterConfig, StaticFilter} from "@waf/Static/StaticFilter";

export class Blacklist extends StaticFilter {
    static #instance: Blacklist;

    public static build(...args: [any, ...any[]]) {
        Blacklist.instance = new Blacklist(...args);
    }

    public static get instance(): Blacklist {
        return Blacklist.#instance;
    }

    public static set instance(obj: Blacklist) {
        if(!Blacklist.#instance) {
            Blacklist.#instance = obj;
            return;
        }

        throw new Error('Blacklist is already instantiated.');
    }


    public constructor(
        config: IBlacklistConfig,
        log?: LoggerInterface,
    ) {
        super();
        this.config = config;
        if(!log) {
            this.log = Log.instance.withCategory('app.Blacklist');
        }
    }

}

export interface IBlacklistConfig extends IStaticFilterConfig {
    ips?: string[],
    ipSubnet?: string[],
    geoCountry?: string[],
    geoCity?: string[]
}
