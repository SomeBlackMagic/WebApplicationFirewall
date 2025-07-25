import {JailStorageInterface} from "@waf/Jail/JailStorageInterface";
import {BanInfo} from "@waf/Jail/JailManager";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import fetch from "@adobe/node-fetch-retry";
import {Log} from "@waf/Log";

export class JailStorageOperator implements JailStorageInterface {

    public constructor(
        private readonly config: IJailStorageOperatorConfig,
        private readonly logger?: LoggerInterface

    ) {
        if (!logger) {
            this.logger = Log.instance.withCategory('app.Jail.JailStorageOperator')
        }
    }

    public async load(): Promise<BanInfo[]> {
        return await fetch(this.config.apiHost + '/agent/banned/load?agentId='+this.config.agentId, {
            method: 'GET',
            retryOptions: {

                retryInitialDelay: 2000,
                retryBackoff: 3,
                retryOnHttpResponse: function (response) {
                    if ( (response.status >= 500) || response.status >= 400) { // retry on all 5xx and all 4xx errors
                        return true;
                    }
                }
            }
        })
            .then(response => {
                return response.json() as unknown as BanInfo[];
            })
            .catch(error => {
                this.logger?.error('Can not load ips', [error]);
                return Promise.reject(error);
            })
    }

    public async save(newItems: BanInfo[]): Promise<boolean> {
        return await fetch(this.config.apiHost + '/agent/banned/update?agentId='+this.config.agentId, {
            method: 'POST',
            body: JSON.stringify(newItems),
            headers: {
                'Content-Type': 'application/json'
            },
            retryOptions: {
                retryInitialDelay: 2000,
                retryBackoff: 3,
                retryOnHttpResponse: function (response) {
                    if ( (response.status >= 500) || response.status >= 400) { // retry on all 5xx and all 4xx errors
                        return true;
                    }
                }
            }
        })
            .then(response => {
                return response.status === 200;
            })
            .catch(error => {
                this.logger?.error('Can not save banned ips', [error]);
                return false;
            })
    }

}

export interface IJailStorageOperatorConfig {
    apiHost: string;
    agentId: string;
}
