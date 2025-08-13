import {LoggerInterface} from '@elementary-lab/standards/src/LoggerInterface';
import {Log} from '@waf/Log';
import * as crypto from 'crypto';
import {merge} from "lodash";


/**
 * Class for managing checks with mathematical tasks (Proof of work)
 */
export class ChallengeManager {
    private challengeSolutions: Map<string, IChallengeSolution> = new Map();
    private readonly cleanupInterval: NodeJS.Timeout = null;

    public constructor(
        private readonly config?: IChallengeManagerConfig,
        private readonly log?: LoggerInterface,
    ) {
        this.config = merge<object | IChallengeManagerConfig, IChallengeManagerConfig>({
            autoCleanup: true,
            autoCleanupInterval: 60 * 60 * 1000,
        }, config);

        if (!this.log) {
            this.log = Log.instance.withCategory('app.UnderAttack.ChallengeManager');
        }

        if (this.config.autoCleanup) {
            this.cleanupInterval = setInterval(() => this.cleanupChallenges(), this.config.autoCleanupInterval);
            process.on('exit', () => clearInterval(this.cleanupInterval));
        }

    }

    /**
     * Generates a new mathematical task for checking
     */
    public generateChallengeProblem(): IChallengeProblem {
        const challengeId = crypto.randomBytes(16).toString('hex');
        this.log.debug('Generated challenge', {id: challengeId});
        const seed = Math.floor(Math.random() * 1000000);
        const iterations = 1000 + Math.floor(Math.random() * 2000);
        const multiplier = 1103515245;
        const addend = 12345;
        const modulus = 2147483647;

        // Calculate the correct answer
        let expectedResult = seed;
        for (let i = 0; i < iterations; i++) {
            expectedResult = (expectedResult * multiplier + addend) % modulus;
        }

        // Store the correct answer
        this.challengeSolutions.set(challengeId, {
            result: expectedResult,
            timestamp: Date.now()
        });

        return {
            id: challengeId,
            seed,
            iterations,
            multiplier,
            addend,
            modulus
        };
    }

    /**
     * Validates challenge solution
     */
    public validateChallenge(challenge: IChallengeClientSolution): boolean {
        if (!challenge || !challenge.id || challenge.solution === undefined) {
            return false;
        }

        const storedChallenge = this.challengeSolutions.get(challenge.id);

        if (!storedChallenge) {
            this.log.debug('Challenge not found', {id: challenge.id});
            return false;
        }

        // Check time (not more than 5 minutes)
        if (Date.now() - storedChallenge.timestamp > 300000) {
            this.log.debug('Challenge expired', {id: challenge.id});
            this.challengeSolutions.delete(challenge.id);
            return false;
        }

        // Check the correctness of the solution
        const isValid = storedChallenge.result === challenge.solution;

        // Delete the used challenge
        this.challengeSolutions.delete(challenge.id);

        if (!isValid) {
            this.log.debug('Invalid challenge solution', {
                id: challenge.id,
                expected: storedChallenge.result,
                actual: challenge.solution
            });
        }

        return isValid;
    }

    /**
     * Cleans up expired challenges
     */
    private cleanupChallenges(): void {
        const fiveMinutesAgo = Date.now() - 300000;

        for (const [id, solution] of this.challengeSolutions.entries()) {
            if (solution.timestamp < fiveMinutesAgo) {
                this.challengeSolutions.delete(id);
            }
        }

        this.log.debug('Challenge cleanup completed', {
            remainingCount: this.challengeSolutions.size
        });
    }
}

export interface IChallengeManagerConfig {
    autoCleanup: boolean;
    autoCleanupInterval: number;
}

/**
 * Challenge task interface
 */
export interface IChallengeProblem {
    id: string;
    seed: number;
    iterations: number;
    multiplier: number;
    addend: number;
    modulus: number;
}

/**
 * Challenge solution interface
 */
export interface IChallengeSolution {
    result: number;
    timestamp: number;
}

export interface IChallengeClientSolution {
    id: string;
    solution: number;
}
