import { GridConfig } from '../../model/types';
import { changeRecorder, DragPoint } from '../../services/ChangeRecorder';
import { DnDHelper, DnDPayload } from '../utils/DnDHelper';

export interface StageInteractionHost {
    element: HTMLElement;
    grid: GridConfig;
    runMode: boolean;
    isBlueprint: boolean;
    selectedIds: Set<string>;
    lastRenderedObjects: any[];
    selectedObject: any;

    onDropCallback: ((type: string, x: number, y: number) => void) | null;
    onSelectCallback: ((ids: string[]) => void) | null;
    onObjectMove: ((id: string, x: number, y: number) => void) | null;
    onObjectResize: ((id: string, w: number, h: number) => void) | null;
    onCopyCallback: ((id: string) => any) | null;
    onPasteCallback: ((obj: any, x: number, y: number) => string | null) | null;
    onDragStart: ((id: string) => void) | null;
    onObjectCopy: ((id: string, x: number, y: number) => void) | null;
    onEvent: ((id: string, eventName: string, data?: any) => void) | null;

    clearSelection(): void;
    selectObject(id: string, additive: boolean): void;
    render(): void;
}

export class StageInteractionManager {
    private host: StageInteractionHost;

    // Drag/Resize State
    private isDragging: boolean = false;
    private isResizing: boolean = false;
    private resizeDirection: string = '';
    private dragStart: { x: number, y: number } | null = null;
    private dragStartRel: { x: number, y: number } | null = null;
    private dragObjId: string | null = null;
    private initialSize: { w: number, h: number } | null = null;
    private initialPos: { left: number, top: number } | null = null;
    private isCopyDrag: boolean = false;
    private dragGhost: HTMLElement | null = null;

    // Rectangle Selection
    private isRectSelecting: boolean = false;
    private rectStartRel: { x: number, y: number } | null = null;
    private selectionRectEl: HTMLElement | null = null;

    // Group Drag
    private initialPositions: Map<string, { left: number, top: number }> = new Map();
    private initialDragPositions: Map<string, { x: number, y: number }> = new Map();
    private currentDragPath: DragPoint[] = [];
    private dragStartTime: number = 0;
    private dragElements: Map<string, HTMLElement> = new Map();

    // Context Menu
    private contextMenuEl: HTMLElement | null = null;

    // Copy/Paste
    private clipboardObjects: { obj: any, offsetX: number, offsetY: number }[] = [];
    private isPlacing: boolean = false;
    private placingGhostEl: HTMLElement | null = null;


    constructor(host: StageInteractionHost) {
        this.host = host;
    }

    private snap(val: number, forceRound: boolean = false): number {
        const cellSize = this.host.grid.cellSize || 20;
        if (this.host.grid.snapToGrid || forceRound) {
            return Math.round(val / cellSize);
        }
        return val / cellSize;
    }

    private snapFloor(val: number): number {
        const cellSize = this.host.grid.cellSize || 20;
        if (this.host.grid.snapToGrid) {
            return Math.floor(val / cellSize);
        }
        return val / cellSize;
    }

    public bindEvents() {
        const el = this.host.element;

        // Drag & Drop (Unified via DnDHelper)
        DnDHelper.setupDropTarget(
            el,
            (payload, e) => this.handleDrop(payload, e),
            () => {
                if (this.host.runMode) return;
                el.classList.add('drag-over');
            }
        );

        // Mouse Events
        el.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // Keyboard Events
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Context Menu
        el.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        window.addEventListener('click', () => this.hideContextMenu());
    }

    private handleDrop(payload: DnDPayload, e: DragEvent) {
        if (this.host.runMode) return;

        if (payload.type === 'tool-drop' && this.host.onDropCallback) {
            const coords = this.getRelativeCoordinates(e);

            // NEW: Estimate tool dimensions for centering if we don't know them yet
            // Default tools are usually 6x2 (Buttons) or 10x6 (Panels)
            // We use a modest offset for a "centered" feel
            let offX = 3;
            let offY = 1;
            if (payload.toolType === 'Panel' || payload.toolType === 'TDataStore') {
                offX = 5; offY = 3;
            }

            const gridX = this.snapFloor(coords.x) - offX;
            const gridY = this.snapFloor(coords.y) - offY;
            this.host.onDropCallback(payload.toolType, Math.max(0, gridX), Math.max(0, gridY));
        }
    }

    private getRelativeCoordinates(e: MouseEvent | DragEvent) {
        const rect = this.host.element.getBoundingClientRect();
        const scaleX = rect.width / this.host.element.offsetWidth;
        const scaleY = rect.height / this.host.element.offsetHeight;

        // NEW: Account for scroll and borders/padding of the stage itself
        const style = window.getComputedStyle(this.host.element);
        const borderLeft = parseFloat(style.borderLeftWidth) || 0;
        const borderTop = parseFloat(style.borderTopWidth) || 0;
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        const paddingTop = parseFloat(style.paddingTop) || 0;

        return {
            x: (e.clientX - rect.left - borderLeft) / (scaleX || 1) - paddingLeft,
            y: (e.clientY - rect.top - borderTop) / (scaleY || 1) - paddingTop,
            scaleX: scaleX || 1,
            scaleY: scaleY || 1
        };
    }

    private handleMouseDown(e: MouseEvent) {
        // COPY-PASTE: Wenn isPlacing aktiv ist, wird der Klick zum Ablegen der Kopie verwendet.
        // Dies MUSS vor allen anderen Checks stehen, damit kein neuer Drag-Prozess gestartet wird.
        if (this.isPlacing && !this.host.runMode) {
            e.preventDefault();
            e.stopPropagation();
            const coords = this.getRelativeCoordinates(e);
            const gridX = this.snapFloor(coords.x);
            const gridY = this.snapFloor(coords.y);
            this.finishPlacingSelection(gridX, gridY);
            return;
        }

        const target = e.target as HTMLElement;
        const objEl = target.closest('.game-object') as HTMLElement;

        if (this.host.runMode) {
            if (objEl) {
                const id = objEl.getAttribute('data-id');
                if (id) {
                    const obj = this.host.lastRenderedObjects.find(o => (o.id || o.name) === id);
                    if (obj && (obj.draggable || obj.draggableAtRuntime)) {
                        this.dragStart = { x: e.clientX, y: e.clientY };
                        this.isDragging = true;
                        this.dragObjId = id;

                        if (obj.dragMode === 'copy') {
                            this.isCopyDrag = true;
                            const originalEl = this.host.element.querySelector(`[data-id="${id}"]`) as HTMLElement;
                            if (originalEl) {
                                this.dragGhost = originalEl.cloneNode(true) as HTMLElement;
                                this.dragGhost.style.opacity = '0.7';
                                this.dragGhost.style.pointerEvents = 'none';
                                this.dragGhost.style.zIndex = '1000';
                                this.host.element.appendChild(this.dragGhost);
                            }
                        } else {
                            this.isCopyDrag = false;
                        }

                        if (this.host.onDragStart) this.host.onDragStart(id);
                        e.preventDefault();
                    }
                }
            }
            return;
        }

        // Resize Start
        if (target.classList.contains('resize-handle')) {
            const parent = target.parentElement;
            if (parent && parent.getAttribute('data-id')) {
                this.isResizing = true;
                this.dragObjId = parent.getAttribute('data-id');
                this.dragStart = { x: e.clientX, y: e.clientY };
                const coords = this.getRelativeCoordinates(e);
                this.dragStartRel = { x: coords.x, y: coords.y };

                const classes = target.className.split(' ');
                this.resizeDirection = classes.find(c => ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].includes(c)) || 'se';

                const w = parseFloat(parent.style.width);
                const h = parseFloat(parent.style.height);
                const left = parseFloat(parent.style.left || '0');
                const top = parseFloat(parent.style.top || '0');
                this.initialSize = { w, h };
                this.initialPos = { left, top };

                e.stopPropagation();
                return;
            }
        }

        // Move / Select Start
        const hitObject = target.closest('.game-object') as HTMLElement;
        const isClientPanel = hitObject && hitObject.getAttribute('data-align') === 'CLIENT';

        if (hitObject && !isClientPanel) {
            const id = hitObject.getAttribute('data-id');
            if (id) {
                // Prüfen ob dieses Objekt ein geerbtes Blueprint-Objekt ist
                const obj = this.host.lastRenderedObjects.find(o => (o.id || o.name) === id);
                const isInherited = obj && obj.isInherited;

                if (e.shiftKey) {
                    if (this.host.selectedIds.has(id)) this.host.selectedIds.delete(id);
                    else this.host.selectedIds.add(id);
                } else {
                    if (!this.host.selectedIds.has(id)) {
                        this.host.selectedIds.clear();
                        this.host.selectedIds.add(id);
                    }
                }

                // Geerbte Objekte: Selektion erlauben, aber KEIN Drag/Move
                if (!isInherited) {
                    this.isDragging = true;
                    this.dragObjId = id;
                    this.dragStart = { x: e.clientX, y: e.clientY };
                    const coords = this.getRelativeCoordinates(e);
                    this.dragStartRel = { x: coords.x, y: coords.y };
                }

                this.dragElements.clear();
                this.initialPositions.clear();
                this.host.selectedIds.forEach(selectedId => {
                    const el = this.host.element.querySelector(`[data-id="${selectedId}"]`) as HTMLElement;
                    if (el) {
                        this.dragElements.set(selectedId, el);
                        this.initialPositions.set(selectedId, {
                            left: parseFloat(el.style.left || '0'),
                            top: parseFloat(el.style.top || '0')
                        });
                    }
                });

                if (this.host.onSelectCallback) this.host.onSelectCallback(Array.from(this.host.selectedIds));

                this.dragStartTime = Date.now();
                this.currentDragPath = [{ x: e.clientX, y: e.clientY, t: 0 }];
                this.initialDragPositions.clear();
                this.host.selectedIds.forEach(selectedId => {
                    const obj = this.host.lastRenderedObjects.find(o => o.id === selectedId);
                    if (obj) this.initialDragPositions.set(selectedId, { x: obj.x, y: obj.y });
                });

                changeRecorder.startBatch(`Objekte verschoben`);
            }
        } else {
            this.isRectSelecting = true;
            const coords = this.getRelativeCoordinates(e);
            this.rectStartRel = { x: coords.x, y: coords.y };

            if (isClientPanel) {
                (this as any).pendingClientPanelId = hitObject.getAttribute('data-id');
            } else {
                (this as any).pendingClientPanelId = null;
                if (!e.shiftKey && this.host.selectedIds.size > 0) {
                    this.host.selectedIds.clear();
                    if (this.host.onSelectCallback) this.host.onSelectCallback([]);
                }
            }
        }
    }

    private handleMouseMove(e: MouseEvent) {
        if (this.host.runMode) {
            if (this.isDragging && this.dragObjId && this.dragStartRel) {
                e.preventDefault();
                const coords = this.getRelativeCoordinates(e);
                const dx = coords.x - this.dragStartRel.x;
                const dy = coords.y - this.dragStartRel.y;

                if (this.isCopyDrag && this.dragGhost) {
                    this.dragGhost.style.transform = `translate(${dx}px, ${dy}px)`;
                } else {
                    const el = this.host.element.querySelector(`[data-id="${this.dragObjId}"]`) as HTMLElement;
                    if (el) el.style.transform = `translate(${dx}px, ${dy}px)`;
                }
            }
            return;
        }



        if (this.isRectSelecting && this.rectStartRel) {
            const coords = this.getRelativeCoordinates(e);
            const dx = coords.x - this.rectStartRel.x;
            const dy = coords.y - this.rectStartRel.y;

            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

            if (!this.selectionRectEl) {
                this.selectionRectEl = document.createElement('div');
                this.selectionRectEl.style.cssText = 'position:absolute; border:1px dashed #4fc3f7; background:rgba(79, 195, 247, 0.1); pointer-events:none; z-index:1000;';
                this.host.element.appendChild(this.selectionRectEl);
            }

            const left = Math.min(this.rectStartRel.x, coords.x);
            const top = Math.min(this.rectStartRel.y, coords.y);
            const width = Math.abs(dx);
            const height = Math.abs(dy);

            this.selectionRectEl.style.left = `${left}px`;
            this.selectionRectEl.style.top = `${top}px`;
            this.selectionRectEl.style.width = `${width}px`;
            this.selectionRectEl.style.height = `${height}px`;
            return;
        }

        if (this.isPlacing && this.placingGhostEl) {
            const coords = this.getRelativeCoordinates(e);
            const gridX = this.host.grid.snapToGrid ? Math.floor(coords.x / this.host.grid.cellSize) * this.host.grid.cellSize : coords.x;
            const gridY = this.host.grid.snapToGrid ? Math.floor(coords.y / this.host.grid.cellSize) * this.host.grid.cellSize : coords.y;
            this.placingGhostEl.style.left = `${gridX}px`;
            this.placingGhostEl.style.top = `${gridY}px`;
        }

        if (!this.dragStart || !this.dragObjId) return;

        if (this.isResizing && this.initialSize && this.initialPos) {
            e.preventDefault();
            const el = this.host.element.querySelector(`[data-id="${this.dragObjId}"]`) as HTMLElement;
            if (el) {
                const coords = this.getRelativeCoordinates(e);
                const dx = coords.x - this.dragStartRel!.x;
                const dy = coords.y - this.dragStartRel!.y;
                const dir = this.resizeDirection;
                const minSize = this.host.grid.cellSize;

                let newW = this.initialSize.w, newH = this.initialSize.h, newLeft = this.initialPos.left, newTop = this.initialPos.top;

                if (dir.includes('e')) newW = Math.max(minSize, this.initialSize.w + dx);
                if (dir.includes('w')) {
                    newW = Math.max(minSize, this.initialSize.w - dx);
                    newLeft = this.initialPos.left + dx;
                    if (newW === minSize) newLeft = this.initialPos.left + this.initialSize.w - minSize;
                }
                if (dir.includes('s')) newH = Math.max(minSize, this.initialSize.h + dy);
                if (dir.includes('n')) {
                    newH = Math.max(minSize, this.initialSize.h - dy);
                    newTop = this.initialPos.top + dy;
                    if (newH === minSize) newTop = this.initialPos.top + this.initialSize.h - minSize;
                }

                const obj = this.host.selectedObject;
                if (obj && obj.className === 'TShape' && obj.shapeType === 'circle') {
                    const size = Math.max(newW, newH);
                    newW = size; newH = size;
                    if (dir.includes('w')) newLeft = this.initialPos.left + (this.initialSize.w - size);
                    if (dir.includes('n')) newTop = this.initialPos.top + (this.initialSize.h - size);
                }

                el.style.width = `${newW}px`; el.style.height = `${newH}px`;
                el.style.left = `${newLeft}px`; el.style.top = `${newTop}px`;
            }
        } else if (this.isDragging && this.dragStartRel) {
            e.preventDefault();
            const coords = this.getRelativeCoordinates(e);
            const dx = coords.x - this.dragStartRel.x;
            const dy = coords.y - this.dragStartRel.y;

            this.dragElements.forEach((el) => {
                el.style.transform = `translate(${dx}px, ${dy}px)`;
            });

            if (this.dragStartTime > 0) {
                this.currentDragPath.push({ x: e.clientX, y: e.clientY, t: Date.now() - this.dragStartTime });
            }
        }
    }

    private handleMouseUp(e: MouseEvent) {
        if (this.host.runMode) {
            if (this.isDragging && this.dragObjId && this.dragStartRel) {
                const coords = this.getRelativeCoordinates(e);
                const dx = coords.x - this.dragStartRel.x;
                const dy = coords.y - this.dragStartRel.y;

                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                    const el = this.host.element.querySelector(`[data-id="${this.dragObjId}"]`) as HTMLElement;
                    if (el) {
                        el.style.transform = '';
                        const gridX = this.snap(parseFloat(el.style.left || '0') + dx);
                        const gridY = this.snap(parseFloat(el.style.top || '0') + dy);
                        if (this.isCopyDrag && this.host.onObjectCopy) this.host.onObjectCopy(this.dragObjId, Math.max(0, gridX), Math.max(0, gridY));
                        else if (!this.isCopyDrag && this.host.onObjectMove) this.host.onObjectMove(this.dragObjId, Math.max(0, gridX), Math.max(0, gridY));
                    }
                }
                if (this.dragGhost) { this.dragGhost.remove(); this.dragGhost = null; }
                this.isCopyDrag = false; this.isDragging = false; this.dragObjId = null; this.dragStart = null;
            }
            return;
        }

        // Rect selection finish
        if (this.isRectSelecting && this.rectStartRel) {
            if (this.selectionRectEl) {
                const coords = this.getRelativeCoordinates(e);
                const selL = Math.min(this.rectStartRel.x, coords.x);
                const selT = Math.min(this.rectStartRel.y, coords.y);
                const selR = Math.max(this.rectStartRel.x, coords.x);
                const selB = Math.max(this.rectStartRel.y, coords.y);

                this.host.element.querySelectorAll('.game-object').forEach(el => {
                    const htmlEl = el as HTMLElement;
                    if (htmlEl.getAttribute('data-align') === 'CLIENT') return;
                    const L = parseFloat(htmlEl.style.left || '0'), T = parseFloat(htmlEl.style.top || '0'), R = L + parseFloat(htmlEl.style.width || '0'), B = T + parseFloat(htmlEl.style.height || '0');
                    if (L < selR && R > selL && T < selB && B > selT) {
                        const id = htmlEl.getAttribute('data-id');
                        if (id) this.host.selectedIds.add(id);
                    }
                });
                this.selectionRectEl.remove(); this.selectionRectEl = null;
                if (this.host.onSelectCallback) this.host.onSelectCallback(Array.from(this.host.selectedIds));
            } else {
                const pid = (this as any).pendingClientPanelId;
                if (pid) {
                    this.host.selectedIds.clear(); this.host.selectedIds.add(pid);
                    if (this.host.onSelectCallback) this.host.onSelectCallback(Array.from(this.host.selectedIds));
                }
            }
            (this as any).pendingClientPanelId = null; this.isRectSelecting = false; this.rectStartRel = null;
            return;
        }

        // Drag/Resize finish
        if (this.dragObjId && this.dragStartRel) {
            const coords = this.getRelativeCoordinates(e);
            const dx = coords.x - this.dragStartRel.x;
            const dy = coords.y - this.dragStartRel.y;

            if (this.isResizing && this.initialSize && this.initialPos) {
                const el = this.host.element.querySelector(`[data-id="${this.dragObjId}"]`) as HTMLElement;
                if (el) {
                    const gW = this.snap(parseFloat(el.style.width)), gH = this.snap(parseFloat(el.style.height)), gX = this.snap(parseFloat(el.style.left || '0')), gY = this.snap(parseFloat(el.style.top || '0'));
                    if (this.resizeDirection.match(/[wn]/) && this.host.onObjectMove) this.host.onObjectMove(this.dragObjId, Math.max(0, gX), Math.max(0, gY));
                    if (this.host.onObjectResize) this.host.onObjectResize(this.dragObjId, Math.max(1, gW), Math.max(1, gH));
                }
            } else if (this.isDragging) {
                this.host.selectedIds.forEach(id => {
                    const el = this.host.element.querySelector(`[data-id="${id}"]`) as HTMLElement;
                    if (el) {
                        el.style.transform = '';
                        const iP = this.initialPositions.get(id), iG = this.initialDragPositions.get(id);
                        if (iP && iG) {
                            const gX = this.snap(iP.left + dx), gY = this.snap(iP.top + dy);
                            if (gX !== iG.x || gY !== iG.y) {
                                const obj = this.host.lastRenderedObjects.find(o => o.id === id);
                                if (obj) {
                                    changeRecorder.record({ type: 'drag', description: `${obj.name} verschoben nach (${gX}, ${gY})`, objectId: id, objectType: 'object', startPosition: { x: iG.x, y: iG.y }, endPosition: { x: gX, y: gY }, dragPath: [...this.currentDragPath] });
                                    if (this.host.onObjectMove) this.host.onObjectMove(id, Math.max(0, gX), Math.max(0, gY));
                                }
                            }
                        }
                    }
                });
                changeRecorder.endBatch();
                this.host.render(); // Ensure new coordinates are applied to DOM
            }
        }

        this.isDragging = false; this.isResizing = false; this.resizeDirection = ''; this.dragObjId = null; this.dragStart = null; this.dragStartRel = null;
        this.initialSize = null; this.initialPos = null; this.initialPositions.clear(); this.initialDragPositions.clear();
        this.dragElements.clear();
        this.isRectSelecting = false; this.rectStartRel = null;
        this.currentDragPath = []; this.dragStartTime = 0;
    }

    private handleKeyDown(e: KeyboardEvent) {
        if (this.host.runMode) return;
        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            this.host.element.querySelectorAll('.game-object').forEach(el => {
                const id = el.getAttribute('data-id');
                if (id) this.host.selectedIds.add(id);
            });
            if (this.host.onSelectCallback) this.host.onSelectCallback(Array.from(this.host.selectedIds));
        }
        if (e.ctrlKey && e.key === 'c' && this.host.selectedIds.size > 0) { e.preventDefault(); this.copySelection(); }
        if (e.ctrlKey && e.key === 'v') { e.preventDefault(); this.pasteSelection(); }
        if (e.key === 'Escape' && this.isPlacing) this.cancelPlacing();
        if (e.key === 'Delete' && this.host.selectedIds.size > 0) {
            e.preventDefault();
            const ids = Array.from(this.host.selectedIds);
            if (this.host.onEvent) this.host.onEvent('', 'deleteMultiple', ids);
            this.host.selectedIds.clear();
            if (this.host.onSelectCallback) this.host.onSelectCallback([]);
        }
    }

    private handleContextMenu(e: MouseEvent) {
        if (this.host.runMode) return;
        e.preventDefault();
        const objEl = (e.target as HTMLElement).closest('.game-object') as HTMLElement;
        if (objEl) {
            const id = objEl.getAttribute('data-id');
            if (id) this.showContextMenu(e.clientX, e.clientY, id);
        } else {
            this.hideContextMenu();
        }
    }

    private showContextMenu(clientX: number, clientY: number, objectId: string) {
        this.hideContextMenu();
        this.contextMenuEl = document.createElement('div');
        this.contextMenuEl.className = 'stage-context-menu';
        this.contextMenuEl.style.cssText = `position:fixed; left:${clientX}px; top:${clientY}px; background:#2d2d2d; border:1px solid #555; border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,0.4); z-index:10000; min-width:120px; overflow:hidden;`;

        const obj = this.host.lastRenderedObjects.find(o => o.id === objectId);
        if (obj) {
            if (obj.isGhost) this.addContextItem('📌 In Stage anzeigen', '#4fc3f7', () => { if (this.host.onEvent) this.host.onEvent(objectId, 'pinGlobal'); });
            else if (obj.scope === 'global' && !this.host.isBlueprint) this.addContextItem('🚫 Aus Stage entfernen', '#ffab91', () => { if (this.host.onEvent) this.host.onEvent(objectId, 'unpinGlobal'); });

            // Blueprint-Vererbung: Geerbtes Objekt auf dieser Stage ausblenden
            if (obj.isInherited && obj.isFromBlueprint && !this.host.isBlueprint) {
                this.addContextItem('👻 Auf dieser Stage ausblenden', '#ffab91', () => {
                    if (this.host.onEvent) this.host.onEvent(objectId, 'excludeBlueprint');
                });
            }
        }

        this.addContextItem('📋 Kopieren', '#fff', () => {
            if (!this.host.selectedIds.has(objectId)) {
                this.host.selectedIds.clear(); this.host.selectedIds.add(objectId);
                if (this.host.onSelectCallback) this.host.onSelectCallback([objectId]);
            }
            this.copySelection();
        });

        this.addContextItem('🗑️ Löschen', '#ff6b6b', () => {
            if (this.host.onEvent) {
                if (this.host.selectedIds.has(objectId) && this.host.selectedIds.size > 1) {
                    this.host.onEvent('', 'deleteMultiple', Array.from(this.host.selectedIds));
                    this.host.selectedIds.clear();
                } else {
                    this.host.onEvent(objectId, 'delete');
                    this.host.selectedIds.delete(objectId);
                }
                if (this.host.onSelectCallback) this.host.onSelectCallback(Array.from(this.host.selectedIds));
            }
        });

        document.body.appendChild(this.contextMenuEl);
    }

    private addContextItem(label: string, color: string, onClick: () => void) {
        const item = document.createElement('div');
        item.style.cssText = `padding:8px 12px; cursor:pointer; color:${color}; font-size:13px; transition:background 0.15s; border-bottom:1px solid #444;`;
        item.innerText = label;
        item.onmouseenter = () => item.style.background = '#3d3d3d';
        item.onmouseleave = () => item.style.background = 'transparent';
        item.onclick = (e) => { e.stopPropagation(); onClick(); this.hideContextMenu(); };
        this.contextMenuEl!.appendChild(item);
    }

    private hideContextMenu() {
        if (this.contextMenuEl) { this.contextMenuEl.remove(); this.contextMenuEl = null; }
    }

    private copySelection() {
        if (!this.host.onCopyCallback || this.host.selectedIds.size === 0) return;
        const clipboardObjects: any[] = [];
        let minX = Infinity, minY = Infinity;
        const selected = Array.from(this.host.selectedIds);
        selected.forEach(id => {
            const el = this.host.element.querySelector(`[data-id="${id}"]`) as HTMLElement;
            if (el) {
                minX = Math.min(minX, this.snap(parseFloat(el.style.left || '0'), true));
                minY = Math.min(minY, this.snap(parseFloat(el.style.top || '0'), true));
            }
        });
        selected.forEach(id => {
            const clone = this.host.onCopyCallback!(id);
            if (clone) clipboardObjects.push({ obj: clone, offsetX: (clone.x || 0) - minX, offsetY: (clone.y || 0) - minY });
        });
        if (clipboardObjects.length > 0) {
            // Im globalen Windows-Objekt ablegen für Stage-übergreifendes Copy-Paste
            (window as any).__gcsClipboard = clipboardObjects;
            console.log(`[StageInteractionManager] ${clipboardObjects.length} Objekte in Zwischenablage kopiert.`);
        }
    }

    private pasteSelection() {
        const globalClipboard = (window as any).__gcsClipboard;
        if (globalClipboard && globalClipboard.length > 0) {
            this.clipboardObjects = globalClipboard;
            this.startPlacingSelection();
        }
    }

    private startPlacingSelection() {
        if (this.clipboardObjects.length === 0) return;
        this.isPlacing = true;
        this.host.element.style.cursor = 'grab';

        let maxW = 0, maxH = 0;
        this.clipboardObjects.forEach(i => { maxW = Math.max(maxW, i.offsetX + (i.obj.width || 1)); maxH = Math.max(maxH, i.offsetY + (i.obj.height || 1)); });

        this.placingGhostEl = document.createElement('div');
        this.placingGhostEl.style.cssText = `position:absolute; width:${maxW * this.host.grid.cellSize}px; height:${maxH * this.host.grid.cellSize}px; pointer-events:none; z-index:1000;`;

        this.clipboardObjects.forEach(item => {
            const g = document.createElement('div');
            g.style.cssText = `position:absolute; left:${item.offsetX * this.host.grid.cellSize}px; top:${item.offsetY * this.host.grid.cellSize}px; width:${(item.obj.width || 1) * this.host.grid.cellSize}px; height:${(item.obj.height || 1) * this.host.grid.cellSize}px; background:rgba(79, 195, 247, 0.3); border:2px dashed #4fc3f7; display:flex; align-items:center; justify-content:center; color:#4fc3f7; font-size:11px; box-sizing:border-box;`;
            g.innerText = item.obj.name || 'Kopie';
            this.placingGhostEl!.appendChild(g);
        });
        this.host.element.appendChild(this.placingGhostEl);
    }

    private finishPlacingSelection(gridX: number, gridY: number) {
        if (!this.host.onPasteCallback) return;
        const newIds: string[] = [];
        this.clipboardObjects.forEach(item => {
            const clone = JSON.parse(JSON.stringify(item.obj));
            // Name und Copy-ID Vergabe wird jetzt dem onPasteCallback überlassen (siehe EditorInteractionManager)
            const nid = this.host.onPasteCallback!(clone, gridX + item.offsetX, gridY + item.offsetY);
            if (nid) newIds.push(nid);
        });
        if (newIds.length > 0) {
            this.host.selectedIds.clear(); newIds.forEach(id => this.host.selectedIds.add(id));
            if (this.host.onSelectCallback) this.host.onSelectCallback(newIds);
        }
        this.cancelPlacing();
    }

    public cancelPlacing() {
        this.isPlacing = false; this.host.element.style.cursor = 'default';
        if (this.placingGhostEl) { this.placingGhostEl.remove(); this.placingGhostEl = null; }
    }

    public focusObject(id: string) {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                const originalOutline = el.style.outline;
                el.style.outline = '4px solid #fff'; el.style.zIndex = '9999';
                setTimeout(() => {
                    el.style.outline = (this.host.selectedIds.has(id)) ? '2px solid #4fc3f7' : originalOutline;
                    el.style.zIndex = '';
                }, 1000);
            }
        }, 50);
    }
}
