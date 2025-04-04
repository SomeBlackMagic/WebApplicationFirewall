import {IStaticFilterConfig, StaticFilter} from "@waf/Static/StaticFilter";
import {Log} from "@waf/Log";


describe('StaticFilter', () => {
    const config: IStaticFilterConfig = {
        ips: ['192.168.1.1', '10.0.0.1'],
        ipSubnet: ['192.168.0.0/24', '10.0.0.0/24'],
        geoCountry: ['USA', 'CA'],
        geoCity: ['New York', 'Dallas'],
    };

    const StaticFilterTestClass = new class extends StaticFilter<any, []> {
        public constructor(
            config: IStaticFilterConfig
        ) {
            super();
            this.config = config;
            this.log = Log.instance.withCategory('test');
        }
    }(config);


    test('check method - IP in whitelist', () => {
        expect(StaticFilterTestClass.check('192.168.1.1', 'USA', 'Dallas')).toBeTruthy();
        expect(StaticFilterTestClass.check('10.0.0.1', 'USA', 'Dallas')).toBeTruthy();
    });

    test('check method - IP in whitelist subnet', () => {
        expect(StaticFilterTestClass.check('192.168.0.25', 'USA', 'Dallas')).toBeTruthy();
        expect(StaticFilterTestClass.check('10.0.0.15', 'USA', 'Dallas')).toBeTruthy();
    });

    test('check method - country in whitelist', () => {
        expect(StaticFilterTestClass.check('8.8.8.8', 'USA', 'Dallas')).toBeTruthy();
        expect(StaticFilterTestClass.check('1.1.1.1', 'CA', 'Toronto')).toBeTruthy();
    });

    test('check method - city in whitelist', () => {
        expect(StaticFilterTestClass.check('3.3.3.3', 'GB', 'New York')).toBeTruthy();
        expect(StaticFilterTestClass.check('2.2.2.2', 'GB', 'Dallas')).toBeTruthy();
    });

    test('check method - no whitelist match', () => {
        expect(StaticFilterTestClass.check('192.168.3.1', 'UA', 'Lviv')).toBeFalsy();
        expect(StaticFilterTestClass.check('192.168.3.1', 'US', 'San Francisco')).toBeFalsy();
    });
});
