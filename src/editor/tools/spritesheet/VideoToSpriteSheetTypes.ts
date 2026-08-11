/**
 * VideoToSpriteSheetTypes
 *
 * Typdefinitionen und Konfigurations-Grenzwerte für das VideoToSpriteSheetTool.
 */

/** Version des Tools — wird im Dialog-Header angezeigt, damit die getestete Version erkennbar ist. */
export const VIDEO_TO_SPRITESHEET_TOOL_VERSION = '1.6.0';

/**
 * Performance-Budget für Sprite-Sheets.
 *
 * Dekodierte Bilder belegen 4 Byte pro Pixel im Speicher — unabhängig von der
 * Dateigröße. Zu große Sheets führen auf schwacher Hardware dazu, dass der Browser
 * dekodierte Bitmaps verwirft und pro Frame neu dekodiert (sichtbares Ruckeln).
 */
export const PERF = {
    /** Empfohlene maximale Kantenlänge einer Frame-Zelle. */
    MAX_FRAME_EDGE: 256,
    /** Zielgrenze für die Sheet-Kantenlänge — auf jeder GPU als Textur nutzbar. */
    MAX_SHEET_EDGE: 2048,
    /** Übliche harte Texturgrenze; darüber verweigern viele GPUs den Upload. */
    MAX_TEXTURE_EDGE: 8192,
    /** Pixel-Budget pro Sheet (2048x2048) — entspricht ca. 16 MB RAM. */
    MAX_SHEET_PIXELS: 4_000_000,
    /** Empfohlene maximale Frame-Anzahl pro Animation. */
    MAX_FRAMES: 32
} as const;

export interface Frame {
    id: number;
    time: number;
    imageData: ImageData;
    selected: boolean;
}

export interface CropRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface ToolSettings {
    interval: number;
    start: number;
    end: number | null;
    spriteWidth: number;
    spriteHeight: number;
    columns: number;
    /** Maximale Kantenlänge einer Frame-Zelle in px. 0 = keine Begrenzung. */
    maxFrameSize: number;
    /** Spaltenzahl automatisch so wählen, dass das Sheet GPU-taugliche Maße behält. */
    autoColumns: boolean;
    removeBackground: boolean;
    backgroundColor: string;
    tolerance: number;
    cropMode: 'none' | 'auto' | 'manual';
    cropPadding: number;
    manualCropRect: CropRect | null;
    fps: number;
    loop: boolean;
}

export interface ExportResult {
    fileName: string;
    url: string;
    imageBlob: Blob;
    metadata: {
        name: string;
        image: string;
        frameWidth: number;
        frameHeight: number;
        frames: number;
        columns: number;
        rows: number;
        frameInterval: number;
    };
}
