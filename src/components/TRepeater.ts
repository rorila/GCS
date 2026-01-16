import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

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
    public interval: number = 1000;    // Delay in milliseconds
    public repeatCount: number = 1;    // Number of repetitions (0 = infinite)
    public enabled: boolean = true;

    private timerId: number | null = null;
    private currentCount: number = 0;
    private onTimeoutCallback: (() => void) | null = null;

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 3, 1);
        this.style.backgroundColor = '#ff9800';  // Orange
        this.style.borderColor = '#e65100';
        this.style.borderWidth = 2;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'interval', label: 'Interval (ms)', type: 'number', group: 'Repeater' },
            { name: 'repeatCount', label: 'Repeat Count', type: 'number', group: 'Repeater' },
            { name: 'enabled', label: 'Enabled', type: 'boolean', group: 'Repeater' }
        ];
    }

    public toJSON(): any {
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
    public start(callback?: () => void): void {
        this.stop();
        this.currentCount = 0;

        if (callback) {
            this.onTimeoutCallback = callback;
        }

        if (!this.enabled) return;

        const tick = () => {
            this.currentCount++;

            // Fire the callback/event
            if (this.onTimeoutCallback) {
                this.onTimeoutCallback();
            }

            // Fire onTimeout event (for task binding)
            if ((this as any).Tasks?.onTimeout) {
                // This would be handled by GameRuntime
            }

            // Check if we should continue
            if (this.repeatCount === 0 || this.currentCount < this.repeatCount) {
                // Schedule next tick
                this.timerId = window.setTimeout(tick, this.interval);
            } else {
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
    public stop(): void {
        if (this.timerId !== null) {
            window.clearTimeout(this.timerId);
            this.timerId = null;
        }
        this.currentCount = 0;
    }

    /**
     * Returns true if the repeater is currently running
     */
    public isRunning(): boolean {
        return this.timerId !== null;
    }
}
