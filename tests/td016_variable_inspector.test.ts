import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    usesVariableInspectorTemplate,
    resolveVariableInspectorType,
    getVariableInspectorTarget
} from '../src/editor/inspector/renderers/InspectorPropertiesRenderer';
import { VariableHandler } from '../src/editor/inspector/handlers/VariableHandler';
import { componentRegistry } from '../src/services/ComponentRegistry';

// Basis-TVariable plus alle registrierten Spezialvariablen.
const SPECIALIZED_VARIABLES = [
    'TIntegerVariable', 'TRealVariable', 'TStringVariable', 'TBooleanVariable',
    'TObjectVariable', 'TListVariable', 'TRangeVariable', 'TRandomVariable',
    'TThresholdVariable', 'TTriggerVariable'
];
const EXPECTED_TYPES: Record<string, string> = {
    TIntegerVariable: 'integer', TRealVariable: 'real', TStringVariable: 'string',
    TBooleanVariable: 'boolean', TObjectVariable: 'object', TListVariable: 'list',
    TRangeVariable: 'range', TRandomVariable: 'random',
    TThresholdVariable: 'threshold', TTriggerVariable: 'trigger'
};

const handler = new VariableHandler();

test('TD-016: TVariable und alle Spezialvariablen nutzen die Variablen-Vorlage', () => {
    for (const className of ['TVariable', ...SPECIALIZED_VARIABLES]) {
        const instance: any = componentRegistry.createInstance({ className, name: 'Test' });
        assert.ok(instance, className + ' muss registriert sein');
        assert.ok(usesVariableInspectorTemplate(instance), className + ' (Instanz) → inspector_variable.json');
        assert.ok(usesVariableInspectorTemplate(instance.toDTO()), className + ' (DTO) → inspector_variable.json');
        assert.ok(handler.canHandle(instance), className + ' wird vom VariableHandler verarbeitet');
        assert.equal(handler.getInspectorTemplate(instance), './inspector_variable.json');
        assert.equal(handler.getEventsTemplate(instance), './inspector_variable_events.json');
    }
});

test('TD-016: Regal-Ressourcen und Nicht-Variablen bleiben beim generischen Inspector', () => {
    for (const className of ['TStringMap', 'TObjectList', 'TKeyStore', 'TTimer', 'TButton']) {
        const instance: any = componentRegistry.createInstance({ className, name: 'Test' });
        assert.ok(instance, className + ' muss registriert sein');
        assert.ok(!usesVariableInspectorTemplate(instance), className + ' bleibt generisch');
        assert.ok(!usesVariableInspectorTemplate(instance.toDTO()), className + ' (DTO) bleibt generisch');
    }
});

test('TD-016: abgeleiteter Datentyp aktiviert die Spezialfelder der Vorlage', () => {
    for (const className of SPECIALIZED_VARIABLES) {
        const instance: any = componentRegistry.createInstance({ className, name: 'Test' });
        const target = getVariableInspectorTarget(instance);
        assert.equal(resolveVariableInspectorType(target), EXPECTED_TYPES[className],
            className + ': Vorlage sieht type=' + EXPECTED_TYPES[className]);
        assert.equal(target.variableType, EXPECTED_TYPES[className]);
        // serialisiertes type-Feld hat Vorrang
        const dto = instance.toDTO();
        if (dto.type !== undefined) {
            assert.equal(resolveVariableInspectorType(dto), dto.type);
        }
    }
});

test('TD-016: Spezialfelder und Scope bleiben über das Sicht-Objekt les- und schreibbar', () => {
    const threshold: any = componentRegistry.createInstance({ className: 'TThresholdVariable', name: 'Schwelle' });
    threshold.threshold = 6; threshold.comparison = '>=';
    const target = getVariableInspectorTarget(threshold);
    assert.equal(target.threshold, 6);
    assert.equal(target.comparison, '>=');
    target.threshold = 9;
    assert.equal(threshold.threshold, 9, 'Schreiben geht an das Original');
    target.scope = 'global';
    assert.equal(threshold.scope, 'global', 'Scope-Auswahl wirkt auf das Original');
    assert.equal(threshold.id, target.id);
    assert.equal(threshold.name, target.name);
    target.type = 'integer';
    assert.equal(threshold.type, 'integer', 'Typwechsel wird an das Original durchgereicht');
    assert.equal(threshold.comparison, '>=', 'Spezialfelder gehen beim Typwechsel nicht verloren');
});

test('TD-016: inspector_variable.json enthält Scope-Auswahl und Spezialfelder', () => {
    const def: any = JSON.parse(readFileSync('public/inspector_variable.json', 'utf-8'));
    const controls: any[] = [];
    const walk = (o: any) => {
        if (Array.isArray(o)) return o.forEach(walk);
        if (!o || typeof o !== 'object') return;
        controls.push(o);
        Object.values(o).forEach(walk);
    };
    walk(def);
    const byName = (n: string) => controls.find(c => c.name === n);
    const scope = byName('scope');
    assert.ok(scope, 'scope-Select fehlt');
    const scopeValues = (scope.options || []).map((o: any) => o.value);
    for (const v of ['global', 'stage', 'local']) assert.ok(scopeValues.includes(v), 'scope-Option ' + v);
    assert.equal(byName('threshold').visible, "${selectedObject.type === 'threshold'}");
    assert.equal(byName('comparison').visible, "${selectedObject.type === 'threshold'}");
    assert.deepEqual((byName('comparison').options || []).map((o: any) => o.value),
        ['>=', '<=', '==', '>', '<', '!=']);
    assert.equal(byName('triggerValue').visible, "${selectedObject.type === 'trigger'}");
    assert.equal(byName('isInteger').visible, "${selectedObject.type === 'random'}");
    for (const n of ['min', 'max', 'interval', 'defaultValue', 'value']) assert.ok(byName(n), n + ' fehlt');
});

test('TD-016: gespeicherte Spezialvariablen bleiben kompatibel (Round-Trip)', () => {
    for (const className of SPECIALIZED_VARIABLES) {
        const instance: any = componentRegistry.createInstance({ className, name: 'Alt' });
        const dto = instance.toDTO();
        assert.equal(dto.className, className);
        const reloaded: any = componentRegistry.createInstance(dto);
        assert.ok(reloaded, className + ' lässt sich aus DTO wieder laden');
        assert.ok(usesVariableInspectorTemplate(reloaded), className + ' (reloaded) → Variablen-Vorlage');
        assert.equal(resolveVariableInspectorType(reloaded), EXPECTED_TYPES[className]);
    }
    const threshold: any = componentRegistry.createInstance({ className: 'TThresholdVariable', name: 'S' });
    threshold.threshold = 7; threshold.comparison = '<=';
    const reloaded: any = componentRegistry.createInstance(JSON.parse(JSON.stringify(threshold.toDTO())));
    assert.equal(reloaded.threshold, 7);
    assert.equal(reloaded.comparison, '<=');
});
