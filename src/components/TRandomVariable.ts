import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TRandomVariable');

export class TRandomVariable extends TWindow {
    public className: string = 'TRandomVariable';
    public value: number = 0;
    public min: number = 1;
    public max: number = 100;
    public isInteger: boolean = true;

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 4, 2);
        this.isVariable = true;
        this.style.backgroundColor = '#607d8b'; // Blue Grey for Random
        this.style.borderColor = '#455a64';
        this.style.borderWidth = 2;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'min', label: 'Minimum', type: 'number', group: 'Random' },
            { name: 'max', label: 'Maximum', type: 'number', group: 'Random' },
            { name: 'isInteger', label: 'Nur Ganzzahlen', type: 'boolean', group: 'Random' },
            { name: 'value', label: 'Aktueller Wert', type: 'number', group: 'Random', readonly: true }
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onGenerated'
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            min: this.min,
            max: this.max,
            isInteger: this.isInteger,
            value: this.value
        };
    }

    /**
     * Generates a new random value (callable via call_method)
     */
    public generate(): void {
        if (this.isInteger) {
            this.value = Math.floor(Math.random() * (this.max - this.min + 1)) + this.min;
        } else {
            this.value = Math.random() * (this.max - this.min) + this.min;
        }
        logger.info(`[TRandomVariable] ${this.name} generated: ${this.value}`);
        // In a real implementation, this would fire 'onGenerated' in the runtime.
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TRandomVariable', (objData: any) => new TRandomVariable(objData.name, objData.x, objData.y));
