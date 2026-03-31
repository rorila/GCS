import { TPropertyDef, IRuntimeComponent } from './TComponent';
import { TWindow } from './TWindow';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TTimer');

export class TTimer extends TWindow implements IRuntimeComponent {
    public className: string = 'TTimer';
    public interval: number = 1000; // in milliseconds
    public enabled: boolean = true;
    public maxInterval: number = 0; // 0 = infinite, >0 = max number of intervals
    public currentInterval: number = 0; // current interval count

    private timerId: number | null = null;
    private onTimerCallback: (() => void) | null = null;
    public onEvent: ((eventName: string) => void) | null = null;

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 4, 2);
        this.isVariable = true;
        this.style.backgroundColor = '#4caf50';
        this.style.borderColor = '#2e7d32';
        this.style.borderWidth = 2;

        // Visibility & Scoping Meta-Flags
        this.isService = true;
        this.isHiddenInRun = true;
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'interval', label: 'Interval (ms)', type: 'number', group: 'Timer' },
            { name: 'enabled', label: 'Aktiviert', type: 'boolean', group: 'Timer' },
            { name: 'maxInterval', label: 'Max Intervalle (0=∞)', type: 'number', group: 'Timer' },
            { name: 'currentInterval', label: 'Aktuelle Anzahl', type: 'number', group: 'Timer' }
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onTimer',
            'onMaxIntervalReached'
        ];
    }

    public toJSON(): any {
        return super.toJSON();
    }

    public initRuntime(callbacks: { handleEvent: any }): void {
        this.onEvent = (ev: string) => callbacks.handleEvent(this.id, ev);
    }

    public onRuntimeStart(): void {
        if (this.enabled) {
            this.start(() => {
                // Der Callback wird nun über onEvent (gesetzt in initRuntime) gesteuert
            });
        }
    }

    public onRuntimeStop(): void {
        this.stop();
    }

    /**
     * Start the timer with a callback. Used internally by Editor/GameRuntime.
     */
    public start(callback: () => void): void {
        this.stop();
        this.onTimerCallback = callback;

        // Special Rule: 'SynchronTimer' only runs in multiplayer mode
        if (this.name === 'SynchronTimer') {
            const mp = (window as any).multiplayerManager;
            if (!mp || !mp.isConnected) {
                // logger.info(`[TTimer] SynchronTimer suppressed (Singleplayer mode)`);
                return;
            }
        }

        if (this.enabled) {
            this.timerId = window.setInterval(() => {
                this.currentInterval++;
                // logger.info(`[TTimer] ${this.name}: Interval ${this.currentInterval}/${this.maxInterval || '∞'}`);

                // Fire onTimer event via callback (legacy)
                if (this.onTimerCallback) {
                    this.onTimerCallback();
                }

                // Fire onTimer event via onEvent (for call_method initiated timers)
                if (this.onEvent) {
                    this.onEvent('onTimer');
                }

                // Check if max interval reached
                if (this.maxInterval > 0 && this.currentInterval >= this.maxInterval) {
                    logger.info(`[TTimer] ${this.name}: MaxInterval reached (${this.maxInterval})`);
                    this.stop();
                    if (this.onEvent) {
                        this.onEvent('onMaxIntervalReached');
                    }
                }
            }, this.interval);
        }
    }

    /**
     * Stop the timer
     */
    public stop(): void {
        if (this.timerId !== null) {
            window.clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    /**
     * Start the timer (callable via call_method action)
     */
    public timerStart(): void {
        logger.info(`[TTimer] ${this.name}: timerStart() called`);
        this.enabled = true;
        if (this.onEvent) {
            // Re-use internal start with a wrapper that fires onEvent
            this.start(() => { }); // onEvent is already called inside start()
        } else {
            // No event callback registered, just start with empty callback
            this.start(() => { });
        }
    }

    /**
     * Stop the timer (callable via call_method action)
     */
    public timerStop(): void {
        logger.info(`[TTimer] ${this.name}: timerStop() called`);
        this.enabled = false;
        this.stop();
    }

    /**
     * Reset the interval counter to 0
     */
    public reset(): void {
        logger.info(`[TTimer] ${this.name}: reset() called`);
        this.currentInterval = 0;
    }
}
