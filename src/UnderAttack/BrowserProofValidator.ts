import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {Log} from '@waf/Log';
import {UnderAttackMetrics} from '@waf/UnderAttack/UnderAttackMetrics';
import {HashUtils} from '@waf/Utils/HashUtils';

/**
 * Class for validating robust browser proofs
 * that cannot be faked without a real browser
 */
export class BrowserProofValidator {


    public constructor(
        private readonly metrics?: UnderAttackMetrics,
        private readonly log?: LoggerInterface,
    ) {
        if (!log) {
            this.log = Log.instance.withCategory('app.UnderAttack.BrowserProofValidator');
        }

        if (!metrics) {
            this.metrics = UnderAttackMetrics.get();
        }
    }

    /**
     * Validates all browser proofs and returns their reliability score
     * @param proofs The browser proofs to validate
     * @param requestId Request ID for logging
     * @param userAgent User agent string for device detection
     * @param challengeId Challenge ID for cryptographic binding
     * @param proofSalt Salt for cryptographic binding
     * @returns A score from 0-100 representing the reliability of the proofs
     */
    public validateBrowserProofs(
        proofs: IBrowserProofs,
        requestId: string,
        userAgent?: string,
        challengeId?: string,
        proofSalt?: string
    ): number {
        if (!proofs) {
            return 0;
        }

        // Store userAgent in proofs for use in other methods
        if (userAgent && !proofs.userAgent) {
            proofs.userAgent = userAgent;
        }

        let proofScore = 100;
        const isMobile = this.isMobileDevice(userAgent);
        const isIOS = this.isIOSDevice(userAgent);

        // Validate proof freshness
        if (!this.validateProofFreshness(proofs)) {
            this.log.warn('Proof freshness validation failed', {requestId});
            this.metrics?.incrementProofFreshnessFailure();
            return Math.max(0, proofScore - 50); // Major deduction for expired proofs
        }

        // Validate cryptographic binding to challenge
        if (challengeId && proofSalt && !this.validateProofBinding(proofs, challengeId, proofSalt)) {
            this.log.warn('Proof binding validation failed', {requestId, challengeId});
            this.metrics?.incrementProofBindingFailure();
            return 0; // Zero score for proofs not bound to the challenge
        }

        // Validate correlation between different proof types
        if (!this.validateProofCorrelation(proofs, userAgent)) {
            this.log.warn('Proof correlation validation failed', {requestId});
            this.metrics?.incrementProofCorrelationFailure();
            proofScore -= 30; // Major deduction for inconsistent proofs
        }

        // Validate Canvas proof
        if (proofs.canvasProof) {
            if (!this.validateCanvasProof(proofs.canvasProof)) {
                this.log.warn('Invalid canvas proof detected', {requestId, isMobile});
                proofScore -= isMobile ? 10 : 25; // Even more lenient for mobile
            }
        } else {
            proofScore -= isMobile ? 5 : 20;
        }

        // Validate WebGL proof
        if (proofs.webglProof) {
            if (!this.validateWebGLProof(proofs.webglProof)) {
                this.log.warn('Invalid WebGL proof detected', {requestId, isMobile});
                proofScore -= isMobile ? 15 : 25;
            }
        } else {
            proofScore -= isMobile ? 5 : 15; // WebGL may not be supported on older mobile devices
        }

        // Validate Timing proof
        if (proofs.timingProof) {
            if (!this.validateTimingProof(proofs.timingProof)) {
                this.log.warn('Invalid timing proof detected', {requestId, isMobile});
                proofScore -= isMobile ? 10 : 20;
            }
        } else {
            proofScore -= isMobile ? 5 : 15;
        }

        // Validate Performance proof
        if (proofs.performanceProof) {
            if (!this.validatePerformanceProof(proofs.performanceProof)) {
                this.log.warn('Invalid performance proof detected', {requestId, isMobile});
                proofScore -= isMobile ? 10 : 15;
            }
        } else {
            proofScore -= isMobile ? 5 : 10;
        }

        // Validate CSS proof
        if (proofs.cssProof) {
            // Special handling for iOS - CSS proof may look different from other devices
            if (isIOS && proofs.cssProof.renderTime === 0 &&
                proofs.cssProof.transformMatrix === "matrix(1, 0, 0, 1, 0, 0)" &&
                proofs.cssProof.computedWidth > 210 && proofs.cssProof.computedWidth < 225 &&
                proofs.cssProof.computedHeight > 20 && proofs.cssProof.computedHeight < 30) {
                // This is a valid iOS CSS proof
            } else if (!this.validateCSSProof(proofs.cssProof)) {
                this.log.warn('Invalid CSS proof detected', {requestId, isMobile, isIOS});
                proofScore -= isMobile ? 10 : 15;
            }
        } else {
            proofScore -= isMobile ? 5 : 10;
        }

        return Math.max(0, proofScore);
    }

    /**
     * Validates Canvas-based proof
     */
    private validateCanvasProof(canvasProof: ICanvasProof): boolean {
        // More lenient rendering time limits for mobile devices (from 0.1ms to 200ms)
        if (!canvasProof.renderTime || canvasProof.renderTime < 100 || canvasProof.renderTime > 200000) {
            this.metrics?.incrementCanvasProofFailure();
            return false;
        }

        // Check image data length
        if (!canvasProof.dataLength || canvasProof.dataLength < 1000) {
            this.metrics?.incrementCanvasProofFailure();
            return false;
        }

        // Check hash format (must be in hex format)
        if (!canvasProof.hash || !/^[a-f0-9]+$/i.test(canvasProof.hash)) {
            this.metrics?.incrementCanvasProofFailure();
            return false;
        }

        // Check preview (must start with data:image)
        if (!canvasProof.imagePreview || !canvasProof.imagePreview.startsWith('data:image')) {
            this.metrics?.incrementCanvasProofFailure();
            return false;
        }

        return true;
    }


    /**
     * Validates WebGL-based proof
     */
    /**
     * Validates WebGL-based proof
     */
    private validateWebGLProof(webglProof: IWebGLProof): boolean {
        // Check for required fields
        if (!webglProof.vendor || !webglProof.renderer || !webglProof.version) {
            this.metrics?.incrementWebGLProofFailure();
            return false;
        }

        // More lenient rendering time for mobile devices (from 50μs to 50ms)
        if (!webglProof.renderTime || webglProof.renderTime < 50 || webglProof.renderTime > 50000) {
            this.metrics?.incrementWebGLProofFailure();
            return false;
        }

        // Check pixel hash
        if (!webglProof.pixelHash || !/^[a-f0-9]+$/i.test(webglProof.pixelHash)) {
            this.metrics?.incrementWebGLProofFailure();
            return false;
        }

        // Check that vendor/renderer looks realistic - adding support for mobile GPUs
        const validVendors = [
            'NVIDIA', 'AMD', 'Intel', 'Apple', 'ARM', 'Qualcomm', 'Google', 'Microsoft',
            'PowerVR', 'Mali', 'Adreno', 'Imagination', // Mobile GPUs
            'WebKit', 'WebKit WebGL' // Accept for mobile browsers
        ];

        const hasValidVendor = validVendors.some(v =>
            webglProof.vendor.includes(v) || webglProof.renderer.includes(v)
        );

        // Add special check for mobile browsers
        const isMobileRenderer = webglProof.renderer.includes('Apple GPU') ||
            webglProof.renderer.includes('PowerVR') ||
            webglProof.renderer.includes('Mali') ||
            webglProof.renderer.includes('Adreno') ||
            webglProof.vendor.includes('Apple') ||
            webglProof.renderer.includes('Metal') ||
            webglProof.vendor.includes('WebKit') ||
            webglProof.renderer.includes('WebKit WebGL');

        if (!hasValidVendor && !webglProof.renderer.includes('SwiftShader') &&
            !webglProof.renderer.includes('ANGLE') && !isMobileRenderer) {
            this.metrics?.incrementWebGLProofFailure();
            return false;
        }

        return true;
    }

    /**
     * Validates timing measurement-based proof
     */
    private validateTimingProof(timingProof: ITimingProof): boolean {
        if (!timingProof.measurements || !Array.isArray(timingProof.measurements)) {
            this.metrics?.incrementTimingProofFailure();
            return false;
        }

        if (timingProof.measurements.length < 5) {
            this.metrics?.incrementTimingProofFailure();
            return false;
        }

        // Check measurement reasonability
        const durations = timingProof.measurements.map((m: ITimingMeasurement) => m.duration);
        const avgDuration = durations.reduce((a: number, b: number) => a + b, 0) / durations.length;

        // Average time should be within reasonable limits (from 1μs to 100ms)
        if (avgDuration < 10 || avgDuration > 100000) {
            this.metrics?.incrementTimingProofFailure();
            return false;
        }

        // Check clock resolution
        // Allow clockResolution === 0 for mobile devices
        if (timingProof.clockResolution === undefined || timingProof.clockResolution < 0) {
            this.metrics?.incrementTimingProofFailure();
            return false;
        }
        // Accept 0 for mobile
        if (timingProof.clockResolution === 0) {
            return true;
        }

        return true;
    }

    /**
     * Validates performance-based proof
     */
    private validatePerformanceProof(performanceProof: IPerformanceProof): boolean {
        if (!performanceProof.results || !Array.isArray(performanceProof.results)) {
            this.metrics?.incrementPerformanceProofFailure();
            return false;
        }

        // Check for all required tests
        const expectedTests = ['object_creation', 'array_sort', 'regex'];
        const actualTests = performanceProof.results.map((r: IPerformanceTestResult) => r.test);

        if (!expectedTests.every(test => actualTests.includes(test))) {
            this.metrics?.incrementPerformanceProofFailure();
            return false;
        }

        // More lenient execution time limits for mobile devices
        // Accept time === 0 for mobile if at least one test > 0
        let hasNonZero = false;
        for (const result of performanceProof.results) {
            if (result.time > 0) hasNonZero = true;
            if (result.time < 0 || result.time > 5000000) {
                this.metrics?.incrementPerformanceProofFailure();
                return false;
            }
        }
        if (!hasNonZero) {
            this.metrics?.incrementPerformanceProofFailure();
            return false;
        }

        // Check total time
        if (performanceProof.totalTime === undefined || performanceProof.totalTime < 0) {
            this.metrics?.incrementPerformanceProofFailure();
            return false;
        }

        return true;
    }


    /**
     * Validates CSS-based proof
     */
    private validateCSSProof(cssProof: ICSSProof): boolean {
        // Check for CSS properties
        if (!cssProof.transformMatrix || !cssProof.computedWidth || !cssProof.computedHeight) {
            this.metrics?.incrementCSSProofFailure();
            return false;
        }

        // Special handling for iOS devices where renderTime can be 0
        // Allow 0 renderTime for mobile devices (especially for iOS/Safari/Chrome)
        if (cssProof.renderTime === undefined || cssProof.renderTime < 0 || cssProof.renderTime > 200000) {
            this.metrics?.incrementCSSProofFailure();
            return false;
        }

        // Check dimensions - allow slight variations for different platforms
        // iOS devices typically have different computed dimensions (217x25 vs 220x24)
        if (cssProof.computedWidth <= 0 || cssProof.computedHeight <= 0) {
            this.metrics?.incrementCSSProofFailure();
            return false;
        }

        return true;
    }

    /**
     * Detect if the device is mobile based on the user agent
     */
    private isMobileDevice(userAgent?: string): boolean {
        if (!userAgent) return false;

        const mobileKeywords = [
            'iPhone', 'iPad', 'iPod', 'Android', 'Mobile', 'BlackBerry',
            'Windows Phone', 'Opera Mini', 'IEMobile'
        ];

        return mobileKeywords.some(keyword =>
            userAgent.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    /**
     * Detect if the device is iOS based (iPhone, iPad, etc)
     */
    private isIOSDevice(userAgent?: string): boolean {
        if (!userAgent) return false;

        const iosKeywords = ['iPhone', 'iPad', 'iPod', 'CriOS', 'FxiOS'];

        return iosKeywords.some(keyword =>
            userAgent.includes(keyword)
        );
    }

    /**
     * Validates that proofs were generated recently
     * @param proofs Browser proofs to validate
     * @returns true if proofs are fresh, false otherwise
     */
    private validateProofFreshness(proofs: IBrowserProofs): boolean {
        // No timestamp means we can't validate freshness
        if (!proofs.timestamp) return true;

        const now = Date.now();
        const proofAge = now - proofs.timestamp;

        // Proofs should be generated within the last 30 seconds
        if (proofAge < 0 || proofAge > 30000) {
            this.log.debug('Proof age outside acceptable range', { age: proofAge });
            return false;
        }

        return true;
    }

    /**
     * Validates that proofs are cryptographically bound to the challenge
     * @param proofs Browser proofs to validate
     * @param challengeId ID of the challenge
     * @param proofSalt Salt from the challenge
     * @returns true if proofs are bound to the challenge, false otherwise
     */
    private validateProofBinding(proofs: IBrowserProofs, challengeId: string, proofSalt: string): boolean {
        // Determine if there's a mobile User-Agent in the request
        const isMobile = proofs.userAgent ? this.isMobileDevice(proofs.userAgent) : false;
        const isIOS = proofs.userAgent ? this.isIOSDevice(proofs.userAgent) : false;

        // For mobile devices, especially iOS, we prefer to use DJB2 hash
        // for better compatibility and performance
        let expectedBinding;

        if (isIOS || isMobile) {
            // Use DJB2 for mobile devices
            const expectedHash = HashUtils.universalHash(challengeId + proofSalt, true); // preferDjb2 = true
            expectedBinding = expectedHash.substring(0, 8);
        } else {
            // Use SHA-256 for desktop devices
            const expectedHash = HashUtils.sha256(challengeId + proofSalt);
            expectedBinding = expectedHash.substring(0, 8);
        }

        // Check that Canvas and WebGL proofs contain the challenge binding
        if (proofs.canvasProof) {
            // The hash should include the binding somewhere
            if (!proofs.canvasProof.hash.includes(expectedBinding)) {
                // Try checking with an alternative algorithm for devices with limited support
                const altHash = isIOS || isMobile
                    ? HashUtils.sha256(challengeId + proofSalt).substring(0, 8)
                    : HashUtils.djb2Hash(challengeId + proofSalt).substring(0, 8);

                if (!proofs.canvasProof.hash.includes(altHash)) {
                    this.log.debug('Canvas proof not bound to challenge (both algorithms failed)', {
                        expected: {
                            primary: expectedBinding,
                            alternative: altHash
                        },
                        hash: proofs.canvasProof.hash,
                        isMobile: isMobile,
                        isIOS: isIOS
                    });
                    return false;
                } else {
                    // Algorithm worked successfully, but need to note in logs
                    this.log.debug('Canvas proof bound with alternative hash algorithm', {
                        algorithm: isIOS || isMobile ? 'SHA-256' : 'DJB2'
                    });
                }
            }
        }

        if (proofs.webglProof) {
            // The pixel hash should include the binding
            if (!proofs.webglProof.pixelHash.includes(expectedBinding)) {
                // Try checking with an alternative algorithm for devices with limited support
                const altHash = isIOS || isMobile
                    ? HashUtils.sha256(challengeId + proofSalt).substring(0, 8)
                    : HashUtils.djb2Hash(challengeId + proofSalt).substring(0, 8);

                if (!proofs.webglProof.pixelHash.includes(altHash)) {
                    this.log.debug('WebGL proof not bound to challenge (both algorithms failed)', {
                        expected: {
                            primary: expectedBinding,
                            alternative: altHash
                        },
                        hash: proofs.webglProof.pixelHash,
                        isMobile: isMobile,
                        isIOS: isIOS
                    });
                    return false;
                } else {
                    // Algorithm worked successfully, but need to note in logs
                    this.log.debug('WebGL proof bound with alternative hash algorithm', {
                        algorithm: isIOS || isMobile ? 'SHA-256' : 'DJB2'
                    });
                }
            }
        }

        // Check nonce
        if (proofs.nonce && proofs.nonce !== proofSalt.substring(0, 8)) {
            this.log.debug('Proof nonce mismatch', {
                expected: proofSalt.substring(0, 8),
                actual: proofs.nonce
            });
            return false;
        }

        return true;
    }

    /**
     * Validates consistency and correlation between different proof types
     * @param proofs Browser proofs to validate
     * @param userAgent
     * @returns true if proofs are correlated, false otherwise
     */
    private validateProofCorrelation(proofs: IBrowserProofs, userAgent:string): boolean {
        // Verify that timing and performance proofs correlate
        if (proofs.timingProof && proofs.performanceProof) {
            // Calculate variance of timing measurements
            const durations = proofs.timingProof.measurements.map(m => m.duration);
            const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
            const variance = durations.reduce((sum, val) => sum + Math.pow(val - avgDuration, 2), 0) / durations.length;

            // Check correlation with performance tests
            const perfTotal = proofs.performanceProof.totalTime;

            // Set the correlation threshold based on device type
            const isMobile = this.isMobileDevice(userAgent);
            const isVM = this.isVirtualMachine(proofs);

            // Higher threshold for mobile devices and VMs (which may have more scheduling jitter)
            let correlationThreshold = 50000; // Base threshold
            if (isMobile) correlationThreshold = 200000000; // Significantly increased threshold for mobile devices
            if (isVM) correlationThreshold = 200000000; // Same threshold for VMs and mobile devices

            // Reasonable correlation should exist between timing variance and performance total
            // For real browsers, these values are related to the same hardware, but can have high variance
            if (Math.abs(variance - perfTotal / 1000) > correlationThreshold && variance > 0 && perfTotal > 0) {
                this.log.debug('Timing and performance proofs don\'t correlate', {
                    timingVariance: variance,
                    perfTotal: perfTotal,
                    threshold: correlationThreshold,
                    isMobile: isMobile,
                    isVM: isVM
                });
                return false;
            }
        }

        // Verify that CSS and Canvas proofs show similar rendering characteristics
        if (proofs.cssProof && proofs.canvasProof) {
            // If both have render times, they should be somewhat correlated on the same device
            if (proofs.cssProof.renderTime > 0 && proofs.canvasProof.renderTime > 0) {
                const cssTime = proofs.cssProof.renderTime;
                const canvasTime = proofs.canvasProof.renderTime;

                // Expect reasonable correlation of render times (within 100x)
                if (cssTime > canvasTime * 100 || canvasTime > cssTime * 100) {
                    this.log.debug('CSS and Canvas render times don\'t correlate', {
                        cssTime: cssTime,
                        canvasTime: canvasTime
                    });
                    return false;
                }
            }
        }

        // WebGL vendor/renderer should be consistent with performance
        if (proofs.webglProof && proofs.performanceProof) {
            // Check if hardware concurrency is consistent with GPU
            // Mobile devices generally have fewer cores
            const isMobileGPU = this.isMobileGPU(proofs.webglProof.renderer);
            const cores = proofs.performanceProof.hardwareConcurrency || 0;

            // Mobile GPU but high core count is suspicious
            if (isMobileGPU && cores > 8) {
                this.log.debug('WebGL GPU and hardware concurrency mismatch', {
                    gpu: proofs.webglProof.renderer,
                    cores: cores
                });
                return false;
            }

            // Desktop GPU but single core is suspicious
            if (!isMobileGPU && cores === 1) {
                this.log.debug('Desktop GPU with single core is suspicious', {
                    gpu: proofs.webglProof.renderer,
                    cores: cores
                });
                return false;
            }
        }

        return true;
    }

    /**
     * Checks if the WebGL renderer indicates a mobile GPU
     */
    private isMobileGPU(renderer?: string): boolean {
        if (!renderer) return false;

        const mobileGPUKeywords = [
            'PowerVR', 'Mali', 'Adreno', 'Apple GPU', 'Metal',
            'Mobile Intel', 'Tegra', 'VideoCore'
        ];

        return mobileGPUKeywords.some(keyword =>
            renderer.includes(keyword)
        );
    }

    /**
     * Detects if the browser is likely running in a virtual machine or emulator
     * based on performance characteristics
     */
    private isVirtualMachine(proofs: IBrowserProofs): boolean {
        // First check if it's a mobile device based on UserAgent
        const isMobile = proofs.userAgent ? this.isMobileDevice(proofs.userAgent) : false;

        // VM indicators in WebGL - this is a reliable indicator
        if (proofs.webglProof) {
            const vmGpuKeywords = ['llvmpipe', 'SwiftShader', 'VirtualBox', 'VMware'];
            if (vmGpuKeywords.some(keyword =>
                proofs.webglProof.renderer?.includes(keyword) ||
                proofs.webglProof.vendor?.includes(keyword)
            )) {
                return true;
            }
        }

        // For mobile devices we ignore high time variance,
        // as it is normal due to background processes
        if (!isMobile && proofs.timingProof && proofs.timingProof.variance) {
            // Increase threshold by 10 times
            if (proofs.timingProof.variance > 10000000) {
                return true;
            }
        }

        // For mobile devices we also ignore memory limitations
        if (!isMobile && proofs.performanceProof?.memoryInfo) {
            const memInfo = proofs.performanceProof.memoryInfo;
            if (memInfo.jsHeapSizeLimit && memInfo.jsHeapSizeLimit < 100000000) { // Lower threshold to 100MB
                return true;
            }
        }

        return false;
    }

}


export interface ICanvasProof {
    renderTime: number;
    dataLength: number;
    hash: string;
    imagePreview: string;
    proofNonce?: string;    // Proof-specific nonce
}

/**
 * Interface for WebGL proof validation
 */
export interface IWebGLProof {
    vendor: string;
    renderer: string;
    version: string;
    renderTime: number;
    pixelHash: string;
    proofNonce?: string;    // Proof-specific nonce
}

/**
 * Interface for timing measurement
 */
export interface ITimingMeasurement {
    iteration?: number;
    duration: number;
    result?: number;
    operation?: string;
}

/**
 * Interface for timing proof validation
 */
export interface ITimingProof {
    measurements: ITimingMeasurement[];
    clockResolution: number;
    avgDuration?: number;
    variance?: number;
}

/**
 * Interface for performance test result
 */
export interface IPerformanceTestResult {
    test: string;
    time: number;
    score?: number;
}

/**
 * Interface for performance proof validation
 */
export interface IPerformanceProof {
    results: IPerformanceTestResult[];
    totalTime: number;
    memoryInfo?: {
        usedJSHeapSize?: number;
        totalJSHeapSize?: number;
        jsHeapSizeLimit?: number;
    } | null;
    hardwareConcurrency?: number | null;
}

/**
 * Interface for CSS proof validation
 */
export interface ICSSProof {
    transformMatrix: string;
    computedWidth: number;
    computedHeight: number;
    renderTime: number;
    filterEffects?: string;
}

/**
 * Interface for all browser proofs
 */
export interface IBrowserProofs {
    timestamp?: number;      // When the proofs were generated
    nonce?: string;          // One-time nonce from challenge
    userAgent?: string;      // User-Agent for device type detection
    canvasProof?: ICanvasProof;
    webglProof?: IWebGLProof;
    timingProof?: ITimingProof;
    performanceProof?: IPerformanceProof;
    cssProof?: ICSSProof;
}

