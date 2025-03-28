import {NextFunction, Request, Response} from "express-serve-static-core";
import {IBannedIPItem} from "@waf/WAFMiddleware";
import {AbstractRule} from "@waf/Rules/AbstractRule";



export class DummyRule extends AbstractRule {

    public constructor(
        private readonly response:boolean|IBannedIPItem
    ) {
        super();
    }

    public use(clientIp: string, req: Request, res: Response, next: NextFunction): Promise<boolean|IBannedIPItem> {
        return Promise.resolve(this.response);
    }

}
