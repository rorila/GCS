import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

/**
 * TTextControl - Base class for components with text
 * 
 * Centralizes text styling properties:
 * - Font Size, Weight, Style, Family
 * - Text Align
 * - Text Color
 */
export class TTextControl extends TWindow {

    constructor(name: string, x: number, y: number, width: number, height: number) {
        super(name, x, y, width, height);

        // Default Text Style
        this.style.fontSize = 14;
        this.style.color = '#000000';
        this.style.fontWeight = 'normal';
        this.style.fontStyle = 'normal';
        this.style.textAlign = 'left';
        this.style.fontFamily = 'Arial';
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'style.fontSize', label: 'Schriftgröße', type: 'number', group: 'TYPOGRAFIE' },
            { name: 'style.fontWeight', label: 'Fett', type: 'boolean', group: 'TYPOGRAFIE' },
            { name: 'style.fontStyle', label: 'Kursiv', type: 'boolean', group: 'TYPOGRAFIE' },
            { name: 'style.textAlign', label: 'Ausrichtung', type: 'select', group: 'TYPOGRAFIE', options: ['left', 'center', 'right'] },
            { name: 'style.fontFamily', label: 'Schriftart', type: 'select', group: 'TYPOGRAFIE', options: ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Tahoma', 'Trebuchet MS'] },
            { name: 'style.color', label: 'Textfarbe', type: 'color', group: 'TYPOGRAFIE' }
        ];
    }
}
