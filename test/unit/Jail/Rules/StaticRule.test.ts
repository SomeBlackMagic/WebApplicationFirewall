// @ts-ignore
import httpMocks from "node-mocks-http";
import { StaticRule, IStaticRuleConfig } from "@waf/Jail/Rules/StaticRule";
import { Request } from "express-serve-static-core";

describe("StaticRule", () => {
    const createMockRequest = (overrides: Record<string, unknown> = {}): Request => {
        return httpMocks.createRequest({
            url: "/api/test",
            hostname: "example.com",
            headers: {
                "user-agent": "TestBot/1.0",
                "x-custom-header": "custom-value",
            },
            method: "GET",
            ...overrides,
        });
    };

    const createRule = (configOverrides: Partial<IStaticRuleConfig> = {}): StaticRule => {
        const config: IStaticRuleConfig = {
            name: "test-static",
            type: "static",
            linkUrl: "http://localhost/blocklist.json",
            ...configOverrides,
        };

        global.fetch = jest.fn().mockResolvedValue(new Response("[]"));

        return new StaticRule(config);
    };

    const loadEntries = async (rule: StaticRule, entries: string[]): Promise<void> => {
        global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify(entries)));
        await (rule as any).fetchData();
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("default behavior (backward compatibility)", () => {
        it("blocks request when client IP is in the list (no field/method configured)", async () => {
            const rule = createRule();
            await loadEntries(rule, ["10.0.0.1", "10.0.0.2"]);

            const result = await rule.use("10.0.0.1", "US", "NYC", createMockRequest(), "req-1");

            expect(result).toBe(true);
        });

        it("allows request when client IP is not in the list (no field/method configured)", async () => {
            const rule = createRule();
            await loadEntries(rule, ["10.0.0.1", "10.0.0.2"]);

            const result = await rule.use("10.0.0.99", "US", "NYC", createMockRequest(), "req-1");

            expect(result).toBe(false);
        });
    });

    describe("field: ip, method: equals", () => {
        it("blocks request when client IP matches an entry", async () => {
            const rule = createRule({ field: "ip", method: "equals" });
            await loadEntries(rule, ["192.168.1.1"]);

            const result = await rule.use("192.168.1.1", "US", "NYC", createMockRequest(), "req-1");

            expect(result).toBe(true);
        });

        it("allows request when client IP does not match", async () => {
            const rule = createRule({ field: "ip", method: "equals" });
            await loadEntries(rule, ["192.168.1.1"]);

            const result = await rule.use("192.168.1.2", "US", "NYC", createMockRequest(), "req-1");

            expect(result).toBe(false);
        });
    });

    describe("field: ip, method: regexp", () => {
        it("blocks request when client IP matches a regex pattern", async () => {
            const rule = createRule({ field: "ip", method: "regexp" });
            await loadEntries(rule, ["^192\\.168\\."]);

            const result = await rule.use("192.168.1.50", "US", "NYC", createMockRequest(), "req-1");

            expect(result).toBe(true);
        });

        it("allows request when client IP does not match any pattern", async () => {
            const rule = createRule({ field: "ip", method: "regexp" });
            await loadEntries(rule, ["^192\\.168\\."]);

            const result = await rule.use("10.0.0.1", "US", "NYC", createMockRequest(), "req-1");

            expect(result).toBe(false);
        });
    });

    describe("field: url, method: equals", () => {
        it("blocks request when URL matches an entry", async () => {
            const rule = createRule({ field: "url", method: "equals" });
            await loadEntries(rule, ["/api/test", "/admin"]);

            const req = createMockRequest({ url: "/api/test" });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(true);
        });

        it("allows request when URL does not match", async () => {
            const rule = createRule({ field: "url", method: "equals" });
            await loadEntries(rule, ["/admin"]);

            const req = createMockRequest({ url: "/api/test" });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(false);
        });
    });

    describe("field: url, method: regexp", () => {
        it("blocks request when URL matches a regex pattern", async () => {
            const rule = createRule({ field: "url", method: "regexp" });
            await loadEntries(rule, ["/api/.*"]);

            const req = createMockRequest({ url: "/api/users/123" });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(true);
        });

        it("allows request when URL does not match any pattern", async () => {
            const rule = createRule({ field: "url", method: "regexp" });
            await loadEntries(rule, ["/admin/.*"]);

            const req = createMockRequest({ url: "/api/test" });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(false);
        });
    });

    describe("field: hostname, method: equals", () => {
        it("blocks request when hostname matches an entry", async () => {
            const rule = createRule({ field: "hostname", method: "equals" });
            await loadEntries(rule, ["evil.com", "example.com"]);

            const req = createMockRequest({ hostname: "evil.com" });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(true);
        });

        it("allows request when hostname does not match", async () => {
            const rule = createRule({ field: "hostname", method: "equals" });
            await loadEntries(rule, ["evil.com"]);

            const req = createMockRequest({ hostname: "good.com" });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(false);
        });
    });

    describe("field: hostname, method: regexp", () => {
        it("blocks request when hostname matches a regex pattern", async () => {
            const rule = createRule({ field: "hostname", method: "regexp" });
            await loadEntries(rule, [".*\\.evil\\.com$"]);

            const req = createMockRequest({ hostname: "sub.evil.com" });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(true);
        });

        it("allows request when hostname does not match any pattern", async () => {
            const rule = createRule({ field: "hostname", method: "regexp" });
            await loadEntries(rule, [".*\\.evil\\.com$"]);

            const req = createMockRequest({ hostname: "good.com" });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(false);
        });
    });

    describe("field: user-agent, method: equals", () => {
        it("blocks request when user-agent matches an entry", async () => {
            const rule = createRule({ field: "user-agent", method: "equals" });
            await loadEntries(rule, ["BadBot/1.0", "TestBot/1.0"]);

            const req = createMockRequest({ headers: { "user-agent": "BadBot/1.0" } });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(true);
        });

        it("allows request when user-agent does not match", async () => {
            const rule = createRule({ field: "user-agent", method: "equals" });
            await loadEntries(rule, ["BadBot/1.0"]);

            const req = createMockRequest({ headers: { "user-agent": "GoodBot/2.0" } });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(false);
        });
    });

    describe("field: user-agent, method: regexp", () => {
        it("blocks request when user-agent matches a regex pattern", async () => {
            const rule = createRule({ field: "user-agent", method: "regexp" });
            await loadEntries(rule, ["BadBot", "Crawler"]);

            const req = createMockRequest({ headers: { "user-agent": "Mozilla BadBot/1.0" } });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(true);
        });

        it("allows request when user-agent does not match any pattern", async () => {
            const rule = createRule({ field: "user-agent", method: "regexp" });
            await loadEntries(rule, ["BadBot"]);

            const req = createMockRequest({ headers: { "user-agent": "GoodBot/2.0" } });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(false);
        });
    });

    describe("field: header-<name>", () => {
        it("blocks request when custom header value matches (equals)", async () => {
            const rule = createRule({ field: "header-x-custom-header", method: "equals" });
            await loadEntries(rule, ["blocked-value", "custom-value"]);

            const req = createMockRequest({ headers: { "x-custom-header": "blocked-value" } });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(true);
        });

        it("allows request when custom header value does not match (equals)", async () => {
            const rule = createRule({ field: "header-x-custom-header", method: "equals" });
            await loadEntries(rule, ["blocked-value"]);

            const req = createMockRequest({ headers: { "x-custom-header": "allowed-value" } });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(false);
        });

        it("blocks request when custom header value matches (regexp)", async () => {
            const rule = createRule({ field: "header-x-api-key", method: "regexp" });
            await loadEntries(rule, ["^bad-key-"]);

            const req = createMockRequest({ headers: { "x-api-key": "bad-key-12345" } });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(true);
        });

        it("allows request when custom header value does not match (regexp)", async () => {
            const rule = createRule({ field: "header-x-api-key", method: "regexp" });
            await loadEntries(rule, ["^bad-key-"]);

            const req = createMockRequest({ headers: { "x-api-key": "good-key-12345" } });
            const result = await rule.use("1.1.1.1", "US", "NYC", req, "req-1");

            expect(result).toBe(false);
        });
    });

    describe("unknown field", () => {
        it("allows request when field is not recognized", async () => {
            const rule = createRule({ field: "unknown-field", method: "equals" });
            await loadEntries(rule, ["some-value"]);

            const result = await rule.use("1.1.1.1", "US", "NYC", createMockRequest(), "req-1");

            expect(result).toBe(false);
        });
    });

    describe("constructor and lifecycle", () => {
        it("fetches data on construction", async () => {
            const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify(["1.2.3.4"])));
            global.fetch = fetchMock;

            const rule = new StaticRule({
                name: "test-init",
                type: "static",
                linkUrl: "http://localhost/list.json",
            });

            await new Promise(resolve => setTimeout(resolve, 50));
            expect(fetchMock).toHaveBeenCalledWith("http://localhost/list.json");

            const result = await rule.use("1.2.3.4", "US", "NYC", createMockRequest(), "req-1");
            expect(result).toBe(true);
        });

        it("clears interval on stop without error", () => {
            global.fetch = jest.fn().mockResolvedValue(new Response("[]"));

            const rule = new StaticRule({
                name: "test-stop",
                type: "static",
                linkUrl: "http://localhost/list.json",
                updateInterval: 10,
            });

            expect(() => rule.onStop()).not.toThrow();
        });

        it("onStop is safe when no interval is configured", () => {
            global.fetch = jest.fn().mockResolvedValue(new Response("[]"));

            const rule = new StaticRule({
                name: "test-no-interval",
                type: "static",
                linkUrl: "http://localhost/list.json",
            });

            expect(() => rule.onStop()).not.toThrow();
        });
    });

    describe("fetchData error handling", () => {
        it("does not update list when response status is not 200", async () => {
            const rule = createRule();
            await loadEntries(rule, ["1.1.1.1"]);

            global.fetch = jest.fn().mockResolvedValue(new Response("[]", { status: 500 }));
            await (rule as any).fetchData();

            const result = await rule.use("1.1.1.1", "US", "NYC", createMockRequest(), "req-1");
            expect(result).toBe(true);
        });

        it("does not update list when fetch throws", async () => {
            const rule = createRule();
            await loadEntries(rule, ["1.1.1.1"]);

            global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
            await (rule as any).fetchData();

            const result = await rule.use("1.1.1.1", "US", "NYC", createMockRequest(), "req-1");
            expect(result).toBe(true);
        });

        it("does not update list when response is not valid JSON", async () => {
            const rule = createRule();
            await loadEntries(rule, ["1.1.1.1"]);

            global.fetch = jest.fn().mockResolvedValue(new Response("not-json", { status: 200 }));
            await (rule as any).fetchData();

            const result = await rule.use("1.1.1.1", "US", "NYC", createMockRequest(), "req-1");
            expect(result).toBe(true);
        });

        it("does not update list when response returns empty array", async () => {
            const rule = createRule();
            await loadEntries(rule, ["1.1.1.1"]);

            global.fetch = jest.fn().mockResolvedValue(new Response("[]", { status: 200 }));
            await (rule as any).fetchData();

            const result = await rule.use("1.1.1.1", "US", "NYC", createMockRequest(), "req-1");
            expect(result).toBe(true);
        });
    });
});
