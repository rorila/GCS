import { BaseAction, GameTask, SequenceItem, ActionType } from '../../model/types';
import { SchemaMigrator } from '../SchemaMigrator';
import { actionRegistry } from '../../runtime/ActionRegistry';
import { Logger } from '../../utils/Logger';
import type { AgentController } from '../AgentController';

/**
 * AgentValidationService
 *
 * Kapselt Validierung, Namensauflösung, Action-Definition,
 * Flow-Generierung und Hilfsmethoden für Task/Action-Lookup.
 */
export class AgentValidationService {
    private logger = Logger.get('AgentValidationService', 'Editor_Diagnostics');

    constructor(private controller: AgentController) {}

    public getTaskByName(name: string): GameTask | undefined {
        const project = this.controller.getProject();
        if (!project) return undefined;

        // Search Global
        let task = project.tasks?.find(t => t.name === name);
        if (task) return task;

        // Search Stages
        if (project.stages) {
            for (const s of project.stages) {
                if (s.tasks) {
                    task = s.tasks.find(t => t.name === name);
                    if (task) return task;
                }
            }
        }
        return undefined;
    }

    public getActionByName(name: string): BaseAction | undefined {
        const project = this.controller.getProject();
        if (!project) return undefined;

        // Search Global
        let action = project.actions?.find(a => a.name === name);
        if (action) return action;

        // Search Blueprint Stage
        const blueprintStage = project.stages?.find(s => s.type === 'blueprint');
        if (blueprintStage?.actions) {
            action = blueprintStage.actions.find(a => a.name === name);
            if (action) return action;
        }

        // Search all other Stages
        for (const stage of project.stages || []) {
            if (stage.type === 'blueprint') continue;
            if (stage.actions) {
                action = stage.actions.find(a => a.name === name);
                if (action) return action;
            }
        }

        return undefined;
    }

    /**
     * Stellt sicher, dass alle in einer Branch/Body-Sequenz referenzierten Actions
     * global im Projekt definiert sind. Traversiert rekursiv then/else/body.
     */
    public ensureActionsExistGlobally(items: SequenceItem[]) {
        for (const item of items) {
            if (item.type === 'action' && item.name) {
                const exists = this.getActionByName(item.name);
                if (!exists) {
                    throw new Error(
                        `[AgentController] Action '${item.name}' is referenced in branch but not globally defined. ` +
                        `Use addAction() first or define it inline via BranchBuilder.addNewAction().`
                    );
                }
            }
            // Rekursiv: Condition-Zweige und Loop-Bodies prüfen
            if (item.then) this.ensureActionsExistGlobally(item.then);
            if (item.else) this.ensureActionsExistGlobally(item.else);
            if (item.body) this.ensureActionsExistGlobally(item.body);
        }
    }

    /**
     * Definiert eine Action (global oder in einer Stage), ohne sie an einen Task anzuhängen.
     * Wird intern vom BranchBuilder genutzt.
     */
    public ensureActionDefined(actionType: ActionType, actionName: string, params: Record<string, any> = {}, stageId?: string) {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;

        // 1. Suche bestehende Action (global oder in der Ziel-Stage)
        let actionDef = this.getActionByName(actionName);

        // 2. Falls stageId angegeben, prüfe ob sie dort existiert
        if (stageId) {
            const stage = project.stages?.find(s => s.id === stageId);
            if (stage) {
                if (!stage.actions) stage.actions = [];
                const stageAction = stage.actions.find(a => a.name === actionName);
                if (stageAction) actionDef = stageAction;
            }
        }

        if (actionDef) {
            // Bereits existent – Parameter aktualisieren
            Object.assign(actionDef, params);
            this.logger.info(`Updated existing action: ${actionName}`);
        } else {
            actionDef = {
                name: actionName,
                type: actionType,
                ...params
            } as any;

            SchemaMigrator.initializeActionDefaults(actionDef, (type) => actionRegistry.getMetadata(type)?.parameters || null);

            if (stageId) {
                const stage = project.stages?.find(s => s.id === stageId);
                if (stage) {
                    if (!stage.actions) stage.actions = [];
                    stage.actions.push(actionDef as any);
                    this.logger.info(`Created new STAGE action: ${actionName} in ${stageId}`);
                    this.controller.notifyChange();
                    return;
                }
            }

            // Fallback: Global (Blueprint stage preferred)
            const blueprintStage = project.stages?.find(s => s.type === 'blueprint');
            if (blueprintStage) {
                if (!blueprintStage.actions) blueprintStage.actions = [];
                blueprintStage.actions.push(actionDef as any);
                this.logger.info(`Created new action in BLUEPRINT: ${actionName}`);
            } else {
                if (!project.actions) project.actions = [];
                project.actions.push(actionDef as any);
                this.logger.info(`Created new GLOBAL action (fallback): ${actionName}`);
            }

            this.controller.notifyChange();
        }
    }

    /**
     * Generiert Layout-Positionen für die Flow-Darstellung aus der actionSequence.
     */
    public generateTaskFlow(taskName: string) {
        this.controller.validateProjectLoaded();
        const task = this.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        // --- Layout-Konstanten (identisch mit FlowSyncManager) ---
        const CHAR_WIDTH = 9;
        const MIN_NODE_WIDTH = 140;
        const NODE_HEIGHT = 50;
        const NODE_PADDING = 40;
        const Y_SPACING = NODE_HEIGHT + 30;
        const BRANCH_GAP = 40;
        const CENTER_X = 400;

        // Einheitliche Breite berechnen
        const allLabels: string[] = [task.name];
        const collectLabels = (seq: any[]) => {
            seq?.forEach(item => {
                allLabels.push(item.name || item.type || 'Aktion');
                if (item.then) collectLabels(item.then);
                if (item.else) collectLabels(item.else);
                if (item.body) collectLabels(item.body);
            });
        };
        collectLabels(task.actionSequence || []);
        const NODE_WIDTH = Math.max(MIN_NODE_WIDTH, Math.max(...allLabels.map(l => l.length)) * CHAR_WIDTH + NODE_PADDING);
        const BRANCH_OFFSET = NODE_WIDTH + BRANCH_GAP;

        const elements: any[] = [];
        let nextId = 1;
        const getId = () => `node-${Date.now()}-${nextId++}`;

        // Root Node (Task)
        elements.push({
            id: getId(), type: 'task',
            x: CENTER_X, y: 50,
            width: NODE_WIDTH, height: NODE_HEIGHT,
            properties: { name: task.name, text: task.name, description: task.description },
            data: { name: task.name }
        });

        const processItems = (sequence: any[], startY: number, centerX: number = CENTER_X): number => {
            let y = startY;
            for (const item of sequence) {
                if (item.type === 'condition') {
                    elements.push({
                        id: getId(), type: 'condition',
                        x: centerX, y,
                        width: NODE_WIDTH, height: NODE_HEIGHT,
                        properties: { text: item.name || `${item.condition?.variable} ${item.condition?.operator} ${item.condition?.value}` }
                    });
                    const branchY = y + Y_SPACING;
                    let thenMaxY = branchY, elseMaxY = branchY;
                    if (item.then?.length > 0) {
                        thenMaxY = processItems(item.then, branchY, centerX - BRANCH_OFFSET);
                    }
                    if (item.else?.length > 0) {
                        elseMaxY = processItems(item.else, branchY, centerX + BRANCH_OFFSET);
                    }
                    y = Math.max(thenMaxY, elseMaxY) + Y_SPACING;
                } else if (item.type === 'foreach' || item.type === 'while' || item.type === 'for') {
                    // Loop-Node: als eigener Typ 'loop' im Flow rendern
                    elements.push({
                        id: getId(), type: 'loop',
                        x: centerX, y,
                        width: NODE_WIDTH, height: NODE_HEIGHT,
                        properties: { name: item.name, text: item.name, loopType: item.type }
                    });
                    const bodyY = y + Y_SPACING;
                    // Body-Items leicht eingerückt darstellen
                    const bodyEndY = item.body?.length > 0
                        ? processItems(item.body, bodyY, centerX + Math.round(BRANCH_OFFSET / 2))
                        : bodyY;
                    y = bodyEndY + Y_SPACING;
                } else {
                    elements.push({
                        id: getId(), type: item.type === 'task' ? 'task' : 'action',
                        x: centerX, y,
                        width: NODE_WIDTH, height: NODE_HEIGHT,
                        properties: { name: item.name, text: item.name },
                        data: { name: item.name, isLinked: true }
                    });
                    y += Y_SPACING;
                }
            }
            return y;
        };

        processItems(task.actionSequence || [], 50 + Y_SPACING);

        // NUR flowLayout speichern
        task.flowLayout = {};
        elements.forEach(el => {
            const name = el.properties?.name || el.data?.name;
            if (name) {
                task.flowLayout![name] = { x: el.x, y: el.y };
            }
        });

        this.logger.info(`Generated flowLayout for '${taskName}' (${Object.keys(task.flowLayout).length} Positionen, NODE_WIDTH=${NODE_WIDTH})`);
    }

    /**
     * Validiert das Projekt auf Konsistenz. Gibt eine Liste von Problemen zurück.
     */
    public validate(): { level: 'error' | 'warning', message: string }[] {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const issues: { level: 'error' | 'warning', message: string }[] = [];

        const allActions = [...(project.actions || []), ...(project.stages?.flatMap(s => (s.actions as BaseAction[]) || []) || [])];
        const actionNames = new Set(allActions.map(a => a.name));

        const allTasks = [...(project.tasks || []), ...(project.stages?.flatMap(s => s.tasks || []) || [])];

        // Prüfe und repariere: Inline-Actions (verboten – werden automatisch extrahiert)
        const checkInlineActions = (seq: SequenceItem[], taskName: string) => {
            for (const item of seq) {
                if (item.type === 'action') {
                    const keys = Object.keys(item).filter(k => !['type', 'name'].includes(k));
                    if (keys.length > 0 && item.name) {
                        // Auto-Reparatur: Action global definieren falls noch nicht vorhanden
                        if (!actionNames.has(item.name)) {
                            const { type: _t, name: _n, ...inlineParams } = item as any;
                            const actionType = (inlineParams.actionType ?? inlineParams.type ?? 'property') as ActionType;
                            delete inlineParams.actionType;
                            const actionDef = { name: item.name, type: actionType, ...inlineParams } as any;
                            const blueprintStage = project.stages?.find(s => s.type === 'blueprint');
                            if (blueprintStage) {
                                if (!blueprintStage.actions) blueprintStage.actions = [];
                                blueprintStage.actions.push(actionDef);
                            } else {
                                if (!project.actions) project.actions = [];
                                project.actions.push(actionDef);
                            }
                            actionNames.add(item.name);
                            issues.push({ level: 'warning', message: `Task '${taskName}': Inline-Action '${item.name}' wurde automatisch als globale Action extrahiert.` });
                        }
                        // Item bereinigen – nur type und name behalten
                        for (const k of keys) delete (item as any)[k];
                    }
                    if (item.name && !actionNames.has(item.name)) {
                        issues.push({ level: 'error', message: `Task '${taskName}': Action '${item.name}' ist referenziert aber nicht definiert.` });
                    }
                }
                if (item.then) checkInlineActions(item.then, taskName);
                if (item.else) checkInlineActions(item.else, taskName);
                // Loop-Bodies ebenfalls traversieren
                if (item.body) checkInlineActions(item.body, taskName);
            }
        };

        allTasks.forEach(t => checkInlineActions(t.actionSequence, t.name));

        // Prüfe: Verwaiste Actions (definiert aber nie referenziert)
        const referencedActions = new Set<string>();
        const collectRefs = (seq: SequenceItem[]) => {
            for (const item of seq) {
                if (item.type === 'action' && item.name) referencedActions.add(item.name);
                if (item.then) collectRefs(item.then);
                if (item.else) collectRefs(item.else);
                // Loop-Bodies ebenfalls traversieren
                if (item.body) collectRefs(item.body);
            }
        };
        allTasks.forEach(t => collectRefs(t.actionSequence));
        allActions.forEach(a => {
            if (!referencedActions.has(a.name)) {
                issues.push({ level: 'warning', message: `Action '${a.name}' ist definiert aber in keinem Task referenziert.` });
            }
        });

        // Prüfe: Tasks ohne FlowChart
        allTasks.forEach(t => {
            let hasFlow = false;
            if (project.flowCharts?.[t.name]) hasFlow = true;
            project.stages?.forEach(s => {
                if (s.flowCharts?.[t.name]) hasFlow = true;
            });
            if (!hasFlow && t.actionSequence.length > 0) {
                issues.push({ level: 'warning', message: `Task '${t.name}' hat ${t.actionSequence.length} Actions aber kein FlowChart.` });
            }
        });

        // Bereinige: Leere Event-Einträge aus allen Objekten entfernen
        const cleanEmptyEvents = (objs: any[]) => {
            if (!objs) return;
            for (const obj of objs) {
                if (obj.events) {
                    for (const key of Object.keys(obj.events)) {
                        const val = obj.events[key];
                        if (!val || (typeof val === 'string' && val.trim() === '')) {
                            delete obj.events[key];
                        }
                    }
                }
                if (obj.Tasks) {
                    for (const key of Object.keys(obj.Tasks)) {
                        const val = obj.Tasks[key];
                        if (!val || (typeof val === 'string' && val.trim() === '')) {
                            delete obj.Tasks[key];
                        }
                    }
                }
                if (obj.children) cleanEmptyEvents(obj.children);
            }
        };
        cleanEmptyEvents(project.objects || []);
        cleanEmptyEvents(project.variables || []);
        project.stages?.forEach(s => {
            cleanEmptyEvents(s.objects || []);
            cleanEmptyEvents(s.variables || []);
        });

        this.logger.info(`Validation complete: ${issues.filter(i => i.level === 'error').length} errors, ${issues.filter(i => i.level === 'warning').length} warnings`);
        return issues;
    }

    /**
     * Löscht alle FlowChart-Daten für einen Task (global und in allen Stages).
     */
    public invalidateTaskFlow(taskName: string) {
        const project = this.controller.getProject();
        if (!project) return;
        if (project.flowCharts && project.flowCharts[taskName]) {
            delete project.flowCharts[taskName];
        }
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.flowCharts && s.flowCharts[taskName]) {
                    delete s.flowCharts[taskName];
                }
            });
        }
    }
}
