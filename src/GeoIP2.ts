import {City, Country, Reader} from "@maxmind/geoip2-node";
import process from "process";
import ReaderModel from "@maxmind/geoip2-node/dist/src/readerModel";
import {Log} from "./Log";

export class GeoIP2 {
    static #instance: GeoIP2;

    private readerCity: ReaderModel;
    private readerCountry: ReaderModel;

    public static get instance(): GeoIP2 {
        if (!GeoIP2.#instance) {
            GeoIP2.#instance = new GeoIP2();
        }

        return GeoIP2.#instance;
    }


    public async init(): Promise<void> {
        [this.readerCountry, this.readerCity] = await Promise.all([
            Reader.open(process.cwd() + '/GeoIP2-Country.mmdb'),
            Reader.open(process.cwd() + '/GeoIP2-City.mmdb')
        ])
    }

    public getCountry(ip: string): Country|null {
        if (ip == '::1') {
            return this.readerCountry.country('1.1.1.1')
        }
        try {
            return this.readerCountry.country(ip)
        } catch (error) {
            Log.instance.warn('Can not detect country from IP: ' + ip, error, 'GeoIP2')
            return null;
        }

    }

    public getCity(ip: string): City|null {
        if (ip == '::1') {
            return this.readerCity.city('1.1.1.1')
        }
        try {
            return this.readerCity.city(ip)
        } catch (error) {
            Log.instance.warn('Can not detect city from IP: ' + ip, error, 'GeoIP2')
            return null;
        }

    }


}