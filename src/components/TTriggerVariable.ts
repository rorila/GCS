import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export class TTriggerVariable extends TWindow {
    public className: string = 'TTriggerVariable';
    public value: any = 0;
    public triggerValue: any = 1;

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 3, 1);
        this.isVariable = true;
        this.style.backgroundColor = '#f44336'; // Red for Trigger
        this.style.borderColor = '#d32f2f';
        this.style.borderWidth = 2;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'value', label: 'Wert', type: 'string', group: 'Trigger' },
            { name: 'triggerValue', label: 'Trigger-Wert', type: 'string', group: 'Trigger' }
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onTriggerEnter',
            'onTriggerExit'
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            value: this.value,
            triggerValue: this.triggerValue
        };
    }
}
