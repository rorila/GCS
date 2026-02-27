import { FlowElement } from '../flow/FlowElement';
import { FlowConnection } from '../flow/FlowConnection';
import { FlowAction } from '../flow/FlowAction';
import { FlowDataAction } from '../flow/FlowDataAction';
import { FlowCondition } from '../flow/FlowCondition';
import { FlowTask } from '../flow/FlowTask';
import { FlowVariable } from '../flow/FlowVariable';
import { FlowThresholdVariable } from '../flow/FlowThresholdVariable';
import { FlowTriggerVariable } from '../flow/FlowTriggerVariable';
import { FlowTimerVariable } from '../flow/FlowTimerVariable';
import { FlowRangeVariable } from '../flow/FlowRangeVariable';
import { FlowListVariable } from '../flow/FlowListVariable';
import { FlowRandomVariable } from '../flow/FlowRandomVariable';
import { FlowLoop } from '../flow/FlowLoop';
import { FlowStart } from '../flow/FlowStart';
import { GameProject } from '../../model/types';
import { RefactoringManager } from '../RefactoringManager';
import { projectRegistry } from '../../services/ProjectRegistry';
import { Logger } from '../../utils/Logger';

export interface FlowGraphHost {
    project: GameProject | null;
    nodes: FlowElement[];
    connections: FlowConnection[];
    canvas: HTMLElement;
    flowStage: any;
    currentFlowContext: string;
    editor: any;
    showDetails: boolean;
    selectedConnection: FlowConnection | null;
    selectedNode: FlowElement | null;

    syncToProject(): void;
    loadFromProject(): void;
    updateFlowSelector(): void;
    getTargetFlowCharts(taskName?: string): any;
    generateUniqueTaskName(base: string): string;
    generateUniqueActionName(base: string): string;
    generateUniqueVariableName(base: string): string;
    ensureTaskExists(taskName: string, description?: string): void;
    setupNodeListeners(node: FlowElement): void;
    setupConnectionListeners(conn: FlowConnection): void;
    selectNode(node: FlowElement | null): void;
    onNodesChanged?: (nodes: FlowElement[]) => void;
    onProjectChange?: () => void;
    syncManager: any;
}

export class FlowGraphManager {
    private static logger = Logger.get('FlowGraphManager', 'Task_Management');
    private host: FlowGraphHost;

    constructor(host: FlowGraphHost) {
        this.host = host;
    }

    public createNode(type: string, x: number, y: number, initialName?: string): FlowElement | null {
        FlowGraphManager.logger.info(`createNode: type=${type}, x=${x}, y=${y}, initialName=${initialName}`);
        let node: FlowElement;
        const id = 'node-' + Date.now();
        const baseType = type.includes(':') ? type.split(':')[0] : type;

        switch (baseType) {
            case 'Action': {
                const actionSubtype = type.includes(':') ? type.split(':')[1] : null;
                node = new FlowAction(id, x, y, this.host.canvas, this.host.flowStage.cellSize);
                if (initialName && initialName !== 'Action' && initialName !== 'Aktion') {
                    node.Name = initialName;
                } else {
                    node.Name = this.host.generateUniqueActionName(initialName || 'Action');
                }
                if (actionSubtype) {
                    node.data = node.data || {};
                    node.data.type = actionSubtype;
                }
                if (this.host.showDetails) {
                    (node as FlowAction).setShowDetails(true, this.host.project);
                }
                break;
            }
            case 'DataAction':
                node = new FlowDataAction(id, x, y, this.host.canvas, this.host.flowStage.cellSize);
                if (initialName && initialName !== 'DataAction' && initialName !== 'Daten-Aktion') {
                    node.Name = initialName;
                } else {
                    node.Name = this.host.generateUniqueActionName(initialName || 'DataAction');
                }
                if (this.host.showDetails) {
                    (node as FlowAction).setShowDetails(true, this.host.project);
                }
                break;
            case 'Condition':
                node = new FlowCondition(id, x, y, this.host.canvas, this.host.flowStage.cellSize);
                node.Name = initialName || 'Bedingung';
                break;
            case 'Task': {
                let taskName = initialName;
                if (!taskName) {
                    taskName = prompt("Name für den neuen Task:", this.host.generateUniqueTaskName("ANewTask")) || undefined;
                }
                if (!taskName) return null;

                if (!initialName) {
                    taskName = this.host.generateUniqueTaskName(taskName);
                }

                node = new FlowTask(id, x, y, this.host.canvas, this.host.flowStage.cellSize);
                node.Name = taskName;
                node.setText(taskName);
                if (this.host.project) {
                    (node as FlowTask).setProjectRef(this.host.project);
                    if (taskName !== 'Task') {
                        this.host.ensureTaskExists(taskName, "");
                    }
                }
                break;
            }
            case 'VariableDecl': {
                const kind = type.split(':')[1];
                if (kind === 'threshold') {
                    node = new FlowThresholdVariable(id, x, y, this.host.canvas, this.host.flowStage.cellSize);
                } else if (kind === 'trigger') {
                    node = new FlowTriggerVariable(id, x, y, this.host.canvas, this.host.flowStage.cellSize);
                } else if (kind === 'timer') {
                    node = new FlowTimerVariable(id, x, y, this.host.canvas, this.host.flowStage.cellSize);
                } else if (kind === 'range') {
                    node = new FlowRangeVariable(id, x, y, this.host.canvas, this.host.flowStage.cellSize);
                } else if (kind === 'list') {
                    node = new FlowListVariable(id, x, y, this.host.canvas, this.host.flowStage.cellSize);
                } else if (kind === 'random') {
                    node = new FlowRandomVariable(id, x, y, this.host.canvas, this.host.flowStage.cellSize);
                } else {
                    node = new FlowVariable(id, x, y, this.host.canvas, this.host.flowStage.cellSize);
                }

                const scope = this.host.currentFlowContext === 'global' ? 'global' : this.host.currentFlowContext;
                const varName = this.host.generateUniqueVariableName('neueVariabel');
                node.data = { variable: { name: varName, type: kind || 'integer', initialValue: 0, scope } };

                if (kind === 'threshold') node.data.variable.threshold = 0;
                if (kind === 'trigger') node.data.variable.triggerValue = '';
                if (kind === 'timer') node.data.variable.duration = 5000;
                if (kind === 'range') { node.data.variable.min = 0; node.data.variable.max = 100; }
                if (kind === 'list') { node.data.variable.type = 'list'; node.data.variable.initialValue = '[]'; }
                if (kind === 'random') { node.data.variable.min = 0; node.data.variable.max = 100; node.data.variable.isRandom = true; }

                (node as FlowVariable).updateVisuals?.();
                break;
            }
            case 'While':
            case 'For':
            case 'Repeat': {
                node = new FlowLoop(id, x, y, this.host.canvas, this.host.flowStage.cellSize, type as any);
                node.Name = type;
                (node as FlowLoop).updateVisuals?.();
                break;
            }
            case 'Start':
                node = new FlowStart(id, x, y, this.host.canvas, this.host.flowStage.cellSize);
                node.Name = 'Start';
                break;
            case 'Connection': {
                const conn = new FlowConnection(this.host.canvas, x, y, x + 100, y + 50);
                conn.setGridConfig(this.host.flowStage.cellSize);
                this.host.connections.push(conn);
                this.host.setupConnectionListeners(conn);
                conn.select();
                this.host.selectedConnection = conn;
                return null;
            }
            default:
                return null;
        }

        this.host.canvas.appendChild(node.getElement());
        this.host.nodes.push(node);

        this.host.setupNodeListeners(node);
        if (this.host.onNodesChanged) this.host.onNodesChanged(this.host.nodes);
        this.host.selectNode(node);
        this.host.syncToProject();
        return node;
    }

    public deleteNode(node: FlowElement) {
        const isInternal = node.data?.isEmbeddedInternal;

        if (isInternal) {
            if (!confirm('Dieser Knoten ist intern eingebettet. Möchtest du ihn wirklich aus dieser Ansicht entfernen?')) {
                return;
            }
        } else {
            if (!confirm(`Möchtest du den Knoten "${node.Name || node.name}" wirklich löschen?`)) {
                return;
            }
        }

        this.deleteNodeSilent(node);
    }

    public deleteNodeSilent(node: FlowElement) {
        const nodeName = node.Name || node.name;
        const nodeType = node.getType();

        this.removeNode(node.id);
        this.host.syncToProject();

        if ((nodeType === 'Action' || nodeType === 'DataAction') && nodeName &&
            nodeName !== 'Aktion' && nodeName !== 'Action' && nodeName !== 'DataAction') {
            setTimeout(() => {
                const refs = projectRegistry.findReferences(nodeName);
                if (refs.length === 0) {
                    const isGenericName = /^Action\d*$/.test(nodeName) || /^Aktion\d*$/.test(nodeName) ||
                        /^DataAction\d*$/.test(nodeName) || /^HttpAction\d*$/.test(nodeName) ||
                        nodeName === 'Aufruf';
                    if (isGenericName) {
                        this.deleteElementFromProject('Action', nodeName, undefined, false);
                        if (this.host.onProjectChange) this.host.onProjectChange();
                    } else {
                        if (confirm(`Die Aktion "${nodeName}" wird nun nirgendwo mehr verwendet.\nSoll sie auch aus der globalen Aktions-Liste gelöscht werden?`)) {
                            this.deleteElementFromProject('Action', nodeName, undefined, true);
                            if (this.host.onProjectChange) this.host.onProjectChange();
                        }
                    }
                }
            }, 200);
        }

        if (nodeType === 'VariableDecl' && nodeName) {
            setTimeout(() => {
                const usageCount = (RefactoringManager as any).getVariableUsageCount(this.host.project, nodeName);
                if (usageCount === 0) {
                    if (confirm(`Die Variable "${nodeName}" wird nun nirgendwo mehr verwendet.\nSoll sie auch Global aus dem Projekt gelöscht werden?`)) {
                        this.deleteElementFromProject('Variable' as any, nodeName, undefined, true);
                        if (this.host.onProjectChange) this.host.onProjectChange();
                    }
                } else {
                    if (confirm(`Möchtest du die Variable "${nodeName}" auch Global aus dem Projekt löschen?\n(Sie wird noch an ${usageCount} Stellen referenziert!)`)) {
                        this.deleteElementFromProject('Variable' as any, nodeName, undefined, true);
                        if (this.host.onProjectChange) this.host.onProjectChange();
                    }
                }
            }, 200);
        }
    }

    public removeNode(id: string) {
        const node = this.host.nodes.find(n => n.id === id);
        if (!node) return;

        // Visual remove
        const el = node.getElement();
        if (el && el.parentNode === this.host.canvas) {
            this.host.canvas.removeChild(el);
        }

        // State remove
        const idx = this.host.nodes.indexOf(node);
        if (idx !== -1) this.host.nodes.splice(idx, 1);

        // Remove connections
        const toDelete = this.host.connections.filter(c => c.startTarget === node || c.endTarget === node);
        toDelete.forEach(c => this.deleteConnection(c));

        if (this.host.selectedNode === node) {
            this.host.selectNode(null);
        }

        if (this.host.onNodesChanged) this.host.onNodesChanged(this.host.nodes);
    }

    public clearFlowCanvas(): void {
        this.host.nodes.forEach(n => {
            if (n.getElement().parentNode === this.host.canvas) {
                this.host.canvas.removeChild(n.getElement());
            }
        });
        this.host.nodes.length = 0; // Better way to clear array if public

        this.host.connections.forEach(c => {
            c.destroy();
        });
        this.host.connections.length = 0;
    }

    public deleteConnection(conn: FlowConnection) {
        const index = this.host.connections.indexOf(conn);
        if (index !== -1) {
            this.host.connections.splice(index, 1);
            conn.getElement().remove();
            conn.getStartHandle().remove();
            conn.getEndHandle().remove();
            if (this.host.selectedConnection === conn) {
                this.host.selectedConnection = null;
            }
            this.host.syncToProject();
        }
    }

    public restoreConnection(data: any) {
        // Use Flow_Synchronization for connection restoration
        const connLogger = Logger.get('FlowGraphManager', 'Flow_Synchronization');
        connLogger.debug(`restoreConnection: ${data.startTargetId} -> ${data.endTargetId}`, data);

        const startNode = data.startTargetId ? this.host.nodes.find(n => n.id === data.startTargetId || (n as any).name === data.startTargetId) : null;
        const endNode = data.endTargetId ? this.host.nodes.find(n => n.id === data.endTargetId || (n as any).name === data.endTargetId) : null;

        if (!startNode) connLogger.warn(`Start node ${data.startTargetId} NOT FOUND in current nodes list! Total nodes: ${this.host.nodes.length}`);
        if (!endNode) connLogger.warn(`End node ${data.endTargetId} NOT FOUND in current nodes list! Total nodes: ${this.host.nodes.length}`);

        let x1 = data.startX || 0;
        let y1 = data.startY || 0;
        let x2 = data.endX || 0;
        let y2 = data.endY || 0;

        const conn = new FlowConnection(this.host.canvas, x1, y1, x2, y2, data.id);
        conn.setGridConfig(this.host.flowStage.cellSize);
        if (data.data) conn.data = { ...data.data };

        if (startNode) {
            conn.attachStart(startNode);
        }
        if (endNode) {
            conn.attachEnd(endNode);
        }

        conn.updatePosition();
        this.host.connections.push(conn);
        this.host.setupConnectionListeners(conn);
    }

    public deleteElementFromProject(type: 'Action' | 'Task', name: string, index?: number, force: boolean = false) {
        if (!this.host.project) return;

        if (type === 'Action') {
            const usageCount = RefactoringManager.getActionUsageCount(this.host.project, name);
            if (!force && usageCount > 0) return;

            if (index !== undefined && index >= 0 && index < this.host.project.actions.length) {
                this.host.project.actions.splice(index, 1);
            } else {
                this.host.project.actions = this.host.project.actions.filter(a => a.name !== name);
            }

            if (this.host.project.stages) {
                this.host.project.stages.forEach(stage => {
                    if (stage.actions) {
                        stage.actions = stage.actions.filter(a => a.name !== name);
                    }
                });
            }

            RefactoringManager.deleteAction(this.host.project, name);
            if (this.host.onProjectChange) this.host.onProjectChange();

        } else if (type === 'Task') {
            RefactoringManager.deleteTask(this.host.project, name);
            if (this.host.onProjectChange) this.host.onProjectChange();
        } else if ((type as string) === 'Variable') {
            RefactoringManager.deleteVariable(this.host.project, name);
            if (this.host.onProjectChange) this.host.onProjectChange();
        }
    }
}
