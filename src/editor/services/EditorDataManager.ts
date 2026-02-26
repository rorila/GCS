import { GameProject } from '../../model/types';
import { ViewType } from '../EditorViewManager';
import { projectPersistenceService } from '../../services/ProjectPersistenceService';
import { projectRegistry } from '../../services/ProjectRegistry';
import { mediatorService } from '../../services/MediatorService';
import { dataService } from '../../services/DataService';
import { RefactoringManager } from '../RefactoringManager';
import { hydrateObjects } from '../../utils/Serialization';
import { safeDeepCopy } from '../../utils/DeepCopy';

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
    stageManager: any;
    commandManager: any;
    menuManager: any;
    undoManager: any;
}

export class EditorDataManager {
    private host: EditorDataHost;

    constructor(host: EditorDataHost) {
        this.host = host;
    }

    public async triggerLoad() {
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

        await projectPersistenceService.saveProject(this.host.project);
        alert('Projekt erfolgreich gespeichert!');
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

        // CLEAR old LocalStorage before loading new project
        localStorage.removeItem('gcs_last_project');
        console.log('[EditorDataManager] LocalStorage cleared for fresh project load');

        // Clean up data artifacts before loading
        RefactoringManager.cleanActionSequences(data);

        // Metadata wiederherstellen
        if (data.meta) this.host.project.meta = data.meta;
        if (data.stage && data.stage.grid) this.host.project.stage.grid = data.stage.grid;

        // Cleanup korrupter Task-Daten
        if (this.host.flowEditor) {
            this.host.flowEditor.cleanCorruptTaskData();
        }

        // Actions, Tasks, Variables
        this.host.project.actions = data.actions || [];
        this.host.project.tasks = data.tasks || [];
        this.host.project.variables = data.variables || [];

        // Restore Flow Data
        if (data.flowCharts) {
            this.host.project.flowCharts = data.flowCharts;
            const flowCharts = data.flowCharts as any;
            if (flowCharts.global) {
                this.host.project.flow = flowCharts.global;
            }
        } else if (data.flow) {
            this.host.project.flow = data.flow;
            this.host.project.flowCharts = { global: data.flow };
        } else {
            // Standard-Flow falls nichts vorhanden
            const defaultGrid = {
                cols: 100,
                rows: 100,
                cellSize: 20,
                snapToGrid: true,
                visible: true,
                backgroundColor: '#1e1e1e'
            };
            this.host.project.flow = {
                stage: defaultGrid,
                elements: [],
                connections: []
            };
            this.host.project.flowCharts = { global: this.host.project.flow };
        }

        // Restore Stages (New System)
        if (data.stages && data.stages.length > 0) {
            const hydratedStages = data.stages.map((s: any) => {
                // FIX: Clean up accidentally saved global variables from non-blueprint stages
                let variables = s.variables || [];
                if (s.type !== 'blueprint') {
                    const originalLen = variables.length;
                    variables = variables.filter((v: any) => v.scope !== 'global');
                    if (variables.length < originalLen) {
                        console.log(`[EditorDataManager] Cleaned up ${originalLen - variables.length} erroneous global variables from stage "${s.id}" upon load.`);
                    }
                }

                return {
                    ...s,
                    objects: hydrateObjects(s.objects || []),
                    variables: hydrateObjects(variables) as any
                };
            });
            this.host.project.stages = hydratedStages;
            this.host.project.activeStageId = data.activeStageId || hydratedStages[0].id;
            projectRegistry.setActiveStageId(this.host.project.activeStageId || null);
        }

        // Restore Objects (Legacy System)
        this.host.project.objects = hydrateObjects(data.objects || []);
        this.host.project.variables = hydrateObjects(data.variables || []) as any;
        this.host.project.splashObjects = hydrateObjects(data.splashObjects || []);
        this.host.project.splashDuration = data.splashDuration ?? 3000;
        this.host.project.splashAutoHide = data.splashAutoHide ?? true;

        // Migration falls nötig (wenn keine Stages im geladenen Projekt waren)
        if (!this.host.project.stages || this.host.project.stages.length === 0) {
            this.host.migrateToStages();
        }

        // Sicherstellen, dass jede Stage ein eigenes Grid-Objekt hat (Deep Copy)
        if (this.host.project.stages) {
            this.host.project.stages.forEach(s => {
                if (!s.grid) {
                    s.grid = JSON.parse(JSON.stringify(this.host.project.stage.grid));
                }
            });
        }

        // Sync UI
        if (this.host.inspector) this.host.inspector.setProject(this.host.project);
        if (this.host.dialogManager) this.host.dialogManager.setProject(this.host.project);

        // Stage-spezifisches Grid anwenden
        const activeStage = this.host.project.stages?.find(s => s.id === this.host.project.activeStageId);
        if (activeStage && activeStage.grid) {
            this.host.stage.grid = activeStage.grid;
            this.host.stage.isBlueprint = activeStage.type === 'blueprint';
        } else {
            this.host.stage.grid = this.host.project.stage.grid;
            this.host.stage.isBlueprint = false;
        }

        if (this.host.flowEditor) this.host.flowEditor.setProject(this.host.project);
        projectRegistry.setProject(this.host.project);

        // Sanitize project
        RefactoringManager.sanitizeProject(this.host.project);

        this.host.render();
        this.host.selectObject(null);
        this.host.updateStagesMenu(); // WICHTIG: Menü aktualisieren
        this.host.switchView('stage'); // Zur visuellen Bearbeitung wechseln

        console.log("[EditorDataManager] Projekt geladen und Stages initialisiert", this.host.project);
        this.autoSaveToLocalStorage();

        // AUTO-SEED: Datenbestände der TDataStores automatisch vom Server laden, wenn im Editor
        if (typeof window !== 'undefined') {
            const dataStores = this.host.project.objects.filter((o: any) => o.className === 'TDataStore');
            dataStores.forEach((ds: any) => {
                const path = ds.storagePath || 'db.json';
                console.log(`[EditorDataManager] Auto-seeding DB: ${path}`);
                dataService.seedFromUrl(path, `/api/dev/data/${path}`).then(() => {
                    // Refresh inspector if data arrived
                    if (this.host.inspector) this.host.inspector.update();
                });
            });

            // Immer auch db.json seeden als Default-Modellquelle
            dataService.seedFromUrl('db.json', '/api/dev/data/db.json').then(() => {
                if (this.host.inspector) this.host.inspector.update();
            });
        }

        // Show success notification
        setTimeout(() => {
            const toast = this.host.project?.objects.find(o => (o as any).className === 'TToast') as any;
            if (toast && typeof toast.success === 'function') {
                toast.success('Projekt geladen und im Browser gespeichert.');
            } else {
                console.log('%c[EditorDataManager] Project loaded & persisted to LocalStorage', 'color: #4caf50; font-weight: bold;');
            }
        }, 500);
    }

    public autoSaveToLocalStorage() {
        this.updateProjectJSON();

        const globalVarCount = (this.host.project.variables || []).length;
        const totalStageVarCount = (this.host.project.stages || []).reduce((acc, s) => acc + (s.variables?.length || 0), 0);
        console.log(`%c[EditorDataManager] autoSaveToLocalStorage triggered (Global Vars: ${globalVarCount}, Stage Vars: ${totalStageVarCount})`, 'color: #9c27b0; font-weight: bold;');
    }

    public updateProjectJSON() {
        if (this.host.project) {
            projectPersistenceService.autoSaveToLocalStorage(this.host.project);

            // SSoT & DATEI-PERSISTENZ: Speichere Änderungen direkt auf Disk via Server-Endpoint
            console.log('[EditorDataManager] Starte persistente Speicherung auf Disk...');
            fetch('/api/dev/save-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.host.project)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        console.log('[EditorDataManager] Projekt wurde erfolgreich auf Disk gespeichert.');
                    } else {
                        console.warn('[EditorDataManager] Server-seitige Speicherung fehlgeschlagen:', data.error);
                    }
                })
                .catch(err => {
                    console.error('[EditorDataManager] Fehler bei Verbindung zum Speicher-Endpoint:', err);
                });
        }
    }

    public syncStageObjectsToProject() {
        // NEVER save runtime state back to the design project.
        if (this.host.stage && this.host.stage.runMode) {
            console.log(`[EditorDataManager] SKIPPING syncStageObjectsToProject because we are in RunMode.`);
            return;
        }

        const activeStage = this.host.getActiveStage();
        if (!this.host.stage || !activeStage) return;

        console.log(`[EditorDataManager] Syncing objects for stage "${activeStage.id}" to project JSON...`);

        const projectStage = this.host.project.stages?.find((s: any) => s.id === activeStage.id);
        if (projectStage) {
            const allObjs = this.host.stageManager.currentObjects(); // Assume stageManager available via host or similar

            const newStageObjects = allObjs.filter((o: any) =>
                !o.isVariable && !o.isTransient &&
                (o.scope === activeStage.id || !o.scope || o.scope === 'stage')
            );

            if (activeStage.type === 'blueprint' && newStageObjects.length === 0 && (projectStage.objects && projectStage.objects.length > 0)) {
                console.error(`[EditorDataManager] CRITICAL SAFETY BLOCK: Attempted to overwrite Blueprint objects with empty list!`);
            } else {
                projectStage.objects = newStageObjects;
            }

            (projectStage as any).variables = allObjs.filter((o: any) =>
                o.isVariable && !o.isTransient &&
                (
                    o.scope === activeStage.id ||
                    o.scope === 'stage' ||
                    (activeStage.type === 'blueprint' && o.scope === 'global')
                )
            );
        }
    }

    public morphVariable(variable: any, newType: any) {
        console.log(`%c[EditorDataManager] MORPH START: "${variable.name}" (${variable.type} -> ${newType})`, 'color: #00bcd4; font-weight: bold;');

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
            console.error(`[EditorDataManager] Failed to create instance for morphing to ${newClassName}`);
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
            console.log(`[EditorDataManager] SUCCESS: Replaced in currentObjects[${stageObjIdx}] (LIVE ENGINE).`);
        }

        // 5. Update UI
        this.host.commandManager.selectObject(null);
        setTimeout(() => {
            this.host.commandManager.selectObject(newInstance.id);
        }, 50);

        projectRegistry.setProject(this.host.project);
    }

    public async loadFromServer() {
        if (!confirm('Möchten Sie das Projekt wirklich vom Server neu laden? Alle nicht gespeicherten lokalen Änderungen gehen verloren.')) {
            return;
        }

        try {
            console.log('[EditorDataManager] Force Reload: Fetching project from server...');
            const projectData = await projectPersistenceService.fetchProjectFromServer();

            // Overwrite LocalStorage
            localStorage.setItem('gcs_last_project', JSON.stringify(projectData));

            console.log('[EditorDataManager] Force Reload successful. Reloading page...');
            window.location.reload();
        } catch (err: any) {
            console.error('[EditorDataManager] Force Reload failed:', err);
            alert('Fehler beim Laden vom Server: ' + err.message);
        }
    }

    public applyJSONChanges(): void {
        const confirmed = confirm('Möchten Sie die Änderungen am Projekt wirklich übernehmen? Dies kann nicht rückgängig gemacht werden und wird sofort wirksam.');
        if (confirmed && this.host.workingProjectData) {
            // Apply sync to project before loading back
            this.host.syncFlowChartsWithActions();

            this.loadProject(safeDeepCopy(this.host.workingProjectData));
            this.host.viewManager.isProjectDirty = false;
            this.host.refreshJSONView(); // Hide apply button

            // Notify Mediator that project data has changed via JSON Editor
            mediatorService.notifyDataChanged(this.host.project, 'json-editor');
        }
    }
}
