export class SenderLoop {
    private isRunning: boolean = false;
    private timeoutId: NodeJS.Timeout | null = null;

    public start(callback: () => Promise<boolean>, delay: number): void {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.scheduleNext(callback, delay);
    }

    public stop(): void {
        this.isRunning = false;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    private scheduleNext(callback: { (): Promise<boolean> }, delay: number): void {
        if (!this.isRunning) {
            return;
        }

        this.timeoutId = setTimeout(async () => {
            if (!this.isRunning) {
                return;
            }

            try {
                const shouldContinue = await callback();
                if (!shouldContinue) {
                    this.stop();
                    return;
                }
            } catch (error) {
                console.error('Error in callback:', error);
            }

            this.scheduleNext(callback, delay);
        }, delay);
    }
}
