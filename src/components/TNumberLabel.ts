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
    private _value: number = 0;
    public startValue: number = 0;
    public minValue: number | null = null;
    public maxValue: number | null = null;
    public step: number = 1;

    public onEvent: ((eventName: string) => void) | null = null;

    /** Aktueller numerischer Wert. Jede Änderung synchronisiert `text` automatisch. */
    get value(): number { return this._value; }
    set value(v: number) {
        this._value = Number(v) || 0;
        this.text = String(this._value);
    }

    /**
     * Property-Änderung anwenden.
     * Wird vom InspectorHost aufgerufen. Bei Änderungen an `text` (INHALT)
     * wird der numerische `value` passend aktualisiert, ohne `text` zu überschreiben.
     */
    public applyChange(propertyName: string, newValue: any, oldValue?: any): boolean {
        if (propertyName === 'text') {
            const s = String(newValue ?? '').trim();
            const parsed = s !== '' ? Number(s) : NaN;
            this._value = !isNaN(parsed) ? parsed : 0;
        }
        return super.applyChange(propertyName, newValue, oldValue);
    }

    constructor(name: string, x: number, y: number, startValue: number = 0) {
        super(name, x, y, 8, 2);
        this.startValue = startValue;
        this.value = startValue;

        // Default style wird nun über ThemeRegistry gesteuert
    }

    /**
     * Increments the value by the step amount.
     * Fires onMaxValueReached when the maximum is reached or exceeded.
     */
    public incValue(): void {
        const oldValue = this.value;
        let newValue = oldValue + this.step;
        if (this.maxValue !== null) {
            newValue = Math.min(newValue, this.maxValue);
        }
        this.value = newValue;

        logger.info(`[TNumberLabel] incValue on ${this.name}: ${oldValue} + ${this.step} = ${this.value}, maxValue=${this.maxValue}, onEvent=${!!this.onEvent}`);

        if (this.maxValue !== null && oldValue < this.maxValue && this.value >= this.maxValue) {
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
     * Fires onMinValueReached when the minimum is reached or undershot.
     */
    public decValue(): void {
        const oldValue = this.value;
        let newValue = oldValue - this.step;
        if (this.minValue !== null) {
            newValue = Math.max(newValue, this.minValue);
        }
        this.value = newValue;

        logger.info(`[TNumberLabel] decValue on ${this.name}: ${oldValue} - ${this.step} = ${this.value}, minValue=${this.minValue}, onEvent=${!!this.onEvent}`);

        if (this.minValue !== null && oldValue > this.minValue && this.value <= this.minValue) {
            logger.info(`[TNumberLabel] ${this.name}: MinValue reached! value=${this.value} <= minValue=${this.minValue}. Firing onMinValueReached...`);
            if (this.onEvent) {
                this.onEvent('onMinValueReached');
                logger.info(`[TNumberLabel] ${this.name}: onMinValueReached event fired!`);
            } else {
                logger.warn(`[TNumberLabel] ${this.name}: onEvent callback is NOT registered! Event cannot be fired.`);
            }
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
            { name: 'minValue', label: 'Minimalwert (Optional)', type: 'number', group: 'Numeric' },
            { name: 'maxValue', label: 'Maximalwert (Optional)', type: 'number', group: 'Numeric' },
            { name: 'step', label: 'Schrittweite', type: 'number', group: 'Numeric' }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            value: this.value,
            startValue: this.startValue,
            minValue: this.minValue,
            maxValue: this.maxValue,
            step: this.step
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TNumberLabel', (objData: any) => new TNumberLabel(objData.name, objData.x, objData.y, objData.startValue));
