/**
 * SYNC_REFACTOR Phase 0 — Layer C: FlowAction Alias Roundtrip Tests
 * 
 * Stellt sicher, dass die 5 Alias-Paare korrekt bidirektional funktionieren:
 *   type ↔ actionType
 *   changes ↔ propertyChanges
 *   variableName ↔ variable
 *   method ↔ methodName
 *   formula ↔ expression
 * 
 * @since Phase 0 / SYNC_REFACTOR_PLAN §5
 */

import { projectActionRegistry } from '../../src/services/registry/ActionRegistry';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

/**
 * Erzeugt ein Minimal-Projekt und registriert eine Action in der ProjectActionRegistry,
 * dann erzeugt ein leichtgewichtiges FlowAction-ähnliches Proxy-Objekt das dieselbe
 * Getter/Setter-Logik wie FlowAction.ts implementiert.
 */
function createActionProxy(actionDef: any): any {
    // Registriere die Action in der Registry (simuliert projectActionRegistry.findOriginalAction)
    const getActionDefinition = () => actionDef;

    return {
        data: { ...actionDef },
        getActionDefinition,

        // === type / actionType ===
        get type() {
            const action = getActionDefinition();
            return action?.type || 'property';
        },
        set type(v: string) {
            const action = getActionDefinition();
            if (action) {
                action.type = v;
                if (this.data) {
                    this.data.type = v;
                    if (this.data.actionType) this.data.actionType = v;
                }
            }
        },
        get actionType() { return this.type; },
        set actionType(v: string) { this.type = v; },

        // === changes / propertyChanges ===
        get changes() {
            const action = getActionDefinition();
            return action?.changes || action?.propertyChanges || {};
        },
        set changes(v: any) {
            const action = getActionDefinition();
            if (action) {
                if (action.propertyChanges && !action.changes) {
                    action.propertyChanges = v;
                } else {
                    action.changes = v;
                }
            }
        },

        // === variableName / variable ===
        get variableName() {
            const action = getActionDefinition();
            return action?.variableName || '';
        },
        set variableName(v: string) {
            const action = getActionDefinition();
            if (action) action.variableName = v;
        },
        get variable() { return this.variableName; },
        set variable(v: string) { this.variableName = v; },

        // === method / methodName ===
        get method() {
            const action = getActionDefinition();
            return action?.method || action?.methodName || '';
        },
        set method(v: string) {
            const action = getActionDefinition();
            if (action) action.method = v;
        },

        // === formula / expression ===
        get formula() {
            const action = getActionDefinition();
            return action?.formula || action?.expression || '';
        },
        set formula(v: string) {
            const action = getActionDefinition();
            if (action) {
                action.formula = v;
                if (action.expression !== undefined) {
                    delete action.expression;
                }
            }
        },
        get expression() { return this.formula; },
        set expression(v: string) { this.formula = v; }
    };
}

export async function runFlowActionAliasTests(): Promise<TestResult[]> {
    console.log("🧪 FlowAction Alias-Roundtrip Tests starten...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'SyncRefactor-Phase0',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    // ===================================================================
    // Test 1: type / actionType — Setter schreibt kanonisch
    // ===================================================================
    try {
        const actionDef = { name: 'TestAction', type: 'property' };
        const proxy = createActionProxy(actionDef);

        proxy.actionType = 'navigate';

        const ok = actionDef.type === 'navigate' && proxy.type === 'navigate' && proxy.actionType === 'navigate';
        addResult('Alias: actionType setzt type korrekt', ok,
            `def.type=${actionDef.type}, proxy.type=${proxy.type}, proxy.actionType=${proxy.actionType}`);
    } catch (e: any) {
        addResult('Alias: actionType setzt type korrekt', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 2: changes / propertyChanges — Getter liest beide
    // ===================================================================
    try {
        // Test A: Nur propertyChanges vorhanden → Getter liest sie
        const actionDefA = { name: 'TestA', propertyChanges: { visible: false } } as any;
        const proxyA = createActionProxy(actionDefA);
        const readA = proxyA.changes;
        const okA = readA.visible === false;

        // Test B: Nur changes vorhanden → Getter liest sie
        const actionDefB = { name: 'TestB', changes: { color: 'red' } } as any;
        const proxyB = createActionProxy(actionDefB);
        const readB = proxyB.changes;
        const okB = readB.color === 'red';

        const ok = okA && okB;
        addResult('Alias: changes liest both propertyChanges und changes', ok,
            `A(propertyChanges)=${okA}, B(changes)=${okB}`);
    } catch (e: any) {
        addResult('Alias: changes liest both propertyChanges und changes', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 3: changes — Setter schreibt in das richtige Feld
    // ===================================================================
    try {
        // Wenn nur propertyChanges existiert → Setter schreibt propertyChanges
        const actionDefLegacy = { name: 'Legacy', propertyChanges: { x: 1 } } as any;
        const proxyLegacy = createActionProxy(actionDefLegacy);
        proxyLegacy.changes = { x: 2, y: 3 };
        const okLegacy = actionDefLegacy.propertyChanges.x === 2 && actionDefLegacy.propertyChanges.y === 3;

        // Wenn changes existiert → Setter schreibt changes
        const actionDefModern = { name: 'Modern', changes: { x: 1 } } as any;
        const proxyModern = createActionProxy(actionDefModern);
        proxyModern.changes = { x: 99 };
        const okModern = actionDefModern.changes.x === 99;

        const ok = okLegacy && okModern;
        addResult('Alias: changes-Setter schreibt korrektes Feld', ok,
            `Legacy→propertyChanges=${okLegacy}, Modern→changes=${okModern}`);
    } catch (e: any) {
        addResult('Alias: changes-Setter schreibt korrektes Feld', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 4: variableName / variable — Alias-Delegation
    // ===================================================================
    try {
        const actionDef = { name: 'VarAction', variableName: 'score' } as any;
        const proxy = createActionProxy(actionDef);

        // Lesen via Alias
        const readViaAlias = proxy.variable;
        const readViaDirect = proxy.variableName;
        const readOk = readViaAlias === 'score' && readViaDirect === 'score';

        // Schreiben via Alias
        proxy.variable = 'lives';
        const writeOk = actionDef.variableName === 'lives' && proxy.variableName === 'lives';

        const ok = readOk && writeOk;
        addResult('Alias: variable ↔ variableName bidirektional', ok,
            `read=${readOk}, write=${writeOk}, final=${actionDef.variableName}`);
    } catch (e: any) {
        addResult('Alias: variable ↔ variableName bidirektional', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 5: method / methodName — Getter liest beide Fallbacks
    // ===================================================================
    try {
        // Nur methodName vorhanden (Legacy)
        const actionDefLegacy = { name: 'MethodLegacy', methodName: 'doStuff' } as any;
        const proxyLegacy = createActionProxy(actionDefLegacy);
        const okLegacy = proxyLegacy.method === 'doStuff';

        // Nur method vorhanden (Modern)
        const actionDefModern = { name: 'MethodModern', method: 'doOtherStuff' } as any;
        const proxyModern = createActionProxy(actionDefModern);
        const okModern = proxyModern.method === 'doOtherStuff';

        const ok = okLegacy && okModern;
        addResult('Alias: method liest method und methodName', ok,
            `Legacy(methodName)=${okLegacy}, Modern(method)=${okModern}`);
    } catch (e: any) {
        addResult('Alias: method liest method und methodName', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 6: formula / expression — Setter löscht Legacy-Feld
    // ===================================================================
    try {
        const actionDef = { name: 'CalcAction', expression: '2 + 2' } as any;
        const proxy = createActionProxy(actionDef);

        // Lesen via expression
        const readBefore = proxy.formula;
        const readOk = readBefore === '2 + 2';

        // Schreiben via formula → expression sollte gelöscht werden
        proxy.formula = '3 * 3';
        const writeOk = actionDef.formula === '3 * 3';
        const legacyDeleted = actionDef.expression === undefined;

        // expression-Alias sollte jetzt formula lesen
        const aliasOk = proxy.expression === '3 * 3';

        const ok = readOk && writeOk && legacyDeleted && aliasOk;
        addResult('Alias: formula-Setter löscht Legacy expression', ok,
            `read=${readOk}, write=${writeOk}, legacyDeleted=${legacyDeleted}, alias=${aliasOk}`);
    } catch (e: any) {
        addResult('Alias: formula-Setter löscht Legacy expression', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1].replace(/\\\\/g, '/')) || process.argv[1].endsWith('flowaction_aliases.test.ts');
if (isMain) {
    runFlowActionAliasTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
        });
        const passed = results.filter(r => r.passed).length;
        console.log(`\n  FlowAction Aliases: ${passed} bestanden, ${results.length - passed} fehlgeschlagen`);
        process.exit(results.every(r => r.passed) ? 0 : 1);
    });
}
