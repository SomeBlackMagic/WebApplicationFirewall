import {Request, Response} from 'express';
import {JailManager} from "@waf/Jail/JailManager";
import {WAFMiddleware} from "@waf/WAFMiddleware";
import {GeoIP2} from "@waf/GeoIP2";
import Country from "@maxmind/geoip2-node/dist/src/models/Country";
// @ts-ignore
import {DummyCountryResponse} from "@test/Helpers/DummyCountryResponse";
// @ts-ignore
import {DummyCityResponse} from "@test/Helpers/DummyCityResponse";
import {City} from "@maxmind/geoip2-node";
import {Metrics} from "@waf/Metrics/Metrics";
import {Registry} from "prom-client";
import {Whitelist} from "@waf/Static/Whitelist";
import {Blacklist} from "@waf/Static/Blacklist";
import {createRequest, createResponse} from "node-mocks-http";


describe('WAFMiddleware', () => {
    let metricRegister: Registry;
    let defaultJailManager: JailManager;
    let defaultBlacklist: Blacklist;
    let defaultWhitelist: Whitelist;
    let defaultMetrics: Metrics;
    beforeAll(() => {
        metricRegister = new Registry();
        jest.useFakeTimers();
        jest.spyOn(global, 'setInterval');

        JailManager.build({enabled: false, filterRules: []});
        Whitelist.buildInstance({})
        Blacklist.buildInstance({})
        GeoIP2.build();
    });

    afterAll(() => {
        JailManager.reset()
        Whitelist.reset();
        Blacklist.reset();
        GeoIP2.reset();
    })

    describe('use', () => {
        let metrics: Metrics;

        beforeEach(() => {
            metrics = new Metrics({enabled: true, auth: {enabled: false}}, jest.mock('express') as any, metricRegister);
            defaultJailManager = new JailManager({enabled: false, filterRules: []});
            defaultBlacklist = new Blacklist({});
            defaultWhitelist = new Whitelist({});
        })

        afterEach(() => {
            metricRegister.clear();
            jest.clearAllMocks();
        });


        it('should call next() when the client IP is in whitelist', async () => {

            const mockWhitelistCheck = jest.spyOn(defaultWhitelist, 'check').mockReturnValue(true);

            const middleware = new WAFMiddleware({}, defaultJailManager, defaultWhitelist, defaultBlacklist, metrics);

            const next = jest.fn();
            const req = createRequest();
            const res = createResponse();

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

        it('send 429 response when the client IP is in blacklist', async () => {

            const mockWhitelistCheck = jest.spyOn(defaultBlacklist, 'check').mockReturnValue(true);

            const middleware = new WAFMiddleware({mode: 'normal'}, defaultJailManager, defaultWhitelist, defaultBlacklist, metrics);

            const next = jest.fn();
            const req = createRequest();
            const res = createResponse();

            await middleware.use()(req, res, next);

            expect(mockWhitelistCheck).toHaveBeenCalledTimes(1);
            expect(res.statusCode).toEqual(429);

            expect(await metricRegister.getSingleMetric('waf_middleware_blacklist').get()).toEqual({
                "aggregator": "sum",
                "help": "Count of users who rejected by blacklist",
                "name": "waf_middleware_blacklist",
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

        it('send 429 response when JailManager is rejected', async () => {

            const mockJailManagerCheck = jest.spyOn(defaultJailManager, 'check').mockResolvedValue(true);

            const middleware = new WAFMiddleware({mode: 'normal'}, defaultJailManager, defaultWhitelist, defaultBlacklist, metrics);

            const next = jest.fn();
            const req = createRequest();
            const res = createResponse();

            await middleware.use()(req, res, next);

            expect(mockJailManagerCheck).toHaveBeenCalledTimes(1);
            expect(res.statusCode).toEqual(429);

            expect(await metricRegister.getSingleMetric('waf_middleware_jail_reject_request').get()).toEqual({
                "aggregator": "sum",
                "help": "Count of rejected by Jail Manager - user is banned",
                "name": "waf_middleware_jail_reject_request",
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

        it('should call next() when no one filter applied', async () => {
            const middleware = new WAFMiddleware({}, defaultJailManager, defaultWhitelist, defaultBlacklist, metrics);

            const next = jest.fn();
            const req = createRequest();
            const res = createResponse();

            await middleware.use()(req, res, next);

            expect(next).toHaveBeenCalledTimes(1);
        });

        it('should call next() when the client IP is in blacklist and audit mode is active', async () => {

            const mockWhitelistCheck = jest.spyOn(defaultBlacklist, 'check').mockReturnValue(true);

            const middleware = new WAFMiddleware({mode: 'audit'}, defaultJailManager, defaultWhitelist, defaultBlacklist, metrics);

            const next = jest.fn();
            const req = createRequest();
            const res = createResponse();

            await middleware.use()(req, res, next);

            expect(mockWhitelistCheck).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledTimes(1);
        });



    });

    describe('detectClientIp', () => {
        let middleware;
        beforeEach(() => {
            middleware = new WAFMiddleware({detectClientIp: {headers: ['x-real-ip']}});
        });


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
        beforeEach(() => {

            defaultMetrics = new Metrics({
                enabled: true,
                auth: {enabled: false}
            }, jest.mock('express') as any, metricRegister);
            defaultJailManager = new JailManager({enabled: false, filterRules: []});
            defaultBlacklist = new Blacklist({});
            defaultWhitelist = new Whitelist({});
        })

        afterEach(() => {
            metricRegister.clear();
            jest.clearAllMocks();
        });


        it('should return the country from geoip when configured to use geoip', () => {
            const geoIP = new GeoIP2()

            const mockGetCountry = jest.spyOn(geoIP, 'getCountry').mockReturnValue(new Country(new DummyCountryResponse('United States')));

            const middleware = new WAFMiddleware(
                {detectClientCountry: {method: 'geoip'}},
                defaultJailManager,
                defaultWhitelist,
                defaultBlacklist,
                defaultMetrics,
                geoIP
            );
            const req = createRequest();

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
            });
            // @ts-ignore
            const req = <Request>{
                header: jest.fn().mockReturnValue('Germany'),
            };

            const clientCountry = middleware.detectClientCountry(req, '208.80.152.201');
            expect(clientCountry).toBe('Germany');
        });

        it('should return "not-detected" when the method of detection is not supported', () => {
            // @ts-ignore
            const middleware = new WAFMiddleware({detectClientCountry: {method: 'unsupported'}});
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
            mockGetCity = jest.spyOn(geoIP, 'getCity').mockReturnValue(new City(new DummyCityResponse('Tokyo')));

            middleware = new WAFMiddleware(
                {detectClientCity: {method: 'geoip'}},
                defaultJailManager,
                defaultWhitelist,
                defaultBlacklist,
                defaultMetrics,
                geoIP
            );
            req = createRequest();
        });

        afterEach(() => {
            metricRegister.clear();
            jest.clearAllMocks();
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
            });
            // @ts-ignore
            const req = <Request>{
                header: jest.fn().mockReturnValue('Berlin'),
            };

            const clientCity = middleware.detectClientCity(req, '192.80.152.202');
            expect(clientCity).toBe('Berlin');
        });

        it('should return "not-detected" when the method of detection is not supported', () => {
            // @ts-ignore
            const middleware = new WAFMiddleware({detectClientCity: {method: 'unsupported'}});
            const req = <Request>{
                headers: {}
            };

            const clientCity = middleware.detectClientCity(req, '192.80.152.202');
            expect(clientCity).toBe('not-detected');
        });
    });
});

