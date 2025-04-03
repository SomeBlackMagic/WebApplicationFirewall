import * as ipLib from "ip";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";

export abstract class StaticFilter {

    protected config: IStaticFilterConfig;
    protected log: LoggerInterface;

    public check(clientIp: string, clientGeoCountry: string, clientGeoCity: string): boolean {
        if (this.config?.ips && this.config.ips.length > 0) {
            if(this.validateIncludeIPS(clientIp)) {
                this.log.trace('Request from whitelisted IP', [clientIp]);
                return true;
            }
        }

        if (this.config?.ipSubnet && this.config.ipSubnet.length > 0) {
            if(this.validateIncludeIPSubnet(clientIp)) {
                this.log.trace('Request from whitelisted IP subnet', [clientIp]);
                return true;
            }
        }

        if (this.config?.geoCountry && this.config.geoCountry.length > 0) {
            if(this.validateCountry(clientGeoCountry)) {
                this.log.trace('Request from whitelisted country', [clientGeoCountry]);
                return true;
            }
        }

        if (this.config?.geoCity && this.config.geoCity.length > 0) {
            if(this.validateCity(clientGeoCity)) {
                this.log.trace('Request from whitelisted city', [clientGeoCity]);
                return true;
            }
        }

        return false;
    }

    private validateIncludeIPS(ip: string): boolean {
        return this.config.ips.includes(ip);
    }

    private validateIncludeIPSubnet(ip: string): boolean {
        return this.config.ipSubnet.some(subnet => {
            return ipLib.cidrSubnet(subnet).contains(ip)
        });
    }


    private validateCountry(country: string): boolean {
        return this.config.geoCountry.some(countryName => {
            return countryName == country
        });
    }

    private validateCity(city: string): boolean {
        return this.config.geoCity.some(cityItem => {
            return city === cityItem
        });
    }
}


export interface IStaticFilterConfig {
    ips?: string[],
    ipSubnet?: string[],
    geoCountry?: string[],
    geoCity?: string[]
}
