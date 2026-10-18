import { test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const project = JSON.parse(readFileSync(new URL('../../public/test-projects/PuzzleNeu.json', import.meta.url), 'utf8'));

test('DEBUG: chicken run view screenshot', async ({ page }) => {
    // Use the current imageSource from the project (simulating user's state)
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
    await page.screenshot({ path: 'C:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v2/tests/e2e/_debug_chicken_run.png' });
});
