import { GameProject } from '../../model/types';
import { FlowElement } from '../flow/FlowElement';
import { FlowConnection } from '../flow/FlowConnection';
import { FlowTask } from '../flow/FlowTask';
import { ContextMenu, ContextMenuItem } from '../ui/ContextMenu';
import { projectRegistry } from '../../services/ProjectRegistry';
import { libraryService } from '../../services/LibraryService';
import { FlowNamingService } from './FlowNamingService';

export interface FlowContextMenuHost {
    project: GameProject | null;
    nodes: FlowElement[];
    currentFlowContext: string;
    contextMenu: ContextMenu;
    switchActionFlow: (context: string) => void;
    deleteNode: (node: FlowElement) => void;
    deleteConnection: (conn: FlowConnection) => void;
    removeNode: (name: string) => void;
    syncToProject: () => void;
    handleNodeDoubleClick: (node: FlowElement) => void;
    importTaskGraph: (node: FlowElement, task: any, isLinked?: boolean) => any;
    updateFlowSelector: () => void;
    onProjectChange?: () => void;
    getTargetFlowCharts: (context: string) => any;
    syncManager: any; // For global action updates
    createNode: (type: string, x: number, y: number, initialName?: string) => FlowElement | null;
}

export class FlowContextMenuProvider {
    private host: FlowContextMenuHost;

    constructor(host: FlowContextMenuHost) {
        this.host = host;
    }

    public handleNodeContextMenu(e: MouseEvent, node: FlowElement): void {
        const proj = this.host.project;
        if (!proj) return;

        // For embedded nodes, show limited context menu
        if (node.data?.isLinked || node.data?.isEmbeddedInternal) {
            this.showEmbeddedContextMenu(e, node);
            return;
        }

        const items: ContextMenuItem[] = [];

        // 1. Basic Actions
        if (this.host.currentFlowContext === 'event-map' && node.data?.isMapLink && node.data?.taskName) {
            items.push({
                label: '➔ Gehe zum Task-Workflow',
                action: () => this.host.switchActionFlow(node.data.taskName)
            });
        }

        items.push({
            label: 'Bearbeiten...',
            action: () => this.host.handleNodeDoubleClick(node)
        });

        const elementName = node.Name || node.id;
        const liveRefs = projectRegistry.findReferences(elementName);
        const refCount = liveRefs.length;

        items.push({
            label: refCount > 0 ? `Löschen (${refCount} Referenz${refCount !== 1 ? 'en' : ''})` : 'Löschen',
            action: () => this.host.deleteNode(node),
            color: '#ff4444'
        });

        // Expansion Option for Tasks
        if (node instanceof FlowTask) {
            const taskDef = node.getTaskDefinition();
            const flowChart = (proj as any)?.flowCharts?.[node.Name] || taskDef?.flowChart;
            const hasGhosts = this.host.nodes.some(n => n.data?.parentProxyId === node.id);
            const isExpanded = node.data?.isExpanded && hasGhosts;

            if (flowChart && flowChart.elements?.length > 0 && !isExpanded) {
                items.push({
                    label: '📂 Ausklappen (Aktionen zeigen)',
                    action: () => this.host.handleNodeDoubleClick(node)
                });
                items.push({ separator: true, label: '' });
            }
        }

        // 2. Assign Actions (Reuse)
        if (node.getType() === 'Task') {
            const linkItems: ContextMenuItem[] = proj.tasks.map(t => ({
                label: t.name,
                action: () => this.assignTaskToNode(node, t)
            }));

            if (linkItems.length > 0) {
                items.push({
                    label: 'Use Existing Task (Link)',
                    submenu: linkItems
                });
            }

            const importItems: ContextMenuItem[] = proj.tasks.map(t => ({
                label: t.name,
                action: () => this.host.importTaskGraph(node, t)
            }));

            if (importItems.length > 0) {
                items.push({
                    label: 'Embed Task (Copy Structure)',
                    submenu: importItems
                });
            }

            const libraryTasks = libraryService.getTasks();
            if (libraryTasks.length > 0) {
                const libraryItems: ContextMenuItem[] = libraryTasks.map(t => ({
                    label: `📋 ${t.name}`,
                    action: () => this.copyLibraryTaskAsTemplate(node, t)
                }));
                items.push({
                    label: '📚 Library-Task als Vorlage',
                    submenu: libraryItems
                });
            }
        } else if (node.getType() === 'Action') {
            const linkItems: ContextMenuItem[] = proj.actions.map(a => ({
                label: a.name,
                action: () => this.linkActionToNode(node, a)
            }));

            if (linkItems.length > 0) {
                items.push({
                    label: 'Use Existing Action (Link)',
                    submenu: linkItems
                });
            }

            const copyItems: ContextMenuItem[] = proj.actions.map(a => ({
                label: a.name,
                action: () => this.copyActionToNode(node, a)
            }));

            if (copyItems.length > 0) {
                items.push({
                    label: 'Embed Action (Copy)',
                    submenu: copyItems
                });
            }
        }

        this.host.contextMenu.show(e.clientX, e.clientY, items);
    }

    private showEmbeddedContextMenu(e: MouseEvent, node: FlowElement): void {
        const items: ContextMenuItem[] = [];
        const typeLabel = node.getType() === 'Task' ? 'Task' : 'Aktion';
        items.push({
            label: `Eingebettete ${typeLabel} löschen`,
            action: () => {
                const groupId = node.data?.embeddedGroupId;
                const nodesToDelete = groupId
                    ? this.host.nodes.filter(n => n.data?.embeddedGroupId === groupId)
                    : [node];

                const count = nodesToDelete.length;
                if (confirm(`Möchtest du die eingebettete ${typeLabel} (${count} Elemente) wirklich löschen?`)) {
                    nodesToDelete.forEach(n => this.host.removeNode(n.id));

                    const anyGhost = nodesToDelete[0];
                    if (anyGhost && anyGhost.data?.parentProxyId) {
                        const proxy = this.host.nodes.find(n => n.id === anyGhost.data.parentProxyId);
                        if (proxy && proxy.data) {
                            proxy.data.isExpanded = false;
                        }
                    }
                    this.host.syncToProject();
                }
            }
        });

        items.push({ separator: true, label: '' });

        items.push({
            label: '➔ Zum Original-Flow springen',
            action: () => {
                const taskName = node.data?.taskName || node.data?.name || 'original';
                this.host.switchActionFlow(taskName);
            }
        });

        this.host.contextMenu.show(e.clientX, e.clientY, items);
    }

    public handleCanvasContextMenu(e: MouseEvent): void {
        e.preventDefault();
        e.stopPropagation();

        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const items: ContextMenuItem[] = [
            {
                label: '⚡ Aktion hinzufügen',
                action: () => this.host.createNode('Action', x, y)
            },
            {
                label: '💎 Bedingung hinzufügen',
                action: () => this.host.createNode('Condition', x, y)
            },
            {
                label: '📁 Task hinzufügen',
                action: () => this.host.createNode('Task', x, y)
            },
            {
                label: '🗄️ Daten-Aktion hinzufügen',
                action: () => this.host.createNode('DataAction', x, y)
            }
        ];

        this.host.contextMenu.show(e.clientX, e.clientY, items);
    }

    public handleConnectionContextMenu(e: MouseEvent, conn: FlowConnection): void {
        e.preventDefault();
        e.stopPropagation();

        const items: ContextMenuItem[] = [
            { label: 'Verbindung löschen', action: () => this.host.deleteConnection(conn), color: '#ff4444' }
        ];
        this.host.contextMenu.show(e.clientX, e.clientY, items);
    }

    private assignTaskToNode(node: FlowElement, task: any): void {
        this.host.importTaskGraph(node, task, true);
    }

    private linkActionToNode(node: FlowElement, action: any): void {
        node.data = { ...node.data, name: action.name, isLinked: true };
        node.setText(action.name);
        node.setDetailed(true);
        node.setLinked(true);
        if (action.description) node.Description = action.description;
        this.host.syncToProject();
    }

    private copyActionToNode(node: FlowElement, action: any): void {
        if (!this.host.project) return;
        const originalName = action.name;
        const newName = FlowNamingService.generateUniqueActionName(this.host.project, this.host.nodes, `${originalName}_Copy`);

        const actionCopy = JSON.parse(JSON.stringify(action));
        actionCopy.name = newName;
        this.host.project.actions.push(actionCopy);

        node.data = { ...node.data, name: newName, isLinked: true, originalName: originalName, isCopy: true };
        node.setText(newName);
        node.setDetailed(true);
        node.setLinked(true);

        if (action.description) node.Description = action.description;
        this.host.syncToProject();
    }


    private copyLibraryTaskAsTemplate(node: FlowElement, libraryTask: any): void {
        if (!this.host.project) return;

        let baseName = libraryTask.name;
        let newName = baseName;
        let counter = 1;

        // Eindeutigen Namen finden
        while (this.host.project.tasks.find(t => t.name === newName)) {
            newName = `${baseName}_${counter}`;
            counter++;
        }

        const userInput = prompt(`Name für die Vorlage (basierend auf "${libraryTask.name}"):`, newName);
        if (!userInput) return;
        newName = userInput;

        // Prüfen ob der Name existiert
        let existingTask = this.host.project.tasks.find(t => t.name === newName);
        if (existingTask && (existingTask.actionSequence?.length > 0 || existingTask.flowChart)) {
            if (!confirm(`Task "${newName}" existiert bereits und ist nicht leer. Überschreiben?`)) return;
        }

        // 1. Independent deep copy
        const taskCopy = JSON.parse(JSON.stringify(libraryTask));
        taskCopy.name = newName;
        taskCopy.description = (libraryTask.description || '') + ' (Kopie)';
        taskCopy.sourceTaskName = libraryTask.name;

        if (taskCopy.params) {
            taskCopy.params.forEach((p: any) => p.fromLibrary = true);
        }

        // 2. FlowChart kopieren
        if (libraryTask.flowChart) {
            const flowChartCopy = JSON.parse(JSON.stringify(libraryTask.flowChart));
            const idMapping: Record<string, string> = {};

            if (flowChartCopy.elements) {
                flowChartCopy.elements.forEach((el: any) => {
                    const oldId = el.id;
                    const newId = `${newName}-${oldId}`;
                    idMapping[oldId] = newId;
                    el.id = newId;

                    const actionName = el.properties?.name || el.data?.name || el.data?.actionName;
                    if (el.type === 'Action' && actionName) {
                        const actionInLibrary = this.host.syncManager.findActionInSequence(libraryTask.actionSequence, actionName);
                        if (actionInLibrary) {
                            el.data = { ...el.data, ...actionInLibrary, name: actionName };
                        }
                    }
                });
            }

            if (flowChartCopy.connections) {
                flowChartCopy.connections.forEach((conn: any) => {
                    if (conn.startTargetId && idMapping[conn.startTargetId]) conn.startTargetId = idMapping[conn.startTargetId];
                    if (conn.endTargetId && idMapping[conn.endTargetId]) conn.endTargetId = idMapping[conn.endTargetId];
                });
            }

            // Task entry node if missing
            const hasTaskNode = flowChartCopy.elements?.some((el: any) => el.type === 'Task');
            if (!hasTaskNode && flowChartCopy.elements?.length > 0) {
                const taskNodeId = `${newName}-task-entry`;
                const taskNode = {
                    id: taskNodeId,
                    type: 'Task',
                    x: 40, y: 60, width: 160, height: 60,
                    properties: { name: newName, details: libraryTask.description || '' },
                    data: { taskName: newName }
                };
                flowChartCopy.elements.unshift(taskNode);
            }

            taskCopy.flowChart = flowChartCopy;
            const targetCharts = this.host.getTargetFlowCharts(newName);
            targetCharts[newName] = flowChartCopy;
        }

        // 3. Commit
        if (existingTask) {
            Object.assign(existingTask, taskCopy);
        } else {
            this.host.project.tasks.push(taskCopy);
        }

        // 4. Node update
        node.Name = newName;
        node.setText(newName);
        node.data = { ...node.data, name: newName, taskName: newName, sourceTaskName: libraryTask.name };
        node.setDetailed(true);
        node.setLinked(false);

        // 5. Registry & Persistence
        this.registerActionsFromTask(taskCopy);
        this.host.updateFlowSelector();
        if (this.host.onProjectChange) this.host.onProjectChange();

        if (confirm(`Task "${newName}" wurde erstellt. Zum Task-Flow wechseln?`)) {
            this.host.switchActionFlow(newName);
        }
    }

    private registerActionsFromTask(task: any) {
        if (!this.host.project) return;
        const processSequence = (sequence: any[]) => {
            if (!sequence) return;
            sequence.forEach(item => {
                const name = item.name || item.actionName;
                if (name) this.host.syncManager.updateGlobalActionDefinition(item);
                if (item.body) processSequence(item.body);
                if (item.then) processSequence(item.then);
                if (item.else) processSequence(item.else);
            });
        };
        processSequence(task.actionSequence);

        if (task.flowChart && task.flowChart.elements) {
            task.flowChart.elements.forEach((el: any) => {
                if (el.type === 'Action') {
                    const name = el.properties?.name || el.data?.name || el.data?.actionName;
                    if (name) this.host.syncManager.updateGlobalActionDefinition({ ...el.data, name });
                }
            });
        }
    }
}
