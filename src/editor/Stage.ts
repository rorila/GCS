import { GridConfig } from '../model/types';
import { Logger } from '../utils/Logger';

import { StageRenderer, StageHost } from './services/StageRenderer';
import { StageInteractionManager, StageInteractionHost } from './services/StageInteractionManager';

export class Stage implements StageHost, StageInteractionHost {
    private static logger = Logger.get('Stage', 'Editor_Diagnostics');
    public element: HTMLElement;
    private container: HTMLElement;
    public renderer: StageRenderer;
    private interactionManager: StageInteractionManager;


    public lastRenderedObjects: any[] = [];
    public runtime?: any;

    public set runMode(running: boolean) {
        if (this.runMode !== running) {
            (this as any).runModeLogDone = false;
            // Clear trace flags from elements to enable fresh logs
            this.element.querySelectorAll('.game-object').forEach(el => {
                (el as any).runModeTraceDone = false;
                (el as any).lastLoggedSrc = null;
            });
        }
        this._runMode = running;
        this.updateBorder();
    }

    private _runMode: boolean = false;
    public get runMode(): boolean { return this._runMode; }

    private _isBlueprint: boolean = false;
    public get isBlueprint(): boolean { return this._isBlueprint; }
    public set isBlueprint(val: boolean) { this._isBlueprint = val; }

    public startAnimation: string = 'none';
    public startAnimationDuration: number = 1000;
    public startAnimationEasing: string = 'easeOut';
    public backgroundImage: string = '';
    public backgroundImageMode: 'cover' | 'tile' = 'cover';
    private gridConfig: GridConfig;
    private _selectedObject: any = null; // Currently selected object (primary)

    public get selectedObject(): any {
        return this._selectedObject;
    }

    public set selectedObject(obj: any) {
        this._selectedObject = obj;
        // Sync selectedIds to ensure visual selection works
        if (obj) {
            const objId = obj.id || obj.name;
            if (!this.selectedIds.has(objId)) {
                this.selectedIds.clear();
                this.selectedIds.add(objId);
            }
        } else {
            this.selectedIds.clear();
        }
    }

    // Get all selected IDs
    public getSelectedIds(): string[] {
        return Array.from(this.selectedIds);
    }

    // Check if an object is selected
    public isSelected(id: string): boolean {
        return this.selectedIds.has(id);
    }

    public onEvent: ((id: string, eventName: string, data?: any) => void) | null = null;

    public get grid(): GridConfig {
        return this.gridConfig;
    }

    public set grid(config: GridConfig) {
        this.gridConfig = config;
        this.updategrid();
    }

    constructor(containerId: string, initialGrid: GridConfig) {
        const el = document.getElementById(containerId);
        if (!el) throw new Error(`Container ${containerId} not found`);
        this.container = el;
        this.gridConfig = initialGrid;

        // Create the actual stage element
        this.element = document.createElement('div');
        this.element.id = `${containerId}-viewport`;
        this.element.style.position = 'relative';
        this.element.style.transformOrigin = 'top left';
        this.element.style.backgroundColor = '#1a1a2e'; // Force opaque background to hide potential ghosts

        // Clear container to prevent "2 levels" when game is reloaded
        this.container.innerHTML = '';
        this.container.appendChild(this.element);

        this.updategrid();
        this.renderer = new StageRenderer(this);
        this.interactionManager = new StageInteractionManager(this);
        this.interactionManager.bindEvents();
    }

    public render() {
        this.renderer.renderObjects(this.lastRenderedObjects);
    }

    /**
     * FAST PATH: Nur Sprite-Positionen im DOM aktualisieren.
     * Delegiert an StageRenderer.updateSpritePositions().
     */
    public updateSpritePositions(sprites: { id: string; x: number; y: number }[]): void {
        this.renderer.updateSpritePositions(sprites);
    }

    public clearSelection() {
        this.selectedIds.clear();
        this._selectedObject = null;
        if (this.onSelectCallback) this.onSelectCallback([]);
        this.render();
    }

    public selectObject(id: string, additive: boolean) {
        if (!additive) this.selectedIds.clear();
        this.selectedIds.add(id);
        const obj = this.lastRenderedObjects.find(o => o.id === id);
        if (obj) this._selectedObject = obj;
        if (this.onSelectCallback) this.onSelectCallback(Array.from(this.selectedIds));
        this.render();
    }

    // --- StageInteractionHost Implementation ---
    public onDropCallback: ((type: string, x: number, y: number) => void) | null = null;
    public onSelectCallback: ((ids: string[]) => void) | null = null;
    public onObjectMove: ((id: string, x: number, y: number) => void) | null = null;
    public onObjectResize: ((id: string, w: number, h: number) => void) | null = null;
    public onCopyCallback: ((id: string) => any) | null = null;
    public onPasteCallback: ((obj: any, x: number, y: number) => string | null) | null = null;
    public onDragStart: ((id: string) => void) | null = null;
    public onObjectCopy: ((id: string, x: number, y: number) => void) | null = null;
    public selectedIds: Set<string> = new Set();

    public updategrid() {
        const { cols, rows, cellSize, visible, backgroundColor } = this.gridConfig;
        const width = cols * cellSize;
        const height = rows * cellSize;

        this.element.style.width = `${width}px`;
        this.element.style.height = `${height}px`;
        this.element.style.backgroundColor = backgroundColor || '#ffffff';

        if (this.runMode) {
            Stage.logger.info(`Game Stage Size updated: ${width}x${height}px. Visible: ${visible}. Host: ${this.container.id}`);
            // Force container to be at least as big as the stage if not in flex layout
            this.container.style.minHeight = `${height}px`;
            this.container.style.minWidth = `${width}px`;
        } else {
            // ARC-FIX: Remove min-width/height when NOT in run-mode to prevent leakage from previous sessions
            this.container.style.minHeight = '';
            this.container.style.minWidth = '';
        }

        if (visible && !this.runMode) {
            const gridColor = (this.gridConfig as any).gridColor || '#dddddd';
            const gridPattern = `
                linear-gradient(to right, ${gridColor} 1px, transparent 1px),
                linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)
            `;
            if (this.backgroundImage) {
                // 3 CSS-Backgrounds: gradient-h, gradient-v, image
                const bgUrl = `url("${this.backgroundImage}")`;
                const isTile = this.backgroundImageMode === 'tile';
                const imgSize = isTile ? `${cellSize}px ${cellSize}px` : 'cover';
                const imgPos = isTile ? 'top left' : 'center';
                const imgRepeat = isTile ? 'repeat' : 'no-repeat';
                this.element.style.backgroundImage = `${gridPattern}, ${bgUrl}`;
                this.element.style.backgroundSize = `${cellSize}px ${cellSize}px, ${cellSize}px ${cellSize}px, ${imgSize}`;
                this.element.style.backgroundPosition = `top left, top left, ${imgPos}`;
                this.element.style.backgroundRepeat = `repeat, repeat, ${imgRepeat}`;
            } else {
                this.element.style.backgroundImage = gridPattern;
                this.element.style.backgroundSize = `${cellSize}px ${cellSize}px`;
                this.element.style.backgroundPosition = '';
                this.element.style.backgroundRepeat = '';
            }
        } else {
            if (this.backgroundImage) {
                const isTile = this.backgroundImageMode === 'tile';
                this.element.style.backgroundImage = `url("${this.backgroundImage}")`;
                this.element.style.backgroundSize = isTile ? 'auto' : 'cover';
                this.element.style.backgroundPosition = isTile ? 'top left' : 'center';
                this.element.style.backgroundRepeat = isTile ? 'repeat' : 'no-repeat';
            } else {
                this.element.style.backgroundImage = 'none';
                this.element.style.backgroundSize = '';
                this.element.style.backgroundPosition = '';
                this.element.style.backgroundRepeat = '';
            }
        }

        // Mode-based border: green for editor, red for run mode
        this.updateBorder();
    }

    public updateBorder() {
        if (this.runMode) {
            // Run mode: bright red border
            this.element.style.border = '2px solid #ff0000';
        } else {
            // Editor mode: bright green border
            this.element.style.border = '2px solid #00ff00';
        }
    }

    public renderObjects(objects: any[]) {
        this.renderer.renderObjects(objects);
    }

    public focusObject(id: string): void {
        this.interactionManager.focusObject(id);
    }

    /**
     * Rendert eine TTable-Komponente in ein HTML-Element.
     * Unterstützt Auto-Columns, JSON-Konfigurationen und Stage-Events.
     */
    public static renderTable(el: HTMLElement, obj: any, onEvent?: (id: string, event: string, data?: any) => void): void {
        Stage.logger.info(`Rendering ${obj.name} (${obj.id})`, { data: obj.data, columns: obj.columns });
        el.style.flexDirection = 'column';
        el.style.overflow = 'hidden';
        el.style.display = 'flex';
        el.style.fontSize = '12px';
        el.style.color = obj.style?.color || '#333333';
        el.style.backgroundColor = obj.style?.backgroundColor || '#ffffff';

        // 1. Data Unwrapping (Smart-Detection for components like TObjectList)
        let rawData = obj.data;
        let sourceObj = null;

        if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
            sourceObj = rawData; // Merken für Spalten-Vererbung
            if (Array.isArray(sourceObj.data)) {
                rawData = sourceObj.data;
            } else if (Array.isArray(sourceObj.items)) {
                rawData = sourceObj.items;
            }
        }
        if (!Array.isArray(rawData)) rawData = [];

        let cols: any[] = [];

        // 2. Resolve Columns (Custom Array vs JSON String vs Auto)
        if (Array.isArray(obj.columns) && obj.columns.length > 0) {
            cols = obj.columns;
        } else if (typeof obj.columns === 'string' && obj.columns.trim().startsWith('[')) {
            try {
                cols = JSON.parse(obj.columns);
            } catch (e) {
                Stage.logger.warn('Invalid JSON columns for:', obj.name);
            }
        }

        // 3. Column Inheritance (Use columns from source component if available and TTable has none)
        if (cols.length === 0 && sourceObj && Array.isArray(sourceObj.columns) && sourceObj.columns.length > 0) {
            cols = sourceObj.columns;
        }

        // Auto-Column Fallback
        if (cols.length === 0 && rawData.length > 0) {
            const firstItem = rawData[0];
            if (typeof firstItem === 'object' && firstItem !== null) {
                cols = Object.keys(firstItem).map(key => ({
                    field: key,
                    label: key.charAt(0).toUpperCase() + key.slice(1)
                }));
            } else {
                cols = [{ field: '_value', label: 'Wert' }];
            }
        }

        // Container-Struktur sicherstellen
        let scrollArea = el.querySelector('.table-scroll-area') as HTMLElement;
        if (!scrollArea) {
            el.innerHTML = '';

            // Editor Only: Title Bar for context if the component is bound
            if (!document.getElementById('game-container')) {
                const titleBar = document.createElement('div');
                titleBar.className = 'table-title-bar';
                titleBar.style.cssText = 'padding:6px 12px; font-weight:bold; background:rgba(0,0,0,0.05); border-bottom:1px solid rgba(0,0,0,0.1); display:flex; justify-content:space-between; align-items:center; font-size: 13px;';
                el.appendChild(titleBar);
            }

            scrollArea = document.createElement('div');
            scrollArea.className = 'table-scroll-area';
            scrollArea.style.cssText = 'flex:1; overflow-y:auto; overflow-x:auto;';
            el.appendChild(scrollArea);
        }

        const titleBar = el.querySelector('.table-title-bar') as HTMLElement;
        if (titleBar) {
            titleBar.innerHTML = `<span>${obj.name}</span> <span style="font-weight:normal; opacity:0.6; font-size:11px;">(${rawData.length} Items)</span>`;
        }

        // Render Table Headers & Rows
        if (scrollArea) {
            scrollArea.innerHTML = '';

            if (obj.displayMode === 'cards') {
                // GALLERY MODE (Cards)
                const config = obj.cardConfig || {};
                const gap = config.gap ?? 15;
                const cardWidth = config.width ?? 280;
                const cardHeight = config.height ?? 110;

                scrollArea.style.display = 'flex';
                scrollArea.style.flexWrap = 'wrap';
                scrollArea.style.gap = `${gap}px`;
                scrollArea.style.padding = `${gap}px`;
                scrollArea.style.alignContent = 'flex-start';

                rawData.forEach((row: any, idx: number) => {
                    const card = document.createElement('div');
                    card.className = 'gcs-card-item';
                    card.style.cssText = `
                        position: relative;
                        width: ${cardWidth}px;
                        height: ${cardHeight}px;
                        background: ${config.backgroundColor || 'rgba(255, 255, 255, 0.05)'};
                        border: ${config.borderWidth || 1}px solid ${config.borderColor || 'rgba(255, 255, 255, 0.1)'};
                        border-radius: ${config.borderRadius || 12}px;
                        padding: ${config.padding || 12}px;
                        cursor: pointer;
                        overflow: hidden;
                        transition: transform 0.2s, background 0.2s;
                        box-sizing: border-box;
                    `;

                    if (idx === obj.selectedIndex) {
                        card.style.background = 'rgba(255, 255, 255, 0.15)';
                        card.style.borderColor = '#0ed7b5'; // Brand highlight
                    }

                    card.onmouseenter = () => card.style.transform = 'translateY(-2px)';
                    card.onmouseleave = () => card.style.transform = 'none';
                    card.onclick = (e) => {
                        e.stopPropagation();
                        obj.selectedIndex = idx;
                        if (onEvent) onEvent(obj.id, 'onSelect', { index: idx, data: row });
                        Stage.renderTable(el, obj, onEvent); // Re-render for selection
                    };

                    // Elements inside card (based on Columns)
                    cols.forEach((col: any) => {
                        const fieldName = col.field || col.property;
                        const value = row[fieldName] ?? '';
                        const type = col.type || 'text';
                        const colStyle = col.style || {};

                        const itemEl = document.createElement('div');
                        itemEl.style.position = 'absolute';
                        const cellSize = 10; // Simple grid inside card
                        if (col.x !== undefined) itemEl.style.left = `${col.x * cellSize}px`;
                        if (col.y !== undefined) itemEl.style.top = `${col.y * cellSize}px`;
                        if (col.width !== undefined) itemEl.style.width = `${col.width * cellSize}px`;
                        if (col.height !== undefined) itemEl.style.height = `${col.height * cellSize}px`;

                        // Font / Style mapping
                        if (colStyle.fontSize) itemEl.style.fontSize = typeof colStyle.fontSize === 'number' ? `${colStyle.fontSize}px` : colStyle.fontSize;
                        if (colStyle.color) itemEl.style.color = colStyle.color;
                        if (colStyle.fontWeight) itemEl.style.fontWeight = colStyle.fontWeight;
                        if (colStyle.fontStyle) itemEl.style.fontStyle = colStyle.fontStyle;

                        if (type === 'image') {
                            itemEl.style.borderRadius = '50%';
                            itemEl.style.backgroundImage = `url(${value})`;
                            itemEl.style.backgroundSize = 'cover';
                            itemEl.style.backgroundPosition = 'center';
                            if (!col.width) itemEl.style.width = '40px';
                            if (!col.height) itemEl.style.height = '40px';
                        } else if (type === 'badge') {
                            itemEl.innerText = String(value).toUpperCase();
                            itemEl.style.padding = '2px 8px';
                            itemEl.style.borderRadius = '100px';
                            itemEl.style.fontSize = '9px';
                            itemEl.style.fontWeight = 'bold';
                            itemEl.style.border = '1px solid currentColor';
                            itemEl.style.backgroundColor = 'rgba(0,0,0,0.2)';
                            itemEl.style.display = 'inline-flex';
                            itemEl.style.alignItems = 'center';
                            itemEl.style.justifyContent = 'center';
                        } else {
                            itemEl.innerText = String(value);
                            if (type === 'header') {
                                itemEl.style.fontWeight = 'bold';
                                itemEl.style.fontSize = '14px';
                            } else if (type === 'meta') {
                                itemEl.style.opacity = '0.6';
                                itemEl.style.fontSize = '11px';
                            }
                        }
                        card.appendChild(itemEl);
                    });
                    scrollArea.appendChild(card);
                });
            } else {
                // STANDARD TABLE MODE
                const table = document.createElement('table');
                table.style.cssText = 'width:100%; border-collapse:collapse; color:inherit; text-align:left;';

                // Header
                if (obj.showHeader !== false && cols.length > 0) {
                    const thead = document.createElement('thead');
                    const hRow = document.createElement('tr');
                    hRow.style.cssText = 'background:rgba(0,0,0,0.05); position:sticky; top:0; z-index:1;';
                    cols.forEach((col: any) => {
                        const th = document.createElement('th');
                        const fieldName = col.field || col.property;
                        const labelName = col.label || fieldName;
                        th.style.cssText = `padding:8px 12px; border-bottom:1px solid rgba(0,0,0,0.1); width:${col.width || 'auto'}; font-weight:600;`;
                        th.innerText = labelName;
                        hRow.appendChild(th);
                    });
                    thead.appendChild(hRow);
                    table.appendChild(thead);
                }

                // Body
                const tbody = document.createElement('tbody');
                if (rawData.length === 0) {
                    const tr = document.createElement('tr');
                    const td = document.createElement('td');
                    td.colSpan = Math.max(1, cols.length);
                    td.innerText = "Keine Daten vorhanden.";
                    td.style.cssText = 'padding:12px; text-align:center; opacity:0.6; font-style:italic;';
                    tr.appendChild(td);
                    tbody.appendChild(tr);
                } else {
                    rawData.forEach((row: any, idx: number) => {
                        const tr = document.createElement('tr');
                        const rowHeight = obj.rowHeight || 30;
                        tr.style.cssText = `border-bottom:1px solid rgba(0,0,0,0.05); cursor:pointer; height:${rowHeight}px;`;

                        const isSelected = idx === obj.selectedIndex;
                        const isStriped = obj.striped !== false && (idx % 2 === 1);

                        tr.style.backgroundColor = isSelected ? 'rgba(0,0,0,0.1)' : (isStriped ? 'rgba(0,0,0,0.02)' : 'transparent');
                        tr.onmouseenter = () => tr.style.backgroundColor = 'rgba(0,0,0,0.08)';
                        tr.onmouseleave = () => tr.style.backgroundColor = isSelected ? 'rgba(0,0,0,0.1)' : (isStriped ? 'rgba(0,0,0,0.02)' : 'transparent');

                        tr.onclick = (e) => {
                            e.stopPropagation();
                            obj.selectedIndex = idx;
                            if (onEvent) onEvent(obj.id, 'onSelect', { index: idx, data: row });
                            Stage.renderTable(el, obj, onEvent);
                        };

                        cols.forEach((col: any) => {
                            const td = document.createElement('td');
                            const fieldName = col.field || col.property;
                            td.style.cssText = 'padding:6px 12px;';
                            td.innerText = String(row[fieldName] ?? '');
                            tr.appendChild(td);
                        });
                        tbody.appendChild(tr);
                    });
                }
                table.appendChild(tbody);
                scrollArea.appendChild(table);
            }
        }
    }

    /**
     * Rendert einen TEmojiPicker.
     */
    public static renderEmojiPicker(el: HTMLElement, obj: any, cellSize: number, onEvent?: (id: string, event: string, data?: any) => void): void {
        el.style.display = 'grid';
        el.style.gridTemplateColumns = `repeat(${obj.columns || 5}, 1fr)`;
        el.style.gap = '5px';
        el.style.padding = '10px';
        el.style.overflowY = 'auto';
        el.style.alignContent = 'start';
        el.style.justifyItems = 'center';

        // Clear and rebuild
        el.innerHTML = '';

        const emojiList = Array.isArray(obj.emojis) ? obj.emojis : [];
        // itemSize wird als Zellen interpretiert (Konsistenz mit GCS)
        const cellItemSize = obj.itemSize || 2;
        const itemSizePx = cellItemSize * cellSize;

        emojiList.forEach((emoji: string) => {
            const btn = document.createElement('div');
            btn.className = 'emoji-item';
            btn.style.width = `${itemSizePx}px`;
            btn.style.height = `${itemSizePx}px`;
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.fontSize = `${itemSizePx * 0.7}px`;
            btn.style.cursor = 'pointer';
            btn.style.borderRadius = '8px';
            btn.style.transition = 'background 0.2s, transform 0.1s';
            btn.innerText = emoji;

            if (emoji === obj.selectedEmoji) {
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                btn.style.boxShadow = '0 0 0 2px #4fc3f7';
            }

            btn.onmouseenter = () => btn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            btn.onmouseleave = () => {
                btn.style.backgroundColor = (emoji === obj.selectedEmoji) ? 'rgba(255, 255, 255, 0.2)' : 'transparent';
            };
            btn.onmousedown = () => btn.style.transform = 'scale(0.9)';
            btn.onmouseup = () => btn.style.transform = 'scale(1)';

            btn.onclick = (e) => {
                e.stopPropagation();
                obj.selectedEmoji = emoji;
                if (onEvent) onEvent(obj.id, 'onSelect', emoji);
                Stage.renderEmojiPicker(el, obj, cellSize, onEvent); // Re-render for selection highlight
            };

            el.appendChild(btn);
        });
    }
}
