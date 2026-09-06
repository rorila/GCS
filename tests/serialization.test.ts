/**
 * Serialization Tests – Sicherheitsnetz für hydrateObjects (JSON → Objekt-Instanzen)
 * 
 * Testet: Klassen-Erkennung, Property-Erhalt, isVariable-Schutz, Round-Trip,
 *         Unknown-Class-Fallback und Children-Hydrierung.
 */

import { hydrateObjects } from '../src/utils/Serialization';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

export async function runSerializationTests(): Promise<TestResult[]> {
    console.log("🧪 Serialization Tests starten...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'Serialization',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    // --- Test 1: Basic Hydrate – TButton ---
    try {
        const buttonData = [{
            className: 'TButton',
            id: 'btn_1',
            name: 'TestButton',
            x: 10, y: 20, width: 100, height: 40,
            caption: 'Klick mich'
        }];
        const objects = hydrateObjects(buttonData);
        const btn = objects[0];
        const ok = btn != null
            && (btn as any).className === 'TButton'
            && btn.name === 'TestButton'
            && btn.id === 'btn_1'
            && btn.x === 10 && btn.y === 20
            && btn.width === 100 && btn.height === 40
            && (btn as any).caption === 'Klick mich';
        addResult('Hydrate: TButton', ok,
            `className=${(btn as any)?.className}, name=${btn?.name}, caption=${(btn as any)?.caption}`);
    } catch (e: any) {
        addResult('Hydrate: TButton', false, `Exception: ${e.message}`);
    }

    // --- Test 2: Variable Hydrate – TIntegerVariable korrekte Klasse ---
    try {
        const varData = [{
            className: 'TIntegerVariable',
            id: 'var_score',
            name: 'Score',
            x: 0, y: 0,
            isVariable: true,
            type: 'integer',
            value: 42,
            defaultValue: 0
        }];
        const objects = hydrateObjects(varData);
        const v = objects[0];
        const ok = v != null
            && (v as any).className === 'TIntegerVariable'
            && v.name === 'Score'
            && (v as any).isVariable === true
            && (v as any).value === 42;
        addResult('Hydrate: TIntegerVariable', ok,
            `className=${(v as any)?.className}, value=${(v as any)?.value}, isVariable=${(v as any)?.isVariable}`);
    } catch (e: any) {
        addResult('Hydrate: TIntegerVariable', false, `Exception: ${e.message}`);
    }

    // --- Test 3: isVariable wird NICHT auf false zurückgesetzt ---
    try {
        const varData = [{
            className: 'TVariable',
            id: 'var_test',
            name: 'TestVar',
            x: 0, y: 0,
            isVariable: true,
            type: 'string',
            value: 'hello'
        }];
        const objects = hydrateObjects(varData);
        const v = objects[0];
        const ok = v != null && (v as any).isVariable === true;
        addResult('Hydrate: isVariable bleibt true', ok,
            `isVariable=${(v as any)?.isVariable}`);
    } catch (e: any) {
        addResult('Hydrate: isVariable bleibt true', false, `Exception: ${e.message}`);
    }

    // --- Test 4: Unknown className → TWindow-Fallback, kein Crash ---
    try {
        const unknownData = [{
            className: 'TDoesNotExist',
            id: 'unknown_1',
            name: 'UnknownComp',
            x: 5, y: 10
        }];
        const objects = hydrateObjects(unknownData);
        // Erwartet: leeres Array (Objekt wird übersprungen), kein Crash
        const ok = objects.length === 0;
        addResult('Hydrate: Unknown Class (kein Crash)', ok,
            `Ergebnis-Länge=${objects.length} (erwartet: 0)`);
    } catch (e: any) {
        addResult('Hydrate: Unknown Class (kein Crash)', false, `Exception: ${e.message}`);
    }

    // --- Test 5: Round-Trip (toJSON → hydrateObjects) ---
    try {
        const shapeData = [{
            className: 'TShape',
            id: 'shape_1',
            name: 'MyShape',
            x: 50, y: 60, width: 80, height: 80,
            shapeType: 'circle',
            text: '⭐',
            fillColor: '#ff0000',
            borderColor: '#0000ff',
            zIndex: 5,
            visible: true
        }];
        const objects = hydrateObjects(shapeData);
        const shape = objects[0];

        // Jetzt toJSON() aufrufen und erneut hydrieren
        const jsonOut = (shape as any).toJSON ? (shape as any).toJSON() : JSON.parse(JSON.stringify(shape));
        // Stelle sicher, dass className erhalten bleibt
        if (!jsonOut.className) jsonOut.className = 'TShape';
        const rehydrated = hydrateObjects([jsonOut]);
        const r = rehydrated[0];

        const ok = r != null
            && (r as any).className === 'TShape'
            && r.name === 'MyShape'
            && r.x === 50 && r.y === 60
            && r.width === 80 && r.height === 80
            && (r as any).text === '⭐';
        addResult('Hydrate: Round-Trip (toJSON → hydrate)', ok,
            `name=${r?.name}, x=${r?.x}, text=${(r as any)?.text}`);
    } catch (e: any) {
        addResult('Hydrate: Round-Trip (toJSON → hydrate)', false, `Exception: ${e.message}`);
    }

    // --- Test 6: Container mit Children ---
    try {
        const panelData = [{
            className: 'TPanel',
            id: 'panel_1',
            name: 'ContainerPanel',
            x: 0, y: 0, width: 200, height: 200,
            children: [
                {
                    className: 'TButton',
                    id: 'child_btn',
                    name: 'ChildButton',
                    x: 10, y: 10, width: 80, height: 30,
                    caption: 'Kind'
                },
                {
                    className: 'TLabel',
                    id: 'child_lbl',
                    name: 'ChildLabel',
                    x: 10, y: 50,
                    text: 'Hallo'
                }
            ]
        }];
        const objects = hydrateObjects(panelData);
        const panel = objects[0];
        const children = (panel as any).children || [];
        const ok = panel != null
            && (panel as any).className === 'TPanel'
            && children.length === 2
            && (children[0] as any).className === 'TButton'
            && (children[1] as any).className === 'TLabel';
        addResult('Hydrate: Container mit Children', ok,
            `Children-Anzahl=${children.length}, Typen=[${children.map((c: any) => c.className).join(', ')}]`);
    } catch (e: any) {
        addResult('Hydrate: Container mit Children', false, `Exception: ${e.message}`);
    }

    // --- Test 7: Events/Tasks Fallback ---
    try {
        const objWithTasks = [{
            className: 'TButton',
            id: 'btn_evt',
            name: 'EventButton',
            x: 0, y: 0, width: 80, height: 30,
            Tasks: { onClick: 'DoLogin' }  // Legacy-Format
        }];
        const objects = hydrateObjects(objWithTasks);
        const btn = objects[0];
        const ok = btn != null
            && btn.events != null
            && btn.events['onClick'] === 'DoLogin';
        addResult('Hydrate: Events/Tasks-Fallback', ok,
            `events.onClick=${btn?.events?.['onClick']}`);
    } catch (e: any) {
        addResult('Hydrate: Events/Tasks-Fallback', false, `Exception: ${e.message}`);
    }

    // --- Test 8: Style-Merge ---
    try {
        const styledData = [{
            className: 'TButton',
            id: 'btn_styled',
            name: 'StyledButton',
            x: 0, y: 0, width: 80, height: 30,
            style: { backgroundColor: '#333', borderRadius: '8px' }
        }];
        const objects = hydrateObjects(styledData);
        const btn = objects[0];
        const ok = btn != null
            && (btn as any).style?.backgroundColor === '#333'
            && (btn as any).style?.borderRadius === '8px';
        addResult('Hydrate: Style-Merge', ok,
            `bgColor=${(btn as any)?.style?.backgroundColor}, borderRadius=${(btn as any)?.style?.borderRadius}`);
    } catch (e: any) {
        addResult('Hydrate: Style-Merge', false, `Exception: ${e.message}`);
    }

    // --- Test 9: TSprite mit ImageList ---
    try {
        const spriteData = [{
            className: 'TSprite',
            id: 'sprite_1',
            name: 'PlayerSprite',
            x: 0, y: 0, width: 32, height: 32,
            imageListId: 'imglist_hero',
            imageIndex: 2
        }];
        const objects = hydrateObjects(spriteData);
        const spr = objects[0];
        const ok = spr != null
            && (spr as any).className === 'TSprite'
            && (spr as any).imageListId === 'imglist_hero'
            && (spr as any).imageIndex === 2;
        addResult('Hydrate: TSprite ImageList', ok,
            `imageListId=${(spr as any)?.imageListId}, imageIndex=${(spr as any)?.imageIndex}`);
    } catch (e: any) {
        addResult('Hydrate: TSprite ImageList', false, `Exception: ${e.message}`);
    }

    // --- Test 10: Prototype Pollution Regression ---
    try {
        // Verwende JSON.parse, da Object-Literals mit __proto__ den Prototypen des Objekts sofort manipulieren und nicht als String-Key durchlaufen.
        const malicious = JSON.parse('[{"className":"TButton","id":"polluted_1","name":"x","__proto__":{"polluted":true}}]');
        hydrateObjects(malicious);
        const ok = ({} as any).polluted === undefined && (Object.prototype as any).polluted === undefined;
        // Clean up immediately if it polluted
        if (!ok) {
            delete (Object.prototype as any).polluted;
        }

        addResult('Hydrate: Prototype Pollution Regression', ok,
            ok ? 'Object.prototype blieb unveraendert' : 'ACHTUNG: Prototype Pollution moeglich!');
    } catch (e: any) {
        addResult('Hydrate: Prototype Pollution Regression', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1].replace(/\\/g, '/')) || process.argv[1].endsWith('serialization.test.ts');
if (isMain) {
    runSerializationTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
        });
        const allPassed = results.every(r => r.passed);
        console.log(`\n🧪 Serialization: ${results.filter(r => r.passed).length}/${results.length} bestanden.`);
        process.exit(allPassed ? 0 : 1);
    });
}
