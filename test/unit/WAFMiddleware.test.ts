import {Request, Response} from 'express';
import {FlexibleRule} from "@waf/Rules/FlexibleRule";
import {JailManager} from "@waf/Jail/JailManager";
import {WAFMiddleware} from "@waf/WAFMiddleware";
import {CompositeRule} from "@waf/Rules/CompositeRule";
import {StaticRule} from "@waf/Rules/StaticRule";
import {IAbstractRuleConfig} from "@waf/Rules/AbstractRule";
// @ts-ignore
import {DummyRule} from "@test/Helpers/DummyRule";
import {Whitelist} from "@waf/Whitelist";
import {MockRequest} from 'node-mocks-http';


describe('WAFMiddleware', () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setInterval');

    describe('use', () => {
        jest.useFakeTimers();
        jest.spyOn(global, 'setInterval');

        it('should call next() when the client IP is not blocked and all rules pass', async () => {

            const jailManager = new JailManager({});
            const mockGetBlockedIp = jest.spyOn(jailManager, 'getBlockedIp').mockReturnValue(false);

            const whitelist = new Whitelist({});
            const mockCheck = jest.spyOn(whitelist, 'check').mockReturnValue(false);

            const middleware = new WAFMiddleware({detectClientIp: {headers: []}}, jailManager, whitelist);

            const next = jest.fn();
            const req = <Request>{
                headers: {}
            };
            const res = <Response>{};

            await middleware.use()(req, res, next);

            expect(mockCheck).toHaveBeenCalledTimes(1);
            expect(mockGetBlockedIp).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('should respond with a 429 status code when the client IP is blocked', async () => {

            const jailManager = new JailManager({});
            //mock the response from JailManager
            jailManager.getBlockedIp = jest.fn().mockReturnValueOnce({
                unbanTime: Date.now() + 1000
            });

            const whitelist = new Whitelist({});
            const mockCheck = jest.spyOn(whitelist, 'check').mockReturnValue(false);

            const middleware = new WAFMiddleware({detectClientIp: {headers: []}}, jailManager, whitelist);

            const req = <Request>{
                headers: {}
            };
            const res = <Response><unknown>{
                sendStatus: jest.fn().mockReturnThis(),
            };
            const next = jest.fn();

            await middleware.use()(req, res, next);

            expect(mockCheck).toHaveBeenCalledTimes(1);
            expect(res.sendStatus).toHaveBeenCalledWith(429);
        });

        it('should respond with a 429 status code when any rule fails', async () => {

            const failingRule = new DummyRule(true);
            failingRule.use = jest.fn().mockResolvedValueOnce(true);

            const jailManager = new JailManager({});

            const whitelist = new Whitelist({});
            const mockCheck = jest.spyOn(whitelist, 'check').mockReturnValue(false);

            const middleware = new WAFMiddleware({detectClientIp: {headers: []}}, jailManager, whitelist);
            middleware['rules'] = [failingRule];

            const req = <Request>{
                headers: {}
            };
            const res = <Response><unknown>{
                sendStatus: jest.fn().mockReturnThis(),
            };
            const next = jest.fn();

            await middleware.use()(req, res, next);

            expect(mockCheck).toHaveBeenCalledTimes(1);
            expect(res.sendStatus).toHaveBeenCalledWith(429);
        });
    });

    describe('loadRules', () => {
        let service;

        beforeEach(() => {
            service = new WAFMiddleware({detectClientIp: {headers: []}});
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

    describe('detectClientIp', () => {
        const jailManager = new JailManager({});
        const whitelist = new Whitelist({});

        const middleware = new WAFMiddleware({detectClientIp: {headers: ['x-real-ip']}}, jailManager, whitelist);


        it('should return the IP from headers specified in config', () => {
            const req = {
                headers: {
                    'x-real-ip': '192.168.1.1',
                },
                ip: '127.0.0.1',
            };
            const clientIp = middleware.detectClientIp(req as unknown as Request);
            expect(clientIp).toBe('192.168.1.1');
        });

        it('should return the first IP from x-forwarded-for header', () => {
            const req = {
                headers: {
                    'x-forwarded-for': '192.168.1.2, 192.168.1.3',
                },
                ip: '127.0.0.1',
            };

            const clientIp = middleware.detectClientIp(req as unknown as Request);
            expect(clientIp).toBe('192.168.1.2');
        });

        it('should return req.ip when no relevant headers are present', () => {
            const req = <Request>{
                headers: {},
                ip: '127.0.0.1',
            };

            const clientIp = middleware.detectClientIp(req);
            expect(clientIp).toBe('127.0.0.1');
        });

        it('should return undefined when x-forwarded-for is present but empty', () => {
            const req = {
                headers: {
                    'x-forwarded-for': '',
                },
                ip: '127.0.0.1',
            };

            const clientIp = middleware.detectClientIp(req as unknown as Request);
            expect(clientIp).toBe('127.0.0.1');
        });
    });


})

