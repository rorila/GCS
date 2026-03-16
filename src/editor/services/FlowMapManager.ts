import { GameProject } from '../../model/types';
import { FlowElement } from '../flow/FlowElement';
import { FlowAction } from '../flow/FlowAction';
import { FlowTask } from '../flow/FlowTask';
import { FlowComponent } from '../flow/FlowComponent';
import { FlowVariable } from '../flow/FlowVariable';

import { FlowConnection } from '../flow/FlowConnection';
import { libraryService } from '../../services/LibraryService';
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
        let currentVarY = Math.round(90 / gridSize) * gridSize;

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
        const isBlueprint = activeStage?.type === 'blueprint' || activeStage?.id === 'stage_blueprint';
        const usage = projectRegistry.getLogicalUsage();

        // 1. Prepare Widths and Maps
        let maxActionWidth = 150;
        const actionMap = new Map<string, any>();

        if (isBlueprint) {
            // Blueprint: Nur globale Actions
            (project.actions || []).forEach((a: any) => actionMap.set(a.name, a));
        } else if (activeStage) {
            // Standard-Stage: Nur lokale Actions
            (activeStage.actions || []).forEach((a: any) => actionMap.set(a.name, a));
        }

        const currentActions = Array.from(actionMap.values());
        currentActions.forEach((a: any) => {
            const width = measureTextWidth(a.name || "") + 60;
            if (width > maxActionWidth) maxActionWidth = width;
        });

        let maxTaskWidth = 150;
        const taskMap = new Map<string, any>();

        if (isBlueprint) {
            // Blueprint: Nur globale Tasks
            (project.tasks || []).forEach((t: any) => taskMap.set(t.name, t));
        } else if (activeStage) {
            // Standard-Stage: Nur lokale Tasks
            (activeStage.tasks || []).forEach((t: any) => taskMap.set(t.name, t));
        }

        const currentTasks = Array.from(taskMap.values());
        currentTasks.forEach((t: any) => {
            const width = measureTextWidth(t.name || "") + 60;
            if (width > maxTaskWidth) maxTaskWidth = width;
        });

        const taskX = actionX + maxActionWidth + 80;

        let maxVarWidth = 150;
        const varMap = new Map<string, any>();

        if (isBlueprint) {
            // Blueprint: Nur globale Variablen
            (project.variables || []).forEach((v: any) => varMap.set(v.name, v));
        } else if (activeStage) {
            // Standard-Stage: Nur lokale Variablen
            (activeStage.variables || []).forEach((v: any) => varMap.set(v.name, v));
        }

        const currentVariables = Array.from(varMap.values());
        currentVariables.forEach((v: any) => {
            const width = measureTextWidth(v.name || "") + 60;
            if (width > maxVarWidth) maxVarWidth = width;
        });
        const varX = taskX + maxTaskWidth + 80;

        // 2. Render Headers
        const headerY = Math.round(20 / gridSize) * gridSize;
        const createHeader = (id: string, x: number, text: string, color: string, width: number) => {
            const header = new FlowTask(id, x, headerY, this.host.canvas, gridSize);
            header.Text = text;
            header.Width = width;
            header.Height = 40;
            header.getElement().style.color = color;
            header.getElement().style.fontWeight = "bold";
            header.getElement().style.textAlign = "center";
            this.host.nodes.push(header);
        };
        createHeader('header-actions', snappedActionX, "Alle Actions", "#00ffff", maxActionWidth);
        createHeader('header-tasks', taskX, "Alle Tasks", "#00ff00", maxTaskWidth);
        createHeader('header-vars', varX, "Alle Variablen", "#ffcc00", maxVarWidth);

        // 3. Render Actions
        const filterText = (this.host as any).filterText?.toLowerCase();
        currentActions
            .filter(a => !filterText || (a.name || "").toLowerCase().includes(filterText))
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .forEach((action, idx) => {
                const isUsed = usage.actions.has(action.name);
                const refs = projectRegistry.findReferences(action.name);

                const node = new FlowAction('over-action-' + idx, snappedActionX, currentActionY, this.host.canvas, gridSize);
                node.Name = action.name || "Unbenannte Aktion";
                node.setText(node.Name);
                node.Width = maxActionWidth;
                node.Height = baseNodeHeight;
                node.data = { ...action, isOverviewLink: true, type: 'action', canDelete: !isUsed };
                node.setDetailed(true);
                (node as any).setUsageInfo(refs);
                if (!isUsed) node.setUnused(true);

                this.host.nodes.push(node);
                this.host.setupNodeListeners(node);
                currentActionY += spacingY;
            });

        // 4. Render Tasks
        currentTasks
            .filter(t => !filterText || (t.name || "").toLowerCase().includes(filterText))
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .forEach((task, idx) => {
                const isUsed = usage.tasks.has(task.name);
                const refs = projectRegistry.findReferences(task.name);
                const isLocal = (activeStage?.tasks || []).some((lt: any) => lt.name === task.name);

                // Filter logic: Only show if local, or if global on blueprint stage
                if (!isLocal && !isBlueprint) return;

                const node = new FlowTask('over-task-' + idx, taskX, currentTaskY, this.host.canvas, gridSize);
                node.Name = task.name || "Unbenannter Task";
                node.setText(node.Name);
                node.Width = maxTaskWidth;
                node.Height = baseNodeHeight;

                // Library Check
                let usedLib = null;
                const flow = activeStage?.flowCharts?.[task.name] || project.flowCharts?.[task.name] || (task as any).flowChart;
                if (flow?.elements) {
                    for (const el of flow.elements) {
                        if (el.data?.taskName && libraryService.getTask(el.data.taskName)) {
                            usedLib = el.data.taskName;
                            break;
                        }
                    }
                }

                if (usedLib) {
                    node.setLinked(true);
                    node.Details = `📚 ${usedLib}`;
                }

                node.data = { isOverviewLink: true, type: 'task', canDelete: !isUsed, taskName: task.name, isLocal };
                node.setDetailed(true);
                (node as any).setUsageInfo(refs);
                if (!isUsed) node.setUnused(true);
                if (isLocal) {
                    node.getElement().style.borderLeft = '6px solid #00ff00';
                    const currentTitle = node.getElement().title || "";
                    node.getElement().title = (currentTitle ? currentTitle + "\n---\n" : "") + '📍 Stage-lokaler Task';
                }

                this.host.nodes.push(node);
                this.host.setupNodeListeners(node);
                currentTaskY += spacingY;
            });

        // 5. Render Variables
        currentVariables
            .filter(v => !filterText || (v.name || "").toLowerCase().includes(filterText))
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .forEach((v, idx) => {
                const isUsed = usage.variables.has(v.name);
                const refs = projectRegistry.findReferences(v.name);

                const node = new FlowComponent('over-var-' + idx, varX, currentVarY, this.host.canvas, gridSize);
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
        this.host.nodes.forEach(node => {
            const el = node.getElement();
            el.style.outline = '';
            el.style.boxShadow = '';
            el.style.animation = '';
        });

        if (!highlight) return;

        const usage = projectRegistry.getLogicalUsage();
        const unusedDetails: any[] = [];
        let unusedActionCount = 0;
        let unusedTaskCount = 0;
        let unusedVariableCount = 0;

        console.group(`[FlowEditor] Action-Check Result`);

        this.host.nodes.forEach(node => {
            const nodeType = node.getType();
            let name = (node as any).Name || (node as any).taskName || "unknown";
            name = name.trim();
            let isUnused = false;

            if (nodeType === 'action') {
                isUnused = !usage.actions.has(name);
                if (isUnused) {
                    unusedActionCount++;
                    // console.log(`  [Check] Action "${name}" (ID: ${node.id}) is UNUSED. Usage Set contains:`, Array.from(usage.actions));
                }
            } else if (nodeType === 'task') {
                isUnused = !usage.tasks.has(name);
                if (isUnused) unusedTaskCount++;
            } else if (nodeType === 'VariableDecl' || nodeType === 'TVariable') {
                isUnused = !usage.variables.has(name);
                if (isUnused) unusedVariableCount++;
            }

            if (isUnused) {
                unusedDetails.push({
                    Type: nodeType,
                    Name: name
                });

                const el = node.getElement();
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
            }
        });

        console.log(`Found ${unusedActionCount} Actions, ${unusedTaskCount} Tasks, ${unusedVariableCount} Variables unused.`);
        if (unusedDetails.length > 0) {
            console.table(unusedDetails);
        } else {
            console.log("Alles super! Keine ungenutzten Elemente gefunden.");
        }
        console.groupEnd();
    }
}
