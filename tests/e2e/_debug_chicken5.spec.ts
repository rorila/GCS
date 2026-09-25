import { test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const project = JSON.parse(readFileSync(new URL('../../public/test-projects/PuzzleNeu.json', import.meta.url), 'utf8'));

test('DEBUG: chicken DOM styles', async ({ page }) => {
    const main = project.stages.find((s: any) => s.id === 'stage_main');
    main.objects.find((o: any) => o.name === 'Bildaufteiler').imageSource = './images/memory Tierbilder für kleine Kinder/cartoon-chicken-7356485_640.png';
    main.objects.find((o: any) => o.name === 'Zielplattform').imageSource = './images/memory Tierbilder für kleine Kinder/cartoon-chicken-7356485_640.png';

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
    await page.waitForTimeout(800);

    const first = await page.locator('#run-stage [data-id*="_pool_0"]').first();
    const styles = await first.evaluate(el => {
        const mask = el.querySelector('.sprite-image-layer') as HTMLElement;
        const sheet = mask?.querySelector('.sprite-sheet-layer') as HTMLElement;
        const computed = (e: any) => e ? { width: e.style.width, height: e.style.height, left: e.style.left, top: e.style.top, transform: e.style.transform, bgSize: e.style.backgroundSize, bgPos: e.style.backgroundPosition, offsetWidth: e.offsetWidth, offsetHeight: e.offsetHeight } : null;
        return { mask: computed(mask), sheet: computed(sheet) };
    });
    console.log('STYLE', JSON.stringify(styles, null, 2));
});
