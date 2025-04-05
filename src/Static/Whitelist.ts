import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {Log} from "@waf/Log";
import {IStaticFilterConfig, StaticFilter} from "@waf/Static/StaticFilter";

export class Whitelist extends StaticFilter<Whitelist, [IWhitelistConfig, LoggerInterface]> {

    static buildInstance(
        config: IWhitelistConfig,
        log?: LoggerInterface,
    ): Whitelist {
        return super.build.call(this, config, log);
    }

    public constructor(
        config: IWhitelistConfig,
        log?: LoggerInterface,
    ) {
        super();
        this.config = config;
        if(!log) {
            this.log = Log.instance.withCategory('app.Static.Whitelist');
        }
    }

}

export interface IWhitelistConfig extends IStaticFilterConfig {
    ips?: string[],
    ipSubnet?: string[],
    geoCountry?: string[],
    geoCity?: string[]
}
