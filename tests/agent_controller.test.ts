import { AgentController } from '../src/services/AgentController';
import { GameProject } from '../src/model/types';
import { projectRegistry } from '../src/services/ProjectRegistry';

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
function createTestProject(): GameProject {
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

export async function runTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({ name, type: 'AgentController', expectedSuccess: true, actualSuccess: passed, passed, details });
    };

    // ══════════════════════════════════════════════
    // Gutfall-Tests: Neue Methoden
    // ══════════════════════════════════════════════

    // --- addTaskCall: Gutfall ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        agent.createTask('stage_main', 'MainTask');
        agent.createTask('stage_main', 'SubTask');
        agent.addTaskCall('MainTask', 'SubTask');

        const task = project.stages![1].tasks!.find(t => t.name === 'MainTask');
        const hasCall = task?.actionSequence.some((s: any) => s.type === 'task' && s.name === 'SubTask');
        addResult('addTaskCall — Gutfall', !!hasCall, hasCall ? 'Task-Referenz korrekt eingefügt.' : 'Task-Referenz fehlt in Sequenz.');
    } catch (e: any) {
        addResult('addTaskCall — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- addTaskCall: Schlechtfall (Task existiert nicht) ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        agent.createTask('stage_main', 'MainTask2');
        agent.addTaskCall('MainTask2', 'NonExistentTask');
        addResult('addTaskCall — Schlechtfall', false, 'Hätte Fehler werfen müssen.');
    } catch (e: any) {
        const ok = e.message.includes('not found');
        addResult('addTaskCall — Schlechtfall', ok, ok ? 'Fehler korrekt geworfen.' : `Falscher Fehler: ${e.message}`);
    }

    // --- setTaskTriggerMode: Gutfall ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        agent.createTask('stage_main', 'BroadcastTask');
        agent.setTaskTriggerMode('BroadcastTask', 'broadcast');

        const task = project.stages![1].tasks!.find(t => t.name === 'BroadcastTask');
        const ok = task?.triggerMode === 'broadcast';
        addResult('setTaskTriggerMode — Gutfall', !!ok, ok ? 'TriggerMode korrekt gesetzt.' : `TriggerMode ist: ${task?.triggerMode}`);
    } catch (e: any) {
        addResult('setTaskTriggerMode — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- setTaskTriggerMode: Schlechtfall (ungültiger Modus) ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        agent.createTask('stage_main', 'BadModeTask');
        agent.setTaskTriggerMode('BadModeTask', 'invalid-mode' as any);
        addResult('setTaskTriggerMode — Schlechtfall', false, 'Hätte Fehler werfen müssen.');
    } catch (e: any) {
        const ok = e.message.includes('Invalid trigger mode');
        addResult('setTaskTriggerMode — Schlechtfall', ok, ok ? 'Fehler korrekt geworfen.' : `Falscher Fehler: ${e.message}`);
    }

    // --- addTaskParam: Gutfall ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        agent.createTask('stage_main', 'ParamTask');
        agent.addTaskParam('ParamTask', 'hitSide', 'string', '');
        agent.addTaskParam('ParamTask', 'speed', 'number', 5);

        const task = project.stages![1].tasks!.find(t => t.name === 'ParamTask');
        const hasHitSide = task?.params?.some((p: any) => p.name === 'hitSide' && p.type === 'string');
        const hasSpeed = task?.params?.some((p: any) => p.name === 'speed' && p.defaultValue === 5);
        const ok = !!hasHitSide && !!hasSpeed;
        addResult('addTaskParam — Gutfall', ok, ok ? '2 Parameter korrekt hinzugefügt.' : `hitSide=${hasHitSide}, speed=${hasSpeed}`);
    } catch (e: any) {
        addResult('addTaskParam — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- addTaskParam: Update existierender Parameter ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        agent.createTask('stage_main', 'UpdateParamTask');
        agent.addTaskParam('UpdateParamTask', 'hitSide', 'string', '');
        agent.addTaskParam('UpdateParamTask', 'hitSide', 'number', 42);

        const task = project.stages![1].tasks!.find(t => t.name === 'UpdateParamTask');
        const param = task?.params?.find((p: any) => p.name === 'hitSide');
        const ok = param?.type === 'number' && param?.defaultValue === 42;
        const count = task?.params?.length === 1;
        addResult('addTaskParam — Update', ok && count, ok && count ? 'Param aktualisiert, kein Duplikat.' : `type=${param?.type}, value=${param?.defaultValue}, count=${task?.params?.length}`);
    } catch (e: any) {
        addResult('addTaskParam — Update', false, `Fehler: ${e.message}`);
    }

    // --- moveActionInSequence: Gutfall ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        agent.createTask('stage_main', 'MoveTask');
        agent.addAction('MoveTask', 'property', 'ActionA', { target: 'Obj1', properties: { x: 1 } });
        agent.addAction('MoveTask', 'negate', 'ActionB', { target: 'Obj1', velocityX: true });
        agent.addAction('MoveTask', 'property', 'ActionC', { target: 'Obj1', properties: { y: 2 } });

        agent.moveActionInSequence('MoveTask', 0, 2);

        const task = project.stages![1].tasks!.find(t => t.name === 'MoveTask');
        const seq = task?.actionSequence || [];
        const ok = seq[0]?.name === 'ActionB' && seq[1]?.name === 'ActionC' && seq[2]?.name === 'ActionA';
        addResult('moveActionInSequence — Gutfall', !!ok, ok ? 'Reihenfolge korrekt: B, C, A.' : `Sequenz: ${seq.map((s: any) => s.name).join(', ')}`);
    } catch (e: any) {
        addResult('moveActionInSequence — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- moveActionInSequence: Schlechtfall (Index out of bounds) ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        agent.createTask('stage_main', 'MoveFailTask');
        agent.addAction('MoveFailTask', 'property', 'OnlyAction', { target: 'Obj1', properties: { x: 1 } });
        agent.moveActionInSequence('MoveFailTask', 0, 5);
        addResult('moveActionInSequence — Schlechtfall', false, 'Hätte Fehler werfen müssen.');
    } catch (e: any) {
        const ok = e.message.includes('out of bounds');
        addResult('moveActionInSequence — Schlechtfall', ok, ok ? 'Fehler korrekt geworfen.' : `Falscher Fehler: ${e.message}`);
    }

    // ══════════════════════════════════════════════
    // Integrationstest: PingPong via API erstellen
    // ══════════════════════════════════════════════

    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        // 1. Variablen
        agent.addVariable('scoreLeft', 'number', 0);
        agent.addVariable('scoreRight', 'number', 0);

        // 2. Objekte
        agent.addObject('stage_main', { name: 'BallSprite', className: 'TSprite', x: 32, y: 19, width: 2, height: 2, velocityX: 3, velocityY: 3, collisionEnabled: true });
        agent.addObject('stage_main', { name: 'LeftPaddle', className: 'TSprite', x: 2, y: 15, width: 2, height: 10, collisionEnabled: true });
        agent.addObject('stage_main', { name: 'RightPaddle', className: 'TSprite', x: 60, y: 15, width: 2, height: 10, collisionEnabled: true });
        agent.addObject('stage_main', { name: 'ScoreLeft', className: 'TLabel', x: 20, y: 1, caption: '0' });
        agent.addObject('stage_main', { name: 'ScoreRight', className: 'TLabel', x: 39, y: 1, caption: '0' });

        // 3. Daten-Bindings
        agent.bindVariable('stage_main', 'ScoreLeft', 'caption', 'scoreLeft');
        agent.bindVariable('stage_main', 'ScoreRight', 'caption', 'scoreRight');

        // 4. Actions
        agent.createTask('stage_main', 'HandlePaddleCollision');
        agent.addAction('HandlePaddleCollision', 'negate', 'NegateBallX', { target: 'BallSprite', velocityX: true });

        agent.createTask('stage_main', 'HandleBoundary');
        agent.addTaskParam('HandleBoundary', 'hitSide', 'string', '');
        agent.addAction('HandleBoundary', 'negate', 'NegateBallY', { target: 'BallSprite', velocityY: true });

        agent.createTask('stage_main', 'ResetBallTask');
        agent.addAction('ResetBallTask', 'property', 'ResetBall', { target: 'BallSprite', properties: { x: 32, y: 19 } });

        // 5. Events
        agent.connectEvent('stage_main', 'BallSprite', 'onCollision', 'HandlePaddleCollision');
        agent.connectEvent('stage_main', 'BallSprite', 'onBoundaryHit', 'HandleBoundary');

        // 6. Validierung
        const issues = agent.validate();

        // Asserts
        const mainStage = project.stages![1];
        const hasObjects = mainStage.objects!.length === 5;
        const hasTasks = mainStage.tasks!.length === 3;
        const hasVars = project.variables!.length === 2;
        const hasBindingLeft = mainStage.objects![3].caption === '${scoreLeft}';
        const hasBindingRight = mainStage.objects![4].caption === '${scoreRight}';
        const hasCollisionEvent = mainStage.objects![0].events?.onCollision === 'HandlePaddleCollision';
        const hasBoundaryEvent = mainStage.objects![0].events?.onBoundaryHit === 'HandleBoundary';
        const noErrors = issues.filter(i => i.level === 'error').length === 0;

        const allOk = hasObjects && hasTasks && hasVars && hasBindingLeft && hasBindingRight && hasCollisionEvent && hasBoundaryEvent && noErrors;
        addResult('Integration: PingPong via API', allOk,
            allOk ? `Vollständiges PingPong erstellt: 5 Objekte, 3 Tasks, 2 Variablen, Events gebunden. Validierung: ${issues.length} Warnungen, 0 Fehler.`
            : `Fehler: objects=${mainStage.objects!.length}/5, tasks=${mainStage.tasks!.length}/3, vars=${project.variables!.length}/2, ` +
              `bindLeft=${hasBindingLeft}, bindRight=${hasBindingRight}, collEvt=${hasCollisionEvent}, boundEvt=${hasBoundaryEvent}, noErrors=${noErrors}`
        );
    } catch (e: any) {
        addResult('Integration: PingPong via API', false, `Fehler: ${e.message}\n${e.stack}`);
    }
    // ══════════════════════════════════════════════
    // Batch-API Tests
    // ══════════════════════════════════════════════

    // --- executeBatch: Gutfall ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        const batchResults = agent.executeBatch([
            { method: 'addVariable', params: ['batchScore', 'number', 0] },
            { method: 'createTask', params: ['stage_main', 'BatchTask', 'Batch-Test-Task'] },
            { method: 'addAction', params: ['BatchTask', 'property', 'BatchAction', { target: 'Obj1', properties: { x: 1 } }] },
            { method: 'setTaskTriggerMode', params: ['BatchTask', 'broadcast'] }
        ]);

        const allSuccess = batchResults.every(r => r.success);
        const hasVar = project.variables!.some(v => v.name === 'batchScore');
        const hasTask = project.stages![1].tasks!.some(t => t.name === 'BatchTask');
        const ok = allSuccess && hasVar && hasTask;
        addResult('executeBatch — Gutfall', ok, ok ? `4 Ops erfolgreich: Variable + Task + Action + TriggerMode.` : `allSuccess=${allSuccess}, var=${hasVar}, task=${hasTask}`);
    } catch (e: any) {
        addResult('executeBatch — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- executeBatch: Schlechtfall (Rollback) ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        // Erste Op ist gültig, zweite soll fehlschlagen
        const batchResults = agent.executeBatch([
            { method: 'addVariable', params: ['rollbackVar', 'number', 99] },
            { method: 'setTaskTriggerMode', params: ['NonExistentTask', 'broadcast'] }
        ]);

        const hasError = batchResults.some(r => !r.success);
        const varRolledBack = !project.variables!.some(v => v.name === 'rollbackVar');
        const ok = hasError && varRolledBack;
        addResult('executeBatch — Rollback', ok, ok ? 'Fehler erkannt + Variable rollbacked.' : `hasError=${hasError}, varRolledBack=${varRolledBack}`);
    } catch (e: any) {
        addResult('executeBatch — Rollback', false, `Fehler: ${e.message}`);
    }

    // ══════════════════════════════════════════════
    // Integrationstest: Tennis via executeBatch
    // ══════════════════════════════════════════════

    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        // Komplettes Tennis-Spiel als Batch
        const batchOps = [
            // Stages
            { method: 'createStage', params: ['stage_splash', 'Splash', 'standard'] },
            // Variablen
            { method: 'addVariable', params: ['scorePlayer1', 'number', 0] },
            { method: 'addVariable', params: ['scorePlayer2', 'number', 0] },
            { method: 'addVariable', params: ['isGameRunning', 'boolean', false] },
            // Objekte: Ball
            { method: 'addObject', params: ['stage_main', { name: 'TennisBall', className: 'TSprite', x: 32, y: 20, width: 1, height: 1, velocityX: 4, velocityY: 2, collisionEnabled: true, color: '#ffeb3b', borderRadius: '50%' }] },
            // Paddle links
            { method: 'addObject', params: ['stage_main', { name: 'PaddleLeft', className: 'TSprite', x: 2, y: 16, width: 1, height: 8, collisionEnabled: true, color: '#4ecdc4' }] },
            // Paddle rechts
            { method: 'addObject', params: ['stage_main', { name: 'PaddleRight', className: 'TSprite', x: 61, y: 16, width: 1, height: 8, collisionEnabled: true, color: '#45b7d1' }] },
            // Score Labels
            { method: 'addObject', params: ['stage_main', { name: 'ScoreP1', className: 'TLabel', x: 22, y: 1, caption: '0', fontSize: 24 }] },
            { method: 'addObject', params: ['stage_main', { name: 'ScoreP2', className: 'TLabel', x: 38, y: 1, caption: '0', fontSize: 24 }] },
            // Netz
            { method: 'addObject', params: ['stage_main', { name: 'Net', className: 'TPanel', x: 31, y: 0, width: 1, height: 40, color: 'rgba(255,255,255,0.3)' }] },
            // Bindings
            { method: 'bindVariable', params: ['stage_main', 'ScoreP1', 'caption', 'scorePlayer1'] },
            { method: 'bindVariable', params: ['stage_main', 'ScoreP2', 'caption', 'scorePlayer2'] },
            // Tasks
            { method: 'createTask', params: ['stage_main', 'HandleBallCollision', 'Ball Paddle Abprall'] },
            { method: 'addAction', params: ['HandleBallCollision', 'negate', 'NegateBallX', { target: 'TennisBall', velocityX: true }] },
            { method: 'createTask', params: ['stage_main', 'HandleWallBounce', 'Ball Wand Abprall'] },
            { method: 'addAction', params: ['HandleWallBounce', 'negate', 'NegateBallY', { target: 'TennisBall', velocityY: true }] },
            { method: 'createTask', params: ['stage_main', 'ResetBall', 'Ball zurücksetzen'] },
            { method: 'addAction', params: ['ResetBall', 'property', 'ResetBallPos', { target: 'TennisBall', properties: { x: 32, y: 20, velocityX: 4, velocityY: 2 } }] },
            // Events
            { method: 'connectEvent', params: ['stage_main', 'TennisBall', 'onCollision', 'HandleBallCollision'] },
            { method: 'connectEvent', params: ['stage_main', 'TennisBall', 'onBoundaryHit', 'HandleWallBounce'] },
        ];

        const results = agent.executeBatch(batchOps);
        const allOk = results.every(r => r.success);
        const mainStage = project.stages![1];
        const stageCount = project.stages!.length; // 3: blueprint + main + splash

        const objCount = mainStage.objects!.length; // 6: Ball + 2 Paddles + 2 Scores + Net
        const taskCount = mainStage.tasks!.length; // 3: HandleBallCollision + HandleWallBounce + ResetBall
        const varCount = project.variables!.length; // 3: scorePlayer1, scorePlayer2, isGameRunning
        const hasEvents = mainStage.objects![0].events?.onCollision === 'HandleBallCollision';
        const hasBindings = mainStage.objects![3].caption === '${scorePlayer1}';
        const issues = agent.validate();
        const noErrors = issues.filter(i => i.level === 'error').length === 0;

        const pass = allOk && stageCount === 3 && objCount === 6 && taskCount === 3 && varCount === 3 && hasEvents && hasBindings && noErrors;
        addResult('Integration: Tennis via Batch', pass,
            pass ? `Tennis-Spiel komplett: ${batchOps.length} Batch-Ops, ${stageCount} Stages, ${objCount} Objekte, ${taskCount} Tasks, ${varCount} Variablen, Events gebunden, Validierung OK.`
            : `allOk=${allOk}, stages=${stageCount}/3, objs=${objCount}/6, tasks=${taskCount}/3, vars=${varCount}/3, events=${hasEvents}, bindings=${hasBindings}, noErrors=${noErrors}`
        );
    } catch (e: any) {
        addResult('Integration: Tennis via Batch', false, `Fehler: ${e.message}\n${e.stack}`);
    }

    return results;
}
