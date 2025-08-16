import {HashUtils} from "@waf/Utils/HashUtils";
import crypto from 'crypto';

jest.mock('crypto', () => ({
    createHash: jest.fn().mockImplementation(() => {
        return {
            update: jest.fn().mockReturnThis(),
            digest: jest.fn().mockImplementation(() => 'mockedsha256hash')
        };
    })
}));

describe('HashUtils', () => {
    describe('sha256', () => {
        it('should return a valid SHA-256 hash when crypto works', () => {
            const message = 'test message';
            const expectedHash = 'mockedsha256hash';

            const result = HashUtils.sha256(message);

            expect(result).toBe(expectedHash);
        });

        it('should fall back to DJB2 when crypto throws an error', () => {
            jest.spyOn(crypto, 'createHash').mockImplementationOnce(() => {
                throw new Error('crypto error');
            });

            const message = 'fallback test';
            const result = HashUtils.sha256(message);

            expect(result).toBe(HashUtils.djb2Hash(message));
        });
    });

    describe('djb2Hash', () => {
        it('should return correct DJB2 hash for a given string', () => {
            const str = 'test string';
            const expectedHash = '074ea81c';

            const result = HashUtils.djb2Hash(str);

            expect(result).toBe(expectedHash);
        });
    });

    describe('universalHash', () => {
        it('should use SHA-256 by default', () => {
            const message = 'test universal hash';
            const result = HashUtils.universalHash(message);

            expect(result).toBe(HashUtils.sha256(message));
        });

        it('should use DJB2 hash when preferDjb2 is true', () => {
            const message = 'test universal hash prefer djb2';
            const result = HashUtils.universalHash(message, true);

            expect(result).toBe(HashUtils.djb2Hash(message));
        });

        it('should fall back to DJB2 hash if SHA-256 fails', () => {
            jest.spyOn(crypto, 'createHash').mockImplementationOnce(() => {
                throw new Error('crypto error');
            });

            const message = 'test universal hash error';
            const result = HashUtils.universalHash(message);

            expect(result).toBe(HashUtils.djb2Hash(message));
        });
    });

    describe('isDjb2Hash', () => {
        it('should return true for a valid DJB2 hash', () => {
            const hash = '26c90364';
            expect(HashUtils.isDjb2Hash(hash)).toBe(true);
        });

        it('should return false for an invalid DJB2 hash', () => {
            const hash = 'invalidhash';
            expect(HashUtils.isDjb2Hash(hash)).toBe(false);
        });
    });

    describe('isSha256Hash', () => {
        it('should return true for a valid SHA-256 hash', () => {
            const hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
            expect(HashUtils.isSha256Hash(hash)).toBe(true);
        });

        it('should return false for an invalid SHA-256 hash', () => {
            const hash = 'short';
            expect(HashUtils.isSha256Hash(hash)).toBe(false);
        });
    });
});
