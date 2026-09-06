import { FlowElement } from '../../flow/FlowElement';
import { FlowConnection } from '../../flow/FlowConnection';

export interface FlowSyncHost {
    project: any;
    currentFlowContext: string;
    nodes: FlowElement[];
    connections: FlowConnection[];
    canvas: HTMLElement;
    cellSize: number;
    showDetails: boolean;
    onProjectChange?: () => void;
    updateFlowSelector: () => void;
    getActiveStage: () => any;
    getTargetFlowCharts: (context: string) => any;
    getTaskDefinitionByName: (name: string) => any;
    setupNodeListeners: (node: FlowElement) => void;
    syncManager: any;
    editor?: any;
}
