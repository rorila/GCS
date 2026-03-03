import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';

export class TButton extends TTextControl {
    public icon: string = '';

    constructor(name: string, x: number, y: number, width: number, height: number, text?: string) {
        super(name, x, y, width, height);

        // Use inherited text property
        this.text = text !== undefined ? text : name;

        // Default Button Style
        this.style.backgroundColor = '#007bff';
        this.style.borderColor = '#000000';
        this.style.borderWidth = 1;
        this.style.color = '#ffffff'; // Text Color from TTextControl
        this.style.textAlign = 'center'; // Buttons default to center
        this.style.fontWeight = 'bold'; // Buttons default to bold
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'icon', label: 'Icon', type: 'image_picker', group: 'ICON' }
        ];
    }
}
