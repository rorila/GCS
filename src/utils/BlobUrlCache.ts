/**
 * BlobUrlCache - Wandelt Base64-Data-URLs in kurze Blob-URLs um.
 *
 * Projektbilder liegen eingebettet als Data-URL vor und sind damit mehrere
 * hundert Kilobyte lang. Jede Zuweisung an style.backgroundImage laesst den
 * CSS-Parser die komplette Nutzlast durchlaufen, und der Browser dekodiert das
 * Bild pro Vorkommen erneut. Eine Blob-URL ist rund 45 Zeichen kurz: die
 * Zuweisung wird dadurch praktisch kostenlos und das Bild nur einmal dekodiert.
 *
 * Die Umwandlung wird global zwischengespeichert. Dasselbe Bild teilt sich damit
 * ueber alle Komponenten und alle Animationen hinweg eine einzige Blob-URL —
 * ohne Cache entstuende bei jedem Aufruf ein neuer Blob, der bis zum
 * Seitenwechsel im Speicher bliebe.
 *
 * Bewusst ohne regulaeren Ausdruck: Backtracking auf einem so langen String
 * waere selbst wieder teuer. Bei unerwartetem Format bleibt der Originalwert
 * unveraendert, der Aufrufer funktioniert dann wie bisher.
 */
import { Logger } from './Logger';

const logger = Logger.get('BlobUrlCache');

/** Schluessel ist die vollstaendige Data-URL, Wert die zugehoerige Blob-URL. */
const blobUrlByDataUrl = new Map<string, string>();

/**
 * Wandelt eine reine Data-URL (`data:image/png;base64,...`) in eine Blob-URL um.
 * Andere Werte (Pfade, http-URLs, bereits umgewandelte Blob-URLs) werden
 * unveraendert zurueckgegeben.
 */
export function dataUrlToBlobUrl(src: string): string {
    if (!src || !src.startsWith('data:')) return src;

    const cached = blobUrlByDataUrl.get(src);
    if (cached) return cached;

    const comma = src.indexOf(',');
    if (comma < 0) return src;

    // Zwischen "data:" und dem Komma steht der MIME-Typ samt Kodierung.
    const meta = src.slice(5, comma);
    if (!meta.endsWith(';base64')) return src;

    try {
        const binary = atob(src.slice(comma + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: meta.slice(0, -7) });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlByDataUrl.set(src, blobUrl);
        return blobUrl;
    } catch (err) {
        logger.warn('[dataUrlToBlobUrl] Umwandlung fehlgeschlagen, nutze Original.', err);
        return src;
    }
}

/**
 * Wandelt einen CSS-Bildwert der Form `url("data:image/png;base64,...")` in
 * `url("blob:...")` um. Fuer Aufrufer, die direkt mit CSSOM-Werten arbeiten.
 */
export function cssUrlToBlobUrl(cssUrl: string): string {
    if (!cssUrl) return cssUrl;

    let inner = cssUrl.trim();
    if (!inner.startsWith('url(') || !inner.endsWith(')')) return cssUrl;

    inner = inner.slice(4, -1).trim();
    if (inner.startsWith('"') || inner.startsWith("'")) inner = inner.slice(1, -1);
    if (!inner.startsWith('data:')) return cssUrl;

    const blobUrl = dataUrlToBlobUrl(inner);
    if (blobUrl === inner) return cssUrl;

    return `url("${blobUrl}")`;
}
