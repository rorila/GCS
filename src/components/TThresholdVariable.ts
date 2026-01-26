import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export class TThresholdVariable extends TWindow {
    public className: string = 'TThresholdVariable';
    public value: number = 0;
    public threshold: number = 100;

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 3, 1);
        this.isVariable = true;
        this.style.backgroundColor = '#ff9800'; // Orange for Threshold
        this.style.borderColor = '#f57c00';
        this.style.borderWidth = 2;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'value', label: 'Wert', type: 'number', group: 'Threshold' },
            { name: 'threshold', label: 'Schwellenwert', type: 'number', group: 'Threshold' }
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onThresholdReached',
            'onThresholdLeft',
            'onThresholdExceeded'
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            value: this.value,
            threshold: this.threshold
        };
    }
}
