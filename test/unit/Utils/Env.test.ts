
import * as process from 'process';
import {envBoolean, envNumber} from "@waf/Utils/Env";

describe('Test envBoolean function', () => {

    it('should return `true` for truthy cases', () => {
        ['true', 'True', '1', 'on', 'yes'].forEach(value => {
            process.env.TEST_VAR = value;
            expect(envBoolean('TEST_VAR', false)).toBeTruthy();
        });
    });

    it('should return `false` for falsy cases', () => {
        ['false', 'False', '0', 'off', 'no', undefined].forEach(value => {
            process.env.TEST_VAR = String(value);
            expect(envBoolean('TEST_VAR', true)).toBeFalsy();
        });
    });

    it('should default to `defaultValue` if the key does not exist in `process.env`', () => {
        delete process.env.TEST_VAR;
        expect(envBoolean('TEST_VAR', false)).toBeFalsy();
        expect(envBoolean('TEST_VAR', true)).toBeTruthy();
    });
});

describe('Test envNumber function', () => {

    it('should return corresponding number for given value', () => {
        ['10', '500', '2024'].forEach((value) => {
            process.env.TEST_VAR = value;
            expect(envNumber('TEST_VAR', 1, 10)).toBe(Number(value));
        });
    });

    it('should return `defaultValue` if the key does not exist in `process.env`', () => {
        delete process.env.TEST_VAR;
        expect(envNumber('TEST_VAR', 9999, 10)).toBe(9999);
    });

    it('should return parsed number in specified radix', () => {
        process.env.TEST_VAR = '1010';
        expect(envNumber('TEST_VAR', 1, 2)).toBe(10);
    });
});
