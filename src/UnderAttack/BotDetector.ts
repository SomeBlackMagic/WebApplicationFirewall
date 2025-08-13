import {Request} from 'express';
import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {Log} from '@waf/Log';
import {IClientFingerprint} from '@waf/UnderAttack/FingerprintValidator';
import {merge} from "lodash";
import {UnderAttackMetrics} from "@waf/UnderAttack/UnderAttackMetrics";

/**
 * Interface for storing a request pattern
 */
interface RequestPattern {
    ip: string;
    userAgent: string;
    timestamp: number;
    url: string;
    headers: Record<string, string>;
    responseTime?: number;
}

/**
 * Interface for bot detector configuration
 */
export interface IBotDetectorConfig {
    enabled: boolean;
    aiModel: 'basic' | 'advanced';
    blockSuspiciousUA: boolean;
    historyCleanup?: {
        enabled?: boolean;
        time?: number;
    };
}


export class BotDetector {
    private knownBotPatterns: RegExp[];
    private suspiciousUAPatterns: RegExp[];
    private requestHistory: Map<string, RequestPattern[]> = new Map();
    private challengeTimings: Map<string, number> = new Map();
    private readonly historyCleanupInterval: NodeJS.Timeout = null;

    constructor(
        private readonly config: IBotDetectorConfig,
        private readonly metrics?: UnderAttackMetrics,
        private readonly log?: LoggerInterface,
    ) {
        this.config = merge<object|IBotDetectorConfig, IBotDetectorConfig>({
            historyCleanup: {
                enabled: true,
                time: 10
            }
        }, config);

        if(!log) {
            this.log = Log.instance.withCategory('app.UnderAttack.BotDetector');
        }

        if(!metrics) {
            this.metrics = UnderAttackMetrics.get();
        }


        // Extended attack bot patterns
        this.knownBotPatterns = [
            /bot/i, /crawl/i, /spider/i, /headless/i, /scraper/i, /http[\s-]?request/i,
            /wget/i, /curl/i, /selenium/i, /puppeteer/i, /playwright/i, /chrome-lighthouse/i,
            /phantom/i, /httrack/i, /python-requests/i, /go-http-client/i, /java\/\d/i,
            /postman/i, /insomnia/i, /httpclient/i, /okhttp/i, /axios/i, /fetch/i,
            /masscan/i, /nmap/i, /sqlmap/i, /nikto/i, /dirb/i, /gobuster/i,
            /nuclei/i, /ffuf/i, /wfuzz/i, /burp/i, /zap/i
        ];

        // Suspicious User-Agent patterns
        this.suspiciousUAPatterns = [
            /^Mozilla\/\d\.\d$/i, // Too short
            /^\s*$/i, // Empty UA
            /^(Mozilla|Chrome|Safari|Firefox|Opera)$/i, // Only browser name
            /\(compatible\)$/i, // Incomplete UA
            /fake/i, /anonym/i, /incognito/i, /unknown/i, /generic/i,
            /test/i, /scanner/i, /exploit/i
        ];

        if(this.config.enabled && this.config.historyCleanup.enabled) {
            this.historyCleanupInterval = setInterval(() => this.cleanupHistory(), this.config.historyCleanup.time * 60 * 1000);
            process.on('exit', () => clearInterval(this.historyCleanupInterval));
        }
    }

    /**
     * Determines if the request is from a bot
     * @param req HTTP request
     * @param data Additional client data
     * @param clientIp
     * @returns true if the request is from a bot, false if from a human
     */
    public detect(req: Request, data: IClientFingerprint | null, clientIp: string): boolean {
        if (!this.config.enabled) {
            return false; // If bot detection is disabled, consider all requests as human
        }

        // Increment bot detection counter
        this.metrics.incrementBotDetectionTotal();

        const userAgent = req.header('user-agent') || '';

        // Record request in history
        this.recordRequest(req, clientIp);

        // 1. Check User-Agent for known bots
        if (this.isKnownBot(userAgent)) {
            this.log.warn('Detected known attack bot', {ip: clientIp, userAgent});
            this.metrics.incrementKnownBotDetection();
            return true;
        }

        // 2. Check behavioral patterns
        if (this.detectSuspiciousPatterns(clientIp)) {
            this.log.warn('Detected suspicious request patterns', {ip: clientIp});
            this.metrics.incrementSuspiciousPatternsDetection();
            return true;
        }

        // 3. Check headers for automation signs
        if (this.checkAutomationHeaders(req)) {
            this.log.warn('Detected automation headers', {ip: clientIp});
            this.metrics.incrementAutomationHeadersDetection();
            return true;
        }

        // 4. Check challenge execution time (if any)
        if (this.checkChallengeTimingAnomaly(clientIp)) {
            this.log.warn('Detected challenge timing anomaly', {ip: clientIp});
            this.metrics.incrementTimingAnomalyDetection();
            return true;
        }

        // 5. Check based on JavaScript data from browser
        if (data !== null && this.checkClientData(data)) {
            this.log.debug('Detected bot from client data', {data});
            this.metrics.incrementClientDataDetection();
            return true;
        }

        // 6. Advanced heuristics
        if (this.config.aiModel === 'advanced') {
            const suspicionScore = this.calculateSuspicionScore(req, clientIp, data);

            // Record suspicion score
            this.metrics.recordSuspicionScore(suspicionScore);

            if (suspicionScore > 0.8) {
                this.log.warn('High suspicion score detected', {ip: clientIp, score: suspicionScore});
                this.metrics.incrementHighSuspicionDetection();
                return true;
            }
        }

        return false;
    }

    /**
     * Records the challenge start time for later time control
     */
    public recordChallengeStart(clientIP: string): void {
        this.challengeTimings.set(clientIP, Date.now());
    }

    private isKnownBot(userAgent: string): boolean {
        return this.knownBotPatterns.some(pattern => pattern.test(userAgent)) ||
            (this.config.blockSuspiciousUA &&
                this.suspiciousUAPatterns.some(pattern => pattern.test(userAgent)));
    }

    private detectSuspiciousPatterns(clientIP: string): boolean {
        const history = this.requestHistory.get(clientIP) || [];

        if (history.length < 2) return false;

        const now = Date.now();
        const recentRequests = history.filter(r => now - r.timestamp < 60000); // Last 60 seconds

        // Too many requests in a short time
        if (recentRequests.length > 20) {
            return true;
        }

        // Suspiciously regular intervals between requests
        if (this.hasRegularIntervals(recentRequests)) {
            return true;
        }

        // Path scanning (many 404 errors)
        const scanning = this.detectPathScanning(history);
        if (scanning) {
            return true;
        }

        // Identical headers in all requests (script indicator)
        if (this.hasIdenticalHeaders(recentRequests)) {
            return true;
        }

        return false;
    }

    private hasRegularIntervals(requests: RequestPattern[]): boolean {
        if (requests.length < 5) return false;

        const intervals = [];
        for (let i = 1; i < requests.length; i++) {
            intervals.push(requests[i].timestamp - requests[i - 1].timestamp);
        }

        // Check if intervals are too regular
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) =>
            sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

        // If the variance is too small, it's suspicious
        return variance < avgInterval * 0.1 && avgInterval < 5000; // Less than 5 seconds with low variance
    }

    private detectPathScanning(history: RequestPattern[]): boolean {
        return false;
        // TODO Implement path scanning detection
        // const recentRequests = history.filter(r => Date.now() - r.timestamp < 300000); // 5 minutes
        //
        // if (recentRequests.length < 10) return false;
        //
        // // Check for admin path scanning
        // const adminPaths = [
        //     '/admin', '/wp-admin', '/administrator', '/panel', '/dashboard',
        //     '/login', '/admin.php', '/wp-login.php', '/.env', '/config',
        //     '/phpmyadmin', '/mysql', '/db', '/database', '/backup'
        // ];
        //
        // const adminRequests = recentRequests.filter(r =>
        //     adminPaths.some(path => r.url.toLowerCase().includes(path))
        // );
        //
        // // If there are many requests to admin paths
        // if (adminRequests.length > 5) {
        //     return true;
        // }
        //
        // // Check for scanning of various file extensions
        // const extensions = recentRequests.map(r => {
        //     const match = r.url.match(/\.([a-z0-9]{2,4})$/i);
        //     return match ? match[1] : null;
        // }).filter(Boolean);
        //
        // const uniqueExtensions = new Set(extensions);
        //
        // // If trying many different extensions
        // return uniqueExtensions.size > 5 && recentRequests.length > 15;
    }

    private hasIdenticalHeaders(requests: RequestPattern[]): boolean {
        if (requests.length < 3) return false;

        const firstHeaders = requests[0].headers;
        const keyHeaders = ['accept', 'accept-language', 'accept-encoding', 'user-agent'];

        return requests.slice(1).every(req =>
            keyHeaders.every(header => req.headers[header] === firstHeaders[header])
        );
    }

    private checkAutomationHeaders(req: Request): boolean {
        const headers = req.headers;

        // Absence of important browser headers
        if (!headers.accept || !headers['accept-language'] || !headers['accept-encoding']) {
            return true;
        }

        // Suspicious header values
        if (headers.accept === '*/*' && !headers.referer) {
            return true;
        }

        // Presence of automation headers
        const automationHeaders = [
            'x-requested-with', 'x-automation', 'x-test', 'x-bot',
            'selenium', 'webdriver', 'puppeteer', 'playwright'
        ];

        if (automationHeaders.some(header =>
            Object.keys(headers).some(h => h.toLowerCase().includes(header)))) {
            return true;
        }

        return false;
    }

    private checkClientData(data: IClientFingerprint): boolean {
        // Check for typical bot anomalies

        // Lack of cookie support
        if (data.cookiesEnabled === false) {
            return true;
        }

        // Absence of plugins and extensions in the browser
        const hasPlugins = data.plugins && Array.isArray(data.plugins) && data.plugins.length > 0;
        const hasExtensions = data.extensions && Array.isArray(data.extensions) && data.extensions.length > 0;

        // Most real users have at least a few extensions
        const suspiciouslyEmpty = !hasPlugins && !hasExtensions;

        // Check for headless browser
        const isHeadless = data.webdriver ||
            (data.webglRenderer && data.webglRenderer.includes('SwiftShader'));

        // Check for browser proofs anomalies (if any)
        if (data.browserProofs) {
            // Too fast or instant proof generation time
            if (data.proofGenerationTime !== undefined &&
                data.proofGenerationTime < 50) {
                return true;
            }
        }

        return suspiciouslyEmpty || isHeadless;
    }

    private checkChallengeTimingAnomaly(clientIP: string): boolean {
        const challengeStart = this.challengeTimings.get(clientIP);
        if (!challengeStart) return false;

        const challengeDuration = Date.now() - challengeStart;

        // Too fast (less than 2 seconds) or too slow (more than 2 minutes)
        if (challengeDuration < 2000 || challengeDuration > 120000) {
            this.challengeTimings.delete(clientIP);
            return true;
        }

        this.challengeTimings.delete(clientIP);
        return false;
    }

    private calculateSuspicionScore(req: Request, clientIP: string, data: IClientFingerprint | null): number {
        let score = 0;
        const history = this.requestHistory.get(clientIP) || [];
        const userAgent = req.header('user-agent') || '';

        // Request frequency analysis
        const recentRequests = history.filter(r => Date.now() - r.timestamp < 60000);
        if (recentRequests.length > 10) score += 0.3;
        if (recentRequests.length > 20) score += 0.2;

        // User-Agent analysis
        if (userAgent.length < 50) score += 0.2;
        if (!/Chrome|Firefox|Safari|Edge/.test(userAgent)) score += 0.15;

        // Headers analysis
        if (!req.header('referer') && !req.header('origin')) score += 0.1;
        if (req.header('accept') === '*/*') score += 0.15;

        // Request paths analysis
        const suspiciousPaths = ['.php', '.asp', '.jsp', 'admin', 'login', '.env'];
        if (suspiciousPaths.some(path => req.path.includes(path))) score += 0.1;

        // If client data is missing or suspicious
        if (data === null) {
            score += 0.2;
        } else {
            // Client data analysis (but we don't rely solely on it)
            if (data.cookiesEnabled === false) score += 0.1;
            if (!data.canvasFingerprint && !data.webglVendor) score += 0.1;

            // Check for browser proofs presence
            if (!data.browserProofs) {
                score += 0.3;
            }
        }

        return Math.min(1, score);
    }

    private recordRequest(req: Request, clientIP: string): void {
        const pattern: RequestPattern = {
            ip: clientIP,
            userAgent: req.header('user-agent') || '',
            timestamp: Date.now(),
            url: req.path,
            headers: {
                accept: req.header('accept') || '',
                'accept-language': req.header('accept-language') || '',
                'accept-encoding': req.header('accept-encoding') || '',
                referer: req.header('referer') || '',
                origin: req.header('origin') || ''
            }
        };

        if (!this.requestHistory.has(clientIP)) {
            this.requestHistory.set(clientIP, []);
        }

        const history = this.requestHistory.get(clientIP)!;
        history.push(pattern);

        // Limit history to the last 100 requests
        if (history.length > 100) {
            history.shift();
        }
    }

    private cleanupHistory(): void {
        this.log.debug('Cleaning up request history');
        const oneHourAgo = Date.now() - 3600000;

        for (const [ip, history] of this.requestHistory.entries()) {
            const filtered = history.filter(r => r.timestamp > oneHourAgo);
            if (filtered.length === 0) {
                this.requestHistory.delete(ip);
            } else {
                this.requestHistory.set(ip, filtered);
            }
        }

        // Cleanup challenge timings
        for (const [ip, timestamp] of this.challengeTimings.entries()) {
            if (Date.now() - timestamp > 300000) { // 5 minutes
                this.challengeTimings.delete(ip);
            }
        }
    }
}
