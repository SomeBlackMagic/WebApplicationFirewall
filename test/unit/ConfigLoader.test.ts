import * as fs from "fs";
import * as yaml from "js-yaml";
import { ConfigLoader } from "../../src/ConfigLoader";
import mocked = jest.mocked;

jest.mock("fs");
jest.mock("js-yaml");

const mockedFs = mocked(fs);
const mockedYaml = mocked(yaml);

describe("ConfigLoader", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it("should load config from file", async () => {
        process.env.WAF_CONFIG_TYPE = "file";
        process.env.WAF_CONFIG_SOURCE = "config.yaml";
        const expected = { key: "value" };
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue("key: value");
        mockedYaml.load.mockReturnValue(expected);
        const config = new ConfigLoader();
        const result = await config.load();
        expect(result).toEqual(expected);
        expect(mockedFs.readFileSync).toHaveBeenCalledWith("config.yaml", "utf8");
        expect(mockedYaml.load).toHaveBeenCalledWith("key: value");
    });

    it("should load config from link", async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({ text: () => Promise.resolve("key: value"), status: 200 } as Response),
        );
        process.env.WAF_CONFIG_TYPE = "link";
        process.env.WAF_CONFIG_SOURCE = "http://localhost/config.yaml";
        const expected = { key: "value" };
        mockedYaml.load.mockReturnValue(expected);
        const config = new ConfigLoader();
        const result = await config.load();
        expect(result).toEqual(expected);
        expect(global.fetch).toHaveBeenCalledWith("http://localhost/config.yaml");
        expect(mockedYaml.load).toHaveBeenCalledWith("key: value");
    });

    it("should throw when config type is not supported", async () => {
        process.env.WAF_CONFIG_TYPE = "not-supported";

        const config = new ConfigLoader();
        await expect(config.load()).rejects.toThrow("Config type `not-supported` not supported");
    });

    it("should throw when config file does not exist", async () => {
        process.env.WAF_CONFIG_TYPE = "file";
        process.env.WAF_CONFIG_SOURCE = "/nonexistent/config.yaml";
        mockedFs.existsSync.mockReturnValue(false);

        const config = new ConfigLoader();
        await expect(config.load()).rejects.toThrow("Configuration file not found: /nonexistent/config.yaml");
    });
});
