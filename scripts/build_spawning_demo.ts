import fs from 'fs';
import path from 'path';
import { AgentController } from '../src/services/AgentController';
import { GameProject } from '../src/model/types';
import { projectRegistry } from '../src/services/ProjectRegistry';

// 1. Setup Base Project
const project: GameProject = {
    meta: { name: "Spawning Shooter Demo", version: "1.0", author: "Antigravity", description: "" },
    stages: [
        {
            id: 'blueprint',
            name: 'Blueprint (Global)',
            type: 'blueprint',
            objects: [],
            actions: [],
            tasks: [],
            variables: [],
            flowCharts: {},
            grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#f5f5f5' }
        },
        {
            id: 'stage-1',
            name: 'Spielfeld',
            type: 'standard',
            objects: [],
            actions: [],
            tasks: [],
            variables: [],
            flowCharts: {},
            grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#333333' }
        }
    ],
    activeStageId: 'stage-1',
    objects: [],
    actions: [],
    tasks: [],
    variables: []
} as any;

projectRegistry.setProject(project as any);
const agent = AgentController.getInstance();
agent.setProject(project as any);

// ==========================================
// 2. Blueprint Stage (Global)
// ==========================================
agent.addVariable('score', 'number', 0, 'global');

agent.addObject('blueprint', {
    id: 'game_loop', name: 'GameLoop', className: 'TGameLoop', x: 0, y: 0, isInherited: true
});

// ==========================================
// 3. Main Stage (Spielfeld)
// ==========================================

agent.addObject('stage-1', {
    id: 'bullet_template', name: 'BulletTemplate', className: 'TSpriteTemplate',
    x: 30, y: 15, width: 1, height: 1, spriteColor: '#ffff00', shape: 'circle',
    velocityY: -0.5, collisionEnabled: true, isInherited: false,
    poolSize: 20, autoRecycle: true, lifetime: 5,
    events: { onCollision: 'Kugel trifft Ziel', onBoundaryHit: 'DeleteBullet' }
});

agent.addObject('stage-1', {
    id: 'player_base', name: 'Player', className: 'TSprite',
    x: 30, y: 35, width: 4, height: 1, spriteColor: '#00ccff', collisionEnabled: false
});

agent.addObject('stage-1', {
    id: 'score_label', name: 'ScoreLabel', className: 'TLabel',
    x: 1, y: 1, width: 10, height: 2, text: 'Score: ${score}', color: '#ffffff'
});

agent.addObject('stage-1', {
    id: 'input_ctrl', name: 'InputController', className: 'TInputController', x: 0, y: 0,
    events: {
        'onKeyDown_ArrowLeft': 'Bewege Links',
        'onKeyDown_ArrowRight': 'Bewege Rechts',
        'onKeyUp_ArrowLeft': 'Stoppe Bewegung',
        'onKeyUp_ArrowRight': 'Stoppe Bewegung',
        'onKeyDown_Space': 'Schiessen',
        'onKeyDown_KeyX': 'Schiessen'
    }
});

agent.addObject('stage-1', {
    id: 'target_enemy', name: 'Target', className: 'TSprite',
    x: 5, y: 5, width: 4, height: 1, spriteColor: '#ff0044', velocityX: 0.2, collisionEnabled: true,
    events: { onBoundaryHit: 'Pruefe Rand' }
});

// ==========================================
// 4. Manuelles Anlegen der Actions auf Stage-1 (Umgehung des AgentController-Bugs!)
// ==========================================

const stage1Actions = project.stages![1].actions!;

stage1Actions.push({ name: 'Action_DestroyBullet', type: 'destroy_object', target: '%Self%' } as any);
stage1Actions.push({ name: 'Action_HideBullet', type: 'property', target: '%Self%', changes: { visible: false, velocityY: 0 } } as any);
stage1Actions.push({ name: 'Action_ScoreUp', type: 'calculate', resultVariable: 'score', expression: '${score} + 1' } as any);

stage1Actions.push({ name: 'Action_MoveRight', type: 'property', target: 'Player', changes: { velocityX: 1 } } as any);
stage1Actions.push({ name: 'Action_MoveLeft', type: 'property', target: 'Player', changes: { velocityX: -1 } } as any);
stage1Actions.push({ name: 'Action_StopMove', type: 'property', target: 'Player', changes: { velocityX: 0 } } as any);

stage1Actions.push({ name: 'Action_SpawnBullet', type: 'spawn_object', templateId: 'BulletTemplate', referenceObject: 'Player', offsetX: 1.5, offsetY: -1 } as any);

// Target Richtungs-Aktionen
stage1Actions.push({ name: 'Action_BounceL', type: 'property', target: 'Target', changes: { velocityX: -0.3 } } as any);
stage1Actions.push({ name: 'Action_BounceR', type: 'property', target: 'Target', changes: { velocityX: 0.3 } } as any);


// ==========================================
// 5. Tasks anlegen
// ==========================================

agent.createTask('stage-1', 'Kugel trifft Ziel');
const tKugel = project.stages![1].tasks!.find((t:any) => t.name === 'Kugel trifft Ziel')!;
tKugel.actionSequence.push({ type: 'action', name: 'Action_DestroyBullet' });
tKugel.actionSequence.push({ type: 'action', name: 'Action_ScoreUp' });

agent.createTask('stage-1', 'Bewege Rechts');
const tRight = project.stages![1].tasks!.find((t:any) => t.name === 'Bewege Rechts')!;
tRight.actionSequence.push({ type: 'action', name: 'Action_MoveRight' });

agent.createTask('stage-1', 'Bewege Links');
const tLeft = project.stages![1].tasks!.find((t:any) => t.name === 'Bewege Links')!;
tLeft.actionSequence.push({ type: 'action', name: 'Action_MoveLeft' });

agent.createTask('stage-1', 'Stoppe Bewegung');
const tStop = project.stages![1].tasks!.find((t:any) => t.name === 'Stoppe Bewegung')!;
tStop.actionSequence.push({ type: 'action', name: 'Action_StopMove' });

agent.createTask('stage-1', 'Schiessen');
const tShoot = project.stages![1].tasks!.find((t:any) => t.name === 'Schiessen')!;
tShoot.actionSequence.push({ type: 'action', name: 'Action_SpawnBullet' });

// Das Bullet Limit löscht die Kugel aus dem Speicher, blendet sie aber sicherheitshalber 
// SOFORT visuell aus (für den Fall, dass der Async-Renderer einen Frame stehen bleibt!)
agent.createTask('stage-1', 'DeleteBullet');
const tDelBul = project.stages![1].tasks!.find((t:any) => t.name === 'DeleteBullet')!;
tDelBul.actionSequence.push({
    type: 'condition',
    name: 'Prüfe ob oben berührt',
    condition: { variable: 'hitSide', operator: '==', value: 'top' },
    then: [
        { type: 'action', name: 'Action_HideBullet' },
        { type: 'action', name: 'Action_DestroyBullet' }
    ]
} as any);



// Richtungs-Task mit Condition auf die implizite Variable "hitSide"
agent.createTask('stage-1', 'Pruefe Rand');
const tPruefeRand = project.stages![1].tasks!.find((t:any) => t.name === 'Pruefe Rand')!;
tPruefeRand.actionSequence.push({ 
    type: 'condition', 
    condition: { variable: 'hitSide', operator: '==', value: 'left' },
    thenAction: 'Action_BounceR'
} as any);
tPruefeRand.actionSequence.push({ 
    type: 'condition', 
    condition: { variable: 'hitSide', operator: '==', value: 'right' },
    thenAction: 'Action_BounceL'
} as any);

// ==========================================
// 6. Serialize
// ==========================================
const outPath = path.resolve(process.cwd(), 'projects/SpawningDemo.json');
fs.writeFileSync(outPath, JSON.stringify(project, null, 2));

console.log('Successfully generated ' + outPath);
