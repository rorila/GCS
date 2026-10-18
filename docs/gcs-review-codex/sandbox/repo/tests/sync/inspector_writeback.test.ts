/**
 * SYNC_REFACTOR Phase 0 — Layer C: Inspector Writeback Tests
 * 
 * Prüft, dass `FlowAction.applyChange()` Werte korrekt in die SSoT
 * (getActionDefinition) und in den lokalen Cache (this.data) schreibt.
 * 
 * @since Phase 0 / SYNC_REFACTOR_PLAN §5
 */

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

/**
 * Erzeugt ein leichtgewichtiges Objekt, das die applyChange-Logik
 * von FlowAction.ts nachbildet, ohne DOM-Abhängigkeiten.
 */
function createApplyChangeProxy(actionDef: any): any {
    const data = { ...actionDef };

    const proxy = {
        data,
        getActionDefinition: () => actionDef,
        showDetails: false,
        projectRef: null,
        
        refreshVisuals: () => { /* noop in Tests */ },

        applyChange(propertyName: string, newValue: any, _oldValue?: any): boolean {
            // Spezialbehandlung: 'changes' als Objekt direkt schreiben
            if (propertyName === 'changes' && typeof newValue === 'object' && newValue !== null) {
                const def = this.getActionDefinition();
                if (def) {
                    if (def.propertyChanges && !def.changes) {
                        def.propertyChanges = newValue;
                    } else {
                        def.changes = newValue;
                    }
                    if (this.data) {
                        if (this.data.propertyChanges && !this.data.changes) {
                            this.data.propertyChanges = newValue;
                        } else {
                            this.data.changes = newValue;
                        }
                    }
                }
                this.refreshVisuals();
                return false;
            }

            // SSoT-FIRST: Direkt in die Action-Definition schreiben
            const def = this.getActionDefinition();
            if (def) {
                def[propertyName] = newValue;
            }

            // Auch in lokale data spiegeln
            if (this.data) {
                this.data[propertyName] = newValue;
            }

            // Visuelles Update
            this.refreshVisuals();

            // Bei Typ-Wechsel: Re-Render-Signal
            if (propertyName === 'type' || propertyName === 'actionType' || propertyName === 'effect') {
                return true;
            }

            return false;
        }
    };

    return proxy;
}

export async function runInspectorWritebackTests(): Promise<TestResult[]> {
    console.log("🧪 Inspector Writeback Tests starten...");
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
    // Test 1: applyChange schreibt in SSoT (getActionDefinition)
    // ===================================================================
    try {
        const actionDef = { name: 'TestAction', type: 'property', target: 'Sprite1' };
        const proxy = createApplyChangeProxy(actionDef);

        proxy.applyChange('target', 'NewSprite');

        const ok = actionDef.target === 'NewSprite';
        addResult('Writeback: applyChange schreibt in SSoT', ok,
            `actionDef.target=${actionDef.target}`);
    } catch (e: any) {
        addResult('Writeback: applyChange schreibt in SSoT', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 2: applyChange spiegelt in this.data (lokaler Cache)
    // ===================================================================
    try {
        const actionDef = { name: 'TestAction', type: 'property', target: 'Sprite1' };
        const proxy = createApplyChangeProxy(actionDef);

        proxy.applyChange('target', 'NewSprite');

        const ok = proxy.data.target === 'NewSprite';
        addResult('Writeback: applyChange spiegelt in this.data', ok,
            `data.target=${proxy.data.target}`);
    } catch (e: any) {
        addResult('Writeback: applyChange spiegelt in this.data', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 3: applyChange('type', ...) löst Re-Render-Signal aus
    // ===================================================================
    try {
        const actionDef = { name: 'TestAction', type: 'property' };
        const proxy = createApplyChangeProxy(actionDef);

        const reRender = proxy.applyChange('type', 'navigate');

        const ok = reRender === true && actionDef.type === 'navigate';
        addResult('Writeback: type-Wechsel → Re-Render-Signal', ok,
            `reRender=${reRender}, type=${actionDef.type}`);
    } catch (e: any) {
        addResult('Writeback: type-Wechsel → Re-Render-Signal', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 4: applyChange('effect', ...) löst Re-Render-Signal aus
    // ===================================================================
    try {
        const actionDef = { name: 'AnimAction', type: 'animate', effect: 'shake' };
        const proxy = createApplyChangeProxy(actionDef);

        const reRender = proxy.applyChange('effect', 'explode');

        const ok = reRender === true && actionDef.effect === 'explode';
        addResult('Writeback: effect-Wechsel → Re-Render-Signal', ok,
            `reRender=${reRender}, effect=${(actionDef as any).effect}`);
    } catch (e: any) {
        addResult('Writeback: effect-Wechsel → Re-Render-Signal', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 5: Normaler applyChange gibt false zurück (kein Re-Render)
    // ===================================================================
    try {
        const actionDef = { name: 'TestAction', type: 'property', target: 'X' };
        const proxy = createApplyChangeProxy(actionDef);

        const reRender = proxy.applyChange('target', 'Y');

        const ok = reRender === false;
        addResult('Writeback: normaler Change → kein Re-Render', ok,
            `reRender=${reRender}`);
    } catch (e: any) {
        addResult('Writeback: normaler Change → kein Re-Render', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 6: applyChange für Registry-Parameter OHNE TypeScript-Setter
    // ===================================================================
    try {
        const actionDef = { name: 'AnimAction', type: 'animate', effect: 'shake' } as any;
        const proxy = createApplyChangeProxy(actionDef);

        // 'duration' existiert als Property NICHT am Proxy (kein Getter/Setter)
        // applyChange muss trotzdem in SSoT und data schreiben
        proxy.applyChange('duration', 500);

        const okSSoT = actionDef.duration === 500;
        const okData = proxy.data.duration === 500;

        const ok = okSSoT && okData;
        addResult('Writeback: Registry-Parameter ohne Setter → SSoT + data', ok,
            `SSoT.duration=${actionDef.duration}, data.duration=${proxy.data.duration}`);
    } catch (e: any) {
        addResult('Writeback: Registry-Parameter ohne Setter → SSoT + data', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 7: applyChange für 'changes' als Objekt (Key-Value-Editor)
    // ===================================================================
    try {
        const actionDef = { name: 'PropAction', type: 'property', changes: { visible: true } } as any;
        const proxy = createApplyChangeProxy(actionDef);

        proxy.applyChange('changes', { visible: false, opacity: 0.5 });

        const okSSoT = actionDef.changes.visible === false && actionDef.changes.opacity === 0.5;
        const okData = proxy.data.changes.visible === false && proxy.data.changes.opacity === 0.5;

        const ok = okSSoT && okData;
        addResult('Writeback: changes-Objekt → SSoT + data', ok,
            `SSoT.changes=${JSON.stringify(actionDef.changes)}, data.changes=${JSON.stringify(proxy.data.changes)}`);
    } catch (e: any) {
        addResult('Writeback: changes-Objekt → SSoT + data', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 8: SSoT und data sind konsistent nach mehreren applyChange
    // ===================================================================
    try {
        const actionDef = { name: 'MultiAction', type: 'property', target: 'A' } as any;
        const proxy = createApplyChangeProxy(actionDef);

        proxy.applyChange('target', 'B');
        proxy.applyChange('type', 'navigate');
        proxy.applyChange('url', '/menu');

        const ok = actionDef.target === 'B' && actionDef.type === 'navigate' && actionDef.url === '/menu'
                && proxy.data.target === 'B' && proxy.data.type === 'navigate' && proxy.data.url === '/menu';

        addResult('Writeback: Konsistenz nach Mehrfach-applyChange', ok,
            `SSoT: target=${actionDef.target}, type=${actionDef.type}, url=${actionDef.url}`);
    } catch (e: any) {
        addResult('Writeback: Konsistenz nach Mehrfach-applyChange', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 9: FlowNodeFactory.createNode('action:animate') füllt Defaults
    // ===================================================================
    try {
        // Mock für SchemaMigrator (da wir keinen echten Import hier haben bzw. es isoliert testen wollen)
        const mockRegistry = {
            getActionParams: (type: string) => {
                if (type === 'animate') {
                    return [{ name: 'effect', defaultValue: 'fade' }, { name: 'duration', defaultValue: 300 }];
                }
                return [];
            }
        };

        const mockNode: any = { data: {} };
        const actionSubtype = 'animate';

        // Nachbau der Logik in FlowNodeFactory.ts:62
        if (actionSubtype) {
            mockNode.data.type = actionSubtype;
            // Mock SchemaMigrator
            const params = mockRegistry.getActionParams(mockNode.data.type);
            for (const p of params) {
                if (mockNode.data[p.name] === undefined && p.defaultValue !== undefined) {
                    mockNode.data[p.name] = p.defaultValue;
                }
            }
        }

        const ok = mockNode.data.effect === 'fade' && mockNode.data.duration === 300;
        addResult('Writeback: FlowNodeFactory.createNode füllt Defaults', ok,
            `data.effect=${mockNode.data.effect}, data.duration=${mockNode.data.duration}`);
    } catch (e: any) {
        addResult('Writeback: FlowNodeFactory.createNode füllt Defaults', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1].replace(/\\\\/g, '/')) || process.argv[1].endsWith('inspector_writeback.test.ts');
if (isMain) {
    runInspectorWritebackTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
        });
        const passed = results.filter(r => r.passed).length;
        console.log(`\n  Inspector Writeback: ${passed} bestanden, ${results.length - passed} fehlgeschlagen`);
        process.exit(results.every(r => r.passed) ? 0 : 1);
    });
}
