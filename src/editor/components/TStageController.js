import { TWindow } from './TWindow';
/**
 * TStageController - Zentrale Komponente für Stage-Verwaltung
 *
 * Verhält sich wie TGameState, TInputController etc.
 * Kann im Editor platziert und im Flow-Editor gesteuert werden.
 *
 * Konzept:
 * - Es gibt genau EINE HauptStage (type: 'main') mit Meta-Properties (Name, Author, Description)
 * - Es kann beliebig viele Standard-Stages geben (type: 'standard')
 * - Es gibt maximal EINE SplashStage (type: 'splash')
 * - Reihenfolge: Splash → Main → Standard-Stages
 */
export class TStageController extends TWindow {
    constructor(name = 'StageController', x = 0, y = 0) {
        super(name, x, y, 5, 2); // Breite: 5, Höhe: 2 (Grid-Einheiten)
        // Referenz auf das Projekt (wird von GameRuntime gesetzt)
        this._stages = [];
        this._currentStageId = '';
        this._mainStageId = 'main';
        // Callback für Stage-Wechsel (wird von GameRuntime registriert)
        this._onStageChangeCallback = null;
        this.style.backgroundColor = '#9c27b0'; // Lila für Stage-Controller
        this.style.color = '#ffffff';
        this.visible = true;
    }
    // ─────────────────────────────────────────────
    // Properties (Nur-Lesen im Inspector)
    // ─────────────────────────────────────────────
    get currentStageId() {
        return this._currentStageId;
    }
    get currentStageIndex() {
        return this._stages.findIndex(s => s.id === this._currentStageId);
    }
    get stageCount() {
        return this._stages.length;
    }
    get mainStageId() {
        return this._mainStageId;
    }
    get currentStageName() {
        const stage = this._stages.find(s => s.id === this._currentStageId);
        return stage?.name || '';
    }
    get currentStageType() {
        const stage = this._stages.find(s => s.id === this._currentStageId);
        return stage?.type || 'standard';
    }
    get isOnMainStage() {
        return this._currentStageId === this._mainStageId;
    }
    get isOnSplashStage() {
        const stage = this._stages.find(s => s.id === this._currentStageId);
        return stage?.type === 'splash';
    }
    /**
     * Gibt die Objekte der aktuellen Stage zurück
     */
    getCurrentStageObjects() {
        const stage = this._stages.find(s => s.id === this._currentStageId);
        return stage?.objects || [];
    }
    /**
     * Registriert einen Callback für Stage-Wechsel
     */
    setOnStageChangeCallback(cb) {
        this._onStageChangeCallback = cb;
    }
    // ─────────────────────────────────────────────
    // Initialisierung (von GameRuntime aufgerufen)
    // ─────────────────────────────────────────────
    /**
     * Setzt die Stages-Liste und initialisiert den Controller
     */
    setStages(stages) {
        this._stages = stages;
        // MainStage finden
        const mainStage = stages.find(s => s.type === 'main');
        if (mainStage) {
            this._mainStageId = mainStage.id;
        }
        else {
            // Fallback: Erste Standard-Stage als Main
            const standardStage = stages.find(s => s.type === 'standard');
            if (standardStage) {
                this._mainStageId = standardStage.id;
            }
        }
        // Start-Stage setzen (Splash wenn vorhanden, sonst Main)
        const splashStage = stages.find(s => s.type === 'splash');
        this._currentStageId = splashStage?.id || this._mainStageId;
        console.log(`[TStageController] Initialized with ${stages.length} stages. Starting at: ${this._currentStageId}`);
    }
    // ─────────────────────────────────────────────
    // Methoden (aufrufbar via call_method Action)
    // ─────────────────────────────────────────────
    /**
     * Wechselt zur nächsten Stage in der Reihenfolge
     */
    nextStage() {
        const currentIndex = this.currentStageIndex;
        if (currentIndex < this._stages.length - 1) {
            const nextStage = this._stages[currentIndex + 1];
            this.goToStage(nextStage.id);
        }
        else {
            console.log('[TStageController] Already at last stage');
            this.triggerEvent('onAllStagesCompleted');
        }
    }
    /**
     * Wechselt zur vorherigen Stage
     */
    previousStage() {
        const currentIndex = this.currentStageIndex;
        if (currentIndex > 0) {
            const prevStage = this._stages[currentIndex - 1];
            this.goToStage(prevStage.id);
        }
        else {
            console.log('[TStageController] Already at first stage');
        }
    }
    /**
     * Wechselt zu einer bestimmten Stage
     */
    goToStage(stageId) {
        const stage = this._stages.find(s => s.id === stageId);
        if (!stage) {
            console.warn(`[TStageController] Stage not found: ${stageId}`);
            return;
        }
        const oldStageId = this._currentStageId;
        this._currentStageId = stageId;
        console.log(`[TStageController] Switching from ${oldStageId} to ${stageId}`);
        // Callback mit neuen Objekten aufrufen
        if (this._onStageChangeCallback) {
            this._onStageChangeCallback(oldStageId, stageId, stage.objects || []);
        }
        this.triggerEvent('onStageChange', {
            oldStageId,
            newStageId: stageId,
            stageName: stage.name,
            stageType: stage.type
        });
    }
    /**
     * Wechselt zur HauptStage
     */
    goToMainStage() {
        this.goToStage(this._mainStageId);
    }
    /**
     * Wechselt zur ersten Stage (Splash wenn vorhanden)
     */
    goToFirstStage() {
        if (this._stages.length > 0) {
            this.goToStage(this._stages[0].id);
        }
    }
    /**
     * Prüft ob eine Stage existiert
     */
    hasStage(stageId) {
        return this._stages.some(s => s.id === stageId);
    }
    /**
     * Prüft ob ein Splashscreen existiert
     */
    hasSplashStage() {
        return this._stages.some(s => s.type === 'splash');
    }
    /**
     * Prüft ob die HauptStage existiert
     */
    hasMainStage() {
        return this._stages.some(s => s.type === 'main');
    }
    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────
    getEvents() {
        return [
            ...super.getEvents(),
            'onStageChange', // Wird bei jedem Stage-Wechsel ausgelöst
            'onAllStagesCompleted', // Letzte Stage erreicht (für Level-Ende)
            'onSplashFinished' // SplashStage abgeschlossen
        ];
    }
    triggerEvent(eventName, data) {
        // Event wird von GameRuntime abgefangen
        this.emit?.(eventName, data);
        console.log(`[TStageController] Event: ${eventName}`, data);
    }
    // ─────────────────────────────────────────────
    // Inspector Properties
    // ─────────────────────────────────────────────
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            // Nur-Lesen Properties (disabled im Inspector)
            { name: 'currentStageId', label: 'Current Stage ID', type: 'string', group: 'Stage Info' },
            { name: 'currentStageName', label: 'Current Stage Name', type: 'string', group: 'Stage Info' },
            { name: 'currentStageType', label: 'Current Stage Type', type: 'string', group: 'Stage Info' },
            { name: 'stageCount', label: 'Total Stages', type: 'number', group: 'Stage Info' },
            { name: 'isOnMainStage', label: 'Is Main Stage', type: 'boolean', group: 'Stage Info' },
            { name: 'isOnSplashStage', label: 'Is Splash Stage', type: 'boolean', group: 'Stage Info' }
        ];
    }
    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────
    toJSON() {
        return {
            ...super.toJSON()
            // Stages werden nicht hier gespeichert, sondern im project.stages Array
        };
    }
}
