import { TTextControl } from './TTextControl';
export class TButton extends TTextControl {
    constructor(name, x, y, width, height, text) {
        super(name, x, y, width, height);
        this.icon = '';
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
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'icon', label: 'Icon', type: 'image_picker', group: 'DARSTELLUNG' }
        ];
    }
}
