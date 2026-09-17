import { createPuzzleEdges } from './PuzzleShape';

export interface ImageSplitConfig {
    id: string;
    imageSource: string;
    rows: number;
    columns: number;
    /** Ziel-Seitenverhaeltnis (Breite/Hoehe) fuer Cover-Crop. Fehlt es, wird das ganze Bild verwendet. */
    targetAspect?: number;
    pieceShape?: 'rectangle' | 'puzzle';
}

export interface ImagePiece {
    id: string;
    index: number;
    row: number;
    column: number;
    matchValue: string;
    source: string;
    sourceWidth: number;
    sourceHeight: number;
    x: number;
    y: number;
    width: number;
    height: number;
    puzzleEdges?: string;
}

export function validateImageSplit(config: ImageSplitConfig): string | null {
    if (!String(config.imageSource || '').trim()) return 'Bitte eine Bilddatei auswählen.';
    for (const count of [config.rows, config.columns]) {
        if (!Number.isInteger(count) || count < 1 || count > 32) {
            return 'Zeilen und Spalten müssen ganze Zahlen zwischen 1 und 32 sein.';
        }
    }
    return null;
}

export function createImagePieces(config: ImageSplitConfig, sourceWidth: number, sourceHeight: number): ImagePiece[] {
    const error = validateImageSplit(config);
    if (error) throw new Error(error);
    if (![sourceWidth, sourceHeight].every(n => Number.isFinite(n) && n > 0)) {
        throw new Error('Das Bild hat keine gültige Größe.');
    }
    const imageAspect = sourceWidth / sourceHeight;
    const targetAspect = Number(config.targetAspect) || imageAspect;
    let cropX = 0, cropY = 0, cropW = sourceWidth, cropH = sourceHeight;
    if (imageAspect > targetAspect) {
        // Bild ist breiter als Ziel -> linke/rechte Ränder abschneiden
        cropW = sourceHeight * targetAspect;
        cropX = (sourceWidth - cropW) / 2;
    } else if (imageAspect < targetAspect) {
        // Bild ist hoeher als Ziel -> obere/untere Ränder abschneiden
        cropH = sourceWidth / targetAspect;
        cropY = (sourceHeight - cropH) / 2;
    }
    const width = cropW / config.columns;
    const height = cropH / config.rows;
    const edges = config.pieceShape === 'puzzle' ? createPuzzleEdges(config.rows, config.columns) : [];
    return Array.from({ length: config.rows * config.columns }, (_, index) => {
        const row = Math.floor(index / config.columns), column = index % config.columns;
        return {
            id: `${config.id}_r${row}_c${column}`, index, row, column,
            matchValue: `r${row}_c${column}`, source: config.imageSource,
            sourceWidth, sourceHeight,
            x: cropX + column * width,
            y: cropY + row * height,
            width, height,
            puzzleEdges: edges[index] || ''
        };
    });
}

export function fitImageBounds(sourceWidth: number, sourceHeight: number, boxWidth: number, boxHeight: number) {
    if (![sourceWidth, sourceHeight, boxWidth, boxHeight].every(n => Number.isFinite(n) && n > 0)) {
        return { x: 0, y: 0, width: boxWidth, height: boxHeight };
    }
    const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
    const width = sourceWidth * scale, height = sourceHeight * scale;
    return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height };
}

export function resolveSplitterImageSource(source: string): string {
    let result = String(source || '').trim();
    if (/^data:image\//i.test(result) || /^blob:/i.test(result)) return result;
    if (/^[a-z][a-z\d+.-]*:/i.test(result) && !/^https?:/i.test(result)) {
        throw new Error('Bitte eine Bilddatei aus der Medienauswahl verwenden.');
    }
    if (result.startsWith('/images/')) result = '.' + result;
    else if (!/^(https?:|\/|\.)/i.test(result)) {
        result = result.startsWith('images/') || result.startsWith('assets/') ? './' + result : './images/' + result;
    }
    return result.split('/').map(part => part.replace(/\s/g, char => encodeURIComponent(char))).join('/');
}

export function loadSplitterImage(source: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const timer = setTimeout(() => finish(new Error('Zeitüberschreitung beim Laden des Bildes.')), 15000);
        const finish = (error?: Error) => {
            clearTimeout(timer);
            image.onload = null;
            image.onerror = null;
            if (error) reject(error);
            else if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                resolve({ width: image.naturalWidth, height: image.naturalHeight });
            } else reject(new Error('Das Bild hat keine gültige Größe.'));
        };
        image.onload = () => finish();
        image.onerror = () => finish(new Error('Bild konnte nicht geladen werden. Bitte die Bildquelle prüfen.'));
        try { image.src = resolveSplitterImageSource(source); }
        catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
    });
}

export async function prepareImagePieces(config: ImageSplitConfig): Promise<ImagePiece[]> {
    const error = validateImageSplit(config);
    if (error) throw new Error(error);
    const size = await loadSplitterImage(config.imageSource);
    return createImagePieces(config, size.width, size.height);
}
