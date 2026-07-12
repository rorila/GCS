/**
 * Countdown mit Raketen-Start – generiert aus User Story Template
 * 
 * Beispiel für den KI-Workflow:
 * - Ausgangsbasis: demos/user-stories/template_empty_with_stories.json
 * - Ziel: Ein vollständiges GCS-Projekt mit Countdown, Button und Rakete.
 * 
 * Aufruf:
 *   npx tsx scripts/agent-run.ts demos/builders/countdown_from_userstory.builder.ts demos/CountdownFromUserStory.json
 */
import { ProjectBuilder } from '../../scripts/agent-run';

export default function build(agent: ProjectBuilder): void {
    agent.setMeta(
        'demo_countdown_from_userstory',
        'CountdownFromUserStory',
        'KI-generiertes Beispiel: Countdown 10→0, dann startet die Rakete.'
    );

    // Blueprint: Infrastruktur
    agent.addObject('stage_blueprint', {
        className: 'TGameLoop', name: 'GameLoop',
        x: 2, y: 2, width: 3, height: 1,
        isService: true, isHiddenInRun: true, targetFPS: 60,
        style: { backgroundColor: '#2196f3', borderColor: '#1565c0', borderWidth: 2, color: '#fff' }
    });

    agent.addObject('stage_blueprint', {
        className: 'TGameState', name: 'GameState',
        x: 6, y: 2, width: 4, height: 1,
        isVariable: true, isService: true, isHiddenInRun: true,
        state: 'idle', spritesMoving: false, collisionsEnabled: false,
        style: { backgroundColor: '#4caf50', color: '#fff' }
    });

    // MainStage
    agent.createStage('stage_main', 'MainStage');

    // UI und Objekte
    agent.createLabel('stage_main', 'TitelLabel', 16, 2, '🚀 Raketen Countdown', {
        width: 32, height: 3, fontSize: 32, fontWeight: 'bold', color: '#f7c948', textAlign: 'center'
    });

    agent.addObject('stage_main', {
        className: 'TSprite', name: 'Rakete',
        x: 28, y: 30, width: 8, height: 8,
        text: '🚀', fontSize: 64, textAlign: 'center',
        style: { backgroundColor: 'transparent', color: '#ffffff' }
    });

    agent.addObject('stage_main', {
        className: 'TButton', name: 'StartButton',
        x: 22, y: 18, width: 20, height: 4,
        text: '▶️ Countdown starten',
        style: {
            fontSize: 24, fontWeight: 'bold', textAlign: 'center',
            backgroundColor: '#0078d4', borderColor: '#005a9e', borderWidth: 2, borderRadius: 16,
            color: '#ffffff'
        }
    });

    agent.createLabel('stage_main', 'CountdownLabel', 24, 12, '${Countdown}', {
        width: 16, height: 5, fontSize: 64, fontWeight: 'bold', color: '#ff6b6b', textAlign: 'center'
    });

    // Variablen
    agent.addObject('stage_main', {
        className: 'TTimer', name: 'CountdownTimer',
        x: 2, y: 6, width: 6, height: 2,
        isVariable: true, isService: true, isHiddenInRun: true,
        interval: 1000, enabled: false, maxInterval: 10, currentInterval: 0,
        style: { backgroundColor: '#e53935', borderColor: '#b71c1c', borderWidth: 2 }
    });

    agent.addObject('stage_main', {
        className: 'TIntegerVariable', name: 'Countdown',
        x: 2, y: 9, width: 4, height: 1,
        isVariable: true, isHiddenInRun: true,
        type: 'integer', defaultValue: 10, value: 10,
        style: { backgroundColor: '#d1c4e9', borderColor: '#9575cd', borderWidth: 1 }
    });

    // Bindings
    agent.bindVariable('stage_main', 'CountdownLabel', 'text', 'Countdown');

    // Tasks
    agent.createTask('stage_main', 'StartCountdown', 'Countdown starten und Button deaktivieren');
    agent.addAction('StartCountdown', 'property', 'SpielStarten', { target: 'GameState', changes: { state: 'playing' } });
    agent.addAction('StartCountdown', 'call_method', 'TimerStarten', { target: 'CountdownTimer', method: 'timerStart' });
    agent.addAction('StartCountdown', 'property', 'ButtonDeaktivieren', { target: 'StartButton', changes: { enabled: false } });

    agent.createTask('stage_main', 'OnTimerTick', 'Countdown um 1 reduzieren');
    agent.addAction('OnTimerTick', 'calculate', 'CountdownReduzieren', { formula: 'Countdown - 1', resultVariable: 'Countdown' });

    agent.createTask('stage_main', 'OnCountdownFinish', 'Rakete starten');
    agent.addAction('OnCountdownFinish', 'property', 'PhysikAktivieren', { target: 'GameState', changes: { spritesMoving: true } });
    agent.addAction('OnCountdownFinish', 'property', 'RaketeStarten', { target: 'Rakete', changes: { velocityY: -5 } });

    // Events
    agent.connectEvent('stage_main', 'StartButton', 'onClick', 'StartCountdown');
    agent.connectEvent('stage_main', 'CountdownTimer', 'onTimer', 'OnTimerTick');
    agent.connectEvent('stage_main', 'CountdownTimer', 'onMaxIntervalReached', 'OnCountdownFinish');
}
