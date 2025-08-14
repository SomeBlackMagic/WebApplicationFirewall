import {Request, Response, NextFunction} from 'express';
import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {Log} from '@waf/Log';
import * as crypto from 'crypto';
import {Singleton} from "@waf/Utils/Singleton";
import {UnderAttackMetrics} from "@waf/UnderAttack/UnderAttackMetrics";
import {FingerprintValidator, IFingerprintValidatorConfig} from "@waf/UnderAttack/FingerprintValidator";
import {BotDetector, IBotDetectorConfig} from "@waf/UnderAttack/BotDetector";
import {ChallengeManager, IChallengeManagerConfig} from "@waf/UnderAttack/ChallengeManager";
import {IProofRateLimiterConfig, ProofRateLimiter} from "@waf/UnderAttack/ProofRateLimiter";
import {isString, merge} from 'lodash';
import bodyParser from "body-parser";
import {ContentLoader} from "@waf/Utils/ContentLoader";
import {UnderAttackConditionConfig, UnderAttackConditions} from "@waf/UnderAttack/UnderAttackConditions";
import {Metrics} from "@waf/Metrics/Metrics";

export class UnderAttackMiddleware extends Singleton<UnderAttackMiddleware, [IUnderAttackConfig]> {
    private challengeHtml: string;

    public constructor(
        private readonly config: IUnderAttackConfig,
        private readonly fingerprintValidator?: FingerprintValidator,
        private readonly botDetector?: BotDetector,
        private readonly challengeManager?: ChallengeManager,
        private readonly conditions?: UnderAttackConditions,
        private readonly proofRateLimiter?: ProofRateLimiter,
        private readonly log?: LoggerInterface,
        private readonly metrics?: UnderAttackMetrics,
    ) {
        super();
        if (!this.config.enabled) {
            return;
        }

        this.config = merge<object|IUnderAttackConfig, IUnderAttackConfig>({
            enabled: false,
            challengeDurationMs: 1000 * 60 * 30,
            conditions: [],
            botDetection: {
                enabled: false,
                aiModel: 'basic',
                blockSuspiciousUA: false,
            },
            fingerprintChecks: {
                enabled: false,
                minScore: 0.5,
            },
            skipUrls: [
                '/favicon.ico',
            ],
            bypassHeaders: [],
            challengePage: {
                title: 'WAF Security check',
                path: process.cwd() + '/pages/challenge/index.min.html'
            },
            cookieName: 'waf'

        }, config);

        if(!this.log) {
            this.log = Log.instance.withCategory('app.UnderAttack');
        }

        if(!this.metrics) {
            UnderAttackMetrics.build(Metrics.get());
            this.metrics = UnderAttackMetrics.get();
        }

        if(!this.fingerprintValidator) {
            this.fingerprintValidator = new FingerprintValidator(config.fingerprintChecks);
        }

        if(!this.botDetector) {
            this.botDetector = new BotDetector(config.botDetection);
        }

        if(!this.challengeManager) {
            this.challengeManager = new ChallengeManager(this.config.challengeManager);
        }

        if(this.config.conditions.length > 0 && !conditions) {
            this.conditions = new UnderAttackConditions(this.config.conditions);
        }

        if(!this.proofRateLimiter) {
            this.proofRateLimiter = new ProofRateLimiter(this.config.proofRateLimiter);
        }

        this.loadChallengeHtml();
    }

    private loadChallengeHtml(): void {
        ContentLoader.load(this.config.challengePage.path).then((html: string) => {

            this.challengeHtml = html
                .replace('__COOKIE__', this.config.cookieName)
                .replace('__TITTLE__', this.config.challengePage.title)
            ;

            this.log.info('Loaded challenge page from', this.config.challengePage.path);
        })

    }

    public async middleware(req: Request, res: Response, next: NextFunction, clientIp: string, country: string, city: string, requestId: string): Promise<boolean> {
        if (!this.config.enabled) {
            return true;
        }

        if(this.conditions) {
            const result = await this.conditions.use(clientIp, clientIp, country, req, city);
            if(!result) {
                return true;
            }
        }

        if(
            req.method === 'POST' &&
            req.url === '/__under_attack_challenge'
        ) {
            return new Promise((resolve) => {
                bodyParser.json()(req, res, async (err) => {
                    if (err) {
                        res.status(400).json({ success: false, message: 'Invalid JSON' });
                        resolve(true);
                        return;
                    }
                    await this.handleChallengeRequest(req, res, clientIp, requestId);
                    resolve(false);
                });
            });
        }
        // Check if the URL is in the exception list
        if (this.shouldSkipUrl(req.path)) {
            next();
            return true;
        }

        // Check the bypass header
        if (this.checkBypassHeader(req)) {
            this.metrics.incrementBypassCount();
            return true;
        }

        // Check if the client already has a valid token
        const token = req.cookies?.[this.config.cookieName] || null;
        if (token && this.validateToken(token)) {
            this.metrics.incrementValidTokenCount();
            return true
        }

        // Record the beginning of a Challenge to control time
        this.botDetector.recordChallengeStart(clientIp);

        // Display the challenge page
        this.metrics.incrementChallengePageShown();
        res.send(this.challengeHtml
            .replace('__CHALLENGE_DATA___', JSON.stringify(this.challengeManager.generateChallengeProblem(clientIp, requestId)))
        );
        return false;
    }

    private shouldSkipUrl(path: string): boolean {
        return this.config.skipUrls.some(pattern => {
            if (pattern.includes('*')) {
                const regexPattern = pattern.replace(/\*/g, '.*');
                return new RegExp(`^${regexPattern}$`).test(path);
            }
            return pattern === path;
        });
    }

    private checkBypassHeader(req: Request): boolean {
        return this.config.bypassHeaders.some(header => {
            if(req.header(header.name) === header.value) {
                return true;
            }
        })
    }

    protected validateToken(token: string): boolean {
        try {
            const [data, signature] = token.split('.');
            const payload = JSON.parse(Buffer.from(data, 'base64').toString());

            // Check the validity period
            if (payload.exp < Date.now()) {
                return false;
            }

            // Check the signature
            const expectedSignature = crypto
                .createHmac('sha256', process.env.WAF_ENCTIPRION_SECRET_KEY || 'default-secret-key')
                .update(data)
                .digest('base64');

            return signature === expectedSignature;
        } catch (error) {
            this.log.error('Token validation error', error);
            return false;
        }
    }

    protected async handleChallengeRequest(request: Request, response: Response, clientIp: string, requestId: string): Promise<Response> {

        const fingerprint = request.body?.fingerprint;
        const data = request.body?.data;
        const challenge = request.body?.challenge;

        if (!fingerprint || !data) {
            this.metrics.incrementFailedChallengeCount();
            return response.status(400).json({success: false, message: 'Invalid request'});
        }

        const result = this.runValidationChecks(fingerprint, data, challenge, clientIp, requestId, request);

        if(isString(result)) {
            return response.status(403).json({success: false, message: result});
        }

        // Create a token for a verified client
        const token = this.generateToken();

        this.metrics.incrementPassedCount();
        response.json({success: true, token});
    }

    private generateToken(): string {
        const payload = {
            exp: Date.now() + this.config.challengeDurationMs,
            iat: Date.now(),
        };

        const data = Buffer.from(JSON.stringify(payload)).toString('base64');
        const signature = crypto
            .createHmac('sha256', process.env.WAF_ENCTIPRION_SECRET_KEY || 'default-secret-key')
            .update(data)
            .digest('base64');

        return `${data}.${signature}`;
    }

    protected runValidationChecks(fingerprint:any, data:any, challenge:any, clientIp:any, requestId:any, request: Request): string|true {
        // Check the proof generation time
        if (data.proofGenerationTime && data.browserProofs) {
            const now = Date.now();
            const proofTime = now - data.proofGenerationTime;

            // Record proof generation time in metrics
            this.metrics.recordProofGenerationTime(proofTime);

            // Proof must take some time to generate (real execution)
            if (proofTime < 100) { // Less than 50 ms is suspicious
                this.log.warn('Proof generated too quickly', {
                    time: proofTime
                });
                this.metrics.incrementFailedChallengeCount();
                return 'Invalid proof timing';
            }
        }

        // Check the server challenge
        let challengeSolution = null;
        if (challenge) {
            challengeSolution = this.challengeManager.validateAndGetChallenge(challenge);
            if (!challengeSolution) {
                this.log.warn('Challenge validation failed');
                this.metrics.incrementFailedChallengeCount();
                return 'Challenge validation failed';
            }
        } else {
            this.log.warn('Missing challenge');
            this.metrics.incrementFailedChallengeCount();
            return 'Missing challenge';
        }

        // Rate limiting check for browser proofs
        if (data.browserProofs && !this.proofRateLimiter.validateProofUniqueness(data.browserProofs, clientIp)) {
            this.log.warn('Browser proof rate limiting triggered', {requestId, clientIp});
            this.metrics.incrementRejectedCount();
            this.metrics.incrementProofRateLimited();
            return 'Challenge failed';
        }

        // Check the browser fingerprint
        const fingerprintScore = this.fingerprintValidator.validate(fingerprint, {
            ...data,
            requestId: requestId,
            challengeId: challenge.id,
            proofSalt: challengeSolution.proofSalt
        });

        // Bot check
        const botScore = this.botDetector.detect(request, data, clientIp);

        if (fingerprintScore < this.config.fingerprintChecks.minScore || botScore) {
            this.metrics.incrementRejectedCount();
            return 'Challenge failed';
        }

        return true;
    }

}


export interface IUnderAttackConfig {
    enabled?: boolean;
    mode?: 'audit' | 'strict';
    challengeDurationMs?: number;

    conditions?: UnderAttackConditionConfig[];

    fingerprintChecks?: IFingerprintValidatorConfig;

    botDetection?: IBotDetectorConfig;

    challengeManager?: IChallengeManagerConfig,

    proofRateLimiter?: IProofRateLimiterConfig,

    challengePage?: {
        title: string;
        path: string;
    };

    skipUrls?: string[];

    cookieName?: string;

    bypassHeaders?: {
        name: string;
        value: string;
    }[];
}
