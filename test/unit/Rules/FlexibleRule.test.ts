
// @ts-ignore
import httpMocks from "node-mocks-http";
import {FlexibleRule} from "@waf/Rules/FlexibleRule";

describe('FlexibleRule test', () => {
    let rule: FlexibleRule

    describe('FlexibleRule test url', () => {

        beforeEach(() => {
            rule = new FlexibleRule({
                type: 'flexible',
                duration: 10,
                field: "url",
                limit: 2,
                period: 30,
                scan: [
                    {
                        method: 'equals',
                        values: ['/foo', '/bar', '/baz'],
                    },
                    {
                        method: 'regexp',
                        values: ['/wp-(admin|include)/i', '/baz'],
                    },

                ]

            });
        });

        it('Equal url match', async () => {

            const request = httpMocks.createRequest({
                method: 'GET',
                url: '/foo',
            });

            let result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual(false);
            result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual({"duration": 10, "escalationRate": 1, "ip": "1.1.1.1", "ruleId": "flexible"});


        });

        it('regexp url match', async () => {

            const request = httpMocks.createRequest({
                method: 'GET',
                url: '/wp-admin/foo-bar',
            });

            let result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual(false);
            result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual({"duration": 10, "escalationRate": 1, "ip": "1.1.1.1", "ruleId": "flexible"});

        });

        it('url not match', async () => {

            const request = httpMocks.createRequest({
                method: 'GET',
                url: '/wp-aaadmin/foo-bar',
            });

            let result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual(false);
            result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual(false);

        });

    })

    describe('FlexibleRule test user-agent', () => {

        beforeEach(() => {
            rule = new FlexibleRule({
                type: 'flexible',
                duration: 10,
                field: "user-agent",
                limit: 2,
                period: 30,
                scan: [
                    {
                        method: 'equals',
                        values: [
                            'Mozilla/5.0 (Linux x86_64; en-US) Gecko/20100101 Firefox/70.3',
                            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_3_0) AppleWebKit/535.35 (KHTML, like Gecko) Chrome/51.0.2222.370 Safari/535',
                            'Mozilla/5.0 (Linux; Android 4.4.1; LG-V710 Build/KOT49I) AppleWebKit/603.50 (KHTML, like Gecko) Chrome/54.0.1913.136 Mobile Safari/601.8'
                        ],
                    },
                    {
                        method: 'regexp',
                        values: ['/(.*)Windows NT (10.3|11.0)/i',],
                    },

                ]

            });
            global.jailStorage.save([]);
        });

        it('Equal user-agent match', async () => {

            const request = httpMocks.createRequest({
                method: 'GET',
                headers: {
                    "user-agent": "Mozilla/5.0 (Linux x86_64; en-US) Gecko/20100101 Firefox/70.3"
                }

            });

            let result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual(false);
            result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual({"duration": 10, "escalationRate": 1, "ip": "1.1.1.1", "ruleId": "flexible"});

        });

        it('Regexp user-agent match', async () => {

            const request = httpMocks.createRequest({
                method: 'GET',
                headers: {
                    "user-agent": "Mozilla/5.0 (Linux x86_64; en-US) Gecko/20100101 Firefox/70.3"
                }

            });

            let result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual(false);
            result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual({"duration": 10, "escalationRate": 1, "ip": "1.1.1.1", "ruleId": "flexible"});

        });

        it('user-agent not match', async () => {

            const request = httpMocks.createRequest({
                method: 'GET',
                headers: {
                    "user-agent": "Mozilla/6.0 (Linux x86_64; en-US) Gecko/20100101 Firefox/70.3"
                }
            });

            let result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual(false);
            result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual(false);

        });

    })

    describe('FlexibleRule test header', () => {

        beforeEach(() => {
            rule = new FlexibleRule({
                type: 'flexible',
                duration: 10,
                field: "header-accept",
                limit: 2,
                period: 30,
                scan: [
                    {
                        method: 'equals',
                        values: [
                            'text/html, image/png, image/webp, image/jpeg, image/gif, image/x-xbitmap, */*;q=0.1',
                        ],
                    },
                    {
                        method: 'regexp',
                        values: ['/[+\\/]xml/'],
                    },

                ]

            });
            global.jailStorage.save([]);
        });

        it('Equal header match', async () => {

            const request = httpMocks.createRequest({
                method: 'GET',
                headers: {
                    "accept": "text/html, image/png, image/webp, image/jpeg, image/gif, image/x-xbitmap, */*;q=0.1"
                }

            });

            let result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual(false);
            result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual({"duration": 10, "escalationRate": 1, "ip": "1.1.1.1", "ruleId": "flexible"});

        });

        it('Regexp header match', async () => {

            const request = httpMocks.createRequest({
                method: 'GET',
                headers: {
                    "accept": "image/png, application/xml;q=0.9, application/xhtml+xml image/webp, image/jpeg, image/gif, image/x-xbitmap, */*;q=0.1"
                }

            });

            let result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual(false);
            result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual({"duration": 10, "escalationRate": 1, "ip": "1.1.1.1", "ruleId": "flexible"});

        });

        it('header not  match', async () => {

            const request = httpMocks.createRequest({
                method: 'GET',
                headers: {
                    "accept": "image/png, image/webp, image/jpeg, image/gif, image/x-xbitmap, */*;q=0.1"
                }
            });

            let result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual(false);
            result = await rule.use('1.1.1.1', 'none', 'none', request);
            expect(result).toEqual(false);

        });

    })

});
