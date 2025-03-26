import {GeoIP2} from "../GeoIP2";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {Log} from "../Log";
import {JailStorageInterface} from "./JailStorageInterface";
import {JailStorageMemory} from "./JailStorageMemory";
import {IJailStorageFileConfig, JailStorageFile} from "./JailStorageFile";
import assert from "node:assert";

export class JailManager {
    static #instance: JailManager;

    private readonly storeInterval: NodeJS.Timeout = null;

    private blockedIPs: Record<string, BanInfo> = {}


    public constructor(
        private readonly moduleConfig: IJailManagerConfig,
        private readonly storage?: JailStorageInterface,
        private readonly logger?: LoggerInterface,
    ) {
        if (!logger) {
            this.logger = Log.instance.withCategory('jail.jailManager')
        }
        if(this.moduleConfig?.storage?.driver) {
            assert(typeof this.moduleConfig.storage.driverConfig !== 'undefined', "driverConfig must be set in the configuration");
            this.storage = this.createStorageFromConfig(
                this.moduleConfig.storage.driver,
                this.moduleConfig.storage.driverConfig
            )
        }
        if (!this.storage) {
            this.storage = new JailStorageMemory();
        }
        this.storage.load().then((rawJailList) => {
            this.blockedIPs = Object.fromEntries(rawJailList.map(item => [item.ip, item]))
            this.logger.info('Loading ban list on boot', Object.keys(this.blockedIPs).length);
        })
        this.storeInterval = setInterval(() => {
            this.syncDataWithStorage();
        }, this.moduleConfig?.syncInterval || 5000);

    }

    public onStop() {
        if(this.storeInterval) {
            clearInterval(this.storeInterval);
        }
    }

    private createStorageFromConfig(driverName: string, driverConfig: any) {
        switch (driverName) {
            case 'file':
                return new JailStorageFile(driverConfig);
            case 'memory':
                return new JailStorageMemory(driverConfig);
        }

    }

    public static build(...args: [any, ...any[]]) {
        JailManager.instance = new JailManager(...args);
    }

    public static get instance(): JailManager {
        return JailManager.#instance;
    }

    public static set instance(obj: JailManager) {
        if(!JailManager.#instance) {
            JailManager.#instance = obj;
            return;
        }

        throw new Error('JailManager is already instantiated.');
    }


    public async blockIp(ip: string, duration: number = 60, escalationRate: number = 1.0): Promise<void> {
        if (!this.blockedIPs.hasOwnProperty(ip)) {
            this.blockedIPs[ip] = {
                ip: ip,
                escalationCount: 0,
                geoCountry: GeoIP2.instance.getCountry(ip)?.registeredCountry?.names?.en || "unknown",
                geoCity: GeoIP2.instance.getCity(ip)?.city?.names?.en || "unknown",
                unbanTime: 0
            }
        } else {
            this.blockedIPs[ip].escalationCount++
        }
        const unbanTime = Date.now() + this.calculateBanTime(this.blockedIPs[ip].escalationCount, duration, escalationRate) * 1000;
        this.blockedIPs[ip]['unbanTime'] = unbanTime;
        this.logger.info(`IP ${ip} blocked until ${new Date(unbanTime).toISOString()}`, {escalationCount: this.blockedIPs[ip].escalationCount});
        if(this.moduleConfig?.syncAlways) {
            await this.syncDataWithStorage();
        }

    }

    private calculateBanTime(hitCount: number, baseBanDuration: number = 60, rate: number = 1.5): number {
        return baseBanDuration * Math.pow(rate, hitCount);
    }

    public getBlockedIp(ip: string): false | BanInfo {
        return this.blockedIPs[ip] ?? false;
    }

    public getAllBlockedIp() {
        return Object.values(this.blockedIPs);
    }

    public deleteBlockedIp(ip: string): boolean {
        const bannedUser: BanInfo | false = this.blockedIPs[ip] ?? false;
        if (bannedUser === false) {
            return false;
        }
        this.blockedIPs[ip].unbanTime = Date.now() - 1;

        return true
    }




    private async syncDataWithStorage() {
        const rawJailList = await this.storage.load()
        const gropedJails = Object.fromEntries(rawJailList.map(item => [item.ip, item]));
        this.blockedIPs = this.mergeBanLists(this.blockedIPs, gropedJails)
        await this.storage.save(Object.values(this.blockedIPs))
    }


    private mergeBanLists(
        list1: Record<string, BanInfo>,
        list2: Record<string, BanInfo>
    ): Record<string, BanInfo> {
        const mergedList: Record<string, BanInfo> = {...list1};

        for (const ip in list2) {
            if (mergedList[ip]) {
                // If IP already exists, we update the data if UNBANTIME is more
                if (list2[ip].unbanTime > mergedList[ip].unbanTime) {
                    mergedList[ip] = {...mergedList[ip], ...list2[ip]};
                    this.logger.info('Update ban time for ' + list2[ip].ip, new Date(list2[ip].unbanTime).toISOString());
                }
            } else {
                // If IP is not, add to the list
                mergedList[ip] = list2[ip];
                this.logger.info('Add new ip observed from storage', list2[ip]);
            }
        }

        return mergedList;
    }


}

export interface IJailManagerConfig {
    storage?: {
        driver?: string
        driverConfig?: IJailStorageFileConfig
    },
    syncInterval?: number
    syncAlways?: boolean;
}

export type BanInfo = {
    ip: string;
    unbanTime: number;
    escalationCount: number;
    geoCountry: string;
    geoCity: string;
};
