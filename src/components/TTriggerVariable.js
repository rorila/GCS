import { TWindow } from './TWindow';
export class TTriggerVariable extends TWindow {
    constructor(name, x, y) {
        super(name, x, y, 3, 1);
        this.className = 'TTriggerVariable';
        this.value = undefined;
        this.triggerValue = 1;
        this.isVariable = true;
        this.style.backgroundColor = '#f44336'; // Red for Trigger
        this.style.borderColor = '#d32f2f';
        this.style.borderWidth = 2;
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'value', label: 'Wert', type: 'string', group: 'Trigger' },
            { name: 'triggerValue', label: 'Trigger-Wert', type: 'string', group: 'Trigger' }
        ];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onTriggerEnter',
            'onTriggerExit'
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            value: this.value,
            triggerValue: this.triggerValue
        };
    }
}
