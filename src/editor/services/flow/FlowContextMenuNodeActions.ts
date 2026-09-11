import { FlowContextMenuHost } from './FlowContextMenuHost';
import { projectReferenceTracker } from '../../../services/registry/ReferenceTracker';
import { projectObjectRegistry } from '../../../services/registry/ObjectRegistry';
import { projectActionRegistry } from '../../../services/registry/ActionRegistry';
import { projectTaskRegistry } from '../../../services/registry/TaskRegistry';
import { coreStore } from '../../../services/registry/CoreStore';
import { FlowElement } from '../../flow/FlowElement';
import { FlowTask } from '../../flow/FlowTask';
import { FlowAction } from '../../flow/FlowAction';
import { FlowDataAction } from '../../flow/FlowDataAction';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { libraryService } from '../../../services/LibraryService';
import { FlowNamingService } from '../FlowNamingService';
import { ExpertDialog } from '../../../components/ExpertDialog';
import { RefactoringManager } from '../../RefactoringManager';
import { expertRuleEngine } from '../ExpertRuleEngine';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { NotificationToast } from '../../ui/NotificationToast';
import { Logger } from '../../../utils/Logger';
import { FlowContextMenuClipboard } from './FlowContextMenuClipboard';
import { getTypeLabel } from './FlowContextMenuTemplates';

export class FlowContextMenuNodeActions {
    private host: FlowContextMenuHost;
    private clipboard: FlowContextMenuClipboard;
    private expertDialog: ExpertDialog;
    private static logger = Logger.get('FlowContextMenuProvider', 'Property_Management');

    constructor(host: FlowContextMenuHost, clipboard: FlowContextMenuClipboard) {
        this.host = host;
        this.clipboard = clipboard;
        this.expertDialog = new ExpertDialog();
    }

    public handleNodeContextMenu(e: MouseEvent, node: FlowElement): void {
        const proj = this.host.project;
        if (!proj) return;

        if (node.data?.isOverviewLink) {
            this.showOverviewContextMenu(e, node);
            return;
        }

        if (node.data?.isLinked || node.data?.isEmbeddedInternal) {
            this.showEmbeddedContextMenu(e, node);
            return;
        }

        const items: ContextMenuItem[] = [];

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

        const expertTaskItem = this.getExpertTaskItem(node);
        if (expertTaskItem) items.push(expertTaskItem);

        const expertDataActionItem = this.getExpertDataActionItem(node);
        if (expertDataActionItem) items.push(expertDataActionItem);

        const expertActionItem = this.getExpertActionItem(node);
        if (expertActionItem) items.push(expertActionItem);

        const elementName = node.Name || node.id;
        const liveRefs = projectReferenceTracker.findReferences(elementName);
        const refCount = liveRefs.length;

        items.push({
            label: refCount > 0 ? `Löschen (${refCount} Referenz${refCount !== 1 ? 'en' : ''})` : 'Löschen',
            action: () => this.host.deleteNode(node),
            color: '#ff4444'
        });

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

        if (node.getType() === 'task') {
            const allTasks = projectTaskRegistry.getTasks('all');
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
                    action: () => this.clipboard.copyLibraryTaskAsTemplate(node, t)
                }));
                items.push({
                    label: '📚 Library-Task als Vorlage',
                    submenu: libraryItems
                });
            }
        } else if (node.getType() === 'action') {
            const allActions = projectActionRegistry.getActions('all');
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
            action: async () => {
                const groupId = node.data?.embeddedGroupId;
                const nodesToDelete = groupId
                    ? this.host.nodes.filter(n => n.data?.embeddedGroupId === groupId)
                    : [node];

                const count = nodesToDelete.length;
                if (await ConfirmDialog.show(`Möchtest du die eingebettete ${typeLabel} (${count} Elemente) wirklich löschen?`)) {
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

    private showOverviewContextMenu(e: MouseEvent, node: FlowElement): void {
        const proj = this.host.project;
        if (!proj) return;

        const items: ContextMenuItem[] = [];
        const elementName = node.Name || node.id;
        const elementType = node.data?.type;
        const canDelete = node.data?.canDelete === true;
        const refs: string[] = node.data?.references || [];

        if (elementType === 'task' && node.data?.taskName) {
            items.push({
                label: '➔ Zum Task-Flow springen',
                action: () => this.host.switchActionFlow(node.data.taskName)
            });
        }

        const expertItem = this.getExpertTaskItem(node) || this.getExpertActionItem(node);
        if (expertItem) items.push(expertItem);

        if (refs.length > 0) {
            items.push({
                label: `📋 ${refs.length} Referenz${refs.length > 1 ? 'en' : ''}`,
                action: () => {
                    NotificationToast.show(`"${elementName}" wird verwendet in:\n\n${refs.join('\n')}`);
                }
            });
        }

        items.push({ separator: true, label: '' });

        if (canDelete) {
            items.push({
                label: `🗑️ "${elementName}" endgültig löschen`,
                action: async () => {
                    if (!await ConfirmDialog.show(`Element "${elementName}" (${getTypeLabel(elementType)}) endgültig aus dem Projekt löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`)) {
                        return;
                    }

                    if (elementType === 'action') {
                        RefactoringManager.deleteAction(proj, elementName);
                    } else if (elementType === 'task') {
                        RefactoringManager.deleteTask(proj, elementName);
                    } else if (elementType === 'VariableDecl') {
                        RefactoringManager.deleteVariable(proj, elementName);
                    }

                    FlowContextMenuNodeActions.logger.info(`Element "${elementName}" (${elementType}) aus dem Projekt gelöscht.`);

                    if (this.host.onProjectChange) this.host.onProjectChange();
                    this.host.currentFlowContext = '';
                    this.host.switchActionFlow('element-overview');
                },
                color: '#ff4444'
            });
        } else {
            items.push({
                label: `🔒 "${elementName}" wird noch verwendet`,
                action: () => {
                    NotificationToast.show(`"${elementName}" kann nicht gelöscht werden.\n\nVerwendet in:\n${refs.join('\n')}`);
                },
                color: '#888888'
            });
        }

        this.host.contextMenu.show(e.clientX, e.clientY, items);
    }

    public assignTaskToNode(node: FlowElement, task: any): void {
        this.host.importTaskGraph(node, task, true);
    }

    public linkActionToNode(node: FlowElement, action: any, stageId?: string): void {
        node.data = { name: action.name, isLinked: true };
        if (stageId && stageId !== coreStore.activeStageId) {
            (node.data as any).stageId = stageId;
        }
        node.setText(action.name);
        node.setDetailed(true);
        node.setLinked(true);
        if (action.description) node.Description = action.description;
        this.host.syncToProject();
    }

    public copyActionToNode(node: FlowElement, action: any): void {
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

    private async showExpertWizard(node: FlowElement, type: 'task' | 'action' | 'data_action'): Promise<void> {
        const proj = this.host.project;
        if (!proj) return;

        const objects = projectObjectRegistry.getObjectsWithMetadata().map(obj => ({
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
            FlowContextMenuNodeActions.logger.info(`Processed Wizard payload for '${newName}':`, payload);
        }

        if (newName) {
            if (originalName !== newName) {
                FlowContextMenuNodeActions.logger.info(`Wizard: Refactoring name change from '${originalName}' to '${newName}'`);
                if (this.host.renameObjectWithRefactoring) {
                    this.host.renameObjectWithRefactoring(originalName, newName, originalName);
                } else {
                    if (proj) {
                        if (type === 'task') RefactoringManager.renameTask(proj, originalName, newName);
                        else RefactoringManager.renameAction(proj, originalName, newName, coreStore.activeStageId || undefined);
                    }
                }
            }

            if (type === 'task') {
                const existingTask = proj.tasks?.find(t => t.name === newName) ||
                    proj.stages?.flatMap(s => s.tasks || []).find(t => t.name === newName);
                if (existingTask && payload.description !== undefined) {
                    existingTask.description = payload.description;
                }
            } else {
                const actionData = { ...payload, name: newName };
                FlowContextMenuNodeActions.logger.info(`Wizard: Syncing global definition for '${newName}':`, actionData);
                this.host.syncManager.updateGlobalActionDefinition(actionData);
            }

            node.Name = newName;
            node.setText(newName);
            if (type === 'task') {
                node.data = { ...node.data, name: newName, taskName: newName, details: payload.description };
                if (payload.description !== undefined) {
                    node.Description = payload.description;
                }
            } else {
                node.data = { ...node.data, ...payload, isLinked: true };
                if (node instanceof FlowAction || (node as any).getType?.() === 'data_action') {
                    FlowContextMenuNodeActions.logger.info(`Wizard: Refreshing visual details for node '${newName}'`);
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
