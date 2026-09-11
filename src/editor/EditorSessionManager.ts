import { Logger } from '../utils/Logger';
import type { Editor } from './Editor';

export class EditorSessionManager {
    private static logger = Logger.get('EditorSessionManager', 'Session');
    private editor: Editor;

    constructor(editor: Editor) {
        this.editor = editor;
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
                const idbProject = await idb.load();
                if (idbProject) {
                    const name = (idbProject as any).meta?.name || 'Unbenannt';
                    const sourcePath = (idbProject as any).meta?._sourcePath || `projects/${name.replace(/[^a-zA-Z0-9_\\-]/g, '_')}.json`;
                    this.editor.loadProject(idbProject, sourcePath);
                    this.editor.themeStageService.restoreSession();
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
            this.editor.loadProject(localProject, sourcePath);
            this.editor.themeStageService.restoreSession();
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
