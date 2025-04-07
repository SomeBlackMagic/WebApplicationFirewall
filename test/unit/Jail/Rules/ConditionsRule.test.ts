import express = require('express');
import {Request} from "express-serve-static-core";
import {ConditionsRule, IConditionsRule} from "@waf/Jail/Rules/ConditionsRule";
import {createRequest} from "node-mocks-http";

describe('ConditionsRule', () => {

    let conditionsRule: ConditionsRule|any;
    let mockRequest: Request;

    beforeEach(() => {
        mockRequest = createRequest({
            url: "/test",
            hostname: "localhost",
            headers: {
                "user-agent": "Mock User Agent"
            },
            params: {},
            query: {},
            route: {},
            method: "GET",
            body: {key: "TestBody"},
            protocol: "http",
            secure: false,
            host: "localhost",
            originalUrl: "/test",
            path: "/test",
            baseUrl: "http://localhost",
            cookies: {},
            signedCookies: {},
            ip: "0.0.0.0",
            ips: [],
            subdomains: [],
        })

        // @ts-ignore
        conditionsRule = new class extends ConditionsRule {
            public checkConditionsForUnitTests(conditions: IConditionsRule[], req: Request, country:string, city:string): boolean {
                return this.checkConditions(conditions, req, country, city);
            }
        }
    });

    it('checks conditions for URL', () => {
        const conditions: IConditionsRule[] = [{field: 'url', check: [{method: 'equals', values: ['/test']}]}];

        // @ts-ignore
        expect(conditionsRule.checkConditionsForUnitTests(conditions, mockRequest, "Country", "City")).toBe(true);
    });

    it('checks conditions for hostname', () => {
        const conditions: IConditionsRule[] = [{field: 'hostname', check: [{method: 'equals', values: ['localhost']}]}];

        expect(conditionsRule.checkConditionsForUnitTests(conditions, mockRequest, "Country", "City")).toBe(true);
    });

    it('checks conditions for user-agent', () => {
        const conditions: IConditionsRule[] = [{field: 'user-agent', check: [{method: 'equals', values: ['Mock User Agent']}]}];

        expect(conditionsRule.checkConditionsForUnitTests(conditions, mockRequest, "Country", "City")).toBe(true);
    });

    it('checks conditions for geo-country', () => {
        const conditions: IConditionsRule[] = [{field: 'geo-country', check: [{method: 'equals', values: ['Country']}]}];

        expect(conditionsRule.checkConditionsForUnitTests(conditions, mockRequest, "Country", "City")).toBe(true);
    });

    it('checks conditions for geo-city', () => {
        const conditions: IConditionsRule[] = [{field: 'geo-city', check: [{method: 'equals', values: ['City']}]}];

        expect(conditionsRule.checkConditionsForUnitTests(conditions, mockRequest, "Country", "City")).toBe(true);
    });
    it('checks conditions for header', () => {
        const conditions: IConditionsRule[] = [{field: 'header-user-agent', check: [{method: 'equals', values: ['Mock User Agent']}]}];

        expect(conditionsRule.checkConditionsForUnitTests(conditions, mockRequest, "Country", "City")).toBe(true);
    });

    it('checks conditions regexp for hostname', () => {
        const conditions: IConditionsRule[] = [{field: 'hostname', check: [{method: 'regexp', values: ['/host/']}]}];

        expect(conditionsRule.checkConditionsForUnitTests(conditions, mockRequest, "Country", "City")).toBe(true);
    });

    it('checks conditions multiple rules', () => {
        const conditions: IConditionsRule[] = [
            {field: 'geo-country', check: [{method: 'equals', values: ['Country2']}]},
            {field: 'hostname', check: [{method: 'regexp', values: ['/host/']}]}
        ];

        expect(conditionsRule.checkConditionsForUnitTests(conditions, mockRequest, "Country", "City")).toBe(false);
    });


});
