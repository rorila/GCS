import { coreStore } from '../../services/registry/CoreStore';
import { GameProject } from '../../model/types';
import { ViewType } from '../EditorViewManager';
import { Logger } from '../../utils/Logger';
import { EditorProjectLoader } from './EditorProjectLoader';
import { EditorProjectSaver } from './EditorProjectSaver';
import { EditorMediaExporter } from './EditorMediaExporter';

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
    /** Revision der Projektdatei zum Lade-/letzten Speicherzeitpunkt. */
    private _diskRevision: string | null = null;
    /** Solange die Revision nicht gelesen ist, darf kein Hintergrund-Save schreiben. */
    private _diskRevisionReady: boolean = false;
    /** Nach einem Konflikt bleiben weitere Auto-Saves bis zum Neuladen gesperrt. */
    private _diskSaveConflict: boolean = false;

    private loader: EditorProjectLoader;
    private saver: EditorProjectSaver;
    private exporter: EditorMediaExporter;

    constructor(host: EditorDataHost) {
        this.host = host;
        this.loader = new EditorProjectLoader(this);
        this.saver = new EditorProjectSaver(this);
        this.exporter = new EditorMediaExporter(this);
    }

    public get loadedAt(): number { return this._loadedAt; }
    public set loadedAt(value: number) { this._loadedAt = value; }
    public get autoSaveCount(): number { return this._autoSaveCount; }
    public set autoSaveCount(value: number) { this._autoSaveCount = value; }
    public get diskSaveTimer(): any { return this._diskSaveTimer; }
    public set diskSaveTimer(value: any) { this._diskSaveTimer = value; }
    public get diskRevision(): string | null { return this._diskRevision; }
    public set diskRevision(value: string | null) { this._diskRevision = value; }
    public get diskRevisionReady(): boolean { return this._diskRevisionReady; }
    public set diskRevisionReady(value: boolean) { this._diskRevisionReady = value; }
    public get diskSaveConflict(): boolean { return this._diskSaveConflict; }
    public set diskSaveConflict(value: boolean) { this._diskSaveConflict = value; }

    public getHost(): EditorDataHost {
        return this.host;
    }

    public updateProjectPathDisplay(): void {
        this.saver.updateProjectPathDisplay();
    }

    public async triggerLoad(): Promise<void> {
        return this.loader.triggerLoad();
    }

    public async saveProject(): Promise<void> {
        return this.saver.saveProject();
    }

    public async saveProjectToFile(overwriteConfirmed?: boolean): Promise<{ success: boolean; message: string }> {
        return this.saver.saveProjectToFile(overwriteConfirmed);
    }

    public async saveProjectAs(): Promise<{ success: boolean; message: string }> {
        return this.saver.saveProjectAs();
    }

    public async exportHTML(): Promise<void> {
        return this.exporter.exportHTML();
    }

    public async exportHTMLCompressed(): Promise<void> {
        return this.exporter.exportHTMLCompressed();
    }

    public async exportJSON(): Promise<void> {
        return this.exporter.exportJSON();
    }

    public async exportJSONCompressed(): Promise<void> {
        return this.exporter.exportJSONCompressed();
    }

    public async exportTheme(): Promise<void> {
        return this.exporter.exportTheme();
    }

    public loadProject(data: any, sourcePath?: string): void {
        this.loader.loadProject(data, sourcePath);
    }

    public autoSaveToLocalStorage(): void {
        this.saver.autoSaveToLocalStorage();
    }

    public syncStageObjectsToProject(): void {
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

        // 5. Update UI
        this.host.commandManager.selectObject(null);
        setTimeout(() => {
            this.host.commandManager.selectObject(newInstance.id);
        }, 50);

        coreStore.setProject(this.host.project);
    }

    public async loadFromServer(): Promise<void> {
        return this.loader.loadFromServer();
    }

    public async applyJSONChanges(): Promise<void> {
        return this.loader.applyJSONChanges();
    }

    public updateProjectJSON(): void {
        this.saver.updateProjectJSON();
    }
}
