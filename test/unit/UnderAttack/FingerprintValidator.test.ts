import {
    FingerprintValidator,
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

});
