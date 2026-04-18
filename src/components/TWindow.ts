import { TComponent, TPropertyDef } from './TComponent';
import { AnimationManager } from '../runtime/AnimationManager';
import { Logger } from '../utils/Logger';
import { coreStore } from '../services/registry/CoreStore';

const logger = Logger.get('TWindow');

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

        // Grid-Dimensionen: Über lokale Properties oder Defaults
        const stageCols = (this as any)._gridCols || 64;
        const stageRows = (this as any)._gridRows || 40;

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

    private _winVisible: boolean = true;
    
    get visible(): boolean {
        return this._winVisible;
    }
    
    set visible(v: boolean) {
        if (this._winVisible !== v) {
            this._winVisible = v;
            this.onVisibilityChanged(v);
        }
    }
    
    /**
     * Hook that subclasses can override to react to visibility changes
     */
    protected onVisibilityChanged(v: boolean): void {
        // standard implementation might do nothing, subclasses override
    }

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
        this._winVisible = true;
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
        logger.info(`[TWindow.moveTo] Called on "${this.name}": from (${this.x}, ${this.y}) to (${x}, ${y}), duration=${duration}ms, easing=${easing}`);

        const manager = AnimationManager.getInstance();
        logger.info(`[TWindow.moveTo] AnimationManager instance obtained, activeTweens=${manager.getActiveTweenCount()}`);

        const tweenX = manager.addTween(this, 'x', x, duration, easing);
        logger.info(`[TWindow.moveTo] Added X tween: from=${tweenX.from} to=${tweenX.to}`);

        const tweenY = manager.addTween(this, 'y', y, duration, easing, onComplete);
        logger.info(`[TWindow.moveTo] Added Y tween: from=${tweenY.from} to=${tweenY.to}`);

        logger.info(`[TWindow.moveTo] After adding tweens, activeTweens=${manager.getActiveTweenCount()}`);
    }

    /**
     * Get available events for this component
     * Override in subclasses to add more events
     */
    public getEvents(): string[] {
        // Nicht-sichtbare Komponenten (isHiddenInRun) können zur Laufzeit nicht
        // angeklickt/fokussiert/gedraggt werden → UI-Events ausblenden
        if (this.isHiddenInRun) {
            return [];
        }
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

    /**
     * Berechnet dynamische min/max Constraints für Geometrie-Properties
     * basierend auf der aktuellen Stage-GridConfig.
     * Regel: Komponente muss vollständig auf der Stage liegen.
     *   x >= 0, y >= 0, x + width <= cols, y + height <= rows
     */
    private getGeometryConstraints(): { xMax: number; yMax: number; wMax: number; hMax: number; cols: number; rows: number } {
        // Stage-Grid ermitteln: aktive Stage → per-Stage Grid → Projekt-Global Grid → Defaults
        const project = coreStore.getProject();
        const activeStage = coreStore.getActiveStage();
        const grid = activeStage?.grid || project?.stage?.grid || { cols: 64, rows: 40 };
        const cols = grid.cols;
        const rows = grid.rows;

        return {
            xMax: Math.max(0, cols - (this.width || 1)),
            yMax: Math.max(0, rows - (this.height || 1)),
            wMax: Math.max(1, cols - (this.x || 0)),
            hMax: Math.max(1, rows - (this.y || 0)),
            cols,
            rows
        };
    }

    public getInspectorProperties(): TPropertyDef[] {
        const gc = this.getGeometryConstraints();

        return [
            ...this.getBaseProperties(),
            { name: 'visible', label: 'Sichtbar', type: 'boolean', group: 'IDENTITÄT' },
            { name: 'x', label: 'X', type: 'number', group: 'GEOMETRIE', min: 0, max: gc.xMax, step: 1, inline: true, hint: `Stage: ${gc.cols}×${gc.rows} Zellen` },
            { name: 'y', label: 'Y', type: 'number', group: 'GEOMETRIE', min: 0, max: gc.yMax, step: 1, inline: true, hint: `Stage: ${gc.cols}×${gc.rows} Zellen` },
            { name: 'width', label: 'Breite', type: 'number', group: 'GEOMETRIE', min: 1, max: gc.wMax, step: 1, inline: true },
            { name: 'height', label: 'Höhe', type: 'number', group: 'GEOMETRIE', min: 1, max: gc.hMax, step: 1, inline: true },
            { name: 'zIndex', label: 'Z-Index', type: 'number', group: 'GEOMETRIE', min: 0, max: 9999, step: 1, inline: true },
            { name: 'align', label: 'Ausrichtung', type: 'select', group: 'GEOMETRIE', options: ['NONE', 'TOP', 'BOTTOM', 'LEFT', 'RIGHT', 'CLIENT'], inline: true },
            { name: 'style.color', label: 'Textfarbe', type: 'color', group: 'TYPOGRAFIE' },
            { name: 'style.fontSize', label: 'Schriftgröße', type: 'number', group: 'TYPOGRAFIE', min: 6, max: 120, step: 1, inline: true },
            { name: 'style.fontFamily', label: 'Schriftart', type: 'select', group: 'TYPOGRAFIE', options: ['Arial', 'Segoe UI, Arial, sans-serif', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Tahoma', 'Trebuchet MS'] },
            { name: 'style.fontWeight', label: 'Fett', type: 'boolean', group: 'TYPOGRAFIE', inline: true },
            { name: 'style.fontStyle', label: 'Kursiv', type: 'boolean', group: 'TYPOGRAFIE', inline: true },
            { name: 'style.textAlign', label: 'Ausrichtung', type: 'select', group: 'TYPOGRAFIE', options: ['left', 'center', 'right'] },
            { name: 'style.backgroundColor', label: 'Hintergrund', type: 'color', group: 'STIL' },
            { name: 'style.borderColor', label: 'Rahmenfarbe', type: 'color', group: 'STIL' },
            { name: 'style.borderWidth', label: 'Rahmenbreite', type: 'number', group: 'STIL', min: 0, max: 20, step: 1 },
            { name: 'style.borderRadius', label: 'Abrundung', type: 'number', group: 'STIL', min: 0, max: 100, step: 1 },
            { name: 'style.opacity', label: 'Deckkraft', type: 'number', group: 'STIL', min: 0, max: 1, step: 0.1 },
            { name: 'style.glowColor', label: 'Glow Farbe', type: 'color', group: 'GLOW-EFFEKT' },
            { name: 'style.glowBlur', label: 'Glow Unschärfe', type: 'number', group: 'GLOW-EFFEKT', min: 0, max: 100, step: 1 },
            { name: 'style.glowSpread', label: 'Glow Ausbreitung', type: 'number', group: 'GLOW-EFFEKT', min: 0, max: 50, step: 1 },
            { name: 'style.boxShadow', label: 'Box-Shadow (CSS)', type: 'string', group: 'GLOW-EFFEKT' }
        ];
    }
}
