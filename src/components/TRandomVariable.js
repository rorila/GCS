import { TWindow } from './TWindow';
export class TRandomVariable extends TWindow {
    constructor(name, x, y) {
        super(name, x, y, 3, 1);
        this.className = 'TRandomVariable';
        this.value = 0;
        this.min = 1;
        this.max = 100;
        this.isInteger = true;
        this.isVariable = true;
        this.style.backgroundColor = '#607d8b'; // Blue Grey for Random
        this.style.borderColor = '#455a64';
        this.style.borderWidth = 2;
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'min', label: 'Minimum', type: 'number', group: 'Random' },
            { name: 'max', label: 'Maximum', type: 'number', group: 'Random' },
            { name: 'isInteger', label: 'Nur Ganzzahlen', type: 'boolean', group: 'Random' },
            { name: 'value', label: 'Aktueller Wert', type: 'number', group: 'Random', readonly: true }
        ];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onGenerated'
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            min: this.min,
            max: this.max,
            isInteger: this.isInteger,
            value: this.value
        };
    }
    /**
     * Generates a new random value (callable via call_method)
     */
    generate() {
        if (this.isInteger) {
            this.value = Math.floor(Math.random() * (this.max - this.min + 1)) + this.min;
        }
        else {
            this.value = Math.random() * (this.max - this.min) + this.min;
        }
        console.log(`[TRandomVariable] ${this.name} generated: ${this.value}`);
        // In a real implementation, this would fire 'onGenerated' in the runtime.
    }
}
