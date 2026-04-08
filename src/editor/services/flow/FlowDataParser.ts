import { FlowSyncHost } from './FlowSyncTypes';
import { FlowElement } from '../../flow/FlowElement';
import { FlowAction } from '../../flow/FlowAction';
import { FlowTask } from '../../flow/FlowTask';
import { FlowCondition } from '../../flow/FlowCondition';
import { FlowVariable } from '../../flow/FlowVariable';
import { FlowLoop } from '../../flow/FlowLoop';
import { FlowThresholdVariable } from '../../flow/FlowThresholdVariable';
import { FlowTriggerVariable } from '../../flow/FlowTriggerVariable';
import { FlowTimerVariable } from '../../flow/FlowTimerVariable';
import { FlowRangeVariable } from '../../flow/FlowRangeVariable';
import { FlowListVariable } from '../../flow/FlowListVariable';
import { FlowRandomVariable } from '../../flow/FlowRandomVariable';
import { FlowDataAction } from '../../flow/FlowDataAction';

export class FlowDataParser {
    constructor(private host: FlowSyncHost) {}

    public restoreNode(data: any): FlowElement | null {
        let node: FlowElement | null = null;
        const cellSize = this.host.cellSize;
        const canvas = this.host.canvas;
        const snap = true;

        const type = (data.type || '').toLowerCase();
        switch (type) {
            case 'action': node = new FlowAction(data.id, data.x, data.y, canvas, cellSize); break;
            case 'data_action': node = new FlowDataAction(data.id, data.x, data.y, canvas, cellSize); break;
            case 'condition': node = new FlowCondition(data.id, data.x, data.y, canvas, cellSize); break;
            case 'task': node = new FlowTask(data.id, data.x, data.y, canvas, cellSize); break;
            case 'variabledecl': node = this.restoreVariableNode(data); break;
            case 'while': case 'for': case 'repeat': node = new FlowLoop(data.id, data.x, data.y, canvas, cellSize, type); break;
        }

        if (node) {
            node.setGridConfig(cellSize, snap);
            const w = isNaN(data.width) ? 150 : data.width;
            const h = isNaN(data.height) ? 60 : data.height;
            const dx = isNaN(data.x) ? 0 : data.x;
            const dy = isNaN(data.y) ? 0 : data.y;

            node.Width = Math.round(w / cellSize) * cellSize;
            node.Height = Math.round(h / cellSize) * cellSize;
            node.X = Math.round(dx / cellSize) * cellSize;
            node.Y = Math.round(dy / cellSize) * cellSize;
            node.data = data.data || {};

            if (data.properties) {
                if (data.properties.name) node.Name = data.properties.name;
                if (data.properties.details) node.Details = data.properties.details;
                if (data.properties.description) node.Description = data.properties.description;
                if (data.properties.text && !data.properties.name) node.Name = data.properties.text;
            }

            if (node instanceof FlowTask || node instanceof FlowAction || node instanceof FlowDataAction) {
                (node as any).setShowDetails?.(this.host.showDetails || false, this.host.project);
            }

            if (this.host.project && (node instanceof FlowTask || node instanceof FlowAction || node instanceof FlowVariable)) {
                (node as any).setProjectRef(this.host.project);
            }

            if (node instanceof FlowVariable) (node as any).updateVisuals?.();
            if (node instanceof FlowLoop) (node as any).updateVisuals?.();
            if (node instanceof FlowCondition) (node as any).refreshVisuals?.();

            if (type === 'action' && this.host.project) {
                const actionName = data.properties?.name || data.data?.name;
                const stage = this.host.getActiveStage();
                const projectAction = (this.host.project.actions || []).find((a: any) => a.name === actionName) ||
                    (stage?.actions || []).find((a: any) => a.name === actionName);

                if (projectAction) {
                    node.data = { ...node.data, ...projectAction };
                    if (projectAction.type === 'data_action' && !(node instanceof FlowDataAction)) {
                        const upgraded = new FlowDataAction(data.id, node.X, node.Y, canvas, cellSize);
                        upgraded.setGridConfig(cellSize, snap);
                        upgraded.Width = node.Width;
                        upgraded.Height = node.Height;
                        upgraded.Name = node.Name;
                        upgraded.Details = node.Details;
                        upgraded.Description = node.Description;
                        if (this.host.project) (upgraded as any).setProjectRef?.(this.host.project);
                        upgraded.data = { ...node.data, ...projectAction };
                        this.host.setupNodeListeners(upgraded);
                        return upgraded;
                    }
                }
            }
            this.host.setupNodeListeners(node);
        }
        return node;
    }

    private restoreVariableNode(data: any): FlowElement {
        const { id, x, y } = data;
        const kind = data.data?.variable?.type;
        let node: FlowVariable;
        if (kind === 'threshold') node = new FlowThresholdVariable(id, x, y, this.host.canvas, this.host.cellSize);
        else if (kind === 'trigger') node = new FlowTriggerVariable(id, x, y, this.host.canvas, this.host.cellSize);
        else if (kind === 'timer') node = new FlowTimerVariable(id, x, y, this.host.canvas, this.host.cellSize);
        else if (kind === 'range') node = new FlowRangeVariable(id, x, y, this.host.canvas, this.host.cellSize);
        else if (kind === 'list') node = new FlowListVariable(id, x, y, this.host.canvas, this.host.cellSize);
        else if (kind === 'random') node = new FlowRandomVariable(id, x, y, this.host.canvas, this.host.cellSize);
        else node = new FlowVariable(id, x, y, this.host.canvas, this.host.cellSize);
        return node;
    }

    public extractLayoutOverrides(nodes: any[]): Record<string, { x: number, y: number }> {
        const layout: Record<string, { x: number, y: number }> = {};
        nodes.forEach(n => {
            const key = n.Name || n.name || n.data?.name || n.data?.taskName;
            if (key) {
                const x = typeof n.X === 'number' ? n.X : (n.x ?? 0);
                const y = typeof n.Y === 'number' ? n.Y : (n.y ?? 0);
                layout[key] = { x, y };
            }
        });
        return layout;
    }

    public findActionInSequence(sequence: any[], name: string): any | null {
        if (!sequence) return null;
        for (const item of sequence) {
            const itemName = item.name || item.actionName;
            if (itemName === name) return item;
            if (item.body) {
                const found = this.findActionInSequence(item.body, name);
                if (found) return found;
            }
            if (item.then) {
                const found = this.findActionInSequence(item.then, name);
                if (found) return found;
            }
            if (item.else) {
                const found = this.findActionInSequence(item.else, name);
                if (found) return found;
            }
        }
        return null;
    }
}
