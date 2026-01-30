import { TPanel } from './TPanel';
/**
 * TShape - Vielseitige Grafik-Komponente
 *
 * Unterstützt verschiedene geometrische Formen und dient als Container
 * für Kind-Komponenten (z.B. Emojis via TLabel).
 */
export class TShape extends TPanel {
    constructor(name, x, y, width = 100, height = 100) {
        super(name, x, y, width, height);
        this.shapeType = 'circle';
        // Style properties
        this.fillColor = 'transparent';
        this.strokeColor = '#29b6f6';
        this.strokeWidth = 2;
        this.opacity = 1.0;
        // New Content properties
        this.text = '';
        this.contentImage = '';
        // Default appearance
        this.style.backgroundColor = 'transparent'; // We use fillColor instead
        this.style.borderWidth = 0; // We use strokeWidth instead
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        // Filter out redundant panel properties
        const filtered = props.filter(p => !['showGrid', 'gridColor', 'gridStyle', 'caption'].includes(p.name));
        return [
            ...filtered,
            {
                name: 'shapeType',
                label: 'Form-Typ',
                type: 'select',
                group: 'Form',
                options: ['circle', 'rect', 'square', 'ellipse', 'triangle', 'arrow', 'line']
            },
            { name: 'fillColor', label: 'Füllfarbe', type: 'color', group: 'Form' },
            { name: 'strokeColor', label: 'Linienfarbe (Rand)', type: 'color', group: 'Form' },
            { name: 'strokeWidth', label: 'Linienstärke', type: 'number', group: 'Form' },
            { name: 'opacity', label: 'Deckkraft', type: 'number', group: 'Form' },
            // Content group
            { name: 'text', label: 'Text/Emoji', type: 'string', group: 'Inhalt' },
            { name: 'contentImage', label: 'Bild-Inhalt', type: 'image_picker', group: 'Inhalt' }
        ];
    }
    toJSON() {
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
