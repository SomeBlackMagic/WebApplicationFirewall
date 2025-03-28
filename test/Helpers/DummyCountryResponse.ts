import {CountryResponse} from "@maxmind/geoip2-node/dist/src/types";


export class DummyCountryResponse implements CountryResponse {
    public readonly country: object|any;

    public constructor(name: string) {
        // @ts-ignore
        this.country = {};
        this.country.names = {};
        this.country.names.en = name;
    }
}
