import {IWhitelistConfig, Whitelist} from "@waf/Whitelist";

describe('Whitelist', () => {
    const config: IWhitelistConfig = {
        ips: ['192.168.1.1', '10.0.0.1'],
        ipSubnet: ['192.168.0.0/24', '10.0.0.0/24'],
        geoCountry: ['USA', 'CA'],
        geoCity: ['New York', 'Dallas'],
    };

    const whitelist = new Whitelist(config);

    test('check method - IP in whitelist', () => {
        expect(whitelist.check('192.168.1.1', 'USA', 'Dallas')).toBeTruthy();
        expect(whitelist.check('10.0.0.1', 'USA', 'Dallas')).toBeTruthy();
    });

    test('check method - IP in whitelist subnet', () => {
        expect(whitelist.check('192.168.0.25', 'USA', 'Dallas')).toBeTruthy();
        expect(whitelist.check('10.0.0.15', 'USA', 'Dallas')).toBeTruthy();
    });

    test('check method - country in whitelist', () => {
        expect(whitelist.check('8.8.8.8', 'USA', 'Dallas')).toBeTruthy();
        expect(whitelist.check('1.1.1.1', 'CA', 'Toronto')).toBeTruthy();
    });

    test('check method - city in whitelist', () => {
        expect(whitelist.check('3.3.3.3', 'GB', 'New York')).toBeTruthy();
        expect(whitelist.check('2.2.2.2', 'GB', 'Dallas')).toBeTruthy();
    });

    test('check method - no whitelist match', () => {
        expect(whitelist.check('192.168.3.1', 'UA', 'Kiev')).toBeFalsy();
        expect(whitelist.check('192.168.3.1', 'US', 'San Francisco')).toBeFalsy();
    });
});
