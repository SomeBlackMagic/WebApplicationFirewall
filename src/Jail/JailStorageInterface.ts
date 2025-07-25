import {BanInfo} from "@waf/Jail/JailManager";

export interface JailStorageInterface {
    load(...args: any[]): Promise<BanInfo[]>;
    save(newItems: BanInfo[], oldItems: BanInfo[], ...args: any[]): Promise<boolean>;
}
