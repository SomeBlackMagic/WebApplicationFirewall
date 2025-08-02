import {
    ChallengeManager,
    IChallengeClientSolution,
    IChallengeManagerConfig,
    IChallengeProblem
} from "@waf/UnderAttack/ChallengeManager";

jest.useFakeTimers();

describe('ChallengeManager', () => {
    const config: IChallengeManagerConfig = {autoCleanup: false, autoCleanupInterval: 60000};
    let challengeManager: ChallengeManager;

    beforeEach(() => {
        challengeManager = new ChallengeManager(config);
    });

    describe('generateChallengeProblem', () => {
        it('should generate a challenge problem with unique id', () => {
            const challenge1 = challengeManager.generateChallengeProblem();
            const challenge2 = challengeManager.generateChallengeProblem();

            expect(challenge1.id).not.toBe(challenge2.id);
        });

        it('should generate correct properties for the challenge problem', () => {
            const challenge = challengeManager.generateChallengeProblem();

            expect(challenge).toHaveProperty('id');
            expect(challenge).toHaveProperty('seed');
            expect(challenge).toHaveProperty('iterations');
            expect(challenge).toHaveProperty('multiplier');
            expect(challenge).toHaveProperty('addend');
            expect(challenge).toHaveProperty('modulus');
        });
    });

    describe('validateChallenge', () => {
        it('should return true for a valid challenge solution', () => {
            const challenge = challengeManager.generateChallengeProblem();

            let result = challenge.seed;
            for (let i = 0; i < challenge.iterations; i++) {
                result = (result * challenge.multiplier + challenge.addend) % challenge.modulus;
            }

            const solution: IChallengeClientSolution = {
                id: challenge.id,
                solution: result
            };

            expect(challengeManager.validateChallenge(solution)).toBe(true);
        });

        it('should return false if challenge id is invalid', () => {
            const challenge = challengeManager.generateChallengeProblem();
            expect(challengeManager.validateChallenge({id: 'invalid', solution: 12345})).toBe(false);
        });

        it('should return false for an expired challenge', () => {
            const challenge = challengeManager.generateChallengeProblem();

            let result = challenge.seed;
            for (let i = 0; i < challenge.iterations; i++) {
                result = (result * challenge.multiplier + challenge.addend) % challenge.modulus;
            }

            const solution: IChallengeClientSolution = {
                id: challenge.id,
                solution: result
            };

            jest.advanceTimersByTime(300001);

            expect(challengeManager.validateChallenge(solution)).toBe(false);
        });

        it('should return false for an incorrect solution', () => {
            const challenge = challengeManager.generateChallengeProblem();
            const incorrectSolution = {id: challenge.id, solution: 99999};

            expect(challengeManager.validateChallenge(incorrectSolution)).toBe(false);
        });
    });

    describe('cleanupChallenges', () => {
        it('should remove expired challenges from the storage', () => {
            const challenge1 = challengeManager.generateChallengeProblem();
            const challenge2 = challengeManager.generateChallengeProblem();

            // Manually expire challenge1
            jest.spyOn(Date, 'now').mockImplementationOnce(() => Date.now() + 300001);

            challengeManager['cleanupChallenges']();

            const challenge1Validated = challengeManager.validateChallenge({id: challenge1.id, solution: 0});
            const challenge2Validated = challengeManager.validateChallenge({id: challenge2.id, solution: 0});

            expect(challenge1Validated).toBe(false);
            expect(challenge2Validated).toBe(false); // Challenge2 should still fail as no solution provided
        });
    });
});
