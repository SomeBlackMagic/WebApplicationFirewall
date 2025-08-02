// JailStorageOperator.test.ts
import fetchMock from 'jest-fetch-mock';
import {IJailStorageOperatorConfig, JailStorageOperator} from "@waf/Jail/JailStorageOperator";
import {BanInfo} from "@waf/Jail/JailManager";

fetchMock.enableMocks();

describe('JailStorageOperator', () => {
    let config: IJailStorageOperatorConfig;
    let jailStorageOperator: JailStorageOperator;

    beforeEach(() => {
        fetchMock.resetMocks();

        config = {
            apiHost: 'http://example.com',
            agentId: '12345'
        };

    });

    describe('load', () => {
        it('should load banned IPs successfully', async () => {
            const mockBannedIps: BanInfo[] = [
                {ip: '192.168.0.1', unbanTime: 1660000000000, escalationCount: 2, metadata: {reason: 'Abuse'}}
            ];
            fetchMock.mockResponseOnce(JSON.stringify(mockBannedIps), {status: 200});

            jailStorageOperator = new JailStorageOperator(config, fetchMock as any);

            const result = await jailStorageOperator.load();

            expect(fetchMock).toHaveBeenCalledWith(
                'http://example.com/agent/banned/load?agentId=12345',
                expect.objectContaining({method: 'GET'})
            );
            expect(result).toEqual(mockBannedIps);
        });

        it('should log and reject if response status is >= 500', async () => {
            fetchMock.mockResponseOnce('Server Error', {status: 500, statusText: 'Internal Server Error'});

            jailStorageOperator = new JailStorageOperator(config, fetchMock as any);
            await expect(jailStorageOperator.load()).rejects.toEqual('Internal Server Error');
        });

        it('should log and reject on fetch failure', async () => {
            fetchMock.mockRejectOnce(new Error('Network Error'));

            jailStorageOperator = new JailStorageOperator(config, fetchMock as any);
            await expect(jailStorageOperator.load()).rejects.toThrow('Network Error');
        });
    });

    describe('save', () => {
        it('should save new banned IPs successfully', async () => {
            const newItems: BanInfo[] = [
                {ip: '192.168.0.2', unbanTime: 1660000002000, escalationCount: 1, metadata: {reason: 'Spam'}}
            ];
            fetchMock.mockResponseOnce(null, {status: 200});

            jailStorageOperator = new JailStorageOperator(config, fetchMock as any);
            const result = await jailStorageOperator.save(newItems);

            expect(fetchMock).toHaveBeenCalledWith(
                'http://example.com/agent/banned/update?agentId=12345',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(newItems),
                    headers: {'Content-Type': 'application/json'}
                })
            );
            expect(result).toBe(true);
        });

        it('should log and reject if response status is >= 500', async () => {
            const newItems: BanInfo[] = [
                {ip: '192.168.0.2', unbanTime: 1660000002000, escalationCount: 1, metadata: {reason: 'Spam'}}
            ];
            fetchMock.mockResponseOnce('Server Error', {status: 500, statusText: 'Internal Server Error'});

            jailStorageOperator = new JailStorageOperator(config, fetchMock as any);
            await expect(jailStorageOperator.save(newItems)).rejects.toEqual('Internal Server Error');
        });

        it('should log and reject on fetch failure', async () => {
            const newItems: BanInfo[] = [
                {ip: '192.168.0.2', unbanTime: 1660000002000, escalationCount: 1, metadata: {reason: 'Spam'}}
            ];
            fetchMock.mockRejectOnce(new Error('Network Error'));

            jailStorageOperator = new JailStorageOperator(config, fetchMock as any);
            await expect(jailStorageOperator.save(newItems)).rejects.toThrow('Network Error');
        });
    });
});
