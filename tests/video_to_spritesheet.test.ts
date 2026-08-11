/**
 * Integration & Unit Tests für VideoToSpriteSheetTool & ImageUtils
 *
 * Prüft Chroma-Keying (YCbCr / RGB-Fallback), Bounding-Box-Berechnung,
 * Uniform-Cropping, Spaltenwahl & Performance-Budget-Limits.
 */

import { removeBackgroundFromImageData, hexToRgb } from '../src/editor/tools/ImageUtils';
import { VideoToSpriteSheetCrop } from '../src/editor/tools/spritesheet/VideoToSpriteSheetCrop';
import { PERF } from '../src/editor/tools/spritesheet/VideoToSpriteSheetTypes';

// Canvas & ImageData Polyfill / Helper für Node.js Testumgebung
if (typeof (globalThis as any).ImageData === 'undefined') {
    (globalThis as any).ImageData = class ImageData {
        width: number;
        height: number;
        data: Uint8ClampedArray;
        constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
            if (dataOrWidth instanceof Uint8ClampedArray) {
                this.data = dataOrWidth;
                this.width = widthOrHeight;
                this.height = height || 0;
            } else {
                this.width = dataOrWidth;
                this.height = widthOrHeight;
                this.data = new Uint8ClampedArray(this.width * this.height * 4);
            }
        }
    };
}

function createMockImageData(width: number, height: number, fillColor?: [number, number, number, number]): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    if (fillColor) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = fillColor[0];
            data[i + 1] = fillColor[1];
            data[i + 2] = fillColor[2];
            data[i + 3] = fillColor[3];
        }
    }
    return new ImageData(data, width, height);
}

export function runVideoToSpriteSheetTests(): void {
    console.log('🧪 VideoToSpriteSheet & ImageUtils Tests starten...');

    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, msg: string) => {
        if (condition) {
            passed++;
        } else {
            failed++;
            console.error(`  ❌ FAILED: ${msg}`);
        }
    };

    // --- 1. hexToRgb & Chroma-Keying (ImageUtils) ---
    (() => {
        const rgb = hexToRgb('#00FF00');
        assert(rgb !== null && rgb.r === 0 && rgb.g === 255 && rgb.b === 0, 'hexToRgb wandelt #00FF00 korrekt um');

        const invalidRgb = hexToRgb('invalid');
        assert(invalidRgb === null, 'hexToRgb liefert null bei ungültigem Hex-Code');
    })();

    (() => {
        // 10x10 Bild mit grünem Hintergrund (#00FF00) und einem roten Quadrat 2x2 in der Mitte
        const img = createMockImageData(10, 10, [0, 255, 0, 255]); // Grün
        // Rotes Quadrat zeichnen bei (4,4) bis (5,5)
        for (let y = 4; y <= 5; y++) {
            for (let x = 4; x <= 5; x++) {
                const idx = (y * 10 + x) * 4;
                img.data[idx] = 255;   // R
                img.data[idx + 1] = 0; // G
                img.data[idx + 2] = 0; // B
                img.data[idx + 3] = 255;
            }
        }

        const processed = removeBackgroundFromImageData(img, '#00FF00', 30);

        // Hintergrund bei (0,0) muss jetzt voll transparent (Alpha 0) sein
        assert(processed.data[3] === 0, 'Grüner Hintergrund (0,0) wurde transparent gemacht');

        // Rotes Quadrat bei (4,4) muss deckend (Alpha 255) bleiben
        const redIdx = (4 * 10 + 4) * 4;
        assert(processed.data[redIdx] === 255 && processed.data[redIdx + 3] === 255, 'Roter Vordergrund (4,4) blieb unverändert erhalten');
    })();

    // --- 2. Bounding-Box Berechnung (VideoToSpriteSheetCrop) ---
    (() => {
        // Leeres/transparentes Bild
        const emptyImg = createMockImageData(20, 20, [0, 0, 0, 0]);
        const emptyBbox = VideoToSpriteSheetCrop.computeBbox(emptyImg);
        assert(emptyBbox.w === 20 && emptyBbox.h === 20, 'computeBbox fällt bei leerem Bild auf volle Bildgröße zurück');

        // Bild mit deutlichem Objekt von x=5..14, y=6..15
        const img = createMockImageData(20, 20, [0, 0, 0, 0]);
        for (let y = 6; y <= 15; y++) {
            for (let x = 5; x <= 14; x++) {
                const idx = (y * 20 + x) * 4;
                img.data[idx] = 255;
                img.data[idx + 3] = 255;
            }
        }

        const bbox = VideoToSpriteSheetCrop.computeBbox(img);
        assert(bbox.x === 5 && bbox.y === 6 && bbox.w === 10 && bbox.h === 10, `computeBbox berechnet exakte Objektgrenzen (x=${bbox.x}, y=${bbox.y}, w=${bbox.w}, h=${bbox.h})`);
    })();

    // --- 3. Uniform Crop über mehrere Frames ---
    (() => {
        const frame1 = createMockImageData(20, 20, [0, 0, 0, 0]);
        // Objekt 4x4 bei (2,2)
        for (let y = 2; y <= 5; y++) {
            for (let x = 2; x <= 5; x++) {
                const idx = (y * 20 + x) * 4;
                frame1.data[idx] = 255; frame1.data[idx + 3] = 255;
            }
        }

        const frame2 = createMockImageData(20, 20, [0, 0, 0, 0]);
        // Objekt 6x6 bei (10,10)
        for (let y = 10; y <= 15; y++) {
            for (let x = 10; x <= 15; x++) {
                const idx = (y * 20 + x) * 4;
                frame2.data[idx] = 255; frame2.data[idx + 3] = 255;
            }
        }

        const cropRes = VideoToSpriteSheetCrop.computeUniformCrop([frame1, frame2], 1);
        // maxW=6, maxH=6, padding=1 -> w=8, h=8
        assert(cropRes.w === 8 && cropRes.h === 8, `computeUniformCrop ermittelt maximale Dimension inkl. Padding (w=${cropRes.w}, h=${cropRes.h})`);
        assert(cropRes.rects.length === 2, 'computeUniformCrop liefert Zuschnittsrechtecke für alle Frames');
    })();

    // --- 4. Frame-Größenbegrenzung (Performance Limits) ---
    (() => {
        const res = VideoToSpriteSheetCrop.calculateLimitedFrameSize(512, 256, PERF.MAX_FRAME_EDGE);
        // Longest edge 512, limit 256 -> scale 0.5 -> cellW=256, cellH=128
        assert(res.cellW === 256 && res.cellH === 128, `calculateLimitedFrameSize skaliert Bild (512x256 -> ${res.cellW}x${res.cellH}) unter Beibehaltung des Seitenverhältnisses`);

        const noScale = VideoToSpriteSheetCrop.calculateLimitedFrameSize(128, 128, PERF.MAX_FRAME_EDGE);
        assert(noScale.cellW === 128 && noScale.cellH === 128, 'calculateLimitedFrameSize verändert Bilder innerhalb des Limits nicht');
    })();

    // --- 5. Raster-Spaltenberechnung (Sheet Columns) ---
    (() => {
        // Auto-Spalten bei 16 Frames 100x100 -> ideal 4 Spalten (400x400 Sheet)
        const cols = VideoToSpriteSheetCrop.computeSheetColumns(16, 100, 100, true, 4);
        assert(cols === 4, `computeSheetColumns wählt für 16 quadratische Frames automatisch 4 Spalten (Cols: ${cols})`);

        // Manuelle Spaltenwahl erzwingen (autoColumns = false)
        const manualCols = VideoToSpriteSheetCrop.computeSheetColumns(16, 100, 100, false, 8);
        assert(manualCols === 8, 'computeSheetColumns respektiert manuelle Spaltenanzahl bei autoColumns=false');
    })();

    console.log(`  VideoToSpriteSheet: ${passed} bestanden, ${failed} fehlgeschlagen\n`);

    if (failed > 0) {
        throw new Error(`VideoToSpriteSheet Tests fehlgeschlagen: ${failed} Fehler`);
    }
}

// Direkte Ausführung im Testrunner
if (process.argv[1] && process.argv[1].endsWith('video_to_spritesheet.test.ts')) {
    runVideoToSpriteSheetTests();
}
