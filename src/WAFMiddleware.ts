import {RequestHandler} from "express";
import {NextFunction, Request, Response} from "express-serve-static-core";
import {JailManager} from "./Jail/JailManager";
import {Log} from "./Log";
import {AbstractRule, IAbstractRuleConfig} from "./Rules/AbstractRule";
import {CompositeRule, ICompositeRuleConfig} from "./Rules/CompositeRule";
import {IStaticRuleConfig, StaticRule} from "./Rules/StaticRule";
import {FlexibleRule, IFlexibleRuleConfig} from "./Rules/FlexibleRule";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";

export class WAFMiddleware {

    private rules: AbstractRule[] = [];

    public constructor(
        private readonly jailManager?: JailManager,
        private readonly log?: LoggerInterface,
    ) {
        if(!jailManager) {
            this.jailManager = JailManager.instance;
        }
        if(!log) {
            this.log = Log.instance.withCategory('app.WAFMiddleware')
        }
    }


    public wafMiddleware(): RequestHandler {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            const clientIp = this.getClientIp(req);

            const blockedUser = this.jailManager.getBlockedIp(clientIp);

            if(blockedUser!== false) {
                if(blockedUser.unbanTime > Date.now()) {
                    this.log.trace('Request from baned IP rejected', [blockedUser.ip, blockedUser.geoCountry, blockedUser.geoCountry]);
                    res.sendStatus(429);
                    return;
                }
            }

            const promiseList = this.rules.map((ruleItem: AbstractRule) => {
                return ruleItem.use(clientIp, req, res, next);
            })

            const result: boolean[] = await Promise.all(promiseList);
            if(result.some(x => x)) {
                res.sendStatus(429);
                return;
            }

            next();
        };
    }


    public loadRules(rulesConfig: IAbstractRuleConfig[]) {

        for (const rule of rulesConfig) {
            switch (rule.type) {
                case CompositeRule.ID:
                    this.rules.push(new CompositeRule(<ICompositeRuleConfig>rule));
                    break;
                case StaticRule.ID:
                    this.rules.push(new StaticRule(<IStaticRuleConfig>rule));
                    break;
                case FlexibleRule.ID:
                    this.rules.push(new FlexibleRule(<IFlexibleRuleConfig>rule));
                    break;

                default:
                    throw new Error('Can not found observer or rule type - ' + rule.type)
            }

        }
        return true;
    }

// ----------------------------
// Function for obtaining a real IP client
// ----------------------------
    public getClientIp(req) {
        if (typeof req.headers['fastly-client-ip']!== "undefined") {
            return req.headers['fastly-client-ip'];
        }

        if (typeof req.headers['cf-connecting-ip']!== "undefined") {
            return req.headers['cf-connecting-ip'];
        }

        if (typeof req.headers['x-original-forwarded-for']!== "undefined") {
            return req.headers['x-original-forwarded-for'];
        }

        // If there is a X-Forwarded-FR, we return the first IP from the list
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            const ips = forwarded.split(',').map(ip => ip.trim());
            if (ips.length) {
                return ips[0];
            }
        }
        return req.ip;
    }
}
