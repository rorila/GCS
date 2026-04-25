export default function build(agent: any) {
    agent.setMeta('pong', 'Ping Pong', 'My First KI Game');

/* =========================================================
   1. STAGES
========================================================= */

// Blueprint (MUSS genau einmal existieren)
agent.createStage('stage_blueprint', 'Blueprint', 'blueprint');

// Game Stage
agent.createStage('stage_main', 'Pong Game', 'standard');


/* =========================================================
   2. VARIABLEN (GLOBAL)
========================================================= */

agent.addVariable('scoreLeft', 'number', 0);
agent.addVariable('scoreRight', 'number', 0);
agent.addVariable('gameState', 'string', 'idle');


/* =========================================================
   3. OBJEKTE (GAME STAGE)
========================================================= */

// Ball
agent.createSprite('stage_main', 'Ball', 30, 20, 2, 2, {
    velocityX: 1,
    velocityY: 1,
    collisionEnabled: true,
    shape: 'circle'
});

// Paddle links
agent.createSprite('stage_main', 'PaddleLeft', 2, 18, 2, 6, {
    collisionEnabled: true
});

// Paddle rechts
agent.createSprite('stage_main', 'PaddleRight', 60, 18, 2, 6, {
    collisionEnabled: true
});

// Score Labels
agent.createLabel('stage_main', 'ScoreLeft', 20, 2, '${scoreLeft}');
agent.createLabel('stage_main', 'ScoreRight', 40, 2, '${scoreRight}');


/* =========================================================
   4. TASKS
========================================================= */

/* ---------- StartGame ---------- */

agent.createTask('stage_main', 'StartGame', 'Startet das Spiel');

agent.addAction('StartGame', 'variable', 'ResetScoreLeft', {
    variableName: 'scoreLeft',
    value: 0
});

agent.addAction('StartGame', 'variable', 'ResetScoreRight', {
    variableName: 'scoreRight',
    value: 0
});

agent.addAction('StartGame', 'property', 'ResetBallPosition', {
    target: 'Ball',
    changes: { x: 30, y: 20 }
});

agent.addAction('StartGame', 'property', 'SetBallVelocity', {
    target: 'Ball',
    changes: { velocityX: 1, velocityY: 1 }
});

agent.addAction('StartGame', 'variable', 'SetGameStatePlaying', {
    variableName: 'gameState',
    value: 'playing'
});


/* ---------- HandleBoundary ---------- */

agent.createTask('stage_main', 'HandleBoundary', 'Ball trifft Rand');
agent.addTaskParam('HandleBoundary', 'hitSide', 'string', '');

// TOP
agent.addBranch('HandleBoundary', 'hitSide', '==', 'top',
    (then) => {
        then.addNewAction('negate', 'BounceTop', {
            target: 'Ball',
            changes: { velocityY: 1 }
        });
    }
);

// BOTTOM
agent.addBranch('HandleBoundary', 'hitSide', '==', 'bottom',
    (then) => {
        then.addNewAction('negate', 'BounceBottom', {
            target: 'Ball',
            changes: { velocityY: 1 }
        });
    }
);

// LEFT → Punkt rechts
agent.addBranch('HandleBoundary', 'hitSide', '==', 'left',
    (then) => {

        then.addNewAction('calculate', 'IncRightScore', {
            resultVariable: 'scoreRight',
            formula: '${scoreRight} + 1'
        });

        then.addNewAction('property', 'ResetBallAfterLeft', {
            target: 'Ball',
            changes: { x: 30, y: 20 }
        });

    }
);

// RIGHT → Punkt links
agent.addBranch('HandleBoundary', 'hitSide', '==', 'right',
    (then) => {

        then.addNewAction('calculate', 'IncLeftScore', {
            resultVariable: 'scoreLeft',
            formula: '${scoreLeft} + 1'
        });

        then.addNewAction('property', 'ResetBallAfterRight', {
            target: 'Ball',
            changes: { x: 30, y: 20 }
        });

    }
);


/* ---------- HandlePaddleHit ---------- */

agent.createTask('stage_main', 'HandlePaddleHit', 'Ball trifft Paddle');

agent.addAction('HandlePaddleHit', 'negate', 'BounceHorizontal', {
    target: 'Ball',
    changes: { velocityX: 1 }
});

/* =========================================================
   5. EVENTS
========================================================= */

// Ball trifft Spielfeldrand
agent.connectEvent('stage_main', 'Ball', 'onBoundaryHit', 'HandleBoundary');

// Ball trifft Paddle
agent.connectEvent('stage_main', 'Ball', 'onCollision', 'HandlePaddleHit');

// Spielstart automatisch
agent.connectEvent('stage_main', 'stage', 'onRuntimeStart', 'StartGame');

}