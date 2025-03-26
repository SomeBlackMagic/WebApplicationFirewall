import {BanInfo, JailManager} from "../../../src/Jail/JailManager";
import {CompositeRule} from "../../../src/Rules/CompositeRule";
// @ts-ignore
import httpMocks from "node-mocks-http";

describe('CompositeRule test', () => {
    let rule: CompositeRule
    JailManager.build({
        syncAlways: true
    }, global.jailStorage)
    JailManager.instance.onStop();

    beforeEach(() => {
        global.jailStorage.save([]);
    });

    it('Equal url match', async () => {
        rule = new CompositeRule({
            type: 'composite',
            duration: 10,
            limit: 2,
            period: 30,
            keys: ["ip", "user-agent", "url"],
            for: {
                key: 'url',
                correlationMethod: 'eq',
                value: '/test'
            }
        });

        const request = httpMocks.createRequest({
            method: 'GET',
            url: '/test',
            headers: {
                "user-agent": "Mozilla/5.0 (Linux; U; Android 4.3.1; GT-I9400 Build/JDQ39) AppleWebKit/534.37 (KHTML, like Gecko)  Chrome/49.0.1967.220 Mobile Safari/535.9"
            }
        });
        const response = httpMocks.createResponse();
        const next = jest.fn();

        let result = await rule.use('1.1.1.1', request, response, next);
        expect(result).toEqual(false);
        result = await rule.use('1.1.1.1', request, response, next);
        expect(result).toEqual(true);

        const bannedIps: BanInfo[] = await global.jailStorage.load()
        expect(bannedIps.length).toEqual(1);

    });
    it('Equal url not match', async () => {

        rule = new CompositeRule({
            type: 'composite',
            duration: 10,
            limit: 2,
            period: 30,
            keys: ["ip", "user-agent", "url"],
            for: {
                key: 'url',
                correlationMethod: 'eq',
                value: '/test'
            }
        });
        const request = httpMocks.createRequest({
            method: 'GET',
            url: '/test-not-match',
            headers: {
                "user-agent": "Mozilla/5.0 (Linux; U; Android 4.3.1; GT-I9400 Build/JDQ39) AppleWebKit/534.37 (KHTML, like Gecko)  Chrome/49.0.1967.220 Mobile Safari/535.9"
            }
        });
        const response = httpMocks.createResponse();
        const next = jest.fn();

        let result = await rule.use('1.1.1.1', request, response, next);
        expect(result).toEqual(false);
        result = await rule.use('1.1.1.1', request, response, next);
        expect(result).toEqual(false);

        const bannedIps: BanInfo[] = await global.jailStorage.load()
        expect(bannedIps.length).toEqual(0);

    });
    it('Regexp url match', async () => {

        rule = new CompositeRule({
            type: 'composite',
            duration: 10,
            limit: 2,
            period: 30,
            keys: ["ip", "user-agent", "url"],
            for: {
                key: 'url',
                correlationMethod: 'regexp',
                value: '/wp-(admin|include)/i'
            }
        });
        const request = httpMocks.createRequest({
            method: 'GET',
            url: '/wp-admin/foo-bar-baz',
            headers: {
                "user-agent": "Mozilla/5.0 (Linux; U; Android 4.3.1; GT-I9400 Build/JDQ39) AppleWebKit/534.37 (KHTML, like Gecko)  Chrome/49.0.1967.220 Mobile Safari/535.9"
            }
        });
        const response = httpMocks.createResponse();
        const next = jest.fn();

        let result = await rule.use('1.1.1.1', request, response, next);
        expect(result).toEqual(false);
        result = await rule.use('1.1.1.1', request, response, next);
        expect(result).toEqual(true);

        const bannedIps: BanInfo[] = await global.jailStorage.load()
        expect(bannedIps.length).toEqual(1);

    });


    it('Regexp url not match', async () => {

        rule = new CompositeRule({
            type: 'composite',
            duration: 10,
            limit: 2,
            period: 30,
            keys: ["ip", "user-agent", "url"],
            for: {
                key: 'url',
                correlationMethod: 'regexp',
                value: '/wp-(admin|include)/i'
            }
        });
        const request = httpMocks.createRequest({
            method: 'GET',
            url: '/wp-not-match/foo-bar-baz',
            headers: {
                "user-agent": "Mozilla/5.0 (Linux; U; Android 4.3.1; GT-I9400 Build/JDQ39) AppleWebKit/534.37 (KHTML, like Gecko)  Chrome/49.0.1967.220 Mobile Safari/535.9"
            }
        });
        const response = httpMocks.createResponse();
        const next = jest.fn();

        let result = await rule.use('1.1.1.1', request, response, next);
        expect(result).toEqual(false);
        result = await rule.use('1.1.1.1', request, response, next);
        expect(result).toEqual(false);

        const bannedIps: BanInfo[] = await global.jailStorage.load()
        expect(bannedIps.length).toEqual(0);

    });


});
