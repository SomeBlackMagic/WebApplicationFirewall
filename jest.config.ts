import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import fs from "fs";
import json from "json5";

const compilerOptions = json.parse(fs.readFileSync('./tsconfig.json').toString()).compilerOptions

const config: Config = {
    setupFilesAfterEnv: ['<rootDir>/test/bootstrap.js'],
    preset: 'ts-jest',
    testEnvironment: 'node',
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            { tsconfig: 'tsconfig.json' }
        ]
    },
    roots: ['<rootDir>/src', '<rootDir>/test'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleDirectories: ['node_modules', 'src'],
    coverageReporters: ['html', 'text', 'text-summary', 'cobertura', 'clover', 'lcov'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, { prefix: '<rootDir>/' }),
    testMatch: [
        "**/__tests__/**/*.[jt]s?(x)",
        "**/?(*.)+(spec|test).[tj]s?(x)"
    ],
};

export default config;
