import { TTextControl } from './TTextControl';
/**
 * TNumberLabel - A specialized component for displaying and managing numeric values.
 * It provides methods for incrementing and decrementing values and fires events
 * when maximum or minimum values are reached.
 */
export class TNumberLabel extends TTextControl {
    constructor(name, x, y, startValue = 0) {
        super(name, x, y, 100, 20);
        this.className = 'TNumberLabel';
        this.value = 0;
        this.startValue = 0;
        this.maxValue = null;
        this.step = 1;
        this.onEvent = null;
        this.startValue = startValue;
        this.value = startValue;
        this.style.backgroundColor = 'transparent';
        this.style.color = '#000000';
        this.style.textAlign = 'center';
    }
    /**
     * Increments the value by the step amount.
     * Fires onMaxValueReached if maxValue is set and reached.
     */
    incValue() {
        const oldValue = this.value;
        this.value += this.step;
        console.log(`[TNumberLabel] incValue on ${this.name}: ${oldValue} + ${this.step} = ${this.value}, maxValue=${this.maxValue}, onEvent=${!!this.onEvent}`);
        if (this.maxValue !== null && this.value >= this.maxValue) {
            console.log(`[TNumberLabel] ${this.name}: MaxValue reached! value=${this.value} >= maxValue=${this.maxValue}. Firing onMaxValueReached...`);
            if (this.onEvent) {
                this.onEvent('onMaxValueReached');
                console.log(`[TNumberLabel] ${this.name}: onMaxValueReached event fired!`);
            }
            else {
                console.warn(`[TNumberLabel] ${this.name}: onEvent callback is NOT registered! Event cannot be fired.`);
            }
        }
    }
    /**
     * Decrements the value by the step amount.
     * Fires onMinValueReached if 0 is reached and startValue was > 0.
     */
    decValue() {
        const oldValue = this.value;
        this.value -= this.step;
        // Ensure we don't go below 0 if that's desired
        if (this.value < 0)
            this.value = 0;
        if (oldValue > 0 && this.value === 0 && this.startValue > 0) {
            if (this.onEvent)
                this.onEvent('onMinValueReached');
        }
    }
    /**
     * Resets the value to the startValue.
     */
    reset() {
        this.value = this.startValue;
    }
    // Mapping caption to value for display if needed generically
    get caption() {
        return String(this.value);
    }
    set caption(v) {
        this.value = Number(v) || 0;
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onMaxValueReached',
            'onMinValueReached'
        ];
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'startValue', label: 'Anfangswert', type: 'number', group: 'Numeric' },
            { name: 'value', label: 'Aktueller Wert', type: 'number', group: 'Numeric' },
            { name: 'maxValue', label: 'Maximalwert (Optional)', type: 'number', group: 'Numeric' },
            { name: 'step', label: 'Schrittweite', type: 'number', group: 'Numeric' }
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            value: this.value,
            startValue: this.startValue,
            maxValue: this.maxValue,
            step: this.step
        };
    }
}
