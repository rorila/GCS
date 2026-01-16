import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';

/**
 * TNumberInput - Specialized number input component
 * 
 * Allows users to enter numeric values with constraints.
 * Useful for coordinates, sizes, speeds, and other numeric properties.
 */
export class TNumberInput extends TTextControl {
    public value: number;
    public min: number;
    public max: number;
    public step: number;

    constructor(name: string, x: number, y: number, width: number = 8, height: number = 2) {
        super(name, x, y, width, height);

        this.value = 0;
        this.min = -Infinity;
        this.max = Infinity;
        this.step = 1;

        // Default NumberInput Style
        this.style.backgroundColor = '#ffffff';
        this.style.borderColor = '#cccccc';
        this.style.borderWidth = 1;
        this.style.color = '#000000';
    }

    /**
     * Set value with constraint validation
     */
    public setValue(value: number): void {
        this.value = Math.max(this.min, Math.min(this.max, value));
    }

    /**
     * Increment value by step
     */
    public increment(): void {
        this.setValue(this.value + this.step);
    }

    /**
     * Decrement value by step
     */
    public decrement(): void {
        this.setValue(this.value - this.step);
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'value', label: 'Value', type: 'number', group: 'Specifics' },
            { name: 'min', label: 'Min', type: 'number', group: 'Specifics' },
            { name: 'max', label: 'Max', type: 'number', group: 'Specifics' },
            { name: 'step', label: 'Step', type: 'number', group: 'Specifics' }
            // Inherits styles from TTextControl
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            value: this.value,
            min: this.min,
            max: this.max,
            step: this.step
        };
    }
}
