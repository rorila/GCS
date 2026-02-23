import { GridConfig } from '../../model/types';
import { changeRecorder, DragPoint } from '../../services/ChangeRecorder';

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
    private dragObjId: string | null = null;
    private initialSize: { w: number, h: number } | null = null;
    private initialPos: { left: number, top: number } | null = null;
    private isCopyDrag: boolean = false;
    private dragGhost: HTMLElement | null = null;

    // Rectangle Selection
    private isRectSelecting: boolean = false;
    private rectStart: { x: number, y: number } | null = null;
    private selectionRectEl: HTMLElement | null = null;

    // Group Drag
    private initialPositions: Map<string, { left: number, top: number }> = new Map();
    private initialDragPositions: Map<string, { x: number, y: number }> = new Map();
    private currentDragPath: DragPoint[] = [];
    private dragStartTime: number = 0;

    // Context Menu
    private contextMenuEl: HTMLElement | null = null;

    // Copy/Paste
    private clipboardObjects: { obj: any, offsetX: number, offsetY: number }[] = [];
    private isPlacing: boolean = false;
    private placingGhostEl: HTMLElement | null = null;


    constructor(host: StageInteractionHost) {
        this.host = host;
    }

    public bindEvents() {
        const el = this.host.element;

        // Drag & Drop
        el.addEventListener('dragover', (e) => {
            if (this.host.runMode) return;
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'copy';
            el.classList.add('drag-over');
        });

        el.addEventListener('dragleave', () => {
            if (this.host.runMode) return;
            el.classList.remove('drag-over');
        });

        el.addEventListener('drop', (e) => this.handleDrop(e));

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

    private handleDrop(e: DragEvent) {
        if (this.host.runMode) return;
        e.preventDefault();
        this.host.element.classList.remove('drag-over');

        const data = e.dataTransfer?.getData('application/json');
        if (data) {
            try {
                const payload = JSON.parse(data);
                if (payload.type === 'tool-drop' && this.host.onDropCallback) {
                    const rect = this.host.element.getBoundingClientRect();
                    const rawX = e.clientX - rect.left;
                    const rawY = e.clientY - rect.top;
                    const gridX = Math.floor(rawX / this.host.grid.cellSize);
                    const gridY = Math.floor(rawY / this.host.grid.cellSize);
                    this.host.onDropCallback(payload.toolType, gridX, gridY);
                }
            } catch (err) {
                console.error("Drop Error", err);
            }
        }
    }

    private handleMouseDown(e: MouseEvent) {
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
                if (e.shiftKey) {
                    if (this.host.selectedIds.has(id)) this.host.selectedIds.delete(id);
                    else this.host.selectedIds.add(id);
                } else {
                    if (!this.host.selectedIds.has(id)) {
                        this.host.selectedIds.clear();
                        this.host.selectedIds.add(id);
                    }
                }

                this.isDragging = true;
                this.dragObjId = id;
                this.dragStart = { x: e.clientX, y: e.clientY };

                this.initialPositions.clear();
                this.host.selectedIds.forEach(selectedId => {
                    const el = this.host.element.querySelector(`[data-id="${selectedId}"]`) as HTMLElement;
                    if (el) {
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
            const rect = this.host.element.getBoundingClientRect();
            this.isRectSelecting = true;
            this.rectStart = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };

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
            if (this.isDragging && this.dragObjId && this.dragStart) {
                e.preventDefault();
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
                if (this.isCopyDrag && this.dragGhost) {
                    this.dragGhost.style.transform = `translate(${dx}px, ${dy}px)`;
                } else {
                    const el = this.host.element.querySelector(`[data-id="${this.dragObjId}"]`) as HTMLElement;
                    if (el) el.style.transform = `translate(${dx}px, ${dy}px)`;
                }
            }
            return;
        }



        if (this.isRectSelecting && this.rectStart) {
            const stageRect = this.host.element.getBoundingClientRect();
            const currentX = e.clientX - stageRect.left;
            const currentY = e.clientY - stageRect.top;

            if (Math.abs(currentX - this.rectStart.x) < 5 && Math.abs(currentY - this.rectStart.y) < 5) return;

            if (!this.selectionRectEl) {
                this.selectionRectEl = document.createElement('div');
                this.selectionRectEl.style.cssText = 'position:absolute; border:1px dashed #4fc3f7; background:rgba(79, 195, 247, 0.1); pointer-events:none; z-index:1000;';
                this.host.element.appendChild(this.selectionRectEl);
            }

            const left = Math.min(this.rectStart.x, currentX);
            const top = Math.min(this.rectStart.y, currentY);
            const width = Math.abs(currentX - this.rectStart.x);
            const height = Math.abs(currentY - this.rectStart.y);

            this.selectionRectEl.style.left = `${left}px`;
            this.selectionRectEl.style.top = `${top}px`;
            this.selectionRectEl.style.width = `${width}px`;
            this.selectionRectEl.style.height = `${height}px`;
            return;
        }

        if (this.isPlacing && this.placingGhostEl) {
            const rect = this.host.element.getBoundingClientRect();
            const gridX = Math.floor((e.clientX - rect.left) / this.host.grid.cellSize) * this.host.grid.cellSize;
            const gridY = Math.floor((e.clientY - rect.top) / this.host.grid.cellSize) * this.host.grid.cellSize;
            this.placingGhostEl.style.left = `${gridX}px`;
            this.placingGhostEl.style.top = `${gridY}px`;
        }

        if (!this.dragStart || !this.dragObjId) return;

        if (this.isResizing && this.initialSize && this.initialPos) {
            e.preventDefault();
            const el = this.host.element.querySelector(`[data-id="${this.dragObjId}"]`) as HTMLElement;
            if (el) {
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
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
        } else if (this.isDragging) {
            e.preventDefault();
            const dx = e.clientX - this.dragStart.x;
            const dy = e.clientY - this.dragStart.y;
            this.host.selectedIds.forEach(id => {
                const el = this.host.element.querySelector(`[data-id="${id}"]`) as HTMLElement;
                if (el) el.style.transform = `translate(${dx}px, ${dy}px)`;
            });
            if (this.dragStartTime > 0) {
                this.currentDragPath.push({ x: e.clientX, y: e.clientY, t: Date.now() - this.dragStartTime });
            }
        }
    }

    private handleMouseUp(e: MouseEvent) {
        if (this.host.runMode) {
            if (this.isDragging && this.dragObjId && this.dragStart) {
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                    const el = this.host.element.querySelector(`[data-id="${this.dragObjId}"]`) as HTMLElement;
                    if (el) {
                        el.style.transform = '';
                        const gridX = Math.round((parseFloat(el.style.left || '0') + dx) / this.host.grid.cellSize);
                        const gridY = Math.round((parseFloat(el.style.top || '0') + dy) / this.host.grid.cellSize);
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
        if (this.isRectSelecting && this.rectStart) {
            if (this.selectionRectEl) {
                const stageRect = this.host.element.getBoundingClientRect();
                const selL = Math.min(this.rectStart.x, e.clientX - stageRect.left);
                const selT = Math.min(this.rectStart.y, e.clientY - stageRect.top);
                const selR = Math.max(this.rectStart.x, e.clientX - stageRect.left);
                const selB = Math.max(this.rectStart.y, e.clientY - stageRect.top);

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
            (this as any).pendingClientPanelId = null; this.isRectSelecting = false; this.rectStart = null;
            return;
        }

        // Drag/Resize finish
        if (this.dragObjId && this.dragStart) {
            const dx = e.clientX - this.dragStart.x, dy = e.clientY - this.dragStart.y;
            if (this.isResizing && this.initialSize && this.initialPos) {
                const el = this.host.element.querySelector(`[data-id="${this.dragObjId}"]`) as HTMLElement;
                if (el) {
                    const gW = Math.round(parseFloat(el.style.width) / this.host.grid.cellSize), gH = Math.round(parseFloat(el.style.height) / this.host.grid.cellSize), gX = Math.round(parseFloat(el.style.left || '0') / this.host.grid.cellSize), gY = Math.round(parseFloat(el.style.top || '0') / this.host.grid.cellSize);
                    if (this.resizeDirection.match(/[wn]/) && this.host.onObjectMove) this.host.onObjectMove(this.dragObjId, Math.max(0, gX), Math.max(0, gY));
                    if (this.host.onObjectResize) this.host.onObjectResize(this.dragObjId, Math.max(1, gW), Math.max(1, gH));
                }
            } else if (this.isDragging) {
                this.host.selectedIds.forEach(id => {
                    const el = this.host.element.querySelector(`[data-id="${id}"]`) as HTMLElement;
                    if (el) {
                        el.style.transform = 'none';
                        const iP = this.initialPositions.get(id), iG = this.initialDragPositions.get(id);
                        if (iP && iG) {
                            const gX = Math.round((iP.left + dx) / this.host.grid.cellSize), gY = Math.round((iP.top + dy) / this.host.grid.cellSize);
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
            }
        }

        this.isDragging = false; this.isResizing = false; this.resizeDirection = ''; this.dragObjId = null; this.dragStart = null;
        this.initialSize = null; this.initialPos = null; this.initialPositions.clear(); this.initialDragPositions.clear();
        this.currentDragPath = []; this.dragStartTime = 0;

        if (this.isPlacing) {
            const rect = this.host.element.getBoundingClientRect();
            this.finishPlacingSelection(Math.floor((e.clientX - rect.left) / this.host.grid.cellSize), Math.floor((e.clientY - rect.top) / this.host.grid.cellSize));
        }
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
        this.clipboardObjects = [];
        let minX = Infinity, minY = Infinity;
        const selected = Array.from(this.host.selectedIds);
        selected.forEach(id => {
            const el = this.host.element.querySelector(`[data-id="${id}"]`) as HTMLElement;
            if (el) {
                minX = Math.min(minX, parseFloat(el.style.left || '0') / this.host.grid.cellSize);
                minY = Math.min(minY, parseFloat(el.style.top || '0') / this.host.grid.cellSize);
            }
        });
        selected.forEach(id => {
            const clone = this.host.onCopyCallback!(id);
            if (clone) this.clipboardObjects.push({ obj: clone, offsetX: (clone.x || 0) - minX, offsetY: (clone.y || 0) - minY });
        });
        if (this.clipboardObjects.length > 0) this.startPlacingSelection();
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
            clone.id = crypto.randomUUID(); clone.name = `${item.obj.name}_copy`;
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
