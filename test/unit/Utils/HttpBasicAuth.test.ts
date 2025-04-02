import {HttpBasicAuth, IHttpBasicAuthConfig} from "@waf/Utils/HttpBasicAuth";
import {createRequest, createResponse, MockResponse} from "node-mocks-http";
import {describe, expect, it, jest} from '@jest/globals';
import {NextFunction, Request, Response} from "express-serve-static-core";

describe('HttpBasicAuth class - ', () => {

    describe('authorization disabled', () => {
        let httpBasicAuth: HttpBasicAuth;
        let request: Request;
        let response: MockResponse<Response>;
        let nextFunction: NextFunction;

        beforeEach(() => {
            const config: IHttpBasicAuthConfig = {enabled: false, username: 'username', password: 'password'};
            httpBasicAuth = new HttpBasicAuth(config);
            // @ts-ignore
            request = createRequest<Request>();
            response = createResponse<Response>();
            nextFunction = jest.fn();
        });

        it('should authenticate request when config is not enabled and header is missing', () => {
            httpBasicAuth.authentication(request, response, nextFunction);

            expect(nextFunction).toBeCalledTimes(1);
            expect(response.statusCode).toBe(200);
        });

        it('should authenticate request when config is not enabled and header is incorrect', () => {
            request.headers.authorization = 'Basic dXNlcm5hbWU6d3JvbmdfUGFzc3dvcmQ=';
            httpBasicAuth.authentication(request, response, nextFunction);

            expect(nextFunction).toBeCalledTimes(1);
            expect(response.statusCode).toBe(200);
        });

        it('should authenticate request when config is not enabled and header is correct', () => {
            request.headers.authorization = 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=';
            httpBasicAuth.authentication(request, response, nextFunction);

            expect(nextFunction).toBeCalledTimes(1);
            expect(response.statusCode).toBe(200);
        });
    })
    describe('authorization enabled', () => {
        let httpBasicAuth: HttpBasicAuth;
        let req, res, next;

        beforeEach(() => {
            const config: IHttpBasicAuthConfig = { enabled: true, username: 'test', password: 'test' };
            httpBasicAuth = new HttpBasicAuth(config);
            req = createRequest();
            res = createResponse();
            next = jest.fn();
        });

        describe('authentication', () => {
            it('should call next() if the service is not enabled', () => {
                httpBasicAuth['config'].enabled = false;
                httpBasicAuth.authentication(req, res, next);
                expect(next).toHaveBeenCalled();
            });
            it('should send 401 if authorization header is not presented', () => {
                req.headers.authorization = undefined;
                httpBasicAuth.authentication(req, res, next);
                expect(res.statusCode).toBe(401);
            });
            it('should call next() if user is authenticated', () => {
                req.headers.authorization = 'Basic ' + Buffer.from('test:test').toString('base64');
                httpBasicAuth.authentication(req, res, next);
                expect(next).toHaveBeenCalled();
            });
            it('should send 401 if user is not authenticated', () => {
                req.headers.authorization = 'Basic ' + Buffer.from('test:wrong').toString('base64');
                httpBasicAuth.authentication(req, res, next);
                expect(res.statusCode).toBe(401);
            });
        });
    })


});
