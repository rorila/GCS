import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

/**
 * TDropdown - Dropdown/Select component
 * 
 * Allows users to select from a list of options.
 * Useful for property editors, settings, menus, etc.
 */
export class TDropdown extends TWindow {
    public options: string[];
    public selectedIndex: number;
    public selectedValue: string;

    constructor(name: string, x: number, y: number, width: number = 8, height: number = 2) {
        super(name, x, y, width, height);

        this.options = ['Option 1', 'Option 2', 'Option 3'];
        this.selectedIndex = 0;
        this.selectedValue = this.options[0];

        // Default Dropdown Style
        this.style.backgroundColor = '#ffffff';
        this.style.borderColor = '#cccccc';
        this.style.borderWidth = 1;
        this.style.color = '#000000';
    }

    /**
     * Set selected value by string
     */
    public selectValue(value: string): void {
        const index = this.options.indexOf(value);
        if (index !== -1) {
            this.selectedIndex = index;
            this.selectedValue = value;
        }
    }

    /**
     * Set selected value by index
     */
    public selectIndex(index: number): void {
        if (index >= 0 && index < this.options.length) {
            this.selectedIndex = index;
            this.selectedValue = this.options[index];
        }
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'options', label: 'Options (comma-separated)', type: 'string', group: 'Specifics' },
            { name: 'selectedIndex', label: 'Selected Index', type: 'number', group: 'Specifics' },
            { name: 'selectedValue', label: 'Selected Value', type: 'string', group: 'Specifics', readonly: true },
            { name: 'style.color', label: 'Text Color', type: 'color', group: 'Style' },
            { name: 'style.borderColor', label: 'Border Color', type: 'color', group: 'Style' }
        ];
    }

    public override getEvents(): string[] {
        return [...super.getEvents(), 'onChange'];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            options: this.options,
            selectedIndex: this.selectedIndex,
            selectedValue: this.selectedValue
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TDropdown', (objData: any) => new TDropdown(objData.name, objData.x, objData.y, objData.width, objData.height));
