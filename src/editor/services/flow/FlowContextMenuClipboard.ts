import { FlowContextMenuHost } from './FlowContextMenuHost';
import { FlowElement } from '../../flow/FlowElement';
import { PromptDialog } from '../../ui/PromptDialog';
import { ConfirmDialog } from '../../ui/ConfirmDialog';

export class FlowContextMenuClipboard {
    private host: FlowContextMenuHost;

    constructor(host: FlowContextMenuHost) {
        this.host = host;
    }

    public async copyLibraryTaskAsTemplate(node: FlowElement, libraryTask: any): Promise<void> {
        if (!this.host.project) return;

        let baseName = libraryTask.name;
        let newName = baseName;
        let counter = 1;

        while (this.host.project.tasks.find(t => t.name === newName)) {
            newName = `${baseName}_${counter}`;
            counter++;
        }

        const userInput = await PromptDialog.show(`Name für die Vorlage (basierend auf "${libraryTask.name}"):`, newName);
        if (!userInput) return;
        newName = userInput;

        let existingTask = this.host.project.tasks.find(t => t.name === newName);
        if (existingTask && (existingTask.actionSequence?.length > 0 || existingTask.flowChart)) {
            if (!await ConfirmDialog.show(`Task "${newName}" existiert bereits und ist nicht leer. Überschreiben?`)) return;
        }

        const taskCopy = JSON.parse(JSON.stringify(libraryTask));
        taskCopy.name = newName;
        taskCopy.description = (libraryTask.description || '') + ' (Kopie)';
        taskCopy.sourceTaskName = libraryTask.name;

        if (taskCopy.params) {
            taskCopy.params.forEach((p: any) => p.fromLibrary = true);
        }

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
                    if (el.type === 'action' && actionName) {
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

            const hasTaskNode = flowChartCopy.elements?.some((el: any) => el.type === 'task');
            if (!hasTaskNode && flowChartCopy.elements?.length > 0) {
                const taskNodeId = `${newName}-task-entry`;
                const taskNode = {
                    id: taskNodeId,
                    type: 'task',
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

        if (existingTask) {
            Object.assign(existingTask, taskCopy);
        } else {
            this.host.project.tasks.push(taskCopy);
        }

        node.Name = newName;
        node.setText(newName);
        node.data = { ...node.data, name: newName, taskName: newName, sourceTaskName: libraryTask.name };
        node.setDetailed(true);
        node.setLinked(false);

        this.registerActionsFromTask(taskCopy);
        this.host.updateFlowSelector();
        if (this.host.onProjectChange) this.host.onProjectChange();

        if (await ConfirmDialog.show(`Task "${newName}" wurde erstellt. Zum Task-Flow wechseln?`)) {
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
                if (el.type === 'action') {
                    const name = el.properties?.name || el.data?.name || el.data?.actionName;
                    if (name) this.host.syncManager.updateGlobalActionDefinition({ ...el.data, name });
                }
            });
        }
    }
}
