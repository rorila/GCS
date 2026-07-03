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
                objects: [], tasks: [], actions: [], variables: [], flowCharts: {},
                grid: { cols: 64, rows: 40, cellSize: 18, visible: true, snapToGrid: true, backgroundColor: '#1e1e2e' }
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

    // --- Export Task: Action in stage.actions (nicht blueprint) ---
    try {
        agent.setProject(createTestProject());
        agent.createTask('stage_main', 'StageActionTask', '');
        // Action direkt in stage.actions schreiben (simuliert FlowEditor-Verhalten)
        const mainStage = (agent as any).project.stages.find((s: any) => s.id === 'stage_main');
        if (!mainStage.actions) mainStage.actions = [];
        const stageAction = { id: 'sa1', name: 'StageAction', type: 'property', target: 'Ball', changes: { visible: true } };
        mainStage.actions.push(stageAction);
        const task = (agent as any).project.stages.flatMap((s: any) => s.tasks || []).find((t: any) => t.name === 'StageActionTask');
        if (task) task.actionSequence.push({ type: 'action', name: 'StageAction' });
        const script = agent.exportScript({ scope: 'task', targetId: 'StageActionTask' });
        const ok = script.operations.some(o => o.method === 'addAction' && o.params[2] === 'StageAction');
        addResult('Export Task (Stage-Action)', ok, ok ? undefined : JSON.stringify(script.operations));
    } catch (e: any) {
        addResult('Export Task (Stage-Action)', false, e.message);
    }

    // --- Export enthält Scope ---
    try {
        agent.setProject(createTestProject());
        const taskScript = agent.exportScript({ scope: 'task', targetId: 'Tick' });
        const projectScript = agent.exportScript({ scope: 'project' });
        const ok = taskScript.scope === 'task' && projectScript.scope === 'project';
        addResult('Export Scope', ok, ok ? undefined : JSON.stringify({ task: taskScript.scope, project: projectScript.scope }));
    } catch (e: any) {
        addResult('Export Scope', false, e.message);
    }

    // --- Export Stage Config (backgroundColor + grid) ---
    try {
        agent.setProject(createTestProject());
        const bg = '#10102d';
        const grid = { cols: 80, rows: 50, cellSize: 10, snapToGrid: false, visible: true, backgroundColor: '#1a1a1a' };
        (agent as any).project.stages[1].backgroundColor = bg;
        (agent as any).project.stages[1].grid = grid;
        const script = agent.exportScript({ scope: 'project' });
        const createOp = script.operations.find(o => o.method === 'createStage' && o.params[0] === 'stage_main');
        const exportedConfig = createOp?.params[3] as any;
        const ok = !!createOp && exportedConfig?.backgroundColor === bg && exportedConfig?.grid?.cols === 80;
        addResult('Export Stage Config', ok, ok ? undefined : JSON.stringify(createOp));
    } catch (e: any) {
        addResult('Export Stage Config', false, e.message);
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

    // --- Asset-Remap beim Import ---
    try {
        agent.setProject(createTestProject());
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'RemapTest',
            operations: [
                { method: 'addObject', params: ['stage_main', { name: 'Ball', className: 'TSprite', backgroundImage: 'old/assets/ball.png' }] }
            ]
        };
        const result = agent.importScript(script, {
            assetRemap: { 'old/assets/ball.png': 'new/assets/ball.png' }
        });
        const project = (agent as any).project;
        const obj = project?.stages?.[0]?.objects?.find((o: any) => o.name === 'Ball');
        const remapped = obj?.backgroundImage === 'new/assets/ball.png';
        addResult('Asset Remap', remapped && result.success, remapped ? undefined : JSON.stringify(obj));
    } catch (e: any) {
        addResult('Asset Remap', false, e.message);
    }

    // --- Pro-Item Konflikt-Override ---
    try {
        agent.setProject(createTestProject());
        agent.addVariable('score', 'integer', 0, 'global');
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'OverrideTest',
            operations: [
                { method: 'addVariable', params: ['score', 'integer', 0, 'global'] }
            ]
        };
        const result = agent.importScript(script, {
            conflictStrategy: 'rename',
            conflictOverrides: { score: 'skip' }
        });
        const ok = result.success && result.skippedItems.includes('score') && !agent.listVariables().some(v => v.name === 'score_import');
        addResult('Konflikt Override', ok, ok ? undefined : JSON.stringify(result));
    } catch (e: any) {
        addResult('Konflikt Override', false, e.message);
    }

    // --- Selection-Export ---
    try {
        agent.setProject(createTestProject());
        agent.createSprite('stage_main', 'Ball', 10, 10, 2, 2);
        agent.addVariable('score', 'integer', 0, 'global');
        const script = agent.exportScript({
            scope: 'selection',
            selection: { objects: ['Ball'], variables: ['score'] }
        });
        const hasObject = script.operations.some(o => o.method === 'addObject' && o.params[1]?.name === 'Ball');
        const hasVariable = script.operations.some(o => o.method === 'addVariable' && o.params[0] === 'score');
        const ok = hasObject && hasVariable;
        addResult('Selection Export', ok, ok ? undefined : JSON.stringify(script.operations));
    } catch (e: any) {
        addResult('Selection Export', false, e.message);
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
