import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {Log} from '@waf/Log';
import {BrowserProofValidator, IBrowserProofs} from '@waf/UnderAttack/BrowserProofValidator';
import {UnderAttackMetrics} from '@waf/UnderAttack/UnderAttackMetrics';


export interface IFingerprintValidatorConfig {
    enabled: boolean;
    minScore: number
    storeData?: {
        enabled: boolean;
        url?:string
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
     * Validates browser fingerprint and returns authenticity score (0-100)
     * @param fingerprint Browser fingerprint object
     * @param requestId Request ID for logging
     * @param challengeId Challenge ID for cryptographic binding
     * @param proofSalt Salt for cryptographic binding
     * @returns Authenticity score from 0 to 100
     */
    public validate(fingerprint: IBrowserFingerprint, requestId: string, challengeId?: string, proofSalt?: string): boolean {

        if (!this.config.enabled) {
            return true; // If the check is disabled, we always return
        }
        const finalScore = this.calculateScore(fingerprint, requestId);

        this.log.debug('Fingerprint validation score', {finalScore});

        if(this.config.storeData.enabled) {
            this.storeFingerprintData(fingerprint, finalScore, requestId, challengeId);
        }

        return finalScore <= this.config.minScore;
    }

    protected calculateScore(fingerprint: IBrowserFingerprint, requestId: string = ''): number {
        let score = 100;


        // Check for presence of core browser components
        if (!fingerprint.userAgent || !fingerprint.language || !fingerprint.screenResolution) {
            this.log.debug('Missing core browser components', {fingerprint});
            this.metrics?.incrementMissingComponentsFailure();
            score -= 15; // Reduced penalty to improve pass rate for real devices
        }

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
            const isMobile = fingerprint.userAgent?.toLowerCase().includes('mobile') ||
                fingerprint.userAgent?.toLowerCase().includes('iphone') ||
                fingerprint.userAgent?.toLowerCase().includes('android');
            this.log.debug('Missing browser proofs', {requestId: requestId, isMobile});
            this.metrics?.incrementMissingProofsFailure();
            score -= isMobile ? 20 : 40; // Less penalty for mobile devices
        }

        // Smart TV detection and special logging
        const isSmartTV = fingerprint.userAgent?.toLowerCase().includes('smart-tv') ||
            fingerprint.userAgent?.toLowerCase().includes('tizen') ||
            fingerprint.userAgent?.toLowerCase().includes('tv safari') ||
            (fingerprint.userAgent?.toLowerCase().includes('tv') && fingerprint.userAgent?.toLowerCase().includes('samsung')) ||
            (fingerprint.userAgent?.toLowerCase().includes('tv') && fingerprint.userAgent?.toLowerCase().includes('lg')) ||
            ((fingerprint.userAgent?.toLowerCase().includes('android') || fingerprint.userAgent?.toLowerCase().includes('androd')) && fingerprint.userAgent?.toLowerCase().includes('tv'));

        if (isSmartTV) {
            this.log.debug('Detected Smart TV device', {
                userAgent: fingerprint.userAgent,
                resolution: fingerprint.screenResolution
            });

            // For Smart TV we apply special validation rules
            // Smart TVs often have limited browser capabilities
            // and specific display characteristics

            // Reducing the impact of checks that may give false positives
            if (!fingerprint.browserProofs) {
                score -= 10; // Lower penalty for Smart TVs without browser proofs
            }

            // Reducing requirements for Smart TV devices
            if (this.checkScreenAnomalies(fingerprint)) {
                this.log.debug('Detected screen anomalies for Smart TV', {fingerprint});
                score -= 5; // Lower penalty for Smart TV devices
            }

            // Setting a minimum threshold for Smart TV devices
            const finalScore = Math.max(0, Math.min(100, score));
            return Math.max(70, finalScore); // Minimum threshold for Smart TV
        }

        // Check browser fingerprint consistency
        if (this.checkInconsistencies(fingerprint)) {
            this.log.debug('Detected browser fingerprint inconsistencies', {fingerprint});
            this.metrics?.incrementInconsistenciesFailure();
            score -= 20;
        }

        // Check for anomalies in screen fingerprint
        if (this.checkScreenAnomalies(fingerprint)) {
            this.log.debug('Detected screen anomalies', {fingerprint});
            this.metrics?.incrementScreenAnomaliesFailure();
            score -= 15;
        }

        // Check for WebGL or Canvas presence
        // For Smart TVs we do less strict checking, as some models
        // may have limited WebGL/Canvas support
        if (!fingerprint.webglVendor && !fingerprint.canvasFingerprint) {
            this.log.debug('Missing WebGL and Canvas support', {fingerprint});
            if (isSmartTV) {
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
    private checkInconsistencies(fingerprint: IBrowserFingerprint): boolean {
        // Check for inconsistencies between User-Agent and other fingerprint
        const ua = fingerprint.userAgent?.toLowerCase() || '';

        // Check for platform inconsistency
        if (
            (ua.includes('windows') && fingerprint.platform !== 'Win32') ||
            (ua.includes('macintosh') && !fingerprint.platform?.includes('Mac')) ||
            (ua.includes('linux') && !fingerprint.platform?.includes('Linux')) ||
            (ua.includes('tizen') && !fingerprint.platform?.includes('Linux')) ||
            (ua.includes('smart-tv') && !fingerprint.platform?.includes('Linux')) ||
            (ua.includes('androd') && !fingerprint.platform?.includes('Linux')) // Typo in Android device UAs
        ) {
            return true;
        }

        // Check for mobile/desktop inconsistency
        const isMobileUA = ua.includes('mobile') || ua.includes('android');
        const isMobileScreen = fingerprint.screenResolution?.width < 768;


        // Check for tablet inconsistency
        const isTabletUA = ua.includes('ipad') ||
            (ua.includes('android') && !ua.includes('mobile')) ||
            ua.includes('tablet');
        const isTabletScreen = fingerprint.screenResolution &&
            fingerprint.screenResolution.width >= 768 &&
            fingerprint.screenResolution.width <= 1366;


        if (isTabletUA !== isTabletScreen && isMobileUA !== isMobileScreen) {
            return true;
        }

        return false;
    }

    private checkScreenAnomalies(data: IBrowserFingerprint): boolean {
        if (!data.screenResolution) return false;

        const {width, height, colorDepth, pixelDepth} = data.screenResolution;
        const ua = data.userAgent?.toLowerCase() || '';


        // Checking Smart TV devices which have specific screen parameters
        const isSmartTV = ua.includes('smart-tv') ||
            ua.includes('tizen') ||
            ua.includes('tv safari') ||
            (ua.includes('tv') && ua.includes('samsung')) ||
            (ua.includes('tv') && ua.includes('lg')) ||
            (ua.includes('android') && ua.includes('tv'));

        if (isSmartTV) {
            // For Smart TVs we apply special checking rules
            // Typical resolutions for Smart TVs: 1920x1080, 3840x2160, etc.
            if (width === 1920 && height === 1080 && colorDepth >= 24) {
                return false; // Standard Full HD resolution for TV
            }
            if (width === 3840 && height === 2160 && colorDepth >= 24) {
                return false; // Standard 4K resolution for TV
            }
            if (width === 1280 && height === 720 && colorDepth >= 24) {
                return false; // Standard HD resolution for TV
            }

            // For other TV resolutions we do more lenient checking
            if (width >= 1280 && height >= 720 && colorDepth >= 24) {
                return false;
            }
        }

        // Checking Android devices that may have non-standard resolutions
        const isAndroid = ua.includes('android') || ua.includes('androd');
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
        const isMobile = ua.includes('mobile') || ua.includes('android') || ua.includes('iphone');

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

        // Determine device type and characteristics
        const deviceInfo = this.analyzeDeviceType(ua, width, height);

        // For mobile devices we skip some checks that often produce false positives
        if (!isMobile) {
            // Check against known device patterns - only for non-mobile devices
            if (this.checkAgainstKnownDevices(deviceInfo, width, height)) {
                return true;
            }

            // Cross-validate with other fingerprint data - only for non-mobile devices
            if (this.crossValidateScreenData(data, deviceInfo)) {
                return true;
            }
        }

        // Check aspect ratio based on device type
        if (this.checkAspectRatioAnomalies(deviceInfo, width, height)) {
            return true;
        }

        // Check for common automation/headless browser patterns
        if (this.checkAutomationPatterns(deviceInfo, width, height, ua)) {
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

        // Determine a device type with more precision
        let deviceType: 'mobile' | 'tablet' | 'desktop' | 'smarttv' = 'desktop';
        let brand: string | null = null;
        let isIPhone = false;
        let isAndroid = false;
        let isIPad = false;
        let isSmartTV = false;

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
        } else if (ua.includes('smart-tv') || ua.includes('tizen') || ua.includes('tv safari')) {
            deviceType = 'smarttv';
            isSmartTV = true;

            // Detecting TV brand
            if (ua.includes('samsung')) {
                brand = 'Samsung';
            } else if (ua.includes('lg')) {
                brand = 'LG';
            } else if (ua.includes('android')) {
                brand = 'Android TV';
            } else {
                brand = 'Smart TV';
            }
        }

        return {
            type: deviceType,
            brand,
            isIPhone,
            isAndroid,
            isIPad,
            isSmartTV,
            minDimension,
            maxDimension,
            aspectRatio
        };
    }

    private checkAgainstKnownDevices(deviceInfo: IDeviceInfo, width: number, height: number): boolean {
        const {type, brand, isIPhone, isAndroid, isSmartTV, minDimension, maxDimension} = deviceInfo;

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

        if (isSmartTV) {
            // Typical Smart TV resolutions
            const smartTVResolutions = [
                [1280, 720],  // HD
                [1920, 1080], // Full HD
                [3840, 2160], // 4K UHD
                [7680, 4320], // 8K UHD
                [2560, 1440], // QHD
                [3440, 1440]  // Ultrawide QHD
            ];

            const currentRes = [Math.min(width, height), Math.max(width, height)];
            const isKnownRes = smartTVResolutions.some(([w, h]) =>
                (currentRes[0] === Math.min(w, h) && currentRes[1] === Math.max(w, h))
            );

            // If this is not a known Smart TV resolution, check if it's close to known resolutions
            if (!isKnownRes) {
                const hasCloseMatch = smartTVResolutions.some(([w, h]) => {
                    const diffW = Math.abs(currentRes[0] - Math.min(w, h));
                    const diffH = Math.abs(currentRes[1] - Math.max(w, h));
                    return (diffW / Math.min(w, h)) < 0.1 && (diffH / Math.max(w, h)) < 0.1; // 10% tolerance
                });

                if (!hasCloseMatch) {
                    this.log.debug('Unusual resolution for Smart TV', {width, height});
                    return true;
                }
            }

            return false;
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

            case 'smarttv':
                // Smart TVs: typical aspect ratios are 16:9, 21:9 or 4:3
                if (aspectRatio < 1.3 || aspectRatio > 2.4) {
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
            // For Smart TVs these resolutions are quite normal
            if (deviceInfo.type === 'mobile' && isAutomationRes) {
                return true; // Mobile shouldn't have these exact resolutions
            } else if (deviceInfo.isSmartTV && isAutomationRes) {
                // Smart TVs often have standard resolutions, this is not suspicious
                return false;
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

    private crossValidateScreenData(data: IBrowserFingerprint, deviceInfo: IDeviceInfo): boolean {
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

            // Desktop platforms with mobile device screen sizes
            if ((platform.includes('win') || platform.includes('mac')) && deviceInfo.type === 'mobile') {
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

    private storeFingerprintData(fingerprint: IBrowserFingerprint, finalScore: number, requestId: string, challengeId: string) {
        const credentials = Buffer.from(`${this.config.storeData.user}:${this.config.storeData.pass}`).toString('base64');

        // @ts-ignore
        fetch(this.config.storeData.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${credentials}`

            },
            body: JSON.stringify({data: {
                _finalScore: finalScore,
                _requestId: requestId,
                _challengeId: challengeId,
                fingerprint
            }}, null, 2)
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


interface IDeviceInfo {
    type: 'mobile' | 'tablet' | 'desktop' | 'smarttv';
    brand: string | null;
    isIPhone: boolean;
    isAndroid: boolean;
    isIPad: boolean;
    isSmartTV: boolean;
    minDimension: number;
    maxDimension: number;
    aspectRatio: number;
}
