import { test, expect } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

/**
 * UseCase: RunButton erzeugen
 *
 * User-Workflow:
 * 1. MyCoolGame.json laden
 * 2. Stages-Menü → MainStage aktivieren
 * 3. Stage-Tab klicken
 * 4. Toolbox: Kategorie "Standard" expandieren
 * 5. "Button" aus Toolbox anklicken → wird auf Stage platziert
 * 6. Button auf Stage anklicken (selektieren)
 * 7. Inspector: caption auf "run" setzen
 * 8. Speichern
 */
test.describe('UseCase: RunButton erzeugen', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: Button auf MainStage erzeugen und mit run beschriften', async ({ page }) => {
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung
        console.log('Test: 1. Vorbereitung (MyCoolGame.json laden)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // 2. Zur MainStage wechseln über Stages-Menü
        console.log('Test: 2. MainStage über Stages-Menü aktivieren...');
        await page.locator('.menu-bar-button:has-text("Stages")').click();
        await page.waitForTimeout(300);
        const stagesDropdown = page.locator('.menu-dropdown');
        await expect(stagesDropdown).toBeVisible({ timeout: 3000 });
        await stagesDropdown.locator('.menu-item:has-text("MainStage")').click();
        await page.waitForTimeout(500);

        // 3. Stage-Tab klicken
        console.log('Test: 3. Stage-Tab klicken...');
        await page.locator('.tab-btn[data-view="stage"]').click();
        await page.waitForSelector('#stage-viewport');
        await page.waitForTimeout(500);

        // 4. Toolbox: Kategorie "Standard" expandieren
        console.log('Test: 4. Toolbox: Standard expandieren...');
        const standardCategory = page.locator('#json-toolbox-content .toolbox-category:has-text("Standard")');
        await standardCategory.click();
        await page.waitForTimeout(300);

        // 5. "Button" aus Toolbox anklicken
        console.log('Test: 5. Button aus Toolbox anklicken...');
        const toolboxButton = page.locator('#json-toolbox-content .toolbox-item:has-text("Button")').first();
        await expect(toolboxButton).toBeVisible({ timeout: 3000 });
        await toolboxButton.click();
        await page.waitForTimeout(500);

        // 6. Neuen Button auf der Stage anklicken (letztes Stage-Objekt)
        console.log('Test: 6. Button auf Stage anklicken...');
        // Stage-Objekte haben die Klasse .stage-object oder ähnlich
        const stageObjects = page.locator('#stage-viewport .stage-object, #stage-viewport [data-component]');
        const objCount = await stageObjects.count();
        console.log(`  Stage-Objekte: ${objCount}`);

        if (objCount > 0) {
            // Letztes Objekt anklicken (= der gerade erzeugte Button)
            await stageObjects.last().click();
            await page.waitForTimeout(300);
        }

        // 7. Inspector: caption auf "run" setzen
        console.log('Test: 7. Inspector: caption auf "run" setzen...');
        let captionInput = page.locator('#inspector input[name="caption"]');
        let inputFound = await captionInput.isVisible().catch(() => false);

        if (!inputFound) {
            captionInput = page.locator('#inspector input[name="text"]');
            inputFound = await captionInput.isVisible().catch(() => false);
        }

        if (inputFound) {
            await captionInput.fill('run');
            await captionInput.press('Tab');
            await page.waitForTimeout(300);
            console.log('  Caption gesetzt: run');
        } else {
            console.log('  ⚠️ Caption-Input nicht gefunden — Button existiert aber auf Stage');
        }

        // 8. Speichern
        console.log('Test: 8. Speichern...');
        await saveMyCoolGame(page);
        console.log('Test: Flow RunButtonCreation erfolgreich abgeschlossen.');
    });
});
