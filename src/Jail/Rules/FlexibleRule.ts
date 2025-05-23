import {Request} from "express-serve-static-core";
import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {IBannedIPItem} from "@waf/WAFMiddleware";
import {Log} from "@waf/Log";
import {ConditionsRule, IConditionsRule, ICountersItem} from "@waf/Jail/Rules/ConditionsRule";
import {IAbstractRuleConfig} from "@waf/Jail/Rules/AbstractRule";


export class FlexibleRule extends ConditionsRule {

    public static ID: string = 'flexible';

    private suspicions: Record<string, ICountersItem[]> = {};

    public constructor(
        private rule: IFlexibleRuleConfig,
        private readonly log?: LoggerInterface
    ) {
        super();
        if (!this.log) {
            this.log = Log.instance.withCategory('app.Jail.Rules.FlexibleRule')
        }
    }

    public async use(clientIp: string, country: string, city: string, req: Request, requestId: string): Promise<boolean | IBannedIPItem> {

        const ruleTester: boolean = this.checkConditions(this.rule.conditions, req, country, city);

        if (!ruleTester) {
            return false;
        }

        // Initialize an object for this key
        if (!this.suspicions[clientIp]) {
            this.suspicions[clientIp] = [];
        }

        const now = Date.now();
        const periodMs = (this.rule.period || 60) * 1000;
        // We delete old notes (outside the period)
        this.suspicions[clientIp] = this.suspicions[clientIp].filter((item: ICountersItem) => now - item.time <= periodMs);

        // Add the current request
        this.suspicions[clientIp].push({
            time: now,
            requestId: requestId
        });
        this.log.debug('FlexibleRule '+ this.rule.name+' counter by ip: ' + clientIp, this.suspicions[clientIp].length);

        // If the number of queries exceeds the limit, we block IP
        if (this.suspicions[clientIp].length >= (this.rule.limit || 100)) {
            this.log.info(`Too many suspicious request from ${clientIp}`, []);
            const requestIds = this.suspicions[clientIp].map(item => item.requestId);
            this.suspicions[clientIp] = []; // reset counter to 0;
            return {
                ruleId: FlexibleRule.ID+ ':' + this.rule.name,
                ip: clientIp,
                duration: this.rule.duration,
                escalationRate: this.rule?.escalationRate || 1.0,
                requestIds: requestIds,
            }
        }

        return false;

    }


}

export interface IFlexibleRuleConfig extends IAbstractRuleConfig {
    conditions: IConditionsRule[]
    period: number
    limit: number
    duration: number
    escalationRate?: number

}
