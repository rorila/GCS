import { Logger } from '../utils/Logger';
import type { Editor } from './Editor';
import { NotificationToast } from './ui/NotificationToast';
import { fetchDiskProject, stampDiskProject, isServerManagedPath } from './services/DiskRevisionGuard';

export class EditorSessionManager {
    private static logger = Logger.get('EditorSessionManager', 'Session');
    private editor: Editor;

    constructor(editor: Editor) {
        this.editor = editor;
    }

    /**
     * Stellt den Browserstand nur wieder her, wenn die Platten-Datei nicht extern geändert wurde.
     * Inhalt + Revision werden atomar über /api/dev/project-file aus game-server/public gelesen.
     * NIE fetch('/projects/…') verwenden: das beantwortet Vite aus dem Root-Ordner public/.
     * Fällt die Prüfung aus, wird der Browserstand zwar geladen, der Disk-AutoSave bleibt aber
     * bis zur Revisionsprüfung im Loader gesperrt (DiskRevisionGuard).
     */
    private async restoreSafely(project: any, savedAt: number, sourcePath: string): Promise<void> {
        if (isServerManagedPath(sourcePath)) {
            try {
                const disk = await fetchDiskProject(sourcePath);
                const knownRevision = project.meta?._diskRevision || null;
                const diskChanged = disk.exists && (knownRevision ? disk.revision !== knownRevision : disk.mtimeMs > savedAt);
                if (diskChanged) {
                    const diskProject = stampDiskProject(disk, sourcePath);
                    if (!diskProject) throw new Error('Plattenstand ohne Inhalt');
                    this.editor.loadProject(diskProject, sourcePath);
                    this.editor.themeStageService.restoreSession();
                    NotificationToast.show('Neuere Projektdatei erkannt. Der Stand von der Platte wurde geladen; der alte Browserstand wurde nicht gespeichert.', 'warning');
                    EditorSessionManager.logger.warn(`Browserstand verworfen, da die Plattenrevision von ${sourcePath} abweicht.`);
                    return;
                }
            } catch (err) {
                EditorSessionManager.logger.warn('Startprüfung der Projektdatei nicht möglich; Disk-AutoSave bleibt bis zur Revisionsprüfung gesperrt.', err);
            }
        }
        this.editor.loadProject(project, sourcePath);
        this.editor.themeStageService.restoreSession();
    }

    public async tryRestoreLastSession() {
        if (window.location.search.includes('e2e=true')) {
            EditorSessionManager.logger.info('E2E mode detected: skipping session restoration');
            return;
        }

        // 1. IndexedDB-Projekt lesen (neuer primärer Speicherort seit v3.32.0)
        try {
            const { IndexedDBAdapter } = await import('../adapters/IndexedDBAdapter');
            const idb = new IndexedDBAdapter();
            if (idb.isAvailable()) {
                const record = await idb.loadWithMetadata();
                const idbProject = record?.project;
                if (idbProject) {
                    const name = (idbProject as any).meta?.name || 'Unbenannt';
                    const sourcePath = (idbProject as any).meta?._sourcePath || `projects/${name.replace(/[^a-zA-Z0-9_\\-]/g, '_')}.json`;
                    await this.restoreSafely(idbProject, record?.savedAt || 0, sourcePath);
                    EditorSessionManager.logger.info(`Projekt aus IndexedDB geladen: "${name}" (Pfad: ${sourcePath})`);
                    // Alten LocalStorage-Eintrag aufräumen (Migration)
                    localStorage.removeItem('gcs_last_project');
                    return;
                }
            }
        } catch (err) {
            EditorSessionManager.logger.warn('IndexedDB-Restore fehlgeschlagen, versuche LocalStorage-Fallback:', err);
        }

        // 2. Fallback: Altes LocalStorage-Projekt (Migration)
        const localJson = localStorage.getItem('gcs_last_project');
        let localProject: any = null;
        if (localJson) {
            try {
                localProject = JSON.parse(localJson);
            } catch (err) {
                EditorSessionManager.logger.warn('LocalStorage project parse error, ignoring', err);
            }
        }

        if (localProject) {
            const name = localProject.meta?.name || 'Unbenannt';
            const sourcePath = localProject.meta?._sourcePath || `projects/${(localProject.meta?.name || 'Unbenannt').replace(/[^a-zA-Z0-9_\\-]/g, '_')}.json`;
            await this.restoreSafely(localProject, 0, sourcePath);
            EditorSessionManager.logger.info(`Projekt aus LocalStorage migriert: "${name}" (Pfad: ${sourcePath})`);
            // Nach erfolgreicher Migration: LocalStorage-Eintrag entfernen
            localStorage.removeItem('gcs_last_project');
            return;
        }

        // 3. Kein Projekt gefunden → neues leeres Projekt
        EditorSessionManager.logger.info('Kein gespeichertes Projekt gefunden → neues leeres Projekt');
        this.editor.switchView('stage');
    }
}
