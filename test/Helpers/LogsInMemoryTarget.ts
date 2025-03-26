import {AbstractTarget} from "@elementary-lab/logger/src";
import {TargetConfigInterface} from "@elementary-lab/logger/src/Interface/LoggerConfigInterface";

export class LogsInMemoryTarget extends AbstractTarget {
    public constructor(config: TargetConfigInterface) {
        super();
        this.configure(config);
    }

    public export(): Promise<void> {
        return Promise.resolve(undefined);
    }

    public getMessages() {
        return this.messages;
    }

}
