import { TWindow } from './TWindow';
export class TThresholdVariable extends TWindow {
    constructor(name, x, y) {
        super(name, x, y, 3, 1);
        this.className = 'TThresholdVariable';
        this.value = undefined;
        this.threshold = 100;
        this.isVariable = true;
        this.style.backgroundColor = '#ff9800'; // Orange for Threshold
        this.style.borderColor = '#f57c00';
        this.style.borderWidth = 2;
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'value', label: 'Wert', type: 'number', group: 'Threshold' },
            { name: 'threshold', label: 'Schwellenwert', type: 'number', group: 'Threshold' }
        ];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onThresholdReached',
            'onThresholdLeft',
            'onThresholdExceeded'
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            value: this.value,
            threshold: this.threshold
        };
    }
}
