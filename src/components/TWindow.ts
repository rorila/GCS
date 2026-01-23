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

    // Animation flag - wenn true, wird Physik pausiert
    public isAnimating: boolean = false;

    public toJSON(): any {
        return {
            ...super.toJSON(),
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            zIndex: this.zIndex,
            visible: this.visible,
            align: this._align,
            style: { ...this.style },
            Tasks: this.Tasks
        };
    }

    constructor(name: string, x: number, y: number, width: number, height: number) {
        super(name);
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.zIndex = 0;
        this._align = 'NONE';
        this.visible = true;
        this.style = {
            visible: true,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0
        };
    }

    private _caption: string = "";

    get caption(): string {
        return this._caption;
    }

    set caption(v: string) {
        this._caption = v;
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
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'x', label: 'X', type: 'number', group: 'Geometry' },
            { name: 'y', label: 'Y', type: 'number', group: 'Geometry' },
            { name: 'width', label: 'Width', type: 'number', group: 'Geometry' },
            { name: 'height', label: 'Height', type: 'number', group: 'Geometry' },
            { name: 'zIndex', label: 'Z-Index', type: 'number', group: 'Geometry' },
            { name: 'align', label: 'Align', type: 'select', group: 'Geometry', options: ['NONE', 'TOP', 'BOTTOM', 'LEFT', 'RIGHT', 'CLIENT'] },
            // Removed duplicate style.visible to reduce confusion. Use root 'visible' instead.
            { name: 'visible', label: 'Visible', type: 'boolean', group: 'Identity' }, // Added root visible
            { name: 'style.backgroundColor', label: 'Background', type: 'color', group: 'Style' },
            { name: 'style.borderColor', label: 'Border Color', type: 'color', group: 'Style' },
            { name: 'style.borderWidth', label: 'Border Width', type: 'number', group: 'Style' }
        ];
    }
}
