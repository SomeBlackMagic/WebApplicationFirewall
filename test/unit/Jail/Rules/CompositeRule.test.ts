// @ts-ignore
import httpMocks from "node-mocks-http";
import {CompositeRule} from "@waf/Jail/Rules/CompositeRule";

describe('CompositeRule test', () => {

    let rule: CompositeRule

    beforeEach(() => {
        rule = new CompositeRule({
            type: 'composite',
            duration: 10,
            limit: 2,
            period: 30,
            keys: ["ip", "user-agent", "url", 'geo-country', 'geo-city', 'not-found-key', 'hostname'],
            conditions: []
        });
    });

    it('Check when conditions allowed', async () => {
        const request = httpMocks.createRequest({
            method: 'GET',
            url: '/test',
            hostname: 'test.com',
            headers: {
                "user-agent": "Mozilla/5.0 (Linux; U; Android 4.3.1; GT-I9400 Build/JDQ39) AppleWebKit/534.37 (KHTML, like Gecko)  Chrome/49.0.1967.220 Mobile Safari/535.9"
            }
        });
        const mockedCheckConditions = jest.spyOn(rule as any, 'checkConditions').mockReturnValue(true);
        let result = await rule.use('1.1.1.1', 'none', 'none', request);
        expect(result).toEqual(false);
        result = await rule.use('1.1.1.1', 'none', 'none', request);
        expect(result).toEqual({"duration": 10, "escalationRate": 1, "ip": "1.1.1.1", "ruleId": "composite"});
        expect(mockedCheckConditions).toHaveBeenCalledTimes(2);


    });
    it('Check when conditions not allowed', async () => {

        const request = httpMocks.createRequest({});
        const mockedCheckConditions = jest.spyOn(rule as any, 'checkConditions').mockReturnValue(false);
        let result = await rule.use('1.1.1.1', 'none', 'none', request);
        expect(result).toEqual(false);
        result = await rule.use('1.1.1.1', 'none', 'none', request);
        expect(result).toEqual(false);
        expect(mockedCheckConditions).toHaveBeenCalledTimes(2);
    });

    it('Check composite key', async () => {
        let request = httpMocks.createRequest({
            method: 'GET',
            url: '/test',
            hostname: 'test.com',
            headers: {
                "user-agent": "Mozilla/5.0 (Linux; U; Android 4.3.1; GT-I9400 Build/JDQ39) AppleWebKit/534.37 (KHTML, like Gecko)  Chrome/49.0.1967.220 Mobile Safari/535.9"
            }
        });
        const mockedCheckConditions = jest.spyOn(rule as any, 'checkConditions').mockReturnValue(true);
        let result = await rule.use('1.1.1.1', 'none', 'none', request);
        expect(result).toEqual(false);
        request = httpMocks.createRequest({
            method: 'GET',
            url: '/test',
            hostname: 'test.org',
            headers: {
                "user-agent": "Mozilla/5.0 (Linux; U; Android 4.3.1; GT-I9400 Build/JDQ39) AppleWebKit/534.37 (KHTML, like Gecko)  Chrome/49.0.1967.220 Mobile Safari/535.9"
            }
        });
        result = await rule.use('1.1.1.1', 'none', 'none', request);
        expect(result).toEqual(false);
        result = await rule.use('1.1.1.1', 'none', 'none', request);
        expect(result).toEqual({"duration": 10, "escalationRate": 1, "ip": "1.1.1.1", "ruleId": "composite"});
        expect(mockedCheckConditions).toHaveBeenCalledTimes(3);
    });

});
