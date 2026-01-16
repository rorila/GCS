
import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

export class TGameState extends TWindow {
    public state: GameState = 'menu';
    public spritesMoving: boolean = false;
    public collisionsEnabled: boolean = false;

    constructor(name: string, x: number = 0, y: number = 0) {
        super(name, x, y, 100, 40);
        this.style.backgroundColor = '#4caf50';
        this.style.color = '#ffffff';
        this.style.visible = true; // Visible by default as requested
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'state', label: 'Initial State', type: 'select', group: 'Game State', options: ['menu', 'playing', 'paused', 'gameover'] },
            { name: 'spritesMoving', label: 'Sprites Moving', type: 'boolean', group: 'Game State' },
            { name: 'collisionsEnabled', label: 'Collisions Enabled', type: 'boolean', group: 'Game State' }
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            state: this.state,
            spritesMoving: this.spritesMoving,
            collisionsEnabled: this.collisionsEnabled
        };
    }
}
