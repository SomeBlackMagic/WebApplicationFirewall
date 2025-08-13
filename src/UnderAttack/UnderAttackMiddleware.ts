import {Request, Response, NextFunction} from 'express';
import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {Log} from '@waf/Log';
import * as crypto from 'crypto';
import {Singleton} from "@waf/Utils/Singleton";
import {UnderAttackMetrics} from "@waf/UnderAttack/UnderAttackMetrics";
import {FingerprintValidator, IFingerprintValidatorConfig} from "@waf/UnderAttack/FingerprintValidator";
import {BotDetector, IBotDetectorConfig} from "@waf/UnderAttack/BotDetector";
import {ChallengeManager, IChallengeManagerConfig} from "@waf/UnderAttack/ChallengeManager";
import {merge} from 'lodash';
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
            skipUrls: [],
            bypassHeaders: [],
            challengePage: {
                title: 'WAF Security check',
                path: process.cwd() + '/pages/challenge/index.html'
            },
            cookieName: 'waf'

        }, config);

        if(!this.log) {
            this.log = Log.instance.withCategory('app.UnderAttack');
        }

        if(!this.metrics) {
            UnderAttackMetrics.bind(Metrics.get());
            this.metrics = UnderAttackMetrics.get();
        }

        if(!this.fingerprintValidator) {
            this.fingerprintValidator = new FingerprintValidator(config.fingerprintChecks ?? {enabled: false, minScore: 0.5});
        }

        if(!this.botDetector) {
            this.botDetector = new BotDetector(config.botDetection ?? {enabled: false, aiModel: 'basic', blockSuspiciousUA: false});
        }

        if(!this.challengeManager) {
            this.challengeManager = new ChallengeManager(this.config.challengeManager);
        }

        if(this.config.conditions.length > 0 && !conditions) {
            this.conditions = new UnderAttackConditions(this.config.conditions);
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
            .replace('__CHALLENGE_DATA___', JSON.stringify(this.challengeManager.generateChallengeProblem()))
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

    protected async handleChallengeRequest(request: Request, res: Response, clientIp: string, requestId: string): Promise<Response> {

        const fingerprint = request.body?.fingerprint;
        const data = request.body?.data;
        const challenge = request.body?.challenge;

        if (!fingerprint || !data) {
            this.metrics.incrementFailedChallengeCount();
            return res.status(400).json({success: false, message: 'Invalid request'});
        }

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
                return res.status(403).json({success: false, message: 'Invalid proof timing'});
            }
        }

        // Check the server challenge
        if (challenge && !this.challengeManager.validateChallenge(challenge)) {
            this.log.warn('Challenge validation failed');
            this.metrics.incrementFailedChallengeCount();
            return res.status(403).json({success: false, message: 'Challenge validation failed'});
        }

        // Check the browser fingerprint
        this.log.debug('Validating fingerprint', {fingerprint, data});
        const fingerprintScore = this.fingerprintValidator.validate(fingerprint, {...data, requestId: requestId});

        // Bot check
        const botScore = this.botDetector.detect(request, data, clientIp);

        if (fingerprintScore < this.config.fingerprintChecks.minScore || botScore) {
            this.metrics.incrementRejectedCount();
            return res.status(403).json({success: false, message: 'Challenge failed'});
        }

        // Create a token for a verified client
        const token = this.generateToken();

        this.metrics.incrementPassedCount();
        res.json({success: true, token});
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

}


export interface IUnderAttackConfig {
    enabled?: boolean;
    challengeDurationMs?: number;

    conditions?: UnderAttackConditionConfig[];

    fingerprintChecks?: IFingerprintValidatorConfig;

    botDetection?: IBotDetectorConfig;

    challengeManager?: IChallengeManagerConfig,

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
