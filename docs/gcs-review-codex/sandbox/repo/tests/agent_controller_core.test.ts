import { coreStore, AgentController, TestResult, createTestProject } from './agent_controller_helper';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export async function runTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({ name, type: 'AgentController', expectedSuccess: true, actualSuccess: passed, passed, details });
    };

    // Record-API muss die Parameter der bestehenden TObjectList-Runtime akzeptieren.
    {
        const previous = coreStore.project;
        const project = createTestProject();
        const agent = AgentController.getInstance();
        try {
            coreStore.setProject(project); agent.setProject(project);
            agent.createTask('stage_main', 'RecordPruefung');
            agent.addAction('RecordPruefung', 'record_get', 'LeseRecord', {list:'Steine',target:'self',field:'zerstoert',resultVariable:'SchonZerstoert'});
            agent.addAction('RecordPruefung', 'record_set', 'SchreibeRecord', {list:'Steine',target:'self',field:'zerstoert',value:false});
            addResult('Record-API: list/field ohne erfundenes key', true);
            let rejected = false;
            try { agent.addAction('RecordPruefung', 'record_get', 'Ungueltig', {key:'zerstoert'}); } catch { rejected = true; }
            addResult('Record-API: fehlende Listenparameter ablehnen', rejected);
        } catch (error: any) { addResult('Record-API: list/field ohne erfundenes key', false, error.message); }
        finally { if (previous) coreStore.setProject(previous); else coreStore.project = null; }
    }

    // ══════════════════════════════════════════════
    // Gutfall-Tests: Neue Methoden
    // ══════════════════════════════════════════════

    // Fehlende IDs dürfen verschiedene KI-generierte Objekte nicht zusammenführen.
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        agent.addObject('stage_main', { name: 'First', className: 'TLabel', text: 'A' });
        agent.addObject('stage_main', { name: 'Second', className: 'TLabel', text: 'B' });
        const objects = project.stages![1].objects;
        addResult('addObject — verschiedene Namen ohne IDs', objects.length === 2 &&
            objects[0].name === 'First' && objects[1].name === 'Second');
        agent.addObject('stage_main', { name: 'First', className: 'TLabel', text: 'Updated' });
        addResult('addObject — Upsert über vorhandenen Namen', objects.length === 2 &&
            (objects[0] as any).text === 'Updated');
        agent.addObject('stage_main', { id: 'stable', name: 'Third', className: 'TLabel' });
        agent.addObject('stage_main', { id: 'stable', name: 'Renamed', className: 'TLabel' });
        addResult('addObject — Upsert über vorhandene ID', objects.length === 3 &&
            objects[2].id === 'stable' && objects[2].name === 'Renamed');
    } catch (e: any) {
        addResult('addObject — Identitätsregression', false, e.message);
    }

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

    // --- addVariable — Threshold-Variable mit Tasks ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'OnThreshold');
        agent.addVariable('scoreThreshold', 'threshold', 0, 'global', {
            threshold: 100,
            comparison: '>=',
            onThresholdReached: 'OnThreshold'
        });

        const variable = project.variables!.find(v => v.name === 'scoreThreshold');
        const ok = variable
            && variable.type === 'threshold'
            && variable.className === 'TThresholdVariable'
            && variable.threshold === 100
            && variable.comparison === '>='
            && variable.Tasks?.onThresholdReached === 'OnThreshold';
        addResult('addVariable — Threshold mit Tasks', !!ok, ok ? 'Threshold-Variable korrekt mit Tasks erstellt.' : `Variable: ${JSON.stringify(variable)}`);
    } catch (e: any) {
        addResult('addVariable — Threshold mit Tasks', false, `Fehler: ${e.message}`);
    }

    // --- connectVariableEvent — Gutfall ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.addVariable('myVar', 'integer', 0);
        agent.createTask('stage_main', 'OnValueChanged');
        agent.connectVariableEvent('myVar', 'onValueChanged', 'OnValueChanged');

        const variable = project.variables!.find(v => v.name === 'myVar');
        const ok = variable?.Tasks?.onValueChanged === 'OnValueChanged';
        addResult('connectVariableEvent — Gutfall', !!ok, ok ? 'Variable-Event korrekt verbunden.' : `Tasks: ${JSON.stringify(variable?.Tasks)}`);
    } catch (e: any) {
        addResult('connectVariableEvent — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- connectVariableEvent — Schlechtfall (Task nicht gefunden) ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.addVariable('myVar2', 'integer', 0);
        agent.connectVariableEvent('myVar2', 'onValueChanged', 'MissingTask');
        addResult('connectVariableEvent — Schlechtfall', false, 'Hätte Fehler werfen müssen.');
    } catch (e: any) {
        const ok = e.message.includes('not found');
        addResult('connectVariableEvent — Schlechtfall', ok, ok ? 'Fehler korrekt geworfen.' : `Falscher Fehler: ${e.message}`);
    }

    // --- createTimer / createIntervalTimer ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTimer('stage_main', 'MyTimer', 10, 10, { interval: 500, enabled: true });
        agent.createIntervalTimer('stage_main', 'MyIntervalTimer', 20, 20, { duration: 1000, count: 5 });

        const stage = project.stages![1];
        const timer = stage.objects!.find((o: any) => o.name === 'MyTimer');
        const intervalTimer = stage.objects!.find((o: any) => o.name === 'MyIntervalTimer');
        const ok = timer?.className === 'TTimer' && timer.interval === 500 && timer.enabled === true
            && intervalTimer?.className === 'TIntervalTimer' && intervalTimer.duration === 1000 && intervalTimer.count === 5;
        addResult('createTimer / createIntervalTimer', !!ok, ok ? 'Timer korrekt erstellt.' : `timer=${JSON.stringify(timer)}, intervalTimer=${JSON.stringify(intervalTimer)}`);
    } catch (e: any) {
        addResult('createTimer / createIntervalTimer', false, `Fehler: ${e.message}`);
    }

    // --- createThresholdVariable ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'OnThresholdStage');
        agent.createThresholdVariable('stage_main', 'StageThreshold', 5, 5, {
            value: 0,
            threshold: 50,
            comparison: '>=',
            onThresholdReached: 'OnThresholdStage'
        });

        const stage = project.stages![1];
        const threshold = stage.objects!.find((o: any) => o.name === 'StageThreshold');
        const ok = threshold?.className === 'TThresholdVariable'
            && threshold.threshold === 50
            && threshold.events?.onThresholdReached === 'OnThresholdStage';
        addResult('createThresholdVariable', !!ok, ok ? 'Stage-Threshold-Variable korrekt erstellt.' : `threshold: ${JSON.stringify(threshold)}`);
    } catch (e: any) {
        addResult('createThresholdVariable', false, `Fehler: ${e.message}`);
    }

    // --- addAction — Neue Action-Typen ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'ToastTask');
        agent.addAction('ToastTask', 'show_toast', 'ShowToast', { message: 'Hello!', toastType: 'info' });

        agent.createTask('stage_main', 'BindEventTask');
        agent.addAction('BindEventTask', 'bind_event', 'BindEvent', { target: 'SomeObj', event: 'onClick', task: 'ToastTask' });

        agent.createTask('stage_main', 'NavigateTask');
        agent.addAction('NavigateTask', 'navigate_stage', 'NavigateStage', { stageId: 'stage_main', reset: false });

        const allActions = project.stages?.flatMap(s => s.actions || []) || [];
        const toastAction = allActions.find((a: any) => a.name === 'ShowToast');
        const bindAction = allActions.find((a: any) => a.name === 'BindEvent');
        const navAction = allActions.find((a: any) => a.name === 'NavigateStage');

        const ok = toastAction?.type === 'show_toast'
            && bindAction?.type === 'bind_event'
            && navAction?.type === 'navigate_stage';
        addResult('addAction — Neue Action-Typen', !!ok, ok ? 'Neue Action-Typen korrekt erstellt.' : `Actions: ${JSON.stringify({toastAction, bindAction, navAction})}`);
    } catch (e: any) {
        addResult('addAction — Neue Action-Typen', false, `Fehler: ${e.message}`);
    }

    // --- validate — keine fehlenden Referenzen ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.addObject('stage_main', { name: 'Obj1', className: 'TSprite', x: 10, y: 10, width: 2, height: 2 });
        agent.createTask('stage_main', 'MainTask');
        agent.addAction('MainTask', 'property', 'Action1', { target: 'Obj1', changes: { x: 1 } });
        agent.connectEvent('stage_main', 'Obj1', 'onClick', 'MainTask');

        const issues = agent.validate();
        const noErrors = issues.filter(i => i.level === 'error').length === 0;
        addResult('validate — keine fehlenden Referenzen', noErrors, noErrors ? 'Validierung ohne Fehler.' : `Fehler: ${issues.map(i => i.message).join(', ')}`);
    } catch (e: any) {
        addResult('validate — keine fehlenden Referenzen', false, `Fehler: ${e.message}`);
    }

    return results;
}
