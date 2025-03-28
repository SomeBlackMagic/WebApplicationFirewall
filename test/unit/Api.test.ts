
import express, {NextFunction, Request, Response} from "express";
import httpMocks from "node-mocks-http";
import {Api, IApiConfig} from "@waf/Api";

describe('Api Authentication Middleware', () => {
    let service: Api;
    let mockRequest: httpMocks.MockRequest<Request>;
    let mockResponse: httpMocks.MockResponse<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
        const moduleConfig: IApiConfig = {
            auth: {
                enabled: true,
                username: 'admin',
                password: 'password',
            },
        };
        service = new Api(moduleConfig, express());
        service.bootstrap();
        mockRequest = httpMocks.createRequest();
        mockResponse = httpMocks.createResponse();
        nextFunction = jest.fn();
    });

    it('should allow requests without authentication if auth is disabled', () => {
        // Disable authentication in config
        service = new Api({ auth: { enabled: false } }, express());
        const middleware = service.authenticationMiddleware;

        middleware(mockRequest, mockResponse, nextFunction);

        expect(nextFunction).toHaveBeenCalled(); // `next()` is triggered
    });

    it('should authenticate successfully with valid credentials', () => {
        const middleware = service.authenticationMiddleware;
        const validCredentials = Buffer.from('admin:password').toString('base64');
        mockRequest.headers.authorization = `Basic ${validCredentials}`;

        middleware(mockRequest, mockResponse, nextFunction);

        expect(nextFunction).toHaveBeenCalled(); // Authentication successful
        expect(mockResponse.statusCode).toBe(200); // No error status sent
    });

    it('should send 401 when no credentials are provided', () => {
        const middleware = service.authenticationMiddleware;

        middleware(mockRequest, mockResponse, nextFunction);

        expect(mockResponse.statusCode).toBe(401); // Unauthorized
        expect(nextFunction).not.toHaveBeenCalled(); // `next()` is NOT triggered
    });

    it('should send 401 for invalid credentials', () => {
        const middleware = service.authenticationMiddleware;
        const invalidCredentials = Buffer.from('invalid:wrong').toString('base64');
        mockRequest.headers.authorization = `Basic ${invalidCredentials}`;

        middleware(mockRequest, mockResponse, nextFunction);

        expect(mockResponse.statusCode).toBe(401); // Unauthorized
        expect(nextFunction).not.toHaveBeenCalled(); // `next()` is NOT triggered
    });
});
