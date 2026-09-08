import { strict as assert } from 'node:assert';
import { componentRegistry } from '../src/services/ComponentRegistry';
import type { TComponent } from '../src/components/TComponent';

export function runNonvisualInspectorTests() {
    const results: { name: string; type: string; passed: boolean; expectedSuccess: boolean; actualSuccess: boolean; details?: string }[] = [];
    const check = (name: string, fn: () => void) => {
        try { fn(); results.push({ name, type: 'Inspector', passed: true, expectedSuccess: true, actualSuccess: true }); }
        catch (error) { results.push({ name, type: 'Inspector', passed: false, expectedSuccess: true, actualSuccess: false, details: String(error) }); }
    };
    const make = (className: string): TComponent => {
        const instance = componentRegistry.createInstance({ className, name: 'InspectorTest', x: 3, y: 4 });
        assert.ok(instance, className + ' muss registriert sein');
        return instance;
    };
    const names = (instance: TComponent) => instance.getInspectorSections().flatMap(s => s.properties.map(p => p.name));
    const forbidden = ['visible', 'x', 'y', 'width', 'height', 'rotation', 'align', 'zIndex', 'collisionEnabled', 'draggable', 'droppable', 'dragMode'];
    const functional: Record<string, string[]> = {
        TVariable: ['type', 'defaultValue', 'value'], TTimer: ['interval', 'enabled', 'maxInterval'],
        TIntervalTimer: ['duration', 'count', 'enabled'], TGameLoop: ['targetFPS', 'boundaryMode'],
        TSpawner: ['spawnX', 'spawnY', 'spawnInterval'], TAnimation: ['imageListId', 'frameDuration', 'enabled']
    };
    for (const className of ['TVariable', 'TIntegerVariable', 'TListVariable', 'TStringMap', 'TTimer', 'TIntervalTimer', 'TGameLoop', 'TGameState', 'TInputController', 'TAudio', 'TSpawner', 'TAnimation', 'TDataStore', 'TAPIServer', 'TGameServer', 'THandshake', 'THeartbeat', 'TStageController', 'TObjectList', 'TImageList']) {
        check('Nonvisual Inspector: ' + className, () => {
            const instance = make(className);
            const shown = names(instance);
            assert.ok(shown.includes('name'));
            for (const name of forbidden) assert.ok(!shown.includes(name), className + ': ' + name);
            assert.ok(!shown.some(name => name.startsWith('style.')), className + ': Stil');
            for (const name of functional[className] || []) assert.ok(shown.includes(name), className + ': funktionales Feld ' + name);
            assert.ok(instance.getInspectorSections().every(s => s.properties.length > 0));
        });
    }
    check('Nonvisual Inspector: DTO-Werte bleiben erhalten', () => {
        const timer = make('TTimer') as any;
        timer.x = 7; timer.y = 8; timer.style.shadowBlur = 9; timer.interval = 350;
        timer.events = { onTimer: 'Tick' };
        const before = JSON.stringify(timer.toDTO());
        names(timer);
        assert.equal(JSON.stringify(timer.toDTO()), before);
        assert.equal(timer.toDTO().x, 7); assert.equal(timer.toDTO().style.shadowBlur, 9);
        assert.equal(timer.toDTO().interval, 350);
        assert.ok(timer.getEvents().includes('onTimer'));
        const reloaded = componentRegistry.createInstance(timer.toDTO());
        assert.ok(reloaded); assert.ok(!names(reloaded).includes('x'));
        assert.equal((reloaded as any).x, 7);
    });
    for (const className of ['TButton', 'TSprite', 'TSpriteTemplate', 'TToast', 'TStatusBar', 'TStickyNote']) {
        check('Visueller Inspector bleibt erhalten: ' + className, () => {
            const instance = make(className);
            const shown = names(instance);
            assert.ok(shown.includes('width'), className + ': Breite');
            assert.ok(shown.includes('style.backgroundColor'), className + ': Hintergrund');
        });
    }
    return results;
}
