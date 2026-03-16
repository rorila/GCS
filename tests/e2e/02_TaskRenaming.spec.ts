import { test, expect } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

test.describe('UseCase: Ein Task umbenennen', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: Task erzeugen, umbenennen und Action hinzufügen', async ({ page }) => {
        // Starte den Editor im E2E-Modus
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung (MyCoolGame.json laden)
        console.log('Test: 1. Vorbereitung (MyCoolGame.json laden)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // 2. Flow-Tab klicken (User klickt auf den Tab)
        console.log('Test: 2. Flow-Tab klicken...');
        await page.locator('.tab-btn[data-view="flow"]').click();
        await page.waitForSelector('#flow-canvas');

        // 3. "+" Button klicken um neuen Task zu erzeugen
        console.log('Test: 3. "+" Button klicken für neuen Task...');
        await page.locator('button[title="New Task Flow"]').click();
        await page.waitForTimeout(500);

        // 4. Task-Node sollte sichtbar sein (mit Default-Name "ANewTask")
        console.log('Test: 4. Task-Node im Canvas prüfen...');
        const taskNode = page.locator('.glass-node-task').first();
        await expect(taskNode).toBeVisible({ timeout: 5000 });

        // 5. Task-Node anklicken → Inspector zeigt Eigenschaften
        console.log('Test: 5. Task-Node anklicken...');
        await taskNode.click();
        await page.waitForTimeout(300);

        // 6. Inspector: Name von "ANewTask" auf "SwitchToTheHighscoreStage" ändern
        console.log('Test: 6. Inspector: Name ändern...');
        const nameInput = page.locator('input[name="NameInput"]');
        await expect(nameInput).toBeVisible({ timeout: 3000 });
        await nameInput.fill('SwitchToTheHighscoreStage');
        await nameInput.press('Tab');
        await page.waitForTimeout(500);

        // 7. Validierung: Task-Node ist immer noch sichtbar und hat neuen Namen
        console.log('Test: 7. Validierung: Task-Node ist sichtbar und hat neuen Namen...');
        const renamedTaskNode = page.locator('.glass-node-task', { hasText: 'SwitchToTheHighscoreStage' });
        await expect(renamedTaskNode).toBeVisible({ timeout: 3000 });

        // 8. Validierung im JSON
        console.log('Test: 8. Validierung: JSON-Daten prüfen...');
        const taskSearch = await page.evaluate(() => {
            const p = (window as any).editor.project;
            const findTask = (name: string): boolean => {
                if (p.tasks?.some((t: any) => t.name === name)) return true;
                for (const s of (p.stages || [])) {
                    if (s.tasks?.some((t: any) => t.name === name)) return true;
                }
                return false;
            };
            return { oldFound: findTask('ANewTask'), newFound: findTask('SwitchToTheHighscoreStage') };
        });

        expect(taskSearch.oldFound).toBe(false);
        expect(taskSearch.newFound).toBe(true);

        // 9. Validierung im Manager View
        console.log('Test: 9. Check Manager Liste auf UI-Ebene...');
        await page.locator('.tab-btn[data-view="management"]').click();
        await page.waitForSelector('.management-sidebar');
        await page.locator('.management-sidebar-btn', { hasText: 'Tasks' }).click();
        await page.waitForTimeout(300);

        const contentText = await page.locator('.management-content').innerText();
        expect(contentText).toContain('SwitchToTheHighscoreStage');
        expect(contentText).not.toContain('ANewTask');

        // 10. Speichern
        console.log('Test: 10. Speichern...');
        await saveMyCoolGame(page);
        console.log('Test: Flow erfolgreich abgeschlossen. MyCoolGame.json aktualisiert.');
    });
});
