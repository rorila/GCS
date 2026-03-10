import { test, expect } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

test.describe('UseCase: Eine Action umbenennen', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: Erzeugen und Umbenennen einer Action via Inspector UI', async ({ page }) => {
        // Starte den Editor im E2E-Modus
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung (MyCoolGame.json laden)
        console.log('Test: 1. Vorbereitung (MyCoolGame.json laden)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // In die Flow-Ansicht wechseln und SwitchToTheHighscoreStage-Flow öffnen
        // (enthält bereits Task-Startknoten + Action-Knoten 'action' vom TaskRenaming-Test)
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.switchView('flow');
            editor.flowEditor.switchActionFlow('global', false, true);
            editor.flowEditor.switchActionFlow('SwitchToTheHighscoreStage');
        });

        await page.waitForSelector('#flow-canvas');
        await page.waitForTimeout(500);

        // 2. Action umbenennen (via UI Interaktion)
        console.log('Test: 2. Action umbenennen via Inspector UI...');

        // 2.1 Knoten auswählen (.first() da nach loadMyCoolGame mehrere Nodes existieren können)
        await page.locator('.flow-node', { hasText: 'action' }).first().click();

        // 2.2 Im Inspector tippen
        // Der NameInput sollte nach Selektion existieren
        const nameInput = page.locator('input[name="NameInput"]');
        await expect(nameInput).toBeVisible();
        await nameInput.fill('ShowTheHighscoreStage');
        await nameInput.press('Enter'); // Trigger onchange
        await nameInput.blur();

        await page.waitForTimeout(500);

        // Explizit syncToProject auslösen
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.flowEditor.syncToProject();
        });

        await page.waitForTimeout(300);

        // 3. Validierung der Änderungen (JSON)
        console.log('Test: 3. Validierung der Änderungen (JSON)...');
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

        const newActionFound = findActionAnywhere(projectData, 'ShowTheHighscoreStage');
        const oldActionFound = findActionAnywhere(projectData, 'action');

        console.log(`Test: ShowTheHighscoreStage gefunden: ${newActionFound}, 'action' noch vorhanden: ${oldActionFound}`);

        expect(newActionFound).toBeTruthy();
        expect(oldActionFound).toBeFalsy();

        // 4. Validierung im Manager View (UI)
        console.log('Test: 4. Check Manager Liste auf UI-Ebene...');
        await page.locator('.tab-btn[data-view="management"]').click();
        await page.waitForSelector('.management-sidebar');

        await page.locator('.management-sidebar-btn', { hasText: '🎬 Aktionen' }).click();
        await page.waitForTimeout(300);

        const contentText = await page.locator('.management-content').innerText();
        expect(contentText).toContain('ShowTheHighscoreStage');
        expect(contentText).not.toContain('action');

        // 5. Projekt speichern für nächste Test-Stufe
        console.log('Test: 5. Speichern nach Action-Umbenennung...');
        await saveMyCoolGame(page);
        console.log('Test: Flow ActionRenaming erfolgreich abgeschlossen. MyCoolGame.json aktualisiert.');
    });
});
