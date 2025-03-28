import {CityResponse} from "@maxmind/geoip2-node/dist/src/types";


export class DummyCityResponse implements CityResponse {
    public readonly city: object|any;

    public constructor(name: string) {
        // @ts-ignore
        this.city = {};
        this.city.names = {};
        this.city.names.en = name;
    }
}
