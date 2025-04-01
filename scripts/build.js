const esbuild = require('esbuild');
const path = require("node:path");

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
    logLevel: 'info'
}).catch(() => process.exit(1));
