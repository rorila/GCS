import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';

/**
 * TCheckbox - Checkbox/Toggle component
 * 
 * Allows users to toggle boolean values on/off.
 * Useful for settings, feature toggles, visibility controls, etc.
 */
export class TCheckbox extends TTextControl {
    public checked: boolean;
    public label: string;

    constructor(name: string, x: number, y: number, width: number = 8, height: number = 2) {
        super(name, x, y, width, height);

        this.checked = false;
        this.label = name;

        // Default Checkbox Style
        this.style.backgroundColor = '#ffffff';
        this.style.borderColor = '#cccccc';
        this.style.borderWidth = 1;
        this.style.color = '#000000';
        this.style.textAlign = 'left';
    }

    /**
     * Toggle the checkbox state
     */
    public toggle(): void {
        this.checked = !this.checked;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'checked', label: 'Checked', type: 'checkbox', group: 'Specifics' },
            { name: 'label', label: 'Label', type: 'string', group: 'Specifics' }
            // Inherits styles from TTextControl
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            checked: this.checked,
            label: this.label
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TCheckbox', (objData: any) => new TCheckbox(objData.name, objData.x, objData.y, objData.width, objData.height));
