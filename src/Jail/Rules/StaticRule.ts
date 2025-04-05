import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {clearInterval} from "node:timers";
import {Log} from "@waf/Log";
import {AbstractRule, IAbstractRuleConfig} from "@waf/Jail/Rules/AbstractRule";


export class StaticRule extends AbstractRule {

    public static ID: string = 'static';

    private blockedIPS: string[] = []

    private readonly updateInterval: NodeJS.Timeout = null;

    public constructor(
        private rule: IStaticRuleConfig,
        private readonly log?: LoggerInterface
    ) {
        super();

        if(!this.log) {
            this.log = Log.instance.withCategory('app.Jail.Rules.StaticRule')
        }

        this.fetchData().then(() => {
            this.log.info('Loaded static blacklist on start app', this.blockedIPS.length);
        })

        if(this.rule.updateInterval != null && this.rule.updateInterval > 0) {
            this.updateInterval = setInterval(this.fetchData.bind(this), this.rule.updateInterval * 1000);
        }
    }

    public onStop() {
        if(this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }

    public async use(clientIp: string): Promise<boolean> {
        if(this.blockedIPS.includes(clientIp)) {
            this.log.debug('Reject request',  clientIp);
            return true;
        }
        return false;
    }

    private async fetchData(): Promise<void> {
        const response = await fetch(this.rule.linkUrl)
            .then((result) => {
                if(result.status !== 200) {
                    this.log.error('Can not fetch data from link', [this.rule.linkUrl]);
                    return new Response('[]');
                }

                // TODO implement check result
                // if(response.headers.get('content-type') !== "application/json") {
                //     this.log.error('Response is not JSON', [this.rule.linkUrl, response.headers.get('content-type')]);
                //     return new Response('[]');
                // }
                return result;
            }).catch((error) => {
                this.log.error('Can not fetch data from link', [this.rule.linkUrl, error]);
                return new Response('[]');
            });
        try {
            const data = <string[]>await response.json();
            if(data.length !== 0) {
                this.blockedIPS = data;
                this.log.trace('Loaded static blacklist', this.blockedIPS.length);
            } else {
                this.log.warn('Blocked list not updated');
            }
        } catch (e) {
            this.log.warn('Can not load JSON: ' + this.rule.linkUrl, e);
        }


    }


}

export interface IStaticRuleConfig extends IAbstractRuleConfig {
    linkUrl: string
    updateInterval?: number;
}
