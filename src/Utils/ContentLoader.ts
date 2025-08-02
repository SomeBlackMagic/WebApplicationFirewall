import fs from "fs";

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
