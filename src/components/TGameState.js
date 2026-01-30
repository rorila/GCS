import { TWindow } from './TWindow';
export class TGameState extends TWindow {
    constructor(name, x = 0, y = 0) {
        super(name, x, y, 100, 40);
        this.state = 'menu';
        this.spritesMoving = false;
        this.collisionsEnabled = false;
        this.isVariable = true;
        this.style.backgroundColor = '#4caf50';
        this.style.color = '#ffffff';
        this.style.visible = true; // Visible by default as requested
    }
    getInspectorProperties() {
        return [
            ...super.getInspectorProperties(),
            { name: 'state', label: 'Initial State', type: 'select', group: 'Game State', options: ['menu', 'playing', 'paused', 'gameover'] },
            { name: 'spritesMoving', label: 'Sprites Moving', type: 'boolean', group: 'Game State' },
            { name: 'collisionsEnabled', label: 'Collisions Enabled', type: 'boolean', group: 'Game State' }
        ];
    }
    toJSON() {
        return super.toJSON();
    }
}
