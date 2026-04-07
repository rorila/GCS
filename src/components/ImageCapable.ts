/**
 * ImageCapable - Typen und Helper für Bild-Unterstützung
 * 
 * Da TWindow ein reines Datenmodell ist (ohne DOM-Element), 
 * werden nur die Properties definiert. Das eigentliche <img> Element 
 * wird vom Renderer erstellt.
 */

export type ImageFit = 'cover' | 'contain' | 'fill' | 'none';

export interface ImageCapableProps {
    backgroundImage: string;
    objectFit: ImageFit;
    imageOpacity: number;
}

/**
 * Default-Werte für ImageCapable-Properties
 */
export const IMAGE_DEFAULTS: ImageCapableProps = {
    backgroundImage: '',
    objectFit: 'contain',
    imageOpacity: 1
};

/**
 * Erstellt die CSS-Styles für ein Hintergrundbild
 */
export function getImageStyles(props: Partial<ImageCapableProps>): Record<string, string> {
    const src = props.backgroundImage || '';
    if (!src) return {};

    // URL normalisieren
    const imageUrl = src.startsWith('http') || src.startsWith('/') || src.startsWith('.') || src.startsWith('data:')
        ? src
        : `/images/${src}`;

    return {
        backgroundImage: `url('${imageUrl}')`,
        backgroundSize: props.objectFit || 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
    };
}

/**
 * Konvertiert ImageFit zu CSS background-size
 */
export function objectFitToBackgroundSize(fit: ImageFit): string {
    switch (fit) {
        case 'cover': return 'cover';
        case 'contain': return 'contain';
        case 'fill': return '100% 100%';
        case 'none': return 'auto';
        default: return 'contain';
    }
}
