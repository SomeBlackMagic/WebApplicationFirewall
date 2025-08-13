import * as promClient from 'prom-client';
import {Metrics} from '@waf/Metrics/Metrics';
import {Singleton} from "@waf/Utils/Singleton";

export class UnderAttackMetrics  extends Singleton<UnderAttackMetrics, []> {
    private metrics: Record<string, promClient.Counter | promClient.Gauge | promClient.Histogram> = {};


    public constructor(
        private readonly metricsInstance?: Metrics
    ) {
        super();
        if(!metricsInstance) {
            this.metricsInstance = Metrics.get();
        }

        this.initializeMetrics();
    }

    private initializeMetrics(): void {
        // Counter for challenge page displays
        this.metrics['challenge_shown'] = new promClient.Counter({
            name: 'waf_under_attack_challenge_shown',
            help: 'Number of times the challenge page was shown',
            registers: [this.metricsInstance.getRegisters()]
        });

        // Bot Detection Metrics
        this.metrics['bot_detection_total'] = new promClient.Counter({
            name: 'waf_under_attack_bot_detection_total',
            help: 'Total number of bot detection checks performed',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['bot_detection_known_bot'] = new promClient.Counter({
            name: 'waf_under_attack_bot_detection_known_bot',
            help: 'Number of requests identified as known bots by User-Agent',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['bot_detection_suspicious_patterns'] = new promClient.Counter({
            name: 'waf_under_attack_bot_detection_suspicious_patterns',
            help: 'Number of requests identified as bots due to suspicious patterns',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['bot_detection_automation_headers'] = new promClient.Counter({
            name: 'waf_under_attack_bot_detection_automation_headers',
            help: 'Number of requests identified as bots due to automation headers',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['bot_detection_timing_anomaly'] = new promClient.Counter({
            name: 'waf_under_attack_bot_detection_timing_anomaly',
            help: 'Number of requests identified as bots due to challenge timing anomalies',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['bot_detection_client_data'] = new promClient.Counter({
            name: 'waf_under_attack_bot_detection_client_data',
            help: 'Number of requests identified as bots based on client-side data',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['bot_detection_high_suspicion'] = new promClient.Counter({
            name: 'waf_under_attack_bot_detection_high_suspicion',
            help: 'Number of requests with high suspicion score',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['bot_suspicion_score'] = new promClient.Histogram({
            name: 'waf_under_attack_bot_suspicion_score',
            help: 'Distribution of bot suspicion scores (0-1)',
            buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
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

        // Histogram for tracking fingerprint validation scores
        this.metrics['fingerprint_score'] = new promClient.Histogram({
            name: 'waf_under_attack_fingerprint_score',
            help: 'Distribution of fingerprint validation scores (0-100)',
            buckets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
            registers: [this.metricsInstance.getRegisters()]
        });

        // Counters for tracking reasons of validation score reduction
        this.metrics['validation_failure_short_fingerprint'] = new promClient.Counter({
            name: 'waf_under_attack_validation_short_fingerprint',
            help: 'Number of rejections due to excessively short fingerprint',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['validation_failure_missing_components'] = new promClient.Counter({
            name: 'waf_under_attack_validation_missing_components',
            help: 'Number of rejections due to missing essential browser components',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['validation_failure_missing_proofs'] = new promClient.Counter({
            name: 'waf_under_attack_validation_missing_proofs',
            help: 'Number of rejections due to missing browser proofs',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['validation_failure_inconsistencies'] = new promClient.Counter({
            name: 'waf_under_attack_validation_inconsistencies',
            help: 'Number of rejections due to browser data inconsistencies',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['validation_failure_screen_anomalies'] = new promClient.Counter({
            name: 'waf_under_attack_validation_screen_anomalies',
            help: 'Number of rejections due to screen anomalies',
            registers: [this.metricsInstance.getRegisters()]
        });

        // Counters for tracking types of browser proof failures
        this.metrics['proof_failure_canvas'] = new promClient.Counter({
            name: 'waf_under_attack_proof_canvas_failure',
            help: 'Number of Canvas proof verification failures',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['proof_failure_webgl'] = new promClient.Counter({
            name: 'waf_under_attack_proof_webgl_failure',
            help: 'Number of WebGL proof verification failures',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['proof_failure_timing'] = new promClient.Counter({
            name: 'waf_under_attack_proof_timing_failure',
            help: 'Number of Timing proof verification failures',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['proof_failure_performance'] = new promClient.Counter({
            name: 'waf_under_attack_proof_performance_failure',
            help: 'Number of Performance proof verification failures',
            registers: [this.metricsInstance.getRegisters()]
        });

        this.metrics['proof_failure_css'] = new promClient.Counter({
            name: 'waf_under_attack_proof_css_failure',
            help: 'Number of CSS proof verification failures',
            registers: [this.metricsInstance.getRegisters()]
        });

        // Histogram for tracking proof generation time
        this.metrics['proof_generation_time'] = new promClient.Histogram({
            name: 'waf_under_attack_proof_generation_time',
            help: 'Proof generation time in milliseconds',
            buckets: [50, 100, 200, 500, 1000, 2000, 5000],
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

    /**
     * Records fingerprint score in metrics
     */
    public recordFingerprintScore(score: number): void {
        (this.metrics['fingerprint_score'] as promClient.Histogram)?.observe(score);
    }

    /**
     * Records proof generation time
     */
    public recordProofGenerationTime(time: number): void {
        (this.metrics['proof_generation_time'] as promClient.Histogram)?.observe(time);
    }

    /**
     * Increases validation failure counter due to short fingerprint
     */
    public incrementShortFingerprintFailure(): void {
        (this.metrics['validation_failure_short_fingerprint'] as promClient.Counter)?.inc();
    }

    /**
     * Increases validation failure counter due to missing components
     */
    public incrementMissingComponentsFailure(): void {
        (this.metrics['validation_failure_missing_components'] as promClient.Counter)?.inc();
    }

    /**
     * Increases validation failure counter due to missing proofs
     */
    public incrementMissingProofsFailure(): void {
        (this.metrics['validation_failure_missing_proofs'] as promClient.Counter)?.inc();
    }

    /**
     * Increases validation failure counter due to data inconsistencies
     */
    public incrementInconsistenciesFailure(): void {
        (this.metrics['validation_failure_inconsistencies'] as promClient.Counter)?.inc();
    }

    /**
     * Increases validation failure counter due to screen anomalies
     */
    public incrementScreenAnomaliesFailure(): void {
        (this.metrics['validation_failure_screen_anomalies'] as promClient.Counter)?.inc();
    }

    /**
     * Increases Canvas proof validation failure counter
     */
    public incrementCanvasProofFailure(): void {
        (this.metrics['proof_failure_canvas'] as promClient.Counter)?.inc();
    }

    /**
     * Increases WebGL proof validation failure counter
     */
    public incrementWebGLProofFailure(): void {
        (this.metrics['proof_failure_webgl'] as promClient.Counter)?.inc();
    }

    /**
     * Increases Timing proof validation failure counter
     */
    public incrementTimingProofFailure(): void {
        (this.metrics['proof_failure_timing'] as promClient.Counter)?.inc();
    }

    /**
     * Increases Performance proof validation failure counter
     */
    public incrementPerformanceProofFailure(): void {
        (this.metrics['proof_failure_performance'] as promClient.Counter)?.inc();
    }

    /**
     * Increases CSS proof validation failure counter
     */
    public incrementCSSProofFailure(): void {
        (this.metrics['proof_failure_css'] as promClient.Counter)?.inc();
    }

    /**
     * Increments the bot detection check counter
     */
    public incrementBotDetectionTotal(): void {
        (this.metrics['bot_detection_total'] as promClient.Counter)?.inc();
    }

    /**
     * Increments the counter for known bots detected by User-Agent
     */
    public incrementKnownBotDetection(): void {
        (this.metrics['bot_detection_known_bot'] as promClient.Counter)?.inc();
    }

    /**
     * Increments the counter for suspicious request patterns detection
     */
    public incrementSuspiciousPatternsDetection(): void {
        (this.metrics['bot_detection_suspicious_patterns'] as promClient.Counter)?.inc();
    }

    /**
     * Increments the counter for automation headers detection
     */
    public incrementAutomationHeadersDetection(): void {
        (this.metrics['bot_detection_automation_headers'] as promClient.Counter)?.inc();
    }

    /**
     * Increments the counter for challenge timing anomalies detection
     */
    public incrementTimingAnomalyDetection(): void {
        (this.metrics['bot_detection_timing_anomaly'] as promClient.Counter)?.inc();
    }

    /**
     * Increments the counter for bot detection based on client data
     */
    public incrementClientDataDetection(): void {
        (this.metrics['bot_detection_client_data'] as promClient.Counter)?.inc();
    }

    /**
     * Increments the counter for requests with high suspicion score
     */
    public incrementHighSuspicionDetection(): void {
        (this.metrics['bot_detection_high_suspicion'] as promClient.Counter)?.inc();
    }

    /**
     * Records the suspicion score of a request
     */
    public recordSuspicionScore(score: number): void {
        (this.metrics['bot_suspicion_score'] as promClient.Histogram)?.observe(score);
    }
}
