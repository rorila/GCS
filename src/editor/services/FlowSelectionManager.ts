import { FlowElement } from '../flow/FlowElement';
import { FlowAction } from '../flow/FlowAction';
import { FlowTask } from '../flow/FlowTask';
import { GameProject } from '../../model/types';
import { FlowStateManager } from '../flow/FlowStateManager';
import { FlowConnection } from '../flow/FlowConnection';
import { serviceRegistry } from '../../services/ServiceRegistry';

export interface FlowSelectionHost {
    stateManager: FlowStateManager;
    project: GameProject | null;
    currentFlowContext: string;
    editor: any;
    detailsToggleBtn: HTMLElement;
    syncNodeVisuals: (nodeId: string) => void;
    onObjectSelect?: (obj: any) => void;
}

export class FlowSelectionManager {
    constructor(private host: FlowSelectionHost) { }

    public selectNode(node: FlowElement | null) {
        if (!node) {
            this.deselectAll(true);
            return;
        }
        this.deselectAll(false); // Don't trigger null select, we are about to select something
        this.host.stateManager.selectNode(node);

        // Visual Feedback
        node.getElement().style.outline = '2px solid cyan';

        // Ensure project reference is set for Task nodes (needed for Inspector parameters)
        if (node instanceof FlowTask && this.host.project) {
            node.setProjectRef(this.host.project);
        }

        // Feature: Projekt-Landkarte Object Selection
        if (this.host.currentFlowContext === 'event-map' && node && node.data?.isProxy && node.data?.stageObjectId) {
            if (serviceRegistry) {
                serviceRegistry.call('Editor', 'selectObject', [node.data.stageObjectId]);
            }
        }

        // Notify Inspector
        if (this.host.onObjectSelect) {
            this.host.onObjectSelect(node);
        }
    }

    public selectNodeById(nodeId: string | null): void {
        if (!nodeId) {
            this.deselectAll(true);
            return;
        }

        const node = this.host.stateManager.getNodesInternal().find(n => n.name === nodeId);
        if (node) {
            this.selectNode(node);
            // Scroll node into view if needed
            node.getElement().scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    public selectConnection(conn: FlowConnection | null) {
        if (!conn) {
            this.deselectAll(true);
            return;
        }
        this.deselectAll(false);
        this.host.stateManager.selectConnection(conn);

        // Notify Inspector
        if (this.host.onObjectSelect) {
            this.host.onObjectSelect(conn);
        }
    }

    public refreshSelectedNode() {
        const selectedNode = this.host.stateManager.getSelectedNode();
        if (!selectedNode) return;

        // Clear cached details to force regeneration
        if (selectedNode instanceof FlowAction) {
            selectedNode.Details = '';
            selectedNode.setShowDetails(this.host.stateManager.getShowDetails(), this.host.project);
        } else {
            // Task or Start node - simple text refresh
            selectedNode.Text = selectedNode.Name;
        }

        // Apply Redraw 
        if (typeof (selectedNode as any).draw === 'function') {
            (selectedNode as any).draw(this.host.stateManager.getShowDetails());
        }
        this.host.syncNodeVisuals(selectedNode.id);
    }

    public deselectAll(emitEvent: boolean = true) {
        const selectedConn = this.host.stateManager.getSelectedConnection();
        if (selectedConn) {
            selectedConn.deselect();
            this.host.stateManager.selectConnection(null);
        }

        const selectedNode = this.host.stateManager.getSelectedNode();
        if (selectedNode) {
            selectedNode.getElement().style.outline = 'none';
            this.host.stateManager.selectNode(null);
        }

        // Notify null selection
        if (emitEvent && this.host.onObjectSelect) {
            this.host.onObjectSelect(null);
        }
    }

    public toggleDetailsView(): void {
        const isDetails = !this.host.stateManager.getShowDetails();
        this.host.stateManager.setShowDetails(isDetails);
        this.updateActionDetails();
    }

    public updateActionDetails(): void {
        const isDetails = this.host.stateManager.getShowDetails();
        this.host.detailsToggleBtn.innerHTML = isDetails
            ? '<i class="fas fa-search-minus"></i> Kompakt-Ansicht'
            : '<i class="fas fa-search-plus"></i> Detail-Ansicht';

        this.host.stateManager.getNodesInternal().forEach(n => {
            if (n instanceof FlowAction) {
                n.setShowDetails(isDetails, this.host.project);
            }
            if (typeof (n as any).draw === 'function') {
                (n as any).draw(isDetails);
            }
        });
    }
}
