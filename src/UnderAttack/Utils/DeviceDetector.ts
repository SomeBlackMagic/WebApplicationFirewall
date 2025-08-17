export type DeviceType =
    | 'desktop'
    | 'mobile'
    | 'tablet'
    | 'bot'
    | 'tv'
    | 'console'
    | 'unknown';

export class DeviceInfo {
    constructor(
        public readonly raw: string,
        public readonly browser: { name: string; version: string | null },
        public readonly engine: { name: string; version: string | null },
        public readonly os: { name: string; version: string | null },
        public readonly device: { type: DeviceType; vendor: string | null; model: string | null },
        public readonly cpu: { architecture: string | null },
        public readonly minDimension: number,
        public readonly maxDimension: number,
        public readonly aspectRatio: number,
    ) {}

    isMobile(): boolean {
        return this.device.type === 'mobile';
    }

    isTablet(): boolean {
        return this.device.type === 'tablet';
    }

    isDesktop(): boolean {
        return this.device.type === 'desktop';
    }

    isBot(): boolean {
        return this.device.type === 'bot';
    }

    isTouchDevice(): boolean {
        return this.isMobile() || this.isTablet();
    }

    isSmartTV(): boolean {
        return this.device.type === 'tv';
    }

    isIPhone(): boolean {
        return this.device.vendor === 'Apple' && this.device.model === 'iPhone';
    }

    isAndroid(): boolean {
        return this.os.name === 'Android';
    }

}

export class DeviceDetector {
    private static cap(input: RegExpMatchArray | null, idx = 1): string | null {
        return input && input[idx] ? input[idx] : null;
    }

    private static normVer(v: string | null): string | null {
        return v ? v.replace(/_/g, '.') : null;
    }

    private static parseBrowser(ua: string): { name: string; version: string | null } {
        const pairs: Array<[string, RegExp]> = [
            ['Edge', /\bEdgA?i?OS?\/([\d.]+)/],
            ['Opera', /\bOPR\/([\d.]+)/],
            ['Samsung Internet', /\bSamsungBrowser\/([\d.]+)/],
            ['Yandex', /\bYaBrowser\/([\d.]+)/],
            ['Brave', /\bBrave\/([\d.]+)/],
            ['Chrome', /\b(?:Chrome|CriOS)\/([\d.]+)/],
            ['Firefox', /\b(?:Firefox|FxiOS)\/([\d.]+)/],
            ['Safari', /\bVersion\/([\d.]+)\s+Safari\/[\d.]+/],
            ['Safari', /\bSafari\/([\d.]+)/],
        ];
        for (const [name, re] of pairs) {
            const m = ua.match(re);
            if (m) return { name, version: this.cap(m) };
        }
        return { name: 'Unknown', version: null };
    }

    private static parseEngine(ua: string, browserName: string): { name: string; version: string | null } {
        const webkit = ua.match(/\bAppleWebKit\/([\d.]+)/);
        const gecko = ua.match(/\bGecko\/([\d.]+)/);
        const presto = ua.match(/\bPresto\/([\d.]+)/);

        if (gecko && /\bFirefox|FxiOS/.test(ua)) return { name: 'Gecko', version: this.cap(gecko) };
        if (webkit) {
            if (/(?:Chrome|CriOS|OPR|Edg|SamsungBrowser|YaBrowser)/.test(ua)) {
                return { name: 'Blink', version: this.cap(webkit) };
            }
            return { name: 'WebKit', version: this.cap(webkit) };
        }
        if (presto) return { name: 'Presto', version: this.cap(presto) };
        return { name: 'Unknown', version: null };
    }

    private static parseOS(ua: string): { name: string; version: string | null } {
        const win = ua.match(/\bWindows NT ([\d.]+)/);
        if (win) return { name: 'Windows', version: this.cap(win) };

        const android = ua.match(/\bAndroid ([\d.]+)/);
        if (android) return { name: 'Android', version: this.cap(android) };

        const ios = ua.match(/\b(?:CPU (?:iPhone )?OS|iOS) (\d+[_\.\d]*)\b/);
        if (ios) return { name: 'iOS', version: this.normVer(this.cap(ios)) };

        const mac = ua.match(/\bMac OS X (\d+[_\.\d]*)\b/);
        if (mac) return { name: 'macOS', version: this.normVer(this.cap(mac)) };

        const cros = ua.match(/\bCrOS [\w-]+ (\d+[\.\d]*)\b/);
        if (cros) return { name: 'ChromeOS', version: this.cap(cros) };

        if (/\bLinux\b/.test(ua)) return { name: 'Linux', version: null };

        if (/\blike Mac OS X\b/.test(ua)) return { name: 'iOS', version: null };

        return { name: 'Unknown', version: null };
    }

    private static parseDevice(ua: string): { type: DeviceType; vendor: string | null; model: string | null } {
        if (/\b(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|mediapartners-google|apis-google|googlewebpreview)\b/i.test(ua)) {
            return { type: 'bot', vendor: null, model: null };
        }
        if (/\bSmartTV|HbbTV|AppleTV|CrKey|Roku|Tizen\b/i.test(ua)) return { type: 'tv', vendor: null, model: null };
        if (/\bPlayStation|Xbox|Nintendo\b/i.test(ua)) return { type: 'console', vendor: null, model: null };
        if (/\biPad\b/.test(ua)) return { type: 'tablet', vendor: 'Apple', model: 'iPad' };
        if (/\bAndroid\b/.test(ua)) {
            if (/\bMobile\b/i.test(ua)) return { type: 'mobile', vendor: null, model: null };
            return { type: 'tablet', vendor: null, model: null };
        }
        if (/\biPhone\b/.test(ua)) return { type: 'mobile', vendor: 'Apple', model: 'iPhone' };
        if (/\biPod\b/.test(ua)) return { type: 'mobile', vendor: 'Apple', model: 'iPod' };
        if (/\bMobile\b/i.test(ua)) return { type: 'mobile', vendor: null, model: null };
        return { type: 'desktop', vendor: null, model: null };
    }

    private static parseCPU(ua: string): { architecture: string | null } {
        const arch =
            this.cap(ua.match(/\b(?:WOW64|Win64; x64|x64;|amd64|x86_64)\b/i), 0)
                ? 'x86_64'
                : this.cap(ua.match(/\b(aarch64|arm64|ARM64|Apple Silicon)\b/i), 1)
                    ? 'arm64'
                    : this.cap(ua.match(/\b(?:i[0-9]86|x86)\b/i), 0)
                        ? 'x86'
                        : null;
        return { architecture: arch };
    }

    public static parse(uaRaw: string, width:number = 0, height: number = 0): DeviceInfo {
        const ua = uaRaw || '';
        const browser = this.parseBrowser(ua);
        const engine = this.parseEngine(ua, browser.name);
        const os = this.parseOS(ua);
        const device = this.parseDevice(ua);
        const cpu = this.parseCPU(ua);

        const minDimension = Math.min(width, height);
        const maxDimension = Math.max(width, height);
        const aspectRatio = maxDimension / minDimension;

        return new DeviceInfo(ua, browser, engine, os, device, cpu, minDimension, maxDimension, aspectRatio);
    }
}
