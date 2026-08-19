/**
 * Gemeinsame Bildbearbeitungs-Hilfsfunktionen für den Editor.
 *
 * Aktuell: Chroma-Key/Hintergrund-Entfernung im YCbCr-Farbraum.
 * Wird von VideoToSpriteSheetTool und ImageTransparencyTool geteilt.
 */

export interface RgbColor { r: number; g: number; b: number; }

interface KeyColor extends RgbColor {
    keyCb: number;
    keyCr: number;
}

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
 * - Unterstützt mehrere Keyfarben nacheinander.
 */
export function removeBackgroundFromImageData(
    imageData: ImageData,
    color: string | string[],
    tolerance: number
): ImageData {
    const colorStrings = Array.isArray(color) ? color : [color];

    // YCbCr-Konvertierung (nur Cb/Cr, Y wird ignoriert)
    const cb = (r: number, g: number, b: number) => -0.169 * r - 0.331 * g + 0.5 * b;
    const cr = (r: number, g: number, b: number) => 0.5 * r - 0.419 * g - 0.081 * b;

    const keyColors: KeyColor[] = colorStrings
        .map((c): KeyColor | null => {
            const bg = hexToRgb(c);
            if (!bg) return null;
            return {
                r: bg.r,
                g: bg.g,
                b: bg.b,
                keyCb: cb(bg.r, bg.g, bg.b),
                keyCr: cr(bg.r, bg.g, bg.b)
            };
        })
        .filter((c): c is KeyColor => c !== null);

    const chromaThreshold = 8 + (tolerance / 100) * 120;
    const rgbThreshold = 12 + (tolerance / 100) * 200;

    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        for (const key of keyColors) {
            const dCb = cb(r, g, b) - key.keyCb;
            const dCr = cr(r, g, b) - key.keyCr;
            const chromaDist = Math.sqrt(dCb * dCb + dCr * dCr);

            const dr = r - key.r;
            const dg = g - key.g;
            const db = b - key.b;
            const rgbDist = Math.sqrt(dr * dr + dg * dg + db * db);

            if (chromaDist <= chromaThreshold || rgbDist <= rgbThreshold) {
                data[i] = 0;
                data[i + 1] = 0;
                data[i + 2] = 0;
                data[i + 3] = 0;
                break;
            }
        }
    }

    return new ImageData(data, imageData.width, imageData.height);
}

/**
 * Verkleinert ein einzelnes Frame mit alpha-gewichteter Mittelung.
 *
 * Eine gewoehnliche Mittelung zieht die Farbe transparenter Pixel (meist Schwarz)
 * in die Kanten und erzeugt dunkle Saeume. Hier bestimmt das Alpha das Gewicht:
 * voellig transparente Pixel steuern keine Farbe bei, ihr Alpha zaehlt aber
 * weiterhin fuer die Deckkraft des Zielpixels.
 *
 * Die Funktion arbeitet auf ImageData, damit sie weder vom Quellformat noch von
 * einem Canvas abhaengt.
 */
export function downscaleFrameAlphaWeighted(
    src: ImageData,
    dstWidth: number,
    dstHeight: number
): ImageData {
    if (dstWidth <= 0 || dstHeight <= 0) {
        throw new Error(`downscaleFrameAlphaWeighted: Zielmasse ungueltig ${dstWidth}x${dstHeight}`);
    }
    if (!src || !src.data || src.width <= 0 || src.height <= 0) {
        throw new Error('downscaleFrameAlphaWeighted: Quell-ImageData ungueltig');
    }

    const out = new Uint8ClampedArray(dstWidth * dstHeight * 4);
    const xRatio = src.width / dstWidth;
    const yRatio = src.height / dstHeight;

    for (let dy = 0; dy < dstHeight; dy++) {
        const y0 = Math.floor(dy * yRatio);
        const y1 = Math.max(y0 + 1, Math.floor((dy + 1) * yRatio));

        for (let dx = 0; dx < dstWidth; dx++) {
            const x0 = Math.floor(dx * xRatio);
            const x1 = Math.max(x0 + 1, Math.floor((dx + 1) * xRatio));

            let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;

            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    const i = (y * src.width + x) * 4;
                    const a = src.data[i + 3];
                    rSum += src.data[i] * a;
                    gSum += src.data[i + 1] * a;
                    bSum += src.data[i + 2] * a;
                    aSum += a;
                    count++;
                }
            }

            const o = (dy * dstWidth + dx) * 4;
            if (aSum > 0) {
                out[o] = rSum / aSum;
                out[o + 1] = gSum / aSum;
                out[o + 2] = bSum / aSum;
                out[o + 3] = aSum / count;
            } else {
                out[o] = 0;
                out[o + 1] = 0;
                out[o + 2] = 0;
                out[o + 3] = 0;
            }
        }
    }

    return new ImageData(out, dstWidth, dstHeight);
}
