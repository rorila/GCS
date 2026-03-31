import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { VariableType } from '../model/types';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TVariable');


export class TVariable extends TWindow {
    private static logger = Logger.get('TVariable', 'Project_Validation');
    public className: string = 'TVariable';
    public value: any = undefined;
    public defaultValue: any = undefined;
    private _type: VariableType = 'integer';
    public objectModel: string = '';

    public get type(): VariableType { return this._type; }
    public set type(v: VariableType) {
        if (this._type !== v) {
            TVariable.logger.info(`type update: ${this._type} -> ${v} (Object: ${this.name}, ID: ${this.id})`);
            // Trace can be logged as debug info or handled via logger.debug if needed
            TVariable.logger.debug(`Trace for type update ${this.name}`);
            this._type = v;
        } else {
            TVariable.logger.debug(`type setter called with SAME value: ${v} (Object: ${this.name})`);
        }
    }

    // Alias for backward compatibility
    public get variableType(): VariableType { return this.type; }
    public set variableType(v: VariableType) { this.type = v; }

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 6, 2);
        this.isVariable = true;
        this.style.backgroundColor = '#d1c4e9'; // Lighter purple for better contrast with black text
        this.style.borderColor = '#9575cd';
        this.style.borderWidth = 1;
        this.style.color = '#000000'; // Black text as requested

        // Visibility & Scoping Meta-Flags
        this.isHiddenInRun = true;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        const variableProps: TPropertyDef[] = [
            {
                name: 'type',
                label: 'Typ',
                type: 'select',
                group: 'Variable',
                options: ['integer', 'real', 'string', 'boolean', 'timer', 'random', 'list', 'object', 'object_list', 'threshold', 'trigger', 'range', 'keystore', 'any', 'json'],
                selectedValue: this.type, // Explicitly bind current value
                defaultValue: 'integer'
            },
            { name: 'defaultValue', label: 'Standardwert', type: 'string', group: 'Variable' },
            { name: 'value', label: 'Aktueller Wert', type: 'string', group: 'Variable' }
        ];

        // Add object model selection if type is object or object_list
        if (this.type === 'object' || this.type === 'object_list') {
            variableProps.splice(1, 0, {
                name: 'objectModel',
                label: 'Modell (Entität)',
                type: 'select',
                group: 'Variable',
                source: 'availableModels', // Will be populated by Discovery in InspectorHost
                placeholder: 'Modell wählen...'
            });
        }

        return [
            ...props,
            ...variableProps
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onValueChanged'
        ];
    }

    /**
     * Custom toJSON to ensure the 'type' getter is serialized as 'type'
     * instead of the private '_type' field. Without this, JSON.stringify
     * does not call prototype getters, causing type loss on reload.
     */
    public toJSON(): any {
        const json = super.toJSON();

        // Ensure the 'type' getter value is serialized correctly
        json.type = this.type;
        json.objectModel = this.objectModel;

        TVariable.logger.debug(`Serializing "${this.name}" (ID: ${this.id}):`, {
            className: this.className,
            type: json.type,
            scope: this.scope,
            events: !!json.events
        });

        return json;
    }
}
