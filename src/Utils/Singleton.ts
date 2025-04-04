export abstract class Singleton<T, Args extends any[]> {
    private static _instances = new Map<new (...args: any[]) => unknown, unknown>();

    static build<T, Args extends unknown[]>(
        this: new (...args: Args) => T,
        ...args: Args
    ): T {
        if (Singleton._instances.has(this)) {
            throw new Error(`${this.name} instance already built.`);
        }

        const instance = new this(...args);
        Singleton._instances.set(this, instance);
        return instance;
    }

    public static get<T>(this: new (...args: any[]) => T): T {
        const instance = Singleton._instances.get(this);
        if (!instance) {
            throw new Error(`${this.name} is not built yet. Call build() first.`);
        }
        return instance as T;
    }

    public static reset(this: any): void {
        Singleton._instances.delete(this);
    }

}
