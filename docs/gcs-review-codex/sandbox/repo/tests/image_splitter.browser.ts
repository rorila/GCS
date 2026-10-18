import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const baseURL = process.env.GCS_TEST_URL || 'http://localhost:5173';
const project = JSON.parse(readFileSync(new URL('../public/test-projects/PuzzleNeu.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage();
    await page.addInitScript('globalThis.__name = (fn) => fn;');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/__image_splitter_test__', route => route.fulfill({
        contentType: 'text/html', body: '<html><body><div id="stage" style="position:relative;width:900px;height:600px"></div><div id="inspector"></div></body></html>'
    }));
    await page.goto(`${baseURL}/__image_splitter_test__`);
    await page.evaluate(async project => {
        const paths = [
            '/src/utils/Serialization.ts', '/src/editor/services/renderers/StageObjectRenderer.ts',
            '/src/services/ProjectStore.ts', '/src/editor/inspector/InspectorHost.ts', '/src/runtime/ReactiveRuntime.ts'
        ];
        const [serialization, renderer, store, inspector, runtime] = await Promise.all(paths.map(path => import(path)));
        const main = project.stages.find((s: any) => s.id === 'stage_main');
        project.activeStageId = 'stage_main';
        main.objects = serialization.hydrateObjects(main.objects);
        Object.assign(main.objects.find((o: any) => o.className === 'TImageSplitter'), {
            rows: 5, columns: 5, previewGap: 0, imageSource: './images/puzzle-neu.svg', showLines: true
        });
        main.objects.find((o: any) => o.className === 'TObjectList').replaceRecords([]);
        store.projectStore.setProject(project);
        const splitter = main.objects.find((o: any) => o.className === 'TImageSplitter');
        const list = main.objects.find((o: any) => o.className === 'TObjectList');
        const el = document.getElementById('stage')!;
        const render = new renderer.StageObjectRenderer({
            host: { runMode: false, grid: main.grid, selectedIds: new Set() }, objects: main.objects,
            getVariableContext: () => ({}), scaleFontSize: (v: any) => String(v), updateSelectionState() {}
        });
        const draw = () => render.renderComponentContent(el, splitter, 'TImageSplitter', false);
        const oldProject = { ...project, meta: { name: 'Vorheriges Projekt' }, stages: [], activeStageId: 'old' };
        const host = new inspector.InspectorHost(new runtime.ReactiveRuntime(), oldProject);
        host.setProject(project);
        host.setContainer(document.getElementById('inspector'));
        host.onObjectUpdate = () => draw();
        store.projectStore.onChange(() => draw());
        (window as any).splitterTest = { project, splitter, list, draw, host, store: store.projectStore };
        draw();
        await host.update(splitter);
    }, project);
    await page.waitForFunction(() => document.querySelectorAll('[data-piece-index]').length === 25);
    assert.equal(await page.locator('[data-piece-index] image').count(), 25);
    await page.getByRole('button', { name: 'Teile erzeugen', exact: true }).click();
    await page.waitForFunction(() => (window as any).splitterTest.list.records.length === 25, undefined, { timeout: 5000 });
    assert.equal(await page.evaluate(() => (window as any).splitterTest.list.records[24].matchValue), 'r4_c4');
    await page.evaluate(() => (window as any).splitterTest.list.replaceRecords([]));
    await page.locator('input[name="rowsInput"]').fill('4');
    await page.locator('input[name="rowsInput"]').press('Tab');
    await page.locator('input[name="columnsInput"]').fill('6');
    await page.locator('input[name="columnsInput"]').press('Tab');
    await page.waitForFunction(() => document.querySelectorAll('[data-piece-index]').length === 24);
    assert.equal(await page.evaluate(() => (window as any).splitterTest.list.records.length), 0);
    await page.locator('input[name="previewGapInput"]').fill('12');
    await page.locator('input[name="previewGapInput"]').press('Tab');
    await page.waitForFunction(() => document.querySelector('.image-splitter-preview > svg')?.getAttribute('viewBox') === '0 0 960 636');
    const bounds = await page.locator('[data-piece-index="0"] image').boundingBox();
    assert.ok(bounds && Math.abs(bounds.width / bounds.height - 1.5) < 0.001);
    await page.getByRole('button', { name: 'Teile erzeugen', exact: true }).click();
    await page.waitForFunction(() => (window as any).splitterTest.list.records.length === 24);
    const records = await page.evaluate(() => (window as any).splitterTest.list.records);
    assert.equal(records[0].width, 150);
    assert.equal(records[0].height, 150);
    assert.equal(records[23].matchValue, 'r3_c5');
    await page.evaluate(() => {
        const t = (window as any).splitterTest;
        t.splitter.showLines = false;
        t.draw();
    });
    await page.waitForFunction(() => document.querySelectorAll('[data-piece-index] rect').length === 0);
    await page.locator('input[name="imageSourceInput"]').fill('');
    await page.locator('input[name="imageSourceInput"]').press('Tab');
    await page.waitForFunction(() => document.querySelector('.image-splitter-preview')?.textContent?.includes('Bilddatei auswählen'));
    assert.equal(await page.locator('[data-piece-index]').count(), 0);
    assert.equal(await page.evaluate(() => (window as any).splitterTest.list.records.length), 24);
    await page.locator('input[name="imageSourceInput"]').fill('./images/puzzle-neu.svg');
    await page.locator('input[name="imageSourceInput"]').press('Tab');
    await page.waitForFunction(() => document.querySelectorAll('[data-piece-index]').length === 24);
    assert.deepEqual(errors, []);
    console.log('Browser-Pruefung bestanden: Projektwechsel, 5x5-Erzeugung, echter Renderer, Inspector-Eingaben, Live-Raster, Abstand, Seitenverhaeltnis, Ausgabebutton und leere Bildquelle.');
} finally {
    await browser.close();
}
