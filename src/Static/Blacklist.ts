import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {Log} from "@waf/Log";
import {IStaticFilterConfig, StaticFilter} from "@waf/Static/StaticFilter";
import {IWhitelistConfig} from "@waf/Static/Whitelist";

export class Blacklist extends StaticFilter<Blacklist, [IBlacklistConfig, LoggerInterface]> {

    static buildInstance(
        config: IWhitelistConfig,
        log?: LoggerInterface,
    ): Blacklist {
        return super.build.call(this, config, log);
    }

    public constructor(
        config: IBlacklistConfig,
        log?: LoggerInterface,
    ) {
        super();
        this.config = config;
        if(!log) {
            this.log = Log.instance.withCategory('app.Static.Blacklist');
        }
    }

}

export interface IBlacklistConfig extends IStaticFilterConfig {
    ips?: string[],
    ipSubnet?: string[],
    geoCountry?: string[],
    geoCity?: string[]
}
