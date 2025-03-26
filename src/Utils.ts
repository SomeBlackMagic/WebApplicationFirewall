'use strict';

export function env(key: string, defaultValue: any = null): string {
    return process.env[key] ? process.env[key] :  defaultValue;
}

/**
 *
 * @param key
 * @param defaultValue
 * @param radix
 */
export function envNumber(key: string, defaultValue: number = null, radix: number): number {
    return process.env[key] ? parseInt(process.env[key], radix) :  defaultValue;
}


/**
 *
 * @param key
 * @param defaultValue
 */
export function envBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key] ? process.env[key] : defaultValue;
    // @ts-ignore
    switch (value) {
        case true:
        case 'true':
        case 'True':
        case '1':
        case 'on':
        case 'yes':
            return true;
        default:
            return false;
    }
}