import { coreStore, AgentController, TestResult, createTestProject } from './agent_controller_helper';

export async function runTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({ name, type: 'AgentController', expectedSuccess: true, actualSuccess: passed, passed, details });
    };

    // ══════════════════════════════════════════════
    // Loop-API Tests (ForEach / While / For)
    // ══════════════════════════════════════════════

    // --- addForeach: Gutfall ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'LoopTask');
        agent.addAction('LoopTask', 'show_toast', 'ShowItemToast', { message: '${item}', toastType: 'info' });

        agent.createTask('stage_main', 'ForeachTask');
        agent.addForeach(
            'ForeachTask',
            'players',
            'item',
            (b) => b.addAction('ShowItemToast'),
            'idx'
        );

        const task = project.stages![1].tasks!.find(t => t.name === 'ForeachTask');
        const loopItem = task?.actionSequence[0] as any;
        const ok = loopItem?.type === 'foreach'
            && loopItem?.sourceArray === 'players'
            && loopItem?.itemVar === 'item'
            && loopItem?.indexVar === 'idx'
            && Array.isArray(loopItem?.body)
            && loopItem.body[0]?.name === 'ShowItemToast';
        addResult('addForeach — Gutfall', !!ok, ok ? 'ForEach-Sequenzitem korrekt erstellt.' : `Item: ${JSON.stringify(loopItem)}`);
    } catch (e: any) {
        addResult('addForeach — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- addForeach: Schlechtfall (sourceArray leer) ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'BadForeachTask');
        agent.addForeach('BadForeachTask', '', 'item', (b) => b);
        addResult('addForeach — Schlechtfall (leere sourceArray)', false, 'Hätte Fehler werfen müssen.');
    } catch (e: any) {
        const ok = e.message.includes('sourceArray');
        addResult('addForeach — Schlechtfall (leere sourceArray)', ok, ok ? 'Fehler korrekt geworfen.' : `Falscher Fehler: ${e.message}`);
    }

    // --- addWhile: Gutfall ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'WhileBodyAction_Task');
        agent.addAction('WhileBodyAction_Task', 'property', 'IncrScore', { target: 'score', changes: { value: 1 } });

        agent.createTask('stage_main', 'WhileTask');
        agent.addWhile(
            'WhileTask',
            'lives',
            '>',
            0,
            (b) => b.addAction('IncrScore')
        );

        const task = project.stages![1].tasks!.find(t => t.name === 'WhileTask');
        const loopItem = task?.actionSequence[0] as any;
        const ok = loopItem?.type === 'while'
            && loopItem?.condition?.variable === 'lives'
            && loopItem?.condition?.operator === '>'
            && loopItem?.condition?.value === 0
            && Array.isArray(loopItem?.body)
            && loopItem.body[0]?.name === 'IncrScore';
        addResult('addWhile — Gutfall', !!ok, ok ? 'While-Sequenzitem korrekt erstellt.' : `Item: ${JSON.stringify(loopItem)}`);
    } catch (e: any) {
        addResult('addWhile — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- addWhile: Schlechtfall (conditionVariable leer) ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'BadWhileTask');
        agent.addWhile('BadWhileTask', '', '==', 0, (b) => b);
        addResult('addWhile — Schlechtfall (leere conditionVariable)', false, 'Hätte Fehler werfen müssen.');
    } catch (e: any) {
        const ok = e.message.includes('conditionVariable');
        addResult('addWhile — Schlechtfall (leere conditionVariable)', ok, ok ? 'Fehler korrekt geworfen.' : `Falscher Fehler: ${e.message}`);
    }

    // --- addFor: Gutfall ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'ForBodyAction_Task');
        agent.addAction('ForBodyAction_Task', 'show_toast', 'ShowCounter', { message: '${i}', toastType: 'info' });

        agent.createTask('stage_main', 'ForTask');
        agent.addFor(
            'ForTask',
            'i',
            1,
            10,
            (b) => b.addAction('ShowCounter'),
            2
        );

        const task = project.stages![1].tasks!.find(t => t.name === 'ForTask');
        const loopItem = task?.actionSequence[0] as any;
        const ok = loopItem?.type === 'for'
            && loopItem?.iteratorVar === 'i'
            && loopItem?.from === 1
            && loopItem?.to === 10
            && loopItem?.step === 2
            && Array.isArray(loopItem?.body)
            && loopItem.body[0]?.name === 'ShowCounter';
        addResult('addFor — Gutfall', !!ok, ok ? 'For-Sequenzitem korrekt erstellt.' : `Item: ${JSON.stringify(loopItem)}`);
    } catch (e: any) {
        addResult('addFor — Gutfall', false, `Fehler: ${e.message}`);
    }

    // --- addFor: Schlechtfall (step = 0) ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'BadForTask');
        agent.addFor('BadForTask', 'i', 1, 10, (b) => b, 0);
        addResult('addFor — Schlechtfall (step = 0)', false, 'Hätte Fehler werfen müssen.');
    } catch (e: any) {
        const ok = e.message.includes('step');
        addResult('addFor — Schlechtfall (step = 0)', ok, ok ? 'Fehler korrekt geworfen.' : `Falscher Fehler: ${e.message}`);
    }

    // --- validate() erkennt Actions in Loop-Bodies korrekt (kein false-positive 'verwaist') ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'LoopAction_Task');
        agent.addAction('LoopAction_Task', 'show_toast', 'LoopBodyAction', { message: 'tick', toastType: 'info' });

        agent.createTask('stage_main', 'ValidateLoopTask');
        agent.addForeach(
            'ValidateLoopTask',
            'items',
            'el',
            (b) => b.addAction('LoopBodyAction')
        );

        const issues = agent.validate();
        const noErrors = issues.filter(i => i.level === 'error').length === 0;
        // 'LoopBodyAction' darf NICHT als 'verwaist' markiert werden
        const noOrphanWarning = !issues.some(i => i.message.includes('LoopBodyAction') && i.message.includes('verwaist'));
        const ok = noErrors && noOrphanWarning;
        addResult('validate — Loop-Body-Actions nicht als verwaist markiert', ok,
            ok ? 'Validierung korrekt: keine Fehler, keine false-positiven Warnungen.' :
                `Issues: ${issues.map(i => i.message).join('; ')}`);
    } catch (e: any) {
        addResult('validate — Loop-Body-Actions nicht als verwaist markiert', false, `Fehler: ${e.message}`);
    }

    // --- generateTaskFlow erzeugt Nodes für Loop-Items ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'FlowAction_Task');
        agent.addAction('FlowAction_Task', 'show_toast', 'FlowLoopAction', { message: 'x', toastType: 'info' });

        agent.createTask('stage_main', 'FlowLoopTask');
        agent.addForeach(
            'FlowLoopTask',
            'list',
            'el',
            (b) => b.addAction('FlowLoopAction')
        );

        agent.generateTaskFlow('FlowLoopTask');
        const task = project.stages![1].tasks!.find(t => t.name === 'FlowLoopTask');
        const flowLayout = (task as any)?.flowLayout;
        // ForEach-Node muss einen Eintrag im flowLayout haben
        const loopNodeName = Object.keys(flowLayout || {}).find(k => k.includes('ForEach'));
        const ok = !!loopNodeName;
        addResult('generateTaskFlow — Loop-Node in flowLayout', ok,
            ok ? `Loop-Node '${loopNodeName}' korrekt im flowLayout.` : `flowLayout: ${JSON.stringify(flowLayout)}`);
    } catch (e: any) {
        addResult('generateTaskFlow — Loop-Node in flowLayout', false, `Fehler: ${e.message}`);
    }

    // ══════════════════════════════════════════════
    // Map-Iteration Tests (iterationMode)
    // ══════════════════════════════════════════════

    // --- addForeach: Map, iterationMode='keys' ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'MapKeys_ActionTask');
        agent.addAction('MapKeys_ActionTask', 'show_toast', 'ShowKeyToast', { message: '${key}', toastType: 'info' });

        agent.createTask('stage_main', 'MapKeysTask');
        agent.addForeach(
            'MapKeysTask',
            'scoreMap',
            'key',
            (b) => b.addAction('ShowKeyToast'),
            undefined,
            'keys'
        );

        const task = project.stages![1].tasks!.find(t => t.name === 'MapKeysTask');
        const loopItem = task?.actionSequence[0] as any;
        const ok = loopItem?.type === 'foreach'
            && loopItem?.iterationMode === 'keys'
            && loopItem?.sourceArray === 'scoreMap'
            && loopItem?.itemVar === 'key'
            && !loopItem?.keyVar;
        addResult('addForeach — Map iterationMode=keys', !!ok,
            ok ? 'Map-Keys-Iteration korrekt konfiguriert.' : `Item: ${JSON.stringify(loopItem)}`);
    } catch (e: any) {
        addResult('addForeach — Map iterationMode=keys', false, `Fehler: ${e.message}`);
    }

    // --- addForeach: Map, iterationMode='values' ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'MapVals_ActionTask');
        agent.addAction('MapVals_ActionTask', 'show_toast', 'ShowValToast', { message: '${score}', toastType: 'info' });

        agent.createTask('stage_main', 'MapValsTask');
        agent.addForeach(
            'MapValsTask',
            'scoreMap',
            'score',
            (b) => b.addAction('ShowValToast'),
            undefined,
            'values'
        );

        const task = project.stages![1].tasks!.find(t => t.name === 'MapValsTask');
        const loopItem = task?.actionSequence[0] as any;
        const ok = loopItem?.type === 'foreach'
            && loopItem?.iterationMode === 'values'
            && loopItem?.name.includes('scoreMap');
        addResult('addForeach — Map iterationMode=values', !!ok,
            ok ? 'Map-Values-Iteration korrekt konfiguriert.' : `Item: ${JSON.stringify(loopItem)}`);
    } catch (e: any) {
        addResult('addForeach — Map iterationMode=values', false, `Fehler: ${e.message}`);
    }

    // --- addForeach: Map, iterationMode='entries' ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'MapEntries_ActionTask');
        agent.addAction('MapEntries_ActionTask', 'show_toast', 'ShowEntryToast', { message: '${k}=${v}', toastType: 'info' });

        agent.createTask('stage_main', 'MapEntriesTask');
        agent.addForeach(
            'MapEntriesTask',
            'scoreMap',
            'v',             // itemVar = Wert
            (b) => b.addAction('ShowEntryToast'),
            'idx',
            'entries',
            'k'              // keyVar = Schlüssel
        );

        const task = project.stages![1].tasks!.find(t => t.name === 'MapEntriesTask');
        const loopItem = task?.actionSequence[0] as any;
        const ok = loopItem?.type === 'foreach'
            && loopItem?.iterationMode === 'entries'
            && loopItem?.itemVar === 'v'
            && loopItem?.keyVar === 'k'
            && loopItem?.indexVar === 'idx'
            && loopItem?.name.includes('(entries)');
        addResult('addForeach — Map iterationMode=entries', !!ok,
            ok ? 'Map-Entries-Iteration korrekt konfiguriert.' : `Item: ${JSON.stringify(loopItem)}`);
    } catch (e: any) {
        addResult('addForeach — Map iterationMode=entries', false, `Fehler: ${e.message}`);
    }

    // --- addForeach: Schlechtfall (entries ohne keyVar) ---
    try {
        const project = createTestProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        coreStore.setProject(project);

        agent.createTask('stage_main', 'BadEntriesTask');
        agent.addForeach('BadEntriesTask', 'myMap', 'v', (b) => b, undefined, 'entries');
        // keyVar fehlt → Fehler erwartet
        addResult('addForeach — Schlechtfall (entries ohne keyVar)', false, 'Hätte Fehler werfen müssen.');
    } catch (e: any) {
        const ok = e.message.includes('keyVar');
        addResult('addForeach — Schlechtfall (entries ohne keyVar)', ok,
            ok ? 'Fehler korrekt geworfen.' : `Falscher Fehler: ${e.message}`);
    }

    return results;
}
