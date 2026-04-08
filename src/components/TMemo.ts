import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';

/**
 * TMemo - Multi-line text component
 * 
 * Allows users to display or edit multiple lines of text.
 * Perfect for logs, large descriptions, or JSON data.
 */
export class TMemo extends TTextControl {
    public text: string;
    public placeholder: string;
    public readOnly: boolean;

    constructor(name: string, x: number, y: number, width: number = 20, height: number = 10) {
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

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'text', label: 'Text', type: 'string', group: 'Specifics' },
            { name: 'placeholder', label: 'Placeholder', type: 'string', group: 'Specifics' },
            { name: 'readOnly', label: 'Read Only', type: 'boolean', group: 'Specifics' }
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            text: this.text,
            placeholder: this.placeholder,
            readOnly: this.readOnly
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TMemo', (objData: any) => new TMemo(objData.name, objData.x, objData.y, objData.width, objData.height));
