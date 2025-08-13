import {
    FingerprintValidator,
    IClientFingerprint,
    IFingerprintValidatorConfig
} from "@waf/UnderAttack/FingerprintValidator";
import {BrowserProofValidator} from "@waf/UnderAttack/BrowserProofValidator";
import {Registry} from "prom-client";
import {UnderAttackMetrics} from "@waf/UnderAttack/UnderAttackMetrics";
import {MetricsHelper} from "@test/Helpers/MetricsHelper";

describe('FingerprintValidator', () => {
    let metricRegister: Registry;
    let underAttackMetrics: UnderAttackMetrics;
    const mockConfig: IFingerprintValidatorConfig = {
        enabled: true,
        minScore: 50,
    };

    const mockBrowserProofValidator = {
        validateBrowserProofs: jest.fn(() => 80),
    } as unknown as BrowserProofValidator;

    let fingerprintValidator: FingerprintValidator;

    beforeEach(() => {
        metricRegister = new Registry();
        underAttackMetrics = new UnderAttackMetrics(MetricsHelper.buildMetrics(metricRegister))
        fingerprintValidator = new FingerprintValidator(mockConfig, mockBrowserProofValidator, underAttackMetrics);
    });

    it('should return a score of 100 when validation is disabled', () => {
        const disabledConfig: IFingerprintValidatorConfig = {enabled: false, minScore: 50};
        const validator = new FingerprintValidator(disabledConfig, mockBrowserProofValidator, underAttackMetrics);

        const result = validator.validate('validfingerprint', {requestId: '12345'});
        expect(result).toBe(100);
    });

    it('should reduce score if fingerprint is too short', () => {
        const result = fingerprintValidator.validate('short', {
            requestId: '12345'
        });
        expect(result).toBeLessThan(100);
    });

    it('should return a lower score if some core components are missing', () => {
        const data: IClientFingerprint = {
            requestId: '12345',
            userAgent: 'test-agent'
        };
        const result = fingerprintValidator.validate('validfingerprint', data);
        expect(result).toBeLessThan(100);
    });

    it('should use the browser proof score if it is lower than the current score', () => {
        const data: IClientFingerprint = {
            requestId: '12345',
            userAgent: 'test-agent',
            language: 'en',
            screenResolution: {width: 1920, height: 1080},
            browserProofs: {},
        };
        const result = fingerprintValidator.validate('validfingerprint', data);
        expect(result).toBe(80);
        expect(mockBrowserProofValidator.validateBrowserProofs).toHaveBeenCalledWith({}, '12345', 'test-agent');
    });

    it('should significantly reduce score if browser proofs are missing', () => {
        const data: IClientFingerprint = {
            requestId: '12345',
            userAgent: 'test-agent',
            language: 'en',
            screenResolution: {width: 1920, height: 1080},
        };
        const result = fingerprintValidator.validate('validfingerprint', data);
        expect(result).toBeLessThan(100);
        expect(result).toBeGreaterThan(0);
    });

    it('should reduce score if inconsistencies are detected', () => {
        const inconsistentData: IClientFingerprint = {
            requestId: '12345',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
            platform: 'MacIntel',
            screenResolution: {width: 1920, height: 1080},
        };
        const result = fingerprintValidator.validate('validfingerprint', inconsistentData);
        expect(result).toBeLessThan(100);
    });

    it('should reduce score if screen anomalies are detected', () => {
        const dataWithAnomalies: IClientFingerprint = {
            requestId: '12345',
            userAgent: 'Mozilla/5.0',
            screenResolution: {width: 9999, height: 9999},
        };
        const result = fingerprintValidator.validate('validfingerprint', dataWithAnomalies);
        expect(result).toBeLessThan(100);
    });

    it('should reduce score significantly if client data is missing', () => {
        const result = fingerprintValidator.validate('validfingerprint', undefined as unknown as IClientFingerprint);
        expect(result).toBeLessThan(100);
        expect(result).toBeGreaterThanOrEqual(0);
    });

    // it('should ensure the score is not below 0', () => {
    //     const result = fingerprintValidator.validate('', undefined as unknown as IClientFingerprint);
    //     expect(result).toBe(0);
    // });

    it('should ensure the score is not above 100', () => {
        const overlyHighScoreConfig: IFingerprintValidatorConfig = {enabled: true, minScore: 50};
        const validator = new FingerprintValidator(overlyHighScoreConfig, mockBrowserProofValidator, underAttackMetrics);
        const result = validator.validate('validfingerprint', {requestId: '12345'});
        expect(result).toBeLessThanOrEqual(100);
    });
});
