import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

/**
 * TColorPicker - Color selection component
 * 
 * Allows users to select colors using a color picker.
 * Useful for styling, theming, sprite colors, etc.
 */
export class TColorPicker extends TWindow {
    public color: string;

    constructor(name: string, x: number, y: number, width: number = 8, height: number = 2) {
        super(name, x, y, width, height);

        this.color = '#000000';

        // Default ColorPicker Style
        this.style.backgroundColor = this.color;
        this.style.borderColor = '#cccccc';
        this.style.borderWidth = 1;
    }

    /**
     * Set color and update background
     */
    public setColor(color: string): void {
        this.color = color;
        this.style.backgroundColor = color;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'color', label: 'Color', type: 'color', group: 'Specifics' },
            { name: 'style.borderColor', label: 'Border Color', type: 'color', group: 'Style' }
        ];
    }

    public override getEvents(): string[] {
        return [...super.getEvents(), 'onChange'];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            color: this.color
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TColorPicker', (objData: any) => new TColorPicker(objData.name, objData.x, objData.y, objData.width, objData.height));
