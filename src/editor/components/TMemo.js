import { TTextControl } from './TTextControl';
/**
 * TMemo - Multi-line text component
 *
 * Allows users to display or edit multiple lines of text.
 * Perfect for logs, large descriptions, or JSON data.
 */
export class TMemo extends TTextControl {
    constructor(name, x, y, width = 20, height = 10) {
        super(name, x, y, width, height);
        this.text = '';
        this.placeholder = '';
        this.readOnly = false;
        // Default Memo Style
        this.style.backgroundColor = '#1e1e1e';
        this.style.borderColor = '#444444';
        this.style.borderWidth = 1;
        this.style.color = '#9cdcfe';
        this.style.fontFamily = 'monospace';
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'text', label: 'Text', type: 'string', group: 'Specifics' },
            { name: 'placeholder', label: 'Placeholder', type: 'string', group: 'Specifics' },
            { name: 'readOnly', label: 'Read Only', type: 'boolean', group: 'Specifics' }
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            text: this.text,
            placeholder: this.placeholder,
            readOnly: this.readOnly
        };
    }
}
