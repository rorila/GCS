import { projectPersistenceService } from '../../services/ProjectPersistenceService';
import { PromptDialog } from '../ui/PromptDialog';
import { SaveAsDialog } from '../SaveAsDialog';
import { NotificationToast } from '../ui/NotificationToast';
import { safeDeepCopy } from '../../utils/DeepCopy';
import { Logger } from '../../utils/Logger';
import type { EditorDataManager, EditorDataHost } from './EditorDataManager';

export class EditorProjectSaver {
    private manager: EditorDataManager;
    private logger = Logger.get('EditorDataManager', 'Project_Save_Load');

    private get host(): EditorDataHost {
        return this.manager.getHost();
    }

    constructor(manager: EditorDataManager) {
        this.manager = manager;
    }

    /**
     * Aktualisiert die Pfad-Anzeige in der Menüleiste
     */
    public updateProjectPathDisplay(): void {
        const menuBar = (this.host as any).menuBar;
        if (menuBar && typeof menuBar.setInfoText === 'function') {
            let path = this.manager.currentSavePath || '(nicht gespeichert)';
            let prefix = 'AutoSave-Ziel';

            const isElectron = !!(window as any).electronFS;
            const hasNativeHandle = !!this.manager.currentFileHandle;

            if (isElectron && this.manager.currentSavePath) {
                path = this.manager.currentSavePath;
                prefix = 'AutoSave-Ziel (Electron)';
            } else if (hasNativeHandle) {
                path = this.manager.currentFileHandle.name;
                prefix = 'AutoSave-Ziel (Lokal)';
            } else {
                // Browser-Fallback
                const sourcePath = this.host.project?.meta?._sourcePath || 'projects/project.json';
                path = `game-server/public/${sourcePath}`;
                prefix = 'AutoSave-Ziel (Dev-Server)';
            }

            menuBar.setInfoText(`${prefix}: ${path}`);
        }
    }

    public async saveProject(): Promise<void> {
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
                this.logger.info('[SaveProject] Speichern abgebrochen (kein Name eingegeben)');
                return;
            }
            // Sicheren Dateinamen erstellen
            const safeName = projectName.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_');
            if (!project.meta) (project as any).meta = {};
            project.meta._sourcePath = `projects/${safeName}.json`;
            project.meta.name = projectName;
            this.logger.info(`[SaveProject] Neuer Projektpfad: ${project.meta._sourcePath}`);
        }

        // 1. Lokaler Download / Storage Sync
        await projectPersistenceService.saveProject(project);

        // 2. Server-seitige Persistenz (Disk)
        try {
            const res = await fetch('/api/dev/save-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectData: this.host.project, filePath: this.manager.currentSavePath, expectedRevision: this.manager.diskRevision })
            });
            const data = await res.json();
            if (data.success) {
                this.acceptDiskRevision(data.revision);
                this.host.isProjectDirty = false;
                NotificationToast.show('Projekt erfolgreich gespeichert und auf Disk persistiert!', 'success');
            } else if (data.conflict || res.status === 409) {
                this.blockOnConflict();
            } else {
                NotificationToast.show('Fehler beim Speichern auf Disk: ' + (data.error || 'Unbekannter Fehler'), 'error');
            }
        } catch (err) {
            this.logger.error('Kritischer Fehler beim Server-Save:', err);
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
            this.logger.info(`[UseCase: Projekt speichern] Abbruch: ${msg}`);
            if (overwriteConfirmed === undefined) NotificationToast.show(msg, 'warning');
            return { success: false, message: msg };
        }

        // --- Schritt 2: Spielname prüfen ---
        const mainStage = this.host.project.stages?.find((s: any) => s.id === 'main');
        const gameName = (this.host.project.meta as any)?.name || mainStage?.name || '';

        if (!gameName || gameName === 'Haupt-Level') {
            const msg = 'Bitte ändern Sie den Spielnamen in der Main-Stage';
            this.logger.info(`[UseCase: Projekt speichern] Abbruch: ${msg}`);
            if (overwriteConfirmed === undefined) NotificationToast.show(msg, 'warning');
            return { success: false, message: msg };
        }

        // --- Schritt 3: Pfad-Konstruktion und Datei-Existenz-Prüfung ---
        // Spielname bereinigen (Sonderzeichen entfernen, für Dateiname geeignet)
        const safeGameName = gameName.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_');
        // Pfad: Ordner aus currentSavePath übernehmen, Dateiname IMMER aus aktuellem meta.name
        let targetFilePath: string;
        const previousSavePath = this.manager.currentSavePath;
        if (this.manager.currentSavePath) {
            // Bullet-proof Sanitization: Falls dirty state noch projects/C:/... enthält
            // und konvertiere alle Backslashes zu Forward-Slashes für sichere Pfadoperationen
            let sanitizedPath = this.manager.currentSavePath.replace(/\\/g, '/').replace(/^(?:projects\/)+([a-zA-Z]:\/)/, '$1');

            // Ordner-Anteil beibehalten, Dateiname aus meta.name
            const folder = sanitizedPath.substring(0, sanitizedPath.lastIndexOf('/'));
            targetFilePath = `${folder}/${safeGameName}.json`;
            // currentSavePath aktualisieren damit er konsistent bleibt
            this.manager.currentSavePath = targetFilePath;

            // SECURITY ALLOW NATIVE PATH: Falls sich der Dateiname geändert hat (weil meta.name geändert wurde),
            // müssen wir den neuen berechneten Pfad in Electron explizit erlauben.
            if ((window as any).electronFS && typeof (window as any).electronFS.allowPath === 'function') {
                (window as any).electronFS.allowPath(this.manager.currentSavePath).catch((e: any) => this.logger.warn('Failed to allow path:', e));
            }
        } else {
            targetFilePath = `projects/master_test/${safeGameName}.json`;
            this.manager.currentSavePath = targetFilePath;
        }
        if (previousSavePath !== targetFilePath) {
            // Neuer Zielpfad: Erwartung ist „Datei existiert noch nicht".
            this.manager.diskRevision = null;
            this.manager.diskRevisionReady = true;
            this.manager.diskSaveConflict = false;
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
                this.logger.info(`[UseCase: Projekt speichern] Datei existiert bereits, Server erstellt Backup: ${targetFilePath}`);
            }
        } catch (err) {
            this.logger.warn('[UseCase: Projekt speichern] check-exists fehlgeschlagen (Server nicht erreichbar?), fahre fort mit Speichern:', err);
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
        if (nativeAdapter && overwriteConfirmed === undefined && (this.manager.currentSavePath || this.manager.currentFileHandle)) {
            try {
                // Adapter mit den aktuellen Handles/Pfaden synchronisieren
                if (this.manager.currentSavePath) nativeAdapter.setPath(this.manager.currentSavePath);
                if (this.manager.currentFileHandle) nativeAdapter.setHandle(this.manager.currentFileHandle);

                await nativeAdapter.save(this.host.project);

                setTimeout(() => { this.host.isProjectDirty = false; }, 0);

                const savedPath = nativeAdapter.getPath() || nativeAdapter.getHandle()?.name || this.manager.currentSavePath || 'Lokal';
                const msg = `Nativ gespeichert: ${savedPath}`;
                this.logger.info(`[UseCase: Projekt speichern] ${msg}`);

                if (!this.host.project.meta) (this.host.project as any).meta = {};
                (this.host.project.meta as any)._sourcePath = savedPath;
                this.updateProjectPathDisplay();

                if (overwriteConfirmed === undefined) NotificationToast.show(msg, 'success');
                return { success: true, message: msg };
            } catch (err: any) {
                const nativeErr = err?.message || String(err);
                this.logger.warn(`[UseCase: Projekt speichern] Fehler beim nativen Speichern. Fallback auf Server. Pfad: ${this.manager.currentSavePath}, Fehler: ${nativeErr}`);
                this.host.isProjectDirty = true;

                // Fallback auf Fetch Server API schlägt in Electron meist auch fehl, daher direkt abbrechen und Meldung zeigen
                if ((window as any).electronFS) {
                    const msg = `Sicherheits- oder Schreibfehler in Electron!\nPfad: ${this.manager.currentSavePath}\n\nSystem-Meldung: ${nativeErr}`;
                    if (overwriteConfirmed === undefined) NotificationToast.show(msg, 'error');
                    return { success: false, message: msg };
                }
            }
        }

        try {
            const saveRes = await fetch('/api/dev/save-custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: targetFilePath, projectData: this.host.project, expectedRevision: this.manager.diskRevision })
            });
            const saveData = await saveRes.json();

            if (saveData.success) {
                this.acceptDiskRevision(saveData.revision);
                // Sicherheit: nach potenziellen async DATA_CHANGED Events nochmals zurücksetzen
                setTimeout(() => { this.host.isProjectDirty = false; }, 0);

                const msg = `Projekt erfolgreich gespeichert: ${targetFilePath}`;
                this.logger.info(`[UseCase: Projekt speichern] ${msg}`);
                this.updateProjectPathDisplay();
                if (overwriteConfirmed === undefined) NotificationToast.show(msg, 'success');
                return { success: true, message: msg };
            } else if (saveData.conflict || saveRes.status === 409) {
                this.blockOnConflict();
                this.host.isProjectDirty = true;
                return { success: false, message: 'Speicherkonflikt: Die Datei auf der Platte ist neuer. Bitte das Projekt vom Server neu laden.' };
            } else {
                // Falls Speichern fehl schlägt: Zustand zurücksetzen
                this.host.isProjectDirty = true;
                const msg = `Fehler beim Speichern (Pfad: ${targetFilePath}): ` + (saveData.error || 'Unbekannter Fehler');
                this.logger.error(`[UseCase: Projekt speichern] ${msg}`);
                if (overwriteConfirmed === undefined) NotificationToast.show(msg, 'error');
                return { success: false, message: msg };
            }
        } catch (err: any) {
            // Falls Speichern fehl schlägt: Zustand zurücksetzen
            this.host.isProjectDirty = true;
            const msg = `Kritischer Fehler beim Speichern.\n\nPfad: ${targetFilePath}\nInterner Pfad: ${this.manager.currentSavePath}\nFehler: ${err?.message || String(err)}`;
            this.logger.error(`[UseCase: Projekt speichern] Fehler:`, err);
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
                this.manager.currentSavePath = combinedPath.replace(/\\/g, '/');
                this.manager.currentFileHandle = newHandle;
                this.manager.diskRevision = null;
                this.manager.diskRevisionReady = true;
                this.manager.diskSaveConflict = false;

                const fileBaseName = (newPath?.replace(/^.*[\\/]/, '') || newHandle?.name || '').replace('.json', '');
                if (!this.host.project.meta) (this.host.project as any).meta = {};
                (this.host.project.meta as any).name = fileBaseName;
                (this.host.project.meta as any)._sourcePath = this.manager.currentSavePath;

                this.host.isProjectDirty = true; // erzwingt Check-Bypass in saveProjectToFile
                return this.saveProjectToFile();
            } catch (err: any) {
                if (err.name === 'AbortError') return { success: false, message: 'Speichern abgebrochen' };
                this.logger.warn('FS SaveAPI fehlgeschlagen:', err);
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
        this.manager.currentFileHandle = null; // Auf Server gespeichert, lokales Handle verwerfen
        this.manager.currentSavePath = `projects/${result.folder}/${result.filename}`;
        this.manager.diskRevision = null;
        this.manager.diskRevisionReady = true;
        this.manager.diskSaveConflict = false;

        // Dirty-Flag forcieren, damit saveProjectToFile den Änderungs-Check übergeht
        this.host.isProjectDirty = true;

        // An bestehende Speicher-Logik delegieren
        return this.saveProjectToFile();
    }

    public autoSaveToLocalStorage(): void {
        this.host.syncStageObjectsToProject();
        this.updateProjectJSON();

        // Dirty-Markierung: Nur wenn seit dem Laden mehr als 2 Sekunden vergangen sind.
        // Post-Load-Events (Render, Inspector) feuern in den ersten ~1s nach loadProject.
        // Echte User-Änderungen (Drag, Property-Edit) kommen erst danach.
        const timeSinceLoad = Date.now() - this.manager.loadedAt;
        if (timeSinceLoad > 2000) {
            this.host.isProjectDirty = true;
        }

        const globalVarCount = (this.host.project.variables || []).length;
        const totalStageVarCount = (this.host.project.stages || []).reduce((acc, s) => acc + (s.variables?.length || 0), 0);
        this.logger.debug(`autoSaveToLocalStorage triggered (Global Vars: ${globalVarCount}, Stage Vars: ${totalStageVarCount})`);
    }

    private notifyAutosaveSuccess(): void {
        this.manager.autoSaveCount++;
        const menuBar = (this.host as any).menuBar;
        if (menuBar && typeof menuBar.setAutosaveCount === 'function') {
            menuBar.setAutosaveCount(this.manager.autoSaveCount);
        }
    }

    private acceptDiskRevision(revision: string | null | undefined): void {
        if (revision === undefined) return;
        this.manager.diskRevision = revision;
        this.manager.diskRevisionReady = true;
        this.manager.diskSaveConflict = false;
        if (!this.host.project.meta) this.host.project.meta = {} as any;
        (this.host.project.meta as any)._diskRevision = revision;
        projectPersistenceService.autoSaveToLocalStorage(this.host.project);
    }

    private blockOnConflict(): void {
        this.manager.diskSaveConflict = true;
        this.host.isProjectDirty = true;
        NotificationToast.show('AutoSave gestoppt: Die Projektdatei wurde außerhalb dieses Browserstands geändert. Bitte „Vom Server neu laden (Force)“ verwenden.', 'error');
        this.logger.warn('[AutoSave] Schreibkonflikt erkannt; weitere Disk-Saves sind gesperrt.');
    }

    private performDiskSave(): void {
        if (!this.host.project) return;
        if (this.manager.diskSaveConflict) return;
        if (!this.manager.diskRevisionReady) {
            this.logger.warn('[AutoSave] Übersprungen: Dateirevision ist noch nicht sicher bekannt.');
            return;
        }

        const nativeAdapter = projectPersistenceService.getNativeAdapter();

        const tryFetchFallback = () => {
            if (!(window as any).electronFS) {
                fetch('/api/dev/save-project', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectData: this.host.project, filePath: this.manager.currentSavePath, expectedRevision: this.manager.diskRevision })
                }).then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            this.acceptDiskRevision(data.revision);
                            this.logger.debug(`[PERSISTENT] Dev-Server Fallback erfolgreich.`);
                            this.notifyAutosaveSuccess();
                        } else if (data.conflict) {
                            this.blockOnConflict();
                        }
                    })
                    .catch(err => {
                        this.logger.debug(`Dev-Server Fallback nicht erreichbar.`, err);
                    });
            }
        };

        if (nativeAdapter && (this.manager.currentSavePath || this.manager.currentFileHandle)) {
            if (this.manager.currentSavePath) nativeAdapter.setPath(this.manager.currentSavePath);
            if (this.manager.currentFileHandle) nativeAdapter.setHandle(this.manager.currentFileHandle);

            nativeAdapter.autoSave(this.host.project).then(success => {
                if (success) {
                    this.notifyAutosaveSuccess();
                } else {
                    tryFetchFallback(); // Native AutoSave fehlgeschlagen oder Handle fehlt (Browser Mode), versuche Dev-Server Backup
                }
            }).catch(err => {
                this.logger.warn(`Fehler beim automatischen NativeAdapter Background-Save:`, err);
                tryFetchFallback();
            });
        } else if ((window as any).electronFS && this.manager.currentSavePath) {
            (window as any).electronFS.writeFile(this.manager.currentSavePath, JSON.stringify(this.host.project, null, 2))
                .then(() => {
                    this.logger.debug(`[PERSISTENT] AutoSave Electron erfolgreich.`);
                    this.notifyAutosaveSuccess();
                })
                .catch((err: any) => {
                    this.logger.warn(`Fehler beim automatischen nativem Disk-Save:`, err);
                });
        } else {
            tryFetchFallback();
        }
    }

    private normalizeSourcePath(): void {
        if (!this.host.project) return;
        const name = this.host.project.meta?.name || 'project';
        const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const relativePath = `projects/${safeName}.json`;
        this.manager.currentSavePath = relativePath;
        if (!this.host.project.meta) this.host.project.meta = {} as any;
        this.host.project.meta._sourcePath = relativePath;
    }

    public updateProjectJSON(): void {
        if (this.host.project) {
            if (!this.host.project.meta) this.host.project.meta = {} as any;
            (this.host.project.meta as any)._diskRevision = this.manager.diskRevision;
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
            const timeSinceLoad = Date.now() - this.manager.loadedAt;
            if (timeSinceLoad < 2000) {
                return;
            }

            // --- CRITICAL AI-GUARD ---
            // DO NOT REMOVE DEBOUNCE TIMER!
            // 3. SSoT & DATEI-PERSISTENZ
            // Dieser Debounce MUSS exakt so auf 1000ms gesetzt bleiben. Das Modul erhält sonst bei DND-Drag oder WYSIWYG
            // bis zu 5 synchrone save-Calls. Die 'Native FileSystem API' blockt parallele Writes hart ab
            // ("The associated file is already being written"), was das Speichern komplett zerstört.

            this.normalizeSourcePath();

            if (this.manager.diskSaveTimer !== null) {
                clearTimeout(this.manager.diskSaveTimer);
            }

            this.manager.diskSaveTimer = setTimeout(() => {
                this.manager.diskSaveTimer = null;
                this.performDiskSave();
            }, 1000);

            this.logger.debug(`[TRACE] updateProjectJSON: LocalStorage synchronisiert. Async Save debounce angestoßen.`);
        }
    }
}
