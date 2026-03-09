import { GameProject } from '../../model/types';
import { ViewType } from '../EditorViewManager';
import { projectPersistenceService } from '../../services/ProjectPersistenceService';
import { projectRegistry } from '../../services/ProjectRegistry';
import { mediatorService } from '../../services/MediatorService';
import { dataService } from '../../services/DataService';
import { RefactoringManager } from '../RefactoringManager';
import { hydrateObjects } from '../../utils/Serialization';
import { safeDeepCopy } from '../../utils/DeepCopy';
import { Logger } from '../../utils/Logger';

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
    undoManager: any;
    objectStore: any;
}

export class EditorDataManager {
    private static logger = Logger.get('EditorDataManager', 'Project_Save_Load');
    private host: EditorDataHost;

    constructor(host: EditorDataHost) {
        this.host = host;
    }

    public async triggerLoad() {
        if (this.host.isProjectDirty) {
            if (!confirm("Sie haben ungespeicherte Änderungen am aktuellen Projekt. Möchten Sie wirklich ein anderes Projekt laden? (Nicht gespeicherte Änderungen gehen verloren)")) {
                return;
            }
        }
        try {
            const json = await projectPersistenceService.triggerLoad();
            if (json) {
                this.loadProject(json);
            }
        } catch (err) {
            alert("Error loading project: " + err);
        }
    }

    public async saveProject() {
        if (this.host.flowEditor) {
            this.host.flowEditor.syncToProject();
            this.host.flowEditor.syncAllTasksFromFlow(this.host.project);
        }

        this.host.syncStageObjectsToProject();

        // 1. Lokaler Download / Storage Sync
        await projectPersistenceService.saveProject(this.host.project);

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
                alert('Projekt erfolgreich gespeichert und auf Disk persistiert!');
            } else {
                alert('Fehler beim Speichern auf Disk: ' + (data.error || 'Unbekannter Fehler'));
            }
        } catch (err) {
            EditorDataManager.logger.error('Kritischer Fehler beim Server-Save:', err);
            alert('Kritischer Fehler beim Speichern auf Disk. Bitte prüfen Sie die Server-Verbindung.');
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
        const blueprint = this.host.project.stages?.find((s: any) => s.id === 'blueprint' || s.type === 'blueprint');
        const changeVar = blueprint?.variables?.find((v: any) => v.name === 'isProjectChangeAvailable');
        const hasChanges = changeVar ? !!(changeVar.defaultValue || (changeVar as any).value) : this.host.isProjectDirty;

        if (!hasChanges) {
            const msg = 'Daten haben sich nicht geändert';
            EditorDataManager.logger.info(`[UseCase: Projekt speichern] Abbruch: ${msg}`);
            if (overwriteConfirmed === undefined) alert(msg);
            return { success: false, message: msg };
        }

        // --- Schritt 2: Spielname prüfen ---
        const mainStage = this.host.project.stages?.find((s: any) => s.id === 'main');
        const gameName = mainStage?.name || (this.host.project.meta as any)?.name || '';

        if (!gameName || gameName === 'Haupt-Level') {
            const msg = 'Bitte ändern Sie den Spielnamen in der Main-Stage';
            EditorDataManager.logger.info(`[UseCase: Projekt speichern] Abbruch: ${msg}`);
            if (overwriteConfirmed === undefined) alert(msg);
            return { success: false, message: msg };
        }

        // --- Schritt 3: Pfad-Konstruktion und Datei-Existenz-Prüfung ---
        // Spielname bereinigen (Sonderzeichen entfernen, für Dateiname geeignet)
        const safeGameName = gameName.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_');
        const targetFilePath = `projects/master_test/${safeGameName}.json`;

        try {
            const existsRes = await fetch('/api/dev/check-exists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: targetFilePath })
            });
            const existsData = await existsRes.json();

            if (existsData.exists) {
                // Datei existiert bereits → Überschreiben-Dialog
                let doOverwrite = overwriteConfirmed;
                if (doOverwrite === undefined) {
                    doOverwrite = confirm(`Die Datei "${safeGameName}.json" ist schon vorhanden, soll diese überschrieben werden?`);
                }
                if (!doOverwrite) {
                    const msg = 'Speichervorgang abgebrochen (Überschreiben verweigert)';
                    EditorDataManager.logger.info(`[UseCase: Projekt speichern] ${msg}`);
                    return { success: false, message: msg };
                }
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
            this.host.flowEditor.syncToProject();
            this.host.flowEditor.syncAllTasksFromFlow(this.host.project);
        }
        this.host.syncStageObjectsToProject();

        // KRITISCH: isProjectChangeAvailable und isProjectDirty VOR dem JSON.stringify auf false setzen,
        // damit der gespeicherte JSON-Snapshot den korrekten "gespeichert"-Zustand enthält
        if (changeVar) {
            changeVar.defaultValue = false;
            (changeVar as any).value = false;
        }
        this.host.isProjectDirty = false;

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
                if (overwriteConfirmed === undefined) alert(msg);
                return { success: true, message: msg };
            } else {
                // Falls Speichern fehl schlägt: Zustand zurücksetzen
                if (changeVar) { changeVar.defaultValue = true; (changeVar as any).value = true; }
                this.host.isProjectDirty = true;
                const msg = 'Fehler beim Speichern: ' + (saveData.error || 'Unbekannter Fehler');
                EditorDataManager.logger.error(`[UseCase: Projekt speichern] ${msg}`);
                if (overwriteConfirmed === undefined) alert(msg);
                return { success: false, message: msg };
            }
        } catch (err) {
            // Falls Speichern fehl schlägt: Zustand zurücksetzen
            if (changeVar) { changeVar.defaultValue = true; (changeVar as any).value = true; }
            this.host.isProjectDirty = true;
            const msg = 'Kritischer Fehler beim Speichern (Server nicht erreichbar)';
            EditorDataManager.logger.error(`[UseCase: Projekt speichern] ${msg}:`, err);
            if (overwriteConfirmed === undefined) alert(msg);
            return { success: false, message: msg };
        }
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

    public loadProject(data: any) {
        if (!data) return;

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

                // Fix: Clean up accidentally saved global variables from non-blueprint stages
                if (s.type !== 'blueprint' && s.variables) {
                    s.variables = s.variables.filter((v: any) => v.scope !== 'global');
                }
            });
        }

        // 3. CENTRAL UPDATE (Replaces reference and notifies managers)
        EditorDataManager.logger.info('Calling this.host.setProject(data)', {
            host: !!this.host,
            hasSetProject: this.host && typeof (this.host as any).setProject === 'function',
            hostType: this.host?.constructor?.name
        });

        if (this.host && typeof (this.host as any).setProject === 'function') {
            this.host.setProject(data);
        } else {
            EditorDataManager.logger.error('CRITICAL: this.host.setProject is NOT a function!', {
                host: this.host,
                hostType: this.host?.constructor?.name
            });
            throw new TypeError('this.host.setProject is not a function. Host type: ' + (this.host?.constructor?.name || 'unknown'));
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

            dataService.seedFromUrl('db.json', '/api/dev/data/db.json').then(() => {
                if (this.host.inspector) this.host.inspector.update();
            });
        }

        // 8. NOTIFICATION
        mediatorService.notifyDataChanged(this.host.project, 'editor-load');

        // KRITISCH: isProjectDirty NACH allen Events auf false setzen
        // setProject() und autoSaveToLocalStorage() lösen DATA_CHANGED aus → isProjectDirty=true
        // Muss deshalb NACH diesen Aufrufen zurückgesetzt werden
        this.host.isProjectDirty = false;
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
    }

    public autoSaveToLocalStorage() {
        this.host.syncStageObjectsToProject();
        this.updateProjectJSON();

        const globalVarCount = (this.host.project.variables || []).length;
        const totalStageVarCount = (this.host.project.stages || []).reduce((acc, s) => acc + (s.variables?.length || 0), 0);
        EditorDataManager.logger.debug(`autoSaveToLocalStorage triggered (Global Vars: ${globalVarCount}, Stage Vars: ${totalStageVarCount})`);
    }

    public updateProjectJSON() {
        if (this.host.project) {
            // 1. In LocalStorage sichern (Crash-Schutz)
            projectPersistenceService.autoSaveToLocalStorage(this.host.project);

            // 2. workingProjectData für JSON-View aktualisieren
            if (this.host.viewManager) {
                this.host.viewManager.workingProjectData = safeDeepCopy(this.host.project);
            }

            // 3. SSoT & DATEI-PERSISTENZ: 
            // ARC-CHANGE: Wir senden die Daten nun doch per Fetch an den Server,
            // damit die project.json auf Disk immer aktuell bleibt (Anforderung Benutzer).
            fetch('/api/dev/save-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.host.project)
            }).then(res => res.json())
                .then(data => {
                    if (data.success) {
                        EditorDataManager.logger.debug(`[PERSISTENT] project.json auf Disk wurde automatisch aktualisiert.`);
                    }
                })
                .catch(err => {
                    EditorDataManager.logger.warn(`Fehler beim automatischen Disk-Save:`, err);
                });

            EditorDataManager.logger.debug(`[TRACE] updateProjectJSON: LocalStorage und Disk synchronisiert.`);
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

        projectRegistry.setProject(this.host.project);
    }

    public async loadFromServer() {
        if (this.host.isProjectDirty) {
            if (!confirm('Sie haben ungespeicherte Änderungen. Möchten Sie wirklich das Projekt vom Server neu laden?')) {
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
            alert('Fehler beim Laden vom Server: ' + err.message);
        }
    }

    public applyJSONChanges(): void {
        const confirmed = confirm('Möchten Sie die Änderungen am Projekt wirklich übernehmen? Dies kann nicht rückgängig gemacht werden und wird sofort wirksam.');
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
}
