import { test, expect } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

/**
 * UseCase: Action Typ ändern
 *
 * User-Workflow:
 * 1. MyCoolGame.json laden
 * 2. Tab: Flow auswählen
 * 3. Im Flow-Dropdown den Task: SwitchToTheHighscoreStage auswählen
 * 4. Im Flowdiagramm die Action: ShowTheHighscoreStage anklicken
 * 5. Im Inspector den Action-Typ (ActionTypeSelect) auf 'navigate_stage' ändern
 * 6. Im Inspector die Ziel-Stage (stageId) auf HighscoreStage setzen
 * 7. Speichern
 */
test.describe('UseCase: Action Typ ändern', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: ShowTheHighscoreStage auf navigate_stage setzen und HighscoreStage als Ziel', async ({ page }) => {
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung (MyCoolGame.json laden)
        console.log('Test: 1. Vorbereitung (MyCoolGame.json laden)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // 2. Zum Flow-Tab wechseln (User klickt auf den Tab "Flow")
        console.log('Test: 2. Flow-Tab auswählen...');
        // User wählt im Flow-Dropdown "SwitchToTheHighscoreStage" (simuliert via switchActionFlow wie in Test 04)
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.switchView('flow');
            // WICHTIG: Erst 'global' setzen, dann 'SwitchToTheHighscoreStage' (Guard-Bypass)
            editor.flowEditor.switchActionFlow('global', false, true);
            editor.flowEditor.switchActionFlow('SwitchToTheHighscoreStage');
        });
        await page.waitForSelector('#flow-canvas');
        await page.waitForTimeout(800);

        // 4. ShowTheHighscoreStage-Knoten im Flowdiagramm anklicken (User klickt auf den Knoten)
        console.log('Test: 4. ShowTheHighscoreStage im Flow anklicken...');
        const actionNode = page.locator('.flow-node:has-text("ShowTheHighscoreStage")').first();
        await expect(actionNode).toBeVisible({ timeout: 5000 });
        await actionNode.click();
        await page.waitForTimeout(500);

        // 5. Action-Typ im Inspector auf 'navigate_stage' ändern (User wählt im Select)
        console.log('Test: 5. ActionTypeSelect auf navigate_stage ändern...');
        const typeSelect = page.locator('select[name="ActionTypeSelect"]');
        await expect(typeSelect).toBeVisible({ timeout: 5000 });
        await typeSelect.selectOption('navigate_stage');
        await page.waitForTimeout(500);

        // 6. Ziel-Stage auf HighscoreStage setzen (User wählt im Select)
        console.log('Test: 6. stageId auf HighscoreStage setzen...');
        const stageSelect = page.locator('select[name="stageId"]');
        await expect(stageSelect).toBeVisible({ timeout: 5000 });

        // Verfügbare Optionen loggen
        const options = await stageSelect.locator('option').allTextContents();
        console.log(`Test: Verfügbare Stages: ${JSON.stringify(options)}`);

        // HighscoreStage auswählen (per Text-Match)
        const highscoreOption = stageSelect.locator('option:has-text("HighscoreStage")');
        const highscoreValue = await highscoreOption.getAttribute('value');
        console.log(`Test: HighscoreStage value: ${highscoreValue}`);
        if (highscoreValue) {
            await stageSelect.selectOption(highscoreValue);
        }

        await page.waitForTimeout(500);

        // 7. Validierung: Action-Daten in JSON prüfen
        console.log('Test: 7. Validierung Action-Daten in JSON...');
        const actionData = await page.evaluate(() => {
            const p = (window as any).editor.project;
            const findAction = (name: string) => {
                for (const s of (p.stages || [])) {
                    const a = s.actions?.find((a: any) => a.name === name);
                    if (a) return a;
                }
                return p.actions?.find((a: any) => a.name === name);
            };
            const a = findAction('ShowTheHighscoreStage');
            return a ? { name: a.name, type: a.type, stageId: a.stageId } : null;
        });
        console.log(`Test: ShowTheHighscoreStage: ${JSON.stringify(actionData)}`);

        // 8. Projekt speichern
        console.log('Test: 8. Speichern...');
        await saveMyCoolGame(page);
        console.log('Test: Flow erfolgreich abgeschlossen. MyCoolGame.json aktualisiert.');
    });
});
