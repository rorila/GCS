import { test, expect } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

/**
 * UseCase: Action-Typ ändern
 *
 * User-Workflow:
 * 1. MyCoolGame.json laden
 * 2. Zur richtigen Stage wechseln (Stages-Menü → MainStage)
 * 3. Tab: Flow klicken
 * 4. Flow-Dropdown: SwitchToTheHighscoreStage auswählen
 * 5. Action-Node anklicken
 * 6. Inspector: Action-Typ auf "navigate_stage" ändern
 * 7. Speichern
 */
test.describe('UseCase: Action-Typ ändern', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: Action-Typ auf navigate_stage ändern', async ({ page }) => {
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung
        console.log('Test: 1. Vorbereitung (MyCoolGame.json laden)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // 2. Sicherstellen dass MainStage aktiv ist (nach Test 05 könnte "Stage 1" aktiv sein)
        console.log('Test: 2. Zur MainStage wechseln...');
        await page.locator('.menu-bar-button:has-text("Stages")').click();
        await page.waitForTimeout(300);
        const stagesDropdown = page.locator('.menu-dropdown');
        await expect(stagesDropdown).toBeVisible({ timeout: 3000 });

        const mainStageItem = stagesDropdown.locator('.menu-item:has-text("MainStage")');
        await expect(mainStageItem).toBeVisible({ timeout: 3000 });
        await mainStageItem.click();
        await page.waitForTimeout(500);

        // 3. Flow-Tab klicken
        console.log('Test: 3. Flow-Tab klicken...');
        await page.locator('.tab-btn[data-view="flow"]').click();
        await page.waitForSelector('#flow-canvas');

        // 4. Flow-Dropdown: SwitchToTheHighscoreStage auswählen
        console.log('Test: 4. Flow-Dropdown: SwitchToTheHighscoreStage...');
        const flowDropdown = page.locator('#flow-viewer select').first();
        // Verfügbare Optionen loggen
        const allOptions = await flowDropdown.locator('option').allTextContents();
        console.log(`  Dropdown-Optionen: ${JSON.stringify(allOptions)}`);

        await flowDropdown.selectOption('SwitchToTheHighscoreStage');
        await page.waitForTimeout(500);

        // 5. Action-Node "ShowTheHighscoreStage_Unique" anklicken
        console.log('Test: 5. Action-Node anklicken...');
        const actionNode = page.locator('.glass-node-action', { hasText: 'ShowTheHighscoreStage_Unique' }).first();
        await expect(actionNode).toBeVisible({ timeout: 5000 });
        await actionNode.click();
        await page.waitForTimeout(300);

        // 6. Inspector: Action-Typ auf "navigate_stage" ändern
        console.log('Test: 6. ActionType auf navigate_stage ändern...');
        const typeSelect = page.locator('select[name="ActionTypeSelect"]');
        await expect(typeSelect).toBeVisible({ timeout: 5000 });
        await typeSelect.selectOption('navigate_stage');
        await page.waitForTimeout(500);

        // 7. Validierung: Inspector zeigt navigate_stage
        console.log('Test: 7. Validierung: ActionType prüfen...');
        const currentType = await typeSelect.inputValue();
        expect(currentType).toBe('navigate_stage');
        console.log(`  ActionType: ${currentType}`);

        // 8. Speichern
        console.log('Test: 8. Speichern...');
        await saveMyCoolGame(page);
        console.log('Test: Flow ActionTypeChange erfolgreich abgeschlossen.');
    });
});
