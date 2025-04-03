
// @ts-ignore
import httpMocks from "node-mocks-http";
import {FlexibleRule} from "@waf/Jail/Rules/FlexibleRule";

describe('FlexibleRule test', () => {
    let rule: FlexibleRule

    beforeEach(() => {
        rule = new FlexibleRule({
            type: 'flexible',
            duration: 10,
            limit: 2,
            period: 30,
            conditions: []
        });
    });

    it('Check when conditions allowed', async () => {

        const request = httpMocks.createRequest({});
        const mockedCheckConditions = jest.spyOn(rule as any, 'checkConditions').mockReturnValue(true);
        let result = await rule.use('1.1.1.1', 'none', 'none', request);
        expect(result).toEqual(false);
        result = await rule.use('1.1.1.1', 'none', 'none', request);
        expect(result).toEqual({"duration": 10, "escalationRate": 1, "ip": "1.1.1.1", "ruleId": "flexible"});
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

});
