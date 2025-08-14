import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {Log} from '@waf/Log';
import {Singleton} from '@waf/Utils/Singleton';
import * as crypto from 'crypto';
import {IBrowserProofs} from '@waf/UnderAttack/BrowserProofValidator';
import {merge} from "lodash";

/**
 * Configuration for the proof rate limiter
 */
export interface IProofRateLimiterConfig {
    enabled: boolean;
    mode?: 'strict' | 'audit';   // Mode of operation
    maxUsageCount: number;      // Max times a proof can be reused
    expirationTimeMs: number;   // Time until a proof expires
    cleanupIntervalMs: number;  // Interval for cache cleanup
}

/**
 * Class for rate limiting and detecting reused browser proofs
 */
export class ProofRateLimiter extends Singleton<ProofRateLimiter, []> {
    // Map to store proof signatures and their usage counts
    private readonly proofCache: Map<string, IProofCacheEntry> = new Map();
    // Cleanup interval
    private readonly cleanupInterval: NodeJS.Timeout;

    constructor(
        private readonly config: IProofRateLimiterConfig,
        private readonly log?: LoggerInterface,
    ) {
        super();

        this.config = merge({
            enabled: false,          // Enable proof rate limiting by default
            mode: 'strict',         // Default mode is strict
            maxUsageCount: 5,          // Maximum times a proof can be reused
            expirationTimeMs: 3600000,  // One hour expiration
            cleanupIntervalMs: 600000   // Clean up every 10 minutes
        }, config)

        if (!this.log) {
            this.log = Log.instance.withCategory('app.UnderAttack.ProofRateLimiter');
        }

        if(this.config.enabled) {
            // Set up cache cleanup
            this.cleanupInterval = setInterval(() => this.cleanupCache(), this.config.cleanupIntervalMs);
            process.on('exit', () => clearInterval(this.cleanupInterval));
        }
    }

    /**
     * Check if the proof has been reused too many times
     * @param proofs Browser proofs to check
     * @param clientIp
     * @returns true if the proof can be used, false if it's been used too many times
     */
    public validateProofUniqueness(proofs: IBrowserProofs, clientIp: string): boolean {
        if (!this.config.enabled) {
            this.log.debug('Proof rate limiting is disabled');
            return true; // If not enabled, allow all proofs
        }
        // Calculate a signature for the proof
        const proofSignature = this.calculateProofSignature(proofs);

        // Get current cache entry or create a new one
        let entry = this.proofCache.get(proofSignature);

        if (entry) {
            // Update existing entry
            entry.count++;
            entry.lastSeen = Date.now();
            entry.ips.add(clientIp);

            // Check if proof has been used too many times
            if (entry.count > this.config.maxUsageCount) {
                this.log.warn('Proof reused too many times', {
                    signature: proofSignature.substring(0, 16), // First 16 chars for logging
                    count: entry.count,
                    uniqueIPs: entry.ips.size
                });
                if(this.config.mode === 'audit') {
                    // In audit mode, just log the issue
                    return true; // Allow usage but log the issue
                }
                return false;
            }

            // Check if proof is being used across too many IPs
            if (entry.ips.size > 3) { // More than 3 IPs is suspicious
                this.log.warn('Proof used across multiple IPs', {
                    signature: proofSignature.substring(0, 16),
                    uniqueIPs: entry.ips.size
                });
                if(this.config.mode === 'audit') {
                    // In audit mode, just log the issue
                    this.log.debug('Proof used across multiple IPs in audit mode, allowing request', {})
                    return true; // Allow usage but log the issue
                }
                return false;
            }
        } else {
            // Create new entry
            entry = {
                count: 1,
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                ips: new Set([clientIp])
            };
            this.proofCache.set(proofSignature, entry);
        }

        return true;
    }

    /**
     * Calculate a unique signature for the browser proofs
     */
    private calculateProofSignature(proofs: IBrowserProofs): string {
        const signatureComponents = [];

        // Add Canvas proof hash if available
        if (proofs.canvasProof?.hash) {
            signatureComponents.push(proofs.canvasProof.hash);
        }

        // Add WebGL proof details if available
        if (proofs.webglProof) {
            signatureComponents.push(
                proofs.webglProof.vendor,
                proofs.webglProof.renderer,
                proofs.webglProof.pixelHash
            );
        }

        // Add CSS proof details if available
        if (proofs.cssProof) {
            signatureComponents.push(
                proofs.cssProof.transformMatrix,
                String(proofs.cssProof.computedWidth),
                String(proofs.cssProof.computedHeight)
            );
        }

        // Create a hash of all components
        return crypto.createHash('sha256')
            .update(signatureComponents.join('|'))
            .digest('hex');
    }

    /**
     * Clean up expired entries from the cache
     */
    private cleanupCache(): void {
        const now = Date.now();
        const expirationThreshold = now - this.config.expirationTimeMs;

        let expiredCount = 0;
        for (const [signature, entry] of this.proofCache.entries()) {
            if (entry.lastSeen < expirationThreshold) {
                this.proofCache.delete(signature);
                expiredCount++;
            }
        }

        this.log.debug('Cleaned up proof cache', {
            expiredEntries: expiredCount,
            remainingEntries: this.proofCache.size
        });
    }
}

/**
 * Entry in the proof cache
 */
interface IProofCacheEntry {
    count: number;          // Number of times the proof has been used
    firstSeen: number;      // Timestamp of first usage
    lastSeen: number;       // Timestamp of last usage
    ips: Set<string>;       // Set of IPs that have used this proof
}
