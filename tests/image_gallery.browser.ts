import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const baseURL = process.env.GCS_TEST_URL || 'http://localhost:5173';
const project = JSON.parse(readFileSync(new URL('../game-server/public/projects/PuzzleNeu.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage();
    await page.addInitScript('globalThis.__name = (fn) => fn;');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/__image_gallery_test__', route => route.fulfill({
        contentType: 'text/html', body: '<html><body><div id="stage" style="position:relative;width:1144px;height:468px"></div></body></html>'
    }));
    await page.goto(`${baseURL}/__image_gallery_test__`);
    await page.evaluate(async project => {
        const [serialization, renderer] = await Promise.all([
            import('/src/utils/Serialization.ts'),
            import('/src/editor/services/renderers/StageObjectRenderer.ts')
        ]);
        const stage = project.stages.find((s: any) => s.id === 'stage_galerie');
        const objects = serialization.hydrateObjects(stage.objects);
        const gallery = objects.find((o: any) => o.className === 'TImageGallery');
        const fired: any[] = [];
        const el = document.getElementById('stage')!;
        const render = new renderer.StageObjectRenderer({
            host: {
                runMode: true, grid: stage.grid, selectedIds: new Set(),
                onEvent: (id: string, ev: string, data?: any) => fired.push({ id, ev, data })
            },
            objects, getVariableContext: () => ({}), scaleFontSize: (v: any) => String(v), updateSelectionState() {}
        });
        const draw = () => render.renderComponentContent(el, gallery, 'TImageGallery', false);
        (window as any).galleryTest = { gallery, fired, draw };
        draw();
    }, project);

    // 32 Tierbilder aus dem echten Medienmanifest
    await page.waitForFunction(() => document.querySelectorAll('.image-gallery-tile').length === 32, undefined, { timeout: 10000 });
    const firstPath = await page.locator('.image-gallery-tile').first().getAttribute('data-path');
    assert.ok(firstPath?.startsWith('./images/memory Tierbilder für kleine Kinder/'));

    // Klick: Auswahl markieren + Event mit Pfad feuern
    await page.locator('.image-gallery-tile').first().click();
    await page.waitForFunction(() => (window as any).galleryTest.fired.length === 1);
    const event = await page.evaluate(() => (window as any).galleryTest.fired[0]);
    assert.equal(event.ev, 'onSelectionChanged');
    assert.equal(event.data.path, firstPath);
    assert.equal(await page.evaluate(() => (window as any).galleryTest.gallery.selectedImage), firstPath);
    const border = await page.locator('.image-gallery-tile').first().evaluate((el: HTMLElement) => el.style.borderColor);
    assert.equal(border, 'rgb(255, 179, 0)');

    // Zweites Bild waehlen: Markierung wandert
    await page.locator('.image-gallery-tile').nth(5).click();
    await page.waitForFunction(() => (window as any).galleryTest.fired.length === 2);
    assert.equal(await page.locator('.image-gallery-tile').first().evaluate((el: HTMLElement) => el.style.borderColor), 'transparent');
    assert.equal(await page.locator('.image-gallery-tile').nth(5).evaluate((el: HTMLElement) => el.style.borderColor), 'rgb(255, 179, 0)');

    // Unbekannter Ordner: verstaendliche Fehlermeldung statt leerer Flaeche
    await page.evaluate(() => {
        const t = (window as any).galleryTest;
        t.gallery.folder = 'gibt-es-nicht';
        t.draw();
    });
    await page.waitForFunction(() => document.querySelector('.image-gallery')?.textContent?.includes('nicht gefunden'));

    assert.deepEqual(errors, []);
    console.log('Browser-Pruefung bestanden: Manifest-Laden, 32 Kacheln, Klick-Auswahl, Auswahl-Event, Markierung und Ordner-Fehlermeldung.');
} finally {
    await browser.close();
}
