import { City, Country, Reader } from "@maxmind/geoip2-node";
import process from "process";
import ReaderModel from "@maxmind/geoip2-node/dist/src/readerModel";
import fs from "fs";
import { Log } from "@waf/Log";
import { Singleton } from "@waf/Utils/Singleton";

export interface IGeoIPConfig {
    dbCountryPath?: string;
    dbCityPath?: string;
}

export class GeoIP2 extends Singleton<GeoIP2, [IGeoIPConfig?]> {
    private readerCity: ReaderModel;
    private readerCountry: ReaderModel;
    private config: IGeoIPConfig;

    constructor(config?: IGeoIPConfig) {
        super();
        this.config = config ?? {};
    }

    public async init(): Promise<void> {
        const dbLinkCountry = this.config.dbCountryPath ?? process.cwd() + "/GeoIP2-Country.mmdb";
        const dbLinkCity = this.config.dbCityPath ?? process.cwd() + "/GeoIP2-City.mmdb";
        if (!fs.existsSync(dbLinkCountry)) {
            throw new Error(`GeoIP Country database does not exist: ${dbLinkCountry}`);
        }
        if (!fs.existsSync(dbLinkCity)) {
            throw new Error(`GeoIP City database does not exist: ${dbLinkCity}`);
        }

        [this.readerCountry, this.readerCity] = await Promise.all([
            Reader.open(dbLinkCountry),
            Reader.open(dbLinkCity),
        ]);
    }

    public getCountry(ip: string): Country | null {
        if (ip == "::1") {
            return this.readerCountry.country("1.1.1.1");
        }
        try {
            return this.readerCountry.country(ip);
        } catch (error) {
            // Log.instance.warn('Can not detect country from IP: ' + ip, error, 'GeoIP2')
            return null;
        }
    }

    public getCity(ip: string): City | null {
        if (ip == "::1") {
            return this.readerCity.city("1.1.1.1");
        }
        try {
            return this.readerCity.city(ip);
        } catch (error) {
            // Log.instance.warn('Can not detect city from IP: ' + ip, error, 'GeoIP2')
            return null;
        }
    }
}
