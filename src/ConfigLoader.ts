import fs from 'fs';
import yaml from 'js-yaml';
import process from "process";
import {env} from "./Utils";
import {Log} from "./Log";

export class ConfigLoader {
    public async load<T>(): Promise<T> {
        switch (env('WAF_CONFIG_TYPE', 'file')) {
            case 'file':
                return await this.loadFromFile<T>();
            case 'link':
                return await this.loadFromLink<T>();
            default:
                console.error(`Config type \`${env('WAF_CONFIG_TYPE', 'file')}\` not supported`);
                process.emit('SIGINT');
        }
    }

    async loadFromFile<T>(): Promise<T> {
        const configFilePath = env('WAF_CONFIG_FILE', process.cwd() + '/config.yaml');
        return this.loadYamlConfig<T>(fs.readFileSync(configFilePath, 'utf8'), configFilePath);
    }


    private async loadFromLink<T>(): Promise<T> {
        const link = env('WAF_CONFIG_FILE');
        const response = await fetch(link)
            .then((result) => {
                if (result.status !== 200) {
                    throw new Error('Can not fetch config from link: ' + link + ' status code: ' + response.status);
                }
                return result;
            }).catch((error) => {
                Log.instance.emergency('Can not fetch config from link', [link, error]);
                throw new Error('Can not fetch config from link: ' + link);
            });

        return this.loadYamlConfig<T>(await response.text(), link);
    }


    private loadYamlConfig<T>(fileContent: string, source: string): T {
        try {
            return yaml.load(fileContent) as T;
        } catch (e) {
            Log.instance.emergency(`Failed to parse YAML from ${source}`, e);
            process.emit('SIGINT');
        }
    }

}





