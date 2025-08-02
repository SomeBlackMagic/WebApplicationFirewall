import {NextFunction, Request, Response} from "express";
import {IUnderAttackConfig, UnderAttackMiddleware} from "@waf/UnderAttack/UnderAttackMiddleware";
import {createRequest} from "node-mocks-http";

describe("UnderAttackMiddleware", () => {
    const mockMetrics = {
        incrementChallengePageShown: jest.fn(),
        incrementValidTokenCount: jest.fn(),
        incrementBypassCount: jest.fn()

    };
    const mockChallengeManager = {
        generateChallengeProblem: jest.fn().mockReturnValue({}),
        validateChallenge: jest.fn().mockReturnValue(true),
    };
    const mockBotDetector = {
        detect: jest.fn().mockReturnValue(false),
        recordChallengeStart: jest.fn(),
    };
    const mockFingerprintValidator = {
        validate: jest.fn().mockReturnValue(100)
    };

    const defaultConfig: IUnderAttackConfig = {
        enabled: true,
        challengeDurationMs: 300000,
        botDetection: {
            enabled: true,
            aiModel: 'basic',
            blockSuspiciousUA: true,
        },
        challengePage: {
            title: "Challenge",
            path: process.cwd() + "/pages/challenge/index.html"
        },
        skipUrls: [],
        cookieName: "test_token",
        bypassHeader: {name: "x-waf-bypass", value: "test-bypass"},
    };

    const createMiddlewareInstance = (config: Partial<IUnderAttackConfig> = {}) =>
        new UnderAttackMiddleware(
            {...defaultConfig, ...config},
            mockFingerprintValidator as any,
            mockBotDetector as any,
            mockChallengeManager as any,
            null,
            null,
            mockMetrics as any
        );

    it("allows requests when middleware is disabled", async () => {
        const middleware = createMiddlewareInstance({enabled: false});
        const req = {method: "GET", cookies: {}, path: "/"} as Request;
        const res = {} as Response;
        const next = jest.fn() as NextFunction;

        const result = await middleware.middleware(req, res, next, "127.0.0.1", "US", "Chicago");
        expect(result).toBe(true);
    });

    it("returns early for bypass header", async () => {
        const middleware = createMiddlewareInstance();
        const req = {
            method: "GET",
            path: "/",
            cookies: {},
            header: jest.fn().mockReturnValue("test-bypass"),
            headers: {
                "x-waf-bypass": "test-bypass"
            }
        } as unknown as Request;
        const res = {} as Response;
        const next = jest.fn() as NextFunction;

        const result = await middleware.middleware(req, res, next, "127.0.0.1", "US", "Chicago");
        expect(result).toBe(true);
        // expect(mockMetrics.incrementBypassCount).toHaveBeenCalled();
    });

    it("allows valid token requests", async () => {
        const middleware = createMiddlewareInstance();
        jest.spyOn<any, any>(middleware, "validateToken").mockReturnValue(true);

        const req = createRequest({
            method: "GET",
            cookies: {test_token: "validToken"},
            path: "/"
        });
        const res = {} as Response;
        const next = jest.fn() as NextFunction;

        const result = await middleware.middleware(req, res, next, "127.0.0.1", "US", "Chicago");
        expect(result).toBe(true);
        expect(mockMetrics.incrementValidTokenCount).toHaveBeenCalled();
    });

    // it("handles challenge page requests", async () => {
    //     const middleware = createMiddlewareInstance();
    //     const req = createRequest({
    //         method: "GET",
    //         cookies: {},
    //         path: "/",
    //         header: jest.fn().mockReturnValue(""),
    //         headers: {}
    //     });
    //     const res = {send: jest.fn()} as unknown as Response;
    //     const next = jest.fn() as NextFunction;
    //
    //     const result = await middleware.middleware(req, res, next, "127.0.0.1", "123");
    //     expect(result).toBe(false);
    //     expect(mockMetrics.incrementChallengePageShown).toHaveBeenCalled();
    //     expect(res.send).toHaveBeenCalled();
    // });

    // it("handles challenge requests with invalid JSON", async () => {
    //     const middleware = createMiddlewareInstance();
    //     const req = createRequest({
    //         method: "POST",
    //         url: "/__under_attack_challenge",
    //         cookies: {},
    //         headers: {}
    //     });
    //     const res = {
    //         status: jest.fn().mockReturnThis(),
    //         json: jest.fn()
    //     } as unknown as Response;
    //     const next = jest.fn() as NextFunction;
    //
    //     const result = await middleware.middleware(req, res, next, "127.0.0.1", "123");
    //     expect(result).toBe(true);
    //     expect(res.status).toHaveBeenCalledWith(400);
    //     expect(res.json).toHaveBeenCalledWith({success: false, message: "Invalid JSON"});
    // });

    // it("skips URLs in the exception list", async () => {
    //     const middleware = createMiddlewareInstance({skipUrls: ["/test/*"]});
    //     jest.spyOn<any, any>(middleware, "shouldSkipUrl").mockReturnValue(true);
    //
    //     const req = createRequest({
    //         method: "GET",
    //         cookies: {},
    //         path: "/test/example",
    //         headers: {}
    //     });
    //     const res = {} as Response;
    //     const next = jest.fn() as NextFunction;
    //
    //     await middleware.middleware(req, res, next, "127.0.0.1", "123");
    //     expect(next).toHaveBeenCalled();
    // });

});
