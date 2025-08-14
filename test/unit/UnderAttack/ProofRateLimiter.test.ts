// ProofRateLimiter.test.ts
import crypto from 'crypto';
import {IProofRateLimiterConfig, ProofRateLimiter} from "@waf/UnderAttack/ProofRateLimiter";
import {IBrowserProofs} from '@waf/UnderAttack/BrowserProofValidator';

describe('ProofRateLimiter', () => {
    let config: IProofRateLimiterConfig;
    let rateLimiter: ProofRateLimiter;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(global, 'setInterval');

        config = {
            enabled: true,
            mode: 'strict',
            maxUsageCount: 3,
            expirationTimeMs: 3600000,
            cleanupIntervalMs: 600000
        };

        rateLimiter = new ProofRateLimiter(config);
    });

    afterEach(() => {
        jest.clearAllMocks();
        rateLimiter['proofCache'].clear();

    });

    test('allows unique proof usage below max count', () => {
        const proofs: IBrowserProofs = {
            canvasProof: {
                hash: 'hash1',
                renderTime: 1500,
                dataLength: 12000,
                imagePreview: 'data:image/png;base64,test'
            }
        };
        expect(rateLimiter.validateProofUniqueness(proofs, '192.168.1.1')).toBe(true);
        expect(rateLimiter.validateProofUniqueness(proofs, '192.168.1.1')).toBe(true);
        expect(rateLimiter.validateProofUniqueness(proofs, '192.168.1.1')).toBe(true);
    });

    test('blocks reused proof beyond max count', () => {
        const proofs: IBrowserProofs = {
            canvasProof: {
                hash: 'hash2',
                renderTime: 1500,
                dataLength: 12000,
                imagePreview: 'data:image/png;base64,test'
            }
        };
        rateLimiter.validateProofUniqueness(proofs, '192.168.1.1');
        rateLimiter.validateProofUniqueness(proofs, '192.168.1.1');
        rateLimiter.validateProofUniqueness(proofs, '192.168.1.1');
        expect(rateLimiter.validateProofUniqueness(proofs, '192.168.1.1')).toBe(false);
    });

    test('allows proof reuse when mode is audit', () => {
        config.mode = 'audit';
        rateLimiter = new ProofRateLimiter(config);

        const proofs: IBrowserProofs = {
            canvasProof: {
                hash: 'hash3',
                renderTime: 1500,
                dataLength: 12000,
                imagePreview: 'data:image/png;base64,test'
            }
        };
        rateLimiter.validateProofUniqueness(proofs, '192.168.1.1');
        rateLimiter.validateProofUniqueness(proofs, '192.168.1.1');
        rateLimiter.validateProofUniqueness(proofs, '192.168.1.1');
        expect(rateLimiter.validateProofUniqueness(proofs, '192.168.1.1')).toBe(true);
    });

    test('blocks proof used across multiple IPs', () => {
        const proofs: IBrowserProofs = {
            canvasProof: {
                hash: 'hash4',
                renderTime: 1500,
                dataLength: 12000,
                imagePreview: 'data:image/png;base64,test'
            }
        };
        rateLimiter.validateProofUniqueness(proofs, '192.168.1.1');
        rateLimiter.validateProofUniqueness(proofs, '192.168.1.2');
        rateLimiter.validateProofUniqueness(proofs, '192.168.1.3');
        expect(rateLimiter.validateProofUniqueness(proofs, '192.168.1.4')).toBe(false);
    });

    test('cleans up expired proofs from cache', () => {
        jest.useFakeTimers();

        const proofs: IBrowserProofs = {
            timestamp: Date.now(),
            canvasProof: {
                renderTime: 1500,
                dataLength: 12000,
                hash: 'hash5',
                imagePreview: 'data:image/png;base64,test'
            }
        };

        rateLimiter.validateProofUniqueness(proofs, '192.168.1.1');

        jest.advanceTimersByTime(config.expirationTimeMs + 1000);

        rateLimiter['cleanupCache']();

        const proofSignature = crypto.createHash('sha256')
            .update(['hash5'].join('|'))
            .digest('hex');

        expect(rateLimiter['proofCache'].has(proofSignature)).toBe(false);

        jest.useRealTimers();
    });


    test('handles empty proofs gracefully', () => {
        const emptyProofs: IBrowserProofs = {};
        expect(() => rateLimiter.validateProofUniqueness(emptyProofs, '192.168.1.1')).not.toThrow();
    });

    test('allows all proofs when disabled', () => {
        config.enabled = false;
        rateLimiter = new ProofRateLimiter(config);

        const proofs: IBrowserProofs = {
            canvasProof: {
                hash: 'hash-disabled',
                renderTime: 1500,
                dataLength: 12000,
                imagePreview: 'data:image/png;base64,test'
            }
        };
        expect(rateLimiter.validateProofUniqueness(proofs, '192.168.1.1')).toBe(true);

        // Should ignore the exceeding the limit
        for (let i = 0; i < 10; i++) {
            expect(rateLimiter.validateProofUniqueness(proofs, '192.168.1.1')).toBe(true);
        }
    });


});
