import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { GAME_NAME, STAGE_NAME, FILE_PATH } from './helpers/loadMyCoolGame';

/**
 * UseCase: Projekt speichern — Abschluss-Validierung
 *
 * Prüft die gespeicherte MyCoolGame.json Datei auf Disk.
 * Kein Browser-UI nötig — reine Datei-Validierung.
 */
test.describe('UseCase: Projekt speichern – Abschluss-Validierung', () => {
    test.describe.configure({ mode: 'serial' });

    test('MyCoolGame.json auf Disk vollständig validieren', async () => {
        // 1. Datei existiert?
        console.log(`[Test] 1. Prüfe Datei: ${FILE_PATH}`);
        expect(fs.existsSync(FILE_PATH)).toBe(true);

        const fileContent = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
        console.log('[Test] Datei erfolgreich gelesen.');

        // 2. Meta-Daten
        console.log('[Test] 2. Meta-Daten...');
        expect(fileContent.meta.name).toBe(GAME_NAME);
        expect(fileContent.meta.author).toBe('GCS-Team');
        expect(fileContent.meta.description).toBe('Das ist mein cooles Spiel');
        console.log(`  Spielname: "${fileContent.meta.name}" ✅`);

        // 3. MainStage
        console.log('[Test] 3. MainStage...');
        const mainStage = fileContent.stages?.find((s: any) => s.id === 'main');
        expect(mainStage).toBeDefined();
        expect(mainStage.name).toBe(STAGE_NAME);
        console.log(`  Stage-Name: "${mainStage.name}" ✅`);

        // 4. Grid-Einstellungen
        console.log('[Test] 4. Grid-Einstellungen...');
        expect(mainStage.grid?.cols).toBe(60);
        expect(mainStage.grid?.rows).toBe(38);
        expect(mainStage.grid?.cellSize).toBe(22);
        console.log(`  Grid: ${mainStage.grid?.cols}x${mainStage.grid?.rows} @ ${mainStage.grid?.cellSize}px ✅`);

        // 5. SwitchToTheHighscoreStage Task
        console.log('[Test] 5. SwitchToTheHighscoreStage...');
        const task = fileContent.tasks?.find((t: any) => t.name === 'SwitchToTheHighscoreStage')
            || mainStage?.tasks?.find((t: any) => t.name === 'SwitchToTheHighscoreStage');
        expect(task).toBeDefined();
        console.log(`  Task gefunden ✅`);

        // 6. ShowTheHighscoreStage Action
        console.log('[Test] 6. ShowTheHighscoreStage...');
        const action = fileContent.actions?.find((a: any) => a.name === 'ShowTheHighscoreStage')
            || mainStage?.actions?.find((a: any) => a.name === 'ShowTheHighscoreStage');
        expect(action).toBeDefined();
        console.log(`  Action gefunden ✅`);

        // 7. actionSequence
        console.log('[Test] 7. actionSequence...');
        const seqAction = task?.actionSequence?.find((a: any) => a.name === 'ShowTheHighscoreStage');
        console.log(`  actionSequence: ${JSON.stringify(task?.actionSequence)}`);
        expect(seqAction).toBeDefined();
        console.log(`  Verbindung ✅`);

        // 8. Alle Stages vorhanden
        console.log('[Test] 8. Alle Stages...');
        const stageNames = fileContent.stages?.map((s: any) => s.name);
        console.log(`  Stages: ${JSON.stringify(stageNames)}`);
        expect(stageNames.length).toBeGreaterThanOrEqual(3); // Blueprint + MainStage + Stage 1

        console.log('[Test] ===== Abschluss-Validierung erfolgreich! =====');
    });
});
