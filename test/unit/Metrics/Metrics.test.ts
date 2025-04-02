
import * as core from "express-serve-static-core";
import {IMetricsConfig, Metrics} from "@waf/Metrics/Metrics";
import {Registry} from "prom-client";

jest.mock('express');

describe('Metrics tests', () => {
    const config: IMetricsConfig = {
        enabled: true,
        auth: {
            enabled: false,
        }
    };
    const webApp = {use: jest.fn(), get: jest.fn()} as unknown as core.Express;
    const logger = null;

    // describe('instance', () => {
    //     it('should create an instance', () => {
    //         expect(() => Metrics.build(config, webApp, logger)).not.toThrowError();
    //         expect(Metrics.instance).toBeInstanceOf(Metrics);
    //     });
    //
    //     it('should permit only one instance', () => {
    //         Metrics.build(config, webApp, logger);
    //         expect(() => Metrics.instance = new Metrics(config, webApp, logger)).toThrowError('Metrics is already instantiated.');
    //     });
    // });

    describe('bootstrap', () => {
        it('should register metrics', () => {
            const instance = new Metrics(config, webApp, logger);
            instance.bootstrap();

            expect(instance.isEnabled()).toBe(true);
            expect(instance.getRegisters()).toBeInstanceOf(Registry);
        });
    });

    describe('registerEndpoint', () => {
        it('should call webApp.use and webApp.get', () => {
            const instance = new Metrics(config, webApp, logger);
            instance.bootstrap();

            expect(webApp.use).toBeCalled();
            expect(webApp.get).toBeCalledWith('/waf/metrics', expect.any(Function), expect.any(Function));

        });

        // it('should respond with metrics on GET /waf/metrics', async () => {
        //     const instance = new Metrics(config, webApp, logger);
        //     const req = {} as Request;
        //     const res = {set: jest.fn(), end: jest.fn(), status: jest.fn()} as unknown as Response;
        //     const next = jest.fn() as NextFunction;
        //
        //     instance.bootstrap();
        //     const getHandler = (webApp.get as jest.MockedFunction<any>).mock.calls[0][2];
        //
        //     await getHandler(req, res, next);
        //
        //     expect(res.set).toHaveBeenCalledWith('Content-Type', instance.getRegisters().contentType);
        //     expect(res.end).toHaveBeenCalledWith(await instance.getRegisters().metrics());
        // });
        //
        // it('should respond with 500 error when metrics throw error', async () => {
        //     const instance = new Metrics(config, webApp, logger);
        //     const req = {} as Request;
        //     const res = {set: jest.fn(), end: jest.fn(), status: jest.fn()} as unknown as Response;
        //     const next = jest.fn() as NextFunction;
        //     const errorMesssage = 'Metrics error';
        //     mocked(instance.getRegisters().metrics).mockImplementation(() => {
        //         throw new Error(errorMesssage);
        //     });
        //
        //     instance.bootstrap();
        //     const getHandler = (webApp.get as jest.MockedFunction<any>).mock.calls[0][2];
        //
        //     await getHandler(req, res, next);
        //
        //     expect(res.status).toHaveBeenCalledWith(500);
        //     expect(res.end).toHaveBeenCalledWith(errorMesssage);
        // });
    });
});
