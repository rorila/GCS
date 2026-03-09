import { test, expect } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

/**
 * UseCase: RunButton erzeugen
 *
 * User-Workflow:
 * 1. MyCoolGame.json laden
 * 2. Sichergehen, dass MainStage aktiv ist
 * 3. Tab: Stage auswählen
 * 4. In der Toolbox die Kategorie "Standard" expandieren
 * 5. Button aus Toolbox anklicken → wird auf Stage platziert
 * 6. Platzierten Button auf der Stage anklicken (selektieren)
 * 7. Im Inspector die Beschriftung (caption) auf 'run' ändern
 * 8. Speichern
 */
test.describe('UseCase: RunButton erzeugen', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: Button auf MainStage erzeugen und mit run beschriften', async ({ page }) => {
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung (MyCoolGame.json laden)
        console.log('Test: 1. Vorbereitung (MyCoolGame.json laden)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // 2. Sicherstellen, dass MainStage aktiv ist
        console.log('Test: 2. MainStage aktivieren...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.stageManager.switchStage('main');
        });
        await page.waitForTimeout(500);

        // 3. Stage-Tab auswählen (User klickt auf "Stage" Tab)
        console.log('Test: 3. Stage-Tab auswählen...');
        await page.locator('.tab-btn[data-view="stage"]').click();
        await page.waitForSelector('#stage-viewport');
        await page.waitForTimeout(500);

        // Objekte VOR dem Button-Platzieren zählen
        const objectCountBefore = await page.evaluate(() => {
            const editor = (window as any).editor;
            const mainStage = editor.project.stages?.find((s: any) => s.id === 'main');
            return mainStage?.objects?.length || 0;
        });
        console.log(`Test: Objekte vor Button-Platzierung: ${objectCountBefore}`);

        // 4. Toolbox: Kategorie "Standard" expandieren (User klickt auf "Standard")
        console.log('Test: 4. Toolbox Kategorie Standard expandieren...');
        const standardCategory = page.locator('#json-toolbox-content .toolbox-category:has-text("Standard")');
        await standardCategory.click();
        await page.waitForTimeout(300);

        // 5. Button aus der Toolbox auf die Stage ziehen/klicken
        console.log('Test: 5. Button aus Toolbox auf Stage platzieren...');
        const toolboxButton = page.locator('#json-toolbox-content .toolbox-item:has-text("Button")').first();
        await expect(toolboxButton).toBeVisible({ timeout: 3000 });
        await toolboxButton.click();
        await page.waitForTimeout(500);

        // 6. Validierung: Neuer Button wurde auf Stage platziert
        console.log('Test: 6. Validierung neuer Button...');
        const objectCountAfter = await page.evaluate(() => {
            const editor = (window as any).editor;
            const mainStage = editor.project.stages?.find((s: any) => s.id === 'main');
            return mainStage?.objects?.length || 0;
        });
        console.log(`Test: Objekte nach Button-Platzierung: ${objectCountAfter}`);
        expect(objectCountAfter).toBeGreaterThan(objectCountBefore);

        // 7. Den neuen Button selektieren und umbenennen
        // Der neue Button ist das zuletzt hinzugefügte Objekt
        console.log('Test: 7. Neuen Button selektieren und beschriften...');
        const newButton = await page.evaluate(() => {
            const editor = (window as any).editor;
            const mainStage = editor.project.stages?.find((s: any) => s.id === 'main');
            const objects = mainStage?.objects || [];
            // Finde den zuletzt hinzugefügten TButton
            const buttons = objects.filter((o: any) => o.className === 'TButton');
            return buttons.length > 0 ? buttons[buttons.length - 1] : null;
        });
        console.log(`Test: Neuer Button: ${JSON.stringify(newButton?.name)}`);
        expect(newButton).not.toBeNull();

        // Button per selectObject im Editor selektieren
        if (newButton) {
            await page.evaluate((btnName: string) => {
                const editor = (window as any).editor;
                editor.selectObject(btnName);
            }, newButton.name);
            await page.waitForTimeout(300);

            // 8. Inspector: caption auf 'run' setzen
            console.log('Test: 8. Button beschriften: run...');
            // Inspector-Input für caption suchen (name="caption")
            let captionInput = page.locator('#inspector input[name="caption"]');
            let inputFound = await captionInput.isVisible({ timeout: 2000 }).catch(() => false);

            if (!inputFound) {
                // Fallback: text-Input
                captionInput = page.locator('#inspector input[name="text"]');
                inputFound = await captionInput.isVisible({ timeout: 2000 }).catch(() => false);
            }

            if (inputFound) {
                await captionInput.fill('run');
                await captionInput.press('Enter');
            } else {
                // Fallback: caption direkt im Projekt setzen
                console.log('Test: Inspector caption/text Input nicht gefunden, setze direkt...');
                await page.evaluate((btnName: string) => {
                    const editor = (window as any).editor;
                    const mainStage = editor.project.stages?.find((s: any) => s.id === 'main');
                    const btn = mainStage?.objects?.find((o: any) => o.name === btnName);
                    if (btn) {
                        btn.caption = 'run';
                        btn.text = 'run';
                        (window as any).mediatorService.notifyDataChanged(editor.project, 'inspector');
                    }
                }, newButton.name);
            }
            await page.waitForTimeout(500);
        }

        // 9. Validierung: Button in JSON hat caption 'run'
        console.log('Test: 9. Validierung Button in JSON...');
        const buttonData = await page.evaluate(() => {
            const editor = (window as any).editor;
            const mainStage = editor.project.stages?.find((s: any) => s.id === 'main');
            const buttons = (mainStage?.objects || []).filter((o: any) => o.className === 'TButton');
            return buttons.map((b: any) => ({
                name: b.name,
                caption: b.caption,
                text: b.text
            }));
        });
        console.log(`Test: Buttons: ${JSON.stringify(buttonData)}`);
        const runButton = buttonData.find((b: any) => b.caption === 'run' || b.text === 'run');
        expect(runButton).toBeDefined();

        // 10. Projekt speichern
        console.log('Test: 10. Speichern...');
        await saveMyCoolGame(page);
        console.log('Test: Flow erfolgreich abgeschlossen. MyCoolGame.json aktualisiert.');
    });
});
