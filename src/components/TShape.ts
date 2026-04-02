import { TPanel } from './TPanel';
import { TPropertyDef } from './TComponent';

export type ShapeType = 'circle' | 'rect' | 'square' | 'ellipse' | 'triangle' | 'arrow' | 'line';

/**
 * TShape - Vielseitige Grafik-Komponente
 * 
 * Unterstützt verschiedene geometrische Formen und dient als Container
 * für Kind-Komponenten (z.B. Emojis via TLabel).
 */
export class TShape extends TPanel {
    public shapeType: ShapeType = 'circle';

    // Style properties
    public fillColor: string = 'transparent';
    public strokeColor: string = '#29b6f6';
    public strokeWidth: number = 2;
    public opacity: number = 1.0;

    // New Content properties
    public text: string = '';
    public contentImage: string = '';

    constructor(name: string, x: number, y: number, width: number = 4, height: number = 4) {
        super(name, x, y, width, height);

        // Default appearance
        this.style.backgroundColor = 'transparent'; // We use fillColor instead
        this.style.borderWidth = 0; // We use strokeWidth instead
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();

        // Filter out redundant panel properties
        const filtered = props.filter(p => !['showGrid', 'gridColor', 'gridStyle', 'caption'].includes(p.name));

        return [
            ...filtered,
            {
                name: 'shapeType',
                label: 'Form-Typ',
                type: 'select',
                group: 'FORM',
                options: ['circle', 'rect', 'square', 'ellipse', 'triangle', 'arrow', 'line']
            },
            { name: 'fillColor', label: 'Füllfarbe', type: 'color', group: 'FORM' },
            { name: 'strokeColor', label: 'Linienfarbe (Rand)', type: 'color', group: 'FORM' },
            { name: 'strokeWidth', label: 'Linienstärke', type: 'number', group: 'FORM' },
            { name: 'opacity', label: 'Deckkraft', type: 'number', group: 'FORM', min: 0, max: 1, step: 0.1 },
            // Content group
            { name: 'text', label: 'Text/Emoji', type: 'string', group: 'INHALT' },
            { name: 'contentImage', label: 'Bild-Inhalt', type: 'image_picker', group: 'INHALT' }
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            shapeType: this.shapeType,
            fillColor: this.fillColor,
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
            opacity: this.opacity,
            text: this.text,
            contentImage: this.contentImage
        };
    }
}
