import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {Log} from '@waf/Log';
import {BrowserProofValidator, IBrowserProofs} from '@waf/UnderAttack/BrowserProofValidator';
import {UnderAttackMetrics} from '@waf/UnderAttack/UnderAttackMetrics';
import {Metrics} from "@waf/Metrics/Metrics";


export interface IFingerprintValidatorConfig {
    enabled: boolean;
    minScore: number
}

export class FingerprintValidator {

    constructor(
        private readonly config: IFingerprintValidatorConfig,
        private readonly browserProofValidator?: BrowserProofValidator,
        private readonly metrics?: UnderAttackMetrics,
        private readonly log?: LoggerInterface
    ) {
        if(!browserProofValidator) {
            this.browserProofValidator = new BrowserProofValidator();
        }

        if(!log) {
            this.log = Log.instance.withCategory('app.UnderAttack.FingerprintValidator');
        }

        if(!metrics) {
            this.metrics = UnderAttackMetrics.get();
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
            this.metrics?.incrementShortFingerprintFailure();
            score -= 30;
        }

        // Check consistency of fingerprint components
        if (data) {
            // Check for presence of core browser components
            if (!data.userAgent || !data.language || !data.screenResolution) {
                this.log.debug('Missing core browser components', {data});
                this.metrics?.incrementMissingComponentsFailure();
                score -= 20;
            }

            // New check: validation of unforgeable browser proofs
            if (data.browserProofs) {
                const proofScore = this.browserProofValidator.validateBrowserProofs(
                    data.browserProofs,
                    data.requestId,
                    data.userAgent  // Pass userAgent to determine mobile device
                );
                this.log.debug('Browser proofs validation score', {proofScore});

                // If proof score is less than overall score, use it
                if (proofScore < score) {
                    score = proofScore;
                }
            } else {
                const isMobile = data.userAgent?.toLowerCase().includes('mobile') ||
                    data.userAgent?.toLowerCase().includes('iphone') ||
                    data.userAgent?.toLowerCase().includes('android');
                this.log.debug('Missing browser proofs', {requestId: data.requestId, isMobile});
                this.metrics?.incrementMissingProofsFailure();
                score -= isMobile ? 20 : 40; // Less penalty for mobile devices
            }

            // Check browser data consistency
            if (this.checkInconsistencies(data)) {
                this.log.debug('Detected browser data inconsistencies', {data});
                this.metrics?.incrementInconsistenciesFailure();
                score -= 20;
            }

            // Check for anomalies in screen data
            if (this.checkScreenAnomalies(data)) {
                this.log.debug('Detected screen anomalies', {data});
                this.metrics?.incrementScreenAnomaliesFailure();
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
        const finalScore = Math.max(0, Math.min(100, score));

        // Record the rating in the metric
        this.metrics?.recordFingerprintScore(finalScore);

        return finalScore;
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

        const {width, height, colorDepth, pixelDepth} = data.screenResolution;
        const ua = data.userAgent?.toLowerCase() || '';

        // Basic validation - invalid dimensions
        if (width <= 0 || height <= 0 || width > 8000 || height > 8000) {
            return true;
        }

        // Check color depth and pixel depth consistency
        if (this.checkColorDepthAnomalies(colorDepth, pixelDepth)) {
            return true;
        }

        // Determine device type and characteristics
        const deviceInfo = this.analyzeDeviceType(ua, width, height);

        // Check against known device patterns
        if (this.checkAgainstKnownDevices(deviceInfo, width, height)) {
            return true;
        }

        // Check aspect ratio based on device type
        if (this.checkAspectRatioAnomalies(deviceInfo, width, height)) {
            return true;
        }

        // Check for common automation/headless browser patterns
        if (this.checkAutomationPatterns(deviceInfo, width, height, ua)) {
            return true;
        }

        // Cross-validate with other fingerprint data
        if (this.crossValidateScreenData(data, deviceInfo)) {
            return true;
        }

        return false;
    }

    private checkColorDepthAnomalies(colorDepth?: number, pixelDepth?: number): boolean {
        // Color depth should be realistic for modern devices
        if (colorDepth !== undefined) {
            const validColorDepths = [8, 16, 24, 32, 48];
            if (!validColorDepths.includes(colorDepth)) {
                return true;
            }
        }

        // Pixel depth should match or be related to color depth
        if (pixelDepth !== undefined && colorDepth !== undefined) {
            // Common valid combinations
            const validCombinations = [
                [8, 8], [16, 16], [24, 24], [24, 32], [32, 32], [48, 48]
            ];

            const isValidCombo = validCombinations.some(([cd, pd]) =>
                cd === colorDepth && pd === pixelDepth
            );

            if (!isValidCombo) {
                return true;
            }
        }

        return false;
    }

    private analyzeDeviceType(ua: string, width: number, height: number): IDeviceInfo {
        const minDimension = Math.min(width, height);
        const maxDimension = Math.max(width, height);
        const aspectRatio = maxDimension / minDimension;

        // Determine device type with more precision
        let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
        let brand: string | null = null;
        let isIPhone = false;
        let isAndroid = false;
        let isIPad = false;

        if (ua.includes('iphone')) {
            deviceType = 'mobile';
            brand = 'Apple';
            isIPhone = true;
        } else if (ua.includes('ipad')) {
            deviceType = 'tablet';
            brand = 'Apple';
            isIPad = true;
        } else if (ua.includes('android')) {
            isAndroid = true;
            // Distinguish between Android phone and tablet by screen size
            if (minDimension >= 600 && aspectRatio < 2.0) {
                deviceType = 'tablet';
            } else {
                deviceType = 'mobile';
            }
            brand = 'Android';
        } else if (ua.includes('mobile')) {
            deviceType = 'mobile';
        } else if (ua.includes('tablet')) {
            deviceType = 'tablet';
        }

        return {
            type: deviceType,
            brand,
            isIPhone,
            isAndroid,
            isIPad,
            minDimension,
            maxDimension,
            aspectRatio
        };
    }

    private checkAgainstKnownDevices(deviceInfo: IDeviceInfo, width: number, height: number): boolean {
        const {type, brand, isIPhone, isAndroid, minDimension, maxDimension} = deviceInfo;

        if (isIPhone) {
            // Known iPhone resolutions (including different pixel densities)
            const iPhoneResolutions = [
                // iPhone SE, 5, 5s, 5c
                [320, 568], [640, 1136],
                // iPhone 6, 6s, 7, 8, SE 2nd/3rd gen
                [375, 667], [750, 1334],
                // iPhone 6+, 6s+, 7+, 8+
                [414, 736], [1242, 2208], [1080, 1920],
                // iPhone X, XS, 11 Pro
                [375, 812], [1125, 2436],
                // iPhone XR, 11
                [414, 896], [828, 1792],
                // iPhone XS Max, 11 Pro Max
                [414, 896], [1242, 2688],
                // iPhone 12 mini
                [375, 812], [1080, 2340],
                // iPhone 12, 12 Pro
                [390, 844], [1170, 2532],
                // iPhone 12 Pro Max
                [428, 926], [1284, 2778],
                // iPhone 13 mini
                [375, 812], [1080, 2340],
                // iPhone 13, 13 Pro
                [390, 844], [1170, 2532],
                // iPhone 13 Pro Max
                [428, 926], [1284, 2778],
                // iPhone 14, 14 Plus, 14 Pro, 14 Pro Max
                [393, 852], [430, 932], [1179, 2556], [1290, 2796]
            ];

            const currentRes = [Math.min(width, height), Math.max(width, height)];
            const isKnownRes = iPhoneResolutions.some(([w, h]) =>
                (currentRes[0] === w && currentRes[1] === h)
            );

            // If it's not a known iPhone resolution, it's suspicious
            if (!isKnownRes) {
                // Allow some tolerance for zoom or custom resolutions
                const hasCloseMatch = iPhoneResolutions.some(([w, h]) => {
                    const diffW = Math.abs(currentRes[0] - w);
                    const diffH = Math.abs(currentRes[1] - h);
                    return diffW <= 10 && diffH <= 20; // Small tolerance
                });

                if (!hasCloseMatch) {
                    return true;
                }
            }
        }

        if (isAndroid) {
            // Android devices have more variety, but check for reasonable ranges
            if (type === 'mobile') {
                // Android phone reasonable ranges
                if (minDimension < 240 || minDimension > 500 ||
                    maxDimension < 400 || maxDimension > 1000) {
                    return true;
                }
            } else if (type === 'tablet') {
                // Android tablet reasonable ranges
                if (minDimension < 600 || minDimension > 1200 ||
                    maxDimension < 800 || maxDimension > 2000) {
                    return true;
                }
            }
        }

        if (type === 'desktop') {
            // Desktop minimum reasonable sizes
            if (minDimension < 640 || maxDimension < 800) {
                return true;
            }

            // Check for common automation resolutions that are suspicious
            const suspiciousDesktopRes = [
                [800, 600], [1024, 768], [1280, 720], [1920, 1080]
            ];

            const currentRes = [width, height].sort((a, b) => a - b);
            const isSuspiciousRes = suspiciousDesktopRes.some(([w, h]) =>
                currentRes[0] === Math.min(w, h) && currentRes[1] === Math.max(w, h)
            );

            // These are common but when combined with other factors can be suspicious
            return false; // Don't flag these alone, let other checks handle it
        }

        return false;
    }

    private checkAspectRatioAnomalies(deviceInfo: IDeviceInfo, width: number, height: number): boolean {
        const {type, aspectRatio} = deviceInfo;

        switch (type) {
            case 'mobile':
                // Mobile devices: from square-ish (old phones) to very tall (modern phones)
                if (aspectRatio < 1.2 || aspectRatio > 2.5) {
                    return true;
                }
                break;

            case 'tablet':
                // Tablets: typically between 4:3 and 16:10
                if (aspectRatio < 1.25 || aspectRatio > 1.8) {
                    return true;
                }
                break;

            case 'desktop':
                // Desktop: from 4:3 to ultra-wide monitors
                if (aspectRatio < 0.75 || aspectRatio > 4.0) {
                    return true;
                }
                break;
        }

        return false;
    }

    private checkAutomationPatterns(deviceInfo: IDeviceInfo, width: number, height: number, ua: string): boolean {
        // Common headless/automation browser resolutions
        const automationResolutions = [
            [400, 400], [800, 600], [1024, 768], [1280, 1024],
            [1366, 768], [1440, 900], [1680, 1050], [1920, 1080]
        ];

        const currentRes = [Math.min(width, height), Math.max(width, height)];
        const isAutomationRes = automationResolutions.some(([w, h]) =>
            currentRes[0] === Math.min(w, h) && currentRes[1] === Math.max(w, h)
        );

        if (isAutomationRes) {
            // Check if UA suggests it's headless
            const headlessIndicators = ['headless', 'phantom', 'selenium', 'webdriver'];
            const hasHeadlessUA = headlessIndicators.some(indicator =>
                ua.includes(indicator.toLowerCase())
            );

            if (hasHeadlessUA) {
                return true;
            }

            // Perfect common resolutions can be suspicious for certain device types
            if (deviceInfo.type === 'mobile' && isAutomationRes) {
                return true; // Mobile shouldn't have these exact resolutions
            }
        }

        // Check for impossibly perfect aspect ratios that suggest emulation
        const perfectRatios = [1.0, 1.25, 1.33, 1.5, 1.6, 1.77, 2.0];
        const currentRatio = Math.round(deviceInfo.aspectRatio * 100) / 100;

        if (perfectRatios.includes(currentRatio) && deviceInfo.type === 'mobile') {
            // Real mobile devices rarely have perfect mathematical ratios
            return true;
        }

        return false;
    }

    private crossValidateScreenData(data: IClientFingerprint, deviceInfo: IDeviceInfo): boolean {
        const ua = data.userAgent?.toLowerCase() || '';

        // Check consistency between screen size and platform
        if (data.platform) {
            const platform = data.platform.toLowerCase();

            // iOS devices should have specific screen characteristics
            if (platform.includes('iphone') && !deviceInfo.isIPhone) {
                return true;
            }

            // Android platform mismatch
            if ((platform.includes('android') || platform.includes('linux armv')) && !deviceInfo.isAndroid) {
                return true;
            }

            // Desktop platforms with mobile screen sizes
            if ((platform.includes('win') || platform.includes('mac') || platform.includes('linux'))
                && deviceInfo.type === 'mobile') {
                return true;
            }
        }

        // Check timezone consistency (basic check)
        if (data.timezone !== undefined) {
            // This is a basic check - real implementation might be more sophisticated
            const timezoneOffset = Math.abs(data.timezone);
            if (timezoneOffset > 720) { // More than 12 hours is impossible
                return true;
            }
        }

        return false;
    }

}

/**
 * Interface describing client data for browser fingerprint verification
 */
export interface IClientFingerprint {
    requestId: string;
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

interface IDeviceInfo {
    type: 'mobile' | 'tablet' | 'desktop';
    brand: string | null;
    isIPhone: boolean;
    isAndroid: boolean;
    isIPad: boolean;
    minDimension: number;
    maxDimension: number;
    aspectRatio: number;
}
