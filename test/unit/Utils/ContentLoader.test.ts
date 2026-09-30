import { ContentLoader } from '@waf/Utils/ContentLoader';
import fs from 'fs';
import path from 'path';

// Mock node:sea module
let mockIsSea = false;
const mockAssets: Record<string, string> = {};

jest.mock('node:sea', () => ({
    isSea: () => mockIsSea,
    getAsset: (key: string, encoding?: string) => {
        if (!(key in mockAssets)) {
            throw new Error(`Asset not found: ${key}`);
        }
        if (encoding === 'utf8') {
            return mockAssets[key];
        }
        return Buffer.from(mockAssets[key]);
    },
}), { virtual: true });

describe('ContentLoader', () => {
    beforeEach(() => {
        mockIsSea = false;
        Object.keys(mockAssets).forEach(key => delete mockAssets[key]);
    });

    describe('filesystem loading', () => {
        it('loads content from a local file', async () => {
            const tmpFile = path.join(__dirname, '__content_loader_test_tmp.txt');
            fs.writeFileSync(tmpFile, 'filesystem content', 'utf8');

            try {
                const result = await ContentLoader.load(tmpFile);
                expect(result).toBe('filesystem content');
            } finally {
                fs.unlinkSync(tmpFile);
            }
        });

        it('rejects when the file does not exist', async () => {
            await expect(ContentLoader.load('/nonexistent/path/file.html'))
                .rejects
                .toBeDefined();
        });
    });

    describe('SEA asset loading', () => {
        it('loads content from an embedded SEA asset when running inside SEA', async () => {
            mockIsSea = true;
            mockAssets['pages/challenge/index.min.html'] = '<html>sea-challenge</html>';

            const result = await ContentLoader.load('pages/challenge/index.min.html');
            expect(result).toBe('<html>sea-challenge</html>');
        });

        it('falls back to filesystem when SEA asset is not found', async () => {
            mockIsSea = true;
            // No asset registered for this key

            const tmpFile = path.join(__dirname, '__content_loader_sea_fallback.txt');
            fs.writeFileSync(tmpFile, 'fallback content', 'utf8');

            try {
                const result = await ContentLoader.load(tmpFile);
                expect(result).toBe('fallback content');
            } finally {
                fs.unlinkSync(tmpFile);
            }
        });

        it('rejects when SEA asset is not found and filesystem path also does not exist', async () => {
            mockIsSea = true;
            // No asset registered, and file does not exist on disk
            await expect(ContentLoader.load('/nonexistent/sea-fallback.html'))
                .rejects
                .toBeDefined();
        });

        it('does not use SEA assets when not running inside SEA', async () => {
            mockIsSea = false;
            mockAssets['pages/challenge/index.min.html'] = '<html>sea-content</html>';

            const tmpFile = path.join(__dirname, '__content_loader_no_sea.txt');
            fs.writeFileSync(tmpFile, 'regular fs content', 'utf8');

            try {
                const result = await ContentLoader.load(tmpFile);
                expect(result).toBe('regular fs content');
            } finally {
                fs.unlinkSync(tmpFile);
            }
        });
    });

    describe('HTTP loading', () => {
        it('loads content from an HTTP URL', async () => {
            const mockResponse = { text: () => Promise.resolve('remote content') };
            global.fetch = jest.fn().mockResolvedValue(mockResponse);

            try {
                const result = await ContentLoader.load('https://example.com/page.html');
                expect(result).toBe('remote content');
                expect(global.fetch).toHaveBeenCalledWith('https://example.com/page.html');
            } finally {
                jest.restoreAllMocks();
            }
        });

        it('rejects when HTTP fetch fails', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

            try {
                await expect(ContentLoader.load('https://example.com/fail'))
                    .rejects
                    .toBeDefined();
            } finally {
                jest.restoreAllMocks();
            }
        });
    });
});
