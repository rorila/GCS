import { TWindow } from './TWindow';
export class TVariable extends TWindow {
    constructor(name, x, y) {
        super(name, x, y, 3, 1);
        this.className = 'TVariable';
        this.value = undefined;
        this.defaultValue = undefined;
        this.variableType = 'integer';
        this.isVariable = true;
        this.style.backgroundColor = '#673ab7'; // Deep Purple for variables
        this.style.borderColor = '#512da8';
        this.style.borderWidth = 2;
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'variableType', label: 'Typ', type: 'select', group: 'Variable', options: ['integer', 'real', 'string', 'boolean'] },
            { name: 'defaultValue', label: 'Standardwert', type: 'string', group: 'Variable' },
            { name: 'value', label: 'Aktueller Wert', type: 'string', group: 'Variable' }
        ];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onValueChanged'
        ];
    }
}
