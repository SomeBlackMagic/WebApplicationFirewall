import fs, {promises as fsPromises} from "fs";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";
import lockfile, {LockOptions} from "proper-lockfile";
import path from "node:path";
import {JailStorageInterface} from "@waf/Jail/JailStorageInterface";
import {BanInfo} from "@waf/Jail/JailManager";
import {Log} from "@waf/Log";

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
            this.logger = Log.instance.withCategory('app.Jail.JailStorageFile')
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
        // Создаем Map из старых элементов для быстрого поиска по IP
        const mergedMap = new Map<string, BanInfo>();

        // Добавляем все старые элементы в Map
        oldItems.forEach(item => {
            mergedMap.set(item.ip, item);
        });

        // Перезаписываем/добавляем новые элементы
        newItems.forEach(item => {
            mergedMap.set(item.ip, item);
        });

        // Возвращаем массив из всех значений Map
        return Array.from(mergedMap.values());
    }

}

export interface IJailStorageFileConfig {
    filePath?: string
    locker: {
        enabled: boolean
        config?: LockOptions
    }
}
