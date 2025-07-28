import fs, {promises as fsPromises} from "fs";
import lockfile from "proper-lockfile";
import {BanInfo, JailManager} from "@waf/Jail/JailManager";
import {JailStorageFile} from "@waf/Jail/JailStorageFile";
import {Registry} from "prom-client";
import {Metrics} from "@waf/Metrics/Metrics";

describe('JailStorageFile test', () => {

    it('Load test', async () => {
        const mkdirSpy: jest.SpyInstance = jest
            .spyOn(fsPromises, 'mkdir')
            .mockResolvedValue('');


        const existsSync: jest.SpyInstance = jest
            .spyOn(fs, 'existsSync')
            .mockReturnValue(false);

        const writeEmptyFile: jest.SpyInstance = jest
            .spyOn(fsPromises, 'writeFile')
            .mockResolvedValue()


        const locker: jest.SpyInstance = jest.spyOn(lockfile, 'lock').mockResolvedValue(async () => {

        })

        const readFile: jest.SpyInstance = jest
            .spyOn(fsPromises, 'readFile')
            .mockResolvedValue('{}');


        const obj = new JailStorageFile({
            filePath: "/data.json",
            locker: {
                enabled: true,
            }
        });

        expect(await obj.load(true)).toEqual({});
        expect(mkdirSpy).toHaveBeenCalled();
        expect(existsSync).toHaveBeenCalled();
        expect(writeEmptyFile).toHaveBeenCalled();
        expect(locker).toHaveBeenCalled();
        expect(readFile).toHaveBeenCalled();

    });

    it('Save test', async () => {
        const writeFile: jest.SpyInstance = jest
            .spyOn(fsPromises, 'writeFile')
            .mockResolvedValue();

        // const locker

        const obj = new JailStorageFile({
            filePath: "/data.json",
            locker: {
                enabled: true,
            }
        });
        // @ts-ignore
        (obj as any).lock = jest.spyOn(lockfile, 'lock').mockResolvedValue(Promise.resolve(() => {
            return;
        }));

        const data: BanInfo[] = [{
            ip: "192.168.1.1",
            unbanTime: Math.floor(Date.now() / 1000),
            escalationCount: 1,
            metadata: {
                country: "USA",
                city: "Seattle"
            }
        }];

        await obj.save([], data, true);
        expect(writeFile).toHaveBeenCalled();
    });

    describe('reCalculateStorageMetrics', () => {
        const metricRegister: Registry = new Registry();
        let jailStorageFile: JailStorageFile
        let defaultMetrics: Metrics;

        beforeEach(() => {
            defaultMetrics = new Metrics({
                enabled: true,
                auth: {enabled: false}
            }, jest.mock('express') as any, metricRegister);
            jailStorageFile = new JailStorageFile({
                filePath: "/data.json",
                locker: {
                    enabled: true,
                }
            }, defaultMetrics);
        });

        afterEach(() => {
            metricRegister.clear();
            jest.clearAllMocks();
        });

        it('should calculate storage metrics correctly', async () => {
            // Mock the blockedIPs

            const blockedIPs = [
                {
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
                {
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
            ]

            // @ts-ignore
            jailStorageFile.reCalculateStorageMetrics(blockedIPs);

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
