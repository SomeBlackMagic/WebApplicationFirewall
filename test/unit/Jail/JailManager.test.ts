import {BanInfo, JailManager} from "@waf/Jail/JailManager";
import {CompositeRule} from "@waf/Jail/Rules/CompositeRule";
import {StaticRule} from "@waf/Jail/Rules/StaticRule";
import {FlexibleRule} from "@waf/Jail/Rules/FlexibleRule";
import {AbstractRule, IAbstractRuleConfig} from "@waf/Jail/Rules/AbstractRule";
import {createRequest, createResponse} from "node-mocks-http";
import {IBannedIPItem} from "@waf/WAFMiddleware";
import {Registry} from "prom-client";
import {Metrics} from "@waf/Metrics/Metrics";

jest.useFakeTimers();
jest.spyOn(global, 'setInterval');

describe('Jail Manager', () => {
    let jailManager: JailManager;

    beforeEach(() => {
        jailManager = new JailManager({
            enabled: true,
            filterRules: [],
            syncInterval: 5000,
            syncAlways: true
        });
    });

    describe('check', () => {
        const metricRegister: Registry = new Registry();
        let defaultMetrics: Metrics;

        beforeEach(() => {
            defaultMetrics = new Metrics({
                enabled: true,
                auth: {enabled: false}
            }, jest.mock('express') as any, metricRegister);
            jailManager = new JailManager({enabled: true, filterRules: []}, null, defaultMetrics);
        });

        afterEach(() => {
            metricRegister.clear();
            jest.clearAllMocks();
        });

        it('check if JailManager is disabled', async () => {
            jailManager = new JailManager({enabled: false, filterRules: []});

            const result = await jailManager.check(
                '192.168.1.1',
                'USA',
                'Chicago',
                createRequest(),
                'request-id-1',
                createResponse(),
            );
            expect(result).toBeFalsy()
        });

        it('check if ip is already blocked in store', async () => {
            jest.spyOn(jailManager as any, 'getBlockedIp').mockReturnValue({
                ip: '192.168.1.1',
                unbanTime: Date.now() + 10000,
                escalationCount: 0,
                duration: 10000,
                metadata: {
                    country: 'USA',
                    city: 'Chicago'
                }

            });
            const result = await jailManager.check(
                '192.168.1.1',
                'USA',
                'Chicago',
                createRequest(),
                'request-id-1',
                createResponse(),
            );
            expect(result).toBeTruthy();
            expect(await metricRegister.getSingleMetric('waf_jail_reject_blocked').get()).toEqual({
                "aggregator": "sum",
                "help": "Count of users who rejected because he blocked",
                "name": "waf_jail_reject_blocked",
                "type": "counter",
                "values": [
                    {
                        "labels": {
                            "city": "Chicago",
                            "country": "USA"
                        },
                        "value": 1
                    }
                ]
            });
        });

        it('check if ip is rejected by static rule', async () => {
            jailManager['rules'][0] = new class extends AbstractRule {
                public constructor(
                    private readonly result: boolean
                ) {
                    super();
                }

                public use(): Promise<false | true | IBannedIPItem> {
                    return Promise.resolve(this.result);
                }
            }(true)
            const result = await jailManager.check(
                '192.168.1.1',
                'USA',
                'Chicago',
                createRequest(),
                'request-id-1',
                createResponse(),
            );
            expect(result).toBeTruthy()
            expect(await metricRegister.getSingleMetric('waf_jail_reject_static').get()).toEqual({
                "aggregator": "sum",
                "help": "Count of users who rejected by static ip blocked",
                "name": "waf_jail_reject_static",
                "type": "counter",
                "values": [
                    {
                        "labels": {
                            "city": "Chicago",
                            "country": "USA"
                        },
                        "value": 1
                    }
                ]
            });
        });

        it('check if ip is rejected and ban by rule', async () => {
            jailManager['rules'][0] = new class extends AbstractRule {
                public constructor(
                    private readonly result: IBannedIPItem
                ) {
                    super();
                }

                public use(): Promise<false | true | IBannedIPItem> {
                    return Promise.resolve(this.result);
                }
            }({ ip: "192.168.1.1", escalationRate: 1, duration: 10, ruleId: 'local', requestIds: ['request-id-1'] })
            const result = await jailManager.check(
                '192.168.1.1',
                'USA',
                'Chicago',
                createRequest(),
                'request-id-1',
                createResponse(),
            );
            expect(result).toBeTruthy()
            expect(await metricRegister.getSingleMetric('waf_jail_reject_by_rule').get()).toEqual({
                "aggregator": "sum",
                "help": "Count of users who rejected and banned because of rule",
                "name": "waf_jail_reject_by_rule",
                "type": "counter",
                "values": [
                    {
                        "labels": {
                            "city": "Chicago",
                            "country": "USA",
                            "ruleId": "local"
                        },
                        "value": 1
                    }
                ]
            });
        });

    });

    describe('loadRules', () => {
        it('should load all types of rules', () => {
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

            const service = new JailManager({enabled: false, filterRules: rulesConfig});


            expect(service['rules'].length).toBe(3);
            expect(service['rules'][0] instanceof CompositeRule).toBe(true);
            expect(service['rules'][1] instanceof StaticRule).toBe(true);
            expect(service['rules'][2] instanceof FlexibleRule).toBe(true);
        });

        it('should throw when an invalid rule type is provided', () => {
            const invalidRule: IAbstractRuleConfig = {type: 'Invalid', name: 'foo'};

            const rulesConfig: IAbstractRuleConfig[] = [invalidRule];

            expect(() => {
                new JailManager({enabled: true, filterRules: rulesConfig});

            }).toThrow('Can not found observer or rule type - Invalid');
        });
    });

    describe('deleteBlockedIp', () => {
        // it('deletes blocked IP', async () => {
        //     await jailManager.blockIp('192.168.1.1', 60, 1.0, 'unknown', 'unknown');
        //     const blockedIp = jailManager.getBlockedIp('192.168.1.1') as BanInfo;
        //     expect(blockedIp.ip).toBe('192.168.1.1');
        //     const deleteResult = jailManager.deleteBlockedIp('192.168.1.1');
        //     expect(deleteResult).toBe(true);
        //     const blockedIpAfterDeletion = jailManager.ipIsBlocked('192.168.1.1');
        //     expect(blockedIpAfterDeletion).toEqual(false)
        // });

        it('returns false when deleting an IP that is not blocked', async () => {
            const deleteResult = jailManager.deleteBlockedIp('192.168.1.2');
            expect(deleteResult).toBe(false);
        });
    });

     //Testing blockIp method
     describe('blockIp', () => {
         it('should block an IP successfully', async () => {
             const ip = '192.168.1.3';
             const duration = 60000;
             const escalationRate = 1.0;
             const country = 'USA';
             const city = 'San Francisco';

             await jailManager.blockIp(ip, duration, escalationRate, {country, city});

             const blockedIp = jailManager.getBlockedIp(ip) as BanInfo;

             expect(blockedIp).not.toBeFalsy();
             expect(blockedIp.ip).toBe(ip);
             expect(blockedIp.metadata).toEqual({country, city});

         });
     });

     describe('reCalculateStorageMetrics', () => {
         const metricRegister: Registry = new Registry();
         let defaultMetrics: Metrics;

         beforeEach(() => {
             defaultMetrics = new Metrics({
                 enabled: true,
                 auth: {enabled: false}
             }, jest.mock('express') as any, metricRegister);
             jailManager = new JailManager({enabled: true, filterRules: []}, null, defaultMetrics);
         });

         afterEach(() => {
             metricRegister.clear();
             jest.clearAllMocks();
         });

         it('should calculate storage metrics correctly', async () => {
             // Mock the blockedIPs
             const blockedIPs = {
                 '192.168.1.1': {
                     ip: '192.168.1.1',
                     unbanTime: Date.now() + 10000,
                     escalationCount: 1,
                     duration: 10000,
                     metadata: {
                         country: 'USA',
                         city: 'Chicago',
                         ruleId: 'local',
                         isBlocked: true,
                     }
                 },
                 '192.168.1.2': {
                     ip: '192.168.1.2',
                     unbanTime: Date.now() - 10000, // Past time for not blocked IP
                     escalationCount: 2,
                     duration: 20000,
                     metadata: {
                         country: 'USA',
                         city: 'Los Angeles',
                         ruleId: 'remote',
                         isBlocked: false,
                     }
                 }
             };

             // @ts-ignore
             jailManager.blockedIPs = blockedIPs;

             // Call the method
             jailManager.reCalculateStorageMetrics();

             // Assert
             expect(await metricRegister.getSingleMetric('waf_jail_storage_data').get()).toEqual(
                 {
                     "aggregator": "sum",
                     "help": "How many data in storage grouped by ruleId, country, city, isBlocked",
                     "name": "waf_jail_storage_data",
                     "type": "gauge",
                     "values": [
                         {
                             "labels": {
                                 "city": "Chicago",
                                 "country": "USA",
                                 "escalationCount": "1",
                                 "isBlocked": "true",
                                 "ruleId": "local"
                             },
                             "value": 1
                         },
                         {
                             "labels": {
                                 "city": "Los Angeles",
                                 "country": "USA",
                                 "escalationCount": "2",
                                 "isBlocked": "false",
                                 "ruleId": "remote"
                             },
                             "value": 1
                         }
                     ]
                 }
             );

         });
     });

 });
