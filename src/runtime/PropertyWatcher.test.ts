import { PropertyWatcher } from './PropertyWatcher';
import { makeReactive, BatchUpdater } from './ReactiveProperty';

describe('PropertyWatcher', () => {
    let watcher: PropertyWatcher;

    beforeEach(() => {
        watcher = new PropertyWatcher();
    });

    afterEach(() => {
        watcher.clear();
    });

    describe('watch and notify', () => {
        it('should trigger callback when property changes', () => {
            const obj = { score: 0 };
            let callbackValue: any;

            watcher.watch(obj, 'score', (newVal) => {
                callbackValue = newVal;
            });

            watcher.notify(obj, 'score', 100);

            expect(callbackValue).toBe(100);
        });

        it('should pass both new and old values to callback', () => {
            const obj = { score: 50 };
            let newVal: any, oldVal: any;

            watcher.watch(obj, 'score', (n, o) => {
                newVal = n;
                oldVal = o;
            });

            watcher.notify(obj, 'score', 100, 50);

            expect(newVal).toBe(100);
            expect(oldVal).toBe(50);
        });

        it('should support multiple callbacks for same property', () => {
            const obj = { score: 0 };
            const calls: number[] = [];

            watcher.watch(obj, 'score', () => calls.push(1));
            watcher.watch(obj, 'score', () => calls.push(2));

            watcher.notify(obj, 'score', 100);

            expect(calls).toEqual([1, 2]);
        });

        it('should support watching multiple properties', () => {
            const obj = { x: 0, y: 0 };
            const xCalls: number[] = [];
            const yCalls: number[] = [];

            watcher.watch(obj, 'x', (val) => xCalls.push(val));
            watcher.watch(obj, 'y', (val) => yCalls.push(val));

            watcher.notify(obj, 'x', 10);
            watcher.notify(obj, 'y', 20);

            expect(xCalls).toEqual([10]);
            expect(yCalls).toEqual([20]);
        });
    });

    describe('unwatch', () => {
        it('should remove specific callback', () => {
            const obj = { score: 0 };
            let calls = 0;
            const callback = () => calls++;

            watcher.watch(obj, 'score', callback);
            watcher.unwatch(obj, 'score', callback);
            watcher.notify(obj, 'score', 100);

            expect(calls).toBe(0);
        });

        it('should remove all callbacks for property if no callback specified', () => {
            const obj = { score: 0 };
            let calls = 0;

            watcher.watch(obj, 'score', () => calls++);
            watcher.watch(obj, 'score', () => calls++);
            watcher.unwatch(obj, 'score');
            watcher.notify(obj, 'score', 100);

            expect(calls).toBe(0);
        });
    });

    describe('unwatchAll', () => {
        it('should remove all watchers for an object', () => {
            const obj = { x: 0, y: 0 };
            let calls = 0;

            watcher.watch(obj, 'x', () => calls++);
            watcher.watch(obj, 'y', () => calls++);
            watcher.unwatchAll(obj);
            watcher.notify(obj, 'x', 10);
            watcher.notify(obj, 'y', 20);

            expect(calls).toBe(0);
        });
    });

    describe('statistics', () => {
        it('should track watcher count', () => {
            const obj = { score: 0 };

            watcher.watch(obj, 'score', () => { });
            watcher.watch(obj, 'score', () => { });

            expect(watcher.getWatcherCount(obj, 'score')).toBe(2);
        });

        it('should track total watched objects', () => {
            const obj1 = { score: 0 };
            const obj2 = { score: 0 };

            watcher.watch(obj1, 'score', () => { });
            watcher.watch(obj2, 'score', () => { });

            expect(watcher.getTotalWatchedObjects()).toBe(2);
        });

        it('should track total watchers', () => {
            const obj1 = { score: 0 };
            const obj2 = { score: 0 };

            watcher.watch(obj1, 'score', () => { });
            watcher.watch(obj1, 'x', () => { });
            watcher.watch(obj2, 'score', () => { });

            expect(watcher.getTotalWatchers()).toBe(3);
        });
    });
});

describe('makeReactive', () => {
    let watcher: PropertyWatcher;

    beforeEach(() => {
        watcher = new PropertyWatcher();
    });

    it('should trigger watcher on property change', () => {
        const obj = { score: 0 };
        let callbackValue: any;

        const reactive = makeReactive(obj, watcher);
        watcher.watch(obj, 'score', (val) => {
            callbackValue = val;
        });

        reactive.score = 100;

        expect(callbackValue).toBe(100);
    });

    it('should support nested properties', () => {
        const obj = { player: { score: 0 } };
        let callbackValue: any;

        const reactive = makeReactive(obj, watcher);
        watcher.watch(obj.player, 'score', (val) => {
            callbackValue = val;
        });

        reactive.player.score = 100;

        expect(callbackValue).toBe(100);
    });

    it('should not trigger if value does not change', () => {
        const obj = { score: 100 };
        let calls = 0;

        const reactive = makeReactive(obj, watcher);
        watcher.watch(obj, 'score', () => calls++);

        reactive.score = 100; // Same value

        expect(calls).toBe(0);
    });
});

describe('BatchUpdater', () => {
    it('should batch multiple updates', () => {
        const batcher = new BatchUpdater();
        const results: number[] = [];

        batcher.add(() => results.push(1));
        batcher.add(() => results.push(2));
        batcher.add(() => results.push(3));

        expect(results).toEqual([]);

        batcher.execute();

        expect(results).toEqual([1, 2, 3]);
    });

    it('should clear pending updates', () => {
        const batcher = new BatchUpdater();
        const results: number[] = [];

        batcher.add(() => results.push(1));
        batcher.clear();
        batcher.execute();

        expect(results).toEqual([]);
    });

    it('should track pending count', () => {
        const batcher = new BatchUpdater();

        batcher.add(() => { });
        batcher.add(() => { });

        expect(batcher.pendingCount).toBe(2);

        batcher.execute();

        expect(batcher.pendingCount).toBe(0);
    });
});
