import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {Log} from '@waf/Log';
import {BrowserProofValidator, IBrowserProofs} from '@waf/UnderAttack/BrowserProofValidator';
import {UnderAttackMetrics} from '@waf/UnderAttack/UnderAttackMetrics';
import {DeviceDetector, DeviceInfo} from "@waf/UnderAttack/Utils/DeviceDetector";
import {ValidateDisplay} from "@waf/UnderAttack/Utils/ValidateDisplay";


export interface IFingerprintValidatorConfig {
    enabled: boolean;
    minScore: number
    storeData?: {
        enabled: boolean;
        url?: string
        user?: string
        pass?: string

    }
}

export class FingerprintValidator {

    constructor(
        private readonly config: IFingerprintValidatorConfig,
        private readonly browserProofValidator?: BrowserProofValidator,
        private readonly metrics?: UnderAttackMetrics,
        private readonly log?: LoggerInterface
    ) {
        if (!browserProofValidator) {
            this.browserProofValidator = new BrowserProofValidator();
        }

        if (!log) {
            this.log = Log.instance.withCategory('app.UnderAttack.FingerprintValidator');
        }

        if (!metrics) {
            this.metrics = UnderAttackMetrics.get();
        }

    }

    /**
     * Validates browser fingerprint and determines if it passes the authenticity threshold
     * @param fingerprint Browser fingerprint object
     * @param requestId Request ID for logging
     * @param challengeId Challenge ID for cryptographic binding
     * @param proofSalt Salt for cryptographic binding
     * @returns True if fingerprint passes validation, false otherwise
     */
    public validate(fingerprint: IBrowserFingerprint, requestId: string, challengeId?: string, proofSalt?: string): boolean {

        if (!this.config.enabled) {
            return true; // If the check is disabled, we always return
        }
        const finalScore = this.calculateScore(fingerprint, requestId);

        this.log.debug('Fingerprint validation score', {finalScore});

        if (this.config.storeData.enabled) {
            this.storeFingerprintData(fingerprint, finalScore, requestId, challengeId);
        }

        return finalScore <= this.config.minScore;
    }

    /**
     * Calculates the authenticity score for a browser fingerprint
     * @param fingerprint The complete fingerprint data
     * @param requestId Request ID for logging purposes
     * @returns Authenticity score from 0 to 100
     */
    protected calculateScore(fingerprint: IBrowserFingerprint, requestId: string = ''): number {
        let score = 100;


        // Check for presence of core browser components
        if (!fingerprint.userAgent || !fingerprint.language || !fingerprint.screenResolution) {
            this.log.debug('Missing core browser components', {fingerprint});
            this.metrics?.incrementMissingComponentsFailure();
            score -= 15; // Reduced penalty to improve the pass rate for real devices
        }

        // Analyze device type once
        const deviceInfo: DeviceInfo = DeviceDetector.parse(fingerprint.userAgent, fingerprint.screenResolution.width, fingerprint.screenResolution.height);

        const isMobile = deviceInfo.isMobile();


        // New check: validation of unforgeable browser proofs
        if (fingerprint.browserProofs) {
            const proofScore = this.browserProofValidator.validateBrowserProofs(
                fingerprint.browserProofs,
                requestId,
                fingerprint.userAgent,  // Pass userAgent to determine mobile device
                'challengeId',
                'proofSalt'   // Pass challenge fingerprint for proof binding
            );
            this.log.debug('Browser proofs validation score', {proofScore});

            // If proof score is less than overall score, use it
            if (proofScore < score) {
                score = proofScore;
            }
        } else {
            this.log.debug('Missing browser proofs', {requestId: requestId, isMobile});
            this.metrics?.incrementMissingProofsFailure();
            score -= isMobile ? 20 : 40; // Less penalty for mobile devices
        }

        // Detected Smart TV earlier using browserProofValidator
        if (deviceInfo.isSmartTV()) {

            // For Smart TV we apply special validation rules
            // Smart TVs often have limited browser capabilities
            // and specific display characteristics

            // Reducing the impact of checks that may give false positives
            if (!fingerprint.browserProofs) {
                score -= 10; // Lower penalty for Smart TVs without browser proofs
            }

            // Reducing requirements for Smart TV devices
            if (this.checkScreenAnomalies(fingerprint, deviceInfo)) {
                this.log.debug('Detected screen anomalies for Smart TV', {fingerprint});
                score -= 5; // Lower penalty for Smart TV devices
            }

            // Setting a minimum threshold for Smart TV devices
            const finalScore = Math.max(0, Math.min(100, score));
            return Math.max(70, finalScore); // Minimum threshold for Smart TV
        }

        // Check browser fingerprint consistency
        if (this.checkInconsistencies(fingerprint, deviceInfo)) {
            this.log.debug('Detected browser fingerprint inconsistencies', {fingerprint});
            this.metrics?.incrementInconsistenciesFailure();
            score -= 20;
        }

        // Check for anomalies in the screen fingerprint
        if (this.checkScreenAnomalies(fingerprint, deviceInfo)) {
            this.log.debug('Detected screen anomalies', {fingerprint});
            this.metrics?.incrementScreenAnomaliesFailure();
            score -= 15;
        }

        // Check for WebGL or Canvas presence
        // For Smart TVs we do less strict checking, as some models
        // may have limited WebGL/Canvas support
        if (!fingerprint.webglVendor && !fingerprint.canvasFingerprint) {
            this.log.debug('Missing WebGL and Canvas support', {fingerprint});
            if (deviceInfo.isSmartTV()) {
                score -= 5; // Less score reduction for Smart TVs
            } else {
                score -= 15;
            }
        }


        // Ensure the score is within the 0-100 range
        const finalScore = Math.max(0, Math.min(100, score));

        // Record the rating in the metric
        this.metrics?.recordFingerprintScore(finalScore);

        return finalScore;

    }

    /**
     * Checks for inconsistencies between fingerprint properties
     * @param fingerprint The complete fingerprint data
     * @param deviceInfo Optional pre-analyzed device information
     * @returns True if inconsistencies detected, false otherwise
     */
    private checkInconsistencies(fingerprint: IBrowserFingerprint, deviceInfo: DeviceInfo): boolean {
        // Check for inconsistencies between User-Agent and another fingerprint
        const ua = fingerprint.userAgent?.toLowerCase() || '';

        // Check for platform inconsistency
        if (
            (ua.includes('windows') && fingerprint.platform !== 'Win32') ||
            (ua.includes('macintosh') && !fingerprint.platform?.includes('Mac')) ||
            (ua.includes('linux') && !fingerprint.platform?.includes('Linux')) ||
            (deviceInfo.isSmartTV() && !fingerprint.platform?.includes('Linux')) ||
            (deviceInfo.isAndroid() && !fingerprint.platform?.includes('Linux')) // Including typo in Android device UAs
        ) {
            return true;
        }

        // Check for mobile/desktop inconsistency
        const isMobileUA = deviceInfo.isMobile();
        const isMobileScreen = fingerprint.screenResolution?.width < 768;


        // Check for tablet inconsistency
        const isTabletUA = deviceInfo.isTablet();
        const isTabletScreen = fingerprint.screenResolution &&
            fingerprint.screenResolution.width >= 768 &&
            fingerprint.screenResolution.width <= 1366;


        if (isTabletUA !== isTabletScreen && isMobileUA !== isMobileScreen) {
            return true;
        }

        return false;
    }

    /**
     * Checks for anomalies in screen resolution and related properties
     * @param data The complete fingerprint data
     * @param deviceInfo Optional pre-analyzed device information
     * @returns True if anomalies detected, false otherwise
     */
    private checkScreenAnomalies(data: IBrowserFingerprint, deviceInfo: DeviceInfo): boolean {
        if (!data.screenResolution) return false;

        const {width, height, colorDepth, pixelDepth} = data.screenResolution;
        const ua = data.userAgent?.toLowerCase() || '';

        // Используем isSmartTV из параметра deviceInfo
        if (deviceInfo.isSmartTV()) {
            return !ValidateDisplay.validateSmartTVDisplay(data.screenResolution);
        }

        if (deviceInfo.isIPhone()) {
            return !ValidateDisplay.validateIphoneDisplay(data.screenResolution)
        }

        // Checking Android devices that may have non-standard resolutions
        const isAndroid = deviceInfo.isAndroid();
        if (isAndroid) {
            // Typical resolutions for Android tablets
            if ((width === 1280 && height === 800) || // Common tablet resolution
                (width === 1024 && height === 600) ||
                (width === 1024 && height === 768) ||
                (width === 1280 && height === 720) ||
                (width === 1920 && height === 1080) ||
                (width === 1920 && height === 1200) ||
                (width === 2560 && height === 1440) ||
                (width === 2560 && height === 1600)) {
                if (colorDepth >= 24) {
                    return false; // Standard resolution with normal color depth
                }
            }

            // For other Android device resolutions we do more lenient checking
            if (width >= 800 && height >= 600 && colorDepth >= 16) {
                return false;
            }
        }

        // Determine if it's a mobile device
        const isMobile = deviceInfo.isMobile();

        // Basic validation - invalid dimensions (making checks more flexible for mobile devices)
        if (width <= 0 || height <= 0 ||
            (!isMobile && width > 8000) || (!isMobile && height > 8000) ||
            (isMobile && width > 3000) || (isMobile && height > 3000)) {
            return true;
        }

        // Check color depth and pixel depth consistency
        if (this.checkColorDepthAnomalies(colorDepth, pixelDepth)) {
            return true;
        }

        // For mobile devices we skip some checks that often produce false positives
        if (isMobile) {
            // Check against known device patterns - only for non-mobile devices
            if (this.checkAgainstKnownDevices(deviceInfo, data.screenResolution)) {
                return true;
            }

            // Cross-validate with other fingerprint data - only for non-mobile devices
            if (this.crossValidateScreenData(data, deviceInfo)) {
                return true;
            }
        }

        // Check an aspect ratio based on a device type
        if (this.checkAspectRatioAnomalies(deviceInfo, width, height)) {
            return true;
        }

        // Check for common automation/headless browser patterns
        if (this.checkAutomationPatterns(deviceInfo, width, height, ua)) {
            return true;
        }

        return false;
    }

    /**
     * Checks if color depth and pixel depth values are valid and consistent
     * @param colorDepth The reported color depth
     * @param pixelDepth The reported pixel depth
     * @returns True if anomalies detected, false otherwise
     */
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

    /**
     * Validates screen dimensions against known device specifications
     * @param deviceInfo The analyzed device information
     * @param width Screen width
     * @param height Screen height
     * @returns True if device dimensions are suspicious, false otherwise
     */
    private checkAgainstKnownDevices(deviceInfo: DeviceInfo, screenResolution: IScreenResolution,): boolean {
        // const {type, brand, isIPhone, isAndroid, isSmartTV, minDimension, maxDimension} = screenResolution;


        if (deviceInfo.isAndroid()) {
            // Android devices have more variety, but check for reasonable ranges
            if (deviceInfo.isMobile()) {
                // Android phone reasonable ranges
                if (deviceInfo.minDimension < 240 || deviceInfo.minDimension > 500 ||
                    deviceInfo.maxDimension < 400 || deviceInfo.maxDimension > 1000) {
                    return true;
                }
            } else if (deviceInfo.isTouchDevice()) {
                // Android tablet reasonable ranges
                if (deviceInfo.minDimension < 600 || deviceInfo.minDimension > 1200 ||
                    deviceInfo.maxDimension < 800 || deviceInfo.maxDimension > 2000) {
                    return true;
                }
            }
        }

        if (deviceInfo.isDesktop()) {
            // Desktop minimum reasonable sizes
            if (deviceInfo.minDimension < 640 || deviceInfo.maxDimension < 800) {
                return true;
            }

            // These are common but when combined with other factors can be suspicious
            return false; // Don't flag these alone, let other checks handle it
        }

        return false;
    }

    /**
     * Checks if the aspect ratio is anomalous for the given device type
     * @param deviceInfo The analyzed device information
     * @param width Screen width
     * @param height Screen height
     * @returns True if aspect ratio is anomalous, false otherwise
     */
    private checkAspectRatioAnomalies(deviceInfo: DeviceInfo, width: number, height: number): boolean {

        switch (true) {
            case deviceInfo.isMobile():
                // Mobile devices: from square-ish (old phones) to very tall (modern phones)
                if (deviceInfo.aspectRatio < 1.2 || deviceInfo.aspectRatio > 2.5) {
                    return true;
                }
                break;

            case deviceInfo.isTablet():
                // Tablets: typically between 4:3 and 16:10
                if (deviceInfo.aspectRatio < 1.25 || deviceInfo.aspectRatio > 1.8) {
                    return true;
                }
                break;

            case deviceInfo.isSmartTV():
                // Smart TVs: typical aspect ratios are 16:9, 21:9 or 4:3
                if (deviceInfo.aspectRatio < 1.3 || deviceInfo.aspectRatio > 2.4) {
                    return true;
                }
                break;

            case deviceInfo.isDesktop():
                // Desktop: from 4:3 to ultra-wide monitors
                if (deviceInfo.aspectRatio < 0.75 || deviceInfo.aspectRatio > 4.0) {
                    return true;
                }
                break;
        }

        return false;
    }

    /**
     * Checks for patterns typical of automated browsers or emulated environments
     * @param deviceInfo The analyzed device information
     * @param width Screen width
     * @param height Screen height
     * @param ua User agent string
     * @returns True if automation patterns detected, false otherwise
     */
    private checkAutomationPatterns(deviceInfo: DeviceInfo, width: number, height: number, ua: string): boolean {
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
            // For Smart TVs these resolutions are quite normal
            if (deviceInfo.isMobile()) {
                return true; // Mobile shouldn't have these exact resolutions
            } else if (deviceInfo.isSmartTV() && isAutomationRes) {
                // Smart TVs often have standard resolutions, this is not suspicious
                return false;
            }
        }

        // Check for impossibly perfect aspect ratios that suggest emulation
        const perfectRatios = [1.0, 1.25, 1.33, 1.5, 1.6, 1.77, 2.0];
        const currentRatio = Math.round(deviceInfo.aspectRatio * 100) / 100;

        if (perfectRatios.includes(currentRatio) && deviceInfo.isMobile()) {
            // Real mobile devices rarely have perfect mathematical ratios
            return true;
        }

        return false;
    }

    /**
     * Cross-validates screen data with other fingerprint properties
     * @param data The complete fingerprint data
     * @param deviceInfo The analyzed device information
     * @returns True if inconsistencies detected, false otherwise
     */
    private crossValidateScreenData(data: IBrowserFingerprint, deviceInfo: DeviceInfo): boolean {
        const ua = data.userAgent?.toLowerCase() || '';

        // Check consistency between screen size and platform
        if (data.platform) {
            const platform = data.platform.toLowerCase();

            // iOS devices should have specific screen characteristics
            if (platform.includes('iphone') && !deviceInfo.isIPhone()) {
                return true;
            }

            // Android platform mismatch
            if ((platform.includes('android') || platform.includes('linux armv')) && !deviceInfo.isAndroid) {
                return true;
            }

            // Desktop platforms with mobile device screen sizes
            if ((platform.includes('win') || platform.includes('mac')) && deviceInfo.isMobile()) {
                return true;
            }

            // Smart TV checks
            if (ua.includes('smart-tv') || ua.includes('tizen') || ua.includes('tv safari')) {
                // Smart TV should have a Linux platform
                if (!platform.includes('linux')) {
                    return true;
                }

                // Check if screen dimensions are appropriate
                if (deviceInfo.minDimension < 720 || deviceInfo.maxDimension < 1280) {
                    // Resolution too small for a Smart TV
                    return true;
                }
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

    /**
     * Stores fingerprint data on external storage for analysis
     * @param fingerprint The complete fingerprint data
     * @param finalScore The calculated authenticity score
     * @param requestId Request identifier
     * @param challengeId Challenge identifier
     */
    private storeFingerprintData(fingerprint: IBrowserFingerprint, finalScore: number, requestId: string, challengeId: string) {
        const credentials = Buffer.from(`${this.config.storeData.user}:${this.config.storeData.pass}`).toString('base64');

        // @ts-ignore
        fetch(this.config.storeData.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${credentials}`

            },
            body: JSON.stringify({
                data: {
                    _finalScore: finalScore,
                    _requestId: requestId,
                    _challengeId: challengeId,
                    fingerprint
                }
            }, null, 2)
        })
            .then(res => res.json()).then(data => {
            delete data.data;
            this.log.debug('Fingerprint data sent successfully', data);
        })
            .catch(error => {
                this.log.error('Failed to send fingerprint data', error);
            });

    }
}


export interface IScreenResolution {
    width: number;
    height: number;
    colorDepth: number;
    pixelDepth: number;
}

export interface ICanvasFingerprint {
    winding: boolean;
}

export interface IMimeType {
    type: string;
    suffixes: string;
}

export interface IPlugin {
    name: string;
    description: string;
    mimeTypes: IMimeType[];
}

export interface IBrowserFingerprint {
    userAgent: string;
    language: string;
    languages: string[];
    platform: string;
    cookiesEnabled: boolean;
    screenResolution: IScreenResolution;
    timezone: number;
    canvasFingerprint: ICanvasFingerprint;
    webglVendor: string;
    plugins: IPlugin[];
    fonts: string[];
    webdriver: boolean;
    extensions: any[];
    browserProofs: IBrowserProofs;
}
