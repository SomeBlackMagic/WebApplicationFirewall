import {
    FingerprintValidator,
    IBrowserFingerprint,
    IFingerprintValidatorConfig
} from '../../src/UnderAttack/FingerprintValidator';
import {BrowserProofValidator} from '@waf/UnderAttack/BrowserProofValidator';
import {UnderAttackMetrics} from '@waf/UnderAttack/UnderAttackMetrics';
import {Registry} from "prom-client";
// @ts-ignore
import {MetricsHelper} from "@test/Helpers/MetricsHelper";
import fs from "fs";


describe('UnderAttackFingerPrint', () => {
    let fingerprintValidator: FingerprintValidator;
    let browserProofValidator: BrowserProofValidator;
    let metricRegister: Registry;
    let moduleMetric: UnderAttackMetrics;
    let config: IFingerprintValidatorConfig;

    // Test constants
    const REQUEST_ID = 'request-123';

    beforeEach(() => {
        config = {
            enabled: true,
            minScore: 70
        };
        jest.useFakeTimers();
        jest.spyOn(global, 'setInterval');

        metricRegister = new Registry();
        moduleMetric = new UnderAttackMetrics(MetricsHelper.buildMetrics(metricRegister))

        browserProofValidator = new BrowserProofValidator({
            enabled: true,
            validateProofFreshness: false
        }, moduleMetric);
        fingerprintValidator = new FingerprintValidator(config, browserProofValidator, moduleMetric);
    });

    const testObject: object[] = JSON.parse(fs.readFileSync('./test/functional/data/fingerprint.json', 'utf8'));
    // Test data structure for it.each
    type TestCaseData = [
        string,                   // Test description
        Partial<IBrowserFingerprint>, // Fingerprint modifications
        Partial<IFingerprintValidatorConfig>, // Configuration modifications
            number | null,            // Expected exact score (null if exact value doesn't matter)
        (score: number) => void   // Result verification function
    ];


    // Test data set for it.each
    const testCasesConfig: TestCaseData[] = [
        [
            'should return 100 when validation send real data', // Name
            {}, // No fingerprint modifications
            {enabled: true}, // config
            100,
            (score: number) => expect(score).toBe(100)
        ],

    ];

    // @ts-ignore
    let testCases: TestCaseData[] = testObject.map<TestCaseData>((item: any, index: number) => {
        if (!testCasesConfig[index]) {
            return [
                'should return 100 when validation send real data',
                item,
                {enabled: true}, // config
                100,
                (score: number) => expect(score).toBe(100)
            ];
        } else {
            return [
                testCasesConfig[index][0],
                item,
                testCasesConfig[index][2],
                testCasesConfig[index][3],
                testCasesConfig[index][4]
            ]
        }
    });
    testCases = testCases.filter((item: TestCaseData, index: number) => {
        return true;
        // return index === 6;
        // return item[1] && item[1]['userAgent'].includes('Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15');
    });

    it.each(testCases)('%s', async (description, fingerprintModifications, configModifications, expectedExactScore, assertionFn) => {
            const baseFingerprint = {};
            const testFingerprint = {...baseFingerprint, ...fingerprintModifications};

            if (Object.keys(configModifications).length > 0) {
                config = {...config, ...configModifications};
                fingerprintValidator = new FingerprintValidator(config, browserProofValidator, moduleMetric);
            }

            // @ts-ignore
            const score = fingerprintValidator.calculateScore(
                testFingerprint as IBrowserFingerprint,
            );

            if (expectedExactScore !== null) {
                expect(score).toBe(expectedExactScore);
            }
            assertionFn(score);


        }
    );
});
