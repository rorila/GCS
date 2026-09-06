/**
 * Mathe-Quiz Builder – Test
 * 
 * Prüft ob der Builder via agent-run.ts ein valides Projekt-JSON erzeugt.
 * Gleiche Logik wie der Builder, aber mit direkter Validierung.
 */
import { ProjectBuilder } from '../scripts/agent-run';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

export async function runTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({ name, type: 'MatheQuiz', expectedSuccess: true, actualSuccess: passed, passed, details });
    };

    try {
        // Builder laden und ausführen
        const builderModule = await import('../demos/builders/mathe-quiz.builder.js');
        const builderFn = builderModule.default;

        const builder = new ProjectBuilder();
        builderFn(builder);
        builder.generateFlowLayouts();
        const project = builder.getProject();

        // 1. Grundstruktur
        const stages = project.stages;
        const stageCount = stages.length;
        const mainStage = stages.find((s: any) => s.id === 'stage_main');
        const bp = stages.find((s: any) => s.id === 'stage_blueprint');

        const hasCorrectStages = stageCount === 2 && !!mainStage && !!bp;
        addResult('Grundstruktur: 2 Stages', hasCorrectStages,
            hasCorrectStages ? `Blueprint + Quiz` : `stages=${stageCount}`);

        // 2. Blueprint-Infrastruktur
        const hasGameLoop = bp.objects.some((o: any) => o.className === 'TGameLoop');
        const hasGameState = [...bp.objects, ...bp.variables].some((o: any) => o.className === 'TGameState');
        addResult('Blueprint: GameLoop + GameState', hasGameLoop && hasGameState,
            `GameLoop=${hasGameLoop}, GameState=${hasGameState}`);

        // 3. Quiz-Objekte
        const mainObjs = mainStage.objects || [];
        const mainVars = mainStage.variables || [];
        const allMainObjs = [...mainObjs, ...mainVars];

        const hasZahl1 = allMainObjs.some((o: any) => o.name === 'Zahl1' && o.className === 'TRandomVariable');
        const hasZahl2 = allMainObjs.some((o: any) => o.name === 'Zahl2' && o.className === 'TRandomVariable');
        const hasScore = allMainObjs.some((o: any) => o.name === 'Score' && o.className === 'TIntegerVariable');
        const hasTimer = allMainObjs.some((o: any) => o.name === 'CountdownTimer' && o.className === 'TTimer');
        const hasEdit = allMainObjs.some((o: any) => o.name === 'AntwortInput' && o.className === 'TEdit');
        addResult('Quiz-Objekte: Random, Score, Timer, Edit', 
            hasZahl1 && hasZahl2 && hasScore && hasTimer && hasEdit,
            `Zahl1=${hasZahl1}, Zahl2=${hasZahl2}, Score=${hasScore}, Timer=${hasTimer}, Edit=${hasEdit}`);

        // 4. Tasks
        const tasks = mainStage.tasks || [];
        const taskNames = tasks.map((t: any) => t.name);
        const expectedTasks = ['QuizStarten', 'NeueAufgabe', 'AntwortPruefen', 'OnTimerTick', 'QuizBeenden'];
        const allTasksPresent = expectedTasks.every(name => taskNames.includes(name));
        addResult('5 Tasks vorhanden', allTasksPresent,
            allTasksPresent ? `Tasks: ${taskNames.join(', ')}` : `Fehlend: ${expectedTasks.filter(n => !taskNames.includes(n)).join(', ')}`);

        // 5. Branch (Condition) in AntwortPruefen
        const antwortTask = tasks.find((t: any) => t.name === 'AntwortPruefen');
        const hasBranch = antwortTask?.actionSequence.some((s: any) => s.type === 'condition');
        addResult('AntwortPruefen: Condition-Branch', !!hasBranch,
            hasBranch ? 'Verzweigung für Richtig/Falsch vorhanden' : 'Kein Branch gefunden');

        // 6. Bindings
        const zahl1Label = mainObjs.find((o: any) => o.name === 'Zahl1Label');
        const scoreLabel = mainObjs.find((o: any) => o.name === 'ScoreLabel');
        const hasBindings = zahl1Label?.text === '${Zahl1}' && scoreLabel?.text === '${Score}';
        addResult('Bindings: Zahl1Label + ScoreLabel', hasBindings,
            `Zahl1Label.text="${zahl1Label?.text}", ScoreLabel.text="${scoreLabel?.text}"`);

        // 7. Events
        const startBtn = mainObjs.find((o: any) => o.name === 'StartButton');
        const okBtn = mainObjs.find((o: any) => o.name === 'OkButton');
        const timer = allMainObjs.find((o: any) => o.name === 'CountdownTimer');
        const hasEvents = startBtn?.events?.onClick === 'QuizStarten'
            && okBtn?.events?.onClick === 'AntwortPruefen'
            && timer?.events?.onTimer === 'OnTimerTick'
            && timer?.events?.onMaxIntervalReached === 'QuizBeenden';
        addResult('Events: Start, OK, Timer, GameOver', hasEvents,
            `Start=${startBtn?.events?.onClick}, OK=${okBtn?.events?.onClick}, Timer=${timer?.events?.onTimer}, Max=${timer?.events?.onMaxIntervalReached}`);

        // 8. Task-Aufrufe (QuizStarten → NeueAufgabe)
        const quizStartTask = tasks.find((t: any) => t.name === 'QuizStarten');
        const hasTaskCall = quizStartTask?.actionSequence.some((s: any) => s.type === 'task' && s.name === 'NeueAufgabe');
        addResult('TaskCall: QuizStarten → NeueAufgabe', !!hasTaskCall,
            hasTaskCall ? 'Task-Aufruf vorhanden' : 'Kein TaskCall');

        // 9. FlowLayouts
        const tasksWithFlow = tasks.filter((t: any) => t.flowLayout && Object.keys(t.flowLayout).length > 0);
        const allHaveFlow = tasksWithFlow.length === tasks.length;
        addResult('FlowLayouts: Alle 5 Tasks haben Layouts', allHaveFlow,
            `${tasksWithFlow.length}/${tasks.length} Tasks mit FlowLayout`);

        // 10. Validierung
        const issues = builder.validate();
        const errors = issues.filter((i: any) => i.level === 'error');
        addResult('Validierung: 0 Fehler', errors.length === 0,
            errors.length === 0 ? `${issues.length} Warnungen, 0 Fehler` : `${errors.length} Fehler: ${errors.map(e => e.message).join(', ')}`);

    } catch (e: any) {
        addResult('Builder-Ausführung', false, `Fehler: ${e.message}\n${e.stack}`);
    }

    return results;
}
