
import {Request} from "express-serve-static-core";
import {AbstractRule} from "@waf/Jail/Rules/AbstractRule";

export abstract class ConditionsRule extends AbstractRule {

    protected checkConditions(conditions: IConditionsRule[], req: Request, country: string, city: string): boolean {
        return conditions.every((item) => {
            let testedValue: string;
            switch (true) {
                case item.field === 'url':
                    testedValue = req.url
                    break;
                case item.field === 'hostname':
                    testedValue = req.hostname
                    break;
                case item.field === 'user-agent':
                    testedValue = req.header('user-agent');
                    break;
                case item.field.indexOf('header-') !== -1:
                    testedValue = req.header(item.field.replace('header-', ''),);
                    break
                case item.field === 'geo-country':
                    testedValue = country;
                    break
                case item.field === 'geo-city':
                    testedValue = city;
                    break
            }

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
    }

}

export interface IConditionsRule {
    field: string
    method: "regexp" | "equals"
    values: string[]
}
