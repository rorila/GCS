import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Gemeinsame Konstanten für die MyCoolGame Integrationssuite
 */
export const GAME_NAME = 'MyCoolGame';
export const STAGE_NAME = 'MainStage';
export const FILE_PATH = path.join(process.cwd(), `projects/master_test/${GAME_NAME}.json`);

/**
 * Lädt MyCoolGame.json vom Dateisystem in den Editor.
 * Wird von allen Tests (außer ProjectCreation) als Setup verwendet.
 */
export async function loadMyCoolGame(page: Page): Promise<void> {
    if (!fs.existsSync(FILE_PATH)) {
        throw new Error(
            `[loadMyCoolGame] Datei nicht gefunden: ${FILE_PATH}\n` +
            `Bitte zuerst ProjectCreation.spec.ts ausführen!`
        );
    }

    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    const data = JSON.parse(raw);

    await page.evaluate((projectData: any) => {
        (window as any).editor.loadProject(projectData);
    }, data);

    // Warten bis Editor das Projekt verarbeitet hat
    await page.waitForTimeout(500);

    console.log(`[loadMyCoolGame] Projekt geladen: ${FILE_PATH}`);
}

/**
 * Speichert das aktuelle Projekt als MyCoolGame.json via Node.js fs.writeFileSync.
 * Unabhängig vom Game-Server (Port 8080).
 * isProjectChangeAvailable und isProjectDirty werden vor dem Lesen auf false gesetzt.
 */
export async function saveMyCoolGame(page: Page): Promise<void> {
    // isProjectChangeAvailable auf false setzen (= gespeicherter Zustand)
    await page.evaluate(() => {
        const editor = (window as any).editor;
        const blueprint = editor.project.stages?.find((s: any) => s.type === 'blueprint');
        const changeVar = blueprint?.variables?.find((v: any) => v.name === 'isProjectChangeAvailable');
        if (changeVar) {
            changeVar.defaultValue = false;
            changeVar.value = false;
        }
        editor.isProjectDirty = false;
    });

    // Projekt-JSON aus dem Browser lesen
    // FlowEditor-Sync analog zu EditorDataManager.saveProject():
    // syncToProjectIfDirty() + syncAllTasksFromFlow() sicherstellen,
    // dass ALLE FlowCharts (inkl. Action-Nodes) korrekt ins Projekt geschrieben werden.
    const projectData = await page.evaluate(() => {
        const editor = (window as any).editor;
        if (editor.flowEditor) {
            editor.flowEditor.syncToProjectIfDirty();
            editor.flowEditor.syncAllTasksFromFlow(editor.project);
        }
        editor.syncStageObjectsToProject?.();
        return JSON.parse(JSON.stringify(editor.project));
    });

    // Direkt auf Disk schreiben (kein API-Server nötig)
    const dir = path.dirname(FILE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify(projectData, null, 2), 'utf-8');

    console.log(`[saveMyCoolGame] Gespeichert: ${FILE_PATH}`);
}
