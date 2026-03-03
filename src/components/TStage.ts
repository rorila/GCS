import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { ImageFit, IMAGE_DEFAULTS } from './ImageCapable';

export interface StageConfig {
    cols: number;
    rows: number;
    cellSize: number;
    snapToGrid: boolean;
    showGrid: boolean;
}

export class TStage extends TWindow {
    private _config: StageConfig;
    public description: string = '';

    // Background Image Support
    private _backgroundImage: string = '';
    private _objectFit: ImageFit = IMAGE_DEFAULTS.objectFit;

    // Start Animation Settings
    public startAnimation: string = 'none'; // Fly-In Pattern bei Spielstart
    public startAnimationDuration: number = 1000; // Dauer in ms
    public startAnimationEasing: string = 'easeOut';

    constructor(
        name: string,
        x: number = 0,
        y: number = 0,
        cols: number = 32,
        rows: number = 24,
        cellSize: number = 20
    ) {
        super(name, x, y, cols * cellSize, rows * cellSize);

        this._config = {
            cols,
            rows,
            cellSize,
            snapToGrid: true,
            showGrid: false
        };

        // Default Stage Style
        this.style.backgroundColor = '#ffffff';
        this.style.borderColor = '#999999';
        this.style.borderWidth = 1;
    }

    // ─────────────────────────────────────────────
    // Config Accessors
    // ─────────────────────────────────────────────

    get cols(): number {
        return this._config.cols;
    }

    set cols(value: number) {
        this._config.cols = value;
        this.width = value * this._config.cellSize;
    }

    get rows(): number {
        return this._config.rows;
    }

    set rows(value: number) {
        this._config.rows = value;
        this.height = value * this._config.cellSize;
    }

    get cellSize(): number {
        return this._config.cellSize;
    }

    set cellSize(value: number) {
        this._config.cellSize = value;
        this.width = this._config.cols * value;
        this.height = this._config.rows * value;
    }

    get snapToGrid(): boolean {
        return this._config.snapToGrid;
    }

    set snapToGrid(value: boolean) {
        this._config.snapToGrid = value;
    }

    get showGrid(): boolean {
        return this._config.showGrid;
    }

    set showGrid(value: boolean) {
        this._config.showGrid = value;
    }

    get config(): StageConfig {
        return { ...this._config };
    }

    // ─────────────────────────────────────────────
    // Background Image
    // ─────────────────────────────────────────────

    get backgroundImage(): string {
        return this._backgroundImage;
    }

    set backgroundImage(value: string) {
        this._backgroundImage = value || '';
    }

    get objectFit(): ImageFit {
        return this._objectFit;
    }

    set objectFit(value: ImageFit) {
        this._objectFit = value;
    }

    // ─────────────────────────────────────────────
    // Grid Helpers
    // ─────────────────────────────────────────────

    /** Convert pixel position to grid position */
    public pixelToGrid(pixelX: number, pixelY: number): { x: number, y: number } {
        return {
            x: Math.floor(pixelX / this._config.cellSize),
            y: Math.floor(pixelY / this._config.cellSize)
        };
    }

    /** Convert grid position to pixel position */
    public gridToPixel(gridX: number, gridY: number): { x: number, y: number } {
        return {
            x: gridX * this._config.cellSize,
            y: gridY * this._config.cellSize
        };
    }

    /** Snap a pixel position to the nearest grid cell */
    public snapToGridPosition(pixelX: number, pixelY: number): { x: number, y: number } {
        const grid = this.pixelToGrid(pixelX, pixelY);
        return this.gridToPixel(grid.x, grid.y);
    }

    // ─────────────────────────────────────────────
    // Inspector Properties
    // ─────────────────────────────────────────────

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'description', label: 'Beschreibung', type: 'string', group: 'INFO' },
            { name: 'cols', label: 'Spalten', type: 'number', group: 'RASTER', inline: true },
            { name: 'rows', label: 'Zeilen', type: 'number', group: 'RASTER', inline: true },
            { name: 'cellSize', label: 'Zellengröße', type: 'number', group: 'RASTER', inline: true },
            { name: 'snapToGrid', label: 'Am Raster ausrichten', type: 'boolean', group: 'RASTER' },
            { name: 'showGrid', label: 'Raster sichtbar', type: 'boolean', group: 'RASTER' },
            // Background
            { name: 'backgroundImage', label: 'Hintergrundbild', type: 'image_picker', group: 'DARSTELLUNG' },
            { name: 'objectFit', label: 'Bild-Skalierung', type: 'select', group: 'DARSTELLUNG', options: ['cover', 'contain', 'fill', 'none'] },
            // Start Animation
            { name: 'startAnimation', label: 'Start-Animation', type: 'select', group: 'ANIMATION', options: ['none', 'UpLeft', 'UpMiddle', 'UpRight', 'Left', 'Right', 'BottomLeft', 'BottomMiddle', 'BottomRight', 'ChaosIn', 'ChaosOut', 'Matrix', 'Random'] },
            { name: 'startAnimationDuration', label: 'Dauer (ms)', type: 'number', group: 'ANIMATION', inline: true },
            { name: 'startAnimationEasing', label: 'Easing', type: 'select', group: 'ANIMATION', options: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'bounce', 'elastic'], inline: true }
        ];
    }

    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────

    public toJSON(): any {
        return {
            ...super.toJSON(),
            description: this.description,
            cols: this._config.cols,
            rows: this._config.rows,
            cellSize: this._config.cellSize,
            snapToGrid: this._config.snapToGrid,
            showGrid: this._config.showGrid,
            backgroundImage: this._backgroundImage,
            objectFit: this._objectFit,
            startAnimation: this.startAnimation,
            startAnimationDuration: this.startAnimationDuration,
            startAnimationEasing: this.startAnimationEasing
        };
    }

    // ─────────────────────────────────────────────
    // Stage Animations
    // ─────────────────────────────────────────────

    /**
     * Mögliche Fly-In/-Out Muster.
     */
    public static readonly FlyPatterns = [
        'UpLeft', 'UpMiddle', 'UpRight',
        'Left', 'Right',
        'BottomLeft', 'BottomMiddle', 'BottomRight',
        'ChaosIn', 'ChaosOut', 'Matrix', 'Random'
    ] as const;

    /**
     * Berechnet die Startposition für ein Objekt basierend auf dem Muster.
     */
    private getPatternStartPosition(
        pattern: string,
        targetX: number,
        targetY: number,
        index: number
    ): { x: number; y: number } {
        const stageWidth = this._config.cols * this._config.cellSize;
        const stageHeight = this._config.rows * this._config.cellSize;
        const outsideMargin = 50; // Außerhalb der Bühne

        switch (pattern) {
            case 'UpLeft':
                return { x: -outsideMargin, y: -outsideMargin };
            case 'UpMiddle':
                return { x: stageWidth / 2, y: -outsideMargin };
            case 'UpRight':
                return { x: stageWidth + outsideMargin, y: -outsideMargin };
            case 'Left':
                return { x: -outsideMargin, y: targetY };
            case 'Right':
                return { x: stageWidth + outsideMargin, y: targetY };
            case 'BottomLeft':
                return { x: -outsideMargin, y: stageHeight + outsideMargin };
            case 'BottomMiddle':
                return { x: stageWidth / 2, y: stageHeight + outsideMargin };
            case 'BottomRight':
                return { x: stageWidth + outsideMargin, y: stageHeight + outsideMargin };
            case 'ChaosIn':
                // Zufällige Position außerhalb der Bühne
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.max(stageWidth, stageHeight) + outsideMargin;
                return {
                    x: stageWidth / 2 + Math.cos(angle) * distance,
                    y: stageHeight / 2 + Math.sin(angle) * distance
                };
            case 'ChaosOut':
                // Alle starten in der Mitte
                return { x: stageWidth / 2, y: stageHeight / 2 };
            case 'Matrix':
                // Objekte kommen von oben, versetzt nach Index
                return { x: targetX, y: -outsideMargin - (index * 20) };
            case 'Random':
                // Zufälliges Muster auswählen (ohne Random und Matrix)
                const simplePatterns = ['UpLeft', 'UpMiddle', 'UpRight', 'Left', 'Right', 'BottomLeft', 'BottomMiddle', 'BottomRight'];
                const randomPattern = simplePatterns[Math.floor(Math.random() * simplePatterns.length)];
                return this.getPatternStartPosition(randomPattern, targetX, targetY, index);
            default:
                return { x: 0, y: 0 };
        }
    }

    /**
     * Lässt alle Kinder-Objekte von einer Startposition zu ihren initialen Koordinaten fliegen.
     * @param pattern Das Muster für die Startpositionen
     * @param duration Dauer in Millisekunden (default: 1000)
     * @param easing Easing-Funktion (default: 'easeOut')
     */
    public flyToInitialPositions(
        pattern: string = 'ChaosIn',
        duration: number = 1000,
        easing: string = 'easeOut'
    ): void {
        this.children.forEach((child, index) => {
            if ('moveTo' in child && typeof (child as any).moveTo === 'function') {
                const targetX = (child as any).x;
                const targetY = (child as any).y;
                const start = this.getPatternStartPosition(pattern, targetX, targetY, index);

                // Zuerst zur Startposition setzen
                (child as any).x = start.x;
                (child as any).y = start.y;

                // Dann zum Ziel animieren
                (child as any).moveTo(targetX, targetY, duration, easing);
            }
        });
    }

    /**
     * Lässt alle Kinder-Objekte von ihren aktuellen Positionen zu Zielkoordinaten fliegen (Exit-Animation).
     * @param pattern Das Muster für die Zielpositionen
     * @param duration Dauer in Millisekunden (default: 1000)
     * @param easing Easing-Funktion (default: 'easeIn')
     * @param hideAfter Objekte nach der Animation unsichtbar machen (default: true)
     */
    public flyToExitPositions(
        pattern: string = 'ChaosIn',
        duration: number = 1000,
        easing: string = 'easeIn',
        hideAfter: boolean = true
    ): void {
        this.children.forEach((child, index) => {
            if ('moveTo' in child && typeof (child as any).moveTo === 'function') {
                const currentX = (child as any).x;
                const currentY = (child as any).y;
                const target = this.getPatternStartPosition(pattern, currentX, currentY, index);

                // Zum Exit-Punkt animieren
                (child as any).moveTo(target.x, target.y, duration, easing, () => {
                    if (hideAfter) {
                        (child as any).visible = false;
                    }
                });
            }
        });
    }
}
