import {JailStorageInterface} from "@waf/Jail/JailStorageInterface";
import {BanInfo} from "@waf/Jail/JailManager";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import fetch, { RequestInitWithRetry } from "@adobe/node-fetch-retry";
import {Log} from "@waf/Log";
import {RequestInfo, Response} from "node-fetch";

export class JailStorageOperator implements JailStorageInterface {

    public constructor(
        private readonly config: IJailStorageOperatorConfig,
        private readonly fetchInstance?: (url: RequestInfo, init?: RequestInitWithRetry) => Promise<Response>,

        private readonly logger?: LoggerInterface
    ) {
        if (!logger) {
            this.logger = Log.instance.withCategory('app.Jail.JailStorageOperator')
        }
        if(!this.fetchInstance) {
            this.fetchInstance = fetch;
        }
    }

    public async load(): Promise<BanInfo[]> {
        return await this.fetchInstance(this.config.apiHost + '/agent/banned/load?agentId=' + this.config.agentId, {
            method: 'GET',
            retryOptions: {
                retryMaxDuration: 10000,
                retryInitialDelay: 1000,
                retryBackoff: 2,

                retryOnHttpResponse: (response) => {
                    if (response.status >= 500) {
                        return true;
                    }
                }
            }
        })
            .then(response => {
                if (response.status >= 500) {
                    return Promise.reject(response.statusText);
                }
                return response.json() as unknown as BanInfo[];
            })
            .catch(error => {
                this.logger?.error('Can not load ips', [error]);
                return Promise.reject(error);
            })
    }

    public async save(newItems: BanInfo[]): Promise<boolean> {
        return await this.fetchInstance(this.config.apiHost + '/agent/banned/update?agentId=' + this.config.agentId, {
            method: 'POST',
            body: JSON.stringify(newItems),
            headers: {
                'Content-Type': 'application/json'
            },
            retryOptions: {
                retryMaxDuration: 10000,
                retryInitialDelay: 1000,
                retryBackoff: 2,

                retryOnHttpResponse: (response) => {
                    if (response.status >= 500) {
                        return true;
                    }
                }
            }
        })
            .then(response => {
                if (response.status >= 500) {
                    return Promise.reject(response.statusText);
                }
                return response.status === 200;
            })
            .catch(error => {
                this.logger?.error('Can not save banned ips', [error]);
                return Promise.reject(error);
            })
    }

}

export interface IJailStorageOperatorConfig {
    apiHost: string;
    agentId: string;
}
