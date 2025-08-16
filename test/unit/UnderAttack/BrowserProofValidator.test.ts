
import {BrowserProofValidator} from "@waf/UnderAttack/BrowserProofValidator";
import {Registry} from "prom-client";
import {UnderAttackMetrics} from "@waf/UnderAttack/UnderAttackMetrics";
import {MetricsHelper} from "@test/Helpers/MetricsHelper";

describe('BrowserProofValidator', () => {
    let browserProofValidator: BrowserProofValidator;
    let metricRegister: Registry;


    beforeEach(() => {
        metricRegister = new Registry();
        const moduleMetric = new UnderAttackMetrics(MetricsHelper.buildMetrics(metricRegister))
        browserProofValidator = new BrowserProofValidator({
            enabled: true,
            validateProofFreshness: false
        }, moduleMetric);
    });


    it('should return 0 when no proofs are provided', () => {
        const result = browserProofValidator.validateBrowserProofs({}, '', '');
        expect(result).toBe(30);
    });


});

