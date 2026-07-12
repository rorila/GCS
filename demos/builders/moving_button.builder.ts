/**
 * Moving Button - generiert aus dem agentController-Script
 *
 * Use Case: Ein Button, der zufaellig auf der Stage springt,
 * sobald der Mauszeiger ihn beruehrt (onMouseEnter).
 *
 * Aufruf:
 *   npx tsx scripts/agent-run.ts demos/builders/moving_button.builder.ts demos/MovingButton.json
 */
import type { ProjectBuilder } from '../../scripts/agent-run';

export default function build(agent: ProjectBuilder): void {
    agent.setMeta(
        'demo_moving_button',
        'MovingButton',
        'Ein einzelner Button springt auf der Stage zufaellig weg, wenn die Maus ihn beruehrt.'
    );

    // Blueprint: Infrastruktur
    agent.addObject('stage_blueprint', {
        className: 'TGameLoop',
        name: 'GameLoop',
        x: 2,
        y: 2,
        width: 4,
        height: 2,
        isService: true,
        isHiddenInRun: true,
        targetFPS: 60,
        state: 'running',
        style: {
            backgroundColor: '#2196f3',
            borderColor: '#1565c0',
            borderWidth: 2,
            color: '#ffffff'
        }
    });

    agent.addObject('stage_blueprint', {
        className: 'TGameState',
        name: 'GameState',
        x: 7,
        y: 2,
        width: 4,
        height: 2,
        isVariable: true,
        isService: true,
        isHiddenInRun: true,
        state: 'running',
        spritesMoving: false,
        collisionsEnabled: false,
        style: {
            backgroundColor: '#4caf50',
            borderColor: '#2e7d32',
            borderWidth: 2,
            color: '#ffffff'
        }
    });

    // Haupt-Stage
    agent.createStage('stage_main', 'MainStage');

    // Der einzige Button auf der Stage
    agent.addObject('stage_main', {
        className: 'TButton',
        name: 'StartButton',
        x: 28,
        y: 18,
        width: 8,
        height: 4,
        text: 'Klick mich',
        style: {
            backgroundColor: '#0078d4',
            borderColor: '#005a9e',
            borderWidth: 2,
            borderRadius: 8,
            color: '#ffffff',
            fontSize: 18,
            fontWeight: 'bold',
            textAlign: 'center'
        }
    });

    // Task: Button neu positionieren
    agent.createTask(
        'stage_main',
        'MoveTheStartButton',
        'Berechnet eine zufaellige Position und setzt den Button dorthin.'
    );

    // Neue zufaellige Koordinaten berechnen (innerhalb der Stage-Grenzen)
    // Stage-Grid: 64 x 40, Button-Groesse: 8 x 4
    agent.addAction('MoveTheStartButton', 'calculate', 'CalcNewX', {
        resultVariable: 'newX',
        formula: 'Math.floor(Math.random() * (64 - 8))'
    });

    agent.addAction('MoveTheStartButton', 'calculate', 'CalcNewY', {
        resultVariable: 'newY',
        formula: 'Math.floor(Math.random() * (40 - 4))'
    });

    // Button auf die neuen Koordinaten setzen
    agent.addAction('MoveTheStartButton', 'property', 'MoveButton', {
        target: 'StartButton',
        changes: {
            x: '${newX}',
            y: '${newY}'
        }
    });

    // Event: sobald der Mauszeiger den Button beruehrt, Task ausfuehren
    agent.connectEvent('stage_main', 'StartButton', 'onMouseEnter', 'MoveTheStartButton');
}
