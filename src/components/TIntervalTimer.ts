import { TWindow } from './TWindow';
import { TPropertyDef, IRuntimeComponent } from './TComponent';

/**
 * TIntervalTimer – Intervall-basierter Timer (Ersatz für TRepeater)
 * 
 * Feuert `onIntervall` bei jedem Durchlauf und `onTimeout` wenn
 * die konfigurierte Anzahl erreicht ist.
 * 
 * Verwendung:
 *   - duration (ms): Dauer eines Intervalls
 *   - count: Anzahl der Intervalle (0 = unendlich)
 *   - enabled: Ob der Timer beim Runtime-Start automatisch losläuft
 * 
 * Events:
 *   - onIntervall: Wird bei jedem abgelaufenen Intervall gefeuert
 *   - onTimeout:   Wird gefeuert wenn alle Intervalle durchlaufen sind (count erreicht)
 */
export class TIntervalTimer extends TWindow implements IRuntimeComponent {
    public className: string = 'TIntervalTimer';

    /** Dauer pro Intervall in Millisekunden */
    public duration: number = 1000;

    /** Anzahl der Intervalle (0 = unendlich) */
    public count: number = 0;

    /** Ob der Timer aktiv ist */
    public enabled: boolean = true;

    // Interner Zustand
    private timerId: number | null = null;
    private currentCount: number = 0;
    private onEventCallback: ((id: string, event: string, data?: any) => void) | null = null;

    constructor(name: string, x: number = 0, y: number = 0) {
        super(name, x, y, 4, 2);
        this.style.backgroundColor = '#ff9800';  // Orange (wie TRepeater)
        this.style.borderColor = '#e65100';
        this.style.borderWidth = 2;
        this.style.color = '#ffffff';

        // Visibility & Scoping Meta-Flags
        this.isService = true;
        this.isHiddenInRun = true;
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'duration', label: 'Dauer (ms)', type: 'number', group: 'Intervall' },
            { name: 'count', label: 'Anzahl (0=∞)', type: 'number', group: 'Intervall' },
            { name: 'enabled', label: 'Aktiviert', type: 'boolean', group: 'Intervall' }
        ];
    }

    public getEvents(): string[] {
        return [
            'onIntervall',
            'onTimeout'
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            duration: this.duration,
            count: this.count,
            enabled: this.enabled
        };
    }

    // ─────────────────────────────────────────────
    // IRuntimeComponent
    // ─────────────────────────────────────────────

    public initRuntime(callbacks: { handleEvent: (id: string, ev: string, data?: any) => void }): void {
        this.onEventCallback = (id: string, ev: string, data?: any) => callbacks.handleEvent(id, ev, data);
    }

    public onRuntimeStart(): void {
        if (this.enabled) {
            this.start();
        }
    }

    public onRuntimeStop(): void {
        this.stop();
    }

    // ─────────────────────────────────────────────
    // Methoden (aufrufbar via call_method Action)
    // ─────────────────────────────────────────────

    /**
     * Startet den Intervall-Timer
     */
    public start(): void {
        this.stop();
        this.currentCount = 0;

        if (!this.enabled) return;

        const tick = () => {
            this.currentCount++;

            // Event: onIntervall
            if (this.onEventCallback) {
                this.onEventCallback(this.id, 'onIntervall', {
                    current: this.currentCount,
                    total: this.count
                });
            }

            // Prüfe ob Limit erreicht
            if (this.count > 0 && this.currentCount >= this.count) {
                this.timerId = null;
                // Event: onTimeout
                if (this.onEventCallback) {
                    this.onEventCallback(this.id, 'onTimeout', {
                        total: this.count
                    });
                }
            } else {
                // Nächstes Intervall planen
                this.timerId = window.setTimeout(tick, this.duration);
            }
        };

        // Erstes Intervall starten
        this.timerId = window.setTimeout(tick, this.duration);
    }

    /**
     * Stoppt den Timer
     */
    public stop(): void {
        if (this.timerId !== null) {
            window.clearTimeout(this.timerId);
            this.timerId = null;
        }
        this.currentCount = 0;
    }

    /**
     * Setzt den Counter zurück (ohne zu stoppen)
     */
    public reset(): void {
        this.currentCount = 0;
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TIntervalTimer', (objData: any) => new TIntervalTimer(objData.name, objData.x, objData.y), ["TRepeater"]);
