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
            { name: 'text', label: 'Inhalt', type: 'textarea', group: 'INHALT' }
            // TYPOGRAFIE-Felder (fontSize, fontWeight, fontStyle, textAlign, fontFamily)
            // kommen bereits von TWindow.getInspectorProperties() – NICHT doppelt hinzufügen!
        ];
    }
}
