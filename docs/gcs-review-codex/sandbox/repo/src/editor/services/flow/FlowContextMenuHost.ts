import { GameProject } from '../../../model/types';
import { FlowElement } from '../../flow/FlowElement';
import { FlowConnection } from '../../flow/FlowConnection';
import { ContextMenu } from '../../ui/ContextMenu';

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
    createNode: (type: string, x: number, y: number, initialName?: string) => Promise<FlowElement | null> | FlowElement | null;
    renameObjectWithRefactoring?: (id: string, newName: string, oldName?: string) => void;
}
