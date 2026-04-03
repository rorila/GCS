import { GameRuntime } from './GameRuntime';
import { TWindow } from '../components/TWindow';

// Mock window for Node.js environment
if (typeof (global as any).window === 'undefined') {
    (global as any).window = {
        multiplayerManager: null
    };
}

export async function runTests() {
    const results: any[] = [];
    const test = (name: string, fn: () => void) => {
        try {
            fn();
            results.push({ name, passed: true, type: 'Happy Path', actualSuccess: true, expectedSuccess: true });
        } catch (e: any) {
            results.push({ name, passed: false, type: 'Happy Path', actualSuccess: false, expectedSuccess: true, details: e.message });
        }
    };

    const project = {
        variables: [
            { name: 'marginX', value: 50, type: 'integer' },
            { name: 'marginY', value: 30, type: 'integer' },
            { name: 'btnWidth', value: 120, type: 'integer' },
            { name: 'btnHeight', value: 40, type: 'integer' }
        ],
        stages: [
            {
                id: 'stage1',
                name: 'Main Stage',
                objects: []
            }
        ],
        activeStageId: 'stage1'
    };

    test('should resolve numeric bindings in x and y coordinates', () => {
        const parent = new TWindow('parent', 10, 10, 100, 100);
        const child = new TWindow('child', 0, 0, 20, 20);
        (child as any).x = '${marginX}';
        (child as any).y = '${marginY}';
        parent.children = [child];

        const runtime = new GameRuntime(project, [parent], { makeReactive: true });
        const objects = runtime.getObjects();
        const childProxy = objects.find(o => o.name === 'child');

        if (!childProxy) throw new Error('Child not found');
        if (childProxy.x !== 50) throw new Error(`Expected x=50, got ${childProxy.x}`);
        if (childProxy.y !== 30) throw new Error(`Expected y=30, got ${childProxy.y}`);
    });

    test('should resolve numeric bindings in width and height', () => {
        const obj = new TWindow('test', 0, 0, 10, 10);
        (obj as any).width = '${btnWidth}';
        (obj as any).height = '${btnHeight}';

        const runtime = new GameRuntime(project, [obj], { makeReactive: true });
        const objects = runtime.getObjects();
        const proxy = objects.find(o => o.name === 'test');

        if (proxy.width !== 120) throw new Error(`Expected width=120, got ${proxy.width}`);
        if (proxy.height !== 40) throw new Error(`Expected height=40, got ${proxy.height}`);
    });

    test('should handle nested math in coordinates', () => {
        const obj = new TWindow('test', 0, 0, 10, 10);
        (obj as any).x = '${marginX * 2}';

        const runtime = new GameRuntime(project, [obj], { makeReactive: true });
        const objects = runtime.getObjects();
        const proxy = objects.find(o => o.name === 'test');

        if (proxy.x !== 100) throw new Error(`Expected x=100, got ${proxy.x}`);
    });

    return results;
}
