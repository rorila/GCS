const fs = require('fs');
const path = require('path');

const outFile = path.join(__dirname, '../game-server/public/projects/JumpAndRunDemo.json');

function obj(base) {
    return {
        scope: 'stage',
        draggable: false,
        droppable: false,
        dragMode: 'move',
        visible: true,
        zIndex: 0,
        rotation: 0,
        align: 'NONE',
        collisionEnabled: false,
        ...base
    };
}

function action(id, name, type, extra) {
    return { id, name, type, showDetails: false, target: '', changes: {}, ...extra };
}

const project = {
    meta: {
        name: 'JumpAndRunDemo',
        version: '1.0.0',
        author: 'GCS Agent',
        description: 'Endless Runner Demo mit Parallax, Object Pooling, Shake & Speedlines',
        _sourcePath: 'projects/JumpAndRunDemo.json'
    },
    stage: {
        grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#1a1a2e' }
    },
    flow: { elements: [], connections: [] },
    input: { player1Controls: 'arrows', player1Target: '', player1Speed: 0.2, player2Controls: 'wasd', player2Target: '', player2Speed: 0.2 },
    objects: [],
    splashObjects: [],
    splashDuration: 3000,
    splashAutoHide: true,
    actions: [],
    tasks: [],
    variables: [],
    stages: []
};

const blueprint = {
    id: 'blueprint',
    name: 'Blueprint (Global)',
    type: 'blueprint',
    objects: [
        obj({
            className: 'TStageController', id: 'stage_controller', name: 'StageController',
            scope: 'global', isService: true, isHiddenInRun: true, x: 2, y: 2, width: 8, height: 4,
            style: { color: '#ffffff', backgroundColor: '#9c27b0', borderColor: 'transparent', borderWidth: 0 },
            currentStageId: '', currentStageName: '', currentStageType: 'standard', stageCount: 0,
            isOnMainStage: false, isOnSplashStage: false
        }),
        obj({
            className: 'TGameLoop', id: 'game_loop', name: 'GameLoop',
            isService: true, isHiddenInRun: true, x: 2, y: 7, width: 4, height: 2,
            style: { color: '#ffffff', backgroundColor: '#2196f3', borderColor: '#1565c0', borderWidth: 2 },
            targetFPS: 60, boundaryMode: 'clamp', boundsOffsetTop: 0, boundsOffsetBottom: 0
        }),
        obj({
            className: 'TGameState', id: 'game_state', name: 'GameState',
            isService: true, isHiddenInRun: true, x: 7, y: 7, width: 4, height: 2,
            style: { color: '#ffffff', backgroundColor: '#f44336', borderColor: '#d32f2f', borderWidth: 2 },
            state: 'idle', spritesMoving: false, collisionsEnabled: false
        })
    ],
    actions: [],
    tasks: [],
    variables: [],
    grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#f5f5f5' },
    flowCharts: {}
};

const mainStage = {
    id: 'main',
    name: 'JumpAndRun',
    type: 'main',
    events: { onEnter: 'StartGame' },
    objects: [
        // Parallax-Hintergrund (optional, ohne Layer-Bilder)
        obj({
            className: 'TParallaxBackground', id: 'bg', name: 'Bg',
            x: 0, y: 0, width: 64, height: 40,
            baseSpeed: 4, repeat: true, scrollSource: '', layers: [],
            style: { backgroundColor: 'transparent' }
        }),
        // Speedlines-Overlay
        obj({
            className: 'TSpeedlines', id: 'speedlines', name: 'Speedlines',
            x: 0, y: 0, width: 64, height: 40, visible: false, zIndex: 500,
            lineCount: 16, speed: 0.3, lineColor: 'rgba(255,255,255,0.7)',
            overlayOpacity: 0.1, lineWidth: 2, lineLength: 120,
            style: { backgroundColor: 'transparent' }
        }),
        // Boden
        obj({
            className: 'TPanel', id: 'ground', name: 'Ground',
            x: 0, y: 36, width: 64, height: 4,
            collisionEnabled: true, pushOutOnCollision: true,
            style: { backgroundColor: '#374151', borderColor: 'transparent', borderWidth: 0 }
        }),
        // Spieler
        obj({
            className: 'TSprite', id: 'player', name: 'Player',
            x: 10, y: 34, width: 2, height: 2,
            visible: true, collisionEnabled: true, pushOutOnCollision: false,
            collisionGroup: 'player', shape: 'rect', spriteColor: '#34d399',
            velocityX: 0, velocityY: 0, gravity: 28, lerpSpeed: 0.1,
            events: { onCollisionBottom: 'PlayerLand' },
            style: { backgroundColor: '#34d399', borderColor: '#065f46', borderWidth: 1 }
        }),
        // Hindernis-Template
        obj({
            className: 'TSpriteTemplate', id: 'obstacle_template', name: 'ObstacleTemplate',
            isHiddenInRun: true, x: 60, y: 30, width: 2, height: 2,
            collisionEnabled: true, pushOutOnCollision: false,
            collisionGroup: 'obstacle', shape: 'rect', spriteColor: '#f87171',
            velocityX: -6, gravity: 0, lerpSpeed: 0.1,
            poolSize: 8, autoRecycle: true, lifetime: 0,
            events: { onCollision: 'GameOver' },
            style: { backgroundColor: '#f87171', borderColor: '#991b1b', borderWidth: 1 }
        }),
        // Spawner
        obj({
            className: 'TSpawner', id: 'obstacle_spawner', name: 'ObstacleSpawner',
            x: 0, y: 0, width: 4, height: 2,
            templateName: 'ObstacleTemplate', enabled: true,
            spawnInterval: 1.8, spawnX: 70, spawnYMin: 28, spawnYMax: 33,
            spawnCountStart: 0, randomizeY: true, recycleOffScreen: true,
            velocityX: -6,
            isHiddenInRun: true,
            style: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.6)', borderWidth: 1, color: '#34d399' }
        }),
        // Score-Timer
        obj({
            className: 'TIntervalTimer', id: 'score_timer', name: 'ScoreTimer',
            isService: true, isHiddenInRun: true, x: 40, y: 2, width: 4, height: 2,
            duration: 1000, count: 0, enabled: false,
            events: { onIntervall: 'IncrementScore' },
            style: { color: '#ffffff', backgroundColor: '#ff9800', borderColor: '#e65100', borderWidth: 2 }
        }),
        // Score-Anzeige
        obj({
            className: 'TNumberLabel', id: 'score_label', name: 'ScoreLabel',
            x: 2, y: 2, width: 6, height: 2,
            startValue: 0, value: 0, maxValue: null, step: 1,
            style: { color: '#ffffff', backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0, fontSize: 20, fontWeight: 'bold' }
        }),
        // Game Over Text
        obj({
            className: 'TLabel', id: 'gameover_label', name: 'GameOverLabel',
            x: 24, y: 18, width: 16, height: 4, visible: false, zIndex: 100,
            text: 'GAME OVER - ENTER zum Neustart',
            style: { color: '#f87171', backgroundColor: 'rgba(0,0,0,0.5)', borderColor: 'transparent', borderWidth: 0, fontSize: 20, fontWeight: 'bold', textAlign: 'center' }
        }),
        // Eingabe
        obj({
            className: 'TInputController', id: 'input_controller', name: 'InputController',
            isService: true, isHiddenInRun: true, x: 0, y: 0, width: 7, height: 2,
            events: { onKeyDown_Space: 'PlayerJump', onKeyDown_Enter: 'RestartGame' },
            enabled: true,
            style: { color: '#ffffff', backgroundColor: '#9c27b0', borderColor: '#6a1b9a', borderWidth: 2 }
        })
    ],
    actions: [
        action('act_start_game', 'Act_StartGame', 'property', {
            changes: {
                'GameState.spritesMoving': true,
                'GameState.collisionsEnabled': true,
                'ScoreTimer.enabled': true,
                'GameOverLabel.visible': false,
                'Speedlines.visible': false,
                'ScoreLabel.value': 0,
                'Player.x': 10,
                'Player.y': 34,
                'Player.velocityX': 0,
                'Player.velocityY': 0
            }
        }),
        action('act_player_jump', 'Act_PlayerJump', 'property', {
            changes: { 'Player.velocityY': -10 }
        }),
        action('act_player_land', 'Act_PlayerLand', 'property', {
            changes: { 'Player.velocityY': 0 }
        }),
        action('act_shake_screen', 'Act_ShakeScreen', 'shake_screen', {
            intensity: 'heavy', duration: 400
        }),
        action('act_stop_game', 'Act_StopGame', 'property', {
            changes: {
                'GameState.spritesMoving': false,
                'GameState.collisionsEnabled': false,
                'ScoreTimer.enabled': false,
                'Speedlines.visible': false
            }
        }),
        action('act_show_gameover', 'Act_ShowGameOver', 'property', {
            changes: { 'GameOverLabel.visible': true }
        }),
        action('act_restart_game', 'Act_RestartGame', 'navigate_stage', {
            stageId: 'main', reset: true
        }),
        action('act_increment_score', 'Act_IncrementScore', 'call_method', {
            target: 'ScoreLabel', method: 'incValue', params: []
        })
    ],
    tasks: [
        {
            name: 'StartGame', description: 'Initialisiert und startet das Spiel',
            actionSequence: [{ name: 'Act_StartGame', type: 'action', layout: 'horizontal' }],
            triggerMode: 'local-sync', params: [], flowLayout: {}
        },
        {
            name: 'PlayerJump', description: 'Lässt den Spieler springen',
            actionSequence: [{ name: 'Act_PlayerJump', type: 'action', layout: 'horizontal' }],
            triggerMode: 'local-sync', params: [], flowLayout: {}
        },
        {
            name: 'PlayerLand', description: 'Stoppt vertikale Geschwindigkeit beim Aufkommen',
            actionSequence: [{ name: 'Act_PlayerLand', type: 'action', layout: 'horizontal' }],
            triggerMode: 'local-sync', params: [], flowLayout: {}
        },
        {
            name: 'GameOver', description: 'Beendet das Spiel und zeigt Game Over',
            actionSequence: [
                { name: 'Act_ShakeScreen', type: 'action', layout: 'horizontal' },
                { name: 'Act_StopGame', type: 'action', layout: 'horizontal' },
                { name: 'Act_ShowGameOver', type: 'action', layout: 'horizontal' }
            ],
            triggerMode: 'local-sync', params: [], flowLayout: {}
        },
        {
            name: 'RestartGame', description: 'Startet das Spiel neu',
            actionSequence: [{ name: 'Act_RestartGame', type: 'action', layout: 'horizontal' }],
            triggerMode: 'local-sync', params: [], flowLayout: {}
        },
        {
            name: 'IncrementScore', description: 'Erhöht den Score um eins',
            actionSequence: [{ name: 'Act_IncrementScore', type: 'action', layout: 'horizontal' }],
            triggerMode: 'local-sync', params: [], flowLayout: {}
        }
    ],
    variables: [],
    grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#1a1a2e' },
    flowCharts: {},
    _supportedEvents: ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave', 'onDragStart', 'onDragEnd', 'onDrop', 'onTouchStart', 'onTouchMove', 'onTouchEnd']
};

project.stages.push(blueprint, mainStage);

const dir = path.dirname(outFile);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(project, null, 2));
console.log(`JumpAndRunDemo erstellt: ${outFile}`);
