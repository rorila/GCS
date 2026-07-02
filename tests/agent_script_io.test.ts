import { AgentController } from '../src/services/AgentController';
import { AgentScriptValidator } from '../src/services/agent/AgentScriptValidator';
import { AgentScriptRepository } from '../src/services/agent/AgentScriptRepository';
import { AgentScript, AGENT_SCRIPT_VERSION } from '../src/services/agent/AgentScriptTypes';
import { GameProject } from '../src/model/types';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

function createTestProject(): GameProject {
    return {
        meta: { name: 'AgentScriptIO Test', author: 'Test', version: '1.0.0' },
        stage: { grid: { cols: 64, rows: 40, cellSize: 18, visible: true, snapToGrid: true, backgroundColor: '#1e1e2e' } },
        objects: [],
        actions: [],
        tasks: [],
        variables: [],
        stages: [
            {
                id: 'stage_main', name: 'Main Stage', type: 'standard',
                objects: [], tasks: [], actions: [], variables: [], flowCharts: {}
            }
        ],
        activeStageId: 'stage_main'
    } as any;
}

export async function runTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({ name, type: 'AgentScriptIO', expectedSuccess: true, actualSuccess: passed, passed, details });
    };

    const agent = AgentController.getInstance();

    // --- Export eines Tasks ---
    try {
        agent.setProject(createTestProject());
        agent.createTask('stage_main', 'Tick', 'Score erhöhen');
        agent.addAction('Tick', 'calculate', 'Inc', { formula: 'score + 1', resultVariable: 'score' });
        const script = agent.exportScript({ scope: 'task', targetId: 'Tick' });
        const ok = script.version === AGENT_SCRIPT_VERSION &&
            script.operations.some(o => o.method === 'createTask') &&
            script.operations.some(o => o.method === 'addAction' && o.params[1] === 'calculate');
        addResult('Export Task', ok, ok ? undefined : JSON.stringify(script.operations));
    } catch (e: any) {
        addResult('Export Task', false, e.message);
    }

    // --- Import einfaches Skript ---
    try {
        agent.setProject(createTestProject());
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'ScoreVariable',
            operations: [{ method: 'addVariable', params: ['score', 'integer', 0, 'global'] }]
        };
        const result = agent.importScript(script, { targetStageId: 'stage_main', conflictStrategy: 'error' });
        const ok = result.success && result.appliedOperations === 1 && agent.listVariables().some(v => v.name === 'score');
        addResult('Import Variable', ok, ok ? undefined : JSON.stringify(result.errors));
    } catch (e: any) {
        addResult('Import Variable', false, e.message);
    }

    // --- Konflikt im Fehler-Modus ---
    try {
        agent.setProject(createTestProject());
        agent.addVariable('score', 'integer', 0, 'global');
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'ScoreVariable',
            operations: [{ method: 'addVariable', params: ['score', 'integer', 0, 'global'] }]
        };
        const result = agent.importScript(script, { targetStageId: 'stage_main', conflictStrategy: 'error' });
        const ok = !result.success && result.errors.some(e => e.includes("Variable 'score' existiert bereits"));
        addResult('Konflikt Error-Modus', ok, ok ? undefined : JSON.stringify(result.errors));
    } catch (e: any) {
        addResult('Konflikt Error-Modus', false, e.message);
    }

    // --- Rename-Modus ---
    try {
        agent.setProject(createTestProject());
        agent.addVariable('score', 'integer', 0, 'global');
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'ScoreVariable',
            operations: [{ method: 'addVariable', params: ['score', 'integer', 0, 'global'] }]
        };
        const result = agent.importScript(script, { targetStageId: 'stage_main', conflictStrategy: 'rename', autoRenameSuffix: '_import' });
        const ok = result.success && result.renamedItems['score'] === 'score_import' && agent.listVariables().some(v => v.name === 'score_import');
        addResult('Konflikt Rename-Modus', ok, ok ? undefined : JSON.stringify(result));
    } catch (e: any) {
        addResult('Konflikt Rename-Modus', false, e.message);
    }

    // --- DryRun ---
    try {
        agent.setProject(createTestProject());
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'ScoreVariable',
            operations: [{ method: 'addVariable', params: ['score', 'integer', 0, 'global'] }]
        };
        const result = agent.importScript(script, { targetStageId: 'stage_main', dryRun: true });
        const ok = result.success && result.appliedOperations === 0 && !agent.listVariables().some(v => v.name === 'score');
        addResult('DryRun', ok);
    } catch (e: any) {
        addResult('DryRun', false, e.message);
    }

    // --- Asset-Pfade beim Export ---
    try {
        agent.setProject(createTestProject());
        agent.createSprite('stage_main', 'Ball', 10, 10, 2, 2, { backgroundImage: 'assets/ball.png' });
        const script = agent.exportScript({ scope: 'stage', targetId: 'stage_main' });
        const ok = script.assetPaths?.includes('assets/ball.png') ?? false;
        addResult('Asset Export', ok, ok ? undefined : JSON.stringify(script.assetPaths));
    } catch (e: any) {
        addResult('Asset Export', false, e.message);
    }

    // --- Fehlende Asset-Warnung ---
    try {
        agent.setProject(createTestProject());
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'MissingAsset',
            assetPaths: ['assets/missing.png'],
            operations: [{ method: 'addVariable', params: ['x', 'integer', 0, 'global'] }]
        };
        const result = agent.importScript(script, { projectRoot: './', dryRun: true });
        const ok = result.warnings.some(w => w.includes("Asset 'assets/missing.png' nicht gefunden"));
        addResult('Asset Warnung', ok);
    } catch (e: any) {
        addResult('Asset Warnung', false, e.message);
    }

    // --- Validator blockiert unerlaubte Methode ---
    try {
        agent.setProject(createTestProject());
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'BadScript',
            operations: [{ method: 'executeBatch', params: [] }]
        };
        const validation = AgentScriptValidator.validate(script, agent);
        const ok = !validation.valid && validation.errors.some(e => e.includes("'executeBatch' ist nicht erlaubt"));
        addResult('Validator Methode', ok, ok ? undefined : JSON.stringify(validation.errors));
    } catch (e: any) {
        addResult('Validator Methode', false, e.message);
    }

    // --- Repository Speichern/Laden ---
    try {
        const repo = new AgentScriptRepository('./tmp-snippets');
        const script: AgentScript = { version: AGENT_SCRIPT_VERSION, name: 'PongBall', operations: [] };
        const filePath = repo.save(script);
        const loaded = repo.load(filePath);
        const ok = loaded.name === 'PongBall';
        addResult('Repository', ok);
    } catch (e: any) {
        addResult('Repository', false, e.message);
    }

    return results;
}
