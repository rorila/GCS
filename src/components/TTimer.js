import { TWindow } from './TWindow';
export class TTimer extends TWindow {
    constructor(name, x, y) {
        super(name, x, y, 3, 1);
        this.className = 'TTimer';
        this.interval = 1000; // in milliseconds
        this.enabled = true;
        this.maxInterval = 0; // 0 = infinite, >0 = max number of intervals
        this.currentInterval = 0; // current interval count
        this.timerId = null;
        this.onTimerCallback = null;
        this.onEvent = null;
        this.isVariable = true;
        this.style.backgroundColor = '#4caf50';
        this.style.borderColor = '#2e7d32';
        this.style.borderWidth = 2;
    }
    getInspectorProperties() {
        return [
            ...super.getInspectorProperties(),
            { name: 'interval', label: 'Interval (ms)', type: 'number', group: 'Timer' },
            { name: 'enabled', label: 'Aktiviert', type: 'boolean', group: 'Timer' },
            { name: 'maxInterval', label: 'Max Intervalle (0=∞)', type: 'number', group: 'Timer' },
            { name: 'currentInterval', label: 'Aktuelle Anzahl', type: 'number', group: 'Timer' }
        ];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onTimer',
            'onMaxIntervalReached'
        ];
    }
    toJSON() {
        return super.toJSON();
    }
    initRuntime(callbacks) {
        this.onEvent = (ev) => callbacks.handleEvent(this.id, ev);
    }
    onRuntimeStart() {
        if (this.enabled) {
            this.start(() => {
                // Der Callback wird nun über onEvent (gesetzt in initRuntime) gesteuert
            });
        }
    }
    onRuntimeStop() {
        this.stop();
    }
    /**
     * Start the timer with a callback. Used internally by Editor/GameRuntime.
     */
    start(callback) {
        this.stop();
        this.onTimerCallback = callback;
        // Special Rule: 'SynchronTimer' only runs in multiplayer mode
        if (this.name === 'SynchronTimer') {
            const mp = window.multiplayerManager;
            if (!mp || !mp.isConnected) {
                // console.log(`[TTimer] SynchronTimer suppressed (Singleplayer mode)`);
                return;
            }
        }
        if (this.enabled) {
            this.timerId = window.setInterval(() => {
                this.currentInterval++;
                // console.log(`[TTimer] ${this.name}: Interval ${this.currentInterval}/${this.maxInterval || '∞'}`);
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
                    console.log(`[TTimer] ${this.name}: MaxInterval reached (${this.maxInterval})`);
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
    stop() {
        if (this.timerId !== null) {
            window.clearInterval(this.timerId);
            this.timerId = null;
        }
    }
    /**
     * Start the timer (callable via call_method action)
     */
    timerStart() {
        console.log(`[TTimer] ${this.name}: timerStart() called`);
        this.enabled = true;
        if (this.onEvent) {
            // Re-use internal start with a wrapper that fires onEvent
            this.start(() => { }); // onEvent is already called inside start()
        }
        else {
            // No event callback registered, just start with empty callback
            this.start(() => { });
        }
    }
    /**
     * Stop the timer (callable via call_method action)
     */
    timerStop() {
        console.log(`[TTimer] ${this.name}: timerStop() called`);
        this.enabled = false;
        this.stop();
    }
    /**
     * Reset the interval counter to 0
     */
    reset() {
        console.log(`[TTimer] ${this.name}: reset() called`);
        this.currentInterval = 0;
    }
}
