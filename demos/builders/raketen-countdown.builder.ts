/**
 * Raketen Countdown – Builder (Proof of Concept)
 * 
 * Erstellt das Raketen-Countdown-Projekt vollständig über die ProjectBuilder-API.
 * Aufruf: npx tsx scripts/agent-run.ts demos/builders/raketen-countdown.builder.ts demos/RaketenCountdown_API.json
 */
import { ProjectBuilder } from '../../scripts/agent-run';

export default function build(agent: ProjectBuilder): void {

    // ═══════════════════════════════════════
    // SCHRITT 1: ZIEL
    // ═══════════════════════════════════════
    agent.setMeta(
        'demo_raketen_countdown',
        'Raketen Countdown',
        'Tutorial-Demo: Variablentypen, Timer und Events. Button drücken → Countdown 10→0 → Rakete startet.'
    );

    // ═══════════════════════════════════════
    // SCHRITT 2: OBJEKTE
    // ═══════════════════════════════════════

    // --- Blueprint: Infrastruktur ---
    agent.addObject('stage_blueprint', {
        className: 'TGameLoop', name: 'GameLoop',
        id: 'obj_game_loop',
        x: 2, y: 2, width: 3, height: 1,
        scope: 'stage', isService: true, isHiddenInRun: true,
        draggable: false, droppable: false, dragMode: 'move',
        visible: true, zIndex: 0, align: 'NONE',
        targetFPS: 60, boundsOffsetTop: 0, boundsOffsetBottom: 0,
        style: { color: '#ffffff', backgroundColor: '#2196f3', borderColor: '#1565c0', borderWidth: 2 }
    });

    agent.addObject('stage_blueprint', {
        className: 'TGameState', name: 'GameState',
        id: 'obj_game_state',
        x: 6, y: 2, width: 4, height: 1,
        scope: 'stage', isVariable: true, isService: true, isHiddenInRun: true,
        draggable: false, droppable: false, dragMode: 'move',
        visible: true, zIndex: 0, align: 'NONE',
        state: 'idle', spritesMoving: false, collisionsEnabled: false,
        style: { color: '#ffffff', backgroundColor: '#4caf50', borderColor: 'transparent', borderWidth: 0 }
    });

    // --- Main-Stage: Spielobjekte ---
    agent.createStage('stage_main', 'MainStage');

    agent.addObject('stage_main', {
        className: 'TSprite', name: 'Rakete',
        id: 'obj_rakete',
        x: 31, y: 34, width: 2, height: 4, zIndex: 10,
        scope: 'stage', draggable: false, droppable: false, dragMode: 'move',
        visible: true, align: 'NONE',
        velocityX: 0, velocityY: 0, lerpSpeed: 0,
        collisionEnabled: false, collisionGroup: 'default', shape: 'rect',
        spriteColor: '#ff6b35', backgroundImage: '', objectFit: 'contain',
        style: { backgroundColor: '#ff6b35', borderColor: '#ff4500', borderWidth: 2 }
    });

    agent.addObject('stage_main', {
        className: 'TButton', name: 'StartButton',
        id: 'obj_start_btn',
        x: 27, y: 2, width: 10, height: 2, zIndex: 5,
        scope: 'stage', draggable: false, droppable: false, dragMode: 'move',
        visible: true, align: 'NONE',
        text: '🚀 Start', icon: '',
        style: {
            color: '#ffffff', fontSize: 16, fontFamily: 'Arial',
            fontWeight: 'bold', fontStyle: 'normal', textAlign: 'center',
            backgroundColor: '#0078d4', borderColor: '#005a9e', borderWidth: 1, borderRadius: 8
        }
    });

    agent.addObject('stage_main', {
        className: 'TLabel', name: 'CountdownLabel',
        id: 'obj_countdown_label',
        x: 29, y: 18, width: 6, height: 4, zIndex: 5,
        scope: 'stage', draggable: false, droppable: false, dragMode: 'move',
        visible: true, align: 'NONE',
        text: '${Countdown}',
        style: {
            color: '#f7c948', fontSize: 72, fontFamily: 'Arial',
            fontWeight: 'bold', fontStyle: 'normal', textAlign: 'center',
            backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0
        }
    });

    // ═══════════════════════════════════════
    // SCHRITT 3: VARIABLEN (als Objekte auf der Stage)
    // ═══════════════════════════════════════

    agent.addObject('stage_main', {
        className: 'TTimer', name: 'CountdownTimer',
        id: 'obj_countdown_timer',
        x: 11, y: 2, width: 6, height: 3, zIndex: 0,
        scope: 'stage', isVariable: true, isService: true, isHiddenInRun: true,
        draggable: false, droppable: false, dragMode: 'move',
        visible: true, align: 'NONE',
        interval: 1000, enabled: false, maxInterval: 10, currentInterval: 0,
        style: { backgroundColor: '#4caf50', borderColor: '#2e7d32', borderWidth: 2 }
    });

    agent.addObject('stage_main', {
        className: 'TIntegerVariable', name: 'Countdown',
        id: 'var_countdown',
        x: 2, y: 4, width: 6, height: 2, zIndex: 0,
        scope: 'stage', isVariable: true, isHiddenInRun: true,
        draggable: false, droppable: false, dragMode: 'move',
        visible: true, align: 'NONE',
        type: 'integer', defaultValue: 10, value: 10, objectModel: '',
        style: { color: '#000000', backgroundColor: '#d1c4e9', borderColor: '#9575cd', borderWidth: 1 }
    });

    // ═══════════════════════════════════════
    // SCHRITT 4+5: TASKS + ACTIONS
    // ═══════════════════════════════════════

    // Task: StartCountdown
    agent.createTask('stage_main', 'StartCountdown', 'Timer starten und Button deaktivieren');
    agent.addAction('StartCountdown', 'property', 'SpielStarten', {
        target: 'GameState', changes: { state: 'playing' }
    });
    agent.addAction('StartCountdown', 'call_method', 'TimerStarten', {
        target: 'CountdownTimer', method: 'timerStart'
    });
    agent.addAction('StartCountdown', 'property', 'ButtonDeaktivieren', {
        target: 'StartButton', changes: { enabled: false }
    });

    // Task: OnTimerTick
    agent.createTask('stage_main', 'OnTimerTick', 'Countdown um 1 reduzieren');
    agent.addAction('OnTimerTick', 'calculate', 'CountdownReduzieren', {
        formula: 'Countdown - 1', resultVariable: 'Countdown'
    });

    // Task: OnCountdownFinish
    agent.createTask('stage_main', 'OnCountdownFinish', 'Rakete starten');
    agent.addAction('OnCountdownFinish', 'property', 'PhysikAktivieren', {
        target: 'GameState', changes: { spritesMoving: true }
    });
    agent.addAction('OnCountdownFinish', 'property', 'RaketeStarten', {
        target: 'Rakete', changes: { velocityY: -5 }
    });

    // ═══════════════════════════════════════
    // SCHRITT 6: EVENTS
    // ═══════════════════════════════════════

    agent.connectEvent('stage_main', 'StartButton', 'onClick', 'StartCountdown');
    agent.connectEvent('stage_main', 'CountdownTimer', 'onTimer', 'OnTimerTick');
    agent.connectEvent('stage_main', 'CountdownTimer', 'onMaxIntervalReached', 'OnCountdownFinish');
}
