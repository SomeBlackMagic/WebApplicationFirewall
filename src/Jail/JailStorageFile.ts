import fs, {promises as fsPromises} from "fs";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import lockfile, {LockOptions} from "proper-lockfile";
import path from "node:path";
import {JailStorageInterface} from "@waf/Jail/JailStorageInterface";
import {BanInfo} from "@waf/Jail/JailManager";
import {Log} from "@waf/Log";
import * as promClient from "prom-client";
import {Metric} from "prom-client";
import {Metrics} from "@waf/Metrics/Metrics";

export class JailStorageFile implements JailStorageInterface {

    private metrics: Metric[] = [];

    private lock: () => Promise<void>|null;

    public constructor(
        private readonly config?: IJailStorageFileConfig,
        private readonly metricsInstance?: Metrics,
        private readonly logger?: LoggerInterface
    ) {
        if(!this.config.filePath) {
            this.config.filePath = process.cwd() + '/data/blocked_ips.json'
        }

        if(!metricsInstance) {
            this.metricsInstance = Metrics.get();
        }

        if (!logger) {
            this.logger = Log.instance.withCategory('app.Jail.JailStorageFile')
        }

        if(this.metricsInstance.isEnabled()) {
            this.bootstrapMetrics();
        }
    }

    public bootstrapMetrics() {
        this.metrics['storage_data'] = new promClient.Gauge({
            name: 'waf_jail_storage_data',
            help: 'How many data in storage grouped by ruleId, country, city, isBlocked',
            labelNames: ['country', 'city', 'ruleId', 'isBlocked', 'escalationCount'],
            registers: [this.metricsInstance.getRegisters()]
        });
    }

    public async load(isLock: boolean = false): Promise<BanInfo[]> {
        let fileData = [];

        // We guarantee that the catalog for the file exists
        await fsPromises.mkdir(path.dirname(this.config.filePath), {recursive: true});

        if (!fs.existsSync(this.config.filePath)) {
            await fsPromises.writeFile(this.config.filePath, JSON.stringify([], null, 2))
        }

        if(isLock) {
            this.logger.trace('Create lock for file "' + this.config.filePath + '"');
            this.lock = await lockfile.lock(this.config.filePath, {
                retries: {retries: 3}
            });
            this.logger.trace('File locked "' + this.config.filePath + '"');
        }

        try {
            const content = await fsPromises.readFile(this.config.filePath, 'utf8');
            fileData = JSON.parse(content);
        } catch (err) {
            this.logger.emergency('can not open file with jail IP:', err)
            fileData = [];
        }
        this.reCalculateStorageMetrics(fileData)
        return fileData;
    }

    public async save(newItems: BanInfo[], oldItems: BanInfo[], unlockAfterSave: boolean): Promise<boolean> {
        const mergedItems = this.mergeBanLists(oldItems, newItems);

        await fsPromises.writeFile(this.config.filePath, JSON.stringify(mergedItems, null, 2));
        if(unlockAfterSave && this.lock !== null) {
            await this.lock();
            this.lock = null;
        }
        return Promise.resolve(true);
    }

    private mergeBanLists(oldItems: BanInfo[], newItems: BanInfo[]): BanInfo[] {
        // Create a MAP of old elements for a quick search by IP
        const mergedMap = new Map<string, BanInfo>();

        // Add all old elements to the Map
        oldItems.forEach(item => {
            mergedMap.set(item.ip, item);
        });

        newItems.forEach(item => {
            mergedMap.set(item.ip, item);
        });

        return Array.from(mergedMap.values());
    }

    protected reCalculateStorageMetrics(blockedIPsLoaded: BanInfo[] = []) {
        const counts = new Map<string, number>();

        for (const entry of Object.values(blockedIPsLoaded)) {
            const { ruleId, country, city } = entry.metadata;
            const isBlocked = Date.now() < entry.unbanTime;
            const key = `${ruleId}|||${country}|||${city}|||${isBlocked}|||${entry.escalationCount}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        for (const [key, value] of counts.entries()) {
            const [ruleId, country, city, isBlocked, escalationCount] = key.split('|||');
            this.metrics['storage_data']?.set({ ruleId, country, city, isBlocked, escalationCount}, value);
        }
    }

}

export interface IJailStorageFileConfig {
    filePath?: string
    locker: {
        enabled: boolean
        config?: LockOptions
    }
}
