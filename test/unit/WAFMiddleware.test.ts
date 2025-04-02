import {Request, Response} from 'express';
import {FlexibleRule} from "@waf/Rules/FlexibleRule";
import {JailManager} from "@waf/Jail/JailManager";
import {WAFMiddleware} from "@waf/WAFMiddleware";
import {CompositeRule} from "@waf/Rules/CompositeRule";
import {StaticRule} from "@waf/Rules/StaticRule";
import {AbstractRule, IAbstractRuleConfig} from "@waf/Rules/AbstractRule";
import {Whitelist} from "@waf/Whitelist";
import {GeoIP2} from "@waf/GeoIP2";
import Country from "@maxmind/geoip2-node/dist/src/models/Country";
// @ts-ignore
import {DummyCountryResponse} from "@test/Helpers/DummyCountryResponse";
// @ts-ignore
import {DummyCityResponse} from "@test/Helpers/DummyCityResponse";
import {City} from "@maxmind/geoip2-node";
import {Metrics} from "@waf/Metrics/Metrics";
import {Registry} from "prom-client";


describe('WAFMiddleware', () => {
    let metricRegister;
    beforeAll(() => {
        metricRegister = new Registry();
        jest.useFakeTimers();
        jest.spyOn(global, 'setInterval');
    })

    describe('use', () => {
        let metrics;
        beforeAll(() => {
            metrics = new Metrics({enabled: true, auth: {enabled: false}}, jest.mock('express') as any, metricRegister);
        })

        afterEach(() => {
            metricRegister.clear();
            jest.clearAllMocks();
        });


        it('should call next() when the client IP is in whitelist', async () => {

            const whitelist = new Whitelist({});
            const mockWhitelistCheck = jest.spyOn(whitelist, 'check').mockReturnValue(true);

            const middleware = new WAFMiddleware({}, new JailManager({}), whitelist, metrics);

            const next = jest.fn();
            const req = <Request>{
                headers: {},
            };
            const res = <Response>{};

            await middleware.use()(req, res, next);

            expect(mockWhitelistCheck).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledTimes(1);
            expect(await metricRegister.getSingleMetric('waf_middleware_whitelist').get()).toEqual({
                "aggregator": "sum",
                "help": "Count of users who allowed by whitelist",
                "name": "waf_middleware_whitelist",
                "type": "counter",
                "values": [{"labels": {"city": "not-detected", "country": "not-detected"}, "value": 1}]
            });
        });

        it('should call next() when the client IP is not blocked and all rules pass', async () => {

            const jailManager = new JailManager({});
            const mockGetBlockedIp = jest.spyOn(jailManager, 'getBlockedIp').mockReturnValue(false);

            const whitelist = new Whitelist({});
            const mockCheck = jest.spyOn(whitelist, 'check').mockReturnValue(false);

            const middleware = new WAFMiddleware({}, jailManager, whitelist);

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

            const middleware = new WAFMiddleware({}, jailManager, whitelist, metrics);

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
            expect(await metricRegister.getSingleMetric('waf_middleware_jail_banned_user_request').get()).toEqual({
                "aggregator": "sum",
                "help": "Count of rejected by jail manager - user is banned",
                "name": "waf_middleware_jail_banned_user_request",
                "type": "counter",
                "values": [
                    {
                        "labels": {
                            "city": "not-detected",
                            "country": "not-detected"
                        },
                        "value": 1
                    }
                ]
            });
        });

        it('should respond with a 429 status code when any rule fails with return true', async () => {

            // @ts-ignore
            const failingRule = new AbstractRule();
            failingRule.use = jest.fn().mockResolvedValueOnce(true);

            const middleware = new WAFMiddleware({}, new JailManager({}), new Whitelist({}), metrics);
            middleware['rules'] = [failingRule];

            const req = <Request>{
                headers: {}
            };
            const res = <Response><unknown>{
                sendStatus: jest.fn().mockReturnThis(),
            };
            const next = jest.fn();

            await middleware.use()(req, res, next);

            expect(res.sendStatus).toHaveBeenCalledWith(429);
            expect(await metricRegister.getSingleMetric('waf_middleware_reject_static').get()).toEqual({
                "aggregator": "sum",
                "help": "Count of rejected by static",
                "name": "waf_middleware_reject_static",
                "type": "counter",
                "values": [
                    {
                        "labels": {
                            "city": "not-detected",
                            "country": "not-detected"
                        },
                        "value": 1
                    }
                ]
            });
        });

        it('should respond with a 429 status code when any rule fails with return IBannedIPItem', async () => {

            // @ts-ignore
            const failingRule = new AbstractRule();
            failingRule.use = jest.fn().mockResolvedValueOnce({
                "duration": 10,
                "escalationRate": 1,
                "ip": "1.1.1.1",
                "ruleId": "abstract"
            });

            const jailManager = new JailManager({});
            const mockBlockIp = jest.spyOn(jailManager, 'blockIp').mockResolvedValueOnce();

            const middleware = new WAFMiddleware({}, jailManager, new Whitelist({}), metrics);
            middleware['rules'] = [failingRule];

            const req = <Request>{
                headers: {}
            };
            const res = <Response><unknown>{
                sendStatus: jest.fn().mockReturnThis(),
            };
            const next = jest.fn();

            await middleware.use()(req, res, next);

            expect(res.sendStatus).toHaveBeenCalledWith(429);
            expect(mockBlockIp).toHaveBeenCalledTimes(1);
            expect(await metricRegister.getSingleMetric('waf_middleware_reject_and_ban').get()).toEqual({
                "aggregator": "sum",
                "help": "Count of rejected by static",
                "name": "waf_middleware_reject_and_ban",
                "type": "counter",
                "values": [
                    {
                        "labels": {
                            "city": "not-detected",
                            "country": "not-detected"
                        },
                        "value": 1
                    }
                ]
            });
        });


    });

    describe('loadRules', () => {
        let service;

        beforeEach(() => {
            service = new WAFMiddleware({});
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
        let middleware;
        beforeAll(() => {
            middleware = new WAFMiddleware({detectClientIp: {headers: ['x-real-ip']}}, new JailManager({}), new Whitelist({}));
        })


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


    describe('detectClientCountry', () => {

        it('should return the country from geoip when configured to use geoip', () => {
            const geoIP = new GeoIP2()
            // @ts-ignore
            const metrics = new Metrics({enabled: false, auth: {enabled: false}}, jest.mock('express'));
            const mockGetCountry = jest.spyOn(geoIP, 'getCountry').mockReturnValue(new Country(new DummyCountryResponse('United States')));

            const middleware = new WAFMiddleware({detectClientCountry: {method: 'geoip'}}, new JailManager({}), new Whitelist({}), metrics, geoIP);
            const req = <Request>{
                headers: {}
            };

            const clientCountry = middleware.detectClientCountry(req, '208.80.152.201');
            expect(clientCountry).toBe('United States');
            expect(mockGetCountry).toHaveBeenCalledTimes(1);
        });

        it('should return the country from header when configured to use header', () => {
            const middleware = new WAFMiddleware({
                detectClientCountry: {
                    method: 'header',
                    header: 'x-country'
                }
            }, new JailManager({}), new Whitelist({}));
            // @ts-ignore
            const req = <Request>{
                header: jest.fn().mockReturnValue('Germany'),
            };

            const clientCountry = middleware.detectClientCountry(req, '208.80.152.201');
            expect(clientCountry).toBe('Germany');
        });

        it('should return "not-detected" when the method of detection is not supported', () => {
            // @ts-ignore
            const middleware = new WAFMiddleware({detectClientCountry: {method: 'unsupported'}}, new JailManager({}), new Whitelist({}));
            const req = <Request>{
                headers: {}
            };

            const clientCountry = middleware.detectClientCountry(req, '208.80.152.201');
            expect(clientCountry).toBe('not-detected');
        });
    });
    describe('detectClientCity', () => {
        let middleware;
        let mockGetCity;
        let req;

        beforeEach(() => {
            const geoIP = new GeoIP2();
            // @ts-ignore
            const metrics = new Metrics({enabled: false, auth: {enabled: false}}, jest.mock('express'));
            mockGetCity = jest.spyOn(geoIP, 'getCity').mockReturnValue(new City(new DummyCityResponse('Tokyo')));
            middleware = new WAFMiddleware({detectClientCity: {method: 'geoip'}}, new JailManager({}), new Whitelist({}), metrics, geoIP);
            req = <Request>{
                headers: {}
            };
        });

        it('should return the city from geoip when configured to use geoip', () => {
            const clientCity = middleware.detectClientCity(req, '192.80.152.202');
            expect(clientCity).toBe('Tokyo');
            expect(mockGetCity).toHaveBeenCalledTimes(1);
        });

        it('should return the city from header when configured to use header', () => {
            const middleware = new WAFMiddleware({
                detectClientCity: {
                    method: 'header',
                    header: 'x-city'
                }
            }, new JailManager({}), new Whitelist({}));
            // @ts-ignore
            const req = <Request>{
                header: jest.fn().mockReturnValue('Berlin'),
            };

            const clientCity = middleware.detectClientCity(req, '192.80.152.202');
            expect(clientCity).toBe('Berlin');
        });

        it('should return "not-detected" when the method of detection is not supported', () => {
            // @ts-ignore
            const middleware = new WAFMiddleware({detectClientCity: {method: 'unsupported'}}, new JailManager({}), new Whitelist({}));
            const req = <Request>{
                headers: {}
            };

            const clientCity = middleware.detectClientCity(req, '192.80.152.202');
            expect(clientCity).toBe('not-detected');
        });
    });
});

