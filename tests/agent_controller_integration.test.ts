import { coreStore, AgentController, TestResult, createTestProject } from './agent_controller_helper';

export async function runTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({ name, type: 'AgentController', expectedSuccess: true, actualSuccess: passed, passed, details });
    };

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
