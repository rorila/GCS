import { TPanel } from './TPanel';
import { IMAGE_DEFAULTS } from './ImageCapable';
/**
 * TImage - Eigenständige Bild-Komponente
 *
 * Zeigt ein Bild an, das auf dem Server gespeichert ist.
 * Erbt von TPanel für Container-Funktionalität.
 *
 * Das eigentliche Rendering erfolgt durch den Stage-Renderer,
 * diese Klasse hält nur die Daten.
 */
export class TImage extends TPanel {
    constructor(name, x, y, width = 100, height = 100) {
        super(name, x, y, width, height);
        // Bild-Properties
        this._backgroundImage = IMAGE_DEFAULTS.backgroundImage;
        this._objectFit = IMAGE_DEFAULTS.objectFit;
        this._imageOpacity = IMAGE_DEFAULTS.imageOpacity;
        // Fallback-Farbe wenn kein Bild geladen
        this.fallbackColor = '#2a2a2a';
        // Alt-Text für Barrierefreiheit
        this.alt = '';
        // Default-Style für Bild-Container
        this.style.backgroundColor = this.fallbackColor;
        this.style.borderWidth = 0;
    }
    // ─────────────────────────────────────────────
    // Bild-Properties
    // ─────────────────────────────────────────────
    get src() {
        return this._backgroundImage;
    }
    set src(value) {
        this._backgroundImage = value || '';
    }
    // Alias für Kompatibilität
    get backgroundImage() {
        return this._backgroundImage;
    }
    set backgroundImage(value) {
        this._backgroundImage = value || '';
    }
    get objectFit() {
        return this._objectFit;
    }
    set objectFit(value) {
        this._objectFit = value;
    }
    get imageOpacity() {
        return this._imageOpacity;
    }
    set imageOpacity(value) {
        this._imageOpacity = Math.max(0, Math.min(1, value));
    }
    // ─────────────────────────────────────────────
    // Inspector Properties
    // ─────────────────────────────────────────────
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        // Entferne Grid-Optionen und Caption (nicht relevant für Bilder)
        const filtered = props.filter(p => !['showGrid', 'gridColor', 'gridStyle', 'caption'].includes(p.name));
        return [
            ...filtered,
            // Image-Gruppe
            { name: 'src', label: 'Image Path', type: 'image_picker', group: 'Image' },
            {
                name: 'objectFit', label: 'Object Fit', type: 'select', group: 'Image',
                options: ['cover', 'contain', 'fill', 'none']
            },
            { name: 'alt', label: 'Alt Text', type: 'string', group: 'Image' },
            { name: 'imageOpacity', label: 'Opacity', type: 'number', group: 'Image' },
            { name: 'fallbackColor', label: 'Fallback Color', type: 'color', group: 'Image' }
        ];
    }
    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────
    toJSON() {
        return {
            ...super.toJSON(),
            backgroundImage: this._backgroundImage,
            src: this._backgroundImage, // Alias for Inspector compatibility
            objectFit: this._objectFit,
            imageOpacity: this._imageOpacity,
            alt: this.alt,
            fallbackColor: this.fallbackColor
        };
    }
}
