import { GameProject } from '../../model/types';
import { FlowElement } from '../flow/FlowElement';
import { FlowAction } from '../flow/FlowAction';
import { FlowTask } from '../flow/FlowTask';
import { FlowComponent } from '../flow/FlowComponent';
import { FlowVariable } from '../flow/FlowVariable';
import { FlowStart } from '../flow/FlowStart';
import { FlowConnection } from '../flow/FlowConnection';
import { libraryService } from '../../services/LibraryService';
import { serviceRegistry } from '../../services/ServiceRegistry';
import { projectRegistry } from '../../services/ProjectRegistry';

export interface FlowMapHost {
    project: GameProject | null;
    canvas: HTMLElement;
    nodes: FlowElement[];
    connections: FlowConnection[];
    currentFlowContext: string;
    showDetails: boolean;
    actionCheckMode: boolean;
    currentSelectedStageObjectId: string | null;
    filterText: string;
    flowStage: { cellSize: number };
    actionCheckBtn: HTMLButtonElement;
    getActiveStage: () => any;
    getCurrentObjects: () => any[];
    getAllVariables: () => any[];
    setupNodeListeners: (node: FlowElement) => void;
    setupConnectionListeners: (conn: FlowConnection) => void;
    updateScrollArea: () => void;
    onNodesChanged?: (nodes: FlowElement[]) => void;
}

export class FlowMapManager {
    private host: FlowMapHost;

    constructor(host: FlowMapHost) {
        this.host = host;
    }

    public toggleActionCheckMode(): void {
        this.host.actionCheckMode = !this.host.actionCheckMode;

        if (this.host.actionCheckMode) {
            this.host.actionCheckBtn.style.background = '#ff5722';
            this.host.actionCheckBtn.innerText = '🔴 Check AUS';
            this.highlightUnusedActions(true);
        } else {
            this.host.actionCheckBtn.style.background = '#e65100';
            this.host.actionCheckBtn.innerText = '🔍 Action-Check';
            this.highlightUnusedActions(false);
        }
    }

    public generateEventMap(): void {
        const project = this.host.project;
        if (!project) return;

        const startX = 50;
        const taskX = 600;
        let currentY = 50;
        const rowHeight = 80;
        const eventLinkSpacing = 80;
        const cellSize = this.host.flowStage.cellSize;

        const objectsWithTasks = this.host.getCurrentObjects().filter(obj => {
            const tasks = (obj as any).Tasks;
            const hasTasks = tasks && Object.keys(tasks).length > 0;

            let hasBindings = false;
            const checkBindings = (target: any) => {
                if (!target || hasBindings) return;
                Object.entries(target).forEach(([key, val]) => {
                    if (typeof val === 'string' && val.startsWith('${')) {
                        hasBindings = true;
                    } else if (key === 'style' && typeof val === 'object') {
                        checkBindings(val);
                    }
                });
            };
            checkBindings(obj);

            if (!hasTasks && !hasBindings) return false;

            if (this.host.filterText) {
                const nameMatches = obj.name.toLowerCase().includes(this.host.filterText);
                const taskNames = hasTasks ? Object.values(tasks) as string[] : [];
                const taskMatches = taskNames.some(t => t.toLowerCase().includes(this.host.filterText));
                const eventNames = hasTasks ? Object.keys(tasks) : [];
                const eventMatches = eventNames.some(e => e.toLowerCase().includes(this.host.filterText));

                return nameMatches || taskMatches || eventMatches || (hasBindings && obj.name.toLowerCase().includes(this.host.filterText));
            }
            return true;
        });

        const variablesWithTasks = this.host.getAllVariables().filter(v => {
            const topLevelEvents = Object.keys(v).filter(k => k.startsWith('on') && (v as any)[k]);
            const taskEvents = (v as any).Tasks ? Object.keys((v as any).Tasks).filter(k => k.startsWith('on') && (v as any).Tasks[k]) : [];
            const hasTasks = topLevelEvents.length > 0 || taskEvents.length > 0;

            if (!hasTasks) return false;

            if (this.host.filterText) {
                const nameMatches = v.name.toLowerCase().includes(this.host.filterText);
                const taskMatches = [...topLevelEvents.map(e => (v as any)[e]), ...taskEvents.map(e => (v as any).Tasks[e])]
                    .some(t => String(t).toLowerCase().includes(this.host.filterText));
                const eventMatches = [...topLevelEvents, ...taskEvents].some(e => e.toLowerCase().includes(this.host.filterText));
                return nameMatches || taskMatches || eventMatches;
            }
            return true;
        });

        // 1. Process Objects
        objectsWithTasks.forEach(obj => {
            const objNode = new FlowComponent('proxy-' + obj.id, startX, currentY, this.host.canvas, cellSize);
            objNode.Name = obj.name;
            objNode.autoSize();
            objNode.Details = (obj as any).className || 'Object';

            const bindings: Record<string, any> = {};
            const gatherBindings = (target: any, prefix = '') => {
                if (!target) return;
                Object.entries(target).forEach(([key, val]) => {
                    if (typeof val === 'string' && val.startsWith('${')) {
                        bindings[prefix + key] = val;
                    } else if (key === 'style' && typeof val === 'object') {
                        gatherBindings(val, 'style.');
                    }
                });
            };
            gatherBindings(obj);

            objNode.data = {
                stageObjectId: obj.id,
                isProxy: true,
                paramValues: bindings
            };
            objNode.setShowDetails(this.host.showDetails && Object.keys(bindings).length > 0);

            if (obj.id === this.host.currentSelectedStageObjectId) {
                objNode.getElement().style.background = '#444400';
                objNode.getElement().style.border = '2px solid #ffcc00';
            }

            this.host.nodes.push(objNode);
            this.host.setupNodeListeners(objNode);

            const taskMappings = (obj as any).Tasks || {};
            const events = Object.entries(taskMappings);
            events.forEach(([eventName, taskName], idx) => {
                if (typeof taskName !== 'string' || !taskName) return;

                const taskY = currentY + (idx * eventLinkSpacing);
                const taskNode = this.createMapTaskNode(taskName, eventName, taskX, taskY, obj.id);
                this.host.nodes.push(taskNode);
                this.host.setupNodeListeners(taskNode);

                this.createEventLink(objNode, taskNode, obj.name, eventName);
            });

            currentY += Math.max(rowHeight, events.length * eventLinkSpacing + 20);
        });

        // 2. Process Variables
        variablesWithTasks.forEach(variable => {
            const varId = variable.id || variable.name;
            const varNode = new FlowVariable('proxy-var-' + varId, startX, currentY, this.host.canvas, cellSize);
            varNode.VarName = variable.name;
            varNode.VarType = variable.type;
            varNode.autoSize();

            this.host.nodes.push(varNode);
            this.host.setupNodeListeners(varNode);

            const topLevelEvents = Object.entries(variable)
                .filter(([k, v]) => k.startsWith('on') && typeof v === 'string' && v) as [string, string][];
            const taskEvents = (variable as any).Tasks ? Object.entries((variable as any).Tasks)
                .filter(([k, v]) => k.startsWith('on') && typeof v === 'string' && v) as [string, string][] : [];

            const eventMap = new Map<string, string>();
            taskEvents.forEach(([k, v]) => eventMap.set(k, v));
            topLevelEvents.forEach(([k, v]) => eventMap.set(k, v));

            const events = Array.from(eventMap.entries());

            events.forEach(([eventName, taskName], idx) => {
                const taskY = currentY + (idx * eventLinkSpacing);
                const taskNode = this.createMapTaskNode(taskName, eventName, taskX, taskY, varId);
                this.host.nodes.push(taskNode);
                this.host.setupNodeListeners(taskNode);

                this.createEventLink(varNode, taskNode, variable.name, eventName);
            });

            currentY += Math.max(rowHeight, events.length * eventLinkSpacing + 20);
        });

        if (this.host.onNodesChanged) {
            this.host.onNodesChanged(this.host.nodes);
        }

        this.host.updateScrollArea();
    }

    public generateElementOverview(): void {
        const project = this.host.project;
        if (!project) return;

        const actionX = 50;
        const gridSize = this.host.flowStage.cellSize;

        const snappedActionX = Math.round(actionX / gridSize) * gridSize;
        let currentActionY = Math.round(90 / gridSize) * gridSize;
        let currentTaskY = Math.round(90 / gridSize) * gridSize;
        const spacingY = Math.round(70 / gridSize) * gridSize;
        const baseNodeHeight = gridSize * 3;

        const measureTextWidth = (text: string, fontSize: number = 14): number => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return 150;
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            return ctx.measureText(text).width;
        };

        const activeStage = this.host.getActiveStage();

        let maxActionWidth = 150;
        const actionMap = new Map<string, any>();
        (project.actions || []).forEach((a: any) => actionMap.set(a.name, a));
        (activeStage?.actions || []).forEach((a: any) => actionMap.set(a.name, a));
        const currentActions = Array.from(actionMap.values());
        currentActions.forEach((a: any) => {
            const width = measureTextWidth(a.name || "") + 60;
            if (width > maxActionWidth) maxActionWidth = width;
        });

        let maxTaskWidth = 150;
        const taskMap = new Map<string, any>();
        (project.tasks || []).forEach((t: any) => taskMap.set(t.name, t));
        (activeStage?.tasks || []).forEach((t: any) => taskMap.set(t.name, t));
        const currentTasks = Array.from(taskMap.values());
        currentTasks.forEach((t: any) => {
            const width = measureTextWidth(t.name || "") + 60;
            if (width > maxTaskWidth) maxTaskWidth = width;
        });

        const taskX = actionX + maxActionWidth + 80;

        let maxVarWidth = 150;
        const varMap = new Map<string, any>();
        (project.variables || []).forEach((v: any) => varMap.set(v.name, v));
        (activeStage?.variables || []).forEach((v: any) => varMap.set(v.name, v));
        const currentVariables = Array.from(varMap.values());
        currentVariables.forEach((v: any) => {
            const width = measureTextWidth(v.name || "") + 60;
            if (width > maxVarWidth) maxVarWidth = width;
        });
        const varX = taskX + maxTaskWidth + 80;

        const stageRelevantTasks = new Set<string>();
        const usedActions = new Set<string>();

        const activeStageId = activeStage ? activeStage.id : null;
        const isGlobalView = !activeStage || activeStage.type === 'main';

        this.host.getCurrentObjects().forEach(obj => {
            const mappings = (obj as any).Tasks || {};
            Object.values(mappings).forEach(t => {
                if (typeof t === 'string') stageRelevantTasks.add(t);
            });
        });

        const relevantVars = [...(project.variables || []), ...(activeStage?.variables || [])];
        relevantVars.forEach(v => {
            Object.entries(v).forEach(([k, val]) => {
                if (k.startsWith('on') && typeof val === 'string' && val) {
                    stageRelevantTasks.add(val);
                }
            });
            const taskMappings = (v as any).Tasks || {};
            Object.values(taskMappings).forEach(t => {
                if (typeof t === 'string' && t) stageRelevantTasks.add(t);
            });
        });

        if (activeStage?.flowCharts) {
            Object.keys(activeStage.flowCharts).forEach(taskName => {
                if (taskName !== 'global') stageRelevantTasks.add(taskName);
            });
        }

        currentTasks.forEach((t: any) => {
            if (stageRelevantTasks.has(t.name) && t.actionSequence) {
                const processSeq = (seq: any[]) => {
                    seq.forEach(item => {
                        if (item.type === 'action' && item.name) usedActions.add(item.name);
                        if (item.type === 'condition') {
                            if (item.thenAction) usedActions.add(item.thenAction);
                            if (item.elseAction) usedActions.add(item.elseAction);
                        }
                    });
                };
                processSeq(t.actionSequence);
            }
        });

        const relevantCharts: any = {};
        if (activeStage?.flowCharts) {
            Object.entries(activeStage.flowCharts).forEach(([name, chart]) => {
                if (name !== 'global') relevantCharts[name] = chart;
            });
        }

        Object.values(relevantCharts).forEach((chart: any) => {
            (chart.elements || []).forEach((el: any) => {
                const name = el.data?.name || el.data?.actionName || el.properties?.name;
                if (el.type === 'Action' && name) usedActions.add(name);
                if (el.type === 'Condition' && el.data) {
                    if (el.data.thenAction) usedActions.add(el.data.thenAction);
                    if (el.data.elseAction) usedActions.add(el.data.elseAction);
                }
            });
        });

        const objectStageMap = new Map<string, string>();
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.objects) {
                    stage.objects.forEach((obj: any) => {
                        objectStageMap.set(obj.name, stage.id);
                    });
                }
            });
        }
        project.objects.forEach(obj => {
            if (!objectStageMap.has(obj.name)) objectStageMap.set(obj.name, 'legacy_main');
        });

        const globalServices = new Set(serviceRegistry.listServices());
        const globalSingletons = new Set(['StageController', 'GameState', 'InputController', 'GameLoop', 'RemoteGameManager', 'Player1', 'Player2']);

        const localActions = activeStage?.actions || [];

        const actionItems = currentActions
            .map((action: any) => {
                const isLocal = localActions.some((la: any) => la.name === action.name);
                return { action, isLocal };
            })
            .filter((item: { action: any, isLocal: boolean }) => {
                const action = item.action;
                const actionName = action.name || "";
                const isLocal = item.isLocal;

                // Apply filterText if set (Priority: Filter FIRST)
                const filterText = (this.host as any).filterText;
                if (filterText && !actionName.toLowerCase().includes(filterText)) {
                    return false;
                }

                if (isLocal) return true;
                if (isGlobalView) return true;

                const dotIndex = actionName.indexOf('.');
                const prefix = dotIndex !== -1 ? actionName.substring(0, dotIndex) : null;

                if (prefix && (globalServices.has(prefix) || globalSingletons.has(prefix))) {
                    if (prefix === 'StageController') {
                        const method = action.method || (action as any).methodName;
                        if (method === 'goToStage') {
                            const targetStageId = action.params && action.params[0];
                            if (targetStageId === activeStageId) return false;
                        }
                        if (method === 'goToMainStage' && activeStage?.type === 'main') return false;
                    }
                    return true;
                }

                if (usedActions.has(actionName)) return true;

                const targetsToCheck = [prefix, action.target, (action as any).targetName, action.source].filter(Boolean) as string[];
                for (const t of targetsToCheck) {
                    if (objectStageMap.has(t)) {
                        // If it belongs to a SPECIFIC other stage, we still show it in the overview 
                        // but it might be filtered in the Link Map.
                        // For the general overview, we keep it.
                    }
                }

                const lowerName = actionName.toLowerCase();
                const words = lowerName.split(/[\s\._]+/).filter((w: string) => w.length > 2);

                for (const [objName] of objectStageMap.entries()) {
                    const lowerObj = objName.toLowerCase();
                    if (lowerName.includes(lowerObj) || words.some((w: string) => lowerObj.includes(w))) {
                        return true;
                    }
                }

                // Default: If no clear stage assignment, show it unless assigned to another stage
                return true;
            });

        const actionCounts = new Map<string, number>();
        project.actions.forEach(a => {
            actionCounts.set(a.name, (actionCounts.get(a.name) || 0) + 1);
        });

        const headerY = Math.round(20 / gridSize) * gridSize;

        const actionHeader = new FlowStart('header-actions', snappedActionX, headerY, this.host.canvas, gridSize);
        actionHeader.Text = "Alle Actions";
        actionHeader.Width = maxActionWidth;
        actionHeader.Height = 40;
        actionHeader.getElement().style.color = "#00ffff";
        actionHeader.getElement().style.fontWeight = "bold";
        actionHeader.getElement().style.textAlign = "center";
        this.host.nodes.push(actionHeader);

        const taskHeader = new FlowStart('header-tasks', taskX, headerY, this.host.canvas, gridSize);
        taskHeader.Text = "Alle Tasks";
        taskHeader.Width = maxTaskWidth;
        taskHeader.Height = 40;
        taskHeader.getElement().style.color = "#00ff00";
        taskHeader.getElement().style.fontWeight = "bold";
        taskHeader.getElement().style.textAlign = "center";
        this.host.nodes.push(taskHeader);

        const varHeader = new FlowStart('header-vars', varX, headerY, this.host.canvas, gridSize);
        varHeader.Text = "Alle Variablen";
        varHeader.Width = maxVarWidth;
        varHeader.Height = 40;
        varHeader.getElement().style.color = "#ffcc00";
        varHeader.getElement().style.fontWeight = "bold";
        varHeader.getElement().style.textAlign = "center";
        this.host.nodes.push(varHeader);

        actionItems.sort((a: any, b: any) => (a.action.name || "").localeCompare(b.action.name || ""));

        actionItems.forEach((item: any, displayIdx: number) => {
            const action = item.action;
            const refs = projectRegistry.findReferences(action.name);
            const isUsed = refs.length > 0;
            const isDuplicate = (actionCounts.get(action.name) || 0) > 1;

            const nodeId = 'over-action-' + displayIdx + '-' + (action.name || 'unnamed').replace(/\s+/g, '_');
            const node = new FlowAction(nodeId, snappedActionX, currentActionY, this.host.canvas, gridSize);

            node.Name = action.name || "Unbenannte Aktion";
            node.setText(node.Name);
            node.Width = maxActionWidth;
            node.Height = baseNodeHeight;

            node.data = { ...action, isOverviewLink: true, type: action.type || 'Action', canDelete: !isUsed, originalIndex: item.originalIndex };
            node.setDetailed(true);

            (node as any).setUsageInfo(refs);
            if (!isUsed) node.setUnused(true);
            if (isDuplicate) node.setDuplicate(true);

            this.host.nodes.push(node);
            this.host.setupNodeListeners(node);
            currentActionY += spacingY;
        });

        const localTasks = activeStage?.tasks || [];
        const taskItems = currentTasks
            .map((task: any) => {
                const isLocal = localTasks.some((lt: any) => lt.name === task.name);
                return { task, isLocal };
            })
            .filter((item: any) => {
                const task = item.task;
                const taskName = task.name || "";
                const isLocal = item.isLocal;

                // Apply filterText (Priority: Filter FIRST)
                const filterText = (this.host as any).filterText;
                if (filterText && !taskName.toLowerCase().includes(filterText)) {
                    return false;
                }

                if (isLocal) return true;
                if (isGlobalView) return true;

                if (stageRelevantTasks.has(taskName)) return true;

                // Default: Show if no specific stage assignment excludes it (balanced view)
                return true;
            });

        taskItems.sort((a: any, b: any) => (a.task.name || "").localeCompare(b.task.name || ""));

        taskItems.forEach((item: any, displayIdx: number) => {
            const task = item.task;
            const refs = projectRegistry.findReferences(task.name);
            const isUsed = refs.length > 0;

            const nodeId = 'over-task-' + displayIdx + '-' + (task.name || 'unnamed').replace(/\s+/g, '_');
            const node = new FlowTask(nodeId, taskX, currentTaskY, this.host.canvas, gridSize);

            node.Name = task.name || "Unbenannter Task";
            node.setText(node.Name);
            node.Width = maxTaskWidth;
            node.Height = baseNodeHeight;

            let usedLibraryTaskName: string | null = null;
            const flowData = activeStage?.flowCharts?.[task.name] ||
                project.flowCharts?.[task.name] ||
                (task as any)?.flowChart ||
                (task as any)?.flowGraph;

            if (flowData?.elements) {
                for (const el of flowData.elements) {
                    const elTaskName = el.data?.taskName;
                    if (elTaskName && libraryService.getTask(elTaskName)) {
                        usedLibraryTaskName = elTaskName;
                        break;
                    }
                }
            }

            const isLibraryBased = !!usedLibraryTaskName;
            if (isLibraryBased) {
                node.setLinked(true);
                node.Details = `📚 ${usedLibraryTaskName}`;
            }

            node.data = {
                isOverviewLink: true,
                type: 'Task',
                canDelete: !isUsed,
                taskName: task.name,
                isLocal: item.isLocal,
                isLibraryBased,
                usedLibraryTaskName
            };
            node.setDetailed(true);

            (node as any).setUsageInfo(refs);
            if (!isUsed) node.setUnused(true);

            if (item.isLocal) {
                node.getElement().style.borderLeft = '6px solid #00ff00';
                node.getElement().title = 'Stage-lokaler Task';
            }

            this.host.nodes.push(node);
            this.host.setupNodeListeners(node);
            currentTaskY += spacingY;
        });

        let currentVarY = Math.round(90 / gridSize) * gridSize;
        currentVariables.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        currentVariables.forEach((v, idx) => {
            const refs = projectRegistry.findReferences(v.name);
            const isUsed = refs.length > 0;

            const nodeId = 'over-var-' + idx + '-' + (v.name || 'unnamed').replace(/\s+/g, '_');
            const node = new FlowComponent(nodeId, varX, currentVarY, this.host.canvas, gridSize);

            node.Name = v.name || "Unbenannte Variable";
            node.setText(node.Name);
            node.Width = maxVarWidth;
            node.Height = baseNodeHeight;

            node.data = { isOverviewLink: true, type: 'VariableDecl', canDelete: !isUsed };
            node.setDetailed(true);

            (node as any).setUsageInfo(refs);
            if (!isUsed) node.setUnused(true);

            this.host.nodes.push(node);
            this.host.setupNodeListeners(node);
            currentVarY += spacingY;
        });

        this.host.updateScrollArea();
    }

    private createMapTaskNode(taskName: string, eventName: string, x: number, y: number, sourceId: string): FlowTask {
        const taskNode = new FlowTask('map-task-' + eventName + '-' + taskName + '-' + sourceId, x, y, this.host.canvas, this.host.flowStage.cellSize);
        taskNode.Text = taskName;
        taskNode.autoSize();

        const taskDef = this.host.project!.tasks.find((t: any) => t.name === taskName);
        if (taskDef && taskDef.description) {
            taskNode.Description = taskDef.description;
        }

        let usedLibraryTaskName: string | null = null;
        const flowData = (taskDef as any)?.flowChart || (taskDef as any)?.flowGraph ||
            this.host.project!.flowCharts?.[taskName];

        if (flowData?.elements) {
            for (const el of flowData.elements) {
                const elTaskName = el.data?.taskName;
                if (elTaskName && libraryService.getTask(elTaskName)) {
                    usedLibraryTaskName = elTaskName;
                    break;
                }
            }
        }

        const isLibraryBased = !!usedLibraryTaskName;
        if (isLibraryBased) {
            taskNode.setLinked(true);
            taskNode.Details = `📚 ${usedLibraryTaskName}`;
        }

        taskNode.data = {
            taskName: taskName,
            eventName: eventName,
            stageObjectId: sourceId,
            isMapLink: true,
            isLibraryBased,
            usedLibraryTaskName
        };
        taskNode.setDetailed(isLibraryBased);
        return taskNode;
    }

    private createEventLink(sourceNode: FlowElement, targetNode: FlowElement, sourceName: string, eventName: string) {
        const conn = new FlowConnection(this.host.canvas, 0, 0, 0, 0);
        conn.setGridConfig(this.host.flowStage.cellSize);
        conn.attachStart(sourceNode);
        conn.attachEnd(targetNode);
        conn.data = {
            objectName: sourceName,
            eventName: eventName,
            isMapLink: true
        };
        conn.Text = eventName;
        conn.updatePosition();
        this.host.connections.push(conn);
        this.host.setupConnectionListeners(conn);
    }

    public highlightUnusedActions(highlight: boolean): void {
        const unusedDetails: any[] = [];
        let unusedActionCount = 0;
        let unusedTaskCount = 0;
        let unusedVariableCount = 0;

        if (highlight) {
            console.group(`[FlowEditor] Action-Check Result`);
        }

        this.host.nodes.forEach(node => {
            const nodeType = node.getType();
            const isUnused = node.data?.canDelete === true;
            const name = node.Name || (node as any).taskName || "unknown";

            if ((nodeType === 'Action' || nodeType === 'Task' || nodeType === 'VariableDecl' || nodeType === 'TVariable') && isUnused) {
                unusedDetails.push({
                    Type: nodeType,
                    Name: name,
                    Refs: (node.data?.references || []).length > 0 ? node.data.references : "(Keine Referenzen gefunden!)"
                });

                const el = node.getElement();

                if (nodeType === 'Action') unusedActionCount++;
                if (nodeType === 'Task') unusedTaskCount++;
                if (nodeType === 'VariableDecl' || nodeType === 'TVariable') unusedVariableCount++;

                if (highlight) {
                    el.style.outline = '4px solid #ff5722';
                    el.style.boxShadow = '0 0 20px rgba(255, 87, 34, 0.8)';
                    el.style.animation = 'pulse-unused 1s infinite alternate';

                    if (!document.getElementById('unused-action-styles')) {
                        const style = document.createElement('style');
                        style.id = 'unused-action-styles';
                        style.textContent = `
                            @keyframes pulse-unused {
                                from { box-shadow: 0 0 10px rgba(255, 87, 34, 0.6); }
                                to { box-shadow: 0 0 25px rgba(255, 87, 34, 1); }
                            }
                        `;
                        document.head.appendChild(style);
                    }
                } else {
                    el.style.outline = '';
                    el.style.boxShadow = '';
                    el.style.animation = '';
                }
            }
        });

        if (highlight) {
            console.log(`Found ${unusedActionCount} Actions, ${unusedTaskCount} Tasks unused.`);
            if (unusedDetails.length > 0) {
                console.table(unusedDetails);
            } else {
                console.log("Alles super! Keine ungenutzten Elemente gefunden.");
            }
            console.groupEnd();
        }
    }
}
