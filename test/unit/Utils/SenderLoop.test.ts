// SenderLoop.test.ts

import {SenderLoop} from "@waf/Utils/SenderLoop";

describe('SenderLoop', () => {
    let senderLoop: SenderLoop;

    beforeEach(() => {
        senderLoop = new SenderLoop();
    });

    afterEach(() => {
        senderLoop.stop();
    });

    it('should start the loop and execute the callback', async () => {
        const callback = jest.fn().mockResolvedValue(true);
        const delay = 100;

        senderLoop.start(callback, delay);

        await new Promise((resolve) => setTimeout(resolve, delay + 50));

        expect(callback).toHaveBeenCalled();
    });

    it('should stop the loop and not execute the callback again', async () => {
        const callback = jest.fn().mockResolvedValue(true);
        const delay = 100;

        senderLoop.start(callback, delay);
        senderLoop.stop();

        await new Promise((resolve) => setTimeout(resolve, delay + 50));

        expect(callback).toHaveBeenCalledTimes(0);
    });

    it('should stop the loop if callback returns false', async () => {
        const callback = jest.fn()
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        const delay = 100;

        senderLoop.start(callback, delay);

        await new Promise((resolve) => setTimeout(resolve, delay * 3));

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in the callback without stopping the loop', async () => {
        const callback = jest.fn()
            .mockRejectedValueOnce(new Error('Test Error'))
            .mockResolvedValue(true);
        const delay = 100;

        senderLoop.start(callback, delay);

        await new Promise((resolve) => setTimeout(resolve, delay * 3));

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should not start the loop again if it is already running', async () => {
        const callback = jest.fn().mockResolvedValue(true);
        const delay = 100;

        senderLoop.start(callback, delay);
        senderLoop.start(callback, delay); // Second call to start

        await new Promise((resolve) => setTimeout(resolve, delay * 3));

        expect(callback).toHaveBeenCalledTimes(2);
    });
});
