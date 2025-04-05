import * as SentryLib from "@sentry/node";
import * as os from "node:os";
import {Singleton} from "@waf/Utils/Singleton";
import {EventHint, Scope} from "@sentry/node";

export class Sentry extends Singleton<Sentry, [ISentryConfig, string]> {

    private readonly sentryInstance: SentryLib.NodeClient;

    public constructor(
        private readonly config: ISentryConfig,
        appVersion: string,
    ) {
        super();
        if (this.config?.enabled) {
            this.sentryInstance = SentryLib.init({
                enabled: true,
                dsn: this.config.dsn || "https://examplePublicKey@o0.ingest.sentry.io/0",
                serverName: os.hostname(),
                release: appVersion,
                debug: this.config.debug || false,
                tracesSampleRate: 1.0,
            });
        }
    }

    public getClient(): SentryLib.NodeClient {
        return this.sentryInstance;
    }

    public captureException(exception: unknown, hint?: EventHint, scope?: Scope): string {
        const eventId: string = this.sentryInstance.captureException(exception, hint, scope);
        if(this.config.debug) {
            console.log(`Sentry Logger [debug]: Sentry eventId: ${eventId}`);
        }
        return eventId;

    }
}

export interface ISentryConfig {
    enabled: boolean;
    dsn?: string;
    release?: string;
    debug?: boolean;
}
