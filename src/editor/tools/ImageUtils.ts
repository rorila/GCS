/**
 * Gemeinsame Bildbearbeitungs-Hilfsfunktionen für den Editor.
 *
 * Chroma-Key/Hintergrund-Entfernung, Trimmen, Skalieren, Sprite-Sheet-Erzeugung
 * und Spiel-Textur-Checks. Wird von ImageOptimizerTool und VideoToSpriteSheetTool geteilt.
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

export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Ermittelt das umschließende Rechteck aller nicht-transparenten Pixel.
 */
export function getContentBounds(imageData: ImageData): Bounds {
    const { width, height, data } = imageData;
    let minX = width, minY = height, maxX = -1, maxY = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (data[i + 3] > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX === -1) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }

    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Entfernt transparente Ränder und gibt nur das sichtbare Bild zurück.
 */
export function trimImageData(imageData: ImageData): ImageData {
    const bounds = getContentBounds(imageData);
    if (bounds.width === 0 || bounds.height === 0) {
        return new ImageData(new Uint8ClampedArray(bounds.width * bounds.height * 4), bounds.width, bounds.height);
    }

    const src = imageData.data;
    const { x, y, width, height } = bounds;
    const out = new Uint8ClampedArray(width * height * 4);

    for (let row = 0; row < height; row++) {
        const srcOffset = ((y + row) * imageData.width + x) * 4;
        const dstOffset = row * width * 4;
        out.set(src.subarray(srcOffset, srcOffset + width * 4), dstOffset);
    }

    return new ImageData(out, width, height);
}

/**
 * Skaliert ImageData auf eine Zielgröße.
 * Verkleinerungen nutzen das bestehende alpha-gewichtete Downsampling;
 * Vergrößerungen nutzen Nearest-Neighbor.
 */
export function resizeImageData(imageData: ImageData, width: number, height: number): ImageData {
    if (width === imageData.width && height === imageData.height) {
        return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    }

    if (width <= imageData.width && height <= imageData.height) {
        return downscaleFrameAlphaWeighted(imageData, width, height);
    }

    const src = imageData.data;
    const out = new Uint8ClampedArray(width * height * 4);
    const xRatio = imageData.width / width;
    const yRatio = imageData.height / height;

    for (let dy = 0; dy < height; dy++) {
        const sy = Math.min(Math.floor(dy * yRatio), imageData.height - 1);
        for (let dx = 0; dx < width; dx++) {
            const sx = Math.min(Math.floor(dx * xRatio), imageData.width - 1);
            const srcI = (sy * imageData.width + sx) * 4;
            const dstI = (dy * width + dx) * 4;
            out[dstI] = src[srcI];
            out[dstI + 1] = src[srcI + 1];
            out[dstI + 2] = src[srcI + 2];
            out[dstI + 3] = src[srcI + 3];
        }
    }

    return new ImageData(out, width, height);
}

export interface SpriteSheetLayout {
    imageData: ImageData;
    columns: number;
    rows: number;
    frameWidth: number;
    frameHeight: number;
}

/**
 * Fügt mehrere gleich-große Frames zu einem Sprite-Sheet zusammen.
 */
export function generateSpriteSheet(
    frames: ImageData[],
    columns: number,
    padding: number
): SpriteSheetLayout {
    if (frames.length === 0) {
        throw new Error('generateSpriteSheet: Keine Frames übergeben');
    }

    const columnsSafe = Math.max(1, columns);
    const rows = Math.ceil(frames.length / columnsSafe);
    let frameWidth = 0;
    let frameHeight = 0;

    for (const frame of frames) {
        frameWidth = Math.max(frameWidth, frame.width);
        frameHeight = Math.max(frameHeight, frame.height);
    }

    const outWidth = columnsSafe * (frameWidth + padding);
    const outHeight = rows * (frameHeight + padding);
    const out = new Uint8ClampedArray(outWidth * outHeight * 4);

    // komplett transparent initialisieren
    for (let i = 3; i < out.length; i += 4) {
        out[i] = 0;
    }

    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const col = i % columnsSafe;
        const row = Math.floor(i / columnsSafe);
        const offsetX = col * (frameWidth + padding);
        const offsetY = row * (frameHeight + padding);

        for (let fy = 0; fy < frame.height; fy++) {
            for (let fx = 0; fx < frame.width; fx++) {
                const srcI = (fy * frame.width + fx) * 4;
                const dstI = ((offsetY + fy) * outWidth + offsetX + fx) * 4;
                out[dstI] = frame.data[srcI];
                out[dstI + 1] = frame.data[srcI + 1];
                out[dstI + 2] = frame.data[srcI + 2];
                out[dstI + 3] = frame.data[srcI + 3];
            }
        }
    }

    return {
        imageData: new ImageData(out, outWidth, outHeight),
        columns: columnsSafe,
        rows,
        frameWidth,
        frameHeight
    };
}

export const MAX_SAFE_TEXTURE_SIZE = 2048;

export function isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Prüft eine Textur auf typische Spiele-Probleme.
 */
export function getTextureWarnings(width: number, height: number): string[] {
    const warnings: string[] = [];

    if (width > MAX_SAFE_TEXTURE_SIZE || height > MAX_SAFE_TEXTURE_SIZE) {
        warnings.push(`Texturgröße ${width}x${height} übersteigt ${MAX_SAFE_TEXTURE_SIZE}px - ältere GPUs können das nicht laden.`);
    }

    if (!isPowerOfTwo(width) || !isPowerOfTwo(height)) {
        warnings.push('Abmessungen sind keine Potenz von 2 - bestimmte WebGL-Texturen benötigen das.');
    }

    return warnings;
}
