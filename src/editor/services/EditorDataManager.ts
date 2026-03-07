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
        this.host.setProject(data);

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
            // Nur noch in LocalStorage sichern (Crash-Schutz)
            projectPersistenceService.autoSaveToLocalStorage(this.host.project);

            // SSoT & DATEI-PERSISTENZ: 
            // ARC-CHANGE: Wir senden NICHT mehr automatisch per Fetch an den Server!
            // Das Überschreiben der project.json auf Disk erfolgt nur noch explizit in saveProject().
            EditorDataManager.logger.debug(`[TRACE] updateProjectJSON: LocalStorage synchronisiert. Server-Sync übersprungen.`);
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
