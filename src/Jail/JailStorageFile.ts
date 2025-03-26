import {JailStorageInterface} from "./JailStorageInterface";
import fs, {promises as fsPromises} from "fs";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import {BanInfo} from "./JailManager";
import {Log} from "../Log";
import lockfile, {LockOptions} from "proper-lockfile";
import path from "node:path";

export class JailStorageFile implements JailStorageInterface {

    private lock: () => Promise<void>|null;

    public constructor(
        private readonly config?: IJailStorageFileConfig,
        private readonly logger?: LoggerInterface
    ) {
        if(!this.config.filePath) {
            this.config.filePath = process.cwd() + '/data/blocked_ips.json'
        }

        if (!logger) {
            this.logger = Log.instance.withCategory('jail.jailStorageFile')
        }
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

        return fileData;
    }

    public async save(data: BanInfo[], unlockAfterSave: boolean): Promise<boolean> {
        await fsPromises.writeFile(this.config.filePath, JSON.stringify(data, null, 2));
        if(unlockAfterSave && this.lock !== null) {
            await this.lock();
            this.lock = null;
        }
        return Promise.resolve(undefined);
    }

}

export interface IJailStorageFileConfig {
    filePath?: string
    locker: {
        enabled: boolean
        config?: LockOptions
    }
}
