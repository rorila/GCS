import { GameRuntime } from './GameRuntime';

// Mock window and DOM for Node.js environment
if (typeof (global as any).window === 'undefined') {
    (global as any).window = {
        multiplayerManager: null
    };
}

// Mock DOM-Klassen die von Komponenten (TPanel, TLabel) im Konstruktor benötigt werden
if (typeof (global as any).HTMLElement === 'undefined') {
    (global as any).HTMLElement = class MockHTMLElement {
        style: any = {};
        classList = { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false };
        children: any[] = [];
        childNodes: any[] = [];
        innerHTML = '';
        textContent = '';
        id = '';
        appendChild() { return this; }
        removeChild() {}
        setAttribute() {}
        getAttribute() { return null; }
        addEventListener() {}
        removeEventListener() {}
        querySelector() { return null; }
        querySelectorAll() { return []; }
        closest() { return null; }
        getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
        dispatchEvent() { return true; }
        remove() {}
        cloneNode() { return new MockHTMLElement(); }
    };
}
if (typeof (global as any).Node === 'undefined') {
    (global as any).Node = class MockNode {
        ELEMENT_NODE = 1;
        TEXT_NODE = 3;
    };
}
if (typeof (global as any).document === 'undefined') {
    (global as any).document = {
        createElement: () => new (global as any).HTMLElement(),
        createElementNS: () => new (global as any).HTMLElement(),
        createTextNode: () => ({ textContent: '' }),
        body: new (global as any).HTMLElement(),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        activeElement: null,
        dispatchEvent: () => true
    };
}
if (typeof (global as any).requestAnimationFrame === 'undefined') {
    (global as any).requestAnimationFrame = (fn: any) => setTimeout(fn, 0);
}
if (typeof (global as any).cancelAnimationFrame === 'undefined') {
    (global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
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

    // ARCHITEKTUR-FIX (2026-04-26):
    // getObjects() gibt jetzt Original-Proxy-Referenzen zurück (keine Spread-Kopien).
    // Bindings (${...}) werden von der ReactiveRuntime beim Registrieren aufgelöst.
    // Dafür muss der „activeStage"-Pfad im GameRuntime-Konstruktor verwendet werden,
    // da nur dieser Pfad die ReactiveRuntime initialisiert.
    //
    // Objekte verwenden registrierte classNames (TPanel, TLabel).

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
                grid: { cols: 64, rows: 40, cellSize: 20 },
                objects: [
                    { id: 'parent1', name: 'Parent1', className: 'TPanel', x: 10, y: 10, width: 100, height: 100 },
                    { id: 'child1', name: 'Child1', className: 'TLabel', x: '${marginX}', y: '${marginY}', width: 20, height: 20, parentId: 'parent1' },
                    { id: 'testObj', name: 'TestObj', className: 'TLabel', x: 0, y: 0, width: '${btnWidth}', height: '${btnHeight}' },
                    { id: 'testMath', name: 'TestMath', className: 'TLabel', x: '${marginX * 2}', y: 0, width: 10, height: 10 }
                ],
                variables: []
            }
        ],
        activeStageId: 'stage1'
    };

    test('should resolve numeric bindings in x and y coordinates', () => {
        const runtime = new GameRuntime(project, undefined, { makeReactive: true });
        const objects = runtime.getObjects();
        const childProxy = objects.find(o => o.name === 'Child1');

        if (!childProxy) throw new Error('Child1 not found in objects: ' + objects.map(o => o.name).join(', '));
        // ReactiveRuntime löst Bindings sofort bei Registrierung auf (via initializeReactiveBindings)
        if (childProxy.x !== 50) throw new Error(`Expected x=50, got ${childProxy.x}`);
        if (childProxy.y !== 30) throw new Error(`Expected y=30, got ${childProxy.y}`);
    });

    test('should resolve numeric bindings in width and height', () => {
        const runtime = new GameRuntime(project, undefined, { makeReactive: true });
        const objects = runtime.getObjects();
        const proxy = objects.find(o => o.name === 'TestObj');

        if (!proxy) throw new Error('TestObj not found in objects: ' + objects.map(o => o.name).join(', '));
        // ReactiveRuntime löst Bindings sofort bei Registrierung auf
        if (proxy.width !== 120) throw new Error(`Expected width=120, got ${proxy.width}`);
        if (proxy.height !== 40) throw new Error(`Expected height=40, got ${proxy.height}`);
    });

    test('should handle nested math in coordinates', () => {
        const runtime = new GameRuntime(project, undefined, { makeReactive: true });
        const objects = runtime.getObjects();
        const proxy = objects.find(o => o.name === 'TestMath');

        if (!proxy) throw new Error('TestMath not found in objects: ' + objects.map(o => o.name).join(', '));
        // ReactiveRuntime löst Bindings sofort bei Registrierung auf
        if (proxy.x !== 100) throw new Error(`Expected x=100, got ${proxy.x}`);
    });

    return results;
}
