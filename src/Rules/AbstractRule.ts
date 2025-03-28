import { Request, Response} from "express-serve-static-core";
import {IBannedIPItem} from "@waf/WAFMiddleware";

export abstract class AbstractRule {
     public abstract use(clientIp: string, country:string, city:string, req: Request, res: Response): Promise<boolean|IBannedIPItem>;

    protected createRegexFromString(regexString: string) {
        //We check whether the line begins with the slash and whether it contains another slash at the end of the pattern
        const regexParts = regexString.match(/^\/(.*)\/([a-z]*)$/i);
        if (regexParts) {
            const pattern = regexParts[1]; // Pattern without limiters
            const flags = regexParts[2];   // flags
            return new RegExp(pattern, flags);
        }
        // If the line is not in the /pattern /flags format, we create a regular expression from the entire line
        return new RegExp(regexString);
    }

}
export interface IAbstractRuleConfig {
     type: string;
}
