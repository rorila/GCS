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
 * Erstellt ein leeres Projekt für das Raketen-Demo (1280x800).
 */
function createRocketProject(): GameProject {
    return {
        meta: { name: 'Raketen-Countdown Demo', author: 'AgentController', version: '1.0.0' },
        stage: { grid: { cols: 64, rows: 40, cellSize: 20, visible: true, snapToGrid: true, backgroundColor: '#0f0c29' } },
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
                id: 'stage_main', name: 'MainStage', type: 'main',
                objects: [], tasks: [], actions: [], variables: [], flowCharts: {}
            }
        ],
        activeStageId: 'stage_main'
    } as any;
}

export async function runTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({ name, type: 'RaketenCountdown', expectedSuccess: true, actualSuccess: passed, passed, details });
    };

    // ══════════════════════════════════════════════
    // Integration: Raketen-Countdown via executeBatch
    // ══════════════════════════════════════════════

    try {
        const project = createRocketProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        const batchOps = [
            // ── 0. Infrastruktur (Blueprint-Stage) ──
            { method: 'addObject', params: ['stage_blueprint', {
                name: 'GameLoop', className: 'TGameLoop',
                x: 2, y: 2, width: 3, height: 1,
                targetFPS: 60, boundsOffsetTop: 0, boundsOffsetBottom: 0
            }]},
            { method: 'addObject', params: ['stage_blueprint', {
                name: 'GameState', className: 'TGameState',
                x: 6, y: 2, width: 4, height: 1,
                state: 'idle', spritesMoving: false, collisionsEnabled: false
            }]},

            // ── 1. Globale Variable (Blueprint-Stage) ──
            { method: 'addVariable', params: ['Countdown', 'number', 10] },

            // ── 2. Visuelle Objekte (MainStage) ──
            // Rakete: schmales Rechteck, unten Mitte
            { method: 'addObject', params: ['stage_main', {
                name: 'Rakete', className: 'TSprite',
                x: 31, y: 34, width: 2, height: 4,
                velocityX: 0, velocityY: 0,
                color: '#ff6b35',
                style: { backgroundColor: '#ff6b35', borderColor: '#ff4500', borderWidth: 2 }
            }]},
            // Start-Button
            { method: 'addObject', params: ['stage_main', {
                name: 'StartButton', className: 'TButton',
                x: 27, y: 2, width: 10, height: 2,
                caption: '🚀 Start',
                style: { backgroundColor: '#0078d4', color: '#ffffff', fontSize: 16, borderRadius: 8 }
            }]},
            // Countdown-Label
            { method: 'addObject', params: ['stage_main', {
                name: 'CountdownLabel', className: 'TLabel',
                x: 29, y: 18, width: 6, height: 4,
                caption: '10',
                style: { fontSize: 72, color: '#f7c948', fontWeight: 'bold', textAlign: 'center' }
            }]},
            // Timer (unsichtbar im Run-Mode)
            { method: 'addObject', params: ['stage_main', {
                name: 'CountdownTimer', className: 'TTimer',
                x: 2, y: 2, width: 3, height: 1,
                interval: 1000, maxInterval: 10, enabled: false
            }]},

            // ── 3. Binding: Label zeigt Variable ──
            { method: 'bindVariable', params: ['stage_main', 'CountdownLabel', 'caption', 'Countdown'] },

            // ── 4. Tasks (in MainStage) ──
            { method: 'createTask', params: ['stage_main', 'StartCountdown', 'Timer starten und Button deaktivieren'] },
            { method: 'createTask', params: ['stage_main', 'OnTimerTick', 'Countdown um 1 reduzieren'] },
            { method: 'createTask', params: ['stage_main', 'OnCountdownFinish', 'Rakete starten'] },

            // Action: Spiel starten (GameState aktivieren)
            { method: 'addAction', params: ['StartCountdown', 'property', 'SpielStarten', {
                target: 'GameState', changes: { state: 'playing' }
            }]},
            // Action: Timer starten (call_method)
            { method: 'addAction', params: ['StartCountdown', 'call_method', 'TimerStarten', {
                target: 'CountdownTimer', method: 'timerStart'
            }]},
            // Action: Button deaktivieren
            { method: 'addAction', params: ['StartCountdown', 'property', 'ButtonDeaktivieren', {
                target: 'StartButton', changes: { enabled: false }
            }]},
            // Action: Countdown reduzieren (Berechnung: Countdown - 1)
            { method: 'addAction', params: ['OnTimerTick', 'calculate', 'CountdownReduzieren', {
                formula: 'Countdown - 1', resultVariable: 'Countdown'
            }]},
            // Action: Physik aktivieren
            { method: 'addAction', params: ['OnCountdownFinish', 'property', 'PhysikAktivieren', {
                target: 'GameState', changes: { spritesMoving: true }
            }]},
            // Action: Rakete starten
            { method: 'addAction', params: ['OnCountdownFinish', 'property', 'RaketeStarten', {
                target: 'Rakete', changes: { velocityY: -5 }
            }]},

            // ── 6. Events verbinden ──
            { method: 'connectEvent', params: ['stage_main', 'StartButton', 'onClick', 'StartCountdown'] },
            { method: 'connectEvent', params: ['stage_main', 'CountdownTimer', 'onTimer', 'OnTimerTick'] },
            { method: 'connectEvent', params: ['stage_main', 'CountdownTimer', 'onMaxIntervalReached', 'OnCountdownFinish'] },
        ];

        const batchResults = agent.executeBatch(batchOps);
        const allOpsSuccess = batchResults.every(r => r.success);

        // ── Validierung ──
        const mainStage = project.stages![1];
        const blueprint = project.stages![0];

        // Objekte prüfen
        const objCount = mainStage.objects!.length;
        const hasRakete = mainStage.objects!.some((o: any) => o.name === 'Rakete' && o.className === 'TSprite');
        const hasButton = mainStage.objects!.some((o: any) => o.name === 'StartButton');
        const hasLabel = mainStage.objects!.some((o: any) => o.name === 'CountdownLabel');
        const hasTimer = mainStage.objects!.some((o: any) => o.name === 'CountdownTimer' && o.className === 'TTimer');

        // Tasks prüfen
        const taskCount = mainStage.tasks!.length;
        const hasStartTask = mainStage.tasks!.some(t => t.name === 'StartCountdown');
        const hasTickTask = mainStage.tasks!.some(t => t.name === 'OnTimerTick');
        const hasFinishTask = mainStage.tasks!.some(t => t.name === 'OnCountdownFinish');

        // Actions prüfen (im Blueprint)
        const actionCount = blueprint.actions!.length;
        const blueprintObjCount = blueprint.objects!.length;
        const hasGameLoop = blueprint.objects!.some((o: any) => o.name === 'GameLoop' && o.className === 'TGameLoop');
        const hasGameState = blueprint.objects!.some((o: any) => o.name === 'GameState' && o.className === 'TGameState');

        // Variable prüfen
        const hasVar = project.variables!.some(v => v.name === 'Countdown');

        // Binding prüfen
        const label = mainStage.objects!.find((o: any) => o.name === 'CountdownLabel');
        const hasBinding = label?.caption === '${Countdown}';

        // Events prüfen
        const button = mainStage.objects!.find((o: any) => o.name === 'StartButton');
        const timer = mainStage.objects!.find((o: any) => o.name === 'CountdownTimer');
        const hasOnClick = button?.events?.onClick === 'StartCountdown';
        const hasOnTimer = timer?.events?.onTimer === 'OnTimerTick';
        const hasOnMax = timer?.events?.onMaxIntervalReached === 'OnCountdownFinish';

        // Validierung via AgentController
        const issues = agent.validate();
        const noErrors = issues.filter(i => i.level === 'error').length === 0;

        const allOk = allOpsSuccess && objCount === 4 && taskCount === 3 && actionCount === 6
            && blueprintObjCount === 2 && hasGameLoop && hasGameState
            && hasRakete && hasButton && hasLabel && hasTimer
            && hasStartTask && hasTickTask && hasFinishTask
            && hasVar && hasBinding
            && hasOnClick && hasOnTimer && hasOnMax
            && noErrors;

        addResult('Integration: Raketen-Countdown via Batch', allOk,
            allOk
            ? `Vollständiges Raketen-Demo: ${batchOps.length} Batch-Ops, 4 Objekte, 2 Blueprint-Objekte (GameLoop+GameState), 3 Tasks, 6 Actions, 1 Variable, 3 Events, Binding OK. Validierung: ${issues.length} Warnungen, 0 Fehler.`
            : `Fehler: ops=${allOpsSuccess}, objs=${objCount}/4, bpObjs=${blueprintObjCount}/2, tasks=${taskCount}/3, actions=${actionCount}/6, ` +
              `gameLoop=${hasGameLoop}, gameState=${hasGameState}, ` +
              `rakete=${hasRakete}, button=${hasButton}, label=${hasLabel}, timer=${hasTimer}, ` +
              `startTask=${hasStartTask}, tickTask=${hasTickTask}, finishTask=${hasFinishTask}, ` +
              `var=${hasVar}, binding=${hasBinding}, ` +
              `onClick=${hasOnClick}, onTimer=${hasOnTimer}, onMax=${hasOnMax}, noErrors=${noErrors}`
        );

        // Batch-Fehler Details ausgeben
        if (!allOpsSuccess) {
            const failedOps = batchResults.filter(r => !r.success);
            failedOps.forEach(f => {
                addResult(`  └ Batch-Fehler: ${f.method}`, false, f.error || 'Unbekannter Fehler');
            });
        }

    } catch (e: any) {
        addResult('Integration: Raketen-Countdown via Batch', false, `Fehler: ${e.message}\n${e.stack}`);
    }

    // ══════════════════════════════════════════════
    // Struktur-Test: Einzelne Komponenten prüfbar
    // ══════════════════════════════════════════════

    try {
        const project = createRocketProject();
        const agent = AgentController.getInstance();
        agent.setProject(project);
        projectRegistry.setProject(project);

        // Nur die Struktur-Erstellung (ohne Events)
        agent.addVariable('TestTimer', 'number', 0);
        agent.addObject('stage_main', { name: 'TestSprite', className: 'TSprite', x: 10, y: 10, width: 2, height: 4, velocityY: 0 });
        agent.createTask('stage_main', 'TestTask', 'Beschreibung');
        agent.addAction('TestTask', 'property', 'TestAction', { target: 'TestSprite', property: 'velocityY', value: -3 });

        const mainStage = project.stages![1];
        const task = mainStage.tasks!.find(t => t.name === 'TestTask');
        const hasAction = task?.actionSequence.some((s: any) => s.type === 'action' && s.name === 'TestAction');
        const hasSprite = mainStage.objects!.some((o: any) => o.name === 'TestSprite' && o.velocityY === 0);

        const ok = !!hasAction && !!hasSprite;
        addResult('Struktur: Sprite + Task + Action', ok,
            ok ? 'Sprite mit velocityY=0, Task mit set_property Action korrekt erstellt.'
            : `hasAction=${hasAction}, hasSprite=${hasSprite}`
        );
    } catch (e: any) {
        addResult('Struktur: Sprite + Task + Action', false, `Fehler: ${e.message}`);
    }

    return results;
}
