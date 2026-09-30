import { LoggerInterface } from "@elementary-lab/standards/src/LoggerInterface";
import { Request } from "express-serve-static-core";
import { clearInterval } from "node:timers";
import { Log } from "@waf/Log";
import { AbstractRule, IAbstractRuleConfig } from "@waf/Jail/Rules/AbstractRule";

export class StaticRule extends AbstractRule {
    public static ID: string = "static";

    private blockedEntries: string[] = [];

    private readonly updateInterval: NodeJS.Timeout = null;

    public constructor(
        private rule: IStaticRuleConfig,
        private readonly log?: LoggerInterface,
    ) {
        super();

        if (!this.log) {
            this.log = Log.instance.withCategory("app.Jail.Rules.StaticRule");
        }

        this.fetchData().then(() => {
            this.log.info("Loaded static blacklist on start app", this.blockedEntries.length);
        });

        if (this.rule.updateInterval != null && this.rule.updateInterval > 0) {
            this.updateInterval = setInterval(this.fetchData.bind(this), this.rule.updateInterval * 1000);
        }
    }

    public onStop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }

    public async use(
        clientIp: string,
        country: string,
        city: string,
        req: Request,
        requestId: string,
    ): Promise<boolean> {
        const testedValue = this.resolveFieldValue(clientIp, req);
        if (testedValue === undefined) {
            return false;
        }

        const method = this.rule.method ?? "equals";

        if (method === "equals") {
            if (this.blockedEntries.includes(testedValue)) {
                this.log.debug("Reject request", [testedValue, this.rule.field ?? "ip"]);
                return true;
            }
        } else {
            for (const pattern of this.blockedEntries) {
                const regex = this.createRegexFromString(pattern);
                if (regex.test(testedValue)) {
                    this.log.debug("Reject request by regexp", [testedValue, pattern, this.rule.field ?? "ip"]);
                    return true;
                }
            }
        }

        return false;
    }

    private resolveFieldValue(clientIp: string, req: Request): string | undefined {
        const field = this.rule.field ?? "ip";

        switch (true) {
            case field === "ip":
                return clientIp;
            case field === "url":
                return req.url;
            case field === "hostname":
                return req.hostname;
            case field === "user-agent":
                return req.header("user-agent");
            case field.startsWith("header-"):
                return req.header(field.replace("header-", ""));
            default:
                return undefined;
        }
    }

    private async fetchData(): Promise<void> {
        const response = await fetch(this.rule.linkUrl)
            .then(result => {
                if (result.status !== 200) {
                    this.log.error("Can not fetch data from link", [this.rule.linkUrl, this.rule.name]);
                    return new Response("[]");
                }

                return result;
            })
            .catch(error => {
                this.log.error("Can not fetch data from link", [this.rule.linkUrl, error]);
                return new Response("[]");
            });
        try {
            const data = <string[]>await response.json();
            if (data.length !== 0) {
                this.blockedEntries = data;
                this.log.trace("Loaded static blacklist", [this.blockedEntries.length, this.rule.name]);
            } else {
                this.log.warn("Blocked list not updated");
            }
        } catch (e) {
            this.log.warn("Can not load JSON: " + this.rule.linkUrl, e);
        }
    }
}

export interface IStaticRuleConfig extends IAbstractRuleConfig {
    linkUrl: string;
    updateInterval?: number;
    field?: "ip" | "url" | "hostname" | "user-agent" | string;
    method?: "regexp" | "equals";
}
