import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';

export class TButton extends TTextControl {
    public icon: string = '';

    constructor(name: string, x: number, y: number, width: number, height: number, text?: string) {
        super(name, x, y, width, height);

        // Use inherited text property
        this.text = text !== undefined ? text : name;

        // Default Button Style wird nun über ThemeRegistry gesteuert
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'icon', label: 'Icon', type: 'image_picker', group: 'ICON' }
        ];
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TButton', (objData: any) => new TButton(objData.name, objData.x, objData.y, objData.width, objData.height, objData.caption));
