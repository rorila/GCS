import { test, expect } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

test.describe('UseCase: Eine Action umbenennen', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: Action erzeugen und via Inspector umbenennen', async ({ page }) => {
        // Starte den Editor im E2E-Modus
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung (MyCoolGame.json laden — enthält Task aus Test 02)
        console.log('Test: 1. Vorbereitung (MyCoolGame.json laden)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // 2. Flow-Tab klicken
        console.log('Test: 2. Flow-Tab klicken...');
        await page.locator('.tab-btn[data-view="flow"]').click();
        await page.waitForSelector('#flow-canvas');

        // 3. Im Flow-Dropdown den Task "SwitchToTheHighscoreStage" auswählen
        console.log('Test: 3. Flow-Dropdown: SwitchToTheHighscoreStage auswählen...');
        const flowDropdown = page.locator('#flow-viewer select').first();
        await flowDropdown.selectOption('SwitchToTheHighscoreStage');
        await page.waitForTimeout(500);

        // 4. Action per Toolbox-Klick erzeugen
        console.log('Test: 4. Action per Toolbox-Klick erzeugen...');
        const actionToolboxItem = page.locator('.toolbox-item[data-type="action"]');
        await expect(actionToolboxItem).toBeVisible({ timeout: 3000 });
        await actionToolboxItem.click();
        await page.waitForTimeout(500);

        // 5. Action-Node sollte sichtbar sein
        console.log('Test: 5. Action-Node im Canvas prüfen...');
        const actionNode = page.locator('.glass-node-action').first();
        await expect(actionNode).toBeVisible({ timeout: 5000 });

        // 6. Action-Node anklicken → Inspector zeigt Eigenschaften
        console.log('Test: 6. Action-Node anklicken...');
        await actionNode.click();
        await page.waitForTimeout(300);

        // 7. Inspector: Name ändern auf "ShowTheHighscoreStage"
        console.log('Test: 7. Inspector: Name ändern auf ShowTheHighscoreStage...');
        const nameInput = page.locator('input[name="NameInput"]');
        await expect(nameInput).toBeVisible({ timeout: 3000 });
        await nameInput.fill('ShowTheHighscoreStage');
        await nameInput.press('Tab');
        await page.waitForTimeout(500);

        // 8. Validierung: Action-Node ist immer noch sichtbar und hat neuen Namen
        console.log('Test: 8. Validierung: Action-Node sichtbar mit neuem Namen...');
        const renamedActionNode = page.locator('.glass-node-action', { hasText: 'ShowTheHighscoreStage' });
        await expect(renamedActionNode).toBeVisible({ timeout: 3000 });

        // 9. Validierung: Task-Name ist NICHT verändert worden
        console.log('Test: 9. Validierung: Task-Name unverändert...');
        const taskNode = page.locator('.glass-node-task', { hasText: 'SwitchToTheHighscoreStage' });
        await expect(taskNode).toBeVisible({ timeout: 3000 });

        // 10. Validierung im JSON
        console.log('Test: 10. Validierung: JSON-Daten prüfen...');
        await page.evaluate(() => {
            (window as any).editor.flowEditor.syncToProject();
        });
        await page.waitForTimeout(300);

        const result = await page.evaluate(() => {
            const p = (window as any).editor.project;
            const findAction = (name: string): boolean => {
                if (p.actions?.some((a: any) => a.name === name)) return true;
                for (const s of (p.stages || [])) {
                    if (s.actions?.some((a: any) => a.name === name)) return true;
                }
                return false;
            };
            const findTask = (name: string): boolean => {
                if (p.tasks?.some((t: any) => t.name === name)) return true;
                for (const s of (p.stages || [])) {
                    if (s.tasks?.some((t: any) => t.name === name)) return true;
                }
                return false;
            };
            return {
                newActionFound: findAction('ShowTheHighscoreStage'),
                taskStillExists: findTask('SwitchToTheHighscoreStage')
            };
        });

        expect(result.newActionFound).toBe(true);
        expect(result.taskStillExists).toBe(true);

        // 11. Validierung im Manager View
        console.log('Test: 11. Check Manager Liste auf UI-Ebene...');
        await page.locator('.tab-btn[data-view="management"]').click();
        await page.waitForSelector('.management-sidebar');
        await page.locator('.management-sidebar-btn', { hasText: '🎬 Aktionen' }).click();
        await page.waitForTimeout(300);

        const contentText = await page.locator('.management-content').innerText();
        expect(contentText).toContain('ShowTheHighscoreStage');

        // 12. Speichern
        console.log('Test: 12. Speichern nach Action-Umbenennung...');
        await saveMyCoolGame(page);
        console.log('Test: Flow ActionRenaming erfolgreich abgeschlossen. MyCoolGame.json aktualisiert.');
    });
});
