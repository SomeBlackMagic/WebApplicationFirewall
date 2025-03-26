import {Request, Response} from 'express';
import {WAFMiddleware} from "../../src/WAFMiddleware";
import {JailManager} from "../../src/Jail/JailManager";
import { IAbstractRuleConfig} from "../../src/Rules/AbstractRule";
// @ts-ignore
import {DummyRule} from "../Helpers/DummyRule";
import {CompositeRule, ICompositeRuleConfig} from "../../src/Rules/CompositeRule";
import {IStaticRuleConfig, StaticRule} from "../../src/Rules/StaticRule";
import {FlexibleRule, IFlexibleRuleConfig} from "../../src/Rules/FlexibleRule";

describe('WAFMiddleware.wafMiddleware', () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setInterval');

    it('should call next() when the client IP is not blocked and all rules pass', async () => {
        expect.assertions(1);

        const jailManager = new JailManager({});
        const middleware = new WAFMiddleware(jailManager);

        const next = jest.fn();
        const req = <Request>{
            headers: {}
        };
        const res = <Response>{};

        await middleware.wafMiddleware()(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
    });

    it('should respond with a 429 status code when the client IP is blocked', async () => {
        expect.assertions(1);

        const jailManager = new JailManager({});
        //mock the response from JailManager
        jailManager.getBlockedIp = jest.fn().mockReturnValueOnce({
            unbanTime: Date.now() + 1000
        });

        const middleware = new WAFMiddleware(jailManager);

        const req = <Request>{
            headers: {}
        };
        const res = <Response><unknown>{
            sendStatus: jest.fn().mockReturnThis(),
        };
        const next = jest.fn();

        await middleware.wafMiddleware()(req, res, next);

        expect(res.sendStatus).toHaveBeenCalledWith(429);
    });

    it('should respond with a 429 status code when any rule fails', async () => {
        expect.assertions(1);

        const failingRule = new DummyRule(true);
        failingRule.use = jest.fn().mockResolvedValueOnce(true);

        const jailManager = new JailManager({});
        const middleware = new WAFMiddleware(jailManager);
        middleware['rules'] = [failingRule];

        const req = <Request>{
            headers: {}
        };
        const res = <Response><unknown>{
            sendStatus: jest.fn().mockReturnThis(),
        };
        const next = jest.fn();

        await middleware.wafMiddleware()(req, res, next);

        expect(res.sendStatus).toHaveBeenCalledWith(429);
    });
});

describe('WAFMiddleware.getClientIp', () => {
    let service;

    beforeEach(() => {
        service = new WAFMiddleware();
    });

    test('should return fastly-client-ip if it is defined', () => {
        const req = {
            headers: {
                'fastly-client-ip': '1.1.1.1'
            },
            ip: '127.0.0.1'
        };

        const ip = service.getClientIp(req);
        expect(ip).toBe('1.1.1.1');
    });

    test('should return cf-connecting-ip if fastly-client-ip is not defined', () => {
        const req = {
            headers: {
                'cf-connecting-ip': '2.2.2.2'
            },
            ip: '127.0.0.1'
        };

        const ip = service.getClientIp(req);
        expect(ip).toBe('2.2.2.2');
    });

    test('should return x-original-forwarded-for if the first two headers are not defined', () => {
        const req = {
            headers: {
                'x-original-forwarded-for': '3.3.3.3'
            },
            ip: '127.0.0.1'
        };

        const ip = service.getClientIp(req);
        expect(ip).toBe('3.3.3.3');
    });

    test('should return the first IP from x-forwarded-for header when it is defined', () => {
        const req = {
            headers: {
                'x-forwarded-for': '4.4.4.4, 5.5.5.5'
            },
            ip: '127.0.0.1'
        };

        const ip = service.getClientIp(req);
        expect(ip).toBe('4.4.4.4');
    });

    test('should return req.ip if none of the headers are defined', () => {
        const req = {
            headers: {},
            ip: '127.0.0.1'
        };

        const ip = service.getClientIp(req);
        expect(ip).toBe('127.0.0.1');
    });
});

describe('WAFMiddleware.loadRules', () => {
    let service;

    beforeEach(() => {
        service = new WAFMiddleware();
    });

    it('should load all types of rules', () => {
        jest.mock('../../src/Rules/StaticRule')
        // @ts-ignore
        const compositeRuleConfig: ICompositeRuleConfig = {
            type: CompositeRule.ID,
            // add other properties as required
        };
        // @ts-ignore
        const staticRuleConfig: IStaticRuleConfig = {
            type: StaticRule.ID,
            // add other properties as required
        };
        // @ts-ignore
        const flexibleRuleConfig: IFlexibleRuleConfig = {
            type: FlexibleRule.ID,
            // add other properties as required
        };

        const rulesConfig: IAbstractRuleConfig[] = [
            compositeRuleConfig,
            staticRuleConfig,
            flexibleRuleConfig
        ];

        const result = service.loadRules(rulesConfig);

        expect(result).toBe(true);
        expect(service['rules'].length).toBe(3);
        expect(service['rules'][0] instanceof CompositeRule).toBe(true);
        expect(service['rules'][1] instanceof StaticRule).toBe(true);
        expect(service['rules'][2] instanceof FlexibleRule).toBe(true);
    });

    it('should throw when an invalid rule type is provided', () => {
        const invalidRule: IAbstractRuleConfig = {type: 'Invalid'};

        const rulesConfig: IAbstractRuleConfig[] = [invalidRule];

        expect(() => {
            service.loadRules(rulesConfig);
        }).toThrow('Can not found observer or rule type - Invalid');
    });
});
