import {CountryResponse} from "@maxmind/geoip2-node/dist/src/types";


export class DummyCountryResponse implements CountryResponse {
    public readonly country: object|any;

    public constructor(name: string, isoCode: string = 'US') {
        // @ts-ignore
        this.country = {};
        this.country.names = {};
        this.country.names.en = name;
        this.country.iso_code = isoCode;

    }
}
