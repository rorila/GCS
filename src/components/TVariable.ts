import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { VariableType } from '../model/types';

export class TVariable extends TWindow {
    public className: string = 'TVariable';
    public value: any = undefined;
    public defaultValue: any = undefined;
    public variableType: VariableType = 'integer';

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 3, 1);
        this.isVariable = true;
        this.style.backgroundColor = '#673ab7'; // Deep Purple for variables
        this.style.borderColor = '#512da8';
        this.style.borderWidth = 2;
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
