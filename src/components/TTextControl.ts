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
            { name: 'style.fontSize', label: 'Font Size', type: 'number', group: 'Typography' },
            { name: 'style.fontWeight', label: 'Bold', type: 'boolean', group: 'Typography' },
            { name: 'style.fontStyle', label: 'Italic', type: 'boolean', group: 'Typography' },
            { name: 'style.textAlign', label: 'Align', type: 'select', group: 'Typography', options: ['left', 'center', 'right'] },
            { name: 'style.fontFamily', label: 'Font Family', type: 'select', group: 'Typography', options: ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Tahoma', 'Trebuchet MS'] },
            { name: 'style.color', label: 'Text Color', type: 'color', group: 'Typography' }
        ];
    }
}
