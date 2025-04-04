import {Request, Response} from "express-serve-static-core";
import * as core from "express-serve-static-core";
import {BanInfo, JailManager} from "@waf/Jail/JailManager";
import {HttpBasicAuth, IHttpBasicAuthConfig} from "@waf/Utils/HttpBasicAuth";

export class Api {

    private readonly authenticator: HttpBasicAuth

    public constructor(
        private readonly moduleConfig: IApiConfig,
        private readonly webApp: core.Express,
        private jailManager?: JailManager
    ) {

        this.authenticator = new HttpBasicAuth(this.moduleConfig.auth);
    }

    public bootstrap() {
        if(!this.jailManager) {
            this.jailManager = JailManager.get();
        }

        this.webApp.get('/waf/jail-manager/baned-users', this.authenticator.authentication.bind(this.authenticator), this.getBannedUsers.bind(this));
        this.webApp.delete('/waf/jail-manager/baned-users', this.authenticator.authentication.bind(this.authenticator), this.deleteBannedUsers.bind(this));
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
}

export interface IApiConfig {
    auth: IHttpBasicAuthConfig
}
