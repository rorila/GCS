import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { StageDefinition } from '../model/types';
import { Logger } from '../utils/Logger';

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
    private static logger = Logger.get('TStageController', 'Stage_Management');
    // Referenz auf das Projekt (wird von GameRuntime gesetzt)
    private _stages: StageDefinition[] = [];
    private _currentStageId: string = '';
    private _mainStageId: string = 'main';

    // Callback für Stage-Wechsel (wird von GameRuntime registriert)
    private _onStageChangeCallback: ((oldStageId: string, newStageId: string, newStageObjects: any[]) => void) | null = null;

    constructor(name: string = 'StageController', x: number = 0, y: number = 0) {
        super(name, x, y, 5, 2);  // Breite: 5, Höhe: 2 (Grid-Einheiten)
        this.style.backgroundColor = '#9c27b0';  // Lila für Stage-Controller
        this.style.color = '#ffffff';
        this.visible = true;

        // Visibility & Scoping Meta-Flags
        this.isService = true;
        this.isHiddenInRun = true;
    }

    // ─────────────────────────────────────────────
    // Properties (Nur-Lesen im Inspector)
    // ─────────────────────────────────────────────

    get currentStageId(): string {
        return this._currentStageId;
    }

    get currentStageIndex(): number {
        return this._stages.findIndex(s => s.id === this._currentStageId);
    }

    get stageCount(): number {
        return this._stages.length;
    }

    get mainStageId(): string {
        return this._mainStageId;
    }

    get currentStageName(): string {
        const stage = this._stages.find(s => s.id === this._currentStageId);
        return stage?.name || '';
    }

    get currentStageType(): string {
        const stage = this._stages.find(s => s.id === this._currentStageId);
        return stage?.type || 'standard';
    }

    get isOnMainStage(): boolean {
        return this._currentStageId === this._mainStageId;
    }

    get isOnSplashStage(): boolean {
        const stage = this._stages.find(s => s.id === this._currentStageId);
        return stage?.type === 'splash';
    }

    /**
     * Gibt die Objekte der aktuellen Stage zurück
     */
    public getCurrentStageObjects(): any[] {
        const stage = this._stages.find(s => s.id === this._currentStageId);
        return stage?.objects || [];
    }

    /**
     * Registriert einen Callback für Stage-Wechsel
     */
    public setOnStageChangeCallback(cb: (oldId: string, newId: string, objects: any[]) => void): void {
        this._onStageChangeCallback = cb;
    }

    // ─────────────────────────────────────────────
    // Initialisierung (von GameRuntime aufgerufen)
    // ─────────────────────────────────────────────

    /**
     * Setzt die Stages-Liste und initialisiert den Controller
     */
    public setStages(stages: StageDefinition[]): void {
        this._stages = stages;

        // MainStage finden
        const mainStage = stages.find(s => s.type === 'main');
        if (mainStage) {
            this._mainStageId = mainStage.id;
        } else {
            // Fallback: Erste Standard-Stage als Main
            const standardStage = stages.find(s => s.type === 'standard');
            if (standardStage) {
                this._mainStageId = standardStage.id;
            }
        }

        // Start-Stage setzen (Splash wenn vorhanden, sonst Main)
        const splashStage = stages.find(s => s.type === 'splash');
        this._currentStageId = splashStage?.id || this._mainStageId;

        TStageController.logger.info(`Initialized with ${stages.length} stages. Starting at: ${this._currentStageId}`);
    }

    // ─────────────────────────────────────────────
    // Methoden (aufrufbar via call_method Action)
    // ─────────────────────────────────────────────

    /**
     * Wechselt zur nächsten Stage in der Reihenfolge
     */
    public nextStage(): void {
        const currentIndex = this.currentStageIndex;
        if (currentIndex < this._stages.length - 1) {
            const nextStage = this._stages[currentIndex + 1];
            this.goToStage(nextStage.id);
        } else {
            console.log('[TStageController] Already at last stage');
            this.triggerEvent('onAllStagesCompleted');
        }
    }

    /**
     * Wechselt zur vorherigen Stage
     */
    public previousStage(): void {
        const currentIndex = this.currentStageIndex;
        if (currentIndex > 0) {
            const prevStage = this._stages[currentIndex - 1];
            this.goToStage(prevStage.id);
        } else {
            console.log('[TStageController] Already at first stage');
        }
    }

    /**
     * Wechselt zu einer bestimmten Stage
     */
    public goToStage(stageId: string): void {
        const stage = this._stages.find(s => s.id === stageId);
        if (!stage) {
            console.warn(`[TStageController] Stage not found: ${stageId}`);
            return;
        }

        const oldStageId = this._currentStageId;
        this._currentStageId = stageId;

        TStageController.logger.info(`Switching from ${oldStageId} to ${stageId}`);

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
    public goToMainStage(): void {
        this.goToStage(this._mainStageId);
    }

    /**
     * Wechselt zur ersten Stage (Splash wenn vorhanden)
     */
    public goToFirstStage(): void {
        if (this._stages.length > 0) {
            this.goToStage(this._stages[0].id);
        }
    }

    /**
     * Prüft ob eine Stage existiert
     */
    public hasStage(stageId: string): boolean {
        return this._stages.some(s => s.id === stageId);
    }

    /**
     * Prüft ob ein Splashscreen existiert
     */
    public hasSplashStage(): boolean {
        return this._stages.some(s => s.type === 'splash');
    }

    /**
     * Prüft ob die HauptStage existiert
     */
    public hasMainStage(): boolean {
        return this._stages.some(s => s.type === 'main');
    }

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onStageChange',           // Wird bei jedem Stage-Wechsel ausgelöst
            'onAllStagesCompleted',    // Letzte Stage erreicht (für Level-Ende)
            'onSplashFinished'         // SplashStage abgeschlossen
        ];
    }

    private triggerEvent(eventName: string, data?: any): void {
        // Event wird von GameRuntime abgefangen
        (this as any).emit?.(eventName, data);
        TStageController.logger.debug(`Event triggered: ${eventName}`, data);
    }

    // ─────────────────────────────────────────────
    // Inspector Properties
    // ─────────────────────────────────────────────

    public getInspectorProperties(): TPropertyDef[] {
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

    public toJSON(): any {
        return {
            ...super.toJSON()
            // Stages werden nicht hier gespeichert, sondern im project.stages Array
        };
    }
}
