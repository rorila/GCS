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
    opacity?: number;
    boxShadow?: string;
    glowColor?: string;
    glowBlur?: number;
    glowSpread?: number;
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
        if (value === 'NONE') return;

        // Guard: Nicht feuern während Object.assign (resolveObjectPreview) oder Hydration.
        if (!(this as any)._initialized) return;

        // Stage-Grid-Dimensionen holen
        const ed = (window as any).editor;
        const grid = ed?.stage?.grid;
        if (!grid) return;

        const stageCols = grid.cols || 40;
        const stageRows = grid.rows || 30;

        if (value === 'TOP') {
            this.x = 0; this.y = 0; this.width = stageCols;
        } else if (value === 'BOTTOM') {
            this.x = 0; this.y = stageRows - (this.height || 2); this.width = stageCols;
        } else if (value === 'LEFT') {
            this.x = 0; this.y = 0; this.height = stageRows;
        } else if (value === 'RIGHT') {
            this.x = stageCols - (this.width || 4); this.y = 0; this.height = stageRows;
        } else if (value === 'CLIENT') {
            this.x = 0; this.y = 0; this.width = stageCols; this.height = stageRows;
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
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0
        };
        (this as any)._initialized = true; // Flag: Konstruktor abgeschlossen
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

    /**
     * Align-Änderungen erfordern einen vollständigen Inspector-Re-Render,
     * weil der Setter x/y/width/height beeinflusst.
     */
    public applyChange(propertyName: string, newValue: any, oldValue?: any): boolean {
        if (propertyName === 'align') return true;
        return super.applyChange(propertyName, newValue, oldValue);
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...this.getBaseProperties(),
            { name: 'visible', label: 'Sichtbar', type: 'boolean', group: 'IDENTITÄT' },
            { name: 'x', label: 'X', type: 'number', group: 'GEOMETRIE', inline: true },
            { name: 'y', label: 'Y', type: 'number', group: 'GEOMETRIE', inline: true },
            { name: 'width', label: 'Breite', type: 'number', group: 'GEOMETRIE', inline: true },
            { name: 'height', label: 'Höhe', type: 'number', group: 'GEOMETRIE', inline: true },
            { name: 'zIndex', label: 'Z-Index', type: 'number', group: 'GEOMETRIE', inline: true },
            { name: 'align', label: 'Ausrichtung', type: 'select', group: 'GEOMETRIE', options: ['NONE', 'TOP', 'BOTTOM', 'LEFT', 'RIGHT', 'CLIENT'], inline: true },
            { name: 'style.color', label: 'Textfarbe', type: 'color', group: 'TYPOGRAFIE' },
            { name: 'style.backgroundColor', label: 'Hintergrund', type: 'color', group: 'STIL' },
            { name: 'style.borderColor', label: 'Rahmenfarbe', type: 'color', group: 'STIL' },
            { name: 'style.borderWidth', label: 'Rahmenbreite', type: 'number', group: 'STIL', min: 0, step: 1 },
            { name: 'style.borderRadius', label: 'Abrundung', type: 'number', group: 'STIL', min: 0, step: 1 },
            { name: 'style.opacity', label: 'Deckkraft', type: 'number', group: 'STIL', min: 0, max: 1, step: 0.1 },
            { name: 'style.glowColor', label: 'Glow Farbe', type: 'color', group: 'GLOW-EFFEKT' },
            { name: 'style.glowBlur', label: 'Glow Unschärfe', type: 'number', group: 'GLOW-EFFEKT', min: 0, max: 100, step: 1 },
            { name: 'style.glowSpread', label: 'Glow Ausbreitung', type: 'number', group: 'GLOW-EFFEKT', min: 0, max: 50, step: 1 },
            { name: 'style.boxShadow', label: 'Box-Shadow (CSS)', type: 'string', group: 'GLOW-EFFEKT' }
        ];
    }
}
