import {IScreenResolution} from "@waf/UnderAttack/FingerprintValidator";

export class ValidateDisplay {

    public static validateIphoneDisplay(screenResolution: IScreenResolution): boolean {
        const {width, height, colorDepth, pixelDepth} = screenResolution;

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
            // iPhone 12 mini, 13 mini
            [375, 812], [1080, 2340],
            // iPhone 12, 12 Pro, 13, 13 Pro
            [390, 844], [1170, 2532],
            // iPhone 12 Pro Max, 13 Pro Max
            [428, 926], [1284, 2778],
            // iPhone 14
            [390, 844], [1170, 2532],
            // iPhone 14 Plus
            [428, 926], [1284, 2778],
            // iPhone 14 Pro
            [393, 852], [1179, 2556],
            // iPhone 14 Pro Max
            [430, 932], [1290, 2796],
            // iPhone 15, 15 Pro
            [393, 852], [1179, 2556],
            // iPhone 15 Plus, 15 Pro Max
            [430, 932], [1290, 2796],
            // iPhone 16
            [393, 852], [1179, 2556],
            // iPhone 16 Plus
            [430, 932], [1290, 2796],
            // iPhone 16 Pro
            [402, 874], [1206, 2622],
            // iPhone 16 Pro Max
            [440, 956], [1320, 2868]
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
                return false;
            }
        }
        return true;
    }

    public static validateSmartTVDisplay(screenResolution: IScreenResolution): boolean {
        const {width, height, colorDepth, pixelDepth} = screenResolution;

        // For Smart TVs we apply special checking rules
        // Typical resolutions for Smart TVs: 1920x1080, 3840x2160, etc.
        if (width === 1920 && height === 1080 && colorDepth >= 24) {
            return true; // Standard Full HD resolution for TV
        }
        if (width === 3840 && height === 2160 && colorDepth >= 24) {
            return true; // Standard 4K resolution for TV
        }
        if (width === 1280 && height === 720 && colorDepth >= 24) {
            return true; // Standard HD resolution for TV
        }

        // For other TV resolutions we do more lenient checking
        if (width >= 1280 && height >= 720 && colorDepth >= 24) {
            return true;
        }

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
                return false;
            }
        }

        return true;

    }



}
