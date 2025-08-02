import fs from "fs";

export class ContentLoader {
    public static load(url: string): Promise<string> {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            // Load from remote URL
            fetch(url)
                .then(response => response.text())
                .then(html => {
                    return Promise.resolve(html);
                })
                .catch(error => {
                    console.error(error);
                    return Promise.reject(error || '');
                });
        } else {
            // Load from filesystem
            try {
                return Promise.resolve(fs.readFileSync(url, 'utf8'));
            } catch (error) {
                console.error(error);
                return Promise.reject(error || '');
            }
        }
    }
}
