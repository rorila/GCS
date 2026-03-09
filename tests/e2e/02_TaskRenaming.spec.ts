import { test, expect } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

test.describe('UseCase: Ein Task umbenennen', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: Erzeugen, Bewegen und Umbenennen eines Tasks', async ({ page }) => {
        // Starte den Editor im E2E-Modus
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung (MyCoolGame.json laden)
        console.log('Test: 1. Vorbereitung (MyCoolGame.json laden)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // In die Flow-Ansicht wechseln
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.switchView('flow');
        });

        await page.waitForSelector('#flow-canvas');

        // 2. Task erzeugen (nur Definition, KEIN Node im Main Flow)
        console.log('Test: 2. Task erzeugen...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.flowEditor.taskManager.ensureTaskExists('ANewTask');
        });

        await page.waitForTimeout(500);

        // 3. Task umbenennen (über API analog zur Inspector-Nutzung durch den User)
        console.log('Test: 3. Task umbenennen (Inspector Simulation)...');
        await page.evaluate(() => {
            const mediator = (window as any).mediatorService;
            mediator.renameTask('global', 'ANewTask', 'VerifyTask');
        });

        await page.waitForTimeout(500);

        // 4. Validierung der Änderungen im JSON Storage
        console.log('Test: 4. Validierung der Änderungen (JSON)...');
        const taskSearch = await page.evaluate(() => {
            const p = (window as any).editor.project;
            // Task kan in project.tasks oder in einer stage.tasks liegen
            const findTask = (name: string): boolean => {
                if (p.tasks?.some((t: any) => t.name === name)) return true;
                for (const s of (p.stages || [])) {
                    if (s.tasks?.some((t: any) => t.name === name)) return true;
                }
                return false;
            };
            return { oldFound: findTask('ANewTask'), newFound: findTask('VerifyTask') };
        });

        expect(taskSearch.oldFound).toBe(false);
        expect(taskSearch.newFound).toBe(true);

        // 5. Validierung im Manager View (Echte UI-Validierung)
        console.log('Test: 5. Check Manager Liste auf UI-Ebene...');

        // Klick auf den Tab "Manager"
        await page.locator('.tab-btn[data-view="management"]').click();
        await page.waitForSelector('.management-sidebar');

        // Klick auf "Tasks" in der Sidebar
        await page.locator('.management-sidebar-btn', { hasText: 'Tasks' }).click();
        await page.waitForTimeout(300); // Warten auf Re-Rendering

        // Validieren, dass VerifyTask dargestellt wird und ANewTask weg ist
        const contentText = await page.locator('.management-content').innerText();
        expect(contentText).toContain('VerifyTask');
        expect(contentText).not.toContain('ANewTask');

        // 6. VerifyTask-Flow öffnen und Action auf Canvas ziehen
        // (simuliert den echten User-Workflow: Action aus Toolbox auf Flow-Canvas ziehen)
        console.log('Test: 6. VerifyTask-Flow öffnen und Action auf Canvas ziehen...');
        await page.locator('.tab-btn[data-view="flow"]').click();
        await page.waitForSelector('#flow-canvas');

        // VerifyTask-Flow öffnen (FlowGraphHydrator erkennt leere flowCharts
        // und generiert den Task-Startknoten via generateFlowFromActionSequence)
        await page.evaluate(() => {
            const editor = (window as any).editor;
            // Guard-Umgehung: erst 'global', dann 'VerifyTask'
            editor.flowEditor.switchActionFlow('global', false, true);
            editor.flowEditor.switchActionFlow('VerifyTask');
        });
        await page.waitForTimeout(500);

        // Action-Knoten auf den Canvas ziehen (= handleDrop → createNode)
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.flowEditor.createNode('Action', 500, 200, 'action');
            editor.flowEditor.syncToProject();
        });
        await page.waitForTimeout(300);

        // Validierung: Task-Startknoten + Action-Knoten im Flow vorhanden
        const flowNodeCount = await page.evaluate(() => {
            return (window as any).editor.flowEditor.nodes.length;
        });
        console.log(`Test: Flow-Knoten im VerifyTask-Diagramm: ${flowNodeCount}`);
        expect(flowNodeCount).toBeGreaterThanOrEqual(2); // Task-Start + Action

        // 7. Projekt speichern für nächste Test-Stufe
        console.log('Test: 7. Speichern nach Task-Umbenennung + Action im Flow...');
        await saveMyCoolGame(page);
        console.log('Test: Flow erfolgreich abgeschlossen. MyCoolGame.json aktualisiert.');
    });
});
