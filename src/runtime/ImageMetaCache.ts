/**
 * ImageMetaCache - Natuerliche Bildmasse pro Quelle, einmal ermittelt.
 *
 * Der SpriteRenderer arbeitet mit Prozentwerten und kennt die Pixelmasse eines
 * Spritesheets nicht. Fuer eine verzerrungsfreie Einpassung wird aber das
 * Seitenverhaeltnis des Frames gebraucht. Dieser Cache liefert es, ohne pro
 * Frame etwas zu messen.
 *
 * Im Standalone-Player wird er vom bestehenden Vorladen kostenlos mitbefuellt,
 * im Editor bei Bedarf nachgeladen.
 */

export interface ImageMeta {
    width: number;
    height: number;
}

export class ImageMetaCache {
    private static sizes = new Map<string, ImageMeta>();
    private static pending = new Set<string>();

    /**
     * Vereinheitlicht Pfadvarianten. Der SpriteRenderer bildet "./images/x",
     * das Vorladen im Player "/images/x" -- ohne Normalisierung wuerde der Cache
     * dauerhaft ins Leere greifen.
     */
    private static normalizeKey(src: string): string {
        if (!src) return '';
        if (src.startsWith('data:') || src.startsWith('http')) return src;
        let key = src;
        if (key.startsWith('./')) key = key.substring(2);
        if (key.startsWith('/')) key = key.substring(1);
        return key;
    }

    public static get(src: string): ImageMeta | null {
        if (!src) return null;
        return this.sizes.get(this.normalizeKey(src)) || null;
    }

    public static set(src: string, width: number, height: number): void {
        if (src && width > 0 && height > 0) {
            this.sizes.set(this.normalizeKey(src), { width, height });
        }
    }

    public static has(src: string): boolean {
        return !!src && this.sizes.has(this.normalizeKey(src));
    }

    /**
     * Laedt die Masse nachtraeglich. Der Callback erlaubt dem Aufrufer, die
     * betroffene Darstellung danach einmalig zu erneuern. Mehrfachaufrufe fuer
     * dieselbe Quelle werden zusammengefasst.
     */
    public static ensure(src: string, onLoaded?: () => void): void {
        const key = this.normalizeKey(src);
        if (!key || this.sizes.has(key) || this.pending.has(key)) return;
        this.pending.add(key);

        const img = new Image();
        img.onload = () => {
            this.pending.delete(key);
            this.set(src, img.naturalWidth, img.naturalHeight);
            if (onLoaded) onLoaded();
        };
        img.onerror = () => {
            this.pending.delete(key);
        };
        // Geladen wird mit der Originaladresse, gespeichert unter dem Normalschluessel.
        img.src = src;
    }
}
