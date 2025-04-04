// Mock class to test singleton
import {Singleton} from "@waf/Utils/Singleton";

class MockSingleton extends Singleton<MockSingleton, []> {
}

describe('Singleton', () => {

    afterEach(() => {
        MockSingleton.reset();
    });

    test('build() method should create a instance', () => {
        const instance = MockSingleton.build();
        expect(instance).toBeInstanceOf(MockSingleton);
    });

    test('build() method should throw error if called multiple times', () => {
        MockSingleton.build();
        expect(() => MockSingleton.build()).toThrow(Error);
    });

    test('get() method should get the created instance', () => {
        const instance = MockSingleton.build();
        expect(MockSingleton.get()).toBe(instance);
    });

    test('get() method should throw error if called before build()', () => {
        expect(() => MockSingleton.get()).toThrow(Error);
    });

    test('reset() method should remove the created instance', () => {
        MockSingleton.build();
        MockSingleton.reset();
        expect(() => MockSingleton.get()).toThrow();
    });

});
