import {NextFunction, Request, Response} from "express-serve-static-core";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {Log} from "@waf/Log";
import {merge} from "lodash";

export class HttpBasicAuth {
    public constructor(
        private readonly config: IHttpBasicAuthConfig,
        private readonly logger?: LoggerInterface
    ) {
        this.config = merge<object|IHttpBasicAuthConfig, IHttpBasicAuthConfig>({
            enabled: false,
        }, config);

        if (!this.logger) {
            this.logger = Log.instance.withCategory('app.Api.Auth');
        }
    }

    public authentication(req: Request, res: Response, next: NextFunction) {
        if(!this.config.enabled) {
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
            user == this.config.username
            &&
            pass == this.config.password
        ) {

            // If Authorized user
            next();
        } else {
            this.logger.warn('Unauthorized user', [user, req.ip]);
            res.header('WWW-Authenticate', 'Basic realm="WAF authentication"');
            res.sendStatus(401);

            // let err = new Error('You are not authenticated!');
            // res.setHeader('WWW-Authenticate', 'Basic');
            // err.status = 401;
            return;
        }
    }
}

export interface IHttpBasicAuthConfig {
    enabled: boolean;
    username?: string;
    password?: string;
}
