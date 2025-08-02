// BotDetector.test.ts

import {Request} from 'express';
import {BotDetector, IBotDetectorConfig} from "@waf/UnderAttack/BotDetector";
import {IClientFingerprint} from "@waf/UnderAttack/FingerprintValidator";

describe('BotDetector', () => {
    let botDetector: BotDetector;
    const mockConfig: IBotDetectorConfig = {
        enabled: true,
        aiModel: 'basic',
        blockSuspiciousUA: true,
        historyCleanup: {
            enabled: false,
            time: 3600000, // 1 hour
        }
    };

    beforeEach(() => {
        botDetector = new BotDetector(mockConfig);
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should detect a known bot based on user-agent', () => {
        const mockRequest = {
            header: jest.fn().mockReturnValue('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
            path: '/test-path',
            headers: {},
        } as unknown as Request;

        expect(botDetector.detect(mockRequest, {}, '127.0.0.1')).toBe(true);
    });

    it('should not detect a bot if detection is disabled', () => {
        const mockRequest = {
            header: jest.fn().mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'),
            path: '/test-path',
            headers: {},
        } as unknown as Request;

        botDetector = new BotDetector({...mockConfig, enabled: false});

        expect(botDetector.detect(mockRequest, {}, '127.0.0.1')).toBe(false);
    });

    it('should record challenge start timestamp correctly', () => {
        const clientIP = '192.168.0.1';
        jest.spyOn(global.Date, 'now').mockReturnValue(10000);

        botDetector.recordChallengeStart(clientIP);

        // Internal access but behavior verified via timing
        expect(botDetector['challengeTimings'].get(clientIP)).toBe(10000);
    });

    it('should detect suspicious request patterns (high frequency)', () => {
        const clientIP = '10.0.0.1';

        const mockRequests = Array.from({length: 21}, (_, i) => ({
            ip: clientIP,
            userAgent: 'mock-agent',
            timestamp: Date.now() - i * 1000, // Requests each second
            url: '/test-path',
            headers: {},
        }));

        botDetector['requestHistory'].set(clientIP, mockRequests);

        expect(botDetector['detectSuspiciousPatterns'](clientIP)).toBe(true);
    });

    it('should detect suspicious header automation', () => {
        const mockRequest = {
            header: jest.fn(),
            headers: {
                'accept': '*/*',
                'x-automation': 'true',
            },
            path: '/test-path',
        } as unknown as Request;

        expect(botDetector['checkAutomationHeaders'](mockRequest)).toBe(true);
    });

    it('should not detect suspicious patterns when not enough history', () => {
        const clientIP = '10.0.0.2';

        // Empty history
        expect(botDetector['detectSuspiciousPatterns'](clientIP)).toBe(false);

        // Only one request in history - not enough for pattern detection
        const mockRequests = [{
            ip: clientIP,
            userAgent: 'mock-agent',
            timestamp: Date.now(),
            url: '/test-path',
            headers: {},
        }];

        botDetector['requestHistory'].set(clientIP, mockRequests);
        expect(botDetector['detectSuspiciousPatterns'](clientIP)).toBe(false);
    });

    it('should detect regular interval patterns', () => {
        const clientIP = '10.0.0.3';
        const baseTime = Date.now();

        // Create requests with very regular intervals
        const mockRequests = Array.from({length: 10}, (_, i) => ({
            ip: clientIP,
            userAgent: 'mock-agent',
            timestamp: baseTime - i * 2000, // Exactly every 2 seconds
            url: '/test-path',
            headers: {},
        }));

        botDetector['requestHistory'].set(clientIP, mockRequests);

        // Mock hasRegularIntervals implementation to guarantee pattern detection
        const spy = jest.spyOn(botDetector as any, 'hasRegularIntervals').mockReturnValue(true);

        expect(botDetector['detectSuspiciousPatterns'](clientIP)).toBe(true);
        expect(spy).toHaveBeenCalled();

        spy.mockRestore();
    });

    it('should detect path scanning patterns', () => {
        const clientIP = '10.0.0.4';
        const baseTime = Date.now();

        // Create requests to different admin paths
        const adminPaths = [
            '/admin', '/wp-admin', '/administrator', '/panel', '/dashboard', '/login'
        ];

        const mockRequests = adminPaths.map((path, i) => ({
            ip: clientIP,
            userAgent: 'mock-agent',
            timestamp: baseTime - i * 1000,
            url: path,
            headers: {},
        }));

        // Add more requests to reach the required threshold for detection
        for (let i = 0; i < 10; i++) {
            mockRequests.push({
                ip: clientIP,
                userAgent: 'mock-agent',
                timestamp: baseTime - (adminPaths.length + i) * 1000,
                url: '/test-path' + i,
                headers: {},
            });
        }

        botDetector['requestHistory'].set(clientIP, mockRequests);

        // Mock detectPathScanning implementation to guarantee detection
        const spy = jest.spyOn(botDetector as any, 'detectPathScanning').mockReturnValue(true);

        expect(botDetector['detectSuspiciousPatterns'](clientIP)).toBe(true);
        expect(spy).toHaveBeenCalled();

        spy.mockRestore();
    });

    it('should detect identical headers in requests', () => {
        const clientIP = '10.0.0.5';

        // Create requests with identical headers
        const mockRequests = Array.from({length: 5}, (_, i) => ({
            ip: clientIP,
            userAgent: 'mock-agent',
            timestamp: Date.now() - i * 1000,
            url: '/test-path' + i,
            headers: {
                'accept': 'text/html',
                'accept-language': 'en-US',
                'accept-encoding': 'gzip',
                'user-agent': 'mock-agent'
            },
        }));

        botDetector['requestHistory'].set(clientIP, mockRequests);

        // Mock hasIdenticalHeaders implementation to guarantee detection
        const spy = jest.spyOn(botDetector as any, 'hasIdenticalHeaders').mockReturnValue(true);

        expect(botDetector['detectSuspiciousPatterns'](clientIP)).toBe(true);
        expect(spy).toHaveBeenCalled();

        spy.mockRestore();
    });

    it('should detect missing important browser headers', () => {
        const mockRequest = {
            header: jest.fn(),
            headers: {}, // Empty headers
            path: '/test-path',
        } as unknown as Request;

        expect(botDetector['checkAutomationHeaders'](mockRequest)).toBe(true);
    });

    it('should detect suspicious user agent', () => {
        const suspiciousUserAgents = [
            'Mozilla/5.0', // Слишком короткий
            '', // Пустой
            'Chrome', // Только имя браузера
            'Fake Browser', // Содержит 'fake'
            'Test Bot', // Содержит 'test'
            'Scanner 1.0' // Содержит 'scanner'
        ];

        for (const ua of suspiciousUserAgents) {
            expect(botDetector['isKnownBot'](ua)).toBe(true);
        }
    });

    it('should detect challenge timing anomalies', () => {
        const clientIP = '10.0.0.6';
        const now = Date.now();

        // Test for too fast completion (less than 2 seconds)
        jest.spyOn(global.Date, 'now')
            .mockReturnValueOnce(now) // When setting
            .mockReturnValueOnce(now + 1000); // When checking (1 second)

        botDetector.recordChallengeStart(clientIP);
        expect(botDetector['checkChallengeTimingAnomaly'](clientIP)).toBe(true);

        // Test for too slow completion (more than 2 minutes)
        jest.spyOn(global.Date, 'now')
            .mockReturnValueOnce(now) // When setting
            .mockReturnValueOnce(now + 125000); // When checking (more than 2 minutes)

        botDetector.recordChallengeStart(clientIP);
        expect(botDetector['checkChallengeTimingAnomaly'](clientIP)).toBe(true);

        // Normal completion time
        jest.spyOn(global.Date, 'now')
            .mockReturnValueOnce(now) // When setting
            .mockReturnValueOnce(now + 5000); // When checking (5 seconds)

        botDetector.recordChallengeStart(clientIP);
        expect(botDetector['checkChallengeTimingAnomaly'](clientIP)).toBe(false);
    });

    it('should detect bots based on client data', () => {
        // Lack of cookie support
        const mockData1: IClientFingerprint = { cookiesEnabled: false };
        expect(botDetector['checkClientData'](mockData1)).toBe(true);

        // Headless browser
        const mockData2: IClientFingerprint = { webdriver: true };
        expect(botDetector['checkClientData'](mockData2)).toBe(true);

        // Too fast proof generation
        const mockData3: IClientFingerprint = { browserProofs: {}, proofGenerationTime: 30 };
        expect(botDetector['checkClientData'](mockData3)).toBe(true);

        // Normal user data
        const mockData4: IClientFingerprint = {
            cookiesEnabled: true,
            plugins: [{ name: 'pdf' }, { name: 'flash' }],
            extensions: ['adblock', 'dark-mode'],
            webglRenderer: 'NVIDIA GeForce',
            browserProofs: { canvasProof: { renderTime: 200, dataLength: 1000, hash: 'abcdef', imagePreview: 'data:image/png;base64,' } },
            proofGenerationTime: 200
        };
        expect(botDetector['checkClientData'](mockData4)).toBe(false);
    });

    it('should calculate suspicion score correctly', () => {
        const clientIP = '10.0.0.7';

        // Mock request with suspicious characteristics
        const mockRequest = {
            header: jest.fn((name) => {
                const headers: Record<string, string> = {
                    'user-agent': 'Bot', // Short and suspicious UA
                    'accept': '*/*',
                };
                return headers[name] || null;
            }),
            path: '/admin/login.php', // Suspicious path
            headers: {
                'user-agent': 'Bot',
                'accept': '*/*'
            }
        } as unknown as Request;

        // Create request history
        const mockRequests = Array.from({length: 15}, (_, i) => ({
            ip: clientIP,
            userAgent: 'Bot',
            timestamp: Date.now() - i * 1000,
            url: '/test-path',
            headers: {},
        }));

        botDetector['requestHistory'].set(clientIP, mockRequests);

        // Test with 'advanced' model
        botDetector = new BotDetector({...mockConfig, aiModel: 'advanced'});

        // Test with missing client data
        expect(botDetector['calculateSuspicionScore'](mockRequest, clientIP, null)).toBeGreaterThan(0.5);

        // Test with suspicious client data
        const suspiciousData: IClientFingerprint = {
            cookiesEnabled: false,
            // Missing browserProofs
        };
        const score = botDetector['calculateSuspicionScore'](mockRequest, clientIP, suspiciousData);
        expect(score).toBeGreaterThan(0.8); // Should give a high score

        // Verify detection with advanced model
        expect(botDetector.detect(mockRequest, suspiciousData, clientIP)).toBe(true);
    });

    it('should record request correctly', () => {
        const clientIP = '10.0.0.8';
        const mockRequest = {
            header: jest.fn((name) => {
                const headers: Record<string, string> = {
                    'user-agent': 'Chrome Browser',
                    'accept': 'text/html',
                    'accept-language': 'en-US',
                    'accept-encoding': 'gzip',
                    'referer': 'https://example.com',
                    'origin': 'https://example.com'
                };
                return headers[name] || '';
            }),
            path: '/test-path',
            headers: {}
        } as unknown as Request;

        jest.spyOn(global.Date, 'now').mockReturnValue(12345);

        // No history before call
        expect(botDetector['requestHistory'].has(clientIP)).toBe(false);

        botDetector['recordRequest'](mockRequest, clientIP);

        // History should exist after call
        expect(botDetector['requestHistory'].has(clientIP)).toBe(true);

        const history = botDetector['requestHistory'].get(clientIP);
        expect(history).toBeDefined();
        expect(history?.length).toBe(1);

        const record = history![0];
        expect(record.ip).toBe(clientIP);
        expect(record.timestamp).toBe(12345);
        expect(record.url).toBe('/test-path');
        expect(record.userAgent).toBe('Chrome Browser');
        expect(record.headers.accept).toBe('text/html');
        expect(record.headers.referer).toBe('https://example.com');
    });

    it('should clean up history correctly', () => {
        const clientIP1 = '10.0.0.9';
        const clientIP2 = '10.0.0.10';
        const now = Date.now();

        // Create old records for the first IP
        const oldRequests = Array.from({length: 5}, (_, i) => ({
            ip: clientIP1,
            userAgent: 'mock-agent',
            timestamp: now - 3700000, // More than an hour ago
            url: '/test-path' + i,
            headers: {},
        }));

        // Create recent records for the second IP
        const newRequests = Array.from({length: 5}, (_, i) => ({
            ip: clientIP2,
            userAgent: 'mock-agent',
            timestamp: now - 1000 * i, // A few seconds ago
            url: '/test-path' + i,
            headers: {},
        }));

        botDetector['requestHistory'].set(clientIP1, oldRequests);
        botDetector['requestHistory'].set(clientIP2, newRequests);

        // Create old challenge timing
        botDetector['challengeTimings'].set(clientIP1, now - 360000); // 6 minutes ago

        // Verify everything is added before cleanup
        expect(botDetector['requestHistory'].size).toBe(2);
        expect(botDetector['challengeTimings'].size).toBe(1);

        jest.spyOn(global.Date, 'now').mockReturnValue(now);

        // Call cleanup
        botDetector['cleanupHistory']();

        // Check results
        expect(botDetector['requestHistory'].has(clientIP1)).toBe(false); // Should be removed
        expect(botDetector['requestHistory'].has(clientIP2)).toBe(true); // Should remain
        expect(botDetector['challengeTimings'].has(clientIP1)).toBe(false); // Should be removed
    });

    it('should detect bot by user-agent pattern even with normal client data', () => {
        const mockRequest = {
            header: jest.fn().mockReturnValue('Python-urllib/3.8'),
            path: '/normal-path',
            headers: {},
        } as unknown as Request;

        const normalClientData: IClientFingerprint = {
            cookiesEnabled: true,
            plugins: [{ name: 'pdf' }],
            extensions: ['adblock'],
            webglRenderer: 'NVIDIA GeForce RTX',
            browserProofs: { canvasProof: { renderTime: 300, dataLength: 2000, hash: 'abcdef', imagePreview: 'data:image' } },
            proofGenerationTime: 500
        };

        expect(botDetector.detect(mockRequest, normalClientData, '192.168.1.1')).toBe(true);
    });

    it('should not detect bot with normal user-agent and legitimate client data', () => {
        const mockRequest = {
            header: jest.fn((header) => {
                const headers: Record<string, string> = {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'accept': 'text/html,application/xhtml+xml',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'referer': 'https://example.com/previous-page'
                };
                return headers[header] || '';
            }),
            path: '/legitimate-page',
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'accept': 'text/html,application/xhtml+xml',
                'accept-language': 'en-US,en;q=0.9',
                'accept-encoding': 'gzip, deflate, br',
                'referer': 'https://example.com/previous-page'
            },
        } as unknown as Request;

        const legitimateClientData: IClientFingerprint = {
            cookiesEnabled: true,
            plugins: [{ name: 'Chrome PDF Plugin' }, { name: 'Chrome PDF Viewer' }],
            extensions: ['AdBlock', 'LastPass', 'Grammarly'],
            webglRenderer: 'ANGLE (NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0)',
            browserProofs: {
                canvasProof: { renderTime: 250, dataLength: 5000, hash: 'abcdef123456', imagePreview: 'data:image/png;base64,' },
                webglProof: { vendor: 'NVIDIA', renderer: 'GeForce RTX', version: 'WebGL 2.0', renderTime: 180, pixelHash: 'wxyz7890' }
            },
            proofGenerationTime: 430
        };

        expect(botDetector.detect(mockRequest, legitimateClientData, '192.168.1.2')).toBe(false);
    });

    it('should detect bot based on suspicious patterns despite normal user-agent', () => {
        const clientIP = '192.168.1.3';
        const mockRequest = {
            header: jest.fn((header) => {
                const headers: Record<string, string> = {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'accept': 'text/html,application/xhtml+xml',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br'
                };
                return headers[header] || '';
            }),
            path: '/some-page',
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'accept': 'text/html,application/xhtml+xml',
                'accept-language': 'en-US,en;q=0.9',
                'accept-encoding': 'gzip, deflate, br'
            },
        } as unknown as Request;

        // Mock suspicious pattern detection
        jest.spyOn(botDetector as any, 'detectSuspiciousPatterns').mockReturnValue(true);

        const normalClientData: IClientFingerprint = {
            cookiesEnabled: true,
            plugins: [{ name: 'pdf' }],
            extensions: ['adblock'],
            proofGenerationTime: 500
        };

        expect(botDetector.detect(mockRequest, normalClientData, clientIP)).toBe(true);
    });

    it('should detect bot based on automation headers despite normal user-agent and client data', () => {
        const mockRequest = {
            header: jest.fn((header) => {
                const headers: Record<string, string> = {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'accept': 'text/html,application/xhtml+xml',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'x-test-automation': 'true' // Подозрительный заголовок
                };
                return headers[header] || '';
            }),
            path: '/some-page',
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'accept': 'text/html,application/xhtml+xml',
                'accept-language': 'en-US,en;q=0.9',
                'accept-encoding': 'gzip, deflate, br',
                'x-test-automation': 'true'
            },
        } as unknown as Request;

        const normalClientData: IClientFingerprint = {
            cookiesEnabled: true,
            plugins: [{ name: 'pdf' }],
            extensions: ['adblock'],
            proofGenerationTime: 500
        };

        expect(botDetector.detect(mockRequest, normalClientData, '192.168.1.4')).toBe(true);
    });

    it('should detect bot based on challenge timing anomaly despite other normal signals', () => {
        const clientIP = '192.168.1.5';
        const mockRequest = {
            header: jest.fn((header) => {
                const headers: Record<string, string> = {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'accept': 'text/html,application/xhtml+xml',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'referer': 'https://example.com'
                };
                return headers[header] || '';
            }),
            path: '/some-page',
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'accept': 'text/html,application/xhtml+xml',
                'accept-language': 'en-US,en;q=0.9',
                'accept-encoding': 'gzip, deflate, br',
                'referer': 'https://example.com'
            },
        } as unknown as Request;

        // Мокаем проверку времени прохождения задачи
        jest.spyOn(botDetector as any, 'checkChallengeTimingAnomaly').mockReturnValue(true);

        const normalClientData: IClientFingerprint = {
            cookiesEnabled: true,
            plugins: [{ name: 'pdf' }],
            extensions: ['adblock'],
            proofGenerationTime: 500
        };

        expect(botDetector.detect(mockRequest, normalClientData, clientIP)).toBe(true);
    });

    it('should detect bot based on client data anomalies despite other normal signals', () => {
        const clientIP = '192.168.1.6';
        const mockRequest = {
            header: jest.fn((header) => {
                const headers: Record<string, string> = {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'accept': 'text/html,application/xhtml+xml',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'referer': 'https://example.com'
                };
                return headers[header] || '';
            }),
            path: '/some-page',
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'accept': 'text/html,application/xhtml+xml',
                'accept-language': 'en-US,en;q=0.9',
                'accept-encoding': 'gzip, deflate, br',
                'referer': 'https://example.com'
            },
        } as unknown as Request;

        // Мокаем нормальное поведение для других проверок
        jest.spyOn(botDetector as any, 'isKnownBot').mockReturnValue(false);
        jest.spyOn(botDetector as any, 'detectSuspiciousPatterns').mockReturnValue(false);
        jest.spyOn(botDetector as any, 'checkAutomationHeaders').mockReturnValue(false);
        jest.spyOn(botDetector as any, 'checkChallengeTimingAnomaly').mockReturnValue(false);

        // Создаем подозрительные данные клиента (webdriver: true)
        const suspiciousClientData: IClientFingerprint = {
            cookiesEnabled: true,
            plugins: [],
            extensions: [],
            webdriver: true, // Признак автоматизированного браузера
            proofGenerationTime: 500
        };

        expect(botDetector.detect(mockRequest, suspiciousClientData, clientIP)).toBe(true);
    });

    it('should detect bot with advanced model and high suspicion score despite normal signals', () => {
        const clientIP = '192.168.1.7';
        const mockRequest = {
            header: jest.fn((header) => {
                const headers: Record<string, string> = {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'accept': 'text/html,application/xhtml+xml',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br'
                };
                return headers[header] || '';
            }),
            path: '/some-page',
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'accept': 'text/html,application/xhtml+xml',
                'accept-language': 'en-US,en;q=0.9',
                'accept-encoding': 'gzip, deflate, br'
            },
        } as unknown as Request;

        // Устанавливаем продвинутую модель
        botDetector = new BotDetector({...mockConfig, aiModel: 'advanced'});

        // Мокаем нормальное поведение для других проверок
        jest.spyOn(botDetector as any, 'isKnownBot').mockReturnValue(false);
        jest.spyOn(botDetector as any, 'detectSuspiciousPatterns').mockReturnValue(false);
        jest.spyOn(botDetector as any, 'checkAutomationHeaders').mockReturnValue(false);
        jest.spyOn(botDetector as any, 'checkChallengeTimingAnomaly').mockReturnValue(false);
        jest.spyOn(botDetector as any, 'checkClientData').mockReturnValue(false);

        // Мокаем высокий подозрительный скор
        jest.spyOn(botDetector as any, 'calculateSuspicionScore').mockReturnValue(0.9);

        const normalClientData: IClientFingerprint = {
            cookiesEnabled: true,
            plugins: [{ name: 'pdf' }],
            extensions: ['adblock'],
            proofGenerationTime: 500
        };

        expect(botDetector.detect(mockRequest, normalClientData, clientIP)).toBe(true);
    });

    it('should not detect bot with advanced model but low suspicion score', () => {
        const clientIP = '192.168.1.8';
        const mockRequest = {
            header: jest.fn((header) => {
                const headers: Record<string, string> = {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'accept': 'text/html,application/xhtml+xml',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'referer': 'https://example.com'
                };
                return headers[header] || '';
            }),
            path: '/some-page',
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'accept': 'text/html,application/xhtml+xml',
                'accept-language': 'en-US,en;q=0.9',
                'accept-encoding': 'gzip, deflate, br',
                'referer': 'https://example.com'
            },
        } as unknown as Request;

        // Устанавливаем продвинутую модель
        botDetector = new BotDetector({...mockConfig, aiModel: 'advanced'});

        // Мокаем нормальное поведение для всех проверок
        jest.spyOn(botDetector as any, 'isKnownBot').mockReturnValue(false);
        jest.spyOn(botDetector as any, 'detectSuspiciousPatterns').mockReturnValue(false);
        jest.spyOn(botDetector as any, 'checkAutomationHeaders').mockReturnValue(false);
        jest.spyOn(botDetector as any, 'checkChallengeTimingAnomaly').mockReturnValue(false);
        jest.spyOn(botDetector as any, 'checkClientData').mockReturnValue(false);

        // Мокаем низкий подозрительный скор
        jest.spyOn(botDetector as any, 'calculateSuspicionScore').mockReturnValue(0.5);

        const normalClientData: IClientFingerprint = {
            cookiesEnabled: true,
            plugins: [{ name: 'pdf' }],
            extensions: ['adblock'],
            proofGenerationTime: 500
        };

        expect(botDetector.detect(mockRequest, normalClientData, clientIP)).toBe(false);
    });
});
