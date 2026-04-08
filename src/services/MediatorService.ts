import { projectReferenceTracker } from './registry/ReferenceTracker';
import { projectObjectRegistry } from './registry/ObjectRegistry';
import { projectActionRegistry } from './registry/ActionRegistry';
import { projectTaskRegistry } from './registry/TaskRegistry';
import { projectVariableRegistry } from './registry/VariableRegistry';
import { TObjectList } from '../components/TObjectList';
import { coreStore } from './registry/CoreStore';
import { GameAction, GameTask, ProjectVariable, ComponentData } from '../model/types';

import { RefactoringManager } from '../editor/RefactoringManager';
import { Logger } from '../utils/Logger';

/**
 * Zentrale Event-Typen für den Mediator.
 */
export enum MediatorEvents {
    DATA_CHANGED = 'DATA_CHANGED',
    OBJECT_SELECTED = 'OBJECT_SELECTED',
    PROJECT_LOADED = 'PROJECT_LOADED',
    STAGE_CHANGED = 'STAGE_CHANGED',
    SWITCH_FLOW_CONTEXT = 'SWITCH_FLOW_CONTEXT',
    TASK_RENAMED = 'TASK_RENAMED'
}

/**
 * Der MediatorService verwaltet die transienten Komponenten-Manager (TObjectList)
 * und dient als Daten-Broker für die verschiedenen Editoren.
 * Er entkoppelt die UI-Logik von der komplexen Stage-Auflösung.
 */
export class MediatorService {
    private logger = Logger.get('Mediator', 'Inspector_Update');
    private refactoringLogger = Logger.get('Mediator', 'Flow_Synchronization');
    private static instance: MediatorService;
    private transientManagers: Map<string, TObjectList[]> = new Map();
    private eventListeners: Map<string, Function[]> = new Map();
    private debounceTimers: Map<string, any> = new Map();

    private constructor() { }

    public static getInstance(): MediatorService {
        if (!MediatorService.instance) {
            MediatorService.instance = new MediatorService();
        }
        return MediatorService.instance;
    }

    /**
     * Resets the mediator state (e.g. for fresh project load).
     */
    public reset(): void {
        this.logger.info('Resetting Mediator state');
        this.transientManagers.clear();
        // Event listeners are usually global to the app session, so we keep them.
        // But we might want to clear debounce timers.
        this.debounceTimers.forEach(t => clearTimeout(t));
        this.debounceTimers.clear();
    }

    /**
     * Benachrichtigt über eine Datenänderung (mit Debouncing).
     */
    public notifyDataChanged(data?: any, originator?: string): void {
        this.notifyDebounced(MediatorEvents.DATA_CHANGED, data, 300, originator);
    }

    /**
     * Benachrichtigt über eine Objekt-Selektion (sofort).
     */
    public notifyObjectSelected(object: any, originator?: string): void {
        this.notify(MediatorEvents.OBJECT_SELECTED, object, originator);
    }

    /**
     * Registriert einen Listener für ein bestimmtes Event.
     */
    public on(event: string, callback: Function): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
    }

    /**
     * Entfernt einen Listener.
     */
    public off(event: string, callback: Function): void {
        if (!this.eventListeners.has(event)) return;
        const listeners = this.eventListeners.get(event)!;
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
    }

    /**
     * Benachrichtigt alle Listener eines Events (sofort).
     */
    public notify(event: string, data?: any, originator?: string): void {
        this.logger.info(`Notify Event: ${event}${originator ? ` (Originator: ${originator})` : ''}`, data);
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(cb => {
                try {
                    cb(data, originator);
                } catch (e) {
                    this.logger.error(`Error in Listener for "${event}":`, e);
                }
            });
        }
    }

    /**
     * Benachrichtigt alle Listener mit "Entprellung" (Debouncing).
     * Verhindert Flut von Updates bei schnellen Änderungen (z.B. Tippen).
     */
    public notifyDebounced(event: string, data?: any, delay: number = 300, originator?: string): void {
        if (this.debounceTimers.has(event)) {
            clearTimeout(this.debounceTimers.get(event));
        }

        const timer = setTimeout(() => {
            this.logger.info(`Debounced Execution: ${event}${originator ? ` (Originator: ${originator})` : ''}`);
            this.notify(event, data, originator);
            this.debounceTimers.delete(event);
        }, delay);

        this.debounceTimers.set(event, timer);
    }

    /**
     * Gibt die transienten Manager-Listen für eine Stage zurück (Lazy Initialisierung).
     */
    public getManagersForStage(stageId: string): TObjectList[] {
        if (this.transientManagers.has(stageId)) {
            const existing = this.transientManagers.get(stageId)!;
            // Daten aktualisieren
            this.refreshManagerData(stageId, existing);
            return existing;
        }

        this.logger.info(`Erzeuge transiente Manager-Listen für Stage: ${stageId}`);

        const managers: TObjectList[] = [
            this.createConfiguredManager('VisualObjects', 0, 0, '#009688', [
                { property: 'name', label: 'Objekt', width: '200px' },
                { property: 'className', label: 'Typ', width: '100px' },
                { property: 'x', label: 'X', width: '40px' },
                { property: 'y', label: 'Y', width: '40px' },
                { property: 'width', label: 'W', width: '40px' },
                { property: 'height', label: 'H', width: '40px' },
                { property: 'uiScope', label: 'Scope', width: '80px' }
            ]),
            this.createConfiguredManager('Tasks', 10, 0, '#673ab7', [
                { property: 'name', label: 'Task', width: '250px' },
                { property: 'triggerMode', label: 'Sync', width: '100px' },
                { property: 'usageCount', label: 'Links', width: '60px' },
                { property: 'uiScope', label: 'Scope', width: '80px' }
            ]),
            this.createConfiguredManager('Actions', 20, 0, '#ff9800', [
                { property: 'name', label: 'Aktion', width: '220px' },
                { property: 'type', label: 'Typ', width: '90px' },
                { property: 'target', label: 'Ziel', width: '120px' },
                { property: 'changesDisplay', label: 'Änderung', width: '180px' },
                { property: 'usageCount', label: 'Links', width: '50px' },
                { property: 'uiScope', label: 'Scope', width: '70px' }
            ]),
            this.createConfiguredManager('Variables', 30, 0, '#2196f3', [
                { property: 'name', label: 'Variable', width: '180px' },
                { property: 'className', label: 'Klasse', width: '120px' },
                { property: 'variableType', label: 'Typ', width: '70px' },
                { property: 'defaultValue', label: 'Start', width: '70px' },
                { property: 'value', label: 'Wert', width: '70px' },
                { property: 'usageCount', label: 'Links', width: '50px' },
                { property: 'uiScope', label: 'Scope', width: '70px' }
            ]),
            this.createConfiguredManager('FlowCharts', 40, 0, '#e91e63', [
                { property: 'name', label: 'Diagramm', width: '250px' },
                { property: 'nodeCount', label: 'Nodes', width: '60px' },
                { property: 'uiScope', label: 'Scope', width: '80px' }
            ]),
            this.createConfiguredManager('Stages', 50, 0, '#4caf50', [
                { property: 'id', label: 'ID', width: '120px' },
                { property: 'name', label: 'Name', width: '180px' },
                { property: 'type', label: 'Typ', width: '100px' },
                { property: 'objectCount', label: 'Objekte', width: '70px' }
            ])
        ];

        this.refreshManagerData(stageId, managers);
        this.transientManagers.set(stageId, managers);
        return managers;
    }

    private createConfiguredManager(name: string, x: number, y: number, color: string, columns: any[]): TObjectList {
        const mgr = this.createManager(name, x, y, color);
        mgr.columns = columns;
        return mgr;
    }

    public refreshManagerData(stageId: string, managers: TObjectList[]): void {
        managers.forEach(mgr => {
            if (mgr.name === 'VisualObjects') mgr.data = this.getVisualObjects(stageId);
            else if (mgr.name === 'Tasks') mgr.data = this.getTasks(stageId);
            else if (mgr.name === 'Actions') mgr.data = this.getActions(stageId);
            else if (mgr.name === 'Variables') mgr.data = this.getVariables(stageId);
            else if (mgr.name === 'FlowCharts') mgr.data = this.getFlowCharts(stageId);
            else if (mgr.name === 'Stages') mgr.data = this.getStages();
        });
    }

    private createManager(name: string, x: number, y: number, color: string): TObjectList {
        const mgr = new TObjectList(name, x, y);
        mgr.isTransient = true;
        mgr.scope = 'stage';
        mgr.width = 8;
        mgr.height = 3;
        mgr.style.backgroundColor = color;
        mgr.style.borderColor = 'rgba(255,255,255,0.3)';
        mgr.style.borderWidth = 2;
        // Markierung für Editoren
        (mgr as any).isManager = true;
        return mgr;
    }

    /**
     * Hilfsmethode: Liefert alle visuellen Objekte (Lokale + Globale) für eine Stage.
     */
    public getVisualObjects(_stageId: string): (ComponentData & { uiScope: string })[] {
        const objs = projectObjectRegistry.getObjects();
        const project = coreStore.project;

        return objs.map(obj => {
            const isGlobal = project?.objects?.some((o: any) => o.id === obj.id);
            return {
                ...obj,
                uiScope: isGlobal ? 'global' : 'stage'
            } as any;
        });
    }

    /**
     * Hilfsmethode: Liefert alle Tasks für eine Stage.
     */
    public getTasks(stageId: string): (GameTask & { usageCount: number, uiScope: string })[] {
        const tasks = projectTaskRegistry.getTasks(stageId);
        return tasks.map(task => ({
            ...task,
            usageCount: projectReferenceTracker.getTaskUsage(task.name).length,
            uiScope: (task as any).uiScope || 'stage'
        })).filter(task => {
            // Library-Tasks nur anzeigen, wenn sie im Projekt verwendet werden (usageCount > 0)
            if (task.uiScope === 'library' && task.usageCount === 0) return false;
            return true;
        });
    }

    public getActions(stageId: string): (GameAction & { usageCount: number, uiScope: string, changesDisplay: string })[] {
        const actions = projectActionRegistry.getActions(stageId);
        return actions.map(action => {
            const anyAction = action as any;
            return {
                ...action,
                usageCount: projectReferenceTracker.getActionUsage(action.name).length,
                uiScope: anyAction.uiScope || 'stage',
                changesDisplay: anyAction.changes ? JSON.stringify(anyAction.changes).replace(/[{}"]/g, '').replace(/:/g, '=') :
                    (anyAction.method ? `${anyAction.method}(...)` : '')
            } as GameAction & { usageCount: number, uiScope: string, changesDisplay: string };
        });
    }

    public getVariables(stageId: string): (ProjectVariable & { usageCount: number, uiScope: string })[] {
        if (!stageId) return [];
        const vars = projectVariableRegistry.getVariables() as ProjectVariable[];
        return vars.map(v => ({
            ...v,
            usageCount: projectReferenceTracker.getVariableUsage(v.name).length,
            uiScope: (v as any).uiScope || 'stage'
        }));
    }

    public getFlowCharts(stageId: string): { name: string, uiScope: string, nodeCount: number }[] {
        const project = coreStore.project;
        if (!project) return [];

        const charts: { name: string, uiScope: string, nodeCount: number }[] = [];
        // Globale Charts
        if (project.flowCharts) {
            Object.keys(project.flowCharts).forEach(name => {
                const data = project.flowCharts![name];
                charts.push({
                    name,
                    uiScope: 'global',
                    nodeCount: data.elements?.length || 0
                });
            });
        }
        // Stage Charts
        if (project.stages) {
            const stage = project.stages.find((s: any) => s.id === stageId);
            if (stage && stage.flowCharts) {
                Object.keys(stage.flowCharts).forEach(name => {
                    const data = stage.flowCharts![name];
                    charts.push({
                        name,
                        uiScope: 'stage',
                        nodeCount: data.elements?.length || 0
                    });
                });
            }
        }
        return charts;
    }

    public getStages(): { id: string, name: string, type: string, objectCount: number }[] {
        const project = coreStore.project;
        if (!project || !project.stages) return [];

        return project.stages.map((s: any) => ({
            id: s.id,
            name: s.name || s.id,
            type: s.type || 'standard',
            objectCount: s.objects?.length || 0
        }));
    }

    /**
     * ZENTRALES REFACTORING: Benennt einen Task um und aktualisiert alle Referenzen inkl. FlowCharts.
     */
    public renameTask(stageId: string, oldName: string, newName: string): boolean {
        const project = coreStore.project;
        if (!project) return false;

        this.refactoringLogger.info(`Refactoring on Stage "${stageId}": Rename Task "${oldName}" -> "${newName}"`);

        // Nutze den RefactoringManager für die harte Arbeit
        RefactoringManager.renameTask(project, oldName, newName);

        // Hier können wir später noch Mediator-spezifische Events triggern
        // (z.B. den Flow-Editor anweisen, das neue Diagramm zu laden)

        return true;
    }
}

export const mediatorService = MediatorService.getInstance();
