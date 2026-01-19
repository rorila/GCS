import { TStage } from './TStage';
import { TPropertyDef } from './TComponent';

/**
 * TSplashStage - Spezielle Stage für Intro/Splash-Bildschirme
 * 
 * Erbt von TStage, hat aber zusätzliche Splash-spezifische Eigenschaften:
 * - duration: Anzeigedauer in ms
 * - autoHide: Automatisch zur nächsten Stage wechseln
 * - onFinish Event für den Stage-Wechsel
 * 
 * Für Videos: TVideo als Kind-Objekt auf der SplashStage platzieren.
 */
export class TSplashStage extends TStage {
    private _duration: number = 3000;
    private _autoHide: boolean = true;

    constructor(
        name: string = 'SplashStage',
        x: number = 0,
        y: number = 0,
        cols: number = 32,
        rows: number = 24,
        cellSize: number = 20
    ) {
        super(name, x, y, cols, rows, cellSize);

        // Default Splash Style - dunkler Hintergrund
        this.style.backgroundColor = '#000000';
    }

    // ─────────────────────────────────────────────
    // Splash-spezifische Properties
    // ─────────────────────────────────────────────

    get duration(): number {
        return this._duration;
    }

    set duration(value: number) {
        this._duration = Math.max(0, value);
    }

    get autoHide(): boolean {
        return this._autoHide;
    }

    set autoHide(value: boolean) {
        this._autoHide = value;
    }

    // ─────────────────────────────────────────────
    // Inspector Properties (überschreibt TStage)
    // ─────────────────────────────────────────────

    public getInspectorProperties(): TPropertyDef[] {
        // Hole alle Properties von TStage
        const parentProps = super.getInspectorProperties();

        // Filtere Meta-Properties aus, die für Splash nicht relevant sind
        // (name, x, y sind in TWindow und bleiben erhalten)
        const filteredProps = parentProps.filter(p =>
            !['description'].includes(p.name)
        );

        // Füge Splash-spezifische Properties hinzu
        return [
            ...filteredProps,
            { name: 'duration', label: 'Duration (ms)', type: 'number', group: 'Splash' },
            { name: 'autoHide', label: 'Auto Hide', type: 'boolean', group: 'Splash' }
        ];
    }

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onFinish'  // Wird ausgelöst wenn Splash-Duration abgelaufen ist
        ];
    }

    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────

    public toJSON(): any {
        return {
            ...super.toJSON(),
            duration: this._duration,
            autoHide: this._autoHide
        };
    }
}
