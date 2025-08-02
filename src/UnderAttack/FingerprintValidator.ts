import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {Log} from '@waf/Log';
import {BrowserProofValidator, IBrowserProofs} from '@waf/UnderAttack/BrowserProofValidator';


export interface IFingerprintValidatorConfig {
    enabled: boolean;
    minScore: number
}

export class FingerprintValidator {

    constructor(
        private readonly config: IFingerprintValidatorConfig,
        private readonly browserProofValidator?: BrowserProofValidator,
        private readonly log?: LoggerInterface
    ) {
        if(!browserProofValidator) {
            this.browserProofValidator = new BrowserProofValidator();
        }

        if(!log) {
            this.log = Log.instance.withCategory('app.UnderAttack.FingerprintValidator');
        }

    }

    /**
     * Validates browser fingerprint and returns authenticity score (0-100)
     * @param fingerprint String with browser fingerprint
     * @param data Additional data from client
     * @returns Authenticity score from 0 to 100
     */
    public validate(fingerprint: string, data: IClientFingerprint): number {
        if (!this.config.enabled) {
            return 100; // If the check is disabled, we always return the maximum score
        }

        let score = 100;

        // Check fingerprint length (should be at least 8 characters)
        if (!fingerprint || fingerprint.length < 8) {
            this.log.debug('Fingerprint too short or missing', {fingerprint});
            score -= 30;
        }

        // Check consistency of fingerprint components
        if (data) {
            // Check for presence of core browser components
            if (!data.userAgent || !data.language || !data.screenResolution) {
                this.log.debug('Missing core browser components', {data});
                score -= 20;
            }

            // New check: validation of unforgeable browser proofs
            if (data.browserProofs) {
                const proofScore = this.browserProofValidator.validateBrowserProofs(data.browserProofs);
                this.log.debug('Browser proofs validation score', {proofScore});

                // If proof score is less than overall score, use it
                if (proofScore < score) {
                    score = proofScore;
                }
            } else {
                this.log.debug('Missing browser proofs', {});
                score -= 40; // Serious reduction for missing proof
            }

            // Check browser data consistency
            if (this.checkInconsistencies(data)) {
                this.log.debug('Detected browser data inconsistencies', {data});
                score -= 20;
            }

            // Check for anomalies in screen data
            if (this.checkScreenAnomalies(data)) {
                this.log.debug('Detected screen anomalies', {data});
                score -= 15;
            }

            // Check for WebGL or Canvas presence
            // if (!data.webglVendor && !data.canvasFingerprint) {
            //     this.log.debug('Missing WebGL and Canvas support', {data});
            //     score -= 15;
            // }
        } else {
            // If component data is completely missing, significantly reduce the score
            score -= 50;
        }

        // Ensure the score is within the 0-100 range
        return Math.max(0, Math.min(100, score));
    }

    private checkInconsistencies(data: IClientFingerprint): boolean {
        // Check for inconsistencies between User-Agent and other data
        const ua = data.userAgent?.toLowerCase() || '';

        // Check for platform inconsistency
        if (
            (ua.includes('windows') && data.platform !== 'Win32') ||
            (ua.includes('macintosh') && !data.platform?.includes('Mac')) ||
            (ua.includes('linux') && !data.platform?.includes('Linux'))
        ) {
            return true;
        }

        // Check for mobile/desktop inconsistency
        const isMobileUA = ua.includes('mobile') || ua.includes('android');
        const isMobileScreen = data.screenResolution?.width < 768;

        if (isMobileUA !== isMobileScreen) {
            return true;
        }

        return false;
    }

    private checkScreenAnomalies(data: IClientFingerprint): boolean {
        if (!data.screenResolution) return false;

        const {width, height} = data.screenResolution;

        // Check for unusual screen sizes
        if (width <= 0 || height <= 0 || width > 8000 || height > 8000) {
            return true;
        }

        // Check for non-standard aspect ratio
        const ratio = width / height;
        if (ratio < 0.5 || ratio > 3) {
            return true;
        }

        return false;
    }
}

/**
 * Interface describing client data for browser fingerprint verification
 */
export interface IClientFingerprint {
    /** Browser User-Agent string */
    userAgent?: string;
    /** Browser language */
    language?: string;
    /** Screen resolution */
    screenResolution?: {
        width: number;
        height: number;
        colorDepth?: number;
        pixelDepth?: number;
    };
    /** Platform (operating system) */
    platform?: string;
    /** Whether cookies are enabled in the browser */
    cookiesEnabled?: boolean;
    /** Timezone offset */
    timezone?: number;
    /** Canvas fingerprint */
    canvasFingerprint?: string;
    /** WebGL vendor */
    webglVendor?: string;
    /** WebGL renderer */
    webglRenderer?: string;
    /** Browser plugins information */
    plugins?: Array<{ name: string; description?: string }>;
    /** Browser fonts information */
    fonts?: string[];
    /** Presence of webdriver (for automation detection) */
    webdriver?: boolean;
    /** List of installed extensions */
    extensions?: string[];
    /** Browser proof data for real browser verification */
    browserProofs?: IBrowserProofs;
    /** Proof generation time (for speed verification) */
    proofGenerationTime?: number;
}
