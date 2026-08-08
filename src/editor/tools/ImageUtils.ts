/**
 * Gemeinsame Bildbearbeitungs-Hilfsfunktionen für den Editor.
 *
 * Aktuell: Chroma-Key/Hintergrund-Entfernung im YCbCr-Farbraum.
 * Wird von VideoToSpriteSheetTool und ImageTransparencyTool geteilt.
 */

export interface RgbColor { r: number; g: number; b: number; }

export function hexToRgb(color: string): RgbColor | null {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    if (!m) return null;
    return {
        r: parseInt(m[1], 16),
        g: parseInt(m[2], 16),
        b: parseInt(m[3], 16)
    };
}

/**
 * Entfernt den Hintergrund eines Bildes per Chroma-Key.
 *
 * Arbeitsweise:
 * - YCbCr-Chroma-Key: Luminanz wird ignoriert, damit abgeschattete oder
 *   aufgehellte Hintergrundbereiche derselben Farbe erfasst werden.
 * - Zusätzlicher RGB-Fallback für unbunte Hintergründe.
 * - Strikter Alpha-Blending: getroffene Pixel werden vollständig transparent.
 */
export function removeBackgroundFromImageData(
    imageData: ImageData,
    color: string,
    tolerance: number
): ImageData {
    const bg = hexToRgb(color);
    if (!bg) return imageData;

    // YCbCr-Konvertierung (nur Cb/Cr, Y wird ignoriert)
    const cb = (r: number, g: number, b: number) => -0.169 * r - 0.331 * g + 0.5 * b;
    const cr = (r: number, g: number, b: number) => 0.5 * r - 0.419 * g - 0.081 * b;

    const keyCb = cb(bg.r, bg.g, bg.b);
    const keyCr = cr(bg.r, bg.g, bg.b);

    const chromaThreshold = 8 + (tolerance / 100) * 120;
    const rgbThreshold = 12 + (tolerance / 100) * 200;

    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const dCb = cb(r, g, b) - keyCb;
        const dCr = cr(r, g, b) - keyCr;
        const chromaDist = Math.sqrt(dCb * dCb + dCr * dCr);

        const dr = r - bg.r;
        const dg = g - bg.g;
        const db = b - bg.b;
        const rgbDist = Math.sqrt(dr * dr + dg * dg + db * db);

        if (chromaDist <= chromaThreshold || rgbDist <= rgbThreshold) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 0;
        }
    }

    return new ImageData(data, imageData.width, imageData.height);
}
