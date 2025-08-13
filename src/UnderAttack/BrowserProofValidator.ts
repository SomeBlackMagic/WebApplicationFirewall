import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {Log} from '@waf/Log';
import {UnderAttackMetrics} from '@waf/UnderAttack/UnderAttackMetrics';

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
     */
    public validateBrowserProofs(proofs: IBrowserProofs, requestId: string, userAgent?: string): number {
        if (!proofs) {
            return 0;
        }

        let proofScore = 100;
        const isMobile = this.isMobileDevice(userAgent);
        const isIOS = this.isIOSDevice(userAgent);

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

}


export interface ICanvasProof {
    renderTime: number;
    dataLength: number;
    hash: string;
    imagePreview: string;
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
    canvasProof?: ICanvasProof;
    webglProof?: IWebGLProof;
    timingProof?: ITimingProof;
    performanceProof?: IPerformanceProof;
    cssProof?: ICSSProof;
}

