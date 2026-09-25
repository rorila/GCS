import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const project = JSON.parse(readFileSync(new URL('../../public/test-projects/PuzzleNeu.json', import.meta.url), 'utf8'));
const spriteSelector = '#run-stage [data-id="pn_puzzle_teil_template_pool_0"]';
const splitterDef = project.stages.find((s: any) => s.id === 'stage_main').objects.find((o: any) => o.name === 'Bildaufteiler');
const pieceCount = Number(splitterDef.columns) * Number(splitterDef.rows);

// Produktvertrag von "TeilAblegen" (onDragEnd): ein Teil, das nicht auf der
// Zielplattform losgelassen wird oder dort ausserhalb des Snap-Radius landet,
// wird per move_to + lockDuringMove zum Startplatz (spawnX/spawnY) zurueckbewegt
// und ist danach wieder ziehbar. Liefert die gewartete Endposition.
async function waitForReturnToSpawn(page: Page, pieceName = 'PuzzleTeilTemplate_pool_0') {
    await expect.poll(() => page.evaluate(name =>
        (window as any).editor.runtime.objects.find((o: any) => o.name === name).draggable
    , pieceName), { timeout: 5000 }).toBe(true);
    return page.evaluate(name => {
        const s = (window as any).editor.runtime.objects.find((o: any) => o.name === name);
        return { x: s.x, y: s.y, spawnX: s.spawnX, spawnY: s.spawnY };
    }, pieceName);
}

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
            const el = document.querySelector(`#run-stage [data-id="${sprite.id}"]`) as HTMLElement;
            const svg = el?.querySelector('.puzzle-piece-layer') as SVGSVGElement | null;
            const img = svg?.querySelector('image');
            const box = el?.getBoundingClientRect();
            const record = records[index];
            return {
                rendered: !!svg && !!img,
                width: box?.width ?? 0, height: box?.height ?? 0,
                source: sprite.backgroundImage, recordSource: record.source,
                rect: [sprite.sourceRectX, sprite.sourceRectY, sprite.sourceRectWidth, sprite.sourceRectHeight],
                expected: [record.x, record.y, record.width, record.height],
                // SVG-Vertrag: <image> liegt bei (-x, -y) mit voller Quellgroesse
                imgX: img ? Number(img.getAttribute('x')) : NaN,
                imgY: img ? Number(img.getAttribute('y')) : NaN,
                imgW: img ? Number(img.getAttribute('width')) : NaN,
                imgH: img ? Number(img.getAttribute('height')) : NaN,
                expectedImgX: -record.x, expectedImgY: -record.y,
                expectedImgW: record.sourceWidth, expectedImgH: record.sourceHeight,
                matchValue: sprite.matchValue, expectedMatch: record.matchValue
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
    expect(new Set(state.layers.map((layer: any) => layer.source)).size).toBe(1);
    for (const layer of state.layers) {
        expect(layer.rendered).toBe(true);
        expect(layer.width).toBeGreaterThan(0);
        expect(layer.height).toBeGreaterThan(0);
        expect(layer.rect).toEqual(layer.expected);
        expect(layer.imgX).toBeCloseTo(layer.expectedImgX);
        expect(layer.imgY).toBeCloseTo(layer.expectedImgY);
        expect(layer.imgW).toBeCloseTo(layer.expectedImgW);
        expect(layer.imgH).toBeCloseTo(layer.expectedImgH);
        expect(layer.source).toBe(layer.recordSource);
        expect(layer.matchValue).toBe(layer.expectedMatch);
    }
    const box = (await page.locator(spriteSelector).boundingBox())!;
    const pxCell = box.width / await page.evaluate(() =>
        (window as any).editor.runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0').width);
    // Ins Leere ziehen: das Teil ist ziehbar, wird aber nicht auf einer droppable
    // Flaeche losgelassen → TeilAblegen bewegt es zum Startplatz zurueck.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + pxCell * 2, box.y + box.height / 2 + pxCell * 2, { steps: 8 });
    await page.mouse.up();
    const home = await waitForReturnToSpawn(page);
    expect(home.x).toBeCloseTo(home.spawnX, 1);
    expect(home.y).toBeCloseTo(home.spawnY, 1);
    const after = await page.evaluate(() => {
        const runtime = (window as any).editor.runtime;
        const first = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0');
        const second = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_1');
        const records = runtime.objects.find((o: any) => o.name === 'PuzzleTeile').records;
        return { cropX: first.sourceRectX, record0X: records[0].x,
            otherCropX: second.sourceRectX, record1X: records[1].x };
    });
    // Ausschnitt und Match gehoeren zum gemischten Record der jeweiligen Instanz.
    expect(after.cropX).toBe(after.record0X);
    expect(after.otherCropX).toBe(after.record1X);
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
            const svg = element.querySelector('.puzzle-piece-layer') as SVGSVGElement | null;
            const mask = element.querySelector('.sprite-image-layer') as HTMLElement | null;
            if (svg && !mask) {
                const img = svg.querySelector('image')!;
                return { mode: 'puzzle', display: getComputedStyle(element).display,
                    width: element.getBoundingClientRect().width,
                    imgX: Number(img.getAttribute('x')), imgY: Number(img.getAttribute('y')),
                    imgW: Number(img.getAttribute('width')), imgH: Number(img.getAttribute('height')) };
            }
            const sheet = mask?.querySelector('.sprite-sheet-layer') as HTMLElement | null;
            return { mode: 'sheet', display: mask ? getComputedStyle(mask).display : 'none',
                width: sheet ? sheet.getBoundingClientRect().width : 0,
                cssWidth: sheet?.style.width, cssHeight: sheet?.style.height, transform: sheet?.style.transform };
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
    // Gueltiges Quellrechteck mit Puzzle-Kanten -> SVG-Darstellung (puzzle-piece-layer)
    expect(result.arbitrary.mode).toBe('puzzle');
    expect(result.arbitrary.imgX).toBeCloseTo(-37);
    expect(result.arbitrary.imgY).toBeCloseTo(-21);
    expect(result.arbitrary.imgW).toBeCloseTo(427);
    expect(result.arbitrary.imgH).toBeCloseTo(640);
    expect(result.invalid.display).toBe('none');
    expect(result.recovered.mode).toBe('puzzle');
    expect(result.recovered.width).toBeGreaterThan(0);
    expect(result.simpleTag).toBe('IMG');
    expect(result.legacy.cssWidth).toBe('500%');
    expect(result.legacy.cssHeight).toBe('500%');
    expect(result.legacy.transform).toBe('translate(-80%, -80%)');
    expect(result.animation.cssWidth).toBe('500%');
    expect(result.animation.transform).toBe('translate(-20%, -20%)');
    expect(result.restored.mode).toBe('puzzle');
    expect(result.restored.imgX).toBe(result.arbitrary.imgX);
    expect(result.restored.imgY).toBe(result.arbitrary.imgY);
});

test('resetPool ist als Methode erreichbar und setzt nur den ausgewaehlten Pool zurueck', async ({ page }) => {
    await generate(page);
    const result = await page.evaluate(async () => {
        const editor = (window as any).editor;
        const runtime = editor.runtime;
        const template = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate');
        // @ts-expect-error – Vite-Runtime-Import, nur im Browser auflösbar
        const { TSpriteTemplate } = await import('/src/components/TSpriteTemplate.ts');
        const other = new TSpriteTemplate('OtherTemplate', 0, 0, 1, 1);
        other.poolSize = 1;
        runtime.objects.push(other);
        runtime.spritePool.init(other, runtime.objects);
        const otherSprite = runtime.spritePool.acquire(other.id, 1, 1, other);
        // @ts-expect-error – Vite-Runtime-Import, nur im Browser auflösbar
        const { GameLoopManager } = await import('/src/runtime/GameLoopManager.ts');
        const loop = GameLoopManager.getInstance();
        const stateBefore = loop.getState();
        // @ts-expect-error – Vite-Runtime-Import, nur im Browser auflösbar
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
                sheetWidths: [...document.querySelectorAll('#run-stage [data-id*="_pool_"] .puzzle-piece-layer')].map(el => el.getBoundingClientRect().width)
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
    const pxCell = box.width / await page.evaluate(() =>
        (window as any).editor.runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0').width);
    // Auch nach dem Rundlauf bleibt das Teil ziehbar; ins Leere gezogen kehrt
    // es wie vorgesehen zum Startplatz zurueck (TeilAblegen-Flow).
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 2 * pxCell, box.y + box.height / 2 + 2 * pxCell, { steps: 8 });
    await page.mouse.up();
    const home = await waitForReturnToSpawn(page);
    expect(home.x).toBeCloseTo(home.spawnX, 1);
    expect(home.y).toBeCloseTo(home.spawnY, 1);
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
    const setup = await page.evaluate(async () => {
        const runtime = (window as any).editor.runtime;
        const board = runtime.objects.find((o: any) => o.name === 'Zielplattform');
        const sprite = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0');
        const records = runtime.objects.find((o: any) => o.name === 'PuzzleTeile').records;
        const record = records.find((r: any) => r.index === sprite.imageIndex);
        const col = record.column, row = record.row;
        // Zielgeometrie wie im Produkt: das Zielbild wird mit fitImageBounds in
        // die Boardflaeche eingepasst; die Zellen liegen im eingepassten Bounds.
        const boardEl = document.querySelector('#run-stage [data-id="pn_zielplattform"]') as HTMLElement;
        const bb = boardEl.getBoundingClientRect();
        const pieceEl = document.querySelector(`#run-stage [data-id="${sprite.id}"]`) as HTMLElement;
        const pb = pieceEl.getBoundingClientRect();
        const pxPerCell = pb.width / sprite.width;
        const boardWg = bb.width / pxPerCell, boardHg = bb.height / pxPerCell;
        // @ts-expect-error – Vite-Runtime-Import, nur im Browser auflösbar
        const { fitImageBounds } = await import('/src/utils/ImageSplitterModel.ts');
        const bounds = fitImageBounds(Number(sprite.sourceWidth), Number(sprite.sourceHeight), boardWg, boardHg);
        const cellW = bounds.width / board.columns, cellH = bounds.height / board.rows;
        const targetX = board.x + bounds.x + col * cellW, targetY = board.y + bounds.y + row * cellH;
        const pieceCenter = { x: pb.left + pb.width / 2, y: pb.top + pb.height / 2 };
        // Loslassen etwas neben dem Zellzentrum (eingepasstes Raster), innerhalb snapRadius
        const dropCenter = { x: bb.left + (bounds.x + (col + 0.5) * cellW) * pxPerCell + 1,
            y: bb.top + (bounds.y + (row + 0.5) * cellH) * pxPerCell + 1 };
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
    expect(result.x).toBeCloseTo(setup.targetX, 1);
    expect(result.y).toBeCloseTo(setup.targetY, 1);
    expect(result.draggable).toBe(false);
    expect(result.placedCount).toBe(1);
});

test('Teil ausserhalb des Snap-Radius wird nicht eingerastet und kehrt zum Startplatz zurueck', async ({ page }) => {
    await generate(page);
    const setup = await page.evaluate(() => {
        const runtime = (window as any).editor.runtime;
        const stage = (window as any).editor.runManager.runStage;
        const board = runtime.objects.find((o: any) => o.name === 'Zielplattform');
        const sprite = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0');
        // Drop auf die Plattform, aber weit weg von der eigenen Zielzelle —
        // mit eingepasstem Zielbild (fitImageBounds) liegt die gegenueberliegende
        // Ecke ~20 Zellen vom Zielzentrum entfernt, deutlich ausserhalb snapRadius=4.
        const boardEl = document.querySelector('#run-stage [data-id="pn_zielplattform"]') as HTMLElement;
        const bb = boardEl.getBoundingClientRect();
        const pieceEl = document.querySelector(`#run-stage [data-id="${sprite.id}"]`) as HTMLElement;
        const pb = pieceEl.getBoundingClientRect();
        const pieceCenter = { x: pb.left + pb.width / 2, y: pb.top + pb.height / 2 };
        const records = runtime.objects.find((o: any) => o.name === 'PuzzleTeile').records;
        const record = records.find((r: any) => r.index === sprite.imageIndex);
        const farCol = record.column === 0 ? board.columns - 1 : 0;
        const farRow = record.row === 0 ? board.rows - 1 : 0;
        const cellWpx = bb.width / board.columns, cellHpx = bb.height / board.rows;
        const dropCenter = { x: bb.left + (farCol + 0.5) * cellWpx, y: bb.top + (farRow + 0.5) * cellHpx };
        return { pieceCenter, dropCenter, spawnX: sprite.spawnX, spawnY: sprite.spawnY };
    });

    await page.mouse.move(setup.pieceCenter.x, setup.pieceCenter.y);
    await page.mouse.down();
    await page.mouse.move(setup.dropCenter.x, setup.dropCenter.y, { steps: 12 });
    await page.mouse.up();

    // Nicht eingerastet: Zaehler bleibt 0. Der TeilAblegen-Flow bewegt das Teil
    // anschliessend mit move_to + lockDuringMove zum Startplatz zurueck.
    const result = await page.evaluate(() => {
        const runtime = (window as any).editor.runtime;
        const board = runtime.objects.find((o: any) => o.name === 'Zielplattform');
        const sprite = runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0');
        return { placedCount: board.placedCount, spawnX: sprite.spawnX, spawnY: sprite.spawnY };
    });
    expect(result.placedCount).toBe(0);

    // Nach der Rueckflug-Animation (~500ms) ist das Teil wieder ziehbar und am Startplatz.
    await expect.poll(() => page.evaluate(() =>
        (window as any).editor.runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0').draggable
    ), { timeout: 4000 }).toBe(true);
    const home = await page.evaluate(() => {
        const s = (window as any).editor.runtime.objects.find((o: any) => o.name === 'PuzzleTeilTemplate_pool_0');
        return { x: s.x, y: s.y };
    });
    expect(home.x).toBeCloseTo(result.spawnX, 1);
    expect(home.y).toBeCloseTo(result.spawnY, 1);
});
