import { FlowElement } from '../flow/FlowElement';
import { FlowAction } from '../flow/FlowAction';
import { FlowCommentNode } from '../flow/FlowCommentNode';
import { FlowTask } from '../flow/FlowTask';

import { FlowCondition } from '../flow/FlowCondition';
import { FlowDataAction } from '../flow/FlowDataAction';
import { FlowConnection } from '../flow/FlowConnection';
import { FlowVariable } from '../flow/FlowVariable';
import { FlowThresholdVariable } from '../flow/FlowThresholdVariable';
import { FlowTriggerVariable } from '../flow/FlowTriggerVariable';
import { FlowTimerVariable } from '../flow/FlowTimerVariable';
import { FlowRangeVariable } from '../flow/FlowRangeVariable';
import { FlowListVariable } from '../flow/FlowListVariable';
import { FlowRandomVariable } from '../flow/FlowRandomVariable';
import { FlowLoop } from '../flow/FlowLoop';
import { FlowNamingService } from './FlowNamingService';
import { Logger } from '../../utils/Logger';
import { PromptDialog } from '../ui/PromptDialog';

const logger = Logger.get('FlowNodeFactory');

export interface FlowNodeHost {
    canvas: HTMLElement;
    flowStage: any;
    project: any;
    showDetails: boolean;
    currentFlowContext: string;
    nodes: FlowElement[];
    connections: FlowConnection[];
    onNodesChanged?: (nodes: FlowElement[]) => void;

    setupNodeListeners(node: FlowElement): void;
    setupConnectionListeners(conn: FlowConnection): void;
    selectNode(node: FlowElement | null): void;
    syncToProject(): void;
    ensureTaskExists(taskName: string, description?: string): void;
    selectedConnection: FlowConnection | null;
}

export class FlowNodeFactory {
    constructor(private host: FlowNodeHost) { }

    public async createNode(type: string, x: number, y: number, initialName?: string): Promise<FlowElement | null> {
        logger.info(`[FlowEditor] createNode: type=${type}, x=${x}, y=${y}, initialName=${initialName}`);
        let node: FlowElement;
        const id = 'node-' + Date.now();
        const baseType = (type.includes(':') ? type.split(':')[0] : type).toLowerCase();
        const cellSize = this.host.flowStage.cellSize;

        switch (baseType) {
            case 'action': {
                const actionSubtype = type.includes(':') ? type.split(':')[1] : null;
                node = new FlowAction(id, x, y, this.host.canvas, cellSize);
                if (initialName && initialName !== 'Action' && initialName !== 'Aktion') {
                    node.Name = initialName;
                } else {
                    node.Name = FlowNamingService.generateUniqueActionName(this.host.project, this.host.nodes, initialName || 'Action');
                }
                if (actionSubtype) {
                    node.data = node.data || {};
                    node.data.type = actionSubtype;
                }
                if (this.host.project) {
                    (node as FlowAction).setProjectRef(this.host.project);
                }
                break;
            }
            case 'dataaction':
            case 'data_action': {
                node = new FlowDataAction(id, x, y, this.host.canvas, cellSize);
                if (initialName && initialName !== 'DataAction' && initialName !== 'Daten-Aktion') {
                    node.Name = initialName;
                } else {
                    node.Name = FlowNamingService.generateUniqueActionName(this.host.project, this.host.nodes, initialName || 'DataAction');
                }
                // Standard-Felder für eine vollständige DataAction setzen
                node.data = {
                    ...node.data,
                    type: 'data_action',
                    details: '(data_action)',
                    showDetails: false,
                    dataStore: '',
                    queryProperty: '',
                    queryValue: '',
                    url: '',
                    method: 'GET',
                    requestJWT: false,
                    resultVariable: '',
                    selectFields: '*'
                };
                if (this.host.project) {
                    (node as FlowAction).setProjectRef(this.host.project);
                }
                break;
            }
            case 'condition':
                node = new FlowCondition(id, x, y, this.host.canvas, cellSize);
                node.Name = initialName || 'Bedingung';
                break;
            case 'task': {
                let taskName = initialName;
                if (!taskName) {
                    taskName = await PromptDialog.show("Name für den neuen Task:", FlowNamingService.generateUniqueTaskName(this.host.project, this.host.nodes, "ANewTask")) || undefined;
                }
                if (!taskName) return null;

                if (!initialName) {
                    taskName = FlowNamingService.generateUniqueTaskName(this.host.project, this.host.nodes, taskName);
                }

                node = new FlowTask(id, x, y, this.host.canvas, cellSize);
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
            case 'variabledecl': {
                const kind = type.split(':')[1];
                if (kind === 'threshold') {
                    node = new FlowThresholdVariable(id, x, y, this.host.canvas, cellSize);
                } else if (kind === 'trigger') {
                    node = new FlowTriggerVariable(id, x, y, this.host.canvas, cellSize);
                } else if (kind === 'timer') {
                    node = new FlowTimerVariable(id, x, y, this.host.canvas, cellSize);
                } else if (kind === 'range') {
                    node = new FlowRangeVariable(id, x, y, this.host.canvas, cellSize);
                } else if (kind === 'list') {
                    node = new FlowListVariable(id, x, y, this.host.canvas, cellSize);
                } else if (kind === 'random') {
                    node = new FlowRandomVariable(id, x, y, this.host.canvas, cellSize);
                } else {
                    node = new FlowVariable(id, x, y, this.host.canvas, cellSize);
                }

                const scope = this.host.currentFlowContext === 'global' ? 'global' : this.host.currentFlowContext;
                const varName = FlowNamingService.generateUniqueVariableName(this.host.project, this.host.nodes, 'neueVariabel');
                node.data = { variable: { name: varName, type: kind || 'integer', initialValue: 0, scope } };

                if (kind === 'threshold') node.data.variable.threshold = 0;
                if (kind === 'trigger') node.data.variable.triggerValue = '';
                if (kind === 'timer') node.data.variable.duration = 5000;
                if (kind === 'range') { node.data.variable.min = 0; node.data.variable.max = 100; }
                if (kind === 'list') { node.data.variable.type = 'list'; node.data.variable.initialValue = '[]'; }
                if (kind === 'random') { node.data.variable.min = 0; node.data.variable.max = 100; node.data.variable.isRandom = true; }

                if (this.host.project) {
                    (node as FlowVariable).setProjectRef(this.host.project);
                }

                (node as FlowVariable).updateVisuals?.();
                break;
            }
            case 'while':
            case 'for':
            case 'repeat':
                node = new FlowLoop(id, x, y, this.host.canvas, cellSize, baseType as any);
                node.Name = type;
                (node as FlowLoop).updateVisuals?.();
                break;
            case 'comment': {
                const comment = new FlowCommentNode(id, x, y, this.host.canvas, cellSize);
                if (initialName) comment.Name = initialName;
                node = comment;
                break;
            }

            case 'connection': {
                logger.info(`[FlowEditor] Erstelle freifliegende Connection bei ${x}, ${y}`);
                const conn = new FlowConnection(this.host.canvas, x, y, x + 100, y + 50);
                conn.setGridConfig(cellSize);
                this.host.connections.push(conn);
                this.host.setupConnectionListeners(conn);
                conn.select();
                this.host.selectedConnection = conn;
                logger.info(`[FlowEditor] Freifliegende Connection erstellt. ID: ${conn.id}`);

                // Mache ein Event Update, damit der Node auch registriert/gesynct werden kann
                this.host.syncToProject();
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
}
