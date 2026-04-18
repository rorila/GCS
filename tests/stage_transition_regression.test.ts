/**
 * Stage-Transition Regressions-Tests & TDialogRoot Feature-Tests
 * 
 * Gruppe A (A1–A6): Quellcode-Analyse der Stage-Transition-Fixes
 *   Prüft den TypeScript-Quellcode auf bekannte Regressions-Muster,
 *   die zu eingefrorenen Animationen, Koordinaten-Drift und
 *   doppelten Off-Screen-Offsets geführt haben.
 * 
 * Gruppe B (B1–B6): TDialogRoot Instanz-Tests
 *   Erstellt echte TDialogRoot-Instanzen und prüft API, Defaults
 *   und Serialisierung (modal, closable, draggable, centerOnShow).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

// ══════════════════════════════════════════════════════════════
// Hilfsfunktion: Quellcode einer Datei lesen
// ══════════════════════════════════════════════════════════════
function readSourceFile(relativePath: string): string {
    const fullPath = path.resolve(__dirname, '..', relativePath);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`Quelldatei nicht gefunden: ${fullPath}`);
    }
    return fs.readFileSync(fullPath, 'utf-8');
}

// ══════════════════════════════════════════════════════════════
// Hilfsfunktion: Methoden-Body extrahieren (einfaches Parsing)
// ══════════════════════════════════════════════════════════════
function extractMethodBody(source: string, methodName: string): string {
    // Suche nach dem Methoden-Start (private/public/protected methodName(...)
    const regex = new RegExp(`(?:private|public|protected)\\s+${methodName}\\s*\\(`, 'g');
    const match = regex.exec(source);
    if (!match) return '';

    // Finde die öffnende Klammer der Methode
    let braceCount = 0;
    let startIdx = match.index;
    let foundOpen = false;
    let bodyStart = 0;

    for (let i = startIdx; i < source.length; i++) {
        if (source[i] === '{' && !foundOpen) {
            foundOpen = true;
            bodyStart = i;
            braceCount = 1;
            continue;
        }
        if (foundOpen) {
            if (source[i] === '{') braceCount++;
            if (source[i] === '}') braceCount--;
            if (braceCount === 0) {
                return source.substring(bodyStart, i + 1);
            }
        }
    }
    return '';
}

export async function runStageTransitionRegressionTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'StageTransition-Regression',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    console.log('\n🧪 Stage-Transition Regressions-Tests starten...');

    // ══════════════════════════════════════════════════════════════
    // GRUPPE A: Quellcode-Analyse (Stage-Transition-Fixes)
    // ══════════════════════════════════════════════════════════════

    let runtimeSource = '';
    let rendererSource = '';

    try {
        runtimeSource = readSourceFile('src/runtime/GameRuntime.ts');
        rendererSource = readSourceFile('src/editor/services/StageRenderer.ts');
    } catch (e: any) {
        addResult('A0: Quelldateien lesbar', false, e.message);
        return results;
    }

    // ── A1: handleStageChange enthält glm.init() ──
    // REGRESSION: Ohne glm.init() frieren Physik, Sprites und Animationen nach Stage-Wechsel ein
    try {
        const handleStageChangeBody = extractMethodBody(runtimeSource, 'handleStageChange');
        const hasGlmInit = handleStageChangeBody.includes('glm.init(');
        addResult(
            'A1: handleStageChange enthält glm.init()',
            hasGlmInit,
            hasGlmInit
                ? 'GameLoopManager wird bei Stage-Wechsel korrekt re-initialisiert.'
                : 'REGRESSION! glm.init() fehlt in handleStageChange → Physik/Sprites frieren ein!'
        );
    } catch (e: any) {
        addResult('A1: handleStageChange enthält glm.init()', false, `Fehler: ${e.message}`);
    }

    // ── A2: slide-up nutzt cellSize-Division, nicht hartcodierten Pixel-Offset ──
    // REGRESSION: obj.y += 100 verschiebt um 100 Grid-Zellen (2000px) statt 5 Zellen (100px)
    try {
        const triggerBody = extractMethodBody(runtimeSource, 'triggerStartAnimation');
        // Prüfe: Der slide-up Block muss cellSize verwenden
        const slideUpIdx = triggerBody.indexOf("'slide-up'");
        if (slideUpIdx === -1) {
            addResult('A2: slide-up nutzt cellSize-Division', false, "slide-up Abschnitt nicht gefunden!");
        } else {
            const slideUpBlock = triggerBody.substring(slideUpIdx, slideUpIdx + 300);
            const usesCellSize = slideUpBlock.includes('cellSize');
            // Prüfe zusätzlich: kein hartcodierter "obj.y += 100" oder "obj.y + 100"
            const hasHardcodedPixelOffset = /obj\.y\s*\+=\s*100\s*;/.test(slideUpBlock);
            const ok = usesCellSize && !hasHardcodedPixelOffset;
            addResult(
                'A2: slide-up nutzt cellSize-Division',
                ok,
                ok
                    ? 'slide-up Offset wird korrekt durch cellSize geteilt (Grid-Zellen statt Pixel).'
                    : `REGRESSION! usesCellSize=${usesCellSize}, hardcodedPixel=${hasHardcodedPixelOffset}`
            );
        }
    } catch (e: any) {
        addResult('A2: slide-up nutzt cellSize-Division', false, `Fehler: ${e.message}`);
    }

    // ── A3: handleStageChange darf KEINEN eigenen triggerStartAnimation-Aufruf haben ──
    // REGRESSION: Doppelter Aufruf verdoppelt Off-Screen-Offset → Objekte landen außerhalb der Bühne
    try {
        const handleStageChangeBody = extractMethodBody(runtimeSource, 'handleStageChange');
        // triggerStartAnimation-Aufruf in handleStageChange? (Ausnahme: Kommentare zählen nicht)
        // Entferne Kommentare
        const noComments = handleStageChangeBody
            .split('\n')
            .filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
            .join('\n');
        const hasTriggerCall = noComments.includes('triggerStartAnimation(');
        addResult(
            'A3: handleStageChange KEIN eigener triggerStartAnimation',
            !hasTriggerCall,
            !hasTriggerCall
                ? 'Korrekt: Animation wird nur über start() → initMainGame() ausgelöst.'
                : 'REGRESSION! handleStageChange ruft triggerStartAnimation() direkt auf → doppelter Offset!'
        );
    } catch (e: any) {
        addResult('A3: handleStageChange KEIN eigener triggerStartAnimation', false, `Fehler: ${e.message}`);
    }

    // ── A4: updateSpritePositions verwendet Map-Deduplizierung ──
    // REGRESSION: Ohne Deduplizierung überschreiben veraltete Cache-Objekte die Tween-Positionen
    try {
        const updateBody = extractMethodBody(rendererSource, 'updateSpritePositions');
        const hasMap = updateBody.includes('new Map<') || updateBody.includes('new Map(');
        const hasSetCheck = updateBody.includes('.has(') && updateBody.includes('.set(');
        const ok = hasMap && hasSetCheck;
        addResult(
            'A4: updateSpritePositions dedupliziert via Map',
            ok,
            ok
                ? 'Map-basierte Deduplizierung vorhanden → kein Rubber-Banding.'
                : `REGRESSION! Map=${hasMap}, has/set=${hasSetCheck} → Rubber-Banding möglich!`
        );
    } catch (e: any) {
        addResult('A4: updateSpritePositions dedupliziert via Map', false, `Fehler: ${e.message}`);
    }

    // ── A5: shouldAnimate filtert parentId-Kinder ──
    // REGRESSION: Ohne parentId-Filter werden Container und Kinder gleichzeitig verschoben → Drift
    try {
        const triggerBody = extractMethodBody(runtimeSource, 'triggerStartAnimation');
        const hasParentIdFilter = triggerBody.includes('obj.parentId') && triggerBody.includes('return false');
        addResult(
            'A5: shouldAnimate filtert parentId-Kinder',
            hasParentIdFilter,
            hasParentIdFilter
                ? 'parentId-Filter aktiv → Kinder reiten auf dem Parent mit (kein Drift).'
                : 'REGRESSION! parentId-Filter fehlt → Objekte driften beim Fly-In!'
        );
    } catch (e: any) {
        addResult('A5: shouldAnimate filtert parentId-Kinder', false, `Fehler: ${e.message}`);
    }

    // ── A6: initMainGame enthält triggerStartAnimation ──
    // REGRESSION: Wenn triggerStartAnimation aus initMainGame entfernt wird, gibt es beim
    // ERSTEN Start keine Animation mehr (handleStageChange ruft es absichtlich NICHT auf)
    try {
        const initMainBody = extractMethodBody(runtimeSource, 'initMainGame');
        const noComments = initMainBody
            .split('\n')
            .filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
            .join('\n');
        const hasTriggerInInit = noComments.includes('triggerStartAnimation(');
        addResult(
            'A6: initMainGame enthält triggerStartAnimation',
            hasTriggerInInit,
            hasTriggerInInit
                ? 'Animation wird korrekt in initMainGame ausgelöst (einziger Aufrufpunkt).'
                : 'REGRESSION! triggerStartAnimation() fehlt in initMainGame → keine Animations beim Erststart!'
        );
    } catch (e: any) {
        addResult('A6: initMainGame enthält triggerStartAnimation', false, `Fehler: ${e.message}`);
    }

    // ══════════════════════════════════════════════════════════════
    // GRUPPE B: TDialogRoot Instanz-Tests
    // ══════════════════════════════════════════════════════════════

    console.log('🧪 TDialogRoot Feature-Tests starten...');

    // Dynamischer Import, da TDialogRoot ComponentRegistry-Seiteneffekte hat
    let TDialogRoot: any;
    try {
        const mod = await import('../src/components/TDialogRoot.js');
        TDialogRoot = mod.TDialogRoot;
    } catch (e: any) {
        addResult('B0: TDialogRoot importierbar', false, `Import-Fehler: ${e.message}`);
        // Ohne TDialogRoot können wir B1–B6 nicht ausführen
        return results;
    }

    // ── B1: Default-Werte ──
    try {
        const dialog = new TDialogRoot('TestDialog', 5, 5, 20, 15);
        const checks = {
            modal: dialog.modal === true,
            closable: dialog.closable === true,
            draggableAtRuntime: dialog.draggableAtRuntime === true,
            centerOnShow: dialog.centerOnShow === true,
            visible: dialog.visible === false,
            title: dialog.title === 'TestDialog',
            slideDirection: dialog.slideDirection === 'right'
        };
        const allOk = Object.values(checks).every(Boolean);
        addResult(
            'B1: TDialogRoot Default-Werte',
            allOk,
            allOk
                ? 'Alle Defaults korrekt: modal=true, closable=true, draggable=true, centerOnShow=true, visible=false'
                : `Fehler: ${JSON.stringify(checks)}`
        );
    } catch (e: any) {
        addResult('B1: TDialogRoot Default-Werte', false, `Fehler: ${e.message}`);
    }

    // ── B2: show()/hide() Toggle ──
    try {
        const dialog = new TDialogRoot('ShowHideTest');
        // Initial unsichtbar
        const initiallyHidden = dialog.visible === false;
        // show() → sichtbar
        dialog.show();
        const afterShow = dialog.visible === true;
        // hide() → unsichtbar
        dialog.hide();
        const afterHide = dialog.visible === false;
        // Erneut show() (Idempotenz)
        dialog.show();
        dialog.show(); // Doppelaufruf
        const afterDoubleShow = dialog.visible === true;

        const ok = initiallyHidden && afterShow && afterHide && afterDoubleShow;
        addResult(
            'B2: show()/hide() Toggle-Zyklus',
            ok,
            ok
                ? 'show/hide wechseln Sichtbarkeit korrekt, Doppelaufrufe sind idempotent.'
                : `initial=${initiallyHidden}, afterShow=${afterShow}, afterHide=${afterHide}, doubleShow=${afterDoubleShow}`
        );
    } catch (e: any) {
        addResult('B2: show()/hide() Toggle-Zyklus', false, `Fehler: ${e.message}`);
    }

    // ── B3: close() setzt visible=false ──
    try {
        const dialog = new TDialogRoot('CloseTest');
        dialog.show();
        const wasVisible = dialog.visible === true;
        dialog.close();
        const afterClose = dialog.visible === false;
        const ok = wasVisible && afterClose;
        addResult(
            'B3: close() setzt visible=false',
            ok,
            ok
                ? 'close() macht Dialog unsichtbar.'
                : `wasVisible=${wasVisible}, afterClose=${afterClose}`
        );
    } catch (e: any) {
        addResult('B3: close() setzt visible=false', false, `Fehler: ${e.message}`);
    }

    // ── B4: cancel() setzt visible=false ──
    try {
        const dialog = new TDialogRoot('CancelTest');
        dialog.show();
        const wasVisible = dialog.visible === true;
        dialog.cancel();
        const afterCancel = dialog.visible === false;
        const ok = wasVisible && afterCancel;
        addResult(
            'B4: cancel() setzt visible=false',
            ok,
            ok
                ? 'cancel() macht Dialog unsichtbar.'
                : `wasVisible=${wasVisible}, afterCancel=${afterCancel}`
        );
    } catch (e: any) {
        addResult('B4: cancel() setzt visible=false', false, `Fehler: ${e.message}`);
    }

    // ── B5: toggle() wechselt Sichtbarkeit ──
    try {
        const dialog = new TDialogRoot('ToggleTest');
        // Initial: false
        dialog.toggle(); // → true
        const afterFirst = dialog.visible === true;
        dialog.toggle(); // → false
        const afterSecond = dialog.visible === false;
        dialog.toggle(); // → true
        const afterThird = dialog.visible === true;

        const ok = afterFirst && afterSecond && afterThird;
        addResult(
            'B5: toggle() Zyklus',
            ok,
            ok
                ? 'toggle() wechselt korrekt: false→true→false→true'
                : `first=${afterFirst}, second=${afterSecond}, third=${afterThird}`
        );
    } catch (e: any) {
        addResult('B5: toggle() Zyklus', false, `Fehler: ${e.message}`);
    }

    // ── B6: toDTO() serialisiert alle Dialog-Properties ──
    try {
        const dialog = new TDialogRoot('SerializationTest', 10, 20, 30, 25);
        dialog.modal = false;
        dialog.closable = false;
        dialog.draggableAtRuntime = false;
        dialog.centerOnShow = false;
        dialog.title = 'Mein Dialog';
        dialog.slideDirection = 'left';
        dialog.onShowTask = 'TaskShow';
        dialog.onCloseTask = 'TaskClose';
        dialog.onCancelTask = 'TaskCancel';

        const dto = dialog.toDTO();

        const checks = {
            hasTitle: dto.title === 'Mein Dialog',
            hasModal: dto.modal === false,
            hasClosable: dto.closable === false,
            hasDraggable: dto.draggableAtRuntime === false,
            hasCenterOnShow: dto.centerOnShow === false,
            hasSlideDirection: dto.slideDirection === 'left',
            hasOnShowTask: dto.onShowTask === 'TaskShow',
            hasOnCloseTask: dto.onCloseTask === 'TaskClose',
            hasOnCancelTask: dto.onCancelTask === 'TaskCancel',
            hasClassName: dto.className === 'TDialogRoot',
            hasPosition: dto.x === 10 && dto.y === 20,
            hasSize: dto.width === 30 && dto.height === 25
        };

        const allOk = Object.values(checks).every(Boolean);
        addResult(
            'B6: toDTO() serialisiert Dialog-Properties',
            allOk,
            allOk
                ? 'Alle Properties (modal, closable, draggable, centerOnShow, slideDirection, title, Events) korrekt serialisiert.'
                : `Fehler: ${JSON.stringify(checks)}`
        );
    } catch (e: any) {
        addResult('B6: toDTO() serialisiert Dialog-Properties', false, `Fehler: ${e.message}`);
    }

    // ══════════════════════════════════════════════════════════════
    // Zusammenfassung
    // ══════════════════════════════════════════════════════════════
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    console.log(`\n  StageTransition-Regression: ${passed} bestanden, ${failed} fehlgeschlagen`);

    return results;
}
