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

    // --- Export Objekt: Getter-Properties (backgroundImage) ---
    try {
        agent.setProject(createTestProject());
        // Simuliert eine Live-Instanz mit privatem Backing-Field + toDTO()-Getter-Serialisierung
        const spriteInstance: any = {
            className: 'TSprite',
            name: 'ImageSprite',
            x: 0, y: 0, width: 4, height: 4,
            _backgroundImage: 'data:image/png;base64,AAAA',
            toDTO() {
                return {
                    className: this.className,
                    name: this.name,
                    x: this.x, y: this.y, width: this.width, height: this.height,
                    backgroundImage: this._backgroundImage
                };
            }
        };
        const mainStage = (agent as any).project.stages.find((s: any) => s.id === 'stage_main');
        mainStage.objects.push(spriteInstance);
        const script = agent.exportScript({ scope: 'project' });
        const addOp = script.operations.find(o => o.method === 'addObject' && o.params[1]?.name === 'ImageSprite');
        const params = addOp?.params[1] as any;
        const ok = !!addOp && params.backgroundImage === 'data:image/png;base64,AAAA' && params._backgroundImage === undefined;
        addResult('Export Objekt (backgroundImage)', ok, ok ? undefined : JSON.stringify(params));
    } catch (e: any) {
        addResult('Export Objekt (backgroundImage)', false, e.message);
    }

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

    // --- Import Stage Config (createStage mit config) ---
    try {
        agent.setProject(createTestProject());
        const bg = '#10102d';
        const gridCols = 80;
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'StageConfigImport',
            operations: [{
                method: 'createStage',
                params: ['stage_main', 'Main Stage', 'standard', { backgroundColor: bg, grid: { cols: gridCols, rows: 50, cellSize: 10, snapToGrid: false, visible: true, backgroundColor: '#1a1a1a' } }]
            }]
        };
        const result = agent.importScript(script, { conflictStrategy: 'error' });
        const importedStage = (agent as any).project.stages.find((s: any) => s.id === 'stage_main');
        const ok = result.success && importedStage?.backgroundColor === bg && importedStage?.grid?.cols === gridCols;
        addResult('Import Stage Config', ok, ok ? undefined : JSON.stringify({ result, stage: importedStage }));
    } catch (e: any) {
        addResult('Import Stage Config', false, e.message);
    }

    // --- Generischer Stage-Config-Roundtrip (Ansatz C) ---
    try {
        agent.setProject(createTestProject());
        const src = (agent as any).project.stages.find((s: any) => s.id === 'stage_main');
        src.backgroundImage = 'data:image/png;base64,BBBB';
        src.backgroundImageMode = 'tile';
        src.startAnimation = 'fadeIn';
        src.startAnimationDuration = 500;
        src.events = { onRuntimeStart: 'Boot' };
        src.input = { keyboard: true };
        const script = agent.exportScript({ scope: 'project' });

        // In frisches Projekt importieren (createStage aktualisiert bestehende Stage generisch)
        agent.setProject(createTestProject());
        const result = agent.importScript(script, { conflictStrategy: 'rename' });
        const dst = (agent as any).project.stages.find((s: any) => s.id === 'stage_main');
        const ok = result.success
            && dst?.backgroundImage === 'data:image/png;base64,BBBB'
            && dst?.backgroundImageMode === 'tile'
            && dst?.startAnimation === 'fadeIn'
            && dst?.startAnimationDuration === 500
            && dst?.events?.onRuntimeStart === 'Boot'
            && dst?.input?.keyboard === true;
        addResult('Stage-Config Roundtrip (generisch)', ok, ok ? undefined : JSON.stringify(dst));
    } catch (e: any) {
        addResult('Stage-Config Roundtrip (generisch)', false, e.message);
    }

    // --- ID-Mismatch: Fallback auf aktive Stage ---
    try {
        agent.setProject(createTestProject()); // activeStageId = 'stage_main'
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'StagePlaceholder',
            operations: [{ method: 'addVariable', params: ['hp', 'integer', 100, '${STAGE}'] }]
        };
        // Nicht existierende Ziel-Stage → sollte auf 'stage_main' zurückfallen + Warnung.
        // ${STAGE} wird als 4. Param (scope) aufgelöst; addVariable legt in project.variables ab.
        const result = agent.importScript(script, { targetStageId: 'does_not_exist', conflictStrategy: 'error' });
        const hp = (agent as any).project.variables.find((v: any) => v.name === 'hp');
        const ok = result.success
            && hp?.scope === 'stage_main'
            && result.warnings.some(w => w.includes('does_not_exist'));
        addResult('ID-Mismatch Fallback', ok, ok ? undefined : JSON.stringify({ warnings: result.warnings, errors: result.errors }));
    } catch (e: any) {
        addResult('ID-Mismatch Fallback', false, e.message);
    }

    // --- Condition (FlowCondition) Roundtrip ---
    try {
        agent.setProject(createTestProject());
        agent.createTask('stage_main', 'CheckScore', 'Prüft Score');
        agent.ensureActionDefined('calculate', 'IncWin', { formula: 'score + 10', resultVariable: 'score' });
        agent.ensureActionDefined('calculate', 'IncLose', { formula: 'score - 5', resultVariable: 'score' });
        agent.addBranch('CheckScore', 'score', '>', 100,
            (b) => b.addAction('IncWin'),
            (b) => b.addAction('IncLose'));

        const script = agent.exportScript({ scope: 'task', targetId: 'CheckScore' });
        const hasBranch = script.operations.some(o => o.method === 'addConditionItem');
        const defCount = script.operations.filter(o => o.method === 'ensureActionDefined').length;

        // In frisches Projekt importieren
        agent.setProject(createTestProject());
        const result = agent.importScript(script, { targetStageId: 'stage_main', conflictStrategy: 'error' });
        const task = (agent as any).project.stages.flatMap((s: any) => s.tasks || []).find((t: any) => t.name === 'CheckScore');
        const cond = task?.actionSequence?.find((i: any) => i.type === 'condition');
        const ok = hasBranch && defCount === 2 && result.success
            && cond?.condition?.variable === 'score'
            && cond?.condition?.operator === '>'
            && cond?.condition?.value === 100
            && cond?.then?.[0]?.name === 'IncWin'
            && cond?.else?.[0]?.name === 'IncLose';
        addResult('Condition Roundtrip (Array-Form)', ok, ok ? undefined : JSON.stringify({ hasBranch, defCount, result: result.errors, cond }));
    } catch (e: any) {
        addResult('Condition Roundtrip (Array-Form)', false, e.message);
    }

    // --- Condition Roundtrip (Shortcut-Form: thenAction/elseAction) ---
    try {
        agent.setProject(createTestProject());
        agent.createTask('stage_main', 'ShortcutCond', '');
        agent.ensureActionDefined('calculate', 'DoThen', { formula: 'score + 1', resultVariable: 'score' });
        agent.ensureActionDefined('calculate', 'DoElse', { formula: 'score - 1', resultVariable: 'score' });
        // Condition-Item in Shortcut-Form direkt anlegen (simuliert FlowEditor-Ausgabe)
        const task0 = (agent as any).project.stages.flatMap((s: any) => s.tasks || []).find((t: any) => t.name === 'ShortcutCond');
        task0.actionSequence.push({
            type: 'condition',
            name: 'Shortcut',
            condition: { variable: 'score', operator: '==', value: 5 },
            thenAction: 'DoThen',
            elseAction: 'DoElse'
        });

        const script = agent.exportScript({ scope: 'task', targetId: 'ShortcutCond' });
        const defCount = script.operations.filter(o => o.method === 'ensureActionDefined').length;

        agent.setProject(createTestProject());
        const result = agent.importScript(script, { targetStageId: 'stage_main', conflictStrategy: 'error' });
        const task = (agent as any).project.stages.flatMap((s: any) => s.tasks || []).find((t: any) => t.name === 'ShortcutCond');
        const cond = task?.actionSequence?.find((i: any) => i.type === 'condition');
        const ok = defCount === 2 && result.success
            && cond?.thenAction === 'DoThen'
            && cond?.elseAction === 'DoElse'
            && agent.listActions().some((a: any) => a.name === 'DoThen')
            && agent.listActions().some((a: any) => a.name === 'DoElse');
        addResult('Condition Roundtrip (Shortcut-Form)', ok, ok ? undefined : JSON.stringify({ defCount, result: result.errors, cond }));
    } catch (e: any) {
        addResult('Condition Roundtrip (Shortcut-Form)', false, e.message);
    }

    // --- Condition Roundtrip (body/elseBody-Form: FlowEditor-Format) ---
    try {
        agent.setProject(createTestProject());
        agent.createTask('stage_main', 'BodyCond', '');
        agent.ensureActionDefined('calculate', 'DecCannons', { formula: '${CurrCannonCount}-1', resultVariable: '${CurrCannonCount}' });
        agent.ensureActionDefined('calculate', 'LoseGame', { formula: 'score - 100', resultVariable: 'score' });
        // Condition-Item in body/elseBody-Form (so speichert der FlowSequenceBuilder Conditions)
        const task0 = (agent as any).project.stages.flatMap((s: any) => s.tasks || []).find((t: any) => t.name === 'BodyCond');
        task0.actionSequence.push({
            type: 'condition',
            name: 'Body',
            condition: { leftValue: '${CurrCannonCount}', rightValue: 0, operator: '>' },
            body: [{ type: 'action', name: 'DecCannons' }],
            elseBody: [{ type: 'action', name: 'LoseGame' }]
        });

        const script = agent.exportScript({ scope: 'task', targetId: 'BodyCond' });
        const defCount = script.operations.filter(o => o.method === 'ensureActionDefined').length;

        // In frisches Projekt importieren
        agent.setProject(createTestProject());
        const result = agent.importScript(script, { targetStageId: 'stage_main', conflictStrategy: 'error' });
        const task = (agent as any).project.stages.flatMap((s: any) => s.tasks || []).find((t: any) => t.name === 'BodyCond');
        const cond = task?.actionSequence?.find((i: any) => i.type === 'condition');
        // Prüfen: Body-Action-Definition inkl. Formel wurde importiert
        const decDef = (agent as any).project.stages
            .flatMap((s: any) => s.actions || [])
            .concat((agent as any).project.actions || [])
            .find((a: any) => a.name === 'DecCannons');
        const ok = defCount === 2 && result.success
            && cond?.body?.[0]?.name === 'DecCannons'
            && cond?.elseBody?.[0]?.name === 'LoseGame'
            && decDef?.formula === '${CurrCannonCount}-1';
        addResult('Condition Roundtrip (body/elseBody-Form)', ok, ok ? undefined : JSON.stringify({ defCount, result: result.errors, cond, decDef }));
    } catch (e: any) {
        addResult('Condition Roundtrip (body/elseBody-Form)', false, e.message);
    }

    // --- Variablen-Scope bleibt beim Export/Import erhalten (global bleibt global) ---
    try {
        const proj = createTestProject();
        // Globale Variable, die in einer Stage abgelegt ist (wie 'score' in Blueprint)
        (proj.stages![0] as any).variables.push({
            name: 'score', type: 'number', className: 'TIntegerVariable',
            scope: 'global', defaultValue: 0, value: 0
        });
        agent.setProject(proj);

        const script = agent.exportScript({ scope: 'stage', targetId: 'stage_main' });
        const addVarOp = script.operations.find(o => o.method === 'addVariable' && o.params[0] === 'score');
        // 4. Param = scope; muss 'global' sein, NICHT die Stage-ID
        const scopeExported = addVarOp?.params[3];

        agent.setProject(createTestProject());
        const result = agent.importScript(script, { targetStageId: 'stage_main', conflictStrategy: 'error' });
        const scoreVar = (agent as any).project.variables.find((v: any) => v.name === 'score');
        const ok = scopeExported === 'global' && result.success && scoreVar?.scope === 'global';
        addResult('Variablen-Scope Roundtrip (global bleibt global)', ok, ok ? undefined : JSON.stringify({ scopeExported, scoreVar, errors: result.errors }));
    } catch (e: any) {
        addResult('Variablen-Scope Roundtrip (global bleibt global)', false, e.message);
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
