import { TPropertyDef } from './TComponent';
import { TWindow } from './TWindow';

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover' | 'won';

export class TGameState extends TWindow {
    public state: GameState = 'menu';
    public spritesMoving: boolean = false;
    public collisionsEnabled: boolean = false;

    // Spielstand-Properties (NEU – Gap-Report)
    public score: number = 0;
    public level: number = 1;
    public lives: number = 3;
    public maxLives: number = 3;

    constructor(name: string, x: number = 0, y: number = 0) {
        super(name, x, y, 4, 2);
        this.isVariable = true;
        this.style.backgroundColor = '#4caf50';
        this.style.color = '#ffffff';
        this.style.visible = true; // Visible by default as requested

        // Visibility & Scoping Meta-Flags
        this.isService = true;
        this.isHiddenInRun = true;
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'state', label: 'Initial State', type: 'select', group: 'Game State', options: ['menu', 'playing', 'paused', 'gameover', 'won'] },
            { name: 'spritesMoving', label: 'Sprites Moving', type: 'boolean', group: 'Game State' },
            { name: 'collisionsEnabled', label: 'Collisions Enabled', type: 'boolean', group: 'Game State' },
            { name: 'score', label: 'Punkte', type: 'number', group: 'Spielstand' },
            { name: 'level', label: 'Level', type: 'number', group: 'Spielstand' },
            { name: 'lives', label: 'Leben', type: 'number', group: 'Spielstand' },
            { name: 'maxLives', label: 'Max. Leben', type: 'number', group: 'Spielstand' }
        ];
    }

    public getEvents(): string[] {
        return [
            'onStateChanged',
            'onGameOver',
            'onLifeLost',
            'onScoreChanged'
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            score: this.score,
            level: this.level,
            lives: this.lives,
            maxLives: this.maxLives
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TGameState', (objData: any) => new TGameState(objData.name, objData.x, objData.y));
