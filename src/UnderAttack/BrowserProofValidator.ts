import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {Log} from '@waf/Log';

/**
 * Class for validating robust browser proofs
 * that cannot be faked without a real browser
 */
export class BrowserProofValidator {


    public constructor(
        private readonly log?: LoggerInterface
    ) {
        if(!log) {
            this.log = Log.instance.withCategory('app.UnderAttack.BrowserProofValidator');
        }
    }

    /**
     * Validates all browser proofs and returns their reliability score
     */
    public validateBrowserProofs(proofs: IBrowserProofs): number {
        if (!proofs) {
            return 0;
        }

        let proofScore = 100;

        // Validate Canvas proof
        if (proofs.canvasProof) {
            if (!this.validateCanvasProof(proofs.canvasProof)) {
                this.log.debug('Invalid canvas proof detected');
                proofScore -= 25;
            }
        } else {
            proofScore -= 20;
        }

        // Validate WebGL proof
        if (proofs.webglProof) {
            if (!this.validateWebGLProof(proofs.webglProof)) {
                this.log.debug('Invalid WebGL proof detected');
                proofScore -= 25;
            }
        } else {
            proofScore -= 15;
        }

        // Validate Timing proof
        if (proofs.timingProof) {
            if (!this.validateTimingProof(proofs.timingProof)) {
                this.log.debug('Invalid timing proof detected');
                proofScore -= 20;
            }
        } else {
            proofScore -= 15;
        }

        // Validate Performance proof
        if (proofs.performanceProof) {
            if (!this.validatePerformanceProof(proofs.performanceProof)) {
                this.log.debug('Invalid performance proof detected');
                proofScore -= 15;
            }
        } else {
            proofScore -= 10;
        }

        // Validate CSS proof
        if (proofs.cssProof) {
            if (!this.validateCSSProof(proofs.cssProof)) {
                this.log.debug('Invalid CSS proof detected');
                proofScore -= 15;
            }
        } else {
            proofScore -= 10;
        }

        return Math.max(0, proofScore);
    }

    /**
     * Validates Canvas-based proof
     */
    private validateCanvasProof(canvasProof: ICanvasProof): boolean {
        // Check that rendering time is within reasonable limits (from 0.1ms to 50ms)
        if (!canvasProof.renderTime || canvasProof.renderTime < 100 || canvasProof.renderTime > 50000) {
            return false;
        }

        // Check image data length
        if (!canvasProof.dataLength || canvasProof.dataLength < 1000) {
            return false;
        }

        // Check hash format (must be in hex format)
        if (!canvasProof.hash || !/^[a-f0-9]+$/i.test(canvasProof.hash)) {
            return false;
        }

        // Check preview (must start with data:image)
        if (!canvasProof.imagePreview || !canvasProof.imagePreview.startsWith('data:image')) {
            return false;
        }

        return true;
    }

    /**
     * Validates WebGL-based proof
     */
    private validateWebGLProof(webglProof: IWebGLProof): boolean {
        // Check for required fields
        if (!webglProof.vendor || !webglProof.renderer || !webglProof.version) {
            return false;
        }

        // Check rendering time (from 50μs to 10ms)
        if (!webglProof.renderTime || webglProof.renderTime < 50 || webglProof.renderTime > 10000) {
            return false;
        }

        // Check pixel hash
        if (!webglProof.pixelHash || !/^[a-f0-9]+$/i.test(webglProof.pixelHash)) {
            return false;
        }

        // Check that vendor/renderer looks realistic
        const validVendors = ['NVIDIA', 'AMD', 'Intel', 'Apple', 'ARM', 'Qualcomm', 'Google', 'Microsoft'];
        const hasValidVendor = validVendors.some(v =>
            webglProof.vendor.includes(v) || webglProof.renderer.includes(v)
        );

        if (!hasValidVendor && !webglProof.renderer.includes('SwiftShader') && !webglProof.renderer.includes('ANGLE')) {
            return false;
        }

        return true;
    }

    /**
     * Validates timing measurement-based proof
     */
    private validateTimingProof(timingProof: ITimingProof): boolean {
        if (!timingProof.measurements || !Array.isArray(timingProof.measurements)) {
            return false;
        }

        if (timingProof.measurements.length < 5) {
            return false;
        }

        // Check measurement reasonability
        const durations = timingProof.measurements.map((m: ITimingMeasurement) => m.duration);
        const avgDuration = durations.reduce((a: number, b: number) => a + b, 0) / durations.length;

        // Average time should be within reasonable limits (from 1μs to 100ms)
        if (avgDuration < 10 || avgDuration > 100000) {
            return false;
        }

        // Check clock resolution
        if (!timingProof.clockResolution || timingProof.clockResolution <= 0) {
            return false;
        }

        return true;
    }

    /**
     * Validates performance-based proof
     */
    private validatePerformanceProof(performanceProof: IPerformanceProof): boolean {
        if (!performanceProof.results || !Array.isArray(performanceProof.results)) {
            return false;
        }

        // Check for all required tests
        const expectedTests = ['object_creation', 'array_sort', 'regex'];
        const actualTests = performanceProof.results.map((r: IPerformanceTestResult) => r.test);

        if (!expectedTests.every(test => actualTests.includes(test))) {
            return false;
        }

        // Check execution time reasonability
        for (const result of performanceProof.results) {
            if (!result.time || result.time < 0 || result.time > 1000000) { // Maximum 1 second
                return false;
            }
        }

        // Check total time
        if (!performanceProof.totalTime || performanceProof.totalTime < 0) {
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
            return false;
        }

        // Check rendering time
        if (!cssProof.renderTime || cssProof.renderTime < 0 || cssProof.renderTime > 50000) {
            return false;
        }

        // Check dimensions
        if (cssProof.computedWidth <= 0 || cssProof.computedHeight <= 0) {
            return false;
        }

        return true;
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
