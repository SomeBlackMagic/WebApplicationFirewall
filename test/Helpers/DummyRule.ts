import {AbstractRule} from "../../src/Rules/AbstractRule";
import {NextFunction, Request, Response} from "express-serve-static-core";


export class DummyRule extends AbstractRule {

    public constructor(
        private readonly response:boolean
    ) {
        super();
    }

    public use(clientIp: string, req: Request, res: Response, next: NextFunction): Promise<boolean> {
        return Promise.resolve(this.response);
    }

}
