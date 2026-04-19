import { coreStore } from '../src/services/registry/CoreStore';
import { AgentController } from '../src/services/AgentController';
import { loadComponentSchemasSync } from '../src/services/SchemaLoader';
import { GameProject } from '../src/model/types';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        coreStore.setProject(project);

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
        coreStore.setProject(project);

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
        coreStore.setProject(project);

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
        coreStore.setProject(project);

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
        coreStore.setProject(project);

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
        coreStore.setProject(project);

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
        coreStore.setProject(project);

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
        coreStore.setProject(project);

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
        coreStore.setProject(project);

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
        coreStore.setProject(project);

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
        coreStore.setProject(project);

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
        coreStore.setProject(project);

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

    // ══════════════════════════════════════════════
    // Phase 2: Sprite-Shortcuts & Schema-Tests
    // ══════════════════════════════════════════════

    // --- createSprite: Gutfall ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createSprite('stage_main', 'Ball', 30, 20, 2, 2, {
            velocityX: 3, velocityY: 3,
            collisionGroup: 'ball',
            shape: 'circle',
            spriteColor: '#ffeb3b'
        });

        const stage = project.stages![1];
        const ball = stage.objects!.find((o: any) => o.name === 'Ball');
        const ok = ball
            && ball.className === 'TSprite'
            && ball.x === 30 && ball.y === 20
            && ball.velocityX === 3 && ball.velocityY === 3
            && ball.collisionGroup === 'ball'
            && ball.shape === 'circle'
            && ball.style?.borderRadius === 999;
        addResult('createSprite — Gutfall', !!ok, ok ? 'Sprite mit Physik-Defaults korrekt erstellt.' : `Ball: ${JSON.stringify(ball)}`);
    } catch (e: any) {
        addResult('createSprite — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- createLabel: Gutfall mit Binding ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createLabel('stage_main', 'ScoreLabel', 20, 2, '${Score}', {
            fontSize: 48, fontWeight: 'bold', color: '#f7c948', width: 10, height: 3
        });

        const stage = project.stages![1];
        const label = stage.objects!.find((o: any) => o.name === 'ScoreLabel');
        const ok = label
            && label.className === 'TLabel'
            && label.text === '${Score}'
            && label.width === 10 && label.height === 3
            && label.style?.fontSize === 48
            && label.style?.fontWeight === 'bold';
        addResult('createLabel — Gutfall', !!ok, ok ? 'Label mit Binding + Style korrekt erstellt.' : `Label: ${JSON.stringify(label)}`);
    } catch (e: any) {
        addResult('createLabel — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- setSpriteCollision ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createSprite('stage_main', 'Paddle', 5, 15, 2, 8);
        agent.setSpriteCollision('stage_main', 'Paddle', true, 'paddle');

        const paddle = project.stages![1].objects!.find((o: any) => o.name === 'Paddle');
        const ok = paddle?.collisionEnabled === true && paddle?.collisionGroup === 'paddle';
        addResult('setSpriteCollision — Gutfall', !!ok, ok ? 'Collision korrekt gesetzt.' : `enabled=${paddle?.collisionEnabled}, group=${paddle?.collisionGroup}`);
    } catch (e: any) {
        addResult('setSpriteCollision — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- setSpriteVelocity ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createSprite('stage_main', 'VelocityBall', 30, 20, 1, 1);
        agent.setSpriteVelocity('stage_main', 'VelocityBall', 5, -3);

        const ball = project.stages![1].objects!.find((o: any) => o.name === 'VelocityBall');
        const ok = ball?.velocityX === 5 && ball?.velocityY === -3;
        addResult('setSpriteVelocity — Gutfall', !!ok, ok ? 'Velocity korrekt gesetzt.' : `vx=${ball?.velocityX}, vy=${ball?.velocityY}`);
    } catch (e: any) {
        addResult('setSpriteVelocity — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- getComponentSchema ---
    try {
        const agent = AgentController.getInstance();
        // Schema manuell laden, da loadComponentSchemasSync (Node.js/require hack) in nativem ESM crasht
        const basePath = path.resolve(__dirname, '../docs');
        const baseSchema = JSON.parse(fs.readFileSync(path.join(basePath, 'schemas/schema_base.json'), 'utf-8'));
        const SCHEMA_MODULES = [
            'schema_containers.json', 'schema_dialogs.json', 'schema_inputs.json',
            'schema_display.json', 'schema_timers.json', 'schema_media.json',
            'schema_variables.json', 'schema_game.json', 'schema_services.json'
        ];
        for (const m of SCHEMA_MODULES) {
            const data = JSON.parse(fs.readFileSync(path.join(basePath, 'schemas', m), 'utf-8'));
            if (data.components) Object.assign(baseSchema.components, data.components);
        }
        AgentController.setComponentSchema(baseSchema);

        const spriteSchema = agent.getComponentSchema('TSprite');
        const timerSchema = agent.getComponentSchema('TTimer');
        const unknownSchema = agent.getComponentSchema('TUnknown');

        const ok = spriteSchema
            && spriteSchema.className === 'TSprite'
            && spriteSchema.properties?.velocityX
            && spriteSchema.events?.includes('onCollision')
            && timerSchema?.methods?.some((m: any) => m.name === 'timerStart')
            && unknownSchema === null;
        addResult('getComponentSchema — Gutfall', !!ok,
            ok ? `TSprite: ${Object.keys(spriteSchema.properties).length} Props, ${spriteSchema.events.length} Events. TTimer: ${timerSchema.methods.length} Methods. Unknown: null.`
            : `spriteSchema=${!!spriteSchema}, timerSchema=${!!timerSchema}, unknown=${unknownSchema}`);
    } catch (e: any) {
        addResult('getComponentSchema — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- Integration: Spiel mit Shortcuts erstellen ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        // Infrastruktur
        agent.addObject('stage_blueprint', { className: 'TGameLoop', name: 'GameLoop', x: 2, y: 2, width: 3, height: 1, isService: true, isHiddenInRun: true, targetFPS: 60 });
        agent.addObject('stage_blueprint', { className: 'TGameState', name: 'GameState', x: 6, y: 2, width: 4, height: 1, isService: true, isHiddenInRun: true, state: 'idle', spritesMoving: false });

        // Spielobjekte via Shortcuts
        agent.createSprite('stage_main', 'Ball', 32, 20, 2, 2, { velocityX: 4, velocityY: 3, shape: 'circle', spriteColor: '#ffeb3b', collisionGroup: 'ball' });
        agent.createSprite('stage_main', 'LeftPaddle', 2, 15, 2, 10, { collisionGroup: 'paddle', spriteColor: '#4ecdc4' });
        agent.createSprite('stage_main', 'RightPaddle', 60, 15, 2, 10, { collisionGroup: 'paddle', spriteColor: '#45b7d1' });
        agent.createLabel('stage_main', 'ScoreLeft', 20, 1, '${scoreLeft}', { fontSize: 32, fontWeight: 'bold' });
        agent.createLabel('stage_main', 'ScoreRight', 40, 1, '${scoreRight}', { fontSize: 32, fontWeight: 'bold' });

        // Variablen & Tasks
        agent.addVariable('scoreLeft', 'number', 0);
        agent.addVariable('scoreRight', 'number', 0);
        agent.createTask('stage_main', 'OnBallCollision', 'Ball-Abpraller');
        agent.addAction('OnBallCollision', 'negate', 'BounceX', { target: 'Ball', changes: { velocityX: 1 } });
        agent.connectEvent('stage_main', 'Ball', 'onCollision', 'OnBallCollision');

        const mainStage = project.stages![1];
        const bp = project.stages![0];
        const ok = mainStage.objects!.length === 5
            && bp.objects!.length === 2
            && mainStage.tasks!.length === 1
            && project.variables!.length === 2
            && mainStage.objects![0].className === 'TSprite'
            && mainStage.objects![3].className === 'TLabel'
            && mainStage.objects![0].events?.onCollision === 'OnBallCollision';
        addResult('Integration: Spiel mit Shortcuts', ok,
            ok ? `5 Objekte (3 Sprites + 2 Labels), 2 Variablen, 1 Task, Event gebunden.`
            : `objs=${mainStage.objects!.length}/5, bp=${bp.objects!.length}/2, tasks=${mainStage.tasks!.length}/1`);
    } catch (e: any) {
        addResult('Integration: Spiel mit Shortcuts', false, `Fehler: ${e.message}`);
    }

    return results;
}
