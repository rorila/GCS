import { TImage } from './TImage';
import { TPropertyDef } from './TComponent';

/**
 * TImageList - Sprite-Sheet-Komponente
 * 
 * Zeigt ein einzelnes Teilbild aus einem Sprite-Sheet (Raster-Bild) an.
 * Das Quellbild wird durch `imageCountHorizontal` × `imageCountVertical` in
 * gleichgroße Frames aufgeteilt. `currentImageNumber` (0-basiert) bestimmt,
 * welcher Frame sichtbar ist.
 * 
 * Verwaltung erfolgt über den dedizierten ImageListEditorDialog.
 * 
 * Rendering: Der StageRenderer nutzt CSS `background-position` + `background-size`
 * um den korrekten Ausschnitt des Sprite-Sheets sichtbar zu machen.
 * 
 * @since v3.30.0
 */
export class TImageList extends TImage {

    // ─────────────────────────────────────────────
    // Raster-Konfiguration
    // ─────────────────────────────────────────────

    /** Anzahl Spalten im Sprite-Sheet (horizontal) */
    public imageCountHorizontal: number = 1;

    /** Anzahl Zeilen im Sprite-Sheet (vertikal) */
    public imageCountVertical: number = 1;

    /** Index des aktuell angezeigten Teilbildes (0-basiert) */
    public currentImageNumber: number = 0;

    constructor(name: string, x: number, y: number, width: number = 8, height: number = 6) {
        super(name, x, y, width, height);

        // Standard-Style für ImageList
        this.style.backgroundColor = 'transparent';
        this.style.borderWidth = 0;
    }

    // ─────────────────────────────────────────────
    // Berechnete Properties (Read-Only)
    // ─────────────────────────────────────────────

    /**
     * Maximale Anzahl an Teilbildern (= H × V).
     * Nützlich für Zufallszahl-Ermittlung: `random(0, maxImageCount - 1)`
     */
    get maxImageCount(): number {
        return Math.max(1, this.imageCountHorizontal * this.imageCountVertical);
    }

    /**
     * Breite eines einzelnen Frames in Prozent des Gesamtbildes.
     * Wird intern für CSS background-size verwendet.
     */
    get frameWidthPercent(): number {
        return this.imageCountHorizontal > 0 ? 100 / this.imageCountHorizontal : 100;
    }

    /**
     * Höhe eines einzelnen Frames in Prozent des Gesamtbildes.
     * Wird intern für CSS background-size verwendet.
     */
    get frameHeightPercent(): number {
        return this.imageCountVertical > 0 ? 100 / this.imageCountVertical : 100;
    }

    /**
     * Spalte des aktuellen Frames (0-basiert)
     */
    get currentColumn(): number {
        if (this.imageCountHorizontal <= 0) return 0;
        return this.currentImageNumber % this.imageCountHorizontal;
    }

    /**
     * Zeile des aktuellen Frames (0-basiert)
     */
    get currentRow(): number {
        if (this.imageCountHorizontal <= 0) return 0;
        return Math.floor(this.currentImageNumber / this.imageCountHorizontal);
    }

    /**
     * CSS background-position-x in Prozent für den aktuellen Frame.
     * Bei H Spalten ergeben sich (H-1) mögliche Schritte:
     *   column=0 → 0%, column=H-1 → 100%
     */
    get backgroundPositionX(): number {
        if (this.imageCountHorizontal <= 1) return 0;
        return (this.currentColumn / (this.imageCountHorizontal - 1)) * 100;
    }

    /**
     * CSS background-position-y in Prozent für den aktuellen Frame.
     */
    get backgroundPositionY(): number {
        if (this.imageCountVertical <= 1) return 0;
        return (this.currentRow / (this.imageCountVertical - 1)) * 100;
    }

    // ─────────────────────────────────────────────
    // Inspector Properties
    // ─────────────────────────────────────────────

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();

        return [
            ...props,
            // Sprite-Sheet Konfiguration
            { name: 'imageCountHorizontal', label: 'Spalten (H)', type: 'number', group: 'SPRITE SHEET', inline: true },
            { name: 'imageCountVertical', label: 'Zeilen (V)', type: 'number', group: 'SPRITE SHEET', inline: true },
            { name: 'currentImageNumber', label: 'Aktuelles Bild', type: 'number', group: 'SPRITE SHEET' },
            { name: 'maxImageCount', label: 'Max. Bilder', type: 'number', group: 'SPRITE SHEET', readonly: true },
            {
                name: 'openImageListEditor',
                label: '🎞️ Editor öffnen',
                type: 'button',
                group: 'SPRITE SHEET',
                action: 'openImageListEditor',
                style: {
                    backgroundColor: '#1e3a5f',
                    color: '#89b4fa',
                    fontWeight: 'bold',
                    border: '1px solid #2a5a8f'
                }
            }
        ];
    }

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    public override getEvents(): string[] {
        return [...super.getEvents(), 'onFrameChange'];
    }

    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────

    public toJSON(): any {
        return {
            ...super.toJSON(),
            imageCountHorizontal: this.imageCountHorizontal,
            imageCountVertical: this.imageCountVertical,
            currentImageNumber: this.currentImageNumber
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TImageList', (objData: any) => new TImageList(objData.name, objData.x, objData.y, objData.width, objData.height));
