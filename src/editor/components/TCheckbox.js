import { TTextControl } from './TTextControl';
/**
 * TCheckbox - Checkbox/Toggle component
 *
 * Allows users to toggle boolean values on/off.
 * Useful for settings, feature toggles, visibility controls, etc.
 */
export class TCheckbox extends TTextControl {
    constructor(name, x, y, width = 8, height = 2) {
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
    toggle() {
        this.checked = !this.checked;
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'checked', label: 'Checked', type: 'checkbox', group: 'Specifics' },
            { name: 'label', label: 'Label', type: 'string', group: 'Specifics' }
            // Inherits styles from TTextControl
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            checked: this.checked,
            label: this.label
        };
    }
}
