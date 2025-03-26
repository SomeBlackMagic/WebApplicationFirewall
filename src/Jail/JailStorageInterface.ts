import {BanInfo} from "./JailManager";

export interface JailStorageInterface {
    load(...args: any[]): Promise<BanInfo[]>;
    save(data: BanInfo[], ...args: any[]): Promise<boolean>;
}