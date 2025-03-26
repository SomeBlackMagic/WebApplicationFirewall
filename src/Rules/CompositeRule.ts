import {AbstractRule, IAbstractRuleConfig} from "./AbstractRule";
import {NextFunction, Request, Response} from "express-serve-static-core";
import {GeoIP2} from "../GeoIP2";
import {Log} from "../Log";
import {JailManager} from "../Jail/JailManager";
import {LoggerInterface} from "@elementary-lab/standards/src/LoggerInterface";


export class CompositeRule extends AbstractRule {

    // public static GARBAGE_TIME_PERIOD: number = 60 * 1000;
    public static ID: string = 'composite';

    public constructor(
        private rule: ICompositeRuleConfig,
        private log?: LoggerInterface
    ) {
        super();
        if (!log) {
            this.log = Log.instance.withCategory('rules.compositeRule');
        }
    }

    private compositeCounters = {};

    public async use(clientIp: string, req: Request, res: Response, next: NextFunction): Promise<boolean> {
        let filterValue = ''
        switch (this.rule.for.key) {
            case 'url':
                filterValue = req.url
                break;
        }

        if (this.rule.for.correlationMethod == 'eq') {
            if (filterValue !== this.rule.for.value) {
                this.log.trace('Request ' + req.header('x-request-id') + ' skipped ', [filterValue, this.rule.for.value])
                return false
            }
        } else if (this.rule.for.correlationMethod === 'regexp') {
            if (filterValue.match(this.createRegexFromString(this.rule.for.value)) == null) {
                this.log.trace('Request ' + req.header('x-request-id') + ' skipped ', [filterValue, this.rule.for.value])
                return false;
            }
        }
        // We form an integral key
        const keyParts = this.rule.keys.map(k => {
            switch (k) {
                case 'ip':
                    return clientIp;
                case 'user-agent':
                    return req.headers['user-agent'] || 'user-agent-not-detected';
                case 'url':
                    return req.url;
                case 'geo-country': {
                    return GeoIP2.instance.getCountry(clientIp)?.country?.names?.en || 'undefined';
                }
                case 'geo-city': {
                    return GeoIP2.instance.getCity(clientIp)?.city?.names?.en || 'undefined';
                }
                default:
                    return '-';
            }
        });
        const compositeKey = keyParts.join('|');

        // Initialize an array for this key
        if (!this.compositeCounters[compositeKey]) {
            this.compositeCounters[compositeKey] = [];
        }

        const now = Date.now();
        const periodMs = (this.rule.period || 60) * 1000;
        // We delete old notes (outside the period)
        this.compositeCounters[compositeKey] = this.compositeCounters[compositeKey].filter(ts => now - ts <= periodMs);

        // Add the current request
        this.compositeCounters[compositeKey].push(now);
        this.log.debug('Composite counter by key:' + compositeKey, this.compositeCounters[compositeKey].length);

        // If the number of queries exceeds the limit, we block IP
        if (this.compositeCounters[compositeKey].length >= (this.rule.limit || 100)) {
            this.log.info(`The composite rule worked for ${clientIp} (key: ${compositeKey}). request: ${this.compositeCounters[compositeKey].length}`, [], 'rules.CompositeRule');
            await JailManager.instance.blockIp(clientIp, this.rule.duration, this.rule?.escalationRate || 1.0 );
            return true;
        }

        return false;

    }

    /**
     *  TODO implement cleaner memory
     * @private
     */
    // private cleanCompositeCounters() {
    //     const now = Date.now();
    //
    //     // We sort out all the composite keys for this rule
    //     for (const compositeKey in this.compositeCounters) {
    //         // We filter temporary marks: leave only those that fit during the period
    //         this.compositeCounters[compositeKey] = this.compositeCounters[compositeKey].filter(ts => now - ts <= CompositeRule.GARBAGE_TIME_PERIOD);
    //         // If after filtering the array is empty, remove the key
    //         if (this.compositeCounters[compositeKey].length === 0) {
    //             delete this.compositeCounters[compositeKey];
    //         }
    //     }
    // }


}

export interface ICompositeRuleConfig extends IAbstractRuleConfig {
    for: {
        key: string;
        correlationMethod: string;
        value: string;
    }
    keys: string[]
    limit: number
    period: number
    duration: number
    escalationRate?: number

}
