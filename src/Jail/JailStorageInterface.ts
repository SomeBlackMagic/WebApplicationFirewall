import {BanInfo} from "@waf/Jail/JailManager";

export interface JailStorageInterface {
    load(...args: any[]): Promise<BanInfo[]>;
    save(data: BanInfo[], ...args: any[]): Promise<boolean>;
}
