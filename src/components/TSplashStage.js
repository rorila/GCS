import { TStage } from './TStage';
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
    constructor(name = 'SplashStage', x = 0, y = 0, cols = 32, rows = 24, cellSize = 20) {
        super(name, x, y, cols, rows, cellSize);
        this._duration = 3000;
        this._autoHide = true;
        // Default Splash Style - dunkler Hintergrund
        this.style.backgroundColor = '#000000';
    }
    // ─────────────────────────────────────────────
    // Splash-spezifische Properties
    // ─────────────────────────────────────────────
    get duration() {
        return this._duration;
    }
    set duration(value) {
        this._duration = Math.max(0, value);
    }
    get autoHide() {
        return this._autoHide;
    }
    set autoHide(value) {
        this._autoHide = value;
    }
    // ─────────────────────────────────────────────
    // Inspector Properties (überschreibt TStage)
    // ─────────────────────────────────────────────
    getInspectorProperties() {
        // Hole alle Properties von TStage
        const parentProps = super.getInspectorProperties();
        // Filtere Meta-Properties aus, die für Splash nicht relevant sind
        // (name, x, y sind in TWindow und bleiben erhalten)
        const filteredProps = parentProps.filter(p => !['description'].includes(p.name));
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
    getEvents() {
        return [
            ...super.getEvents(),
            'onFinish' // Wird ausgelöst wenn Splash-Duration abgelaufen ist
        ];
    }
    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────
    toJSON() {
        return {
            ...super.toJSON(),
            duration: this._duration,
            autoHide: this._autoHide
        };
    }
}
