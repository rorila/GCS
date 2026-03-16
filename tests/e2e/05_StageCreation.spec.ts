import { test, expect } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

test.describe('UseCase: Eine neue Stage erzeugen', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: Neue Stage über Menü erzeugen', async ({ page }) => {
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung (MyCoolGame.json laden)
        console.log('Test: 1. Vorbereitung (MyCoolGame.json laden)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // 2. Neue Stage erzeugen über Menü: Stages → Neue Stage
        console.log('Test: 2. Menü: Stages → Neue Stage...');
        await page.locator('.menu-bar-button:has-text("Stages")').click();
        await page.waitForTimeout(300);

        const dropdown = page.locator('.menu-dropdown');
        await expect(dropdown).toBeVisible({ timeout: 3000 });

        await dropdown.locator('.menu-item:has-text("Neue Stage")').click();
        await page.waitForTimeout(500);

        // 3. Validierung: Stages-Menü erneut öffnen und prüfen ob neue Stage vorhanden
        console.log('Test: 3. Validierung: Stages-Menü prüfen...');
        await page.locator('.menu-bar-button:has-text("Stages")').click();
        await page.waitForTimeout(300);

        const dropdownAfter = page.locator('.menu-dropdown');
        await expect(dropdownAfter).toBeVisible({ timeout: 3000 });

        const menuItems = await dropdownAfter.locator('.menu-item').allInnerTexts();
        console.log(`  Stages-Menü: ${JSON.stringify(menuItems)}`);

        // "Stage 1" (oder ähnlich) muss im Menü sichtbar sein
        const hasNewStage = menuItems.some(item =>
            item !== 'Neue Stage' && item !== 'Blueprint (Global)' && item !== 'MainStage'
        );
        expect(hasNewStage).toBe(true);

        // Menü schließen durch Klick auf body
        await page.locator('body').click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(200);

        // 4. Speichern
        console.log('Test: 4. Speichern...');
        await saveMyCoolGame(page);
        console.log('Test: Flow StageCreation erfolgreich abgeschlossen.');
    });
});
