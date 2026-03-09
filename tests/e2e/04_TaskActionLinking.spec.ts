import { test, expect } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

/**
 * UseCase: Task mit Action verknüpfen
 *
 * Vorbedingungen:
 * - Stage: MainStage (id='main')
 * - Task "VerifyTask" in mainStage.tasks
 * - Action "VerifyAction" in mainStage.actions
 *
 * Schritte:
 * 1. VerifyTask-Flow öffnen (switchActionFlow erzeugt automatisch einen Task-Knoten als Startpunkt)
 * 2. Action-Knoten "VerifyAction" im Flow erzeugen
 * 3. Verbindung vom auto-generierten Task-Knoten (Output-Anker)
 *    zum Action-Knoten (Input-Anker) herstellen
 * 4. JSON-Validierung:
 *    - Connection in flowCharts vorhanden
 *    - VerifyAction in actionSequence des VerifyTask (kein Inline-Block)
 * 5. Manager-View: VerifyAction in Aktions-Liste
 */
test.describe('UseCase: Task mit Action verknüpfen', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: VerifyTask mit VerifyAction verbinden via Flow-Editor', async ({ page }) => {
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung: MyCoolGame.json laden (enthält VerifyTask + VerifyAction)
        console.log('Test: 1. Vorbereitung (MyCoolGame.json laden)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // Flow-Ansicht, VerifyTask-Kontext öffnen
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.switchView('flow');
            // WICHTIG: Erst 'global' setzen, dann 'VerifyTask'
            // switchActionFlow() hat einen Guard: 'if (currentFlowContext === context) return'
            // Falls localStorage noch 'VerifyTask' enthält, würde der Guard greifen
            // und loadFromProject() würde nicht aufgerufen → keine Nodes auf der Canvas
            editor.flowEditor.switchActionFlow('global', false, true);
            editor.flowEditor.switchActionFlow('VerifyTask');
        });

        await page.waitForSelector('#flow-canvas');
        await page.waitForTimeout(800);

        // 2. Bestehende Task- und Action-Knoten finden und verbinden
        console.log('Test: 2. Bestehende Knoten finden und verbinden...');
        const nodeIds = await page.evaluate(() => {
            const editor = (window as any).editor;
            const flowEditor = editor.flowEditor;

            // Den Task-Knoten finden - entweder via getType() oder via Name
            // (beide Strategien abdecken loadProject-Restore und frische Erstellung)
            const existingTaskNode = flowEditor.nodes.find((n: any) =>
                n.getType?.() === 'task' || n.Name === 'VerifyTask'
            );
            if (!existingTaskNode) {
                console.error('[E2E] Kein Task-Knoten gefunden! Nodes:', flowEditor.nodes.map((n: any) => n.Name + ':' + n.getType?.()));
                return { error: 'no task node' };
            }

            // Den existierenden VerifyAction-Knoten finden (wurde im ActionRenaming-Test umbenannt)
            const actionNode = flowEditor.nodes.find((n: any) =>
                n.getType?.() === 'action' || n.Name === 'VerifyAction'
            );
            if (!actionNode) {
                console.error('[E2E] Kein Action-Knoten gefunden! Nodes:', flowEditor.nodes.map((n: any) => n.Name + ':' + n.getType?.()));
                return { error: 'no action node' };
            }

            console.log(`[E2E] TaskNode: id=${existingTaskNode.id}, name=${existingTaskNode.Name}`);
            console.log(`[E2E] ActionNode: id=${actionNode.id}, name=${actionNode.Name}`);

            // Verbindung: Output-Anker des Task-Knotens → Input-Anker des Action-Knotens
            flowEditor.restoreConnection({
                id: 'conn_task_to_action',
                startTargetId: existingTaskNode.id,
                endTargetId: actionNode.id,
                startX: existingTaskNode.X + 200, startY: existingTaskNode.Y + 30,
                endX: actionNode.X, endY: actionNode.Y + 30,
                data: { startAnchorType: 'output', endAnchorType: 'input' }
            });

            // Sync: Canvas → Projekt-JSON
            flowEditor.syncToProject();

            // Sofort-Check der Sequenz nach syncToProject
            const mainStage = editor.project.stages.find((s: any) => s.id === 'main');
            const task = (mainStage?.tasks || []).find((t: any) => t.name === 'VerifyTask');
            console.log(`[E2E] Nach syncToProject: seqLen=${task?.actionSequence?.length}, seq=${JSON.stringify(task?.actionSequence)}`);

            return {
                taskId: existingTaskNode.id,
                actionId: actionNode.id,
            };
        });

        console.log('Test: Node-IDs:', JSON.stringify(nodeIds));
        expect((nodeIds as any).error).toBeFalsy();

        await page.waitForTimeout(300);

        // 3. JSON-Validierung
        console.log('Test: 3. JSON-Validierung (Connection + actionSequence)...');
        const result = await page.evaluate((ids: any) => {
            const project = (window as any).editor.project;

            const findTask = (name: string): any => {
                for (const t of (project.tasks || [])) { if (t.name === name) return t; }
                for (const s of (project.stages || [])) {
                    for (const t of (s.tasks || [])) { if (t.name === name) return t; }
                }
                return null;
            };

            const task = findTask('VerifyTask');
            const seq: any[] = task?.actionSequence || [];
            const actionEntry = seq.find((item: any) => item.name === 'VerifyAction');
            const isInline = actionEntry ? !!(actionEntry.body || actionEntry.steps || actionEntry.inline) : false;

            let connFound = false;
            for (const s of (project.stages || [])) {
                for (const key of Object.keys(s.flowCharts || {})) {
                    const chart = s.flowCharts[key];
                    if (chart?.connections?.some((c: any) =>
                        c.startTargetId === ids.taskId && c.endTargetId === ids.actionId
                    )) connFound = true;
                }
            }
            for (const key of Object.keys(project.flowCharts || {})) {
                const chart = project.flowCharts[key];
                if (chart?.connections?.some((c: any) =>
                    c.startTargetId === ids.taskId && c.endTargetId === ids.actionId
                )) connFound = true;
            }

            return { actionInSequence: !!actionEntry, isInline, seqLen: seq.length, connFound };
        }, nodeIds);

        console.log(`Test: actionInSequence=${result.actionInSequence}, isInline=${result.isInline}, seqLen=${result.seqLen}, connFound=${result.connFound}`);

        // 3a. Verbindung im FlowChart vorhanden
        expect(result.connFound).toBeTruthy();
        // 3b. VerifyAction in actionSequence
        expect(result.actionInSequence).toBeTruthy();
        // 3c. Kein Inline-Block
        expect(result.isInline).toBeFalsy();

        // 4. Manager-View UI-Validierung
        console.log('Test: 4. Manager-View UI-Validierung...');
        await page.locator('.tab-btn[data-view="management"]').click();
        await page.waitForSelector('.management-sidebar');
        await page.locator('.management-sidebar-btn', { hasText: '🎬 Aktionen' }).click();
        await page.waitForTimeout(300);

        const contentText = await page.locator('.management-content').innerText();
        expect(contentText).toContain('VerifyAction');

        // 5. Projekt speichern für nächste Test-Stufe (ProjectSaving)
        console.log('Test: 5. Speichern nach Task-Action-Verknüpfung...');
        await saveMyCoolGame(page);
        console.log('Test: TaskActionLinking erfolgreich abgeschlossen. MyCoolGame.json aktualisiert.');
    });
});
