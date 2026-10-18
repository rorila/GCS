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
import assert from 'node:assert/strict';
import type { GameRuntime } from '../src/runtime/GameRuntime';
import type { GameProject, GridConfig, StageDefinition } from '../src/model/types';

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
    let fastPathSource = '';

    try {
        runtimeSource = readSourceFile('src/runtime/GameRuntime.ts');
        rendererSource = readSourceFile('src/editor/services/StageRenderer.ts');
        fastPathSource = readSourceFile('src/editor/services/renderers/StageFastPathUpdater.ts');
    } catch (e: any) {
        addResult('A0: Quelldateien lesbar', false, e.message);
        return results;
    }

    // ── A1: handleStageChange enthält glm.init() ──
    // REGRESSION: Ohne glm.init() frieren Physik, Sprites und Animationen nach Stage-Wechsel ein
    try {
        const handleStageChangeBody = extractMethodBody(runtimeSource, 'handleStageChange');
        const initMainGameBody = extractMethodBody(runtimeSource, 'initMainGame');
        const hasGlmInit = handleStageChangeBody.includes('glm.init(') ||
            (handleStageChangeBody.includes('this.initMainGame(') && initMainGameBody.includes('glm.init('));
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
    // Nach dem Refactoring kann die Methode selbst oder ihr delegierter Fast-Path die Map enthalten.
    try {
        const updateBody = extractMethodBody(rendererSource, 'updateSpritePositions') +
            '\n' +
            extractMethodBody(fastPathSource, 'updateSpritePositions');
        const hasMap = updateBody.includes('new Map<') || updateBody.includes('new Map(') || updateBody.includes('fastPathUpdateMap');
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
    results.push(...await runStageLifecycleBehaviorTests());

    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    console.log(`\n  StageTransition-Regression: ${passed} bestanden, ${failed} fehlgeschlagen`);

    return results;
}

export async function runStageLifecycleBehaviorTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const globals = ['window', 'document', 'HTMLElement', 'Node', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'];
    const savedGlobals = globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
    const frames = new Map<number, FrameRequestCallback>();
    const timeouts = new Map<number, () => void>();
    let nextId = 0;
    const installGlobal = (key: string, value: unknown) => {
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    };
    installGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        const id = ++nextId;
        frames.set(id, callback);
        return id;
    });
    installGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    installGlobal('setTimeout', (callback: () => void) => {
        const id = ++nextId;
        timeouts.set(id, callback);
        return id;
    });
    installGlobal('clearTimeout', (id: number) => timeouts.delete(id));
    installGlobal('window', Object.assign(new EventTarget(), {
        location: { hostname: 'localhost', search: '' },
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout
    }));
    installGlobal('document', Object.assign(new EventTarget(), { querySelector: () => null }));
    installGlobal('Node', class {});
    installGlobal('HTMLElement', class extends Node {});

    try {
        const { GameRuntime: Runtime } = await import('../src/runtime/GameRuntime.js');
        const { GameLoopManager } = await import('../src/runtime/GameLoopManager.js');
        const { TSprite } = await import('../src/components/TSprite.js');
        const { themeRegistry } = await import('../src/runtime/ThemeRegistry.js');
        const previousThemeListener = themeRegistry.onChange;
        const glm = GameLoopManager.getInstance();
        class LifecycleSprite extends TSprite {
            runtimeStarts = 0;
            enterCount = 0;
            stageStartCount = 0;
            onRuntimeStart(): void { this.runtimeStarts++; }
        }
        const grid: GridConfig = { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: false, backgroundColor: '#000000' };
        const createStage = (id: string, type: StageDefinition['type']): StageDefinition => {
            const sprite = new LifecycleSprite(`${id}_sprite`, 2, 3, 1, 1);
            sprite.id = `${id}_sprite`;
            sprite.className = 'TSprite';
            sprite.velocityX = 6;
            return {
                id, name: id, type, grid: { ...grid }, objects: [sprite], startAnimation: 'none',
                events: { onEnter: `${id}_enter`, onRuntimeStart: `${id}_start` },
                tasks: [
                    { name: `${id}_enter`, actionSequence: [{ type: 'action', name: `${id}_count_enter` }] },
                    { name: `${id}_start`, actionSequence: [{ type: 'action', name: `${id}_count_start` }] }
                ],
                actions: [
                    { name: `${id}_count_enter`, type: 'increment', changes: { [`${sprite.name}.enterCount`]: 1 } },
                    { name: `${id}_count_start`, type: 'increment', changes: { [`${sprite.name}.stageStartCount`]: 1 } }
                ]
            };
        };
        const frame = (time: number) => {
            const pending = [...frames];
            for (const [id, callback] of pending) {
                if (!frames.delete(id)) continue;
                callback(time);
            }
        };
        const settle = () => new Promise<void>(resolve => setImmediate(resolve));
        const routes = ['API', 'Controller', 'Direkt', 'Splash', 'Legacy-Splash', 'Reset', 'Reset verzögert'] as const;

        try {
            for (const makeReactive of [false, true]) {
                for (const route of routes) {
                    const name = `Runtime-Lifecycle: ${route} (${makeReactive ? 'reaktiv' : 'direkt'})`;
                    let runtime: GameRuntime | undefined;
                    try {
                        const splash = route === 'Splash' || route === 'Legacy-Splash';
                        const source = createStage('source', splash ? 'splash' : 'standard');
                        const target = createStage('target', splash ? 'main' : 'standard');
                        const project: GameProject = {
                            meta: { name: 'Lifecycle regression', author: 'Test', version: '1' },
                            stage: { grid: { ...grid } }, stages: [source, target],
                            activeStageId: source.id, objects: [], actions: [], tasks: [], variables: []
                        };
                        const switches: string[] = [];
                        const rendered: { id: string; x: number }[][] = [];
                        runtime = new Runtime(project, undefined, {
                            startStageId: source.id, makeReactive,
                            onRender: () => {},
                            onComponentUpdate: () => {},
                            onStageSwitch: id => switches.push(id),
                            onSpriteRender: objects => rendered.push(objects.map(obj => ({ id: obj.id, x: obj.renderX })))
                        });
                        runtime.start();
                        await settle();
                        switches.length = 0;
                        rendered.length = 0;

                        if (route === 'API') {
                            runtime.switchToStage(target.id);
                        } else if (route === 'Controller') {
                            runtime.stageController!.goToStage(target.id);
                        } else if (route === 'Direkt') {
                            runtime.handleStageChange(source.id, target.id);
                        } else if (route === 'Splash') {
                            runtime.stageService.finishSplash(runtime);
                        } else if (route === 'Legacy-Splash') {
                            runtime.stageController = null;
                            runtime.stageService.finishSplash(runtime);
                        } else {
                            runtime.switchToStage(target.id);
                            await settle();
                            const current = runtime.getObjects().find(obj => obj.id === 'target_sprite') as LifecycleSprite;
                            current.runtimeStarts = current.enterCount = current.stageStartCount = 0;
                            if (route === 'Reset verzögert') {
                                target.startAnimation = 'fade-in';
                                target.startLogicAfterAnimation = true;
                                target.startAnimationDuration = 100;
                            }
                            switches.length = 0;
                            runtime.stageController!.goToStage(target.id, true);
                        }
                        await settle();

                        const sprite = runtime.getObjects().find(obj => obj.id === 'target_sprite') as LifecycleSprite;
                        assert.ok(sprite instanceof TSprite, 'Die Ziel-Stage enthält einen echten Sprite');
                        assert.equal(runtime.stage.id, target.id);
                        assert.equal(runtime.stageController!.currentStageId, target.id);
                        assert.equal(glm.getState(), 'running', 'Der Loop muss nach dem Stage-Wechsel laufen');
                        assert.deepEqual(switches, [target.id], 'Der Player muss genau einen Stage-Wechsel erhalten');
                        if (route === 'Reset verzögert') {
                            assert.equal(sprite.runtimeStarts, 0, 'Komponentenstart muss bis nach der Animation warten');
                            assert.equal(sprite.enterCount, 0, 'onEnter darf nicht vorzeitig ausgelöst werden');
                            assert.equal(sprite.stageStartCount, 0, 'onRuntimeStart darf nicht vorzeitig ausgelöst werden');
                            const pending = [...timeouts.values()];
                            timeouts.clear();
                            pending.forEach(callback => callback());
                            await settle();
                        }
                        assert.equal(sprite.runtimeStarts, 1, 'Komponentenstart genau einmal');
                        assert.equal(sprite.enterCount, 1, 'onEnter-Task genau einmal');
                        assert.equal(sprite.stageStartCount, 1, 'onRuntimeStart-Task genau einmal');
                        assert.equal(runtime.isSplashActive, false);

                        if (route !== 'Reset verzögert') {
                            rendered.length = 0;
                            const oldX = sprite.x;
                            const now = performance.now();
                            frame(now);
                            frame(now + 20);
                            assert.ok(sprite.x > oldX, 'Physik muss den Ziel-Sprite weiterbewegen');
                            assert.ok(rendered.some(objects => objects.some(obj => obj.id === sprite.id && obj.x > oldX)), 'Der Loop muss die neue Position an den Player liefern');
                            assert.ok(rendered.every(objects => objects.every(obj => obj.id !== 'source_sprite')), 'Alte Stage-Sprites dürfen nicht weitergezeichnet werden');
                        }
                        const starts = sprite.runtimeStarts;
                        switches.length = 0;
                        runtime.switchToStage(target.id);
                        await settle();
                        assert.equal(sprite.runtimeStarts, starts, 'API-Wechsel zur aktiven Stage ist ein No-op');
                        assert.deepEqual(switches, []);
                        runtime.stop();
                        assert.equal(glm.getState(), 'stopped');
                        const count = rendered.length;
                        frame(performance.now() + 40);
                        assert.equal(rendered.length, count, 'Nach Stop keine Loop-Ausgabe');
                        results.push({ name, type: 'StageTransition-Behavior', expectedSuccess: true, actualSuccess: true, passed: true });
                    } catch (error) {
                        results.push({ name, type: 'StageTransition-Behavior', expectedSuccess: true, actualSuccess: false, passed: false, details: error instanceof Error ? error.message : String(error) });
                    } finally {
                        runtime?.stop();
                        frames.clear();
                        timeouts.clear();
                    }
                }
            }
        } finally {
            glm.stop();
            themeRegistry.onChange = previousThemeListener;
        }
    } finally {
        for (const [key, descriptor] of savedGlobals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    }
    return results;
}
