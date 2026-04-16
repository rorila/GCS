import { coreStore } from '../../services/registry/CoreStore';
import { GameProject } from '../../model/types';
import { ViewType } from '../EditorViewManager';
import { projectPersistenceService } from '../../services/ProjectPersistenceService';

import { mediatorService } from '../../services/MediatorService';
import { dataService } from '../../services/DataService';
import { RefactoringManager } from '../RefactoringManager';
import { hydrateObjects } from '../../utils/Serialization';
import { safeDeepCopy } from '../../utils/DeepCopy';
import { Logger } from '../../utils/Logger';
import { SaveAsDialog } from '../SaveAsDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PromptDialog } from '../ui/PromptDialog';
import { NotificationToast } from '../ui/NotificationToast';

export interface EditorDataHost {
    project: GameProject;
    flowEditor: any;
    stage: any;
    viewManager: any;
    inspector: any;
    dialogManager: any;
    currentView: ViewType;
    workingProjectData: any;
    isProjectDirty: boolean;
    setProject(project: GameProject): void;

    render(): void;
    selectObject(id: string | null): void;
    updateStagesMenu(): void;
    switchView(view: ViewType): void;
    migrateToStages(): void;
    refreshJSONView(): void;
    syncFlowChartsWithActions(): void;
    syncStageObjectsToProject(): void;
    getActiveStage(): any;
    morphVariable(variable: any, newType: any): void;
    setProject(project: GameProject): void;
    stageManager: any;
    commandManager: any;
    menuManager: any;
    objectStore: any;
}

export class EditorDataManager {
    private static logger = Logger.get('EditorDataManager', 'Project_Save_Load');
    private host: EditorDataHost;
    public currentSavePath: string | null = null;
    /** FileSystemFileHandle für nativen Speicher-/Lesezugriff */
    public currentFileHandle: any | null = null;
    /** Zeitpunkt des letzten Projekt-Ladens — autoSave ignoriert die ersten 2s danach. */
    private _loadedAt: number = 0;
    private _autoSaveCount: number = 0;
    private _diskSaveTimer: any = null;

    constructor(host: EditorDataHost) {
        this.host = host;
    }

    /**
     * Aktualisiert die Pfad-Anzeige in der Menüleiste
     */
    public updateProjectPathDisplay(): void {
        const menuBar = (this.host as any).menuBar;
        if (menuBar && typeof menuBar.setInfoText === 'function') {
            let path = this.currentSavePath || '(nicht gespeichert)';
            // Nativer Datei-Handle? Zeige "[Lokal]" Präfix im UI an
            if (this.currentFileHandle) {
                path = `[Lokal] ${this.currentFileHandle.name}`;
            }
            menuBar.setInfoText(`Aktueller Projektpfad: ${path}`);
        }
    }

    public async triggerLoad() {
        if (this.host.isProjectDirty) {
            if (!await ConfirmDialog.show('Sie haben ungespeicherte Änderungen am aktuellen Projekt. Möchten Sie wirklich ein anderes Projekt laden? (Nicht gespeicherte Änderungen gehen verloren)')) {
                return;
            }
        }
        try {
            const result = await projectPersistenceService.triggerLoad();
            if (result) {
                this.currentFileHandle = result.fileHandle || null;

                // Beim Laden über File-Dialog: Den Pfad beibehalten, außer es ist nur ein Dateiname.
                // In Electron erhalten wir hier einen absoluten Pfad, im Web nur einen Dateinamen.
                let sourcePath = result.filename;
                if (!sourcePath.includes('/') && !sourcePath.includes('\\')) {
                    sourcePath = `projects/${result.filename}`;
                }
                EditorDataManager.logger.info(`[triggerLoad] Datei geladen: ${result.filename}, Pfad: ${sourcePath}`);
                this.loadProject(result.data, sourcePath);
            }
        } catch (err) {
            NotificationToast.show('Error loading project: ' + err, 'error');
        }
    }

    public async saveProject() {
        if (this.host.flowEditor) {
            this.host.flowEditor.syncToProjectIfDirty();
            this.host.flowEditor.syncAllTasksFromFlow(this.host.project);
        }

        this.host.syncStageObjectsToProject();

        // Erstes Speichern: Projektname abfragen wenn noch kein _sourcePath
        const project = this.host.project;
        if (!project.meta?._sourcePath) {
            const isE2E = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2e') === 'true';
            const defaultName = project.meta?.name || 'MeinProjekt';
            
            // Im E2E-Modus: kein Dialog, automatisch Projektname setzen
            const projectName = isE2E ? defaultName : await PromptDialog.show('Projektname für das Speichern:', defaultName);
            if (!projectName) {
                EditorDataManager.logger.info('[SaveProject] Speichern abgebrochen (kein Name eingegeben)');
                return;
            }
            // Sicheren Dateinamen erstellen
            const safeName = projectName.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_');
            if (!project.meta) (project as any).meta = {};
            project.meta._sourcePath = `projects/${safeName}.json`;
            project.meta.name = projectName;
            EditorDataManager.logger.info(`[SaveProject] Neuer Projektpfad: ${project.meta._sourcePath}`);
        }

        // 1. Lokaler Download / Storage Sync
        await projectPersistenceService.saveProject(project);

        // 2. Server-seitige Persistenz (Disk)
        try {
            const res = await fetch('/api/dev/save-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.host.project)
            });
            const data = await res.json();
            if (data.success) {
                this.host.isProjectDirty = false;
                NotificationToast.show('Projekt erfolgreich gespeichert und auf Disk persistiert!', 'success');
            } else {
                NotificationToast.show('Fehler beim Speichern auf Disk: ' + (data.error || 'Unbekannter Fehler'), 'error');
            }
        } catch (err) {
            EditorDataManager.logger.error('Kritischer Fehler beim Server-Save:', err);
            NotificationToast.show('Kritischer Fehler beim Speichern auf Disk. Bitte prüfen Sie die Server-Verbindung.', 'error');
        }
    }

    /**
     * Speichert das Projekt gemäß UseCase „Projekt speichern":
     * Schritt 1: isProjectChangeAvailable prüfen
     * Schritt 2: Spielname prüfen (≠ 'Haupt-Level')
     * Schritt 3: Datei-Existenz prüfen + ggf. Überschreiben-Dialog
     * Schritt 4: Speichern via /api/dev/save-custom + isProjectChangeAvailable zurücksetzen
     *
     * @param overwriteConfirmed - für E2E-Tests: Datei-Überschreiben ohne Browser-confirm
     * @returns { success: boolean, message: string }
     */
    public async saveProjectToFile(overwriteConfirmed?: boolean): Promise<{ success: boolean; message: string }> {
        // --- Schritt 1: Änderungsstatus prüfen ---
        // isProjectDirty delegiert auf die Blueprint-Variable 'isProjectChangeAvailable' (SSoT)
        if (!this.host.isProjectDirty) {
            const msg = 'Daten haben sich nicht geändert';
            EditorDataManager.logger.info(`[UseCase: Projekt speichern] Abbruch: ${msg}`);
            if (overwriteConfirmed === undefined) NotificationToast.show(msg, 'warning');
            return { success: false, message: msg };
        }

        // --- Schritt 2: Spielname prüfen ---
        const mainStage = this.host.project.stages?.find((s: any) => s.id === 'main');
        const gameName = (this.host.project.meta as any)?.name || mainStage?.name || '';

        if (!gameName || gameName === 'Haupt-Level') {
            const msg = 'Bitte ändern Sie den Spielnamen in der Main-Stage';
            EditorDataManager.logger.info(`[UseCase: Projekt speichern] Abbruch: ${msg}`);
            if (overwriteConfirmed === undefined) NotificationToast.show(msg, 'warning');
            return { success: false, message: msg };
        }

        // --- Schritt 3: Pfad-Konstruktion und Datei-Existenz-Prüfung ---
        // Spielname bereinigen (Sonderzeichen entfernen, für Dateiname geeignet)
        const safeGameName = gameName.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_');
        // Pfad: Ordner aus currentSavePath übernehmen, Dateiname IMMER aus aktuellem meta.name
        let targetFilePath: string;
        if (this.currentSavePath) {
            // Bullet-proof Sanitization: Falls dirty state noch projects/C:/... enthält
            // und konvertiere alle Backslashes zu Forward-Slashes für sichere Pfadoperationen
            let sanitizedPath = this.currentSavePath.replace(/\\/g, '/').replace(/^(?:projects\/)+([a-zA-Z]:\/)/, '$1');
            
            // Ordner-Anteil beibehalten, Dateiname aus meta.name
            const folder = sanitizedPath.substring(0, sanitizedPath.lastIndexOf('/'));
            targetFilePath = `${folder}/${safeGameName}.json`;
            // currentSavePath aktualisieren damit er konsistent bleibt
            this.currentSavePath = targetFilePath;
            
            // SECURITY ALLOW NATIVE PATH: Falls sich der Dateiname geändert hat (weil meta.name geändert wurde),
            // müssen wir den neuen berechneten Pfad in Electron explizit erlauben.
            if ((window as any).electronFS && typeof (window as any).electronFS.allowPath === 'function') {
                (window as any).electronFS.allowPath(this.currentSavePath).catch((e: any) => EditorDataManager.logger.warn('Failed to allow path:', e));
            }
        } else {
            targetFilePath = `projects/master_test/${safeGameName}.json`;
            this.currentSavePath = targetFilePath;
        }

        try {
            const existsRes = await fetch('/api/dev/check-exists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: targetFilePath })
            });
            const existsData = await existsRes.json();

            if (existsData.exists) {
                // Datei existiert → Server erstellt automatisch ein Backup (.bakN)
                EditorDataManager.logger.info(`[UseCase: Projekt speichern] Datei existiert bereits, Server erstellt Backup: ${targetFilePath}`);
            }
        } catch (err) {
            EditorDataManager.logger.warn('[UseCase: Projekt speichern] check-exists fehlgeschlagen (Server nicht erreichbar?), fahre fort mit Speichern:', err);
            // Kein Abbruch – server könnte nicht laufen; save-custom wird trotzdem versucht
        }

        // --- Schritt 4: Speichern ---
        // Flow-Editor und Stage vor dem Speichern synchronisieren
        // Im E2E-Test-Modus (overwriteConfirmed !== undefined) syncToProject() überspringen,
        // um keine DATA_CHANGED Events auszulösen, die isProjectDirty wieder auf true setzen
        if (overwriteConfirmed === undefined && this.host.flowEditor) {
            this.host.flowEditor.syncToProjectIfDirty();
            this.host.flowEditor.syncAllTasksFromFlow(this.host.project);
        }
        this.host.syncStageObjectsToProject();

        // KRITISCH: isProjectDirty (→ isProjectChangeAvailable) VOR dem JSON.stringify auf false setzen,
        // damit der gespeicherte JSON-Snapshot den korrekten "gespeichert"-Zustand enthält
        
        // Nativer Speicherzugriff (Electron & Web FileSystem Access API per Adapter)
        const nativeAdapter = projectPersistenceService.getNativeAdapter();
        if (nativeAdapter && overwriteConfirmed === undefined && (this.currentSavePath || this.currentFileHandle)) {
            try {
                // Adapter mit den aktuellen Handles/Pfaden synchronisieren
                if (this.currentSavePath) nativeAdapter.setPath(this.currentSavePath);
                if (this.currentFileHandle) nativeAdapter.setHandle(this.currentFileHandle);

                await nativeAdapter.save(this.host.project);
                
                setTimeout(() => { this.host.isProjectDirty = false; }, 0);
                
                const savedPath = nativeAdapter.getPath() || nativeAdapter.getHandle()?.name || this.currentSavePath || 'Lokal';
                const msg = `Nativ gespeichert: ${savedPath}`;
                EditorDataManager.logger.info(`[UseCase: Projekt speichern] ${msg}`);
                
                if (!this.host.project.meta) (this.host.project as any).meta = {};
                (this.host.project.meta as any)._sourcePath = savedPath;
                this.updateProjectPathDisplay();
                
                if (overwriteConfirmed === undefined) NotificationToast.show(msg, 'success');
                return { success: true, message: msg };
            } catch (err: any) {
                const nativeErr = err?.message || String(err);
                EditorDataManager.logger.warn(`[UseCase: Projekt speichern] Fehler beim nativen Speichern. Fallback auf Server. Pfad: ${this.currentSavePath}, Fehler: ${nativeErr}`);
                this.host.isProjectDirty = true;
                
                // Fallback auf Fetch Server API schlägt in Electron meist auch fehl, daher direkt abbrechen und Meldung zeigen
                if ((window as any).electronFS) {
                    const msg = `Sicherheits- oder Schreibfehler in Electron!\nPfad: ${this.currentSavePath}\n\nSystem-Meldung: ${nativeErr}`;
                    if (overwriteConfirmed === undefined) NotificationToast.show(msg, 'error');
                    return { success: false, message: msg };
                }
            }
        }

        try {
            const saveRes = await fetch('/api/dev/save-custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: targetFilePath, projectData: this.host.project })
            });
            const saveData = await saveRes.json();

            if (saveData.success) {
                // Sicherheit: nach potenziellen async DATA_CHANGED Events nochmals zurücksetzen
                setTimeout(() => { this.host.isProjectDirty = false; }, 0);

                const msg = `Projekt erfolgreich gespeichert: ${targetFilePath}`;
                EditorDataManager.logger.info(`[UseCase: Projekt speichern] ${msg}`);
                this.updateProjectPathDisplay();
                if (overwriteConfirmed === undefined) NotificationToast.show(msg, 'success');
                return { success: true, message: msg };
            } else {
                // Falls Speichern fehl schlägt: Zustand zurücksetzen
                this.host.isProjectDirty = true;
                const msg = `Fehler beim Speichern (Pfad: ${targetFilePath}): ` + (saveData.error || 'Unbekannter Fehler');
                EditorDataManager.logger.error(`[UseCase: Projekt speichern] ${msg}`);
                if (overwriteConfirmed === undefined) NotificationToast.show(msg, 'error');
                return { success: false, message: msg };
            }
        } catch (err: any) {
            // Falls Speichern fehl schlägt: Zustand zurücksetzen
            this.host.isProjectDirty = true;
            const msg = `Kritischer Fehler beim Speichern.\n\nPfad: ${targetFilePath}\nInterner Pfad: ${this.currentSavePath}\nFehler: ${err?.message || String(err)}`;
            EditorDataManager.logger.error(`[UseCase: Projekt speichern] Fehler:`, err);
            if (overwriteConfirmed === undefined) NotificationToast.show(msg, 'error');
            return { success: false, message: msg };
        }
    }

    /**
 * "Speichern unter..." — Zeigt SaveAsDialog für Ordner-/Dateiname-Auswahl.
 */
    public async saveProjectAs(): Promise<{ success: boolean; message: string }> {
        const meta = (this.host.project as any).meta || {};
        const currentName = meta.name || 'MeinSpiel';

        // Nativer File Access per Adapter
        const nativeAdapter = projectPersistenceService.getNativeAdapter();
        if (nativeAdapter) {
            // Lösche Handles um einen Dialog zu erzwingen
            nativeAdapter.setPath(null);
            nativeAdapter.setHandle(null);
            
            try {
                await nativeAdapter.save(this.host.project, `${currentName}.json`);
                const newPath = nativeAdapter.getPath();
                const newHandle = nativeAdapter.getHandle();
                
                if (!newPath && !newHandle) {
                    return { success: false, message: 'Speichern abgebrochen' };
                }
                
                let combinedPath = newPath || `projects/${newHandle?.name}`;
                this.currentSavePath = combinedPath.replace(/\\/g, '/');
                this.currentFileHandle = newHandle;
                
                const fileBaseName = (newPath?.replace(/^.*[\\\/]/, '') || newHandle?.name || '').replace('.json', '');
                if (!this.host.project.meta) (this.host.project as any).meta = {};
                (this.host.project.meta as any).name = fileBaseName;
                (this.host.project.meta as any)._sourcePath = this.currentSavePath;
                
                this.host.isProjectDirty = true; // erzwingt Check-Bypass in saveProjectToFile
                return this.saveProjectToFile();
            } catch (err: any) {
                if (err.name === 'AbortError') return { success: false, message: 'Speichern abgebrochen' };
                EditorDataManager.logger.warn('FS SaveAPI fehlgeschlagen:', err);
            }
        }

        const result = await SaveAsDialog.show(currentName);
        if (!result) {
            return { success: false, message: 'Speichern abgebrochen' };
        }

        // Spielnamen in project.meta setzen
        const fileBaseName = result.filename.replace('.json', '');
        if (!this.host.project.meta) (this.host.project as any).meta = {};
        (this.host.project.meta as any).name = fileBaseName;

        // Neuen Speicherpfad setzen
        this.currentFileHandle = null; // Auf Server gespeichert, lokales Handle verwerfen
        this.currentSavePath = `projects/${result.folder}/${result.filename}`;

        // Dirty-Flag forcieren, damit saveProjectToFile den Änderungs-Check übergeht
        this.host.isProjectDirty = true;

        // An bestehende Speicher-Logik delegieren
        return this.saveProjectToFile();
    }


    public async exportHTML() {
        if (this.host.flowEditor) this.host.flowEditor.syncAllTasksFromFlow(this.host.project);
        this.host.syncStageObjectsToProject();
        await projectPersistenceService.exportHTML(this.host.project);
    }

    public async exportJSON() {
        if (this.host.flowEditor) this.host.flowEditor.syncAllTasksFromFlow(this.host.project);
        this.host.syncStageObjectsToProject();
        await projectPersistenceService.exportJSON(this.host.project);
    }

    public async exportHTMLCompressed() {
        if (this.host.flowEditor) this.host.flowEditor.syncAllTasksFromFlow(this.host.project);
        this.host.syncStageObjectsToProject();
        await projectPersistenceService.exportHTMLCompressed(this.host.project);
    }

    public async exportJSONCompressed() {
        if (this.host.flowEditor) this.host.flowEditor.syncAllTasksFromFlow(this.host.project);
        this.host.syncStageObjectsToProject();
        await projectPersistenceService.exportJSONCompressed(this.host.project);
    }

    public loadProject(data: any, sourcePath?: string) {
        if (!data) return;

        // Lade-Zeitpunkt merken: autoSaveToLocalStorage ignoriert die ersten 2s danach
        this._loadedAt = Date.now();
        
        // Zähler zurücksetzen bei komplett neuem Projekt-Laden
        this._autoSaveCount = 0;
        const menuBar = (this.host as any).menuBar;
        if (menuBar && typeof menuBar.setAutosaveCount === 'function') {
            menuBar.setAutosaveCount(this._autoSaveCount);
        }

        // Quellpfad setzen — Priorität:
        // 1. Expliziter sourcePath-Parameter (höchste Priorität)
        // 2. _sourcePath aus Projekt-Metadaten (wurde beim letzten Speichern geschrieben)
        // 3. Fallback aus meta.name (letzte Option)
        if (sourcePath) {
            let sp = sourcePath.replace(/\\/g, '/');
            sp = sp.replace(/^(?:projects\/)+([a-zA-Z]:\/)/, '$1');
            this.currentSavePath = sp;
            EditorDataManager.logger.info(`[LoadProject] Quellpfad gesetzt (explizit): ${this.currentSavePath}`);
        } else if (data.meta?._sourcePath) {
            let sp = data.meta._sourcePath.replace(/\\/g, '/');
            // Fehler-Korrektur: Falls in einer älteren Version "projects/C:/..." gespeichert wurde
            sp = sp.replace(/^(?:projects\/)+([a-zA-Z]:\/)/, '$1');
            
            this.currentSavePath = sp;
            EditorDataManager.logger.info(`[LoadProject] Quellpfad aus _sourcePath: ${this.currentSavePath}`);
        } else if (data.meta?.name) {
            // Letzter Fallback: Pfad aus Projektnamen konstruieren
            const safeName = data.meta.name.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_');
            this.currentSavePath = `projects/${safeName}.json`;
            EditorDataManager.logger.info(`[LoadProject] Quellpfad aus meta.name abgeleitet: ${this.currentSavePath}`);
        }

        if (this.currentSavePath) {
            if (!data.meta) data.meta = {};
            data.meta._sourcePath = this.currentSavePath;
            EditorDataManager.logger.info(`[LoadProject] _sourcePath in Metadaten gesetzt: ${this.currentSavePath}`);
            
            // SECURITY ALLOW NATIVE PATH: Der LocalStorage-Pfad muss im Main-Prozess kurz erlaubt werden, 
            // da er sonst bei autoSave() abgelehnt wird (Szenario: Neustart der Electron-App).
            if ((window as any).electronFS && typeof (window as any).electronFS.allowPath === 'function') {
                (window as any).electronFS.allowPath(this.currentSavePath).catch((e: any) => EditorDataManager.logger.warn('Failed to allow path:', e));
            }
        }

        // Reset dirty flag after successful load
        this.host.isProjectDirty = false;

        EditorDataManager.logger.info('Projekt-Ladeprozess gestartet...', data);

        // 1. CLEANUP before load
        localStorage.removeItem('gcs_last_project');

        // 2. DATA PREPARATION (Sanitization & Hydration)
        RefactoringManager.cleanActionSequences(data);

        // Hydrate objects in legacy lists if present
        if (data.objects) data.objects = hydrateObjects(data.objects);
        if (data.variables) data.variables = hydrateObjects(data.variables);
        if (data.splashObjects) data.splashObjects = hydrateObjects(data.splashObjects);

        // Hydrate objects in stages
        if (data.stages) {
            data.stages.forEach((s: any) => {
                if (s.objects) s.objects = hydrateObjects(s.objects);
                if (s.variables) s.variables = hydrateObjects(s.variables);

                // CleanCode Phase 2: Grid-Dimensionen an Objekte vererben (für TWindow.align-Setter)
                const gridCols = s.grid?.cols || data.stage?.grid?.cols || 64;
                const gridRows = s.grid?.rows || data.stage?.grid?.rows || 40;
                if (s.objects) {
                    s.objects.forEach((obj: any) => {
                        obj._gridCols = gridCols;
                        obj._gridRows = gridRows;
                    });
                }

                // Fix: Clean up accidentally saved global variables from non-blueprint stages
                if (s.type !== 'blueprint' && s.variables) {
                    s.variables = s.variables.filter((v: any) => v.scope !== 'global');
                }
            });
        }

        // 3. CENTRAL UPDATE (Replaces reference and notifies managers)
        // Use try-catch because in some Vite HMR/rebuild scenarios, prototype methods
        // may not be available on the host instance
        try {
            this.host.setProject(data);
        } catch (err) {
            EditorDataManager.logger.warn('setProject() unavailable, using direct assignment:', err);
            // Essential fallback: set project reference directly
            (this.host as any).project = data;
            coreStore.setProject(data);
            // Update managers that are accessible
            if (this.host.stageManager) this.host.stageManager.setProject(data);
            if (this.host.dialogManager) this.host.dialogManager.setProject(data);
            if ((this.host as any).inspector?.setProject) (this.host as any).inspector.setProject(data);
            if (this.host.flowEditor?.setProject) this.host.flowEditor.setProject(data);
        }

        // 4. MIGRATIONS (Acts on the new project reference)
        if (!this.host.project.stages || this.host.project.stages.length === 0) {
            this.host.migrateToStages();
        }

        // Deep copy grid to stages if missing
        if (this.host.project.stages) {
            this.host.project.stages.forEach(s => {
                if (!s.grid) {
                    s.grid = JSON.parse(JSON.stringify(this.host.project.stage.grid));
                }
            });
        }

        // MIGRATION: flowChart/flowGraph → flowLayout (Dynamische FlowChart-Generierung)
        // Bestehende FlowChart-Daten werden in kompakte Layout-Positionen konvertiert
        this.migrateFlowChartsToLayout(data);

        // 5. POST-LOAD FIXES
        if (this.host.flowEditor) {
            this.host.flowEditor.cleanCorruptTaskData();
        }
        RefactoringManager.sanitizeProject(this.host.project);

        // 6. SYNC & PERSISTENCE
        this.autoSaveToLocalStorage();

        // 7. AUTO-SEED & DATA ACCESS
        if (typeof window !== 'undefined') {
            const dataStores = this.host.project.objects.filter((o: any) => o.className === 'TDataStore');
            dataStores.forEach((ds: any) => {
                const path = ds.storagePath || 'db.json';
                dataService.seedFromUrl(path, `/api/dev/data/${path}`).then(() => {
                    if (this.host.inspector) this.host.inspector.update();
                });
            });
        }

        // 8. NOTIFICATION
        mediatorService.notifyDataChanged(this.host.project, 'editor-load');

        // KRITISCH: isProjectDirty NACH allen Events auf false setzen
        // setProject() und autoSaveToLocalStorage() lösen DATA_CHANGED aus → isProjectDirty=true
        // Muss deshalb NACH diesen Aufrufen zurückgesetzt werden
        this.host.isProjectDirty = false;
        // Lade-Zeitpunkt aktualisieren → 2s-Cooldown beginnt JETZT (nach allen sync Events)
        this._loadedAt = Date.now();
        setTimeout(() => { this.host.isProjectDirty = false; }, 100);

        setTimeout(() => {
            const toast = this.host.project?.objects.find(o => (o as any).className === 'TToast') as any;
            if (toast && typeof toast.success === 'function') {
                toast.success('Projekt geladen.');
            } else {
                EditorDataManager.logger.info('Project loaded & persisted to LocalStorage');
            }
        }, 500);

        EditorDataManager.logger.info("Projekt erfolgreich geladen.", this.host.project);

        // Stage-Menü nach allen Post-Load-Operationen aktualisieren
        // setProject() ruft updateStagesMenu() auf, aber zu früh (vor async Ops)
        setTimeout(() => {
            this.host.updateStagesMenu();
            this.updateProjectPathDisplay();

            // Stage-Eigenschaften im Inspector anzeigen (nach Projekt-Laden)
            const activeStage = this.host.getActiveStage();
            if (activeStage && this.host.inspector) {
                this.host.inspector.update(activeStage);
            }
        }, 200);
    }

    public autoSaveToLocalStorage() {
        this.host.syncStageObjectsToProject();
        this.updateProjectJSON();

        // Dirty-Markierung: Nur wenn seit dem Laden mehr als 2 Sekunden vergangen sind.
        // Post-Load-Events (Render, Inspector) feuern in den ersten ~1s nach loadProject.
        // Echte User-Änderungen (Drag, Property-Edit) kommen erst danach.
        const timeSinceLoad = Date.now() - this._loadedAt;
        if (timeSinceLoad > 2000) {
            this.host.isProjectDirty = true;
        }

        const globalVarCount = (this.host.project.variables || []).length;
        const totalStageVarCount = (this.host.project.stages || []).reduce((acc, s) => acc + (s.variables?.length || 0), 0);
        EditorDataManager.logger.debug(`autoSaveToLocalStorage triggered (Global Vars: ${globalVarCount}, Stage Vars: ${totalStageVarCount})`);
    }

    private notifyAutosaveSuccess(): void {
        this._autoSaveCount++;
        const menuBar = (this.host as any).menuBar;
        if (menuBar && typeof menuBar.setAutosaveCount === 'function') {
            menuBar.setAutosaveCount(this._autoSaveCount);
        }
    }

    private performDiskSave() {
        if (!this.host.project) return;
        
        const nativeAdapter = projectPersistenceService.getNativeAdapter();
        
        const tryFetchFallback = () => {
            if (!(window as any).electronFS) {
                fetch('/api/dev/save-project', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.host.project)
                }).then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            EditorDataManager.logger.debug(`[PERSISTENT] Dev-Server Fallback erfolgreich.`);
                            this.notifyAutosaveSuccess();
                        }
                    })
                    .catch(err => {
                        EditorDataManager.logger.debug(`Dev-Server Fallback nicht erreichbar.`, err);
                    });
            }
        };

        if (nativeAdapter && (this.currentSavePath || this.currentFileHandle)) {
            if (this.currentSavePath) nativeAdapter.setPath(this.currentSavePath);
            if (this.currentFileHandle) nativeAdapter.setHandle(this.currentFileHandle);
            
            nativeAdapter.autoSave(this.host.project).then(success => {
                if (success) {
                    this.notifyAutosaveSuccess();
                } else {
                    tryFetchFallback(); // Native AutoSave fehlgeschlagen oder Handle fehlt (Browser Mode), versuche Dev-Server Backup
                }
            }).catch(err => {
                EditorDataManager.logger.warn(`Fehler beim automatischen NativeAdapter Background-Save:`, err);
                tryFetchFallback();
            });
        } else if ((window as any).electronFS && this.currentSavePath) {
            (window as any).electronFS.writeFile(this.currentSavePath, JSON.stringify(this.host.project, null, 2))
                .then(() => {
                    EditorDataManager.logger.debug(`[PERSISTENT] AutoSave Electron erfolgreich.`);
                    this.notifyAutosaveSuccess();
                })
                .catch((err: any) => {
                    EditorDataManager.logger.warn(`Fehler beim automatischen nativem Disk-Save:`, err);
                });
        } else {
            tryFetchFallback();
        }
    }

    public updateProjectJSON() {
        if (this.host.project) {
            // 1. In LocalStorage sichern (Crash-Schutz)
            projectPersistenceService.autoSaveToLocalStorage(this.host.project);

            // 2. workingProjectData für JSON-View aktualisieren
            if (this.host.viewManager) {
                this.host.viewManager.workingProjectData = safeDeepCopy(this.host.project);
            }

            // --- CRITICAL AI-GUARD ---
            // DO NOT REMOVE GRACE PERIOD!
            // Ignoriere automatische "Post-Load"-Events (DOM-Rendering) in den ersten 2 Sekunden,
            // da sonst direkt nach dem Laden eine leere Datei geschrieben und der Autosave-Zähler angehoben wird!
            const timeSinceLoad = Date.now() - this._loadedAt;
            if (timeSinceLoad < 2000) {
                return;
            }

            // --- CRITICAL AI-GUARD ---
            // DO NOT REMOVE DEBOUNCE TIMER!
            // 3. SSoT & DATEI-PERSISTENZ 
            // Dieser Debounce MUSS exakt so auf 1000ms gesetzt bleiben. Das Modul erhält sonst bei DND-Drag oder WYSIWYG
            // bis zu 5 synchrone save-Calls. Die 'Native FileSystem API' blockt parallele Writes hart ab 
            // ("The associated file is already being written"), was das Speichern komplett zerstört.
            if (this._diskSaveTimer !== null) {
                clearTimeout(this._diskSaveTimer);
            }
            
            this._diskSaveTimer = setTimeout(() => {
                this._diskSaveTimer = null;
                this.performDiskSave();
            }, 1000);

            EditorDataManager.logger.debug(`[TRACE] updateProjectJSON: LocalStorage synchronisiert. Async Save debounce angestoßen.`);
        }
    }

    public syncStageObjectsToProject() {
        // NEVER save runtime state back to the design project.
        if (this.host.stage && this.host.stage.runMode) {
            EditorDataManager.logger.debug(`SKIPPING syncStageObjectsToProject because we are in RunMode.`);
            return;
        }

        const activeStage = this.host.getActiveStage();
        if (!this.host.stage || !activeStage) return;

        // ARC-FIX: DANGEROUS OVERWRITE REMOVED!
        // We no longer read from `this.host.stageManager.currentObjects()` to overwrite `projectStage.objects`.
        // Doing so caused objects from visually-rendered stages to replace the raw un-resolved JSON templates,
        // which destroyed variable bindings (e.g. converting "\${loginError}" -> "") and intermittently wiped
        // the objects array entirely during automated test runner execution headless mode.
        // InteractionManager, CommandManager and Inspector now correctly update the JSON directly!
        EditorDataManager.logger.debug(`Syncing objects for stage "${activeStage.id}" to project JSON is a NO-OP. (Managed directly in JSON)`);
    }

    public morphVariable(variable: any, newType: any) {
        EditorDataManager.logger.info(`MORPH START: "${variable.name}" (${variable.type} -> ${newType})`);

        // 1. Determine new class name
        const classNameMap: Record<string, string> = {
            'integer': 'TIntegerVariable',
            'real': 'TRealVariable',
            'string': 'TStringVariable',
            'boolean': 'TBooleanVariable',
            'object': 'TObjectVariable',
            'object_list': 'TObjectList',
            'list': 'TListVariable',
            'timer': 'TTimer',
            'threshold': 'TThresholdVariable',
            'trigger': 'TTriggerVariable',
            'random': 'TRandomVariable',
            'range': 'TRangeVariable',
            'keystore': 'TKeyStore'
        };
        const newClassName = classNameMap[newType] || 'TVariable';

        // 2. Create new instance
        const newInstance = this.host.commandManager.createObjectInstance(newClassName, variable.name, (variable as any).x || 0, (variable as any).y || 0);

        if (!newInstance) {
            EditorDataManager.logger.error(`Failed to create instance for morphing to ${newClassName}`);
            return;
        }

        // ARC-FIX: Explicitly set the target type
        (newInstance as any).variableType = newType;

        // 3. Copy State
        newInstance.id = variable.id; // CRITICAL: Keep ID
        newInstance.scope = variable.scope;
        if (variable.events) {
            newInstance.events = { ...variable.events };
        }

        // Data conversion
        if (newType === 'object') {
            newInstance.value = (typeof variable.value === 'object' && variable.value !== null) ? variable.value : {};
        } else {
            newInstance.value = variable.value;
        }

        // 4. Replace in Project/Stage
        let replacedCount = 0;

        // Global list
        const gIdx = this.host.project.variables.findIndex(v => v.id === variable.id);
        if (gIdx !== -1) {
            this.host.project.variables[gIdx] = newInstance;
            replacedCount++;
        }

        // Stage lists
        this.host.project.stages?.forEach(stage => {
            if (stage.variables) {
                const sIdx = stage.variables.findIndex((v: any) => v.id === variable.id);
                if (sIdx !== -1) {
                    if (variable.scope === 'global' && stage.type !== 'blueprint') {
                        stage.variables.splice(sIdx, 1);
                    } else {
                        stage.variables[sIdx] = newInstance as any;
                        replacedCount++;
                    }
                }
            }
        });

        if (replacedCount === 0 && variable.scope === 'global') {
            this.host.project.variables.push(newInstance);
        }

        // 4.1 VERY IMPORTANT: Replace in currentObjects (Live Engine)
        const allObjs = this.host.stageManager.currentObjects();
        const stageObjIdx = allObjs.findIndex((o: any) => o.id === variable.id);
        if (stageObjIdx !== -1) {
            allObjs[stageObjIdx] = newInstance as any;
            this.host.stageManager.setCurrentObjects(allObjs);
            EditorDataManager.logger.info(`SUCCESS: Replaced in currentObjects[${stageObjIdx}] (LIVE ENGINE).`);
        }

        // 5. Update UI
        this.host.commandManager.selectObject(null);
        setTimeout(() => {
            this.host.commandManager.selectObject(newInstance.id);
        }, 50);

        coreStore.setProject(this.host.project);
    }

    public async loadFromServer() {
        if (this.host.isProjectDirty) {
            if (!await ConfirmDialog.show('Sie haben ungespeicherte Änderungen. Möchten Sie wirklich das Projekt vom Server neu laden?')) {
                return;
            }
        }

        try {
            EditorDataManager.logger.info('Force Reload: Fetching project from server...');
            const projectData = await projectPersistenceService.fetchProjectFromServer();

            // Overwrite LocalStorage
            localStorage.setItem('gcs_last_project', JSON.stringify(projectData));

            EditorDataManager.logger.info('Force Reload successful. Reloading page...');
            window.location.reload();
        } catch (err: any) {
            EditorDataManager.logger.error('Force Reload failed:', err);
            NotificationToast.show('Fehler beim Laden vom Server: ' + err.message);
        }
    }

    public async applyJSONChanges(): Promise<void> {
        const confirmed = await ConfirmDialog.show('Möchten Sie die Änderungen am Projekt wirklich übernehmen? Dies kann nicht rückgängig gemacht werden und wird sofort wirksam.');
        if (confirmed && this.host.workingProjectData) {
            // Apply sync to project before loading back
            this.host.syncFlowChartsWithActions();

            this.loadProject(safeDeepCopy(this.host.workingProjectData));
            this.host.isProjectDirty = false;
            this.host.refreshJSONView(); // Hide apply button

            // Notify Mediator that project data has changed via JSON Editor
            mediatorService.notifyDataChanged(this.host.project, 'json-editor');
        }
    }

    /**
     * MIGRATION: Konvertiert bestehende flowChart/flowGraph-Daten in kompakte flowLayout.
     * Wird einmalig beim Laden aufgerufen und entfernt dann die alten Daten.
     */
    private migrateFlowChartsToLayout(data: any): void {
        if (!data.stages) return;

        let migrated = 0;

        data.stages.forEach((stage: any) => {
            // Tasks mit flowChart/flowGraph → flowLayout konvertieren
            if (stage.tasks) {
                stage.tasks.forEach((task: any) => {
                    const source = task.flowChart || task.flowGraph;
                    if (source && source.elements?.length > 0 && !task.flowLayout) {
                        task.flowLayout = {};
                        source.elements.forEach((el: any) => {
                            const name = el.properties?.name || el.data?.name || el.data?.taskName;
                            if (name) {
                                task.flowLayout[name] = { x: el.x, y: el.y };
                            }
                        });
                        migrated++;
                    }
                    // Legacy-Daten entfernen
                    delete task.flowChart;
                    delete task.flowGraph;
                });
            }

            // Stage-Level flowCharts bereinigen (außer 'global')
            if (stage.flowCharts) {
                Object.keys(stage.flowCharts).forEach(key => {
                    if (key !== 'global') {
                        delete stage.flowCharts[key];
                    }
                });
            }
        });

        // Project-Root flowCharts bereinigen (außer 'global')
        if (data.flowCharts) {
            Object.keys(data.flowCharts).forEach((key: string) => {
                if (key !== 'global') {
                    delete data.flowCharts[key];
                }
            });
        }

        if (migrated > 0) {
            EditorDataManager.logger.info(`[Migration] ${migrated} FlowCharts → flowLayout konvertiert.`);
        }
    }
}
