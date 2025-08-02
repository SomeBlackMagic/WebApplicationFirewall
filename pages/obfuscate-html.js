#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { minify: minifyHTML } = require("html-minifier-terser");
const JavaScriptObfuscator = require("javascript-obfuscator");
const CleanCSS = require("clean-css");

// Get CLI arguments
const [,, inputFile, outputFile] = process.argv;

if (!inputFile || !outputFile) {
    console.error("Usage: node obfuscate-html.js <input.html> <output.html>");
    process.exit(1);
}

// Read input HTML file
let html = fs.readFileSync(inputFile, "utf8");

// Process <script> blocks using aggressive JS obfuscation
html = html.replace(/<script>([\s\S]*?)<\/script>/g, (_, code) => {
    const obfuscated = JavaScriptObfuscator.obfuscate(code, {
        "compact": true,
        "controlFlowFlattening": true,
        "controlFlowFlatteningThreshold": 1,
        "deadCodeInjection": true,
        "deadCodeInjectionThreshold": 1,
        "debugProtection": false,
        "debugProtectionInterval": 4000,
        "disableConsoleOutput": false,
        "domainLock": [],
        "domainLockRedirectUrl": "about:blank",
        "forceTransformStrings": [],
        "identifierNamesCache": null,
        "identifierNamesGenerator": "hexadecimal",
        "identifiersDictionary": [],
        "identifiersPrefix": "",
        "ignoreImports": false,
        "inputFileName": "",
        "log": true,
        "numbersToExpressions": true,
        "optionsPreset": "high-obfuscation",
        "renameGlobals": true,
        "renameProperties": false,
        "renamePropertiesMode": "safe",
        "reservedNames": [],
        "reservedStrings": ['__CHALLENGE_DATA___', '__TITTLE__', '__COOKIE_NAME__'],
        "seed": 0,
        "selfDefending": true,
        "simplify": true,
        "sourceMap": false,
        "sourceMapBaseUrl": "",
        "sourceMapFileName": "",
        "sourceMapMode": "separate",
        "sourceMapSourcesMode": "sources-content",
        "splitStrings": true,
        "splitStringsChunkLength": 5,
        "stringArray": true,
        "stringArrayCallsTransform": true,
        "stringArrayCallsTransformThreshold": 1,
        "stringArrayEncoding": ["rc4"],
        "stringArrayIndexesType": ["hexadecimal-number"],
        "stringArrayIndexShift": true,
        "stringArrayRotate": true,
        "stringArrayShuffle": true,
        "stringArrayWrappersCount": 5,
        "stringArrayWrappersChainedCalls": true,
        "stringArrayWrappersParametersMaxCount": 5,
        "stringArrayWrappersType": "function",
        "stringArrayThreshold": 1,
        "target": "browser",
        "transformObjectKeys": true,
        "unicodeEscapeSequence": true,
    });
    return `<script>${obfuscated.getObfuscatedCode()}</script>`;
});

// Process <style> blocks using CSS minifier
html = html.replace(/<style>([\s\S]*?)<\/style>/g, (_, code) => {
    const minified = new CleanCSS({ level: 2 }).minify(code).styles;
    return `<style>${minified}</style>`;
});

// Minify final HTML output
(async () => {
    const minifiedHTML = await minifyHTML(html, {
        collapseWhitespace: true,
        removeComments: true,
        minifyJS: false, // already processed
        minifyCSS: false // already processed
    });

    fs.writeFileSync(outputFile, minifiedHTML, "utf8");
    console.log(`✓ Processing complete: ${outputFile}`);
})();
