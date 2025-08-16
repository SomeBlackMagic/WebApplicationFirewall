import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {Log} from '@waf/Log';
import {UnderAttackMetrics} from '@waf/UnderAttack/UnderAttackMetrics';
import {HashUtils} from '@waf/Utils/HashUtils';
import {merge} from "lodash";

export interface IBrowserProofValidatorConfig {
    enabled: boolean;
    checksumValidation?: boolean; // Enable checksum validation
    validateProofFreshness?: boolean
}

/**
 * Class for validating robust browser proofs
 * that cannot be faked without a real browser
 */
export class BrowserProofValidator {

    private static readonly penalties = {
        module: {
            correlation: 20,    // Reduced from 30 for mobile
            canvas: {missing: 5, invalid: 10},
            webgl: {missing: 5, invalid: 15},
            timing: {missing: 5, invalid: 10},
            performance: {missing: 5, invalid: 10},
            css: {missing: 5, invalid: 10}
        },
        desktop: {
            correlation: 30,
            canvas: {missing: 20, invalid: 25},
            webgl: {missing: 15, invalid: 25},
            timing: {missing: 15, invalid: 20},
            performance: {missing: 10, invalid: 15},
            css: {missing: 10, invalid: 15}
        },
    }

    public constructor(
        private readonly config?: IBrowserProofValidatorConfig,
        private readonly metrics?: UnderAttackMetrics,
        private readonly log?: LoggerInterface,
    ) {
        this.config = merge<Partial<IBrowserProofValidatorConfig>, IBrowserProofValidatorConfig>({
                enabled: false,
                checksumValidation: true, // Enable checksum validation by default
                validateProofFreshness: true,
            },
            config
        );
        this.log = log ?? Log.instance.withCategory('app.UnderAttack.BrowserProofValidator');
        this.metrics = metrics ?? UnderAttackMetrics.get();
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
        if (!this.config.enabled) {
            this.log.debug('Browser proof validation skip is disabled');
            return 100;
        }
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
        const isSmartTV = this.isSmartTV(userAgent);

        // Log device type for debugging
        this.log.debug('Device detection results', {
            requestId,
            isMobile,
            isIOS,
            userAgent: userAgent?.substring(0, 100) // Log truncated UA
        });

        // Critical validations first - these can immediately fail the validation

        // 1. Validate proof freshness
        if (!this.validateProofFreshness(proofs)) {
            this.log.warn('Proof freshness validation failed', {requestId});
            this.metrics?.incrementProofFreshnessFailure();
            return Math.max(0, proofScore - 50); // Major deduction for expired proofs
        }

        // Check for VM by examining timing variance
        let isVM = false;
        if (proofs.timingProof && proofs.timingProof.variance > 50000000) {
            isVM = true;
            this.log.debug('VM detected via extremely high timing variance', {variance: proofs.timingProof.variance});
        }

        // Device-specific validation adjustments
        const currentPenalties = isMobile || isVM || isSmartTV ? BrowserProofValidator.penalties.module : BrowserProofValidator.penalties.desktop;

        // Log if we're relaxing correlation checks for special device types
        if (isVM || isSmartTV) {
            this.log.debug('Relaxing correlation checks for mobile/VM', {isMobile, isVM, isSmartTV});
        }

        // Validate correlation between different proof types
        if (!this.validateProofCorrelation(proofs, userAgent || '')) {
            this.log.warn('Proof correlation validation failed', {requestId});
            this.metrics?.incrementProofCorrelationFailure();
            proofScore -= currentPenalties.correlation;
        }

        // Validate individual proofs

        // Canvas proof
        if (proofs.canvasProof) {
            if (!this.validateCanvasProof(proofs.canvasProof)) {
                this.log.warn('Invalid canvas proof detected', {requestId, isMobile});
                this.metrics?.incrementCanvasProofFailure();
                proofScore -= currentPenalties.canvas.invalid;
            }
        } else {
            proofScore -= currentPenalties.canvas.missing;
        }

        // WebGL proof
        if (proofs.webglProof) {
            if (!this.validateWebGLProof(proofs.webglProof)) {
                this.log.warn('Invalid WebGL proof detected', {requestId, isMobile});
                this.metrics?.incrementWebGLProofFailure();
                proofScore -= currentPenalties.webgl.invalid;
            }
        } else {
            proofScore -= currentPenalties.webgl.missing;
        }

        // Timing proof
        if (proofs.timingProof) {
            if (!this.validateTimingProof(proofs.timingProof)) {
                this.log.warn('Invalid timing proof detected', {requestId, isMobile});
                this.metrics?.incrementTimingProofFailure();
                proofScore -= currentPenalties.timing.invalid;
            }
        } else {
            proofScore -= currentPenalties.timing.missing;
        }

        // Performance proof
        if (proofs.performanceProof) {
            if (!this.validatePerformanceProof(proofs.performanceProof)) {
                this.log.warn('Invalid performance proof detected', {requestId, isMobile});
                this.metrics?.incrementPerformanceProofFailure();
                proofScore -= currentPenalties.performance.invalid;
            }
        } else {
            proofScore -= currentPenalties.performance.missing;
        }

        // CSS proof - special handling for iOS
        if (proofs.cssProof) {
            // Special case for iOS devices which have specific CSS behavior
            if (!this.validateCSSProof(proofs.cssProof, isIOS)) {
                this.log.warn('Invalid CSS proof detected', {requestId, isMobile, isIOS});
                this.metrics?.incrementCSSProofFailure();
                proofScore -= currentPenalties.css.invalid;
            }
        } else {
            proofScore -= currentPenalties.css.missing;
        }

        const finalScore = Math.max(0, proofScore);
        this.log.debug('Final proof validation score', {requestId, score: finalScore});
        return finalScore;
    }

    /**
     * Validates Canvas-based proof
     */
    private validateCanvasProof(canvasProof: ICanvasProof): boolean {
        // Check for required fields - first verification step
        if (!canvasProof.hash || !canvasProof.imagePreview) {
            this.log.debug('Canvas proof missing required fields');
            return false;
        }

        // Check hash format (must be in hex format)
        if (!/^[a-f0-9]+$/i.test(canvasProof.hash)) {
            this.log.debug('Canvas hash has invalid format');
            return false;
        }

        // Check preview (must start with data:image)
        if (!canvasProof.imagePreview.startsWith('data:image')) {
            this.log.debug('Canvas preview has invalid format');
            return false;
        }

        // Check image data length - allow very small lengths for special cases like solid color canvases
        if (!canvasProof.dataLength || canvasProof.dataLength < 50) {
            this.log.debug('Canvas data length too small');
            return false;
        }

        // More lenient rendering time limits (0-200ms)
        // Some devices might report 0 for very fast renders
        if (canvasProof.renderTime === undefined || canvasProof.renderTime < 0 || canvasProof.renderTime > 200000) {
            this.log.debug('Canvas render time outside valid range');
            return false;
        }

        return true;
    }


    /**
     * Validates WebGL-based proof
     */
    private validateWebGLProof(webglProof: IWebGLProof): boolean {
        // Check for required fields
        if (!webglProof.vendor || !webglProof.renderer || !webglProof.version || !webglProof.pixelHash) {
            this.log.debug('WebGL proof missing required fields');
            return false;
        }

        // Check pixel hash format
        if (!/^[a-f0-9]+$/i.test(webglProof.pixelHash)) {
            this.log.debug('WebGL pixel hash has invalid format');
            return false;
        }

        // Validate render time - allow 0 for some devices and higher limit for mobile/slow devices
        if (webglProof.renderTime === undefined || webglProof.renderTime < 0 || webglProof.renderTime > 200000) {
            this.log.debug('WebGL render time outside valid range');
            return false;
        }

        // Extended list of valid vendors/renderers including mobile and VM cases
        const validVendors = [
            // Desktop GPUs
            'NVIDIA', 'AMD', 'Intel', 'ATI',
            // Mobile GPUs
            'Apple', 'ARM', 'Qualcomm', 'Google', 'Microsoft', 'Samsung',
            'PowerVR', 'Mali', 'Adreno', 'Imagination', 'VideoCore', 'Vivante',
            // Browsers/Software renderers
            'WebKit', 'Mozilla', 'Microsoft', 'Google', 'ANGLE', 'SwiftShader',
            'llvmpipe', 'DirectX', 'Mesa', 'Android Emulator', 'Apple Software',
        ];

        // Check for valid vendor in both renderer and vendor fields
        const hasValidVendor = validVendors.some(v =>
            webglProof.vendor?.toLowerCase().includes(v.toLowerCase()) ||
            webglProof.renderer?.toLowerCase().includes(v.toLowerCase())
        );

        // Additional checks for common valid mobile/emulator renderers
        const commonRenderers = [
            'Apple GPU', 'PowerVR', 'Mali', 'Adreno', 'Metal',
            'WebKit WebGL', 'ANGLE', 'SwiftShader', 'Direct3D'
        ];

        const hasCommonRenderer = commonRenderers.some(r =>
            webglProof.renderer?.includes(r)
        );

        if (!hasValidVendor && !hasCommonRenderer) {
            this.log.debug('WebGL has suspicious vendor/renderer', {
                vendor: webglProof.vendor,
                renderer: webglProof.renderer
            });
            return false;
        }

        return true;
    }

    /**
     * Validates timing measurement-based proof
     */
    private validateTimingProof(timingProof: ITimingProof): boolean {
        // Validate basic structure
        if (!timingProof.measurements || !Array.isArray(timingProof.measurements) || timingProof.measurements.length < 3) {
            this.log.debug('Timing proof has invalid or insufficient measurements');
            return false;
        }

        // Ensure each measurement has a duration
        if (!timingProof.measurements.every(m => typeof m.duration === 'number')) {
            this.log.debug('Timing proof contains measurements without duration');
            return false;
        }

        // Check measurement reasonability
        const durations = timingProof.measurements.map(m => m.duration);
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

        // More permissive time limits (0-100ms)
        // Some high-performance devices or browsers might report very small values
        if (avgDuration < 0 || avgDuration > 100000) {
            this.log.debug('Timing measurements average outside reasonable range', {avg: avgDuration});
            return false;
        }

        // Check clock resolution
        // clockResolution of 0 is acceptable on some platforms/browsers
        if (timingProof.clockResolution === undefined || timingProof.clockResolution < 0) {
            this.log.debug('Invalid clock resolution value');
            return false;
        }

        return true;
    }

    /**
     * Validates performance-based proof
     */
    private validatePerformanceProof(performanceProof: IPerformanceProof): boolean {
        // Basic structure validation
        if (!performanceProof.results || !Array.isArray(performanceProof.results) || performanceProof.results.length === 0) {
            this.log.debug('Performance proof missing results array or empty');
            return false;
        }

        // Check for tests - we now support a subset of tests being present
        // as some browsers might not support all tests
        const commonTests = ['object_creation', 'array_sort', 'regex'];
        const actualTests = performanceProof.results.map(r => r.test);

        // At least one common test should be present
        const hasCommonTest = commonTests.some(test => actualTests.includes(test));
        if (!hasCommonTest) {
            this.log.debug('Performance proof missing common tests', {actual: actualTests});
            return false;
        }

        // Test time validation - at least one test should have non-zero time
        let hasNonZero = false;
        let hasInvalidTime = false;

        for (const result of performanceProof.results) {
            // Check if time is a number and within reasonable range
            if (typeof result.time !== 'number' || result.time < 0 || result.time > 5000000) {
                hasInvalidTime = true;
                this.log.debug('Performance test has invalid time', {test: result.test, time: result.time});
                break;
            }

            if (result.time > 0) {
                hasNonZero = true;
            }
        }

        if (hasInvalidTime) {
            return false;
        }

        // For high-performance devices, all times might be near zero
        // Only fail if we have multiple tests and all are exactly zero
        if (performanceProof.results.length > 1 && !hasNonZero) {
            this.log.debug('All performance tests have zero time');
            return false;
        }

        // Total time validation
        if (performanceProof.totalTime === undefined || performanceProof.totalTime < 0) {
            this.log.debug('Invalid total time in performance proof');
            return false;
        }

        return true;
    }


    /**
     * Validates CSS-based proof
     */
    private validateCSSProof(cssProof: ICSSProof, isIOS: boolean): boolean {
        // Check for essential CSS properties
        if (!cssProof.transformMatrix ||
            cssProof.computedWidth === undefined ||
            cssProof.computedHeight === undefined) {
            this.log.debug('CSS proof missing essential properties');
            return false;
        }

        if(
            isIOS && cssProof.renderTime === 0 &&
            cssProof.transformMatrix === "matrix(1, 0, 0, 1, 0, 0)" &&
            cssProof.computedWidth > 210 && cssProof.computedWidth < 225 &&
            cssProof.computedHeight > 20 && cssProof.computedHeight < 30

        ) {
            return true;
        }

        // Check dimensions - must be positive but we're flexible on the actual values
        // Different browsers and devices will have different computed dimensions
        if (cssProof.computedWidth <= 0 || cssProof.computedHeight <= 0) {
            this.log.debug('CSS proof has invalid dimensions', {
                width: cssProof.computedWidth,
                height: cssProof.computedHeight
            });
            return false;
        }

        // Render time validation - allow 0 for high-performance devices
        if (cssProof.renderTime === undefined || cssProof.renderTime < 0 || cssProof.renderTime > 200000) {
            this.log.debug('CSS proof has invalid render time', {time: cssProof.renderTime});
            return false;
        }

        // Check transform matrix format
        // Common values: "matrix(1, 0, 0, 1, 0, 0)", "none", or other valid matrix formats
        const validMatrixPattern = /^(matrix\(.*\)|none)$/i;
        if (!validMatrixPattern.test(cssProof.transformMatrix)) {
            this.log.debug('CSS proof has invalid transform matrix format', {
                matrix: cssProof.transformMatrix
            });
            return false;
        }

        return true;
    }

    /**
     * Validates that proofs were generated recently
     * @param proofs Browser proofs to validate
     * @returns true if proofs are fresh, false otherwise
     */
    private validateProofFreshness(proofs: IBrowserProofs): boolean {
        if(!this.config.validateProofFreshness) {
            this.log.debug('Proof freshness validation disabled');
            return true;
        }
        // No timestamp means we can't validate freshness
        if (!proofs.timestamp) {
            this.log.debug('No timestamp in proofs, skipping freshness check');
            return true;
        }

        const now = Date.now();
        const proofAge = now - proofs.timestamp;

        // Negative age means clock manipulation or future timestamp
        if (proofAge < 0) {
            this.log.warn('Proof has future timestamp, possible clock manipulation', {
                now,
                timestamp: proofs.timestamp,
                age: proofAge
            });
            return false;
        }

        // Extend the allowable age to 60 seconds for better compatibility with slow networks
        const maxAge = 60000; // 60 seconds
        if (proofAge > maxAge) {
            this.log.debug('Proof too old', {
                age: proofAge,
                maxAllowed: maxAge
            });
            return false;
        }

        return true;
    }

    /**
     * Calculates all possible binding hash variants for different devices/browsers
     */
    private calculateBindingHashVariants(challengeId: string, proofSalt: string): Record<string, string> {
        return {
            // Standard hashes (8 characters)
            'sha256-8': HashUtils.sha256(challengeId + proofSalt).substring(0, 8),
            'djb2-8': HashUtils.djb2Hash(challengeId + proofSalt).substring(0, 8),

            // Universal hash with DJB2 preference (mobile-friendly)
            'universal-djb2-8': HashUtils.universalHash(challengeId + proofSalt, true).substring(0, 8),

            // Different length variants some devices might use
            'sha256-6': HashUtils.sha256(challengeId + proofSalt).substring(0, 6),
            'djb2-6': HashUtils.djb2Hash(challengeId + proofSalt).substring(0, 6),

            // Some implementations might hash only the salt
            'salt-sha256-8': HashUtils.sha256(proofSalt).substring(0, 8),
            'salt-djb2-8': HashUtils.djb2Hash(proofSalt).substring(0, 8),

            // Plain salt prefix (not hashed)
            'salt-prefix': proofSalt.substring(0, 8)
        };
    }

    /**
     * Validates consistency and correlation between different proof types
     * @param proofs Browser proofs to validate
     * @param userAgent User agent string for device detection
     * @returns true if proofs are correlated, false otherwise
     */
    private validateProofCorrelation(proofs: IBrowserProofs, userAgent: string): boolean {
        const isMobile = this.isMobileDevice(userAgent);
        const isIOS = this.isIOSDevice(userAgent);
        const isVM = this.isVirtualMachine(proofs);

        // For mobile devices or VMs, we relax correlation requirements
        // since timing and performance characteristics are less predictable
        if (isMobile || isVM) {
            this.log.debug('Relaxing correlation checks for mobile/VM', {isMobile, isVM});
            return true;
        }

        // Check timing and performance correlation for desktop browsers
        if (proofs.timingProof?.measurements && proofs.performanceProof?.totalTime) {
            try {
                // Calculate timing statistics
                const durations = proofs.timingProof.measurements.map(m => m.duration);
                const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

                // Skip correlation check if we have tiny timing values (high-performance devices)
                if (avgDuration < 1) {
                    this.log.debug('Skipping timing correlation check due to very small values', {avgDuration});
                } else {
                    const variance = durations.reduce((sum, val) => sum + Math.pow(val - avgDuration, 2), 0) / durations.length;
                    const perfTotal = proofs.performanceProof.totalTime;

                    // More flexible correlation threshold that scales with performance metrics
                    // Increased threshold to better handle real-world devices with high variance
                    const correlationThreshold = Math.max(25000000, perfTotal / 2);

                    // Check correlation only if both values are significant
                    if (variance > 100 && perfTotal > 1000 &&
                        Math.abs(variance - perfTotal / 1000) > correlationThreshold) {
                        this.log.debug('Timing and performance proofs don\'t correlate', {
                            timingVariance: variance,
                            perfTotal: perfTotal,
                            threshold: correlationThreshold
                        });
                        return false;
                    }
                }
            } catch (error) {
                // If any calculation fails, log and continue - don't fail validation
                this.log.debug('Error in timing correlation calculation', {error: error.message});
            }
        }

        // Check CSS and Canvas render time correlation
        if (proofs.cssProof?.renderTime && proofs.canvasProof?.renderTime) {
            // Only check if both have significant render times
            if (proofs.cssProof.renderTime > 10 && proofs.canvasProof.renderTime > 10) {
                const cssTime = proofs.cssProof.renderTime;
                const canvasTime = proofs.canvasProof.renderTime;

                // Much more lenient correlation threshold (1000x difference)
                // This still catches extreme anomalies while allowing for varying performance
                if (cssTime > canvasTime * 1000 || canvasTime > cssTime * 1000) {
                    this.log.debug('CSS and Canvas render times have extreme discrepancy', {
                        cssTime: cssTime,
                        canvasTime: canvasTime
                    });
                    return false;
                }
            }
        }

        // WebGL hardware consistency check
        if (proofs.webglProof?.renderer && proofs.performanceProof?.hardwareConcurrency) {
            const isMobileGPU = this.isMobileGPU(proofs.webglProof.renderer);
            const cores = proofs.performanceProof.hardwareConcurrency;

            // Only flag very obvious mismatches
            // Mobile GPU with extremely high core count (>16) is suspicious
            if (isMobileGPU && cores > 16) {
                this.log.debug('Mobile GPU with excessive core count', {
                    gpu: proofs.webglProof.renderer,
                    cores: cores
                });
                return false;
            }

            // High-end desktop GPU with single core is suspicious
            // This catches emulators but allows for low-end devices
            if (this.isHighEndGPU(proofs.webglProof.renderer) && cores === 1) {
                this.log.debug('High-end GPU with single core', {
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

        // Convert to lowercase for case-insensitive matching
        const rendererLower = renderer.toLowerCase();

        // Expanded list of mobile GPU identifiers
        const mobileGPUKeywords = [
            'powervr', 'mali', 'adreno', 'apple gpu', 'metal',
            'mobile intel', 'tegra', 'videocore', 'vivante',
            'gc', 'sgx', 'rogue', 'snapdragon', 'exynos',
            'kirin', 'mobile', 'iphone', 'ipad'
        ];

        return mobileGPUKeywords.some(keyword => rendererLower.includes(keyword));
    }

    /**
     * Checks if the renderer indicates a high-end desktop GPU
     */
    private isHighEndGPU(renderer?: string): boolean {
        if (!renderer) return false;

        // Convert to lowercase for case-insensitive matching
        const rendererLower = renderer.toLowerCase();

        // High-end GPU identifiers
        const highEndGPUKeywords = [
            'geforce rtx', 'radeon rx', 'quadro', 'titan',
            'radeon pro', 'firepro', 'tesla', 'arc',
            'rtx 20', 'rtx 30', 'rtx 40', 'gtx 10', 'rx 6', 'rx 7'
        ];

        return highEndGPUKeywords.some(keyword => rendererLower.includes(keyword));
    }

    /**
     * Detects if the browser is likely running in a virtual machine or emulator
     * based on performance characteristics
     */
    private isVirtualMachine(proofs: IBrowserProofs): boolean {
        // First check if it's a mobile device based on UserAgent
        const isMobile = proofs.userAgent ? this.isMobileDevice(proofs.userAgent) : false;

        // VM indicators in WebGL - most reliable indicators
        if (proofs.webglProof?.renderer || proofs.webglProof?.vendor) {
            const vmGpuKeywords = [
                'llvmpipe', 'swiftshader', 'virtualbox', 'vmware', 'parallels',
                'qemu', 'xen', 'virtual', 'software rasterizer',
                'virgl', 'microsoft basic render', 'android emulator'
            ];

            const rendererLower = proofs.webglProof.renderer?.toLowerCase() || '';
            const vendorLower = proofs.webglProof.vendor?.toLowerCase() || '';

            if (vmGpuKeywords.some(keyword =>
                rendererLower.includes(keyword) || vendorLower.includes(keyword)
            )) {
                this.log.debug('VM detected via WebGL renderer/vendor', {
                    renderer: proofs.webglProof.renderer,
                    vendor: proofs.webglProof.vendor
                });
                return true;
            }
        }

        // For mobile devices we ignore time variance indicators
        if (!isMobile && proofs.timingProof?.variance) {
            // Higher threshold for identifying VMs based on timing variance
            // Reduced threshold to detect more VMs based on high variance
            if (proofs.timingProof.variance > 40000000) {
                this.log.debug('VM detected via extremely high timing variance', {
                    variance: proofs.timingProof.variance
                });
                return true;
            }
        }

        // For mobile devices we also ignore memory limitations
        if (!isMobile && proofs.performanceProof?.memoryInfo) {
            const memInfo = proofs.performanceProof.memoryInfo;
            if (memInfo.jsHeapSizeLimit && memInfo.jsHeapSizeLimit < 128000000) { // 128MB threshold
                this.log.debug('VM detected via small JS heap limit', {
                    heapLimit: memInfo.jsHeapSizeLimit
                });
                return true;
            }
        }

        return false;
    }

    /**
     * Detect if the device is mobile based on the user agent
     */
    private isMobileDevice(userAgent?: string): boolean {
        if (!userAgent) return false;

        // Convert to lowercase once for more efficient comparison
        const ua = userAgent.toLowerCase();

        // Check for common mobile device keywords
        if (ua.includes('mobile') || ua.includes('android') || ua.includes('androd') || ua.includes('iphone') ||
            ua.includes('ipad') || ua.includes('ipod') || ua.includes('windows phone')) {
            return true;
        }

        // Additional mobile browser checks
        if (ua.includes('blackberry') || ua.includes('opera mini') ||
            ua.includes('iemobile') || ua.includes('silk/')) {
            return true;
        }

        return false;
    }

    /**
     * Detect if the device is iOS based (iPhone, iPad, etc)
     */
    private isIOSDevice(userAgent?: string): boolean {
        if (!userAgent) return false;

        // Direct contains check for iOS device identifiers
        if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('iPod')) {
            return true;
        }

        // iOS browsers
        if (userAgent.includes('CriOS') || userAgent.includes('FxiOS') ||
            (userAgent.includes('Safari') && userAgent.includes('Mobile') && userAgent.includes('Apple'))) {
            return true;
        }

        return false;
    }

    /**
     * Determines if the device is a Smart TV
     * @param userAgent User-Agent string
     * @returns true if the device is a Smart TV
     */
    private isSmartTV(userAgent?: string): boolean {
        if (!userAgent) return false;


        const lowerUA = userAgent.toLowerCase();
        return lowerUA.includes('smart-tv') ||
               lowerUA.includes('smarttv') ||
               lowerUA.includes('tizen') ||
               lowerUA.includes('webos') ||
               lowerUA.includes('tv safari') ||
               (lowerUA.includes('tv') && lowerUA.includes('samsung')) ||
               (lowerUA.includes('tv') && lowerUA.includes('lg')) ||
                          ((lowerUA.includes('android') || lowerUA.includes('androd')) && lowerUA.includes('tv'));
    }

}


/**
 * Interface for Canvas proof validation
 * Canvas proofs verify rendering capabilities and pixel manipulation
 */
export interface ICanvasProof {
    renderTime: number;       // Time taken to render in microseconds
    dataLength: number;       // Length of the canvas image data
    hash: string;             // Hash of the rendered canvas data (includes challenge binding)
    imagePreview: string;     // Base64 preview of the canvas (data:image/...)
    proofNonce?: string;      // Optional proof-specific nonce
}

/**
 * Interface for WebGL proof validation
 * WebGL proofs verify 3D rendering capabilities
 */
export interface IWebGLProof {
    vendor: string;           // WebGL vendor string
    renderer: string;         // WebGL renderer string
    version: string;          // WebGL version
    renderTime: number;       // Time taken to render in microseconds
    pixelHash: string;        // Hash of rendered WebGL pixels (includes challenge binding)
    proofNonce?: string;      // Optional proof-specific nonce
}

/**
 * Interface for timing measurement
 * Individual timing measurement for high-resolution timer proof
 */
export interface ITimingMeasurement {
    iteration?: number;       // Optional iteration number
    duration: number;         // Measured duration in microseconds
    result?: number;          // Optional result of the measured operation
    operation?: string;       // Optional description of the operation measured
}

/**
 * Interface for timing proof validation
 * Timing proofs verify high-resolution timer capabilities
 */
export interface ITimingProof {
    measurements: ITimingMeasurement[];  // Array of timing measurements
    clockResolution: number;   // Detected clock resolution in microseconds (0 for high-precision)
    avgDuration?: number;      // Optional average duration
    variance?: number;         // Optional variance of measurements
}

/**
 * Interface for performance test result
 * Individual performance test result
 */
export interface IPerformanceTestResult {
    test: string;             // Test identifier
    time: number;             // Execution time in microseconds
    score?: number;           // Optional normalized score
}

/**
 * Interface for performance proof validation
 * Performance proofs verify JavaScript execution capabilities
 */
export interface IPerformanceProof {
    results: IPerformanceTestResult[];  // Array of test results
    totalTime: number;        // Total time for all tests in microseconds
    memoryInfo?: {            // Optional browser memory information
        usedJSHeapSize?: number;     // Current heap size used
        totalJSHeapSize?: number;    // Total allocated heap size
        jsHeapSizeLimit?: number;    // Maximum heap size limit
    } | null;
    hardwareConcurrency?: number | null;  // Number of logical cores (null if not available)
}

/**
 * Interface for CSS proof validation
 * CSS proofs verify styling and layout capabilities
 */
export interface ICSSProof {
    transformMatrix: string;   // CSS transform matrix value
    computedWidth: number;     // Computed width of test element
    computedHeight: number;    // Computed height of test element
    renderTime: number;        // Time taken to apply and measure styles in microseconds
    filterEffects?: string;    // Optional CSS filter effects string
}

/**
 * Interface for all browser proofs
 * Comprehensive collection of proofs demonstrating browser capabilities
 */
export interface IBrowserProofs {
    timestamp?: number;        // When the proofs were generated (milliseconds since epoch)
    nonce?: string;            // One-time nonce from challenge for verification
    userAgent?: string;        // User-Agent string for device detection
    canvasProof?: ICanvasProof;           // 2D Canvas rendering proof
    webglProof?: IWebGLProof;             // 3D WebGL rendering proof
    timingProof?: ITimingProof;           // High-resolution timing proof
    performanceProof?: IPerformanceProof;  // JavaScript performance proof
    cssProof?: ICSSProof;                 // CSS styling and layout proof
}

