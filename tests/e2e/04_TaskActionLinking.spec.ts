import { test, expect } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

test.describe('UseCase: Task mit Action verbinden', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: Task→Action Verbindung per Anchor-Drag herstellen', async ({ page }) => {
        // Starte den Editor im E2E-Modus
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung (MyCoolGame.json laden — enthält Task + Action aus Test 02/03)
        console.log('Test: 1. Vorbereitung (MyCoolGame.json laden)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // 2. Flow-Tab klicken
        console.log('Test: 2. Flow-Tab klicken...');
        await page.locator('.tab-btn[data-view="flow"]').click();
        await page.waitForSelector('#flow-canvas');

        // 3. Im Flow-Dropdown "SwitchToTheHighscoreStage" auswählen
        console.log('Test: 3. Flow-Dropdown: SwitchToTheHighscoreStage auswählen...');
        const flowDropdown = page.locator('#flow-viewer select').first();
        await flowDropdown.selectOption('SwitchToTheHighscoreStage');
        await page.waitForTimeout(500);

        // 4. Task-Node und Action-Node sichtbar prüfen
        console.log('Test: 4. Nodes im Canvas prüfen...');
        const taskNode = page.locator('.glass-node-task').first();
        const actionNode = page.locator('.glass-node-action').first();
        await expect(taskNode).toBeVisible({ timeout: 5000 });
        await expect(actionNode).toBeVisible({ timeout: 5000 });

        // 5. Verbindung herstellen: Drag vom Bottom-Anchor des Tasks zum Top-Anchor der Action
        console.log('Test: 5. Verbindung herstellen: Task → Action...');
        const taskBottomAnchor = taskNode.locator('.flow-anchor.bottom');
        const actionTopAnchor = actionNode.locator('.flow-anchor.top');

        await expect(taskBottomAnchor).toBeAttached({ timeout: 3000 });
        await expect(actionTopAnchor).toBeAttached({ timeout: 3000 });

        // Drag vom Task-Bottom-Anchor zum Action-Top-Anchor
        await taskBottomAnchor.dragTo(actionTopAnchor, { force: true });
        await page.waitForTimeout(500);

        // 6. Sync zum Projekt
        console.log('Test: 6. Sync zum Projekt...');
        await page.evaluate(() => {
            (window as any).editor.flowEditor.syncToProject();
        });
        await page.waitForTimeout(300);

        // 7. Validierung: actionSequence enthält die Action
        console.log('Test: 7. Validierung: actionSequence prüfen...');
        const result = await page.evaluate(() => {
            const project = (window as any).editor.project;
            const findTask = (name: string): any => {
                // Suche in allen Stages
                for (const s of (project.stages || [])) {
                    const t = s.tasks?.find((t: any) => t.name === name);
                    if (t) return t;
                }
                // Suche im Root
                return project.tasks?.find((t: any) => t.name === name);
            };
            const task = findTask('SwitchToTheHighscoreStage');
            return {
                taskFound: !!task,
                actionSequence: task?.actionSequence || [],
                hasShowAction: task?.actionSequence?.some((a: any) =>
                    a.name === 'ShowTheHighscoreStage'
                ) || false
            };
        });

        expect(result.taskFound).toBe(true);
        expect(result.hasShowAction).toBe(true);
        console.log('  actionSequence:', JSON.stringify(result.actionSequence));

        // 8. Validierung: Connection im DOM vorhanden
        console.log('Test: 8. Validierung: Connection-Linie sichtbar...');
        const connections = page.locator('#flow-canvas svg, #flow-canvas .flow-connection');
        const connCount = await connections.count();
        console.log(`  ${connCount} Connection-Element(e) gefunden.`);
        expect(connCount).toBeGreaterThan(0);

        // 9. Speichern
        console.log('Test: 9. Speichern...');
        await saveMyCoolGame(page);
        console.log('Test: Flow TaskActionLinking erfolgreich abgeschlossen.');
    });
});
