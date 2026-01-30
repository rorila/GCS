import { TWindow } from './TWindow';
/**
 * TRepeater - A timer component that fires onTimeout event
 * Can run once (repeatCount=1) or multiple times
 *
 * Usage:
 *   myRepeater.start() - starts the timer
 *   myRepeater.stop()  - stops before completion
 *
 * Properties:
 *   interval: delay in milliseconds
 *   repeatCount: number of times to fire (0 = infinite)
 *
 * Events:
 *   onTimeout: fired each time interval elapses
 */
export class TRepeater extends TWindow {
    constructor(name, x, y) {
        super(name, x, y, 3, 1);
        this.interval = 1000; // Delay in milliseconds
        this.repeatCount = 1; // Number of repetitions (0 = infinite)
        this.enabled = true;
        this.timerId = null;
        this.currentCount = 0;
        this.onTimeoutCallback = null;
        this.style.backgroundColor = '#ff9800'; // Orange
        this.style.borderColor = '#e65100';
        this.style.borderWidth = 2;
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'interval', label: 'Interval (ms)', type: 'number', group: 'Repeater' },
            { name: 'repeatCount', label: 'Repeat Count', type: 'number', group: 'Repeater' },
            { name: 'enabled', label: 'Enabled', type: 'boolean', group: 'Repeater' }
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            interval: this.interval,
            repeatCount: this.repeatCount,
            enabled: this.enabled
        };
    }
    /**
     * Starts the repeater with optional callback
     * The callback is called each time the interval elapses
     */
    start(callback) {
        this.stop();
        this.currentCount = 0;
        if (callback) {
            this.onTimeoutCallback = callback;
        }
        if (!this.enabled)
            return;
        const tick = () => {
            this.currentCount++;
            // Fire the callback/event
            if (this.onTimeoutCallback) {
                this.onTimeoutCallback();
            }
            // Fire onTimeout event (for task binding)
            if (this.Tasks?.onTimeout) {
                // This would be handled by GameRuntime
            }
            // Check if we should continue
            if (this.repeatCount === 0 || this.currentCount < this.repeatCount) {
                // Schedule next tick
                this.timerId = window.setTimeout(tick, this.interval);
            }
            else {
                // Done - clean up
                this.timerId = null;
            }
        };
        // Start first tick
        this.timerId = window.setTimeout(tick, this.interval);
    }
    /**
     * Stops the repeater before completion
     */
    stop() {
        if (this.timerId !== null) {
            window.clearTimeout(this.timerId);
            this.timerId = null;
        }
        this.currentCount = 0;
    }
    /**
     * Returns true if the repeater is currently running
     */
    isRunning() {
        return this.timerId !== null;
    }
}
