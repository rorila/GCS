import { test, expect } from '@playwright/test';
import { loadMyCoolGame, saveMyCoolGame } from './helpers/loadMyCoolGame';

test.describe('UseCase: Eine neue Stage erzeugen', () => {
    test.describe.configure({ mode: 'serial' });

    test('Kompletter Flow: Neue Stage erzeugen und zu HighscoreStage umbenennen', async ({ page }) => {
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // 1. Vorbereitung (MyCoolGame.json laden)
        console.log('Test: 1. Vorbereitung (MyCoolGame.json laden)...');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);
        await loadMyCoolGame(page);

        // 2. Neue Stage erzeugen über Menü: Stages → Neue Stage
        console.log('Test: 2. Neue Stage erzeugen via Menü...');
        const stagesMenuBtn = page.locator('.menu-bar-button:has-text("Stages")');
        await stagesMenuBtn.click();
        await page.waitForTimeout(300);

        const dropdown = page.locator('.menu-dropdown');
        await expect(dropdown).toBeVisible({ timeout: 3000 });

        const neueStageItem = dropdown.locator('.menu-item:has-text("Neue Stage")');
        await expect(neueStageItem).toBeVisible({ timeout: 3000 });
        await neueStageItem.click();

        await page.waitForTimeout(1000);

        // 3. Validierung: Neue Stage wurde erzeugt (in project.stages)
        console.log('Test: 3. Validierung Stage-Erzeugung...');
        const stageCount = await page.evaluate(() => {
            const p = (window as any).editor.project;
            return p.stages?.length;
        });
        console.log(`Test: Anzahl Stages: ${stageCount}`);
        expect(stageCount).toBeGreaterThanOrEqual(3); // Blueprint + MainStage + neue Stage

        // 4. Neue Stage umbenennen zu 'HighscoreStage'
        // Die neue Stage ist jetzt aktiv (createStage setzt activeStageId und switchStage)
        console.log('Test: 4. Stage umbenennen zu HighscoreStage...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            const activeStage = editor.project.stages?.find(
                (s: any) => s.id === editor.project.activeStageId
            );
            if (activeStage) {
                activeStage.name = 'HighscoreStage';
                (window as any).mediatorService.notifyDataChanged(editor.project, 'inspector');
                editor.menuManager?.updateStagesMenu();
            }
        });

        await page.waitForTimeout(500);

        // 5. Validierung: Stage-Name in JSON (In-Memory)
        console.log('Test: 5. Validierung Stage-Name in JSON...');
        const stageNames = await page.evaluate(() => {
            const p = (window as any).editor.project;
            return p.stages?.map((s: any) => ({ id: s.id, name: s.name, type: s.type }));
        });
        console.log(`Test: Stages: ${JSON.stringify(stageNames)}`);
        const hsStage = stageNames.find((s: any) => s.name === 'HighscoreStage');
        expect(hsStage).toBeDefined();

        // 6. Zurück zur MainStage wechseln (für folgende Tests)
        console.log('Test: 6. Zurück zur MainStage...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.stageManager.switchStage('main');
        });
        await page.waitForTimeout(500);

        // 7. Sicherheits-Validierung: HighscoreStage ist noch im Array nach switchStage
        const stagesAfterSwitch = await page.evaluate(() => {
            return (window as any).editor.project.stages?.map((s: any) => ({ id: s.id, name: s.name }));
        });
        console.log(`Test: Stages nach switchStage: ${JSON.stringify(stagesAfterSwitch)}`);
        const hsCheck = stagesAfterSwitch.find((s: any) => s.name === 'HighscoreStage');
        expect(hsCheck).toBeDefined();

        // 8. Projekt speichern
        console.log('Test: 8. Speichern nach Stage-Erzeugung...');
        await saveMyCoolGame(page);
        console.log('Test: Flow erfolgreich abgeschlossen. MyCoolGame.json aktualisiert.');
    });
});
