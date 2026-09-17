import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const project = JSON.parse(readFileSync(new URL('../../game-server/public/projects/PuzzleNeu.json', import.meta.url), 'utf8'));
const spriteSelector = '#run-stage [data-id="pn_puzzle_teil_template_pool_0"]';
const splitterDef = project.stages.find((s: any) => s.id === 'stage_main').objects.find((o: any) => o.name === 'Bildaufteiler');
const pieceCount = Number(splitterDef.columns) * Number(splitterDef.rows);

async function generate(page: Page) {
    await page.locator('#run-start-game-btn').click();
    await page.waitForTimeout(2000);
    await page.locator('#run-stage [data-id="pn_btn_puzzle_sprites_erzeugen"]').click();
    await expect.poll(() => page.evaluate(() => (window as any).editor.runtime.spritePool.getActiveInstances().length)).toBe(pieceCount);
}

test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1779, height: 893 });
    await page.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())
        ? route.continue() : route.abort());
    await page.goto('/');
    await page.waitForFunction(() => !!(window as any).editor);
    await page.evaluate(async data => {
        const editor = (window as any).editor;
        editor.loadProject(data);
        await new Promise(resolve => setTimeout(resolve, 500));
        editor.hideManagedObjectsOnStage = true;
        await editor.switchView('flow');
        editor.flowEditor.switchActionFlow('GeneratePuzzleSprites');
        editor.flowEditor.syncToProject();
        await editor.switchView('run');
    }, structuredClone(project));
});

test('Record-Ausschnitte haben Bildflaechen trotz ausgeblendeter Ressourcen und bleiben ziehbar', async ({ page }) => {
    await generate(page);
    const state = await page.evaluate(async () => {
        const editor = (window as any).editor;
        const runtime = editor.runtime;
        const records = runtime.objects.find((o: any) => o.name === 'PuzzleTeile').records;
        const sprites = runtime.objects.filter((o: any) => o.isPoolInstance);
        const layers = sprites.map((sprite: any, index: number) => {
            const mask = document.querySelector(`#run-stage [data-id="${sprite.id}"] .sprite-image-layer`) as HTMLElement;
            const sheet = mask.querySelector('.sprite-sheet-layer') as HTMLElement;
            const b = sheet.getBoundingClientRect();
            const m = mask.getBoundingClientRect();
            const transform = new DOMMatrix(getComputedStyle(sheet).transform);
            const record = records[index];
            return {
                width: b.width, height: b.height, maskWidth: m.width, maskHeight: m.height,
                source: sprite.backgroundImage, recordSource: record.source,
                rect: [sprite.sourceRectX, sprite.sourceRectY, sprite.sourceRectWidth, sprite.sourceRectHeight],
                expected: [record.x, record.y, record.width, record.height],
                offsetX: transform.m41 / b.width, offsetY: transform.m42 / b.height,
                expectedOffsetX: -record.x / record.sourceWidth, expectedOffsetY: -record.y / record.sourceHeight,
                matchValue: sprite.matchValue, expectedMatch: record.matchValue,
                cssWidth: sheet.style.width, cssHeight: sheet.style.height,
                expectedCssWidth: record.sourceWidth / record.width * 100,
                expectedCssHeight: record.sourceHeight / record.height * 100
            };
        });
        const image = new Image();
        image.src = sprites[0].backgroundImage;
        await image.decode();
        return {
            resourceRendered: editor.runManager.runStage.lastRenderedObjects.some((o: any) => o.name === 'PuzzleBildFrames'),
            naturalWidth: image.naturalWidth, expectedWidth: records[0].sourceWidth,
            layers, cellSize: editor.runManager.runStage.grid.cellSize
        };
    });
    expect(state.resourceRendered).toBe(false);
    expect(state.naturalWidth).toBe(state.expectedWidth);
    expect(state.layers).toHaveLength(pieceCount);
    expect(new Set(state.layers.map(layer => layer.source)).size).toBe(1);
    for (const layer of state.layers) {
        expect(layer.width).toBeGreaterThan(0);
        expect(layer.height).toBeGreaterThan(0);
        expect(layer.maskWidth).toBeGreaterThan(0);
        expect(layer.maskHeight).toBeGreaterThan(0);
        expect(parseFloat(layer.cssWidth)).toBeCloseTo(layer.expectedCssWidth);
        expect(parseFloat(layer.cssHeight)).toBeCloseTo(layer.expectedCssHeight);
        expect(layer.rect).toEqual(layer.expected);
        expect(layer.source).toBe(layer.recordSource);
        expect(layer.matchValue).toBe(layer.expectedMatch);
        expect(layer.offsetX).toBeCloseTo(layer.expectedOffsetX, 4);
        expect(layer.offsetY).toBeCloseTo(layer.expectedOffsetY, 4);
    }
    const box = (await page.locator(spriteSelector).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + state.cellSize * 2, box.y + box.height / 2 + state.cellSize * 2, { steps: 8 });
    await page.mouse.up();
    const after = await page.evaluate(() => {
        const runtime = (window as any).editor.runtime;
        const first = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0');
        const second = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_1');
        const records = runtime.objects.find((o: any) => o.name === 'PuzzleTeile').records;
        return { x: first.x, y: first.y, cropX: first.sourceRectX, record0X: records[0].x,
            otherX: second.x, otherCropX: second.sourceRectX, record1X: records[1].x };
    });
    // Spawn-Stapel: Zelle 0 liegt an der Bildaufteiler-Position (1,1); +2 Zellen Drag.
    const splitter = project.stages.find((s: any) => s.id === 'stage_main').objects.find((o: any) => o.name === 'Bildaufteiler');
    expect({ x: after.x, y: after.y }).toEqual({ x: splitter.x + 2, y: splitter.y + 2 });
    // Ausschnitt und Match gehoeren zum gemischten Record der jeweiligen Instanz.
    expect(after.cropX).toBe(after.record0X);
    expect(after.otherCropX).toBe(after.record1X);
    // Nachbar-Teil steht auf Stapelzelle 1 (unveraendert).
    expect(after.otherX).toBe(splitter.x + (splitter.width / splitter.columns));
});

test('Freie Quellrechtecke, ungueltige Werte und bestehende Darstellungsarten', async ({ page }) => {
    await generate(page);
    const result = await page.evaluate(() => {
        const editor = (window as any).editor;
        const runtime = editor.runtime;
        const sprite = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0');
        const renderer = editor.runManager.runStage.renderer;
        const element = document.querySelector(`#run-stage [data-id="${sprite.id}"]`)!;
        const measure = () => {
            const mask = element.querySelector('.sprite-image-layer') as HTMLElement;
            const sheet = mask.querySelector('.sprite-sheet-layer') as HTMLElement;
            return { display: getComputedStyle(mask).display, width: sheet.getBoundingClientRect().width,
                cssWidth: sheet.style.width, cssHeight: sheet.style.height, transform: sheet.style.transform };
        };
        Object.assign(sprite, { sourceRectX: 37, sourceRectY: 21, sourceRectWidth: 80, sourceRectHeight: 75 });
        renderer.updateSpriteFrames([sprite]);
        const arbitrary = measure();
        sprite.sourceRectWidth = 0;
        const invalid = measure();
        sprite.sourceRectWidth = 80;
        const recovered = measure();
        sprite.appearanceMode = 'simple';
        renderer.updateSpriteFrames([sprite]);
        const simpleTag = element.querySelector('.sprite-image-layer')?.tagName;
        const imageList = runtime.objects.find((o: any) => o.name === 'PuzzleBildFrames');
        imageList.isManagedInSidepanel = false;
        // Feste 5x5-Rasterwerte, damit die SpriteSheet-/Animations-Erwartungen
        // unabhaengig von der aktuellen Puzzle-Aufteilung bleiben.
        imageList.imageCountHorizontal = 5;
        imageList.imageCountVertical = 5;
        editor.render();
        Object.assign(sprite, { appearanceMode: 'spritesheet', imageListId: 'PuzzleBildFrames', imageIndex: 24 });
        renderer.updateSpriteFrames([sprite]);
        const legacy = measure();
        runtime.objects.push({ id: 'rect_test_animation', name: 'RectTestAnimation', className: 'TAnimation', imageListId: 'PuzzleBildFrames' });
        editor.render();
        Object.assign(sprite, { animationId: 'RectTestAnimation', appearanceMode: 'animation', imageIndex: 6 });
        renderer.updateSpriteFrames([sprite]);
        const animation = measure();
        sprite.appearanceMode = 'sourceRect';
        renderer.updateSpriteFrames([sprite]);
        return { arbitrary, invalid, recovered, simpleTag, legacy, animation, restored: measure() };
    });
    expect(parseFloat(result.arbitrary.cssWidth)).toBeCloseTo(427 / 80 * 100);
    expect(parseFloat(result.arbitrary.cssHeight)).toBeCloseTo(640 / 75 * 100);
    expect(result.invalid.display).toBe('none');
    expect(result.recovered.width).toBeGreaterThan(0);
    expect(result.simpleTag).toBe('IMG');
    expect(result.legacy.cssWidth).toBe('500%');
    expect(result.legacy.cssHeight).toBe('500%');
    expect(result.legacy.transform).toBe('translate(-80%, -80%)');
    expect(result.animation.cssWidth).toBe('500%');
    expect(result.animation.transform).toBe('translate(-20%, -20%)');
    expect(result.restored.cssWidth).toBe(result.arbitrary.cssWidth);
});

test('resetPool ist als Methode erreichbar und setzt nur den ausgewaehlten Pool zurueck', async ({ page }) => {
    await generate(page);
    const result = await page.evaluate(async () => {
        const editor = (window as any).editor;
        const runtime = editor.runtime;
        const template = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate');
        const { TSpriteTemplate } = await import('/src/components/TSpriteTemplate.ts');
        const other = new TSpriteTemplate('OtherTemplate', 0, 0, 1, 1);
        other.poolSize = 1;
        runtime.objects.push(other);
        runtime.spritePool.init(other, runtime.objects);
        const otherSprite = runtime.spritePool.acquire(other.id, 1, 1, other);
        const { GameLoopManager } = await import('/src/runtime/GameLoopManager.ts');
        const loop = GameLoopManager.getInstance();
        const stateBefore = loop.getState();
        const { DialogDomainHelper } = await import('/src/editor/dialogs/utils/DialogDomainHelper.ts');
        const methods = DialogDomainHelper.getMethodsForObject({ project: editor.project, enrichedProject: { variables: [] }, dialogData: {} } as any, template.name);
        const firstCount = template.resetPool();
        template.poolSize = 3;
        const secondCount = template.resetPool();
        const instances = runtime.objects.filter((o: any) => o.isPoolInstance && o.templateId === template.id);
        const registered = runtime.reactiveRuntime.getObjects().filter((o: any) => o.isPoolInstance && o.templateId === template.id);
        return { firstCount, secondCount, stateBefore, stateAfter: loop.getState(), methods,
            inactive: instances.every((o: any) => !o.visible), count: instances.length, registeredCount: registered.length,
            otherUnchanged: runtime.spritePool.getActiveInstances().includes(otherSprite),
            domCount: document.querySelectorAll('#run-stage [data-id^="pn_puzzle_teil_template_pool_"]').length };
    });
    expect(result.methods).toContain('resetPool');
    expect(result.firstCount).toBe(pieceCount);
    expect(result.secondCount).toBe(3);
    // resetPool darf den GameLoop-Zustand nicht verändern (egal ob running/stopped)
    expect(result.stateAfter).toBe(result.stateBefore);
    expect(result.count).toBe(3);
    expect(result.registeredCount).toBe(3);
    expect(result.domCount).toBe(3);
    expect(result.inactive).toBe(true);
    expect(result.otherUnchanged).toBe(true);
});

test('Erneutes Erzeugen und Galerie-Rundlauf ersetzen die Teile ohne Pool-Leichen', async ({ page }) => {
    await generate(page);
    await page.evaluate(() => {
        (window as any).__firstPuzzleSprite = (window as any).editor.runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0');
    });
    await page.locator('#run-stage [data-id="pn_btn_puzzle_sprites_erzeugen"]').click();
    await page.waitForFunction(count => {
        const runtime = (window as any).editor.runtime;
        return runtime.spritePool.getActiveInstances().length === count
            && runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0') !== (window as any).__firstPuzzleSprite;
    }, pieceCount);
    for (const file of ['cat-5992580_640.png', 'ai-generated-7734145_640.jpg']) {
        await page.locator('#run-stage [data-id="pn_btn_bild_auswaehlen"]').click();
        await page.locator(`#run-stage .image-gallery-tile[data-path$="${file}"]`).click();
        await page.locator('#run-stage [data-id="pn_btn_bild_nehmen"]').click();
        await page.locator('#run-stage [data-id="pn_btn_puzzle_sprites_erzeugen"]').click();
        await expect.poll(() => page.evaluate(file => {
            const runtime = (window as any).editor.runtime;
            return runtime.objects.filter((o: any) => o.isPoolInstance && o.visible && o.backgroundImage.endsWith(file)).length;
        }, file)).toBe(pieceCount);
        const state = await page.evaluate(() => {
            const runtime = (window as any).editor.runtime;
            const instances = runtime.objects.filter((o: any) => o.isPoolInstance);
            return { active: runtime.spritePool.getActiveInstances().length,
                count: instances.length, uniqueIds: new Set(instances.map((o: any) => o.id)).size,
                registered: runtime.reactiveRuntime.getObjects().filter((o: any) => o.isPoolInstance).length,
                sheetWidths: [...document.querySelectorAll('#run-stage [data-id*="_pool_"] .sprite-sheet-layer')].map(el => el.getBoundingClientRect().width)
            };
        });
        expect(state.count).toBe(pieceCount);
        expect(state.active).toBe(pieceCount);
        expect(state.uniqueIds).toBe(pieceCount);
        expect(state.registered).toBe(pieceCount);
        expect(state.sheetWidths).toHaveLength(pieceCount);
        expect(state.sheetWidths.every(width => width > 0)).toBe(true);
    }
    const box = (await page.locator(spriteSelector).boundingBox())!;
    const cell = await page.evaluate(() => (window as any).editor.runManager.runStage.grid.cellSize);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 2 * cell, box.y + box.height / 2 + 2 * cell, { steps: 8 });
    await page.mouse.up();
    expect(await page.evaluate(() => {
        const obj = (window as any).editor.runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0');
        return [obj.x, obj.y];
    })).toEqual([splitterDef.x + 2, splitterDef.y + 2]);
});

test('Neue Bildauswahl erzeugt aktuelle Records statt der gespeicherten Bildquelle', async ({ page }) => {
    const path = './images/memory Tierbilder für kleine Kinder/cat-5992580_640.png';
    await page.evaluate(path => {
        (window as any).editor.runtime.contextVars.GewaehltesBild = path;
    }, path);
    await generate(page);
    const state = await page.evaluate(() => {
        const runtime = (window as any).editor.runtime;
        return {
            records: runtime.objects.find((o: any) => o.name === 'PuzzleTeile').records.map((r: any) => r.source),
            sources: runtime.spritePool.getActiveInstances().map((s: any) => s.backgroundImage)
        };
    });
    expect(state.records).toEqual(Array(pieceCount).fill(path));
    expect(state.sources).toEqual(Array(pieceCount).fill(path));
});

test('Teil rastet nahe seiner Zielzelle auf der Zielplattform ein', async ({ page }) => {
    await generate(page);
    const setup = await page.evaluate(() => {
        const runtime = (window as any).editor.runtime;
        const stage = (window as any).editor.runManager.runStage;
        const board = runtime.objects.find((o: any) => o.name === 'Zielplattform');
        const sprite = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0');
        const records = runtime.objects.find((o: any) => o.name === 'PuzzleTeile').records;
        const record = records.find((r: any) => r.index === sprite.imageIndex);
        const col = record.column, row = record.row;
        const cellW = board.width / board.columns, cellH = board.height / board.rows;
        const targetX = board.x + col * cellW, targetY = board.y + row * cellH;
        const stageRect = stage.element.getBoundingClientRect();
        const cellSize = stage.grid.cellSize;
        const toPx = (gx: number, gy: number) => ({ x: stageRect.left + gx * cellSize, y: stageRect.top + gy * cellSize });
        const pieceCenter = toPx(sprite.x + sprite.width / 2, sprite.y + sprite.height / 2);
        // Loslassen etwas neben dem Zellzentrum, aber innerhalb des snapRadius
        const dropCenter = toPx(targetX + cellW / 2 + 1, targetY + cellH / 2 + 1);
        return { pieceCenter, dropCenter, targetX, targetY, snapRadius: board.snapRadius,
            ghostVisible: !!document.querySelector('#run-stage [data-id="pn_zielplattform"] .puzzle-board-ghost') };
    });
    expect(setup.ghostVisible).toBe(true);

    await page.mouse.move(setup.pieceCenter.x, setup.pieceCenter.y);
    await page.mouse.down();
    await page.mouse.move(setup.dropCenter.x, setup.dropCenter.y, { steps: 12 });
    await page.mouse.up();

    const result = await page.evaluate(() => {
        const runtime = (window as any).editor.runtime;
        const board = runtime.objects.find((o: any) => o.name === 'Zielplattform');
        const sprite = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0');
        return { x: sprite.x, y: sprite.y, draggable: sprite.draggable, placedCount: board.placedCount };
    });
    expect({ x: result.x, y: result.y }).toEqual({ x: setup.targetX, y: setup.targetY });
    expect(result.draggable).toBe(false);
    expect(result.placedCount).toBe(1);
});

test('Teil ausserhalb des Snap-Radius bleibt lose liegen', async ({ page }) => {
    await generate(page);
    const setup = await page.evaluate(() => {
        const runtime = (window as any).editor.runtime;
        const stage = (window as any).editor.runManager.runStage;
        const board = runtime.objects.find((o: any) => o.name === 'Zielplattform');
        const sprite = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0');
        const stageRect = stage.element.getBoundingClientRect();
        const cellSize = stage.grid.cellSize;
        const toPx = (gx: number, gy: number) => ({ x: stageRect.left + gx * cellSize, y: stageRect.top + gy * cellSize });
        const pieceCenter = toPx(sprite.x + sprite.width / 2, sprite.y + sprite.height / 2);
        // Auf die Plattform, aber weit weg von der eigenen Zielzelle (andere Ecke)
        const records = runtime.objects.find((o: any) => o.name === 'PuzzleTeile').records;
        const record = records.find((r: any) => r.index === sprite.imageIndex);
        const farCol = record.column === 0 ? board.columns - 1 : 0;
        const farRow = record.row === 0 ? board.rows - 1 : 0;
        const cellW = board.width / board.columns, cellH = board.height / board.rows;
        const dropCenter = toPx(board.x + (farCol + 0.5) * cellW, board.y + (farRow + 0.5) * cellH);
        return { pieceCenter, dropCenter };
    });

    await page.mouse.move(setup.pieceCenter.x, setup.pieceCenter.y);
    await page.mouse.down();
    await page.mouse.move(setup.dropCenter.x, setup.dropCenter.y, { steps: 12 });
    await page.mouse.up();

    const result = await page.evaluate(() => {
        const runtime = (window as any).editor.runtime;
        const board = runtime.objects.find((o: any) => o.name === 'Zielplattform');
        const sprite = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0');
        return { draggable: sprite.draggable, placedCount: board.placedCount };
    });
    expect(result.placedCount).toBe(0);
    expect(result.draggable).toBe(true);
});
