import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export type ThresholdComparison = '>=' | '<=' | '==' | '>' | '<' | '!=';

export class TThresholdVariable extends TWindow {
    public className: string = 'TThresholdVariable';
    public value: any = undefined;
    public threshold: number = 100;
    public comparison: ThresholdComparison = '>=';

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 4, 2);
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
            { name: 'threshold', label: 'Schwellenwert', type: 'number', group: 'Threshold' },
            { name: 'comparison', label: 'Vergleich', type: 'select', group: 'Threshold', options: ['>=', '<=', '==', '>', '<', '!='] }
        ];
    }

    /**
     * Prüft ob der Schwellwert gemäß comparison erreicht ist.
     */
    public isThresholdReached(): boolean {
        const v = Number(this.value);
        const t = this.threshold;
        switch (this.comparison) {
            case '>=': return v >= t;
            case '<=': return v <= t;
            case '==': return v === t;
            case '>':  return v > t;
            case '<':  return v < t;
            case '!=': return v !== t;
            default:   return v >= t;
        }
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
            threshold: this.threshold,
            comparison: this.comparison
        };
    }
}


// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TThresholdVariable', (objData: any) => new TThresholdVariable(objData.name, objData.x, objData.y));
