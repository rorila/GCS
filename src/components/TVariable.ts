import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { VariableType } from '../model/types';

export class TVariable extends TWindow {
    public className: string = 'TVariable';
    public value: any = undefined;
    public defaultValue: any = undefined;
    public variableType: VariableType = 'integer';

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 6, 2);
        this.isVariable = true;
        this.style.backgroundColor = '#d1c4e9'; // Lighter purple for better contrast with black text
        this.style.borderColor = '#9575cd';
        this.style.borderWidth = 1;
        this.style.color = '#000000'; // Black text as requested
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'variableType', label: 'Typ', type: 'select', group: 'Variable', options: ['integer', 'real', 'string', 'boolean'] },
            { name: 'defaultValue', label: 'Standardwert', type: 'string', group: 'Variable' },
            { name: 'value', label: 'Aktueller Wert', type: 'string', group: 'Variable' }
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onValueChanged'
        ];
    }
}
