import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export class TTriggerVariable extends TWindow {
    public className: string = 'TTriggerVariable';
    public value: any = undefined;
    public triggerValue: any = 1;

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 4, 2);
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

    public toDTO(): any {
        return {
            ...super.toDTO(),
            value: this.value,
            triggerValue: this.triggerValue
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TTriggerVariable', (objData: any) => new TTriggerVariable(objData.name, objData.x, objData.y));
