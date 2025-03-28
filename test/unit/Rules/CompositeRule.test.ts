// @ts-ignore
import httpMocks from "node-mocks-http";
import {CompositeRule} from "@waf/Rules/CompositeRule";

describe('CompositeRule test', () => {
    let rule: CompositeRule

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
        expect(result).toEqual({"duration": 10, "escalationRate": 1, "ip": "1.1.1.1", "ruleId": "composite"});


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
        expect(result).toEqual({"duration": 10, "escalationRate": 1, "ip": "1.1.1.1", "ruleId": "composite"});


    });


    it('Regexp not match', async () => {

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

    });


});
