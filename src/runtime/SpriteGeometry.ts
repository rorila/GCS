/**
 * SpriteGeometry - Einzige Wahrheit fuer die Frame-Geometrie eines Spritesheets.
 *
 * Hintergrund: Sprite-Groessen werden in ganzen Rasterzellen angegeben. Erreichbare
 * Pixelgroessen sind daher nur Vielfache von cellSize. Ein Frame von 256x144 (16:9)
 * laesst sich in einem 20px-Raster nur als 16x9 Zellen unverzerrt darstellen --
 * eine Groesse, die der Nutzer praktisch nie von Hand trifft.
 *
 * Bisher rechneten AssetAnalyzer und SpriteRenderer unabhaengig voneinander. Dadurch
 * konnte die Bild-Analyse "passt" melden, waehrend der Renderer den Frame verzerrte.
 * Diese Klasse buendelt die Rechnung an einer Stelle und ist bewusst DOM-frei,
 * damit sie testbar bleibt und auch vom Editor genutzt werden kann.
 */

/** Ab dieser relativen Abweichung gilt ein Sprite als sichtbar verzerrt. */
export const DISTORTION_TOLERANCE = 0.02;

/** Groessere Zellen-Empfehlungen sind in der Praxis nicht brauchbar. */
const MAX_SUGGESTED_CELLS = 40;

export interface FrameGeometry {
    frameWidth: number;
    frameHeight: number;
    frameAspect: number;
    boxAspect: number;
    /** Frame-Pixel pro Anzeige-Pixel, je Achse getrennt. 0 wenn cellSize unbekannt. */
    scaleX: number;
    scaleY: number;
    /** 1 = unverzerrt, 1.06 = 6 % gestaucht. */
    distortion: number;
    isDistorted: boolean;
}

/** Einpassung des Frames in die Sprite-Box, in Prozent der Box. */
export interface FitRect {
    widthPercent: number;
    heightPercent: number;
    leftPercent: number;
    topPercent: number;
}

export interface CellSuggestion {
    cols: number;
    rows: number;
    widthPx: number;
    heightPx: number;
    /** Flaechenaenderung gegenueber der aktuellen Box. */
    factor: number;
}

export class SpriteGeometry {
    /**
     * Ermittelt Frame-Masse und Verzerrung.
     * @param cellSize Nur fuer scaleX/scaleY noetig; 0 laesst diese Werte offen.
     */
    public static analyze(
        sheetWidth: number,
        sheetHeight: number,
        columns: number,
        rows: number,
        boxWidthCells: number,
        boxHeightCells: number,
        cellSize: number = 0
    ): FrameGeometry | null {
        if (!sheetWidth || !sheetHeight || !boxWidthCells || !boxHeightCells) return null;

        const cols = Math.max(1, columns);
        const rws = Math.max(1, rows);

        const frameWidth = sheetWidth / cols;
        const frameHeight = sheetHeight / rws;
        const frameAspect = frameWidth / frameHeight;
        const boxAspect = boxWidthCells / boxHeightCells;

        const scaleX = cellSize > 0 ? frameWidth / (boxWidthCells * cellSize) : 0;
        const scaleY = cellSize > 0 ? frameHeight / (boxHeightCells * cellSize) : 0;

        const distortion = frameAspect > boxAspect
            ? frameAspect / boxAspect
            : boxAspect / frameAspect;

        return {
            frameWidth,
            frameHeight,
            frameAspect,
            boxAspect,
            scaleX,
            scaleY,
            distortion,
            isDistorted: distortion - 1 > DISTORTION_TOLERANCE
        };
    }

    /**
     * Groesster formattreuer Bereich innerhalb der Box, zentriert.
     * Rein prozentual, damit der Renderer keine Pixelmasse messen muss.
     */
    public static containFit(frameAspect: number, boxAspect: number): FitRect {
        let widthPercent = 100;
        let heightPercent = 100;

        if (boxAspect > frameAspect) {
            // Box ist breiter als der Frame: Hoehe fuellt, Breite schrumpft.
            widthPercent = 100 * (frameAspect / boxAspect);
        } else if (boxAspect < frameAspect) {
            // Box ist schmaler als der Frame: Breite fuellt, Hoehe schrumpft.
            heightPercent = 100 * (boxAspect / frameAspect);
        }

        return {
            widthPercent,
            heightPercent,
            leftPercent: (100 - widthPercent) / 2,
            topPercent: (100 - heightPercent) / 2
        };
    }

    /**
     * Verschiebung der Blatt-Ebene fuer ein bestimmtes Frame, in Prozent.
     *
     * Prozente beziehen sich bei CSS-transform auf die eigene Groesse des
     * verschobenen Elements. Die Blatt-Ebene ist hCount mal so breit und vCount
     * mal so hoch wie das Frame-Fenster, ein Frame entspricht daher 1/hCount
     * bzw. 1/vCount ihrer Ausdehnung.
     */
    public static frameOffsetPercent(
        col: number,
        row: number,
        columns: number,
        rows: number
    ): { tx: number; ty: number } {
        const cols = Math.max(1, columns);
        const rws = Math.max(1, rows);
        return {
            tx: cols > 1 ? -(col / cols) * 100 : 0,
            ty: rws > 1 ? -(row / rws) * 100 : 0
        };
    }

    /**
     * Verzerrungsfreie Zellengroessen, beste Empfehlung zuerst.
     *
     * Das Raster laesst nur ganze Zellen zu, daher sind ausschliesslich Vielfache
     * des gekuerzten Seitenverhaeltnisses moeglich. Ist das gekuerzte Verhaeltnis
     * zu gross (z. B. 255:143), gibt es keine brauchbare Groesse -- dann muss das
     * Spritesheet selbst angepasst werden.
     */
    public static suggestCellSizes(
        frameWidth: number,
        frameHeight: number,
        currentCols: number,
        currentRows: number,
        cellSize: number
    ): CellSuggestion[] {
        const w = Math.round(frameWidth);
        const h = Math.round(frameHeight);
        if (!w || !h) return [];

        const divisor = this.gcd(w, h);
        const baseCols = w / divisor;
        const baseRows = h / divisor;
        if (baseCols > MAX_SUGGESTED_CELLS || baseRows > MAX_SUGGESTED_CELLS) return [];

        const currentArea = currentCols * currentRows;
        const out: CellSuggestion[] = [];

        for (let k = 1; k <= 4; k++) {
            const cols = baseCols * k;
            const rows = baseRows * k;
            if (cols > MAX_SUGGESTED_CELLS || rows > MAX_SUGGESTED_CELLS) break;
            out.push({
                cols,
                rows,
                widthPx: cols * cellSize,
                heightPx: rows * cellSize,
                factor: currentArea > 0 ? (cols * rows) / currentArea : 1
            });
        }

        out.sort((a, b) => Math.abs(a.factor - 1) - Math.abs(b.factor - 1));
        return out;
    }

    /**
     * Rundet eine Zielgroesse so, dass jedes Frame ganzzahlig bleibt.
     *
     * Ohne diese Rundung koennen Frame-Grenzen auf halben Pixeln liegen. Beim
     * Zeichnen wuerde dann ein Streifen des Nachbarbildes mitsamplen.
     */
    public static wholeFrameSize(
        targetWidth: number,
        targetHeight: number,
        columns: number,
        rows: number
    ): { width: number; height: number; frameWidth: number; frameHeight: number } {
        const cols = Math.max(1, columns);
        const rws = Math.max(1, rows);
        const frameWidth = Math.max(1, Math.round(targetWidth / cols));
        const frameHeight = Math.max(1, Math.round(targetHeight / rws));
        return {
            width: frameWidth * cols,
            height: frameHeight * rws,
            frameWidth,
            frameHeight
        };
    }

    /**
     * Quellgroesse, bei der die Frames genau der Anzeigegroesse entsprechen.
     * Grundlage fuer das spaetere Umrechnen des Spritesheets.
     */
    public static recommendedSheetSize(
        columns: number,
        rows: number,
        boxWidthCells: number,
        boxHeightCells: number,
        cellSize: number,
        qualityFactor: number = 1
    ): { width: number; height: number } {
        const cols = Math.max(1, columns);
        const rws = Math.max(1, rows);
        const frameW = Math.round(boxWidthCells * cellSize * qualityFactor);
        const frameH = Math.round(boxHeightCells * cellSize * qualityFactor);
        return { width: frameW * cols, height: frameH * rws };
    }

    private static gcd(a: number, b: number): number {
        let x = Math.abs(a);
        let y = Math.abs(b);
        while (y) {
            const t = y;
            y = x % y;
            x = t;
        }
        return x || 1;
    }
}
