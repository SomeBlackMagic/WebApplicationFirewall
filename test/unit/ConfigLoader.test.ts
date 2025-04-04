
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import {ConfigLoader} from "../../src/ConfigLoader";
import mocked = jest.mocked;

jest.mock('fs');
jest.mock('js-yaml');

const mockedFs = mocked(fs);
const mockedYaml = mocked(yaml);

describe('ConfigLoader', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should load config from file', async () => {
        process.env.WAF_CONFIG_TYPE = 'file';
        process.env.WAF_CONFIG_SOURCE = 'config.yaml';
        const expected = {key: 'value'};
        mockedFs.readFileSync.mockReturnValue('key: value');
        mockedYaml.load.mockReturnValue(expected);
        const config = new ConfigLoader();
        const result = await config.load();
        expect(result).toEqual(expected);
        expect(mockedFs.readFileSync).toHaveBeenCalledWith('config.yaml', 'utf8');
        expect(mockedYaml.load).toHaveBeenCalledWith('key: value');
    });

    it('should load config from link', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({text: () => Promise.resolve('key: value'), status: 200} as Response)
        );
        process.env.WAF_CONFIG_TYPE = 'link';
        process.env.WAF_CONFIG_SOURCE = 'http://localhost/config.yaml';
        const expected = {key: 'value'};
        mockedYaml.load.mockReturnValue(expected);
        const config = new ConfigLoader();
        const result = await config.load();
        expect(result).toEqual(expected);
        expect(global.fetch).toHaveBeenCalledWith('http://localhost/config.yaml');
        expect(mockedYaml.load).toHaveBeenCalledWith('key: value');
    });

    it('should emit SIGINT when config type is not supported', async () => {
        process.env.WAF_CONFIG_TYPE = 'not-supported';

        const config = new ConfigLoader();

        // Mock for console.error
        const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

        // Mock for process.emit
        const mockProcessEmit = jest.spyOn(process, 'emit').mockImplementation();

        await config.load();

        // We check that Console.error was called with the correct message
        expect(mockConsoleError).toHaveBeenCalledWith('Config type `not-supported` not supported');

        // We check that Process.emit was called with the signal event 'Sigint'
        expect(mockProcessEmit).toHaveBeenCalledWith('SIGINT');

        // Restore the original state of MOCK objects
        mockConsoleError.mockRestore();
        mockProcessEmit.mockRestore();
    });
});
