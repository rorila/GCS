/**
 * VideoToSpriteSheetCrop
 *
 * Algorithmen für Bounding-Box-Berechnung, rauschrobustes Auto-Cropping,
 * einheitlichen Frame-Zuschnitt und Raster-Optimierung.
 */

import { Logger } from '../../../utils/Logger';
import { CropRect, PERF } from './VideoToSpriteSheetTypes';

const logger = Logger.get('VideoToSpriteSheetCrop');

export class VideoToSpriteSheetCrop {
    /** Ab diesem Alpha-Wert gilt ein Pixel als zum Objekt gehörend (filtert Anti-Aliasing-Ränder). */
    public static readonly BBOX_ALPHA_THRESHOLD = 16;

    /** Mindestanteil deckender Pixel, damit eine Zeile/Spalte als Objekt zählt (filtert Störpixel). */
    public static readonly BBOX_MIN_DENSITY = 0.005;

    /**
     * Bounding-Box der deckenden Pixel — rauschrobust.
     *
     * Ein einzelner übrig gebliebener Pixel (Kompressionsrauschen, Bildrand,
     * Wasserzeichen) würde eine naive Bounding-Box auf das ganze Bild aufziehen.
     * Deshalb werden Zeilen/Spalten nur berücksichtigt, wenn sie eine Mindestzahl
     * deckender Pixel enthalten.
     */
    public static computeBbox(imageData: ImageData): CropRect {
        const { width, height, data } = imageData;

        const rowCounts = new Uint32Array(height);
        const colCounts = new Uint32Array(width);
        let opaqueTotal = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (data[(y * width + x) * 4 + 3] > VideoToSpriteSheetCrop.BBOX_ALPHA_THRESHOLD) {
                    rowCounts[y]++;
                    colCounts[x]++;
                    opaqueTotal++;
                }
            }
        }

        if (opaqueTotal === 0) return { x: 0, y: 0, w: width, h: height };

        const findRange = (counts: Uint32Array, minCount: number): { start: number; end: number } | null => {
            let start = -1, end = -1;
            for (let i = 0; i < counts.length; i++) {
                if (counts[i] >= minCount) {
                    if (start === -1) start = i;
                    end = i;
                }
            }
            return start === -1 ? null : { start, end };
        };

        const rowMin = Math.max(2, Math.ceil(width * VideoToSpriteSheetCrop.BBOX_MIN_DENSITY));
        const colMin = Math.max(2, Math.ceil(height * VideoToSpriteSheetCrop.BBOX_MIN_DENSITY));

        // Fällt das Objekt durch die Dichteprüfung (sehr kleines/dünnes Objekt),
        // fallen wir auf "mindestens ein Pixel" zurück.
        const rows = findRange(rowCounts, rowMin) ?? findRange(rowCounts, 1);
        const cols = findRange(colCounts, colMin) ?? findRange(colCounts, 1);

        if (!rows || !cols) return { x: 0, y: 0, w: width, h: height };

        return {
            x: cols.start,
            y: rows.start,
            w: cols.end - cols.start + 1,
            h: rows.end - rows.start + 1
        };
    }

    /**
     * Ermittelt eine für alle Frames einheitliche Zuschnittsgröße.
     *
     * Die Größe ergibt sich aus dem Frame, dessen Objekt am meisten Platz braucht
     * (Maximum der einzelnen Bounding-Box-Breiten bzw. -Höhen), nicht aus deren
     * Vereinigung. Dadurch fließt die Bewegung des Objekts durch das Bild nicht
     * in die Rahmengröße ein und es bleibt möglichst wenig Hintergrund übrig.
     *
     * Jeder Frame erhält denselben Rahmen, zentriert auf die Mitte seiner eigenen
     * Bounding-Box und in die Bildgrenzen zurückgeschoben.
     */
    public static computeUniformCrop(
        frames: ImageData[],
        padding: number
    ): { w: number; h: number; rects: { x: number; y: number }[] } {

        if (frames.length === 0) {
            return { w: 0, h: 0, rects: [] };
        }

        const imageW = frames[0].width;
        const imageH = frames[0].height;

        const bboxes = frames.map(f => VideoToSpriteSheetCrop.computeBbox(f));

        const maxW = Math.max(...bboxes.map(b => b.w));
        const maxH = Math.max(...bboxes.map(b => b.h));

        const w = Math.min(imageW, Math.max(1, Math.ceil(maxW + padding * 2)));
        const h = Math.min(imageH, Math.max(1, Math.ceil(maxH + padding * 2)));

        const minBoxW = Math.min(...bboxes.map(b => b.w));
        const minBoxH = Math.min(...bboxes.map(b => b.h));
        logger.info(
            `Auto-Crop: Video ${imageW}x${imageH} | ` +
            `Bbox min ${minBoxW}x${minBoxH}, max ${maxW}x${maxH} | ` +
            `Rahmen ${w}x${h} (${((w / imageW) * 100).toFixed(0)}% x ${((h / imageH) * 100).toFixed(0)}% des Bildes)`
        );

        const rects = bboxes.map(b => {
            const centerX = b.x + b.w / 2;
            const centerY = b.y + b.h / 2;
            return {
                x: Math.max(0, Math.min(imageW - w, Math.round(centerX - w / 2))),
                y: Math.max(0, Math.min(imageH - h, Math.round(centerY - h / 2)))
            };
        });

        return { w, h, rects };
    }

    /**
     * Begrenzt die Frame-Zelle auf `maxFrameSize`, ohne das Seitenverhältnis zu verändern.
     */
    public static calculateLimitedFrameSize(cropW: number, cropH: number, maxFrameSize: number): { cellW: number; cellH: number; logMsg?: string } {
        const limit = Math.round(maxFrameSize) || 0;
        if (limit <= 0) return { cellW: cropW, cellH: cropH };

        const longest = Math.max(cropW, cropH);
        if (longest <= limit) return { cellW: cropW, cellH: cropH };

        const scale = limit / longest;
        const cellW = Math.max(1, Math.round(cropW * scale));
        const cellH = Math.max(1, Math.round(cropH * scale));

        const logMsg = `Frame verkleinert: ${cropW}x${cropH} → ${cellW}x${cellH}px (Grenze ${limit}px). Spart etwa ${(100 - scale * scale * 100).toFixed(0)}% Speicher pro Frame.`;
        return { cellW, cellH, logMsg };
    }

    /**
     * Ermittelt die Spaltenzahl. Bei `autoColumns` wird ein möglichst quadratisches
     * Sheet angestrebt, dessen Kanten die GPU-taugliche Grenze nicht überschreiten.
     */
    public static computeSheetColumns(
        frameCount: number,
        cellW: number,
        cellH: number,
        autoColumns: boolean,
        manualColumns: number,
        onLog?: (msg: string) => void
    ): number {
        const manual = Math.max(1, Math.min(Math.round(manualColumns) || 1, frameCount));
        if (!autoColumns) return manual;

        let best = 0;
        let bestRatio = Number.POSITIVE_INFINITY;

        for (let cols = 1; cols <= frameCount; cols++) {
            const rows = Math.ceil(frameCount / cols);
            const w = cols * cellW;
            const h = rows * cellH;
            if (w > PERF.MAX_SHEET_EDGE || h > PERF.MAX_SHEET_EDGE) continue;

            const ratio = Math.max(w, h) / Math.min(w, h);
            if (ratio < bestRatio) {
                bestRatio = ratio;
                best = cols;
            }
        }

        if (best === 0) {
            const fallback = Math.max(1, Math.ceil(Math.sqrt(frameCount)));
            if (onLog) {
                onLog(
                    `Kein Raster unter ${PERF.MAX_SHEET_EDGE}px möglich: ${frameCount} Frames à ${cellW}x${cellH}px ` +
                    `sind zu viel. Weniger Frames wählen oder "Max. Frame-Kante" verkleinern.`
                );
            }
            return Math.min(fallback, frameCount);
        }

        if (best !== manual && onLog) {
            onLog(`Spalten automatisch auf ${best} gesetzt (Raster ${best}x${Math.ceil(frameCount / best)}).`);
        }
        return best;
    }

    /**
     * Schneidet ein ImageData-Objekt auf ein gegebenes Rechteck zu.
     */
    public static cropImageData(imageData: ImageData, x: number, y: number, w: number, h: number): ImageData {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context missing');
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        const tctx = tempCanvas.getContext('2d');
        if (!tctx) throw new Error('Canvas context missing');
        tctx.putImageData(imageData, 0, 0);
        ctx.drawImage(tempCanvas, x, y, w, h, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h);
    }
}
