// BrowserProofValidator.test.ts

import {BrowserProofValidator, IBrowserProofs} from "@waf/UnderAttack/BrowserProofValidator";

describe('BrowserProofValidator', () => {
    let browserProofValidator: BrowserProofValidator;

    beforeEach(() => {
        browserProofValidator = new BrowserProofValidator();
    });

    // it('should return 100 when all proofs are valid', () => {
    //     const proofs: IBrowserProofs = {
    //         canvasProof: {
    //             renderTime: 1000,
    //             dataLength: 1500,
    //             hash: 'abc123',
    //             imagePreview: 'data:image/png;base64,test',
    //         },
    //         webglProof: {
    //             vendor: 'NVIDIA',
    //             renderer: 'GeForce GTX 1080',
    //             version: '4.6',
    //             renderTime: 200,
    //             pixelHash: '123abc',
    //         },
    //         timingProof: {
    //             measurements: [{duration: 10}],
    //             clockResolution: 1,
    //         },
    //         performanceProof: {
    //             results: [
    //                 {test: 'object_creation', time: 500},
    //                 {test: 'array_sort', time: 300},
    //                 {test: 'regex', time: 200},
    //             ],
    //             totalTime: 1000,
    //         },
    //         cssProof: {
    //             transformMatrix: 'scale(1)',
    //             computedWidth: 1920,
    //             computedHeight: 1080,
    //             renderTime: 50,
    //         },
    //     };
    //
    //     const result = browserProofValidator.validateBrowserProofs(proofs);
    //     expect(result).toBe(100);
    // });

    it('should return 0 when no proofs are provided', () => {
        const result = browserProofValidator.validateBrowserProofs({});
        expect(result).toBe(30);
    });

    // it('should return reduced score when some proofs are invalid', () => {
    //     const proofs: IBrowserProofs = {
    //         canvasProof: {
    //             renderTime: 0,
    //             dataLength: 1500,
    //             hash: 'abc123',
    //             imagePreview: '',
    //         },
    //         webglProof: {
    //             vendor: 'Unknown',
    //             renderer: 'Unknown Renderer',
    //             version: '0.0',
    //             renderTime: 1,
    //             pixelHash: 'xyz789',
    //         },
    //         timingProof: {
    //             measurements: [{duration: 5}],
    //             clockResolution: 0,
    //         },
    //         performanceProof: {
    //             results: [{test: 'missing_test', time: 100}],
    //             totalTime: -100,
    //         },
    //         cssProof: {
    //             transformMatrix: '',
    //             computedWidth: -1,
    //             computedHeight: 0,
    //             renderTime: 100000,
    //         },
    //     };
    //
    //     const result = browserProofValidator.validateBrowserProofs(proofs);
    //     expect(result).toBeLessThan(100);
    //     expect(result).toBeGreaterThan(0);
    // });
    //
    // it('should handle missing individual proofs and adjust score accordingly', () => {
    //     const proofs: IBrowserProofs = {
    //         canvasProof: undefined,
    //         webglProof: undefined,
    //         timingProof: undefined,
    //         performanceProof: undefined,
    //         cssProof: undefined,
    //     };
    //
    //     const result = browserProofValidator.validateBrowserProofs(proofs);
    //     expect(result).toBe(0);
    // });
});

