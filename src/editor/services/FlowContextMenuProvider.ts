import { GameProject } from '../../model/types';
import { FlowElement } from '../flow/FlowElement';
import { FlowConnection } from '../flow/FlowConnection';
import { FlowTask } from '../flow/FlowTask';
import { FlowAction } from '../flow/FlowAction';
import { FlowDataAction } from '../flow/FlowDataAction';
import { ContextMenu, ContextMenuItem } from '../ui/ContextMenu';
import { projectRegistry } from '../../services/ProjectRegistry';
import { libraryService } from '../../services/LibraryService';
import { FlowNamingService } from './FlowNamingService';
import { ExpertDialog } from '../../components/ExpertDialog';
import { RefactoringManager } from '../RefactoringManager';
import { expertRuleEngine } from './ExpertRuleEngine';
import { MethodRegistry } from '../MethodRegistry';

import { Logger } from '../../utils/Logger';

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
    showDetails: boolean;
    onProjectChange?: () => void;
    getTargetFlowCharts: (context: string) => any;
    syncManager: any; // For global action updates
    createNode: (type: string, x: number, y: number, initialName?: string) => FlowElement | null;
    renameObjectWithRefactoring?: (id: string, newName: string, oldName?: string) => void;
}

export class FlowContextMenuProvider {
    private host: FlowContextMenuHost;
    private expertDialog: ExpertDialog;
    private static logger = Logger.get('FlowContextMenuProvider', 'Property_Management');

    constructor(host: FlowContextMenuHost) {
        this.host = host;
        this.expertDialog = new ExpertDialog();
        this.initializeResolvers();
    }

    private initializeResolvers() {
        // Resolver for Property Sections
        expertRuleEngine.registerDynamicResolver('@property_sections', () => [
            { value: 'position', label: 'Position & Größe', description: 'Position (x, y) und Dimensionen (Breite, Höhe).', uiEmoji: '📏' },
            { value: 'style', label: 'Darstellung', description: 'Farbe, Rahmen, Schriftart und Größe.', uiEmoji: '🎨' },
            { value: 'display', label: 'Sichtbarkeit', description: 'Sichtbarkeit und Interaktivität.', uiEmoji: '👁️' },
            { value: 'content', label: 'Inhalt', description: 'Texte, Beschriftungen und Werte.', uiEmoji: '📝' },
            { value: 'identity', label: 'Identität', description: 'Name und eindeutige Kennung.', uiEmoji: '🆔' },
            { value: 'multiplayer', label: 'Multiplayer', description: 'Netzwerk- und Synchronisation-Verhalten.', uiEmoji: '🌐' }
        ]);

        // Resolver for Properties filtered by chosen section
        expertRuleEngine.registerDynamicResolver('@properties_for_section', (state) => {
            const section = state.collectedData.section;
            if (!section) return [];

            // Static mapping from public/editor/inspector_layout.json
            const allProps: Record<string, any[]> = {
                'position': [
                    { value: 'x', label: 'X Position', description: 'Horizontale Position' },
                    { value: 'y', label: 'Y Position', description: 'Vertikale Position' },
                    { value: 'width', label: 'Breite', description: 'Objektbreite' },
                    { value: 'height', label: 'Höhe', description: 'Objekthöhe' }
                ],
                'style': [
                    { value: 'backgroundColor', label: 'Hintergrund', description: 'Hintergrundfarbe' },
                    { value: 'borderColor', label: 'Rahmenfarbe', description: 'Farbe des Rahmens' },
                    { value: 'fontFamily', label: 'Schriftart', description: 'Name der Schriftfamilie' },
                    { value: 'fontSize', label: 'Schriftgröße', description: 'Größe in Pixel' }
                ],
                'display': [
                    { value: 'visible', label: 'Sichtbar', description: 'Objekt auf der Stage anzeigen' },
                    { value: 'enabled', label: 'Aktiviert', description: 'Interaktionsfähigkeit erlauben' }
                ],
                'content': [
                    { value: 'text', label: 'Text', description: 'Anzeigetext oder Wert' },
                    { value: 'caption', label: 'Beschriftung', description: 'Label-Text' },
                    { value: 'value', label: 'Aktueller Wert', description: 'Numerischer Wert' },
                    { value: 'maxValue', label: 'Maximalwert', description: 'Limit des Wertes' }
                ],
                'identity': [
                    { value: 'name', label: 'Name', description: 'Eindeutiger Bezeichner' }
                ],
                'multiplayer': [
                    { value: 'triggerMode', label: 'Trigger-Modus', description: 'Netzwerk-Synchronisation' }
                ]
            };

            return allProps[section] || [];
        });

        // Resolver for Methods
        expertRuleEngine.registerDynamicResolver('@methods', (state) => {
            const target = state.collectedData.target;
            if (!target) return [];

            // In a more sophisticated version, we'd lookup the component type.
            // For now, we return all standard methods from the registry.
            return Object.keys(MethodRegistry).map(m => ({
                value: m,
                label: m,
                description: `Methode ${m} aufrufen`
            }));
        });

        // Resolver for DataStores (nur TDataStore-Objekte)
        expertRuleEngine.registerDynamicResolver('@dataStores', () => {
            return projectRegistry.getObjects()
                .filter(o => o.className === 'TDataStore')
                .map(o => ({ value: o.name, label: o.name, description: 'DataStore' }));
        });

        // Resolver for DataStore-Felder (abhängig vom gewählten DataStore in der Session)
        expertRuleEngine.registerDynamicResolver('@dataStoreFields', (state) => {
            const dsName = state.collectedData.dataStore;
            if (dsName) {
                try {
                    const { dataService } = require('../../services/DataService');
                    const allObjects = projectRegistry.getObjects();
                    const dsObj = allObjects.find(o => o.name === dsName || o.id === dsName);
                    const collection = (dsObj as any)?.defaultCollection || '';
                    if (collection) {
                        const fields = dataService.getModelFieldsSync('db.json', collection);
                        if (fields.length > 0) {
                            return fields.map((f: string) => ({ value: f, label: f }));
                        }
                    }
                } catch { /* Fallback */ }
            }
            // Fallback: Standard-Felder
            return ['id', 'name', 'text', 'value', 'email', 'score']
                .map(f => ({ value: f, label: f }));
        });

        // Resolver for Variables
        expertRuleEngine.registerDynamicResolver('@variables', () => {
            return projectRegistry.getVariables()
                .map(v => ({ value: v.name, label: v.name, description: (v as any).type || '' }));
        });
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

        // 1b. Expert Mode
        const expertTaskItem = this.getExpertTaskItem(node);
        if (expertTaskItem) items.push(expertTaskItem);

        const expertDataActionItem = this.getExpertDataActionItem(node);
        if (expertDataActionItem) items.push(expertDataActionItem);

        const expertActionItem = this.getExpertActionItem(node);
        if (expertActionItem) items.push(expertActionItem);

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
        if (node.getType() === 'task') {
            const allTasks = projectRegistry.getTasks('all');
            const linkItems: ContextMenuItem[] = allTasks.map(t => ({
                label: t.name,
                action: () => this.assignTaskToNode(node, t)
            }));

            if (linkItems.length > 0) {
                items.push({
                    label: 'Existing Task verwenden (Link)',
                    submenu: linkItems
                });
            }

            const importItems: ContextMenuItem[] = allTasks.map(t => ({
                label: t.name,
                action: () => this.host.importTaskGraph(node, t)
            }));

            if (importItems.length > 0) {
                items.push({
                    label: 'Task einbetten (Struktur kopieren)',
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
        } else if (node.getType() === 'action') {
            const allActions = projectRegistry.getActions('all');
            const linkItems: ContextMenuItem[] = allActions.map(a => ({
                label: a.name,
                action: () => this.linkActionToNode(node, a)
            }));

            if (linkItems.length > 0) {
                items.push({
                    label: 'Existing Action verwenden (Link)',
                    submenu: linkItems
                });
            }

            const copyItems: ContextMenuItem[] = allActions.map(a => ({
                label: a.name,
                action: () => this.copyActionToNode(node, a)
            }));

            if (copyItems.length > 0) {
                items.push({
                    label: 'Aktion einbetten (Kopie)',
                    submenu: copyItems
                });
            }
        }

        this.host.contextMenu.show(e.clientX, e.clientY, items);
    }

    private showEmbeddedContextMenu(e: MouseEvent, node: FlowElement): void {
        const items: ContextMenuItem[] = [];

        // Add Expert options for embedded nodes too!
        const expertTaskItem = this.getExpertTaskItem(node);
        if (expertTaskItem) items.push(expertTaskItem);

        const expertDataActionItem = this.getExpertDataActionItem(node);
        if (expertDataActionItem) items.push(expertDataActionItem);

        const expertActionItem = this.getExpertActionItem(node);
        if (expertActionItem) items.push(expertActionItem);

        if (expertTaskItem || expertDataActionItem || expertActionItem) {
            items.push({ separator: true, label: '' });
        }

        const typeLabel = node.getType() === 'task' ? 'Task' : 'Aktion';
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

        // Vorhandene Actions einfügen (Link)
        const allActions = projectRegistry.getActions('all');
        const insertActionItems: ContextMenuItem[] = allActions.map(a => ({
            label: a.name,
            action: () => {
                const node = this.host.createNode('Action', x, y, a.name);
                if (node) this.linkActionToNode(node, a);
            }
        }));

        if (insertActionItems.length > 0) {
            items.push({ separator: true, label: '' });
            items.push({
                label: '🔗 Vorhandene Aktion einfügen',
                submenu: insertActionItems
            });
        }

        // Vorhandene Globale Tasks einfügen
        const allTasks = projectRegistry.getTasks('all');
        const globalTasks = allTasks.filter(t => t.uiScope === 'global' || (t as any).scope === 'global');
        
        const insertTaskItems: ContextMenuItem[] = globalTasks.map(t => ({
            label: t.name,
            action: () => {
                const node = this.host.createNode('Task', x, y, t.name);
                if (node) this.assignTaskToNode(node, t);
            }
        }));

        if (insertTaskItems.length > 0) {
            if (insertActionItems.length === 0) items.push({ separator: true, label: '' });
            items.push({
                label: '🔗 Globalen Task einfügen',
                submenu: insertTaskItems
            });
        }

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

        while (this.host.project.tasks.find(t => t.name === newName)) {
            newName = `${baseName}_${counter}`;
            counter++;
        }

        const userInput = prompt(`Name für die Vorlage (basierend auf "${libraryTask.name}"):`, newName);
        if (!userInput) return;
        newName = userInput;

        let existingTask = this.host.project.tasks.find(t => t.name === newName);
        if (existingTask && (existingTask.actionSequence?.length > 0 || existingTask.flowChart)) {
            if (!confirm(`Task "${newName}" existiert bereits und ist nicht leer. Überschreiben?`)) return;
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
                if (el.type === 'action') {
                    const name = el.properties?.name || el.data?.name || el.data?.actionName;
                    if (name) this.host.syncManager.updateGlobalActionDefinition({ ...el.data, name });
                }
            });
        }
    }

    private async showExpertWizard(node: FlowElement, type: 'task' | 'action' | 'data_action'): Promise<void> {
        const proj = this.host.project; // Use host.project
        if (!proj) return;

        // Prepare dynamic options from registry
        const objects = projectRegistry.getObjectsWithMetadata().map(obj => ({
            label: obj.name,
            value: obj.name,
            description: obj.className,
            uiEmoji: (obj as any).uiEmoji || '📦'
        }));
        expertRuleEngine.setDynamicOptions('@objects', objects);

        const stageId = this.host.currentFlowContext === 'event-map' ? 'blueprint' : this.host.currentFlowContext;

        let existingData: any = { ...node.data };
        let originalName = node.Name;

        if (type === 'task') {
            existingData = {
                name: node.Name,
                description: node.Description || ''
            };
        } else if (type === 'action' || type === 'data_action') {
            const realAction = proj.actions?.find(a => a.name === node.Name) ||
                proj.stages?.flatMap(s => s.actions || []).find(a => a.name === node.Name);
            if (realAction) {
                existingData = { ...realAction };
            }

            if (existingData.changes && typeof existingData.changes === 'object') {
                existingData.changes = JSON.stringify(existingData.changes, null, 2);
            }
            if (existingData.params && typeof existingData.params === 'object') {
                existingData.params = JSON.stringify(existingData.params, null, 2);
            }
            if (existingData.body && typeof existingData.body === 'object') {
                existingData.body = JSON.stringify(existingData.body, null, 2);
            }
        }

        const payload = await this.expertDialog.open(type, originalName, existingData, stageId);

        if (!payload) return;

        const newName = payload.name;

        if (type === 'action' || type === 'data_action') {
            // Die Verarbeitung des Payloads (Mapping von property/value zu changes, safeParse)
            // erfolgt nun zentral im FlowSyncManager.updateGlobalActionDefinition.
            // Dies garantiert eine konsistente Datenstruktur (SSoT).
            FlowContextMenuProvider.logger.info(`Processed Wizard payload for '${newName}':`, payload);
        }

        if (newName) {
            if (originalName !== newName) {
                FlowContextMenuProvider.logger.info(`Wizard: Refactoring name change from '${originalName}' to '${newName}'`);
                if (this.host.renameObjectWithRefactoring) {
                    this.host.renameObjectWithRefactoring(originalName, newName, originalName);
                } else {
                    if (proj) {
                        if (type === 'task') RefactoringManager.renameTask(proj, originalName, newName);
                        else RefactoringManager.renameAction(proj, originalName, newName);
                    }
                }
            }

            if (type === 'task') {
                const existingTask = proj.tasks?.find(t => t.name === newName) ||
                    proj.stages?.flatMap(s => s.tasks || []).find(t => t.name === newName);
                if (existingTask && payload.description !== undefined) {
                    existingTask.description = payload.description;
                }
            } else { // action or data_action
                // SSoT-FIX: Wir nutzen den syncManager, um die globale Definition zu erstellen oder zu aktualisieren.
                // Dies verhindert "Dangling Links", wenn die Action vorher nur lokal existierte.
                const actionData = { ...payload, name: newName };
                FlowContextMenuProvider.logger.info(`Wizard: Syncing global definition for '${newName}':`, actionData);
                this.host.syncManager.updateGlobalActionDefinition(actionData);
            }

            node.Name = newName;
            node.setText(newName);
            if (type === 'task') {
                node.data = { ...node.data, name: newName, taskName: newName, details: payload.description };
                if (payload.description !== undefined) {
                    node.Description = payload.description;
                }
            } else { // action or data_action
                node.data = { ...node.data, ...payload, isLinked: true };
                // Visuelle Details aktualisieren (z.B. geänderte Property-Werte anzeigen)
                if (node instanceof FlowAction || (node as any).getType?.() === 'data_action') {
                    FlowContextMenuProvider.logger.info(`Wizard: Refreshing visual details for node '${newName}'`);
                    (node as any).setShowDetails?.(this.host.showDetails || false, proj);
                }
                node.setDetailed(true);
                if ((node as any).setProjectRef) {
                    (node as any).setProjectRef(proj);
                }
            }
        }

        this.host.syncToProject();
        this.host.updateFlowSelector();
        if (this.host.onProjectChange) this.host.onProjectChange();
    }

    private getExpertTaskItem(node: FlowElement): ContextMenuItem | null {
        if (!(node instanceof FlowTask) && node.getType() !== 'task') return null;

        return {
            label: '🧙‍♂️ Expert Edit (Task)',
            action: () => this.showExpertWizard(node, 'task')
        };
    }

    private getExpertActionItem(node: FlowElement): ContextMenuItem | null {
        if (!(node instanceof FlowAction) && node.getType() !== 'action') return null;
        if (node instanceof FlowDataAction) return null;

        return {
            label: '🧙‍♂️ Expert Edit (Action)',
            action: () => this.showExpertWizard(node, 'action')
        };
    }

    private getExpertDataActionItem(node: FlowElement): ContextMenuItem | null {
        if (!(node instanceof FlowDataAction) && node.getType() !== 'data_action') return null;

        return {
            label: '🧙‍♂️ Expert Edit (Data Action)',
            action: () => this.showExpertWizard(node, 'data_action')
        };
    }
}
