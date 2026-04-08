import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export class TRangeVariable extends TWindow {
    public className: string = 'TRangeVariable';
    public value: any = undefined;
    public min: number = 0;
    public max: number = 100;

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 4, 2);
        this.isVariable = true;
        this.style.backgroundColor = '#2196f3'; // Blue for Range
        this.style.borderColor = '#1976d2';
        this.style.borderWidth = 2;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'value', label: 'Wert', type: 'number', group: 'Range' },
            { name: 'min', label: 'Minimum', type: 'number', group: 'Range' },
            { name: 'max', label: 'Maximum', type: 'number', group: 'Range' }
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onMinReached',
            'onMaxReached',
            'onInside',
            'onOutside'
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            value: this.value,
            min: this.min,
            max: this.max
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TRangeVariable', (objData: any) => new TRangeVariable(objData.name, objData.x, objData.y));
