import {DeviceDetector, DeviceInfo} from "@waf/UnderAttack/Utils/DeviceDetector";

describe('DeviceDetector', () => {
    describe('parse', () => {
        it('should parse a Chrome user agent string correctly', () => {
            const uaString = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36';
            const result: DeviceInfo = DeviceDetector.parse(uaString);

            expect(result.browser).toEqual({name: 'Chrome', version: '92.0.4515.107'});
            expect(result.engine).toEqual({name: 'Blink', version: '537.36'});
            expect(result.os).toEqual({name: 'Windows', version: '10.0'});
            expect(result.device).toEqual({type: 'desktop', vendor: null, model: null});
            expect(result.cpu).toEqual({architecture: 'x86_64'});
        });

        it('should parse an iPhone user agent string correctly', () => {
            const uaString = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1';
            const result: DeviceInfo = DeviceDetector.parse(uaString);

            expect(result.browser).toEqual({name: 'Safari', version: '604.1'});
            expect(result.engine).toEqual({name: 'WebKit', version: '605.1.15'});
            expect(result.os).toEqual({name: 'iOS', version: '14.7.1'});
            expect(result.device).toEqual({type: 'mobile', vendor: 'Apple', model: 'iPhone'});
            expect(result.cpu).toEqual({architecture: null});
        });

        it('should return Unknown for unsupported user agent strings', () => {
            const uaString = 'NonexistentBrowser/1.0 (FakeOS 2.0; FakeDevice)';
            const result: DeviceInfo = DeviceDetector.parse(uaString);

            expect(result.browser).toEqual({name: 'Unknown', version: null});
            expect(result.engine).toEqual({name: 'Unknown', version: null});
            expect(result.os).toEqual({name: 'Unknown', version: null});
            expect(result.device).toEqual({type: 'desktop', vendor: null, model: null});
            expect(result.cpu).toEqual({architecture: null});
        });

        it('should parse an Android tablet user agent string correctly', () => {
            const uaString = 'Mozilla/5.0 (Linux; Android 9; SM-T515) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36';
            const result: DeviceInfo = DeviceDetector.parse(uaString);

            expect(result.browser).toEqual({name: 'Chrome', version: '91.0.4472.120'});
            expect(result.engine).toEqual({name: 'Blink', version: '537.36'});
            expect(result.os).toEqual({name: 'Android', version: '9'});
            expect(result.device).toEqual({type: 'tablet', vendor: null, model: null});
            expect(result.cpu).toEqual({architecture: null});
        });

        it('should parse a bot user agent string correctly', () => {
            const uaString = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
            const result: DeviceInfo = DeviceDetector.parse(uaString);

            expect(result.browser).toEqual({name: 'Unknown', version: null});
            expect(result.engine).toEqual({name: 'Unknown', version: null});
            expect(result.os).toEqual({name: 'Unknown', version: null});
            expect(result.device).toEqual({type: 'bot', vendor: null, model: null});
            expect(result.cpu).toEqual({architecture: null});
        });

        it('Smart TV Tizen 6 Samsung Browser 4', () => {
            const uaString = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/4.0 Chrome/120.0.6099.5 TV Safari/537.36';
            const result: DeviceInfo = DeviceDetector.parse(uaString);

            expect(result.browser).toEqual({name: 'Samsung Internet', version: "4.0"});
            expect(result.engine).toEqual({name: 'Blink', version: '537.36'});
            expect(result.os).toEqual({name: 'Linux', version: null});
            expect(result.device).toEqual({type: 'tv', vendor: null, model: null});
            expect(result.cpu).toEqual({architecture: null});
        });
    });
});
