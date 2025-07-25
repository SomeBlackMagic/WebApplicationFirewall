import fs, {promises as fsPromises} from "fs";
import lockfile from "proper-lockfile";
import {BanInfo} from "@waf/Jail/JailManager";
import {JailStorageFile} from "@waf/Jail/JailStorageFile";

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
        (obj as any).lock = jest.spyOn(lockfile, 'lock').mockResolvedValue(Promise.resolve(() => { return; }));

        const data: BanInfo[] = [{
            ip: "192.168.1.1",
            unbanTime: Math.floor(Date.now() / 1000),
            escalationCount: 1,
            metadata: {
                geoCountry: "USA",
                geoCity: "Seattle"
            }
        }];

        await obj.save([], data, true);
        expect(writeFile).toHaveBeenCalled();
    });

});
