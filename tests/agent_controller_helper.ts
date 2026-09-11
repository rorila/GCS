import { coreStore } from '../src/services/registry/CoreStore';
import { AgentController } from '../src/services/AgentController';
import { GameProject } from '../src/model/types';

export { coreStore, AgentController };

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

/**
 * Erstellt ein minimales Test-Projekt mit Blueprint + Main Stage.
 */
export function createTestProject(): GameProject {
    return {
        meta: { name: 'AgentController Test', author: 'Test', version: '1.0.0' },
        stage: { grid: { cols: 64, rows: 40, cellSize: 18, visible: true, snapToGrid: true, backgroundColor: '#1e1e2e' } },
        objects: [],
        actions: [],
        tasks: [],
        variables: [],
        stages: [
            {
                id: 'stage_blueprint', name: 'Blueprint', type: 'blueprint',
                objects: [], tasks: [], actions: [], variables: [], flowCharts: {}
            },
            {
                id: 'stage_main', name: 'Spielfeld', type: 'main',
                objects: [], tasks: [], actions: [], variables: [], flowCharts: {}
            }
        ],
        activeStageId: 'stage_main'
    } as any;
}
