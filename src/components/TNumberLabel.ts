import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TNumberLabel');

/**
 * TNumberLabel - A specialized component for displaying and managing numeric values.
 * It provides methods for incrementing and decrementing values and fires events
 * when maximum or minimum values are reached.
 */
export class TNumberLabel extends TTextControl {
    public className: string = 'TNumberLabel';
    public value: number = 0;
    public startValue: number = 0;
    public maxValue: number | null = null;
    public step: number = 1;

    public onEvent: ((eventName: string) => void) | null = null;

    constructor(name: string, x: number, y: number, startValue: number = 0) {
        super(name, x, y, 8, 2);
        this.startValue = startValue;
        this.value = startValue;

        // Default style wird nun über ThemeRegistry gesteuert
    }

    /**
     * Increments the value by the step amount.
     * Fires onMaxValueReached if maxValue is set and reached.
     */
    public incValue(): void {
        const oldValue = this.value;
        this.value += this.step;
        logger.info(`[TNumberLabel] incValue on ${this.name}: ${oldValue} + ${this.step} = ${this.value}, maxValue=${this.maxValue}, onEvent=${!!this.onEvent}`);

        if (this.maxValue !== null && this.value >= this.maxValue) {
            logger.info(`[TNumberLabel] ${this.name}: MaxValue reached! value=${this.value} >= maxValue=${this.maxValue}. Firing onMaxValueReached...`);
            if (this.onEvent) {
                this.onEvent('onMaxValueReached');
                logger.info(`[TNumberLabel] ${this.name}: onMaxValueReached event fired!`);
            } else {
                logger.warn(`[TNumberLabel] ${this.name}: onEvent callback is NOT registered! Event cannot be fired.`);
            }
        }
    }

    /**
     * Decrements the value by the step amount.
     * Fires onMinValueReached if 0 is reached and startValue was > 0.
     */
    public decValue(): void {
        const oldValue = this.value;
        this.value -= this.step;

        // Ensure we don't go below 0 if that's desired
        if (this.value < 0) this.value = 0;

        if (oldValue > 0 && this.value === 0 && this.startValue > 0) {
            if (this.onEvent) this.onEvent('onMinValueReached');
        }
    }

    /**
     * Resets the value to the startValue.
     */
    public reset(): void {
        this.value = this.startValue;
    }

    // Mapping caption to value for display if needed generically
    get caption(): string {
        return String(this.value);
    }

    set caption(v: string) {
        this.value = Number(v) || 0;
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onMaxValueReached',
            'onMinValueReached'
        ];
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'startValue', label: 'Anfangswert', type: 'number', group: 'Numeric' },
            { name: 'value', label: 'Aktueller Wert', type: 'number', group: 'Numeric' },
            { name: 'maxValue', label: 'Maximalwert (Optional)', type: 'number', group: 'Numeric' },
            { name: 'step', label: 'Schrittweite', type: 'number', group: 'Numeric' }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            value: this.value,
            startValue: this.startValue,
            maxValue: this.maxValue,
            step: this.step
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TNumberLabel', (objData: any) => new TNumberLabel(objData.name, objData.x, objData.y, objData.startValue));
