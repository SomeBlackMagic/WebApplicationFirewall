import fs from "fs";

let sea: { isSea(): boolean; getAsset(key: string, encoding: string): string } | null = null;
try {
    sea = require('node:sea');
} catch {
    // node:sea is only available inside a Single Executable Application
}

export class ContentLoader {
    public static load(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                // Load from remote URL
                fetch(url)
                    .then(response => {
                        return resolve(response.text());
                    })
                    .catch(error => {
                        console.error(error);
                        return reject(error || '');
                    });
            } else if (sea?.isSea()) {
                // Load from embedded SEA asset, fallback to filesystem
                try {
                    const content = sea.getAsset(url, 'utf8');
                    return resolve(content);
                } catch {
                    try {
                        return resolve(fs.readFileSync(url, 'utf8'));
                    } catch (fsError) {
                        console.error(fsError);
                        return reject(fsError || '');
                    }
                }
            } else {
                // Load from filesystem
                try {
                    return resolve(fs.readFileSync(url, 'utf8'));
                } catch (error) {
                    console.error(error);
                    return reject(error || '');
                }
            }
        })

    }
}
