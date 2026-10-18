import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

(globalThis as any).Image ??= class {
    naturalWidth = 427;
    naturalHeight = 640;
    onload?: () => void;
    onerror?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
};
(globalThis as any).Node ??= class Node {};
(globalThis as any).HTMLElement ??= class HTMLElement extends (globalThis as any).Node {};
(globalThis as any).window ??= { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
(globalThis as any).document ??= {
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
    querySelector: () => null,
    getElementById: () => null,
    head: { appendChild() {} },
    body: { appendChild() {}, style: {} },
    documentElement: { style: {} },
};

import { actionRegistry } from '../src/runtime/ActionRegistry';
import { registerStandardActions } from '../src/runtime/actions/StandardActions';
import { TaskLoopHandler } from '../src/runtime/executor/TaskLoopHandler';
import { PropertyHelper } from '../src/runtime/PropertyHelper';
import { RuntimeVariableManager } from '../src/runtime/RuntimeVariableManager';
import { ExpressionParser } from '../src/runtime/ExpressionParser';
import { ActionExecutor } from '../src/runtime/ActionExecutor';
import { TaskExecutor } from '../src/runtime/TaskExecutor';
import { RuntimeStageManager } from '../src/runtime/RuntimeStageManager';
import { RuntimeObjectService } from '../src/runtime/services/RuntimeObjectService';
import { SpritePool } from '../src/runtime/SpritePool';
import { ReactiveRuntime } from '../src/runtime/ReactiveRuntime';
import { SpriteGeometry } from '../src/runtime/SpriteGeometry';
import { TSprite } from '../src/components/TSprite';
import { TSpriteTemplate } from '../src/components/TSpriteTemplate';
import { hydrateObjects } from '../src/utils/Serialization';

registerStandardActions();

test('Quellrechtecke verwenden Pixel statt Rasterindizes und lehnen ungueltige Grenzen ab', () => {
    const rect = SpriteGeometry.sourceRect(427, 640, 85.4, 128, 85.4, 128)!;
    assert.equal(rect.widthPercent, 500);
    assert.equal(rect.heightPercent, 500);
    assert.equal(rect.tx, -20);
    assert.equal(rect.ty, -20);
    assert.ok(SpriteGeometry.sourceRect(427, 640, 341.6, 512, 85.4, 128));
    const uneven = SpriteGeometry.sourceRect(400, 300, 37, 21, 80, 75)!;
    assert.equal(uneven.tx, -9.25);
    assert.ok(Math.abs(uneven.ty + 7) < 1e-10);
    assert.equal(uneven.heightPercent, 400);
    for (const values of [
        [0, 640, 0, 0, 85, 128], [427, 640, -1, 0, 85, 128],
        [427, 640, 0, 0, 0, 128], [427, 640, 400, 0, 85, 128],
        [427, 640, 0, 600, 85, 128], [427, 640, NaN, 0, 85, 128],
        [Infinity, 640, 0, 0, 85, 128]
    ]) assert.equal(SpriteGeometry.sourceRect(...values as [number, number, number, number, number, number]), null);
});

test('Quellrechtecke ueberleben Serialisierung und bleiben pro Pool-Instanz unabhaengig', () => {
    const template = new TSpriteTemplate('RectTemplate', 0, 0, 3, 4);
    Object.assign(template, {
        appearanceMode: 'sourceRect', backgroundImage: './images/puzzle-neu.svg',
        sourceWidth: 400, sourceHeight: 300, sourceRectX: 37, sourceRectY: 21,
        sourceRectWidth: 80, sourceRectHeight: 75, matchValue: 'r0_c1', poolSize: 2
    });
    const restored = hydrateObjects([template.toDTO()])[0] as TSprite;
    for (const prop of ['appearanceMode', 'backgroundImage', 'sourceWidth', 'sourceHeight',
        'sourceRectX', 'sourceRectY', 'sourceRectWidth', 'sourceRectHeight', 'matchValue']) {
        assert.equal((restored as any)[prop], (template as any)[prop], prop);
        assert.ok(template.getInspectorProperties().some(p => p.name === prop), prop);
    }
    const pool = new SpritePool();
    pool.init(template, []);
    const first = pool.acquire(template.id, 22, 6, template)!;
    template.sourceRectX = 120;
    template.matchValue = 'r0_c2';
    const second = pool.acquire(template.id, 25, 6, template)!;
    assert.equal(first.sourceRectX, 37);
    assert.equal(first.matchValue, 'r0_c1');
    assert.equal(second.sourceRectX, 120);
    assert.equal(second.matchValue, 'r0_c2');
    assert.equal(first.backgroundImage, second.backgroundImage);
    assert.equal(first.x, 22);
    pool.release(first.id);
    template.sourceRectWidth = 50;
    assert.equal(pool.acquire(template.id, 28, 6, template)!.sourceRectWidth, 50);
    assert.equal(second.sourceRectWidth, 80);
});

const project = JSON.parse(readFileSync(new URL('../public/test-projects/PuzzleNeu.json', import.meta.url), 'utf8'));
const blueprint = project.stages.find((stage: any) => stage.type === 'blueprint');
const main = project.stages.find((stage: any) => stage.id === 'stage_main');

function createRuntime() {
    const objects = new RuntimeStageManager(project).getMergedStageData('stage_main').objects;
    const splitter = objects.find((object: any) => object.name === 'Bildaufteiler');
    splitter.initRuntime({ objects });
    splitter.imageSource = PropertyHelper.interpolate(splitter.imageSource, {}, objects);
    const objectVars: Record<string, any> = Object.create(null);
    for (const object of objects) if (object.name) objectVars[object.name] = object;
    const manager = new RuntimeVariableManager({
        project, stage: main, taskExecutor: null,
        reactiveRuntime: { setVariable() {} }, startTimer() {},
        objects,
    } as any);
    manager.importVariablesFromObjects(objects);
    const globalVars = manager.contextVars;
    const spawned: any[] = [];
    const pool = new SpritePool();
    const poolTemplate = objects.find((o: any) => o.name === 'PuzzleTeilTemplate');
    pool.init(poolTemplate, objects, globalVars);

    // Wie die echte Runtime: resetPool() geht ueber den resetSpritePool-Callback
    // an den RuntimeObjectService.
    const objectService = new RuntimeObjectService();
    const fakeRuntime: any = {
        spritePool: pool,
        objects,
        project,
        get projectVariables() { return manager.projectVariables; },
        get stageVariables() { return manager.stageVariables; },
        options: {},
        reactiveRuntime: null,
        actionExecutor: null,
    };
    poolTemplate.initRuntime?.({
        resetSpritePool: (template: any) => objectService.resetSpritePool(fakeRuntime, template),
    });

    const context: any = {
        objects,
        vars: objectVars,
        contextVars: globalVars,
        eventData: {},
        spawnObject(templateId: string, x: number, y: number) {
            const template = objects.find((object: any) => object.id === templateId || object.name === templateId);
            assert.ok(template, `Template ${templateId} fehlt`);
            const sprite = pool.acquire(template.id, x, y, template);
            assert.ok(sprite);
            spawned.push(sprite);
            return sprite;
        },
    };

    const executeSequence = async (sequence: any[], localVars: Record<string, any>): Promise<void> => {
        for (const item of sequence || []) {
            if (item.type === 'foreach') {
                await TaskLoopHandler.handleForeach(
                    item, localVars, globalVars, undefined, 0, undefined,
                    executeSequence, objects,
                );
                continue;
            }
            if (item.type === 'task') {
                const subTask = blueprint.tasks.find((entry: any) => entry.name === item.name);
                assert.ok(subTask, `Task-Verweis ${item.name} fehlt`);
                await executeSequence(subTask.actionSequence, localVars);
                continue;
            }
            const action = item.type === 'action'
                ? blueprint.actions.find((entry: any) => entry.name === item.name)
                : item;
            assert.ok(action, `Action-Verweis ${item.name} fehlt`);
            const handler = actionRegistry.getHandler(action.type);
            assert.ok(handler, `Kein Handler fuer ${action.type}`);
            await handler(action, { ...context, vars: localVars });
        }
    };

    return { objects, objectVars, globalVars, spawned, executeSequence };
}

test('RuntimeVariableManager importiert TObjectList-Records statt der leeren items-Liste', () => {
    const list = main.objects.find((object: any) => object.name === 'PuzzleTeile');
    const host: any = {
        project: {}, stage: main, taskExecutor: null,
        reactiveRuntime: { setVariable() {} },
        startTimer() {},
    };
    const manager = new RuntimeVariableManager(host);
    manager.importVariablesFromObjects([{ ...list, value: [] }]);
    assert.equal(manager.stageVariables.PuzzleTeile.length, list.records.length);
    assert.equal(manager.stageVariables.PuzzleTeile.at(-1).index, list.records.at(-1).index);
    assert.equal(ExpressionParser.interpolate('${PuzzleTeile.length}', manager.stageVariables), list.records.length);
});

test('contextVars loesen Listen-Variablen gegen die Live-Komponente auf', () => {
    const list = main.objects.find((object: any) => object.name === 'PuzzleTeile');
    const liveList = hydrateObjects([list])[0] as any;
    const host: any = {
        project: {}, stage: main, taskExecutor: null,
        reactiveRuntime: { setVariable() {} },
        startTimer() {},
        objects: [liveList],
    };
    const manager = new RuntimeVariableManager(host);
    manager.importVariablesFromObjects([liveList]);
    const snapshotLength = manager.stageVariables.PuzzleTeile.length;
    liveList.replaceRecords([{ id: 'a', index: 0 }, { id: 'b', index: 1 }, { id: 'c', index: 2 }]);
    // Der Import-Snapshot bleibt unveraendert ...
    assert.equal(manager.stageVariables.PuzzleTeile.length, snapshotLength);
    // ... aber contextVars liefern die aktuellen Records (ForEach, ${Liste.length}).
    assert.equal(manager.contextVars.PuzzleTeile.length, 3);
    assert.equal(manager.contextVars.PuzzleTeile[2].index, 2);
    assert.equal(ExpressionParser.interpolate('${PuzzleTeile.length}', manager.contextVars), 3);
});

test('PuzzleNeu beschreibt die Sprite-Erzeugung sichtbar als ForEach-Flow', () => {
    const splitter = main.objects.find((object: any) => object.name === 'Bildaufteiler');
    const list = main.objects.find((object: any) => object.name === 'PuzzleTeile');
    const imageList = main.objects.find((object: any) => object.name === 'PuzzleBildFrames');
    const template = main.objects.find((object: any) => object.name === 'PuzzleTeilTemplate');
    const button = main.objects.find((object: any) => object.name === 'BtnPuzzleSpritesErzeugen');
    const task = blueprint.tasks.find((entry: any) => entry.name === 'GeneratePuzzleSprites');

    assert.equal(splitter.rows, 3);
    assert.equal(splitter.columns, 3);
    assert.ok(list.records.length > 0);
    assert.equal(imageList.src, '${GewaehltesBild}');
    assert.equal(imageList.imageCountHorizontal, '${Bildaufteiler.columns}');
    assert.equal(imageList.imageCountVertical, '${Bildaufteiler.rows}');
    assert.equal(template.className, 'TSpriteTemplate');
    assert.equal(template.imageListId, '');
    assert.equal(template.appearanceMode, 'sourceRect');
    assert.equal(template.poolSize, '${PuzzleTeile.length}');
    assert.equal(button.events.onClick, 'GeneratePuzzleSprites');

    // Sichtbarer Ablauf: Records erzeugen → Pool-Reset-Task → Mischen → ForEach.
    assert.equal(task.actionSequence[0].name, 'Bildaufteiler aktualisiert PuzzleTeile');
    assert.equal(task.actionSequence[1].type, 'task');
    assert.equal(task.actionSequence[1].name, 'ResetPuzzleSprites');
    const resetTask = blueprint.tasks.find((entry: any) => entry.name === 'ResetPuzzleSprites');
    assert.ok(resetTask);
    const resetAction = blueprint.actions.find((entry: any) => entry.name === resetTask.actionSequence[0].name);
    assert.ok(resetAction);
    assert.equal(resetAction.type, 'call_method');
    assert.equal(resetAction.target, 'PuzzleTeilTemplate');
    assert.equal(resetAction.method, 'resetPool');
    assert.equal(task.actionSequence[2].type, 'action');
    assert.equal(task.actionSequence[2].name, 'PuzzleTeile mischen');
    const shuffleAction = blueprint.actions.find((entry: any) => entry.name === 'PuzzleTeile mischen');
    assert.ok(shuffleAction);
    assert.equal(shuffleAction.type, 'call_method');
    assert.equal(shuffleAction.target, 'PuzzleTeile');
    assert.equal(shuffleAction.method, 'shuffle');
    assert.equal(task.actionSequence[3].type, 'foreach');
    assert.equal(task.actionSequence[3].sourceArray, 'PuzzleTeile');
    assert.equal(task.actionSequence[3].indexVar, 'PuzzleTeilIndex');
    const bodyNames = task.actionSequence[3].body.map((item: any) => item.name);
    assert.deepEqual(bodyNames, ['Bildausschnitt aus Datensatz ins Template', 'Puzzle-Sprite erzeugen']);
    const resolvedTypes = bodyNames.map((name: string) => blueprint.actions.find((entry: any) => entry.name === name)?.type);
    assert.deepEqual(resolvedTypes, ['property', 'spawn_object']);
});

test('SpritePool erzeugt poolSize Instanzen und acquire benachrichtigt den reaktiven Proxy', () => {
    const merged = new RuntimeStageManager(project).getMergedStageData('stage_main');
    const template = merged.objects.find((object: any) => object.name === 'PuzzleTeilTemplate');
    const list = merged.objects.find((object: any) => object.name === 'PuzzleTeile');
    const poolObjects = [...merged.objects];
    const pool = new SpritePool();
    const created = pool.init(template, poolObjects, { PuzzleTeile: list.records });
    assert.equal(created.length, list.records.length);
    assert.equal(created[0].draggable, true, 'Pool-Instanzen muessen draggable vom Template erben');
    assert.equal(created[0].droppable, template.droppable, 'Pool-Instanzen muessen droppable vom Template erben');

    const reactive = new ReactiveRuntime();
    const proxy = reactive.registerObject(created[0].name, created[0], true);
    assert.notEqual(proxy, created[0]);

    let notified = false;
    (reactive as any).watcher.watch(proxy, 'visible', (newValue: any) => {
        notified = notified || newValue === true;
    });

    const acquired = pool.acquire(template.id, 22, 6, template);
    assert.equal(acquired, proxy, 'acquire muss den reaktiven Proxy zurueckgeben');
    assert.equal(proxy.visible, true);
    assert.equal(notified, true, 'acquire muss sichtbar-Änderungen ueber den reaktiven Proxy melden');
});

test('Editor-normalisierte Action-Verweise werden im echten TaskExecutor ausgefuehrt', async () => {
    const merged = new RuntimeStageManager(project).getMergedStageData('stage_main');
    const calls: Array<{ templateId: string; x?: number; y?: number; sourceRectX: number; matchValue: string }> = [];
    const template = merged.objects.find((object: any) => object.name === 'PuzzleTeilTemplate');
    const list = merged.objects.find((object: any) => object.name === 'PuzzleTeile');
    const splitter = merged.objects.find((object: any) => object.name === 'Bildaufteiler');
    splitter.initRuntime({ objects: merged.objects });
    splitter.imageSource = PropertyHelper.interpolate(splitter.imageSource, {}, merged.objects);
    // Wie die echte Runtime: ForEach loest die Liste ueber contextVars auf —
    // nach generatePieces muessen die neuen Records greifen, nicht der
    // Import-Snapshot der Stage-Variablen.
    const manager = new RuntimeVariableManager({
        project, stage: main, taskExecutor: null,
        reactiveRuntime: { setVariable() {} }, startTimer() {},
        objects: merged.objects,
    } as any);
    manager.importVariablesFromObjects(merged.objects);
    const actionExecutor = new ActionExecutor(
        merged.objects, undefined, undefined,
        (templateId, x, y) => {
            calls.push({ templateId, x, y, sourceRectX: template.sourceRectX, matchValue: template.matchValue });
            return {};
        },
    );
    const taskExecutor = new TaskExecutor(project, merged.actions, actionExecutor, merged.flowCharts, undefined, merged.tasks);
    actionExecutor.setTaskExecutor(taskExecutor);

    await taskExecutor.execute('GeneratePuzzleSprites', {}, manager.contextVars);

    const pieceCount = Number(splitter.columns) * Number(splitter.rows);
    assert.equal(calls.length, pieceCount);
    assert.deepEqual(
        calls.map(call => Number(call.sourceRectX)),
        list.records.map((record: any) => Number(record.x)),
    );
    assert.deepEqual(
        calls.map(call => call.matchValue),
        list.records.map((record: any) => record.matchValue),
    );
});

test('GeneratePuzzleSprites erzeugt pro Record ein Sprite mit unterschiedlichen Frames', async () => {
    const runtime = createRuntime();
    const task = blueprint.tasks.find((entry: any) => entry.name === 'GeneratePuzzleSprites');
    await runtime.executeSequence(task.actionSequence, Object.create(runtime.objectVars));

    const splitter = runtime.objects.find((o: any) => o.name === 'Bildaufteiler');
    const pieceCount = splitter.rows * splitter.columns;
    assert.equal(runtime.spawned.length, pieceCount);
    // Records werden vor dem ForEach gemischt: die imageIndex-Reihenfolge ist
    // zufaellig, muss aber jeden Index genau einmal enthalten.
    assert.deepEqual(
        runtime.spawned.map(sprite => sprite.imageIndex).sort((a: number, b: number) => a - b),
        Array.from({ length: pieceCount }, (_, index) => index),
    );
    assert.equal(runtime.spawned[0].imageListId, '');
    const records = runtime.objects.find((o: any) => o.name === 'PuzzleTeile').records;
    // spawned[i] stammt aus records[i] (die Liste wurde in-place gemischt).
    runtime.spawned.forEach((sprite, index) => {
        const record = records[index];
        assert.equal(sprite.appearanceMode, 'sourceRect');
        assert.equal(sprite.backgroundImage, record.source);
        assert.equal(sprite.sourceWidth, record.sourceWidth);
        assert.equal(sprite.sourceHeight, record.sourceHeight);
        assert.equal(sprite.sourceRectX, record.x);
        assert.equal(sprite.sourceRectY, record.y);
        assert.equal(sprite.sourceRectWidth, record.width);
        assert.equal(sprite.sourceRectHeight, record.height);
        assert.equal(sprite.matchValue, record.matchValue);
    });
    // Teile bekommen die Zellgroesse des Splitters und liegen gemischt
    // auf dessen Stapel-Position (links), indexVar waehlt die Stapelzelle.
    const pieceW = splitter.width / splitter.columns;
    const pieceH = splitter.height / splitter.rows;
    runtime.spawned.forEach((sprite, index) => {
        assert.deepEqual(
            { x: sprite.x, y: sprite.y, width: sprite.width, height: sprite.height },
            {
                x: splitter.x + (index % splitter.columns) * pieceW,
                y: splitter.y + Math.floor(index / splitter.columns) * pieceH,
                width: pieceW, height: pieceH,
            },
        );
    });
});

test('Bindungen verbinden Galeriepfad, Splitter und SpriteSheet ohne Bildkopien', () => {
    const variable = blueprint.variables.find((entry: any) => entry.name === 'GewaehltesBild');
    const splitter = main.objects.find((object: any) => object.name === 'Bildaufteiler');
    const imageList = main.objects.find((object: any) => object.name === 'PuzzleBildFrames');
    const objects = [...blueprint.variables, ...main.objects];
    const path = './images/memory Tierbilder für kleine Kinder/cat-5992580_640.png';
    variable.value = path;

    assert.equal(PropertyHelper.interpolate(splitter.imageSource, {}, objects), path);
    assert.equal(PropertyHelper.interpolate(imageList.src, {}, objects), path);
    assert.equal(main.objects.filter((object: any) => object.className === 'TSprite').length, 0, 'Sprites duerfen nicht statisch gespeichert sein');
});

test('Zielplattform ist im Projekt verdrahtet und an Splitter-Masse gebunden', () => {
    const board = main.objects.find((object: any) => object.name === 'Zielplattform');
    const splitter = main.objects.find((object: any) => object.name === 'Bildaufteiler');
    assert.ok(board, 'Zielplattform fehlt auf stage_main');
    assert.equal(board.className, 'TPuzzleBoard');
    assert.equal(board.droppable, true);
    assert.equal(board.imageSource, '${GewaehltesBild}');
    assert.equal(board.columns, '${Bildaufteiler.columns}');
    assert.equal(board.rows, '${Bildaufteiler.rows}');
    assert.equal(board.width, splitter.width);
    assert.equal(board.height, splitter.height);
    assert.equal(board.events.onDrop, 'TeilAblegen');
    assert.equal(board.events.onComplete, 'PuzzleGewonnen');
    assert.equal(splitter.isHiddenInRun, true, 'Splitter wird im Spiel nicht mehr angezeigt, liefert aber weiterhin Records');

    const dropTask = blueprint.tasks.find((entry: any) => entry.name === 'TeilAblegen');
    assert.ok(dropTask);
    const dropAction = blueprint.actions.find((entry: any) => entry.name === dropTask.actionSequence[0].name);
    assert.ok(dropAction);
    assert.equal(dropAction.type, 'call_method');
    assert.equal(dropAction.target, 'Zielplattform');
    assert.equal(dropAction.method, 'tryPlacePiece');
    assert.deepEqual(dropAction.params, ['${draggedObj}']);
});

test('TObjectList.shuffle mischt Records in-place und haelt data synchron', () => {
    const listDef = main.objects.find((object: any) => object.name === 'PuzzleTeile');
    const list = hydrateObjects([listDef])[0] as any;
    const before = list.records.map((r: any) => r.id);
    const count = list.shuffle();
    assert.equal(count, list.records.length);
    assert.equal(list.data, list.records, 'data muss dieselbe Referenz wie records bleiben');
    assert.deepEqual([...list.records.map((r: any) => r.id)].sort(), [...before].sort());
});

test('TPuzzleBoard.tryPlacePiece rastet nahe Teile ein und arretiert sie', () => {
    const merged = new RuntimeStageManager(project).getMergedStageData('stage_main');
    const board = merged.objects.find((o: any) => o.name === 'Zielplattform');
    // Gebundene Werte aufloesen wie die Runtime es tut
    board.columns = Number(PropertyHelper.interpolate(board.columns, {}, merged.objects));
    board.rows = Number(PropertyHelper.interpolate(board.rows, {}, merged.objects));
    const events: string[] = [];
    board.initRuntime({ handleEvent: (id: string, ev: string) => events.push(ev), render: () => {} });

    const cols = board.columns, rows = board.rows;
    const cellW = board.width / cols, cellH = board.height / rows;
    const makePiece = (index: number, x: number, y: number) => ({
        id: `p${index}`, name: `p${index}`, imageIndex: index,
        x, y, width: cellW, height: cellH, draggable: true,
    });

    // Teil 0 in die Naehe seiner Zielzelle (col 0, row 0) legen → snap
    const targetX = board.x, targetY = board.y;
    const near = makePiece(0, targetX + board.snapRadius / 2, targetY);
    assert.equal(board.tryPlacePiece(near), true);
    assert.deepEqual({ x: near.x, y: near.y }, { x: targetX, y: targetY });
    assert.equal(near.draggable, false, 'Eingerastete Teile werden arretiert');
    assert.equal(board.placedCount, 1);
    assert.deepEqual(events, ['onPiecePlaced']);

    // Teil 1 weit weg von seiner Zielzelle → kein Snap
    const far = makePiece(1, board.x, board.y + board.height - cellH);
    assert.equal(board.tryPlacePiece(far), false);
    assert.equal(far.draggable, true);
    assert.equal(board.placedCount, 1);

    // Restliche Zellen fuellen → onComplete feuert
    for (let i = 1; i < cols * rows; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        const piece = makePiece(i, board.x + col * cellW, board.y + row * cellH);
        assert.equal(board.tryPlacePiece(piece), true);
    }
    assert.equal(board.placedCount, cols * rows);
    assert.deepEqual(events.filter(e => e === 'onComplete'), ['onComplete']);
});

test('TPuzzleBoard akzeptiert matchValue r{row}_c{col} als Zielindex-Fallback', () => {
    const merged = new RuntimeStageManager(project).getMergedStageData('stage_main');
    const board = merged.objects.find((o: any) => o.name === 'Zielplattform');
    board.columns = 2; board.rows = 2;
    board.initRuntime({});
    const cellW = board.width / 2, cellH = board.height / 2;
    const piece = { id: 'x', name: 'x', matchValue: 'r1_c1', x: board.x + cellW, y: board.y + cellH, width: cellW, height: cellH, draggable: true };
    assert.equal(board.tryPlacePiece(piece), true);
    assert.deepEqual({ x: piece.x, y: piece.y }, { x: board.x + cellW, y: board.y + cellH });
});
