import {AbstractRule, IAbstractRuleConfig} from "./AbstractRule";
import {NextFunction, Request, Response} from "express-serve-static-core";
import {Log} from "../Log";
import { LoggerInterface } from '@elementary-lab/standards/src/LoggerInterface';
import {JailManager} from "../Jail/JailManager";

export class FlexibleRule extends AbstractRule {

    public static ID: string = 'flexible';


    private suspicions: Record<string, number[]> | [] = [];

    public constructor(
        private rule: IFlexibleRuleConfig,
        private readonly log?: LoggerInterface
    ) {
        super();
        if(!this.log) {
            this.log = Log.instance.withCategory('rules.flexibleRule')
        }
    }

    public async use(clientIp: string, req: Request, res: Response, next: NextFunction): Promise<boolean> {
        let testedValue: string;
        switch (true) {
            case this.rule.field === 'url':
                testedValue = req.url
                break;
            case this.rule.field === 'user-agent':
                testedValue = req.header('user-agent');
                break;
            case this.rule.field.indexOf('header-') !== -1:
                testedValue = req.header(this.rule.field.replace('header-', ''),);
                break

        }

        const ruleTester = this.rule.scan.some((item) => {
            switch (item.method) {
                case 'equals':
                    return item.values.includes(testedValue)
                case 'regexp':
                    return item.values.some(rule => {
                        const ruleRegexp = new RegExp(this.createRegexFromString(rule))
                        return ruleRegexp.test(testedValue);
                    });
            }
        })


        if(!ruleTester) {
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
        this.log.debug('Composite counter by key:' + clientIp,   this.suspicions[clientIp].length);

        // If the number of queries exceeds the limit, we block IP
        if (this.suspicions[clientIp].length >= (this.rule.limit || 100)) {
            this.log.info(`Too many suspicious request from ${clientIp}`, []);
            await JailManager.instance.blockIp(clientIp, this.rule.duration, this.rule.escalationRate || 1.0 );
            return true;
        }
        return false;

    }



}

export interface IFlexibleRuleConfig extends IAbstractRuleConfig {
    field: string
    scan: {
        method: "regexp"|"equals"
        values: string[]
    }[]

    period: number
    limit: number
    duration: number
    escalationRate?: number

}
