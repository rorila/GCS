import { test, expect } from '@playwright/test';

test.describe('UseCase: Ein Task umbenennen', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: Erzeugen, Bewegen und Umbenennen eines Tasks', async ({ page }) => {
        // Starte den Editor im E2E-Modus
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung (Neues Projekt, MainStage umbenennen, Flow Tab)
        console.log('Test: 1. Vorbereitung (Neues Projekt, MainStage)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.newProject();
            const mainStage = editor.project.stages.find((s: any) => s.id === 'main');
            if (mainStage) mainStage.name = 'MainStage';
            // Wechsel in die Flow-Ansicht
            editor.switchView('flow');
        });

        await page.waitForSelector('#flow-canvas');

        // 2. Task erzeugen
        console.log('Test: 2. Task erzeugen...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.flowEditor.taskManager.createNewTaskFlow();
            // Erzeugen öffnet den Task-Flow, wir müssen für Move & Rename zurück in den "Main Stage Flow" (global in der Stage)
            editor.flowEditor.switchActionFlow('global');
        });

        await page.waitForTimeout(500);

        // Validierung Task-Erzeugung
        console.log('Test: Validierung Task-Erzeugung in Arrays...');
        let projectData = await page.evaluate(() => (window as any).editor.project);
        let mainStage = projectData.stages.find((s: any) => s.id === 'main');
        let taskData = mainStage?.tasks?.find((t: any) => t.name === 'ANewTask');
        expect(taskData).toBeDefined();

        // 3. Flow Objekt bewegen (Layout-Persistenz Test)
        // E2E-Drag & Drop auf Canvas-Elementen ist oft flaky, daher API-gestützt
        console.log('Test: 3. Flow Objekt bewegen...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            const flowEditor = editor.flowEditor;
            const node = flowEditor.nodes.find((el: any) => el.Name === 'ANewTask');

            if (node) {
                node.X -= 50;
                flowEditor.syncToProject();
            }
        });

        await page.waitForTimeout(400);

        // 4. Task umbenennen (über API analog zur Inspector-Nutzung durch den User)
        console.log('Test: 4. Task umbenennen (Inspector Simulation)...');
        await page.evaluate(() => {
            const mediator = (window as any).mediatorService;
            mediator.renameTask('global', 'ANewTask', 'VerifyTask');
        });

        await page.waitForTimeout(500);

        // 5. Validierung der Änderungen im JSON Storage
        console.log('Test: 5. Validierung der Änderungen (JSON)...');
        projectData = await page.evaluate(() => (window as any).editor.project);
        mainStage = projectData.stages.find((s: any) => s.id === 'main');

        let oldTask = mainStage?.tasks?.find((t: any) => t.name === 'ANewTask');
        let newTask = mainStage?.tasks?.find((t: any) => t.name === 'VerifyTask');

        expect(oldTask).toBeUndefined();
        expect(newTask).toBeDefined();

        // 6. Validierung im Manager View (Echte UI-Validierung)
        console.log('Test: 6. Check Manager Liste auf UI-Ebene...');

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

        console.log('Test: Flow erfolgreich abgeschlossen.');
    });
});
