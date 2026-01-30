import { TWindow } from './TWindow';
import { IMAGE_DEFAULTS } from './ImageCapable';
export class TStage extends TWindow {
    constructor(name, x = 0, y = 0, cols = 32, rows = 24, cellSize = 20) {
        super(name, x, y, cols * cellSize, rows * cellSize);
        this.description = '';
        // Background Image Support
        this._backgroundImage = '';
        this._objectFit = IMAGE_DEFAULTS.objectFit;
        // Start Animation Settings
        this.startAnimation = 'none'; // Fly-In Pattern bei Spielstart
        this.startAnimationDuration = 1000; // Dauer in ms
        this.startAnimationEasing = 'easeOut';
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
    get cols() {
        return this._config.cols;
    }
    set cols(value) {
        this._config.cols = value;
        this.width = value * this._config.cellSize;
    }
    get rows() {
        return this._config.rows;
    }
    set rows(value) {
        this._config.rows = value;
        this.height = value * this._config.cellSize;
    }
    get cellSize() {
        return this._config.cellSize;
    }
    set cellSize(value) {
        this._config.cellSize = value;
        this.width = this._config.cols * value;
        this.height = this._config.rows * value;
    }
    get snapToGrid() {
        return this._config.snapToGrid;
    }
    set snapToGrid(value) {
        this._config.snapToGrid = value;
    }
    get showGrid() {
        return this._config.showGrid;
    }
    set showGrid(value) {
        this._config.showGrid = value;
    }
    get config() {
        return { ...this._config };
    }
    // ─────────────────────────────────────────────
    // Background Image
    // ─────────────────────────────────────────────
    get backgroundImage() {
        return this._backgroundImage;
    }
    set backgroundImage(value) {
        this._backgroundImage = value || '';
    }
    get objectFit() {
        return this._objectFit;
    }
    set objectFit(value) {
        this._objectFit = value;
    }
    // ─────────────────────────────────────────────
    // Grid Helpers
    // ─────────────────────────────────────────────
    /** Convert pixel position to grid position */
    pixelToGrid(pixelX, pixelY) {
        return {
            x: Math.floor(pixelX / this._config.cellSize),
            y: Math.floor(pixelY / this._config.cellSize)
        };
    }
    /** Convert grid position to pixel position */
    gridToPixel(gridX, gridY) {
        return {
            x: gridX * this._config.cellSize,
            y: gridY * this._config.cellSize
        };
    }
    /** Snap a pixel position to the nearest grid cell */
    snapToGridPosition(pixelX, pixelY) {
        const grid = this.pixelToGrid(pixelX, pixelY);
        return this.gridToPixel(grid.x, grid.y);
    }
    // ─────────────────────────────────────────────
    // Inspector Properties
    // ─────────────────────────────────────────────
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'description', label: 'Description', type: 'string', group: 'Info' },
            { name: 'cols', label: 'Columns', type: 'number', group: 'Grid' },
            { name: 'rows', label: 'Rows', type: 'number', group: 'Grid' },
            { name: 'cellSize', label: 'Cell Size', type: 'number', group: 'Grid' },
            { name: 'snapToGrid', label: 'Snap to Grid', type: 'boolean', group: 'Grid' },
            { name: 'showGrid', label: 'Show Grid', type: 'boolean', group: 'Grid' },
            // Background
            { name: 'backgroundImage', label: 'Background Image', type: 'image_picker', group: 'Appearance' },
            { name: 'objectFit', label: 'Image Fit', type: 'select', group: 'Appearance', options: ['cover', 'contain', 'fill', 'none'] },
            // Start Animation
            { name: 'startAnimation', label: 'Start Animation', type: 'select', group: 'Animation', options: ['none', 'UpLeft', 'UpMiddle', 'UpRight', 'Left', 'Right', 'BottomLeft', 'BottomMiddle', 'BottomRight', 'ChaosIn', 'ChaosOut', 'Matrix', 'Random'] },
            { name: 'startAnimationDuration', label: 'Duration (ms)', type: 'number', group: 'Animation' },
            { name: 'startAnimationEasing', label: 'Easing', type: 'select', group: 'Animation', options: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'bounce', 'elastic'] }
        ];
    }
    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────
    toJSON() {
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
    /**
     * Berechnet die Startposition für ein Objekt basierend auf dem Muster.
     */
    getPatternStartPosition(pattern, targetX, targetY, index) {
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
    flyToInitialPositions(pattern = 'ChaosIn', duration = 1000, easing = 'easeOut') {
        this.children.forEach((child, index) => {
            if ('moveTo' in child && typeof child.moveTo === 'function') {
                const targetX = child.x;
                const targetY = child.y;
                const start = this.getPatternStartPosition(pattern, targetX, targetY, index);
                // Zuerst zur Startposition setzen
                child.x = start.x;
                child.y = start.y;
                // Dann zum Ziel animieren
                child.moveTo(targetX, targetY, duration, easing);
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
    flyToExitPositions(pattern = 'ChaosIn', duration = 1000, easing = 'easeIn', hideAfter = true) {
        this.children.forEach((child, index) => {
            if ('moveTo' in child && typeof child.moveTo === 'function') {
                const currentX = child.x;
                const currentY = child.y;
                const target = this.getPatternStartPosition(pattern, currentX, currentY, index);
                // Zum Exit-Punkt animieren
                child.moveTo(target.x, target.y, duration, easing, () => {
                    if (hideAfter) {
                        child.visible = false;
                    }
                });
            }
        });
    }
}
// ─────────────────────────────────────────────
// Stage Animations
// ─────────────────────────────────────────────
/**
 * Mögliche Fly-In/-Out Muster.
 */
TStage.FlyPatterns = [
    'UpLeft', 'UpMiddle', 'UpRight',
    'Left', 'Right',
    'BottomLeft', 'BottomMiddle', 'BottomRight',
    'ChaosIn', 'ChaosOut', 'Matrix', 'Random'
];
