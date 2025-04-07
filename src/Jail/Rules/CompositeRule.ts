import {Request} from "express-serve-static-core";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {IBannedIPItem} from "@waf/WAFMiddleware";
import {Log} from "@waf/Log";
import {ConditionsRule, IConditionsRule, ICountersItem} from "@waf/Jail/Rules/ConditionsRule";
import {IAbstractRuleConfig} from "@waf/Jail/Rules/AbstractRule";


export class CompositeRule extends ConditionsRule {

    // public static GARBAGE_TIME_PERIOD: number = 60 * 1000;
    public static ID: string = 'composite';

    public constructor(
        private rule: ICompositeRuleConfig,
        private log?: LoggerInterface
    ) {
        super();
        if (!log) {
            this.log = Log.instance.withCategory('app.Jail.Rules.CompositeRule');
        }
    }

    private compositeCounters: Record<string, ICountersItem[]> = {};

    public async use(clientIp: string, country:string, city:string, req: Request, requestId: string): Promise<boolean|IBannedIPItem> {

        const ruleTester: boolean = this.checkConditions(this.rule.conditions, req, country, city);

        if(!ruleTester) {
            return Promise.resolve(false);
        }

        const keyParts = this.rule.uniqueClientKey.map(key => {
            switch (key) {
                case 'ip':
                    return clientIp;
                case 'user-agent':
                    return req.header('user-agent') || 'user-agent-not-detected';
                case 'hostname':
                    return req.hostname;
                case 'url':
                    return req.url;
                case 'geo-country':
                    return country;
                case 'geo-city':
                    return city;
                default:
                    return '-';
            }
        });
        const compositeKey = keyParts.join('|');

        // Initialize an array for this key
        if (!this.compositeCounters[compositeKey]) {
            this.compositeCounters[compositeKey] = [];
        }

        const now = Date.now();
        const periodMs = (this.rule.period || 60) * 1000;
        // We delete old notes (outside the period)
        this.compositeCounters[compositeKey] = this.compositeCounters[compositeKey].filter((item: ICountersItem) => now - item.time <= periodMs);

        // Add the current request
        this.compositeCounters[compositeKey].push({
            time: now,
            requestId
        });
        this.log.debug('Composite counter by key:' + compositeKey, this.compositeCounters[compositeKey].length);

        // If the number of queries exceeds the limit, we block IP
        if (this.compositeCounters[compositeKey].length >= (this.rule.limit || 100)) {
            this.log.info(`The composite rule worked for ${clientIp} (key: ${compositeKey}). request: ${this.compositeCounters[compositeKey].length}`);
            return Promise.resolve({
                ruleId: CompositeRule.ID+ ':' + this.rule.name,
                ip: clientIp,
                duration: this.rule.duration,
                escalationRate: this.rule?.escalationRate || 1.0,
                requestIds: this.compositeCounters[compositeKey].map(item => item.requestId),
            })
        }

        return Promise.resolve(false);

    }

    /**
     *  TODO implement cleaner memory
     * @private
     */
    // private cleanCompositeCounters() {
    //     const now = Date.now();
    //
    //     // We sort out all the composite keys for this rule
    //     for (const compositeKey in this.compositeCounters) {
    //         // We filter temporary marks: leave only those that fit during the period
    //         this.compositeCounters[compositeKey] = this.compositeCounters[compositeKey].filter(ts => now - ts <= CompositeRule.GARBAGE_TIME_PERIOD);
    //         // If after filtering the array is empty, remove the key
    //         if (this.compositeCounters[compositeKey].length === 0) {
    //             delete this.compositeCounters[compositeKey];
    //         }
    //     }
    // }


}

export interface ICompositeRuleConfig extends IAbstractRuleConfig {
    uniqueClientKey: string[]
    conditions: IConditionsRule[]
    limit: number
    period: number
    duration: number
    escalationRate?: number

}
