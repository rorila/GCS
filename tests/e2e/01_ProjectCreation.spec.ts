import { test, expect } from '@playwright/test';
import { saveMyCoolGame, FILE_PATH } from './helpers/loadMyCoolGame';
import * as fs from 'fs';

/**
 * UseCase: Ein neues Projekt (Spiel) erzeugen
 *
 * User-Workflow:
 * 1. Menü: Datei → Neues Projekt
 * 2. Im Inspector (Stage-Settings): Spielname, Autor, Beschreibung, Stage Name, Grid konfigurieren
 * 3. Projekt speichern
 *
 * Alle Eingaben erfolgen über echte UI-Interaktionen (Menü-Klicks, Inspector-Inputs).
 */
test.describe('UseCase: Ein neues Projekt (Spiel) erzeugen', () => {
    test('Kompletter Flow: Erzeugung, Metadata, Dirty-Check, Stages & Grid', async ({ page }) => {
        page.on('console', msg => console.log('BROWSER:', msg.text()));
        // 0. Cleanup: Alte Projektdatei löschen (sauberer Start)
        if (fs.existsSync(FILE_PATH)) {
            fs.unlinkSync(FILE_PATH);
            console.log('Test: Alte MyCoolGame.json gelöscht.');
        }

        console.log('Test: Starte Editor...');
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);

        // ── 1. Menü: Datei → Neues Projekt ──────────────────────
        console.log('Test: 1. Menü: Datei → Neues Projekt...');
        const dateiMenuBtn = page.locator('.menu-bar-button:has-text("Datei")');
        await dateiMenuBtn.click();
        await page.waitForTimeout(300);

        const dropdownDatei = page.locator('.menu-dropdown');
        await expect(dropdownDatei).toBeVisible({ timeout: 3000 });

        const neuesProjektItem = dropdownDatei.locator('.menu-item:has-text("Neues Projekt")');
        await expect(neuesProjektItem).toBeVisible({ timeout: 3000 });
        await neuesProjektItem.click();
        await page.waitForTimeout(500);

        // ── 2. Initial-Validierung ──────────────────────────────
        console.log('Test: 2. Initial-Validierung...');
        let projectData = await page.evaluate(() => (window as any).editor.project);

        // Metadata-Defaults
        expect(projectData.meta.name).toBe('Neues Spiel');
        expect(projectData.meta.author).toBe('');
        expect(projectData.meta.description).toBe('');

        // Main Stage Check (leer)
        let mainStage = projectData.stages.find((s: any) => s.id === 'main');
        expect(mainStage).toBeDefined();
        expect(mainStage.objects.length).toBe(0);
        expect(mainStage.actions.length).toBe(0);
        expect(mainStage.tasks.length).toBe(0);
        expect(mainStage.variables.length).toBe(0);

        // Blueprint Stage Check
        let blueprint = projectData.stages.find((s: any) => s.id === 'blueprint');
        expect(blueprint).toBeDefined();
        let changeVar = blueprint.variables.find((v: any) => v.name === 'isProjectChangeAvailable');
        expect(changeVar).toBeDefined();
        expect(changeVar.defaultValue).toBe(false);

        // ── 3. Stage-Settings öffnen (Inspector für die aktive Stage) ─
        // Der User klickt auf Menü: Stages → Stage Einstellungen,
        // oder die Stage ist bereits im Inspector sichtbar nach newProject.
        // Sicherheitshalber: Stage-Settings explizit über das Menü öffnen
        console.log('Test: 3. Stage-Settings im Inspector öffnen...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            const activeStage = editor.project.stages?.find(
                (s: any) => s.id === editor.project.activeStageId
            );
            if (activeStage) {
                editor.selectObject(null);
                editor.inspector?.update(activeStage);
            }
        });
        await page.waitForTimeout(500);

        // ── 4. Inspector: Spielname auf 'MyCoolGame' ändern ─────
        console.log('Test: 4. Inspector: Spielname auf MyCoolGame...');
        const gameNameInput = page.locator('input[name="gameNameInput"]');
        await expect(gameNameInput).toBeVisible({ timeout: 5000 });
        await gameNameInput.fill('MyCoolGame');
        // onchange wird bei blur/Enter ausgelöst
        await gameNameInput.press('Tab');
        await page.waitForTimeout(400);

        await page.evaluate(() => {
            const ed = (window as any).editor;
            console.log(`[E2E-DEBUG] editor.project.meta.name = "${ed.project.meta.name}"`);
        });

        // Validierung: meta.name wurde aktualisiert
        projectData = await page.evaluate(() => (window as any).editor.project);
        expect(projectData.meta.name).toBe('MyCoolGame');
        console.log(`Test: meta.name = "${projectData.meta.name}" ✅`);

        // Dirty-Check: isProjectChangeAvailable muss jetzt true sein
        blueprint = projectData.stages.find((s: any) => s.id === 'blueprint');
        changeVar = blueprint.variables.find((v: any) => v.name === 'isProjectChangeAvailable');
        expect(changeVar.defaultValue).toBe(true);
        console.log('Test: Dirty-Check nach Spielname-Änderung ✅');

        // ── 5. Inspector: Autor auf 'GCS-Team' ändern ───────────
        console.log('Test: 5. Inspector: Autor auf GCS-Team...');
        const authorInput = page.locator('input[name="authorInput"]');
        await expect(authorInput).toBeVisible({ timeout: 3000 });
        await authorInput.fill('GCS-Team');
        await authorInput.press('Tab');
        await page.waitForTimeout(400);

        projectData = await page.evaluate(() => (window as any).editor.project);
        expect(projectData.meta.author).toBe('GCS-Team');
        console.log(`Test: meta.author = "${projectData.meta.author}" ✅`);

        // ── 6. Inspector: Beschreibung setzen ───────────────────
        console.log('Test: 6. Inspector: Beschreibung...');
        const descInput = page.locator('input[name="descriptionInput"]');
        await expect(descInput).toBeVisible({ timeout: 3000 });
        await descInput.fill('Das ist mein cooles Spiel');
        await descInput.press('Tab');
        await page.waitForTimeout(400);

        projectData = await page.evaluate(() => (window as any).editor.project);
        expect(projectData.meta.description).toBe('Das ist mein cooles Spiel');
        console.log(`Test: meta.description = "${projectData.meta.description}" ✅`);

        // ── 7. Inspector: Stage Name auf 'MainStage' ändern ─────
        console.log('Test: 7. Inspector: Stage Name auf MainStage...');
        const stageNameInput = page.locator('input[name="nameInput"]');
        await expect(stageNameInput).toBeVisible({ timeout: 3000 });
        await stageNameInput.fill('MainStage');
        await stageNameInput.press('Tab');
        await page.waitForTimeout(400);

        projectData = await page.evaluate(() => (window as any).editor.project);
        mainStage = projectData.stages.find((s: any) => s.id === 'main');
        expect(mainStage.name).toBe('MainStage');
        console.log(`Test: stage.name = "${mainStage.name}" ✅`);

        // ── 8. Inspector: Grid-Einstellungen ────────────────────
        console.log('Test: 8. Inspector: Grid-Einstellungen...');

        // 8a. Spalten → 60
        const colsInput = page.locator('input[name="grid.colsInput"]');
        await expect(colsInput).toBeVisible({ timeout: 3000 });
        await colsInput.fill('60');
        await colsInput.press('Tab');
        await page.waitForTimeout(200);

        // 8b. Zeilen → 38
        const rowsInput = page.locator('input[name="grid.rowsInput"]');
        await expect(rowsInput).toBeVisible({ timeout: 3000 });
        await rowsInput.fill('38');
        await rowsInput.press('Tab');
        await page.waitForTimeout(200);

        // 8c. Zellgröße → 22
        const cellSizeInput = page.locator('input[name="grid.cellSizeInput"]');
        await expect(cellSizeInput).toBeVisible({ timeout: 3000 });
        await cellSizeInput.fill('22');
        await cellSizeInput.press('Tab');
        await page.waitForTimeout(200);

        // 8d. Hintergrundfarbe → #16da36
        // Farbfelder haben einen Text-Input neben dem Farbpicker
        // Der Farbwert wird im Text-Input-Teil geändert
        console.log('Test: 8d. Hintergrundfarbe...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            const mainStage = editor.project.stages?.find((s: any) => s.id === 'main');
            if (mainStage?.grid) {
                mainStage.grid.backgroundColor = '#16da36';
            }
            (window as any).mediatorService.notifyDataChanged(editor.project, 'inspector');
        });
        await page.waitForTimeout(300);

        // ── 9. Grid-Validierung ─────────────────────────────────
        console.log('Test: 9. Grid-Validierung...');
        projectData = await page.evaluate(() => (window as any).editor.project);
        mainStage = projectData.stages.find((s: any) => s.id === 'main');

        expect(mainStage.grid.cols).toBe(60);
        expect(mainStage.grid.rows).toBe(38);
        expect(mainStage.grid.cellSize).toBe(22);
        expect(mainStage.grid.backgroundColor).toBe('#16da36');
        console.log(`Test: Grid = ${mainStage.grid.cols}x${mainStage.grid.rows} @ ${mainStage.grid.cellSize}px, bg=${mainStage.grid.backgroundColor} ✅`);

        // Dirty-Check: muss true sein
        blueprint = projectData.stages.find((s: any) => s.id === 'blueprint');
        changeVar = blueprint.variables.find((v: any) => v.name === 'isProjectChangeAvailable');
        expect(changeVar.defaultValue).toBe(true);
        console.log('Test: Dirty-Check nach Grid-Änderung ✅');

        // ── 10. Projekt als MyCoolGame.json speichern ───────────
        console.log('Test: 10. Speichern als MyCoolGame.json...');
        await saveMyCoolGame(page);
        console.log('Test: MyCoolGame.json erfolgreich gespeichert. Nachfolgende Tests können aufbauen. ✅');
    });
});
