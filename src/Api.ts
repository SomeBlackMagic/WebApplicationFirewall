import {NextFunction, Request, Response} from "express-serve-static-core";
import * as core from "express-serve-static-core";
import {BanInfo, JailManager} from "@waf/Jail/JailManager";

export class Api {

    public readonly authenticationMiddleware: (req: Request, res: Response, next: NextFunction) => void;

    public constructor(
        private readonly moduleConfig: IApiConfig,
        private readonly webApp: core.Express,
        private readonly jailManager?: JailManager
    ) {
        // Bind the middleware to make it testable
        this.authenticationMiddleware = this.authentication.bind(this);
        if(!jailManager) {
            this.jailManager = JailManager.instance;
        }
    }

    public bootstrap() {
        this.webApp.get('/waf/jail-manager/baned-users', this.authentication.bind(this), this.getBannedUsers.bind(this));
        this.webApp.delete('/waf/jail-manager/baned-users', this.authentication.bind(this), this.deleteBannedUsers.bind(this));
    }


    public getBannedUsers(req: Request, res: Response) {
        res.type('json').send(JSON.stringify(this.jailManager.getAllBlockedIp().map((item: BanInfo) => {
            // @ts-ignore
            item.unbanTimeISO = new Date(item.unbanTime).toISOString()
            // @ts-ignore
            item.isBlocked = Date.now() < parseInt(item.unbanTime);
            return item;
        })));
    }

    public deleteBannedUsers(req: Request, res: Response) {
        if(!req.body.ip) {
            res.sendStatus(500);
        }
        const result = this.jailManager.deleteBlockedIp(req.body.ip);
        res.type('json').send(JSON.stringify(result));
    }

    private authentication(req: Request, res: Response, next: NextFunction) {
        if(!this.moduleConfig?.auth?.enabled) {
            // If Authorized user
            next();
            return;
        }
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            res.header('WWW-Authenticate', 'Basic realm="WAF authentication"');
            res.sendStatus(401);

            return;
            // let err = new Error('You are not authenticated!');
            // res.setHeader('WWW-Authenticate', 'Basic');
            // // err.status = 401;
            // return next(err)
        }

        const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const user = auth[0];
        const pass = auth[1];

        if (
            user == this.moduleConfig.auth.username
            &&
            pass == this.moduleConfig.auth.password
        ) {

            // If Authorized user
            next();
        } else {
            res.header('WWW-Authenticate', 'Basic realm="WAF authentication"');
            res.sendStatus(401);

            // let err = new Error('You are not authenticated!');
            // res.setHeader('WWW-Authenticate', 'Basic');
            // err.status = 401;
            return;
        }
    }
}

export interface IApiConfig {
    auth: {
        enabled: boolean;
        username?: string;
        password?: string;
    }
}
