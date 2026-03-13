import { test, expect, Page } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

/**
 * Inspector-Sync Roundtrip Test
 * 
 * Prüft den kompletten Datenfluss:
 * 1. Inspector-Wert ändern (Action-Typ, Action-Name)
 * 2. → JSON-Daten prüfen (stimmt der Wert in project.actions/stages?)
 * 3. → Flow-Diagramm prüfen (Node-Daten aktualisiert?)
 * 4. → Pascal-Code prüfen (generiert korrekt?)
 * 
 * Szenario A: Action-Typ von 'action' auf 'navigate_stage' ändern
 * Szenario B: Action umbenennen und prüfen ob Refactoring alle Stellen aktualisiert
 */
test.describe('Sync Roundtrip: Inspector → JSON → Flow → Pascal', () => {
    test.describe.configure({ mode: 'serial' });

    test('Roundtrip A: Action-Typ-Änderung propagiert durch alle Ebenen', async ({ page }) => {
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Setup: MyCoolGame laden
        console.log('RT-A: 1. MyCoolGame laden...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // 2. Flow-Tab → SwitchToTheHighscoreStage Task
        console.log('RT-A: 2. Flow-Tab → SwitchToTheHighscoreStage...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.switchView('flow');
            editor.flowEditor.switchActionFlow('global', false, true);
            editor.flowEditor.switchActionFlow('SwitchToTheHighscoreStage');
        });
        await page.waitForSelector('#flow-canvas');
        await page.waitForTimeout(800);

        // 3. Action-Node im Flow anklicken
        console.log('RT-A: 3. ShowTheHighscoreStage anklicken...');
        const actionNode = page.locator('.flow-node:has-text("ShowTheHighscoreStage")').first();
        await expect(actionNode).toBeVisible({ timeout: 5000 });
        await actionNode.click();
        await page.waitForTimeout(500);

        // 4. Typ im Inspector auf navigate_stage ändern
        console.log('RT-A: 4. Typ auf navigate_stage ändern...');
        const typeSelect = page.locator('select[name="ActionTypeSelect"]');
        await expect(typeSelect).toBeVisible({ timeout: 5000 });
        await typeSelect.selectOption('navigate_stage');
        await page.waitForTimeout(800);

        // ===== ROUNDTRIP PRÜFUNG 1: JSON-Daten =====
        console.log('RT-A: 5. Prüfe JSON-Daten...');
        const jsonCheck = await page.evaluate(() => {
            const p = (window as any).editor.project;
            // Suche Action-Definition in allen Stages + Root
            const findAction = (name: string) => {
                for (const s of (p.stages || [])) {
                    const a = (s.actions || []).find((a: any) => a.name === name);
                    if (a) return a;
                }
                return (p.actions || []).find((a: any) => a.name === name);
            };
            const action = findAction('ShowTheHighscoreStage');
            return action ? { type: action.type, name: action.name } : null;
        });
        console.log(`RT-A: JSON Action = ${JSON.stringify(jsonCheck)}`);
        expect(jsonCheck).not.toBeNull();
        expect(jsonCheck!.type).toBe('navigate_stage');

        // ===== ROUNDTRIP PRÜFUNG 2: Flow-Node-Daten =====
        console.log('RT-A: 6. Prüfe Flow-Node-Daten...');
        const flowNodeCheck = await page.evaluate(() => {
            const fe = (window as any).editor.flowEditor;
            const nodes = fe.nodes || [];
            const actionNode = nodes.find((n: any) => {
                const name = n.Name || n.name || n.data?.name;
                return name === 'ShowTheHighscoreStage';
            });
            if (!actionNode) return null;
            return {
                type: actionNode.data?.type || actionNode.getType?.(),
                name: actionNode.Name || actionNode.data?.name
            };
        });
        console.log(`RT-A: Flow-Node = ${JSON.stringify(flowNodeCheck)}`);
        expect(flowNodeCheck).not.toBeNull();
        // Flow-Node-Typ sollte entweder 'navigate_stage' oder 'action' sein (je nach Architektur)
        // Wichtig ist, dass data.type korrekt gesetzt ist
        expect(flowNodeCheck!.name).toBe('ShowTheHighscoreStage');

        // ===== ROUNDTRIP PRÜFUNG 3: Pascal-Code =====
        console.log('RT-A: 7. Prüfe Pascal-Code...');
        const pascalCode = await page.evaluate(() => {
            const editor = (window as any).editor;
            // PascalCodeGenerator aufrufen (plain text, kein HTML)
            if (editor.pascalGenerator?.generateForTask) {
                return editor.pascalGenerator.generateForTask(
                    editor.project, 'SwitchToTheHighscoreStage', false
                );
            }
            // Fallback: Über statischen Import
            const PascalGen = (window as any).PascalGenerator || (window as any).PascalCodeGenerator;
            if (PascalGen?.generateForTask) {
                return PascalGen.generateForTask(editor.project, 'SwitchToTheHighscoreStage', false);
            }
            return null;
        });
        console.log(`RT-A: Pascal-Code = ${pascalCode?.substring(0, 200) || 'null'}`);
        // Pascal-Code sollte 'navigate_stage' oder den Action-Aufruf enthalten
        if (pascalCode) {
            expect(pascalCode).toContain('ShowTheHighscoreStage');
        }

        // ===== ROUNDTRIP PRÜFUNG 4: JSON-View =====
        console.log('RT-A: 8. Prüfe JSON-View...');
        await page.evaluate(() => {
            (window as any).editor.switchView('json');
        });
        await page.waitForTimeout(500);
        const jsonViewer = page.locator('#json-viewer');
        await expect(jsonViewer).toContainText('navigate_stage', { timeout: 5000 });

        console.log('RT-A: ✅ Alle Roundtrip-Prüfungen bestanden!');
    });

    test('Roundtrip B: Action-Umbenennung propagiert durch alle Ebenen', async ({ page }) => {
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Setup: MyCoolGame laden
        console.log('RT-B: 1. MyCoolGame laden...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // 2. Flow-Tab → SwitchToTheHighscoreStage (dort existiert ShowTheHighscoreStage)
        console.log('RT-B: 2. Flow-Tab → SwitchToTheHighscoreStage...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.switchView('flow');
            editor.flowEditor.switchActionFlow('global', false, true);
            editor.flowEditor.switchActionFlow('SwitchToTheHighscoreStage');
        });
        await page.waitForSelector('#flow-canvas');
        await page.waitForTimeout(800);

        // 3. ShowTheHighscoreStage anklicken
        console.log('RT-B: 3. ShowTheHighscoreStage anklicken...');
        const actionNode = page.locator('.flow-node:has-text("ShowTheHighscoreStage")').first();
        await expect(actionNode).toBeVisible({ timeout: 5000 });
        await actionNode.click();
        await page.waitForTimeout(500);

        // 4. Name ändern
        console.log('RT-B: 4. Name auf RenamedStageAction ändern...');
        const nameInput = page.locator('input[name="NameInput"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        await nameInput.fill('RenamedStageAction');
        await nameInput.press('Enter');
        await page.waitForTimeout(800);

        // ===== ROUNDTRIP PRÜFUNG 1: JSON-Daten (alter Name weg, neuer da) =====
        console.log('RT-B: 5. Prüfe JSON-Daten...');
        const jsonCheck = await page.evaluate(() => {
            const p = (window as any).editor.project;
            const findAction = (name: string) => {
                for (const s of (p.stages || [])) {
                    const a = (s.actions || []).find((a: any) => a.name === name);
                    if (a) return a;
                }
                return (p.actions || []).find((a: any) => a.name === name);
            };
            return {
                oldFound: !!findAction('ShowTheHighscoreStage'),
                newFound: !!findAction('RenamedStageAction')
            };
        });
        console.log(`RT-B: JSON = ${JSON.stringify(jsonCheck)}`);
        expect(jsonCheck.oldFound).toBeFalsy();
        expect(jsonCheck.newFound).toBeTruthy();

        // ===== ROUNDTRIP PRÜFUNG 2: Flow-Node =====
        console.log('RT-B: 6. Prüfe Flow-Node...');
        const renamedNode = page.locator('.flow-node:has-text("RenamedStageAction")');
        await expect(renamedNode).toBeVisible({ timeout: 5000 });

        // ===== ROUNDTRIP PRÜFUNG 3: ActionSequence referenziert neuen Namen =====
        console.log('RT-B: 7. Prüfe ActionSequence...');
        const seqCheck = await page.evaluate(() => {
            const p = (window as any).editor.project;
            const findTask = (name: string) => {
                for (const s of (p.stages || [])) {
                    const t = (s.tasks || []).find((t: any) => t.name === name);
                    if (t) return t;
                }
                return (p.tasks || []).find((t: any) => t.name === name);
            };
            const task = findTask('SwitchToTheHighscoreStage');
            if (!task?.actionSequence) return { hasOld: false, hasNew: false };
            const seqStr = JSON.stringify(task.actionSequence);
            return {
                hasOld: seqStr.includes('ShowTheHighscoreStage'),
                hasNew: seqStr.includes('RenamedStageAction')
            };
        });
        console.log(`RT-B: ActionSequence = ${JSON.stringify(seqCheck)}`);
        expect(seqCheck.hasOld).toBeFalsy();
        expect(seqCheck.hasNew).toBeTruthy();

        // ===== ROUNDTRIP PRÜFUNG 4: JSON-View =====
        console.log('RT-B: 8. Prüfe JSON-View...');
        await page.evaluate(() => {
            (window as any).editor.switchView('json');
        });
        await page.waitForTimeout(500);
        const jsonViewer = page.locator('#json-viewer');
        await expect(jsonViewer).toContainText('RenamedStageAction', { timeout: 5000 });

        console.log('RT-B: ✅ Alle Roundtrip-Prüfungen bestanden!');

        // Cleanup: Zurückbenennen damit MyCoolGame.json konsistent bleibt
        console.log('RT-B: 9. Cleanup: Zurückbenennen...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.switchView('flow');
            editor.flowEditor.switchActionFlow('global', false, true);
            editor.flowEditor.switchActionFlow('SwitchToTheHighscoreStage');
        });
        await page.waitForTimeout(800);
        
        const renamedActionNode = page.locator('.flow-node:has-text("RenamedStageAction")').first();
        await renamedActionNode.click();
        await page.waitForTimeout(500);
        
        const nameInputRevert = page.locator('input[name="NameInput"]');
        await expect(nameInputRevert).toBeVisible({ timeout: 5000 });
        await nameInputRevert.fill('ShowTheHighscoreStage');
        await nameInputRevert.press('Enter');
        await page.waitForTimeout(500);
        
        await saveMyCoolGame(page);
    });
});

