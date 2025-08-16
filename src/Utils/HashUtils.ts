
import * as crypto from 'crypto';

/**
 * Hash utilities compatible with frontend
 */
export class HashUtils {
    /**
     * SHA-256 hashing (primary method)
     * @param message - Message to hash
     * @returns Hash in hex format
     */
    public static sha256(message: string): string {
        try {
            return crypto.createHash('sha256').update(message, 'utf8').digest('hex');
        } catch (error) {
            // Fallback to DJB2 in case of issues
            return HashUtils.djb2Hash(message);
        }
    }

    /**
     * DJB2 hash algorithm - stable fallback, compatible with frontend
     * @param str - String to hash
     * @returns Hash in hex format
     */
    public static djb2Hash(str: string): string {
        let hash = 5381;
        const input = typeof str === 'string' ? str : String(str);

        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) + hash) + input.charCodeAt(i);
            hash = hash & 0xFFFFFFFF; // Convert to 32-bit number
        }

        // Convert to positive number and then to hex
        const positiveHash = Math.abs(hash);
        return positiveHash.toString(16).padStart(8, '0');
    }

    /**
     * Universal hashing with fallback
     * @param message - Message to hash
     * @param preferDjb2 - Force use of DJB2 (for mobile compatibility)
     * @returns Hash in hex format
     */
    public static universalHash(message: string, preferDjb2: boolean = false): string {
        if (preferDjb2) {
            return HashUtils.djb2Hash(message);
        }

        try {
            return HashUtils.sha256(message);
        } catch (error) {
            return HashUtils.djb2Hash(message);
        }
    }

    /**
     * Checks if hash is a result of DJB2 algorithm
     * @param hash - Hash to check
     * @returns true if this is a DJB2 hash (8 hex characters)
     */
    public static isDjb2Hash(hash: string): boolean {
        return /^[a-f0-9]{8}$/.test(hash);
    }

    /**
     * Checks if hash is a result of SHA-256 algorithm
     * @param hash - Hash to check
     * @returns true if this is a SHA-256 hash (64 hex characters)
     */
    public static isSha256Hash(hash: string): boolean {
        return /^[a-f0-9]{64}$/.test(hash);
    }
}
