import { test, expect } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

/**
 * UseCase: Sync Roundtrip
 *
 * Prüft den Datenfluss: Inspector → Flow → Manager → Save → Reload
 * Alles per echter UI-Interaktion.
 */
test.describe('Sync Roundtrip: Inspector → Flow → Manager → Reload', () => {
    test.describe.configure({ mode: 'serial' });

    test('Roundtrip: Werte bleiben nach Speichern und Laden konsistent', async ({ page }) => {
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. MyCoolGame laden
        console.log('RT: 1. MyCoolGame laden...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // 2. Zur MainStage wechseln (Action steht unter MainStage)
        console.log('RT: 2. MainStage aktivieren...');
        await page.locator('.menu-bar-button:has-text("Stages")').click();
        await page.waitForTimeout(300);
        await page.locator('.menu-dropdown .menu-item:has-text("MainStage")').click();
        await page.waitForTimeout(500);

        // 3. Flow-Tab klicken
        console.log('RT: 3. Flow-Tab klicken...');
        await page.locator('.tab-btn[data-view="flow"]').click();
        await page.waitForSelector('#flow-canvas');

        // 4. Flow-Dropdown: SwitchToTheHighscoreStage
        console.log('RT: 4. Flow-Dropdown: SwitchToTheHighscoreStage...');
        const flowDropdown = page.locator('#flow-viewer select').first();
        const allOptions = await flowDropdown.locator('option').allTextContents();
        console.log(`  Dropdown-Optionen: ${JSON.stringify(allOptions)}`);
        await flowDropdown.selectOption('SwitchToTheHighscoreStage');
        await page.waitForTimeout(500);

        // 5. Action-Node anklicken
        console.log('RT: 5. Action-Node anklicken...');
        const actionNode = page.locator('.glass-node-action', { hasText: 'ShowTheHighscoreStage_Unique' });
        await expect(actionNode).toBeVisible({ timeout: 5000 });
        await actionNode.click();
        await page.waitForTimeout(300);

        // 6. Inspector: ActionType prüfen (sollte 'navigate_stage' sein von Test 06)
        console.log('RT: 6. Inspector: ActionType prüfen...');
        const typeSelect = page.locator('select[name="ActionTypeSelect"]');
        await expect(typeSelect).toBeVisible({ timeout: 5000 });
        const currentType = await typeSelect.inputValue();
        console.log(`  Aktueller ActionType: ${currentType}`);
        expect(currentType).toBe('navigate_stage');

        // 7. Manager-Tab: Action prüfen
        console.log('RT: 7. Manager-Tab: Action prüfen...');
        await page.locator('.tab-btn[data-view="management"]').click();
        await page.waitForSelector('.management-sidebar');
        await page.locator('.management-sidebar-btn', { hasText: '🎬 Aktionen' }).click();
        await page.waitForTimeout(300);

        const contentText = await page.locator('.management-content').innerText();
        expect(contentText).toContain('ShowTheHighscoreStage_Unique');
        console.log('  Manager zeigt ShowTheHighscoreStage_Unique ✅');

        // 8. Speichern
        console.log('RT: 8. Speichern...');
        await saveMyCoolGame(page);

        // === ROUNDTRIP: Projekt erneut laden und prüfen ===
        console.log('RT: 9. Projekt erneut laden...');
        await loadMyCoolGame(page);

        // 10. MainStage erneut aktivieren
        console.log('RT: 10. MainStage erneut aktivieren...');
        await page.locator('.menu-bar-button:has-text("Stages")').click();
        await page.waitForTimeout(300);
        await page.locator('.menu-dropdown .menu-item:has-text("MainStage")').click();
        await page.waitForTimeout(500);

        // 11. Flow-Tab → Dropdown → Action prüfen
        console.log('RT: 11. Nach Reload: Flow prüfen...');
        await page.locator('.tab-btn[data-view="flow"]').click();
        await page.waitForSelector('#flow-canvas');
        await flowDropdown.selectOption('SwitchToTheHighscoreStage');
        await page.waitForTimeout(500);

        const actionNodeReloaded = page.locator('.glass-node-action', { hasText: 'ShowTheHighscoreStage_Unique' });
        await expect(actionNodeReloaded).toBeVisible({ timeout: 5000 });
        console.log('  Action-Node nach Reload sichtbar ✅');

        // 12. Inspector: ActionType nach Reload noch navigate_stage?
        await actionNodeReloaded.click();
        await page.waitForTimeout(300);
        const typeAfterReload = page.locator('select[name="ActionTypeSelect"]');
        await expect(typeAfterReload).toBeVisible({ timeout: 5000 });
        const typeValue = await typeAfterReload.inputValue();
        console.log(`  ActionType nach Reload: ${typeValue}`);
        expect(typeValue).toBe('navigate_stage');

        console.log('RT: ✅ Sync Roundtrip komplett bestanden!');
    });
});
