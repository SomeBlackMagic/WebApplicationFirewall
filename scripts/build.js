const esbuild = require('esbuild');
const path = require("node:path");
const { execSync } = require('node:child_process')
const fs = require('fs')

function copyHtmlRecursive(srcDir, dstDir) {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const dstPath = path.join(dstDir, entry.name);

        if (entry.isDirectory()) {
            copyHtmlRecursive(srcPath, dstPath);
        } else if (entry.isFile() && entry.name.endsWith('.min.html')) {
            fs.mkdirSync(path.dirname(dstPath), { recursive: true });
            fs.copyFileSync(srcPath, dstPath);
            console.log(`Copied: ${srcPath} -> ${dstPath}`);
        }
    }
}

const htmlObfuscatorPlugin = {
    name: 'pages-obfuscator',
    setup(build) {
        build.onEnd(() => {
            execSync('node pages/obfuscate-html.js pages/challenge/index.html pages/challenge/index.min.html', {
                stdio: 'inherit'
            });
        });

        // 2. Copy *.min.html from pages/ to dist/
        const srcPagesDir = 'pages';
        const dstDistDir = 'dist';
        copyHtmlRecursive(srcPagesDir, dstDistDir);
    }
};
esbuild.build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    platform: 'node',
    outdir: 'dist',
    sourcemap: true,
    target: 'node20',
    format: 'cjs',
    tsconfig: 'tsconfig.app.json',
    alias: {
        '@app': path.resolve(__dirname, '../src/'),
    },
    logLevel: 'info',
    plugins: [htmlObfuscatorPlugin]
}).catch(() => process.exit(1));
