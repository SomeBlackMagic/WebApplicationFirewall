import * as promClient from 'prom-client';
import {Metrics} from '@waf/Metrics/Metrics';

export class UnderAttackMetrics {
    private metrics: Record<string, promClient.Counter | promClient.Gauge>;


    public constructor(
        private readonly metricsInstance?: Metrics
    ) {
        if(!metricsInstance) {
            this.metricsInstance = Metrics.get();
        }

        this.initializeMetrics();
    }

    private initializeMetrics(): void {
        if (!this.metricsInstance.isEnabled()) {
            return;
        }

        this.metrics = {};

        // Counter for challenge page displays
        this.metrics['challenge_shown'] = new promClient.Counter({
            name: 'waf_under_attack_challenge_shown',
            help: 'Number of times the challenge page was shown',
            registers: [this.metricsInstance.getRegisters()]
        });

        // Counter for successfully passed challenges
        this.metrics['challenge_passed'] = new promClient.Counter({
            name: 'waf_under_attack_challenge_passed',
            help: 'Number of successfully passed challenges',
            registers: [this.metricsInstance.getRegisters()]
        });

        // Counter for failed challenges
        this.metrics['challenge_failed'] = new promClient.Counter({
            name: 'waf_under_attack_challenge_failed',
            help: 'Number of failed challenges',
            registers: [this.metricsInstance.getRegisters()]
        });

        // Counter for rejected requests (bot or low score)
        this.metrics['challenge_rejected'] = new promClient.Counter({
            name: 'waf_under_attack_challenge_rejected',
            help: 'Number of rejected challenges due to bot detection or low score',
            registers: [this.metricsInstance.getRegisters()]
        });

        // Counter for verification bypasses via bypass header
        this.metrics['bypass_count'] = new promClient.Counter({
            name: 'waf_under_attack_bypass_count',
            help: 'Number of requests that bypassed the challenge using bypass header',
            registers: [this.metricsInstance.getRegisters()]
        });

        // Counter for requests with a valid token
        this.metrics['valid_token_count'] = new promClient.Counter({
            name: 'waf_under_attack_valid_token_count',
            help: 'Number of requests with a valid token',
            registers: [this.metricsInstance.getRegisters()]
        });

        // Current number of active tokens
        this.metrics['active_tokens'] = new promClient.Gauge({
            name: 'waf_under_attack_active_tokens',
            help: 'Current number of active tokens',
            registers: [this.metricsInstance.getRegisters()]
        });
    }

    /**
     * Increases the counter of challenge page displays
     */
    public incrementChallengePageShown(): void {
        (this.metrics['challenge_shown'] as promClient.Counter)?.inc();
    }

    /**
     * Increases the counter of successfully passed checks
     */
    public incrementPassedCount(): void {
        (this.metrics['challenge_passed'] as promClient.Counter)?.inc();
        (this.metrics['active_tokens'] as promClient.Gauge)?.inc();
    }

    /**
     * Increases the counter of failed checks
     */
    public incrementFailedChallengeCount(): void {
        (this.metrics['challenge_failed'] as promClient.Counter)?.inc();
    }

    /**
     * Increases the counter of rejected requests
     */
    public incrementRejectedCount(): void {
        (this.metrics['challenge_rejected'] as promClient.Counter)?.inc();
    }

    /**
     * Increases the bypass counter
     */
    public incrementBypassCount(): void {
        (this.metrics['bypass_count'] as promClient.Counter)?.inc();
    }

    /**
     * Increases the counter of requests with valid token
     */
    public incrementValidTokenCount(): void {
        (this.metrics['valid_token_count'] as promClient.Counter)?.inc();
    }

    /**
     * Decreases the counter of active tokens
     */
    public decrementActiveTokens(): void {
        (this.metrics['active_tokens'] as promClient.Gauge)?.dec();
    }
}
