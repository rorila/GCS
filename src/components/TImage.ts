import { TPanel } from './TPanel';
import { TPropertyDef } from './TComponent';
import { ImageFit, IMAGE_DEFAULTS } from './ImageCapable';

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
    // Bild-Properties
    private _backgroundImage: string = IMAGE_DEFAULTS.backgroundImage;
    private _objectFit: ImageFit = IMAGE_DEFAULTS.objectFit;
    private _imageOpacity: number = IMAGE_DEFAULTS.imageOpacity;

    // Fallback-Farbe wenn kein Bild geladen
    public fallbackColor: string = '#2a2a2a';

    // Alt-Text für Barrierefreiheit
    public alt: string = '';

    constructor(name: string, x: number, y: number, width: number = 8, height: number = 6) {
        super(name, x, y, width, height);

        // Default-Style für Bild-Container
        this.style.backgroundColor = 'transparent';
        this.style.borderWidth = 0;
    }

    // ─────────────────────────────────────────────
    // Bild-Properties
    // ─────────────────────────────────────────────

    get src(): string {
        return this._backgroundImage;
    }

    set src(value: string) {
        this._backgroundImage = value || '';
    }

    // Alias für Kompatibilität
    get backgroundImage(): string {
        return this._backgroundImage;
    }

    set backgroundImage(value: string) {
        this._backgroundImage = value || '';
    }

    get objectFit(): ImageFit {
        return this._objectFit;
    }

    set objectFit(value: ImageFit) {
        this._objectFit = value;
    }

    get imageOpacity(): number {
        return this._imageOpacity;
    }

    set imageOpacity(value: number) {
        this._imageOpacity = Math.max(0, Math.min(1, value));
    }

    // ─────────────────────────────────────────────
    // Inspector Properties
    // ─────────────────────────────────────────────

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();

        // Entferne Grid-Optionen und Caption (nicht relevant für Bilder)
        const filtered = props.filter(p =>
            !['showGrid', 'gridColor', 'gridStyle', 'caption'].includes(p.name)
        );

        return [
            ...filtered,
            // Image-Gruppe
            { name: 'src', label: 'Bildquelle', type: 'image_picker', group: 'BILD' },
            {
                name: 'objectFit', label: 'Skalierung', type: 'select', group: 'BILD',
                options: ['cover', 'contain', 'fill', 'none']
            },
            { name: 'alt', label: 'Alt-Text', type: 'string', group: 'BILD' },
            { name: 'imageOpacity', label: 'Bild-Deckkraft', type: 'number', group: 'BILD', min: 0, max: 1, step: 0.1 },
            { name: 'fallbackColor', label: 'Fallback-Farbe', type: 'color', group: 'BILD' }
        ];
    }

    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────
}
