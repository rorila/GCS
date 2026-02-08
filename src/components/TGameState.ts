import { TPropertyDef } from './TComponent';
import { TWindow } from './TWindow';

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

export class TGameState extends TWindow {
    public state: GameState = 'menu';
    public spritesMoving: boolean = false;
    public collisionsEnabled: boolean = false;

    constructor(name: string, x: number = 0, y: number = 0) {
        super(name, x, y, 100, 40);
        this.isVariable = true;
        this.style.backgroundColor = '#4caf50';
        this.style.color = '#ffffff';
        this.style.visible = true; // Visible by default as requested

        // Visibility & Scoping Meta-Flags
        this.isService = true;
        this.isHiddenInRun = true;
        this.isBlueprintOnly = true;
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'state', label: 'Initial State', type: 'select', group: 'Game State', options: ['menu', 'playing', 'paused', 'gameover'] },
            { name: 'spritesMoving', label: 'Sprites Moving', type: 'boolean', group: 'Game State' },
            { name: 'collisionsEnabled', label: 'Collisions Enabled', type: 'boolean', group: 'Game State' }
        ];
    }

    public toJSON(): any {
        return super.toJSON();
    }
}
