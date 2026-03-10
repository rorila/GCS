import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { GAME_NAME, STAGE_NAME, FILE_PATH } from './helpers/loadMyCoolGame';

/**
 * UseCase: Projekt speichern (Abschluss-Validierung der Integrationssuite)
 *
 * Vorbedingungen:
 * - ProjectCreation.spec.ts wurde ausgeführt → MyCoolGame.json existiert mit:
 *   - meta.name = 'MyCoolGame', MainStage, Autor 'GCS-Team'
 * - TaskRenaming.spec.ts wurde ausgeführt → SwitchToTheHighscoreStage in MainStage
 * - ActionRenaming.spec.ts wurde ausgeführt → ShowTheHighscoreStage in MainStage
 * - TaskActionLinking.spec.ts wurde ausgeführt → ShowTheHighscoreStage in actionSequence von SwitchToTheHighscoreStage
 *
 * Schritte:
 * 1. Datei MyCoolGame.json existiert auf Disk
 * 2. Dateiinhalt: meta.name, MainStage, Autor, Beschreibung, Grid-Einstellungen
 * 3. SwitchToTheHighscoreStage in MainStage.tasks vorhanden
 * 4. ShowTheHighscoreStage in MainStage.actions vorhanden
 * 5. ShowTheHighscoreStage in SwitchToTheHighscoreStage.actionSequence vorhanden (= Verbindung wurde gespeichert)
 * 6. isProjectChangeAvailable = false (= wurde sauber gespeichert)
 */
test.describe('UseCase: Projekt speichern – Abschluss-Validierung', () => {
    test.describe.configure({ mode: 'serial' });

    test('Round-Trip: MyCoolGame.json auf Disk vollständig validieren', async ({ page }) => {
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);

        // 1. Datei existiert?
        console.log(`[Test] Prüfe Datei: ${FILE_PATH}`);
        expect(fs.existsSync(FILE_PATH)).toBe(true);

        const fileContent = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
        console.log('[Test] Datei erfolgreich gelesen.');

        // 2. Meta-Daten validieren
        console.log('[Test] 2. Meta-Daten...');
        expect(fileContent.meta.name).toBe(GAME_NAME);
        expect(fileContent.meta.author).toBe('GCS-Team');
        expect(fileContent.meta.description).toBe('Das ist mein cooles Spiel');
        console.log(`[Test] Spielname: "${fileContent.meta.name}" ✅`);

        // 3. MainStage prüfen
        console.log('[Test] 3. MainStage...');
        const mainStage = fileContent.stages?.find((s: any) => s.id === 'main');
        expect(mainStage).toBeDefined();
        expect(mainStage.name).toBe(STAGE_NAME);
        console.log(`[Test] Stage-Name: "${mainStage.name}" ✅`);

        // 4. Grid-Einstellungen
        console.log('[Test] 4. Grid-Einstellungen...');
        expect(mainStage.grid?.cols).toBe(60);
        expect(mainStage.grid?.rows).toBe(38);
        expect(mainStage.grid?.cellSize).toBe(22);
        expect(mainStage.grid?.backgroundColor).toBe('#16da36');
        console.log(`[Test] Grid: ${mainStage.grid?.cols}x${mainStage.grid?.rows} @ ${mainStage.grid?.cellSize}px ✅`);

        // 5. SwitchToTheHighscoreStage finden (kann in project.tasks oder stage.tasks liegen)
        console.log('[Test] 5. SwitchToTheHighscoreStage...');
        const SwitchToTheHighscoreStage = fileContent.tasks?.find((t: any) => t.name === 'SwitchToTheHighscoreStage')
            || mainStage?.tasks?.find((t: any) => t.name === 'SwitchToTheHighscoreStage');
        expect(SwitchToTheHighscoreStage).toBeDefined();
        console.log(`[Test] SwitchToTheHighscoreStage gefunden: ${JSON.stringify(SwitchToTheHighscoreStage?.name)} ✅`);

        // 6. ShowTheHighscoreStage finden (kann in project.actions oder stage.actions liegen)
        console.log('[Test] 6. ShowTheHighscoreStage...');
        const ShowTheHighscoreStage = fileContent.actions?.find((a: any) => a.name === 'ShowTheHighscoreStage')
            || mainStage?.actions?.find((a: any) => a.name === 'ShowTheHighscoreStage');
        expect(ShowTheHighscoreStage).toBeDefined();
        console.log(`[Test] ShowTheHighscoreStage gefunden: ${JSON.stringify(ShowTheHighscoreStage?.name)} ✅`);

        // 7. ShowTheHighscoreStage in actionSequence von SwitchToTheHighscoreStage (Verbindung wurde gespeichert)
        console.log('[Test] 7. actionSequence: ShowTheHighscoreStage in SwitchToTheHighscoreStage...');
        const actionInSequence = SwitchToTheHighscoreStage?.actionSequence?.find((a: any) => a.name === 'ShowTheHighscoreStage');
        console.log(`[Test] actionSequence: ${JSON.stringify(SwitchToTheHighscoreStage?.actionSequence)}`);
        expect(actionInSequence).toBeDefined();
        console.log('[Test] ShowTheHighscoreStage ist in actionSequence von SwitchToTheHighscoreStage ✅');

        // 8. isProjectChangeAvailable = false (sauber gespeichert)
        console.log('[Test] 8. isProjectChangeAvailable...');
        const blueprint = fileContent.stages?.find((s: any) => s.type === 'blueprint');
        const changeVar = blueprint?.variables?.find((v: any) => v.name === 'isProjectChangeAvailable');
        console.log(`[Test] isProjectChangeAvailable.defaultValue: ${changeVar?.defaultValue}`);
        expect(changeVar?.defaultValue).toBe(false);
        console.log('[Test] isProjectChangeAvailable = false ✅');

        console.log('[Test] ===== Abschluss-Validierung erfolgreich! =====');
        console.log(`[Test] Datei: ${FILE_PATH}`);
        console.log(`[Test] Spielname: ${fileContent.meta.name}`);
        console.log(`[Test] Stage: ${mainStage.name}`);
        console.log(`[Test] SwitchToTheHighscoreStage→ShowTheHighscoreStage Verbindung: ✅`);
    });
});
