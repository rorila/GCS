import { test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const project = JSON.parse(readFileSync(new URL('../../game-server/public/projects/PuzzleNeu.json', import.meta.url), 'utf8'));

test('DEBUG: chicken generation from variable', async ({ page }) => {
    // Force chicken imageSource on splitter for this test
    project.stages.find((s: any) => s.id === 'stage_main').objects
        .find((o: any) => o.name === 'Bildaufteiler').imageSource = './images/memory Tierbilder für kleine Kinder/cartoon-chicken-7356485_640.png';

    await page.setViewportSize({ width: 1779, height: 893 });
    await page.goto('/');
    await page.waitForFunction(() => !!(window as any).editor);
    await page.evaluate(async data => {
        const editor = (window as any).editor;
        editor.loadProject(data);
        await new Promise(r => setTimeout(r, 500));
        editor.hideManagedObjectsOnStage = true;
        await editor.switchView('flow');
        editor.flowEditor.switchActionFlow('GeneratePuzzleSprites');
        editor.flowEditor.syncToProject();
        await editor.switchView('run');
    }, structuredClone(project));
    await page.locator('#run-start-game-btn').click();
    await page.waitForTimeout(1500);
    await page.locator('#run-stage [data-id="pn_btn_puzzle_sprites_erzeugen"]').click();
    await page.waitForFunction(() => (window as any).editor.runtime.spritePool.getActiveInstances().length >= 9);
    await page.waitForTimeout(500);

    const info = await page.evaluate(() => {
        const rt = (window as any).editor.runtime;
        const list = rt.objects.find((o: any) => o.name === 'PuzzleTeile');
        const splitter = rt.objects.find((o: any) => o.name === 'Bildaufteiler');
        const pieces = rt.objects.filter((o: any) => o.isPoolInstance).sort((a: any, b: any) => a.imageIndex - b.imageIndex);
        return {
            splitterImageSource: splitter.imageSource,
            records: list.records.map((r: any) => ({ match: r.matchValue, src: r.source, sw: r.sourceWidth, sh: r.sourceHeight, x: r.x, y: r.y, w: r.width, h: r.height })),
            pieces: pieces.map((p: any) => ({ name: p.name, match: p.matchValue, bg: p.backgroundImage, mode: p.appearanceMode, sx: p.sourceRectX, sy: p.sourceRectY, sw: p.sourceRectWidth, sh: p.sourceRectHeight, srcW: p.sourceWidth, srcH: p.sourceHeight }))
        };
    });
    console.log('SPLITTER', info.splitterImageSource);
    console.log('RECORDS', JSON.stringify(info.records, null, 1));
    console.log('PIECES', JSON.stringify(info.pieces, null, 1));
});
