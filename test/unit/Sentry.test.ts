
import * as SentryLib from '@sentry/node';
import {EventHint} from "@sentry/node";
import {Sentry} from "@waf/Sentry";

jest.mock('console');

describe('Sentry', () => {
    let sentryInstance: Sentry;
    const mockConfig = {
        enabled: true,
        dsn: "https://testPublicKey@o0.ingest.sentry.io/0",
        release: "1.0.0",
        debug: true
    };

    beforeAll(() => {
        // Create a new instance of Sentry before each test
        sentryInstance = new Sentry(mockConfig, "1.0.0");
    });

    test('getClient', () => {
        expect(sentryInstance.getClient()).toBeInstanceOf(SentryLib.NodeClient);
    });

    test('captureException', () => {
        const mockException = new Error('Test error');
        const mockHint: EventHint = {};
        expect(sentryInstance.captureException(mockException, mockHint)).toHaveLength(32);
    });
});
