import { FlowContextMenuHost } from './FlowContextMenuHost';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { projectVariableRegistry } from '../../../services/registry/VariableRegistry';
import { FlowContextMenuNodeActions } from './FlowContextMenuNodeActions';
import { getActionContentHash, getTaskContentHash } from './FlowContextMenuTemplates';

export class FlowContextMenuSubmenus {
    private host: FlowContextMenuHost;
    private nodeActions: FlowContextMenuNodeActions;

    constructor(host: FlowContextMenuHost, nodeActions: FlowContextMenuNodeActions) {
        this.host = host;
        this.nodeActions = nodeActions;
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
            },
            {
                label: '🔒 Lokale Variable hinzufügen',
                action: async () => {
                    const node = await this.host.createNode('VariableDecl', x, y);
                    if (node) {
                        if (!node.data) node.data = {};
                        if (!node.data.variable) node.data.variable = {};
                        node.data.variable.scope = 'local';
                        node.data.variable.type = 'string';
                        node.data.variable.name = node.Name || 'LokalVar';
                        node.data.variable.defaultValue = '';
                        node.data.variable.isVariable = true;
                        if ((node as any).updateVisuals) (node as any).updateVisuals();
                        this.host.syncToProject();
                    }
                }
            }
        ];

        const insertActionItems: ContextMenuItem[] = this.buildSmartActionMenuItems(x, y);

        if (insertActionItems.length > 0) {
            items.push({ separator: true, label: '' });
            items.push({
                label: '🔗 Vorhandene Aktion einfügen',
                submenu: insertActionItems
            });
        }

        const insertTaskItems: ContextMenuItem[] = this.buildSmartTaskMenuItems(x, y);

        if (insertTaskItems.length > 0) {
            if (insertActionItems.length === 0) items.push({ separator: true, label: '' });
            items.push({
                label: '🔗 Vorhandenen Task einfügen',
                submenu: insertTaskItems
            });
        }

        const allVars = projectVariableRegistry.getVariables();
        if (allVars.length > 0) {
            const insertVarItems: ContextMenuItem[] = allVars.map(v => ({
                label: `${v.name} (${(v as any).type || 'any'})`,
                action: async () => {
                    const node = await this.host.createNode('VariableDecl', x, y, v.name);
                    if (node) {
                        node.data = { variable: { ...v, isVariable: true } };
                        if ((node as any).setProjectRef) (node as any).setProjectRef(this.host.project);
                        if ((node as any).updateVisuals) (node as any).updateVisuals();
                        this.host.syncToProject();
                    }
                }
            }));
            items.push({
                label: '📦 Vorhandene Variable einfügen',
                submenu: insertVarItems
            });
        }

        this.host.contextMenu.show(e.clientX, e.clientY, items);
    }

    private buildSmartActionMenuItems(x: number, y: number): ContextMenuItem[] {
        if (!this.host.project) return [];
        const proj = this.host.project;
        const items: ContextMenuItem[] = [];

        const actionLocations: Array<{ action: any; stageId?: string; stageName?: string }> = [];

        (proj.actions || []).forEach((a: any) => {
            actionLocations.push({ action: a, stageId: undefined, stageName: 'Global' });
        });

        (proj.stages || []).forEach((stage: any) => {
            (stage.actions || []).forEach((a: any) => {
                actionLocations.push({ action: a, stageId: stage.id, stageName: stage.name });
            });
        });

        const byName = new Map<string, typeof actionLocations>();
        actionLocations.forEach(loc => {
            const list = byName.get(loc.action.name) || [];
            list.push(loc);
            byName.set(loc.action.name, list);
        });

        byName.forEach((locations, name) => {
            if (locations.length === 1) {
                const loc = locations[0];
                const label = loc.stageId ? `${name} [${loc.stageName}]` : name;
                items.push({
                    label,
                    action: async () => {
                        const node = await this.host.createNode('Action', x, y, name);
                        if (node) this.nodeActions.linkActionToNode(node, loc.action, loc.stageId);
                    }
                });
            } else {
                const uniqueVersions = new Map<string, typeof locations>();
                locations.forEach(loc => {
                    const contentKey = getActionContentHash(loc.action);
                    const list = uniqueVersions.get(contentKey) || [];
                    list.push(loc);
                    uniqueVersions.set(contentKey, list);
                });

                if (uniqueVersions.size === 1) {
                    const label = `${name} [Mehrere Stages, identisch]`;
                    items.push({
                        label,
                        action: async () => {
                            const node = await this.host.createNode('Action', x, y, name);
                            if (node) this.nodeActions.linkActionToNode(node, locations[0].action, locations[0].stageId);
                        }
                    });
                } else {
                    locations.forEach(loc => {
                        const label = `${name} [${loc.stageName || 'Global'}]`;
                        items.push({
                            label,
                            action: async () => {
                                const node = await this.host.createNode('Action', x, y, name);
                                if (node) this.nodeActions.linkActionToNode(node, loc.action, loc.stageId);
                            }
                        });
                    });
                }
            }
        });

        return items.sort((a, b) => a.label.localeCompare(b.label));
    }

    private buildSmartTaskMenuItems(x: number, y: number): ContextMenuItem[] {
        if (!this.host.project) return [];
        const proj = this.host.project;
        const items: ContextMenuItem[] = [];

        const taskLocations: Array<{ task: any; stageId?: string; stageName?: string }> = [];

        (proj.tasks || []).forEach((t: any) => {
            taskLocations.push({ task: t, stageId: undefined, stageName: 'Global/Blueprint' });
        });

        (proj.stages || []).forEach((stage: any) => {
            (stage.tasks || []).forEach((t: any) => {
                taskLocations.push({ task: t, stageId: stage.id, stageName: stage.name });
            });
        });

        const byName = new Map<string, typeof taskLocations>();
        taskLocations.forEach(loc => {
            const list = byName.get(loc.task.name) || [];
            list.push(loc);
            byName.set(loc.task.name, list);
        });

        byName.forEach((locations, name) => {
            if (locations.length === 1) {
                const loc = locations[0];
                const label = loc.stageId ? `${name} [${loc.stageName}]` : name;
                items.push({
                    label,
                    action: async () => {
                        const node = await this.host.createNode('Task', x, y, name);
                        if (node) this.nodeActions.assignTaskToNode(node, loc.task);
                    }
                });
            } else {
                const uniqueVersions = new Map<string, typeof locations>();
                locations.forEach(loc => {
                    const contentKey = getTaskContentHash(loc.task);
                    const list = uniqueVersions.get(contentKey) || [];
                    list.push(loc);
                    uniqueVersions.set(contentKey, list);
                });

                if (uniqueVersions.size === 1) {
                    const label = `${name} [Mehrere Stages, identisch]`;
                    items.push({
                        label,
                        action: async () => {
                            const node = await this.host.createNode('Task', x, y, name);
                            if (node) this.nodeActions.assignTaskToNode(node, locations[0].task);
                        }
                    });
                } else {
                    locations.forEach(loc => {
                        const label = `${name} [${loc.stageName || 'Global'}]`;
                        items.push({
                            label,
                            action: async () => {
                                const node = await this.host.createNode('Task', x, y, name);
                                if (node) this.nodeActions.assignTaskToNode(node, loc.task);
                            }
                        });
                    });
                }
            }
        });

        return items.sort((a, b) => a.label.localeCompare(b.label));
    }
}
