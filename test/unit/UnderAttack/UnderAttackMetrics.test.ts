// UnderAttackMetrics.test.ts

import {UnderAttackMetrics} from "@waf/UnderAttack/UnderAttackMetrics";
import {Metrics} from "@waf/Metrics/Metrics";
import {JailManager} from "@waf/Jail/JailManager";
import {Registry} from "prom-client";

describe('UnderAttackMetrics', () => {
    const metricRegister: Registry = new Registry();
    let metrics: UnderAttackMetrics;
    let defaultMetrics: Metrics;

    beforeEach(() => {
        defaultMetrics = new Metrics({
            enabled: true,
            auth: {enabled: false}
        }, jest.mock('express') as any, metricRegister);
        metrics = new UnderAttackMetrics(defaultMetrics);
    });

    afterEach(() => {
        metricRegister.clear();
    });

    it('should increment challenge page shown counter', async () => {

        metrics.incrementChallengePageShown();
        expect(await metricRegister.getSingleMetric('waf_under_attack_challenge_shown').get()).toEqual({
            "aggregator": "sum",
            "help": "Number of times the challenge page was shown",
            "name": "waf_under_attack_challenge_shown",
            "type": "counter",
            "values": [
                {
                    "labels": {},
                    "value": 1
                }
            ]
        });
    });

    it('should increment passed count and active tokens', async () => {
        metrics.incrementPassedCount();

        expect(await metricRegister.getSingleMetric('waf_under_attack_challenge_passed').get()).toEqual({
            "aggregator": "sum",
            "help": "Number of successfully passed challenges",
            "name": "waf_under_attack_challenge_passed",
            "type": "counter",
            "values": [
                {
                    "labels": {},
                    "value": 1
                }
            ]
        });
        expect(await metricRegister.getSingleMetric('waf_under_attack_active_tokens').get()).toEqual({
            "aggregator": "sum",
            "help": "Current number of active tokens",
            "name": "waf_under_attack_active_tokens",
            "type": "gauge",
            "values": [
                {
                    "labels": {},
                    "value": 1
                }
            ]
        });

    });

    it('should increment failed challenge count', async () => {
        metrics.incrementFailedChallengeCount();
        expect(await metricRegister.getSingleMetric('waf_under_attack_challenge_failed').get()).toEqual({
            "aggregator": "sum",
            "help": "Number of failed challenges",
            "name": "waf_under_attack_challenge_failed",
            "type": "counter",
            "values": [
                {
                    "labels": {},
                    "value": 1
                }
            ]
        });

    });

    // it('should increment rejected count', () => {
    //     const rejectedCounterSpy = jest.spyOn((metrics as any).metrics['challenge_rejected'], 'inc');
    //
    //     metrics.incrementRejectedCount();
    //
    //     expect(rejectedCounterSpy).toHaveBeenCalledTimes(1);
    // });
    //
    // it('should increment bypass count', () => {
    //     const bypassCounterSpy = jest.spyOn((metrics as any).metrics['bypass_count'], 'inc');
    //
    //     metrics.incrementBypassCount();
    //
    //     expect(bypassCounterSpy).toHaveBeenCalledTimes(1);
    // });
    //
    // it('should increment valid token count', () => {
    //     const validTokenCounterSpy = jest.spyOn((metrics as any).metrics['valid_token_count'], 'inc');
    //
    //     metrics.incrementValidTokenCount();
    //
    //     expect(validTokenCounterSpy).toHaveBeenCalledTimes(1);
    // });
    //
    // it('should decrement active tokens', () => {
    //     const decSpy = jest.spyOn((metrics as any).metrics['active_tokens'], 'dec');
    //
    //     metrics.decrementActiveTokens();
    //
    //     expect(decSpy).toHaveBeenCalledTimes(1);
    // });
});
