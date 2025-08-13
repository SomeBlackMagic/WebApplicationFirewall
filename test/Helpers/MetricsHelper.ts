import {Metrics} from "@waf/Metrics/Metrics";
import {Registry} from "prom-client";

export class MetricsHelper {
    public static buildMetrics(metricRegister: Registry): Metrics {
        return new Metrics({
            enabled: true,
            auth: {enabled: false}
        }, jest.mock('express') as any, metricRegister);
    }
}
