import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';

export class TButton extends TTextControl {
    public icon: string = '';

    constructor(name: string, x: number, y: number, width: number, height: number, text?: string) {
        super(name, x, y, width, height);

        // Use inherited caption setter
        this.caption = text !== undefined ? text : name;

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
            // Basic (Specifics only, styles inherited from TTextControl/TWindow)
            { name: 'caption', label: 'Caption', type: 'string', group: 'Specifics' },
            { name: 'icon', label: 'Icon Image', type: 'image_picker', group: 'Specifics' }
        ];
    }

    // Color property wrapper mapping to style (legacy support)
    get color(): string | undefined {
        return this.style.backgroundColor;
    }

    set color(value: string | undefined) {
        this.style.backgroundColor = value;
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            caption: this.caption,
            color: this.color, // Keep legacy mapping for now
            icon: this.icon
        };
    }
}
