import { TComponent, TPropertyDef } from './TComponent';
import { AnimationManager } from '../runtime/AnimationManager';

export type TAlign = 'NONE' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'CLIENT';

export interface ComponentStyle {
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    color?: string; // Text color often used generally
    visible?: boolean;
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: string;
    fontFamily?: string;
    borderRadius?: number;
}

export class TWindow extends TComponent {
    public x: number;
    public y: number;
    public width: number;
    public height: number;
    public zIndex: number;
    private _align: TAlign = 'NONE';
    public style: ComponentStyle;

    // Focus event callbacks (available to all components)
    private onFocusCallback: (() => void) | null = null;
    private onBlurCallback: (() => void) | null = null;

    // Align property with position enforcement
    get align(): TAlign {
        return this._align;
    }

    set align(value: TAlign) {
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

    public visible: boolean = true;
    public text: string = "";

    // Animation flag - wenn true, wird Physik pausiert
    public isAnimating: boolean = false;


    constructor(name: string, x: number, y: number, width: number, height: number) {
        super(name);
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.zIndex = 0;
        this._align = 'NONE';
        this.visible = true;
        this.text = "";
        this.style = {
            // visible: true, // Do NOT force true here, let it be undefined so it falls back to this.visible
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0
        };
    }

    // Alias for backward compatibility (JSON loading)
    get caption(): string {
        return this.text;
    }

    set caption(v: string) {
        this.text = v;
    }

    // Focus event methods
    public triggerFocus(): void {
        if (this.onFocusCallback) {
            this.onFocusCallback();
        }
    }

    public triggerBlur(): void {
        if (this.onBlurCallback) {
            this.onBlurCallback();
        }
    }

    public setOnFocus(callback: () => void): void {
        this.onFocusCallback = callback;
    }

    public setOnBlur(callback: () => void): void {
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
    public moveTo(
        x: number,
        y: number,
        duration: number = 500,
        easing: string = 'easeOut',
        onComplete?: () => void
    ): void {
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
    public getEvents(): string[] {
        return ['onClick', 'onFocus', 'onBlur', 'onDragStart', 'onDragEnd', 'onDrop'];
    }

    public getInspectorProperties(): TPropertyDef[] {
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
            { name: 'style.visible', label: 'Style Sichtbar', type: 'boolean', group: 'STIL', editorOnly: true },
            { name: 'style.backgroundColor', label: 'Hintergrund', type: 'color', group: 'STIL' },
            { name: 'style.borderColor', label: 'Rahmenfarbe', type: 'color', group: 'STIL' },
            { name: 'style.borderWidth', label: 'Rahmenbreite', type: 'number', group: 'STIL' },
            { name: 'style.borderRadius', label: 'Abrundung', type: 'number', group: 'STIL' }
        ];
    }
}
