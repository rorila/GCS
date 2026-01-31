import { TObjectList } from '../components/TObjectList';
import { GameAction, GameTask, ProjectVariable } from '../model/types';
import { projectRegistry } from './ProjectRegistry';
import { RefactoringManager } from '../editor/RefactoringManager';
// import { serviceRegistry } from './ServiceRegistry';

/**
 * Zentrale Event-Typen für den Mediator.
 */
export enum MediatorEvents {
    DATA_CHANGED = 'DATA_CHANGED',
    OBJECT_SELECTED = 'OBJECT_SELECTED',
    PROJECT_LOADED = 'PROJECT_LOADED',
    STAGE_CHANGED = 'STAGE_CHANGED'
}

/**
 * Der MediatorService verwaltet die transienten Komponenten-Manager (TObjectList)
 * und dient als Daten-Broker für die verschiedenen Editoren.
 * Er entkoppelt die UI-Logik von der komplexen Stage-Auflösung.
 */
export class MediatorService {
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
        console.log(`[Mediator] Notify Event: ${event}${originator ? ` (Originator: ${originator})` : ''}`, data);
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(cb => {
                try {
                    cb(data, originator);
                } catch (e) {
                    console.error(`[Mediator] Error in Listener for "${event}":`, e);
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
            console.log(`[Mediator] Debounced Execution: ${event}${originator ? ` (Originator: ${originator})` : ''}`);
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

        console.log(`[MediatorService] Erzeuge transiente Manager-Listen für Stage: ${stageId}`);

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
    public getVisualObjects(_stageId: string): any[] {
        const objs = projectRegistry.getObjects();
        const project = (projectRegistry as any).project;

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
    public getTasks(stageId: string): GameTask[] {
        const tasks = projectRegistry.getTasks(stageId);
        return tasks.map(task => ({
            ...task,
            usageCount: projectRegistry.getTaskUsage(task.name).length,
            uiScope: (task as any).uiScope || 'stage' // getTasks sets this already in some versions
        }));
    }

    public getActions(stageId: string): GameAction[] {
        const actions = projectRegistry.getActions(stageId);
        return actions.map(action => ({
            ...action,
            usageCount: projectRegistry.getActionUsage(action.name).length,
            uiScope: (action as any).uiScope || 'stage',
            changesDisplay: action.changes ? JSON.stringify(action.changes).replace(/[{}"]/g, '').replace(/:/g, '=') :
                (action.method ? `${action.method}(...)` : '')
        }));
    }

    public getVariables(stageId: string): ProjectVariable[] {
        if (!stageId) return [];
        const vars = projectRegistry.getVariables() as ProjectVariable[];
        return vars.map(v => ({
            ...v,
            usageCount: projectRegistry.getVariableUsage(v.name).length,
            uiScope: (v as any).uiScope || 'stage'
        }));
    }

    public getFlowCharts(stageId: string): any[] {
        const project = (projectRegistry as any).project;
        if (!project) return [];

        const charts: any[] = [];
        // Globale Charts
        if (project.flowCharts) {
            Object.keys(project.flowCharts).forEach(name => {
                const data = project.flowCharts[name];
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
                    const data = stage.flowCharts[name];
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

    /**
     * ZENTRALES REFACTORING: Benennt einen Task um und aktualisiert alle Referenzen inkl. FlowCharts.
     */
    public renameTask(stageId: string, oldName: string, newName: string): boolean {
        const project = (projectRegistry as any).project;
        if (!project) return false;

        console.log(`[Mediator] Refactoring on Stage "${stageId}": Rename Task "${oldName}" -> "${newName}"`);

        // Nutze den RefactoringManager für die harte Arbeit
        RefactoringManager.renameTask(project, oldName, newName);

        // Hier können wir später noch Mediator-spezifische Events triggern
        // (z.B. den Flow-Editor anweisen, das neue Diagramm zu laden)

        return true;
    }
}

export const mediatorService = MediatorService.getInstance();
