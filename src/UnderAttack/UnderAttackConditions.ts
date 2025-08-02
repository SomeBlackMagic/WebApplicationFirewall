import {ConditionsRule, IConditionsRule} from "@waf/Jail/Rules/ConditionsRule";
import {IBannedIPItem} from "@waf/WAFMiddleware";
import {Request} from "express-serve-static-core";

export class UnderAttackConditions extends ConditionsRule {
    public constructor(
        private readonly conditions: UnderAttackConditionConfig[]
    ) {
        super();
    }
    public use(clientIp: string, country: string, city: string, req: Request, requestId: string): Promise<boolean | IBannedIPItem> {
        return Promise.resolve(
            this.checkConditions(this.conditions, req, country, city)
        );
    }
}

export type UnderAttackConditionConfig = IConditionsRule
