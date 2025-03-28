import {JailStorageInterface} from "@waf/Jail/JailStorageInterface";
import {BanInfo} from "@waf/Jail/JailManager";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";

export class JailStorageMemory implements JailStorageInterface {

    private data: BanInfo[] = [];

    public constructor(
        private readonly logger?: LoggerInterface
    ) {

    }

    public async load(): Promise<BanInfo[]> {
        return Promise.resolve(this.data);
    }

    public save(data: BanInfo[]): Promise<boolean> {
        this.data = data;

        return Promise.resolve(true);
    }

}
