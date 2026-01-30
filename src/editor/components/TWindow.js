import { TComponent } from './TComponent';
import { AnimationManager } from '../runtime/AnimationManager';
export class TWindow extends TComponent {
    // Align property with position enforcement
    get align() {
        return this._align;
    }
    set align(value) {
        this._align = value;
        // Enforce position based on alignment
        if (value === 'TOP') {
            this.y = 0;
        }
        // Note: BOTTOM alignment would need stage height, which isn't available here
        // LEFT would set x = 0, RIGHT would need stage width
        if (value === 'LEFT') {
            this.x = 0;
        }
    }
    constructor(name, x, y, width, height) {
        super(name);
        this._align = 'NONE';
        // Focus event callbacks (available to all components)
        this.onFocusCallback = null;
        this.onBlurCallback = null;
        this.visible = true;
        this.text = "";
        // Animation flag - wenn true, wird Physik pausiert
        this.isAnimating = false;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.zIndex = 0;
        this._align = 'NONE';
        this.visible = true;
        this.text = "";
        this.style = {
            visible: true,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0
        };
    }
    // Alias for backward compatibility (JSON loading)
    get caption() {
        return this.text;
    }
    set caption(v) {
        this.text = v;
    }
    // Focus event methods
    triggerFocus() {
        if (this.onFocusCallback) {
            this.onFocusCallback();
        }
    }
    triggerBlur() {
        if (this.onBlurCallback) {
            this.onBlurCallback();
        }
    }
    setOnFocus(callback) {
        this.onFocusCallback = callback;
    }
    setOnBlur(callback) {
        this.onBlurCallback = callback;
    }
    /**
     * Bewegt das Objekt animiert zu einer neuen Position.
     * @param x Ziel-X-Koordinate
     * @param y Ziel-Y-Koordinate
     * @param duration Dauer in Millisekunden (default: 500)
     * @param easing Easing-Funktion (default: 'easeOut')
     * @param onComplete Optionaler Callback nach Abschluss
     */
    moveTo(x, y, duration = 500, easing = 'easeOut', onComplete) {
        console.log(`[TWindow.moveTo] Called on "${this.name}": from (${this.x}, ${this.y}) to (${x}, ${y}), duration=${duration}ms, easing=${easing}`);
        const manager = AnimationManager.getInstance();
        console.log(`[TWindow.moveTo] AnimationManager instance obtained, activeTweens=${manager.getActiveTweenCount()}`);
        const tweenX = manager.addTween(this, 'x', x, duration, easing);
        console.log(`[TWindow.moveTo] Added X tween: from=${tweenX.from} to=${tweenX.to}`);
        const tweenY = manager.addTween(this, 'y', y, duration, easing, onComplete);
        console.log(`[TWindow.moveTo] Added Y tween: from=${tweenY.from} to=${tweenY.to}`);
        console.log(`[TWindow.moveTo] After adding tweens, activeTweens=${manager.getActiveTweenCount()}`);
    }
    /**
     * Get available events for this component
     * Override in subclasses to add more events
     */
    getEvents() {
        return ['onClick', 'onFocus', 'onBlur', 'onDragStart', 'onDragEnd', 'onDrop'];
    }
    getInspectorProperties() {
        return [
            ...this.getBaseProperties(),
            { name: 'x', label: 'X Position', type: 'number', group: 'GEOMETRIE' },
            { name: 'y', label: 'Y Position', type: 'number', group: 'GEOMETRIE' },
            { name: 'width', label: 'Breite', type: 'number', group: 'GEOMETRIE' },
            { name: 'height', label: 'Höhe', type: 'number', group: 'GEOMETRIE' },
            { name: 'zIndex', label: 'Z-Index', type: 'number', group: 'GEOMETRIE' },
            { name: 'align', label: 'Ausrichtung', type: 'select', group: 'GEOMETRIE', options: ['NONE', 'TOP', 'BOTTOM', 'LEFT', 'RIGHT', 'CLIENT'] },
            { name: 'text', label: 'Text', type: 'string', group: 'INHALT' },
            { name: 'visible', label: 'Sichtbar', type: 'boolean', group: 'IDENTITÄT' },
            { name: 'style.backgroundColor', label: 'Hintergrund', type: 'color', group: 'STIL' },
            { name: 'style.borderColor', label: 'Rahmenfarbe', type: 'color', group: 'STIL' },
            { name: 'style.borderWidth', label: 'Rahmenbreite', type: 'number', group: 'STIL' }
        ];
    }
}
