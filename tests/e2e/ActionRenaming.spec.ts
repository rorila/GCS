import { test, expect } from '@playwright/test';

test.describe('UseCase: Eine Action umbenennen', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: Erzeugen und Umbenennen einer Action via Inspector UI', async ({ page }) => {
        // Starte den Editor im E2E-Modus
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung
        console.log('Test: 1. Vorbereitung (Projekt & VerifyTask)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.newProject();
            editor.switchView('flow');
            editor.flowEditor.taskManager.ensureTaskExists('VerifyTask');
            editor.flowEditor.switchActionFlow('VerifyTask');

            // Set dirty state back to false
            const blueprint = editor.project.stages.find((s: any) => s.id === 'blueprint');
            const changeVar = blueprint.variables.find((v: any) => v.name === 'isProjectChangeAvailable');
            if (changeVar) changeVar.defaultValue = false;
        });

        await page.waitForSelector('#flow-canvas');

        // 2. Action erzeugen
        console.log('Test: 2. Action erzeugen...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.flowEditor.createNode('Action', 300, 200, 'action');
            editor.flowEditor.syncToProject();
        });

        await page.waitForTimeout(500);

        // 3. Action umbenennen (via UI Interaktion)
        console.log('Test: 3. Action umbenennen via Inspector UI...');

        // 3.1 Knoten auswählen
        await page.locator('.flow-node', { hasText: 'action' }).click();

        // 3.2 Im Inspector tippen
        // Der NameInput sollte nach Selektion existieren
        const nameInput = page.locator('input[name="NameInput"]');
        await expect(nameInput).toBeVisible();
        await nameInput.fill('VerifyAction');
        await nameInput.press('Enter'); // Trigger onchange
        await nameInput.blur();

        await page.waitForTimeout(500);

        // Explizit syncToProject auslösen, um sicherzustellen dass die Änderung persistiert wurde
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.flowEditor.syncToProject();
        });

        await page.waitForTimeout(300);

        // 4. Validierung der Änderungen (JSON)
        console.log('Test: 4. Validierung der Änderungen (JSON)...');
        const projectData = await page.evaluate(() => (window as any).editor.project);

        // Dirty-Check
        const blueprint = projectData.stages.find((s: any) => s.id === 'blueprint');
        const changeVar = blueprint.variables.find((v: any) => v.name === 'isProjectChangeAvailable');
        expect(changeVar.defaultValue).toBe(true);
        expect(changeVar.value).toBe(true);

        // Hilfsfunktion: Action in allen möglichen Speicherorten suchen
        // (Root, Blueprint-Stage, aktive Stage, alle anderen Stages)
        const findActionAnywhere = (project: any, actionName: string): boolean => {
            // Root-Level
            if (project.actions?.find((a: any) => a.name === actionName)) return true;

            // Alle Stages (inkl. blueprint und main)
            if (project.stages) {
                for (const stage of project.stages) {
                    if (stage.actions?.find((a: any) => a.name === actionName)) return true;

                    // Auch in flowCharts der Stage suchen
                    if (stage.flowCharts) {
                        for (const chartKey of Object.keys(stage.flowCharts)) {
                            const chart = stage.flowCharts[chartKey];
                            if (chart?.elements?.some((el: any) =>
                                el.Name === actionName || el.properties?.name === actionName || el.data?.name === actionName
                            )) return true;
                        }
                    }
                }
            }

            // Root-Level FlowCharts
            if (project.flowCharts) {
                for (const chartKey of Object.keys(project.flowCharts)) {
                    const chart = project.flowCharts[chartKey];
                    if (chart?.elements?.some((el: any) =>
                        el.Name === actionName || el.properties?.name === actionName || el.data?.name === actionName
                    )) return true;
                }
            }

            return false;
        };

        const newActionFound = findActionAnywhere(projectData, 'VerifyAction');
        const oldActionFound = findActionAnywhere(projectData, 'action');

        console.log(`Test: VerifyAction gefunden: ${newActionFound}, 'action' noch vorhanden: ${oldActionFound}`);

        expect(newActionFound).toBeTruthy();
        expect(oldActionFound).toBeFalsy();

        // 5. Validierung im Manager View (UI)
        console.log('Test: 5. Check Manager Liste auf UI-Ebene...');
        await page.locator('.tab-btn[data-view="management"]').click();
        await page.waitForSelector('.management-sidebar');

        await page.locator('.management-sidebar-btn', { hasText: '🎬 Aktionen' }).click();
        await page.waitForTimeout(300);

        const contentText = await page.locator('.management-content').innerText();
        expect(contentText).toContain('VerifyAction');
        expect(contentText).not.toContain('action');

        console.log('Test: Flow ActionRenaming erfolgreich abgeschlossen.');
    });
});
