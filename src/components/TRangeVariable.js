import { TWindow } from './TWindow';
export class TRangeVariable extends TWindow {
    constructor(name, x, y) {
        super(name, x, y, 3, 1);
        this.className = 'TRangeVariable';
        this.value = undefined;
        this.min = 0;
        this.max = 100;
        this.isVariable = true;
        this.style.backgroundColor = '#2196f3'; // Blue for Range
        this.style.borderColor = '#1976d2';
        this.style.borderWidth = 2;
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'value', label: 'Wert', type: 'number', group: 'Range' },
            { name: 'min', label: 'Minimum', type: 'number', group: 'Range' },
            { name: 'max', label: 'Maximum', type: 'number', group: 'Range' }
        ];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onMinReached',
            'onMaxReached',
            'onInside',
            'onOutside'
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            value: this.value,
            min: this.min,
            max: this.max
        };
    }
}
