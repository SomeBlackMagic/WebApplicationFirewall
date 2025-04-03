import {Request} from "express-serve-static-core";
import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {IBannedIPItem} from "@waf/WAFMiddleware";
import {Log} from "@waf/Log";
import {ConditionsRule, IConditionsRule} from "@waf/Jail/Rules/ConditionsRule";
import {IAbstractRuleConfig} from "@waf/Jail/Rules/AbstractRule";


export class FlexibleRule extends ConditionsRule {

    public static ID: string = 'flexible';

    private suspicions: Record<string, number[]> | [] = [];

    public constructor(
        private rule: IFlexibleRuleConfig,
        private readonly log?: LoggerInterface
    ) {
        super();
        if (!this.log) {
            this.log = Log.instance.withCategory('rules.flexibleRule')
        }
    }

    public async use(clientIp: string, country: string, city: string, req: Request): Promise<boolean | IBannedIPItem> {

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
        this.suspicions[clientIp] = this.suspicions[clientIp].filter(ts => now - ts <= periodMs);

        // Add the current request
        this.suspicions[clientIp].push(now);
        this.log.debug('FlexibleRule counter by key: ' + clientIp, this.suspicions[clientIp].length);

        // If the number of queries exceeds the limit, we block IP
        if (this.suspicions[clientIp].length >= (this.rule.limit || 100)) {
            this.log.info(`Too many suspicious request from ${clientIp}`, []);
            return {
                ruleId: FlexibleRule.ID,
                ip: clientIp,
                duration: this.rule.duration,
                escalationRate: this.rule?.escalationRate || 1.0,
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
