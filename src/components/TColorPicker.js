import { TWindow } from './TWindow';
/**
 * TColorPicker - Color selection component
 *
 * Allows users to select colors using a color picker.
 * Useful for styling, theming, sprite colors, etc.
 */
export class TColorPicker extends TWindow {
    constructor(name, x, y, width = 8, height = 2) {
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
    setColor(color) {
        this.color = color;
        this.style.backgroundColor = color;
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'color', label: 'Color', type: 'color', group: 'Specifics' },
            { name: 'style.borderColor', label: 'Border Color', type: 'color', group: 'Style' }
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            color: this.color
        };
    }
}
