import { GridConfig } from '../model/types';
import { changeRecorder, DragPoint } from '../services/ChangeRecorder';

export class Stage {
    private container: HTMLElement;
    private element: HTMLElement;


    // Callback for when an object is dropped
    public onDropCallback: ((type: string, x: number, y: number) => void) | null = null;
    public onSelectCallback: ((ids: string[]) => void) | null = null;
    public onObjectMove: ((id: string, x: number, y: number) => void) | null = null;
    public onObjectCopy: ((id: string, x: number, y: number) => void) | null = null;
    public onDragStart: ((id: string) => void) | null = null;

    // ... existing properties
    private dragGhost: HTMLElement | null = null;
    private isCopyDrag: boolean = false;
    public onObjectResize: ((id: string, w: number, h: number) => void) | null = null;
    public onCopyCallback: ((id: string) => any) | null = null; // Returns cloned object
    public onPasteCallback: ((obj: any, x: number, y: number) => string | null) | null = null; // Returns new ID

    // Multi-selection state
    private selectedIds: Set<string> = new Set();
    private isDragging: boolean = false;
    private isResizing: boolean = false;
    private resizeDirection: string = ''; // n, s, e, w, nw, ne, sw, se
    private dragStart: { x: number, y: number } | null = null;
    private dragObjId: string | null = null;
    private initialSize: { w: number, h: number } | null = null;
    private initialPos: { left: number, top: number } | null = null;

    // Rectangle selection state
    private isRectSelecting: boolean = false;
    private rectStart: { x: number, y: number } | null = null;
    private selectionRectEl: HTMLElement | null = null;

    // Group drag state - stores initial positions of all selected objects
    private initialPositions: Map<string, { left: number, top: number }> = new Map();

    // Context menu state
    private contextMenuEl: HTMLElement | null = null;

    // Copy/Paste and placing state - now supports multi-selection
    private clipboardObjects: { obj: any, offsetX: number, offsetY: number }[] = [];
    private isPlacing: boolean = false;
    private placingGhostEl: HTMLElement | null = null;
    private lastMousePos: { x: number, y: number } | null = null;
    private lastRenderedObjects: any[] = []; // Track objects for runtime lookup (e.g. draggable)
    private currentDragPath: DragPoint[] = [];
    private dragStartTime: number = 0;
    private initialDragPositions: Map<string, { x: number, y: number }> = new Map();

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
    private gridConfig: GridConfig;
    private _selectedObject: any = null; // Currently selected object (primary)

    public get selectedObject(): any {
        return this._selectedObject;
    }

    public set selectedObject(obj: any) {
        this._selectedObject = obj;
        // Sync selectedIds to ensure visual selection works
        if (obj) {
            if (!this.selectedIds.has(obj.id)) {
                this.selectedIds.clear();
                this.selectedIds.add(obj.id);
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
        this.element.id = 'game-stage';
        this.element.style.position = 'relative';
        this.element.style.transformOrigin = 'top left';
        this.element.style.backgroundColor = '#1a1a2e'; // Force opaque background to hide potential ghosts

        // Clear container to prevent "2 levels" when game is reloaded
        this.container.innerHTML = '';
        this.container.appendChild(this.element);

        this.updategrid();
        this.bindEvents();
    }

    private bindEvents() {
        this.element.addEventListener('dragover', (e) => {
            if (this.runMode) return;
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'copy';
            this.element.classList.add('drag-over');
        });

        this.element.addEventListener('dragleave', () => {
            if (this.runMode) return;
            this.element.classList.remove('drag-over');
        });

        this.element.addEventListener('drop', (e) => {
            if (this.runMode) return;
            e.preventDefault();
            this.element.classList.remove('drag-over');

            const data = e.dataTransfer?.getData('application/json');
            if (data) {
                try {
                    const payload = JSON.parse(data);
                    if (payload.type === 'tool-drop' && this.onDropCallback) {
                        const rect = this.element.getBoundingClientRect();
                        const rawX = e.clientX - rect.left;
                        const rawY = e.clientY - rect.top;
                        const gridX = Math.floor(rawX / this.gridConfig.cellSize);
                        const gridY = Math.floor(rawY / this.gridConfig.cellSize);
                        this.onDropCallback(payload.toolType, gridX, gridY);
                    }
                } catch (err) {
                    console.error("Drop Error", err);
                }
            }
        });

        // Object Interaction (Select / Move / Resize) - EDIT MODE ONLY
        this.element.addEventListener('mousedown', (e) => {
            const target = e.target as HTMLElement;
            const objEl = target.closest('.game-object') as HTMLElement;

            if (this.runMode) {
                // Runtime Interaction
                if (objEl) {
                    const id = objEl.getAttribute('data-id');
                    if (id) {
                        const obj = this.lastRenderedObjects.find(o => (o.id || o.name) === id);

                        // Check if draggable - explicit property check
                        if (obj && (obj.draggable || obj.draggableAtRuntime)) {
                            this.dragStart = { x: e.clientX, y: e.clientY };
                            this.isDragging = true;
                            this.dragObjId = id;

                            if (obj.dragMode === 'copy') {
                                this.isCopyDrag = true;
                                // Create ghost
                                const originalEl = this.element.querySelector(`[data-id="${id}"]`) as HTMLElement;
                                if (originalEl) {
                                    this.dragGhost = originalEl.cloneNode(true) as HTMLElement;
                                    this.dragGhost.style.opacity = '0.7';
                                    this.dragGhost.style.pointerEvents = 'none';
                                    this.dragGhost.style.zIndex = '1000';
                                    this.element.appendChild(this.dragGhost);
                                }
                            } else {
                                this.isCopyDrag = false;
                            }

                            // Trigger onDragStart
                            if (this.onDragStart) {
                                this.onDragStart(id);
                            }

                            e.preventDefault();
                        } else if (obj && (obj.Tasks?.onClick || obj.Tasks?.onSingleClick)) {
                            // Let click pass through usually, but preventing default might stop it?
                            // Click handlers are on element.onclick, so mousedown prevention might be ok or bad.
                            // We don't prevent default for clicks unless dragging.
                        }
                    }
                }
                return;
            }

            // 1. Handle Resize Start
            if (target.classList.contains('resize-handle')) {
                const parent = target.parentElement;
                if (parent && parent.getAttribute('data-id')) {
                    this.isResizing = true;
                    this.dragObjId = parent.getAttribute('data-id');
                    this.dragStart = { x: e.clientX, y: e.clientY };

                    // Determine resize direction from handle class
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

            // 2. Handle Move / Select Start
            const hitObject = target.closest('.game-object') as HTMLElement;

            // Check if clicked object is a CLIENT-aligned panel
            const isClientPanel = hitObject && hitObject.getAttribute('data-align') === 'CLIENT';

            if (hitObject && !isClientPanel) {
                const id = hitObject.getAttribute('data-id');
                if (id) {
                    // Shift+Click: Toggle selection
                    if (e.shiftKey) {
                        if (this.selectedIds.has(id)) {
                            this.selectedIds.delete(id);
                        } else {
                            this.selectedIds.add(id);
                        }
                    } else {
                        // Normal click: Clear and select only this
                        if (!this.selectedIds.has(id)) {
                            this.selectedIds.clear();
                            this.selectedIds.add(id);
                        }
                    }

                    this.isDragging = true;
                    this.dragObjId = id;
                    this.dragStart = { x: e.clientX, y: e.clientY };

                    // Store initial positions of ALL selected objects for group drag
                    this.initialPositions.clear();
                    this.selectedIds.forEach(selectedId => {
                        const selectedEl = this.element.querySelector(`[data-id="${selectedId}"]`) as HTMLElement;
                        if (selectedEl) {
                            this.initialPositions.set(selectedId, {
                                left: parseFloat(selectedEl.style.left || '0'),
                                top: parseFloat(selectedEl.style.top || '0')
                            });
                        }
                    });

                    if (this.onSelectCallback) this.onSelectCallback(Array.from(this.selectedIds));

                    // Initialize drag path recording
                    this.dragStartTime = Date.now();
                    this.currentDragPath = [{ x: e.clientX, y: e.clientY, t: 0 }];
                    this.initialDragPositions.clear();

                    // Store initial coordinates for ALL selected objects (for undo/redo)
                    this.selectedIds.forEach(selectedId => {
                        const obj = this.lastRenderedObjects.find(o => o.id === selectedId);
                        if (obj) {
                            this.initialDragPositions.set(selectedId, { x: obj.x, y: obj.y });
                        }
                    });

                    changeRecorder.startBatch(`Objekte verschoben`);
                }
            } else {
                // Click on empty space OR CLIENT panel: Prepare for rectangle selection
                // Store the clicked position and CLIENT panel ID for later check
                const rect = this.element.getBoundingClientRect();
                this.isRectSelecting = true;
                this.rectStart = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };

                // Store CLIENT panel ID for simple click detection
                if (isClientPanel) {
                    (this as any).pendingClientPanelId = objEl.getAttribute('data-id');
                } else {
                    (this as any).pendingClientPanelId = null;
                    // Clear selection on empty space click
                    if (!e.shiftKey && this.selectedIds.size > 0) {
                        this.selectedIds.clear();
                        if (this.onSelectCallback) this.onSelectCallback([]);
                    }
                }
            }
        });


        window.addEventListener('mousemove', (e) => {
            if (this.runMode) {
                if (this.isDragging && this.dragObjId && this.dragStart) {
                    e.preventDefault();
                    const dx = e.clientX - this.dragStart.x;
                    const dy = e.clientY - this.dragStart.y;

                    if (this.isCopyDrag && this.dragGhost) {
                        // Move ghost
                        // Actually, cloneNode copies inline styles including transform if set.
                        // But for simplicity, let's use transform on ghost too.
                        // The ghost is cloned from current state, so it sits exactly on top.
                        // We just apply transform.
                        this.dragGhost.style.transform = `translate(${dx}px, ${dy}px)`;
                    } else {
                        // Runtime drag: update transform directly for smooth feedback
                        const el = this.element.querySelector(`[data-id="${this.dragObjId}"]`) as HTMLElement;
                        if (el) {
                            el.style.transform = `translate(${dx}px, ${dy}px)`;
                        }
                    }
                }
                return;
            }

            this.lastMousePos = { x: e.clientX, y: e.clientY };

            // Handle rectangle selection drawing
            if (this.isRectSelecting && this.rectStart) {
                const stageRect = this.element.getBoundingClientRect();
                const currentX = e.clientX - stageRect.left;
                const currentY = e.clientY - stageRect.top;

                // Only start drawing rectangle if moved at least 5px (prevents accidental rect on simple click)
                const minDragDistance = 5;
                const dragDistX = Math.abs(currentX - this.rectStart.x);
                const dragDistY = Math.abs(currentY - this.rectStart.y);

                if (dragDistX < minDragDistance && dragDistY < minDragDistance) {
                    // Not enough movement yet - don't show rectangle
                    return;
                }

                // Create or update selection rectangle
                if (!this.selectionRectEl) {
                    this.selectionRectEl = document.createElement('div');
                    this.selectionRectEl.style.position = 'absolute';
                    this.selectionRectEl.style.border = '1px dashed #4fc3f7';
                    this.selectionRectEl.style.backgroundColor = 'rgba(79, 195, 247, 0.1)';
                    this.selectionRectEl.style.pointerEvents = 'none';
                    this.selectionRectEl.style.zIndex = '1000';
                    this.element.appendChild(this.selectionRectEl);
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

            if (!this.dragStart || !this.dragObjId) return;

            if (this.isResizing && this.initialSize && this.initialPos) {
                e.preventDefault();
                const el = this.element.querySelector(`[data-id="${this.dragObjId}"]`) as HTMLElement;
                if (el) {
                    const dx = e.clientX - this.dragStart.x;
                    const dy = e.clientY - this.dragStart.y;
                    const dir = this.resizeDirection;
                    const minSize = this.gridConfig.cellSize;

                    let newW = this.initialSize.w;
                    let newH = this.initialSize.h;
                    let newLeft = this.initialPos.left;
                    let newTop = this.initialPos.top;

                    // Handle horizontal resizing
                    if (dir.includes('e')) {
                        newW = Math.max(minSize, this.initialSize.w + dx);
                    }
                    if (dir.includes('w')) {
                        newW = Math.max(minSize, this.initialSize.w - dx);
                        newLeft = this.initialPos.left + dx;
                        if (newW === minSize) {
                            newLeft = this.initialPos.left + this.initialSize.w - minSize;
                        }
                    }

                    // Handle vertical resizing
                    if (dir.includes('s')) {
                        newH = Math.max(minSize, this.initialSize.h + dy);
                    }
                    if (dir.includes('n')) {
                        newH = Math.max(minSize, this.initialSize.h - dy);
                        newTop = this.initialPos.top + dy;
                        if (newH === minSize) {
                            newTop = this.initialPos.top + this.initialSize.h - minSize;
                        }
                    }

                    // Handle proportional resizing for circles
                    const obj = this.selectedObject;
                    const isTShape = obj && (obj.className === 'TShape' || (obj.constructor && obj.constructor.name === 'TShape'));
                    if (isTShape && obj.shapeType === 'circle') {
                        // Force square aspect ratio
                        const size = Math.max(newW, newH);
                        newW = size;
                        newH = size;

                        // Recalculate top/left if dragging from north/west handles to keep it centered or anchored correctly
                        if (dir.includes('w')) {
                            newLeft = this.initialPos.left + (this.initialSize.w - size);
                        }
                        if (dir.includes('n')) {
                            newTop = this.initialPos.top + (this.initialSize.h - size);
                        }
                    }

                    el.style.width = `${newW}px`;
                    el.style.height = `${newH}px`;
                    el.style.left = `${newLeft}px`;
                    el.style.top = `${newTop}px`;
                }
            } else if (this.isDragging) {
                e.preventDefault();
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;

                // Move ALL selected objects (group drag)
                this.selectedIds.forEach(id => {
                    const el = this.element.querySelector(`[data-id="${id}"]`) as HTMLElement;
                    if (el) {
                        el.style.transform = `translate(${dx}px, ${dy}px)`;
                    }
                });

                // Record path point
                if (this.dragStartTime > 0) {
                    this.currentDragPath.push({
                        x: e.clientX,
                        y: e.clientY,
                        t: Date.now() - this.dragStartTime
                    });
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            // Handle Runtime Drop
            if (this.runMode) {
                if (this.isDragging && this.dragObjId && this.dragStart) {
                    const dx = e.clientX - this.dragStart.x;
                    const dy = e.clientY - this.dragStart.y;

                    // Only process significant moves
                    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                        const el = this.element.querySelector(`[data-id="${this.dragObjId}"]`) as HTMLElement;
                        if (el) {
                            // Reset transform
                            el.style.transform = '';

                            // Calculate new position
                            const currentLeft = parseFloat(el.style.left || '0');
                            const currentTop = parseFloat(el.style.top || '0');
                            const newX = currentLeft + dx;
                            const newY = currentTop + dy;

                            // Snap to grid if needed (runtime typically uses pixels, but we map to internal grid)
                            const gridX = Math.round(newX / this.gridConfig.cellSize);
                            const gridY = Math.round(newY / this.gridConfig.cellSize);

                            if (this.isCopyDrag && this.onObjectCopy) {
                                // GCS-Style: Just request the drop at (newX, newY).
                                // The Controller (Editor.ts) handles collision checks, cloning/snapping, and events.
                                // Note: We pass raw coordinates (or grid?) - Controller can handle pixels better for AABB.
                                // Let's pass pixel coordinates for precise checking, or grid coords.
                                // onObjectCopy expects Grid Coordinates currently.
                                // Let's pass Grid Coordinates as before, but Editor translates to pixels if needed or checks logic.
                                this.onObjectCopy(this.dragObjId, Math.max(0, gridX), Math.max(0, gridY));
                            } else if (!this.isCopyDrag && this.onObjectMove) {
                                this.onObjectMove(this.dragObjId, Math.max(0, gridX), Math.max(0, gridY));
                            }
                        }
                    }

                    // Cleanup Ghost
                    if (this.dragGhost) {
                        this.dragGhost.remove();
                        this.dragGhost = null;
                    }
                    this.isCopyDrag = false;

                    this.isDragging = false;
                    this.dragObjId = null;
                    this.dragStart = null;
                }
                return;
            }

            // Editor Mode Logic
            // Handle rectangle selection finish
            if (this.isRectSelecting && this.rectStart) {
                // Only process selection if a rectangle was actually drawn
                if (this.selectionRectEl) {
                    const stageRect = this.element.getBoundingClientRect();
                    const currentX = e.clientX - stageRect.left;
                    const currentY = e.clientY - stageRect.top;

                    const selLeft = Math.min(this.rectStart.x, currentX);
                    const selTop = Math.min(this.rectStart.y, currentY);
                    const selRight = Math.max(this.rectStart.x, currentX);
                    const selBottom = Math.max(this.rectStart.y, currentY);

                    // Find all objects inside the selection rectangle
                    const gameObjects = this.element.querySelectorAll('.game-object');
                    gameObjects.forEach(objEl => {
                        const htmlEl = objEl as HTMLElement;

                        // Skip CLIENT-aligned panels from selection
                        if (htmlEl.getAttribute('data-align') === 'CLIENT') return;

                        const objLeft = parseFloat(htmlEl.style.left || '0');
                        const objTop = parseFloat(htmlEl.style.top || '0');
                        const objRight = objLeft + parseFloat(htmlEl.style.width || '0');
                        const objBottom = objTop + parseFloat(htmlEl.style.height || '0');

                        // Check if object intersects with selection rectangle
                        if (objLeft < selRight && objRight > selLeft &&
                            objTop < selBottom && objBottom > selTop) {
                            const id = htmlEl.getAttribute('data-id');
                            if (id) {
                                this.selectedIds.add(id);
                            }
                        }
                    });

                    // Remove selection rectangle
                    this.selectionRectEl.remove();
                    this.selectionRectEl = null;

                    if (this.onSelectCallback) {
                        this.onSelectCallback(Array.from(this.selectedIds));
                    }
                } else {
                    // No rectangle was drawn - check if it was a simple click on CLIENT panel
                    const pendingId = (this as any).pendingClientPanelId;
                    if (pendingId) {
                        // Simple click on CLIENT panel - select it
                        this.selectedIds.clear();
                        this.selectedIds.add(pendingId);
                        if (this.onSelectCallback) {
                            this.onSelectCallback(Array.from(this.selectedIds));
                        }
                    }
                }

                // Always reset rectangle selection state
                (this as any).pendingClientPanelId = null;
                this.isRectSelecting = false;
                this.rectStart = null;
                return;
            }

            if (this.dragObjId && this.dragStart) {
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;

                if (this.isResizing && this.initialSize && this.initialPos) {
                    const el = this.element.querySelector(`[data-id="${this.dragObjId}"]`) as HTMLElement;
                    if (el) {
                        const currentW = parseFloat(el.style.width);
                        const currentH = parseFloat(el.style.height);
                        const currentLeft = parseFloat(el.style.left || '0');
                        const currentTop = parseFloat(el.style.top || '0');

                        const gridW = Math.round(currentW / this.gridConfig.cellSize);
                        const gridH = Math.round(currentH / this.gridConfig.cellSize);
                        const gridX = Math.round(currentLeft / this.gridConfig.cellSize);
                        const gridY = Math.round(currentTop / this.gridConfig.cellSize);

                        // If position changed, call onObjectMove
                        const dir = this.resizeDirection;
                        if (dir.includes('w') || dir.includes('n')) {
                            if (this.onObjectMove) {
                                this.onObjectMove(this.dragObjId, Math.max(0, gridX), Math.max(0, gridY));
                            }
                        }

                        if (this.onObjectResize) {
                            this.onObjectResize(this.dragObjId, Math.max(1, gridW), Math.max(1, gridH));
                        }
                    }
                } else if (this.isDragging) {
                    // Move ALL selected objects
                    this.selectedIds.forEach(id => {
                        const el = this.element.querySelector(`[data-id="${id}"]`) as HTMLElement;
                        if (el) {
                            el.style.transform = 'none';

                            const initPos = this.initialPositions.get(id);
                            const initGridPos = this.initialDragPositions.get(id);

                            if (initPos && initGridPos) {
                                const newPixelX = initPos.left + dx;
                                const newPixelY = initPos.top + dy;
                                const gridX = Math.round(newPixelX / this.gridConfig.cellSize);
                                const gridY = Math.round(newPixelY / this.gridConfig.cellSize);

                                // If moved, record and apply
                                if (gridX !== initGridPos.x || gridY !== initGridPos.y) {
                                    const obj = this.lastRenderedObjects.find(o => o.id === id);
                                    if (obj) {
                                        changeRecorder.record({
                                            type: 'drag',
                                            description: `${obj.name} verschoben nach (${gridX}, ${gridY})`,
                                            objectId: id,
                                            objectType: 'object',
                                            startPosition: { x: initGridPos.x, y: initGridPos.y },
                                            endPosition: { x: gridX, y: gridY },
                                            dragPath: [...this.currentDragPath] // Copy path
                                        });

                                        if (this.onObjectMove) {
                                            this.onObjectMove(id, Math.max(0, gridX), Math.max(0, gridY));
                                        }
                                    }
                                }
                            }
                        }
                    });

                    changeRecorder.endBatch();
                }
            }

            this.isDragging = false;
            this.isResizing = false;
            this.resizeDirection = '';
            this.dragObjId = null;
            this.dragStart = null;
            this.initialSize = null;
            this.initialPos = null;
            this.initialPositions.clear();
            this.initialDragPositions.clear();
            this.currentDragPath = [];
            this.dragStartTime = 0;
        });

        // Ctrl+A: Select all objects
        window.addEventListener('keydown', (e) => {
            if (this.runMode) return;

            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();

                // Select all objects on stage
                const gameObjects = this.element.querySelectorAll('.game-object');
                this.selectedIds.clear();
                gameObjects.forEach(objEl => {
                    const id = objEl.getAttribute('data-id');
                    if (id) {
                        this.selectedIds.add(id);
                    }
                });

                if (this.onSelectCallback) {
                    this.onSelectCallback(Array.from(this.selectedIds));
                }
            }

            // Ctrl+C: Copy all selected objects
            if (e.ctrlKey && e.key === 'c' && this.selectedIds.size > 0) {
                e.preventDefault();
                this.copySelection();
            }

            // Escape: Cancel placing mode
            if (e.key === 'Escape' && this.isPlacing) {
                this.cancelPlacing();
            }

            // Delete: Remove all selected objects
            if (e.key === 'Delete' && this.selectedIds.size > 0) {
                e.preventDefault();
                // Collect all IDs first (since deletion modifies selection)
                const idsToDelete = Array.from(this.selectedIds);
                if (this.onEvent) {
                    this.onEvent('', 'deleteMultiple', idsToDelete);
                }
                // Clear selection after deletion
                this.selectedIds.clear();
                if (this.onSelectCallback) {
                    this.onSelectCallback([]);
                }
            }
        });

        // Context menu (right-click)
        this.element.addEventListener('contextmenu', (e) => {
            if (this.runMode) return;
            e.preventDefault();

            const target = e.target as HTMLElement;
            const objEl = target.closest('.game-object') as HTMLElement;

            if (objEl) {
                const id = objEl.getAttribute('data-id');
                if (id) {
                    this.showContextMenu(e.clientX, e.clientY, id);
                }
            } else {
                this.hideContextMenu();
            }
        });

        // Click anywhere to hide context menu
        window.addEventListener('click', () => {
            this.hideContextMenu();
        });
    }

    public updategrid() {
        const { cols, rows, cellSize, visible, backgroundColor } = this.gridConfig;
        const width = cols * cellSize;
        const height = rows * cellSize;

        this.element.style.width = `${width}px`;
        this.element.style.height = `${height}px`;
        this.element.style.backgroundColor = backgroundColor || '#ffffff';

        if (this.runMode) {
            console.log(`[Stage] Game Stage Size updated: ${width}x${height}px. Visible: ${visible}. Host: ${this.container.id}`);
            // Force container to be at least as big as the stage if not in flex layout
            this.container.style.minHeight = `${height}px`;
            this.container.style.minWidth = `${width}px`;
        }

        if (visible) {
            this.element.style.backgroundImage = `
                linear-gradient(to right, #ddd 1px, transparent 1px),
                linear-gradient(to bottom, #ddd 1px, transparent 1px)
            `;
            this.element.style.backgroundSize = `${cellSize}px ${cellSize}px`;
        } else {
            this.element.style.backgroundImage = 'none';
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
        // Update object hash for internal bookkeeping
        const objectHash = objects.map(o => `${o.id}@${o.x?.toFixed(1)},${o.y?.toFixed(1)}`).join('|');

        if (this.runMode) {
            (this as any).lastObjectHash = objectHash;

            // RADICAL PERFORMANCE/DEBUG LOG: Only once per run-session
            if (!(this as any).runModeLogDone) {
                console.log(`[Stage] RunMode Render Start. Rendering ${objects.length} objects.`);
                if (objects.length > 0) {
                    console.table(objects.slice(0, 10).map(o => ({
                        name: o.name,
                        class: o.className || o.constructor?.name,
                        visible: o.visible,
                        z: o.zIndex,
                        w: (o.width || 0).toFixed(1),
                        h: (o.height || 0).toFixed(1),
                        bgImg: o.backgroundImage,
                        src: o.src
                    })));
                } else {
                    console.warn("[Stage] Rendering an EMPTY stage in RunMode!");
                }
            }
        }
        this.lastRenderedObjects = objects;
        const stageWidth = this.gridConfig.cols * this.gridConfig.cellSize;
        const stageHeight = this.gridConfig.rows * this.gridConfig.cellSize;

        // 1. Calculate dock positions
        const dockArea = { left: 0, top: 0, right: stageWidth, bottom: stageHeight };
        const dockPositions = new Map<string, { left: number, top: number, width: number, height: number }>();

        objects.forEach(obj => {
            const align = obj.align || 'NONE';
            if (align === 'NONE' || align === 'CLIENT') return; // Skip CLIENT in first pass

            const objId = obj.id || obj.name; // Fallback to name
            if (!objId) return;

            const objHeight = (obj.height || 0) * this.gridConfig.cellSize;
            const objWidth = (obj.width || 0) * this.gridConfig.cellSize;

            // SPECIAL CASE: TStatusBar defines height in pixels (e.g. 28), not grid units
            // If we multiply by cellSize, it becomes huge (e.g. 28 * 50 = 1400px)
            let actualHeight = objHeight;
            let actualWidth = objWidth;

            if (obj.className === 'TStatusBar' || obj.name?.startsWith('Status')) {
                actualHeight = (obj.height || 0); // Use pixels directly
                actualWidth = (obj.width || 0);
            }

            const availableWidth = dockArea.right - dockArea.left;
            const availableHeight = dockArea.bottom - dockArea.top;

            if (align === 'TOP') {
                dockPositions.set(objId, { left: dockArea.left, top: dockArea.top, width: availableWidth, height: actualHeight });
                dockArea.top += actualHeight;
            } else if (align === 'BOTTOM') {
                dockPositions.set(objId, { left: dockArea.left, top: dockArea.bottom - actualHeight, width: availableWidth, height: actualHeight });
                dockArea.bottom -= actualHeight;
            } else if (align === 'LEFT') {
                dockPositions.set(objId, { left: dockArea.left, top: dockArea.top, width: actualWidth, height: availableHeight });
                dockArea.left += actualWidth;
            } else if (align === 'RIGHT') {
                dockPositions.set(objId, { left: dockArea.right - actualWidth, top: dockArea.top, width: actualWidth, height: availableHeight });
                dockArea.right -= actualWidth;
            }
        });

        // 1b. Handle CLIENT alignment - fills remaining dock area
        objects.forEach(obj => {
            const align = obj.align || 'NONE';
            if (align !== 'CLIENT') return;

            const objId = obj.id || obj.name;
            if (!objId) return;

            // CLIENT fills entire remaining dock area
            const clientWidth = dockArea.right - dockArea.left;
            const clientHeight = dockArea.bottom - dockArea.top;
            dockPositions.set(objId, {
                left: dockArea.left,
                top: dockArea.top,
                width: clientWidth,
                height: clientHeight
            });
        });

        // 2. Collect all object IDs including children of containers
        const collectAllIds = (objs: any[]): Set<string> => {
            const ids = new Set<string>();
            objs.forEach(o => {
                const objId = o.id || o.name; // Fallback to name if id is missing
                if (objId) ids.add(objId);
                if (o.children && Array.isArray(o.children)) {
                    o.children.forEach((c: any) => {
                        const childId = c.id || c.name;
                        if (childId) ids.add(childId);
                    });
                }
            });
            return ids;
        };

        const currentIds = collectAllIds(objects);
        const renderedElements = Array.from(this.element.querySelectorAll('.game-object')) as HTMLElement[];

        // Remove elements that are no longer in the objects list
        renderedElements.forEach(el => {
            const id = el.getAttribute('data-id');
            if (id && !currentIds.has(id)) {
                el.remove();
            }
        });

        // Sort objects by zIndex for proper layer ordering (lower first, higher on top)
        const sortedObjects = [...objects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        // Update or Create elements
        sortedObjects.forEach((obj) => {
            const objId = obj.id || obj.name;
            if (!objId) return;

            let el = this.element.querySelector(`[data-id="${objId}"]`) as HTMLElement;
            let isNew = false;

            if (!el) {
                el = document.createElement('div');
                el.className = 'game-object';
                el.setAttribute('data-id', objId);
                el.style.position = 'absolute';
                el.style.boxSizing = 'border-box';
                el.style.overflow = 'hidden';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                el.style.userSelect = 'none';
                this.element.appendChild(el);
                isNew = true;
            }

            // Type-specific content class name
            const className = obj.className || obj.constructor?.name;

            // Store align attribute for mouse event handling
            el.setAttribute('data-align', obj.align || 'NONE');

            // Apply positioning
            const dockPos = dockPositions.get(objId);

            if (dockPos) {
                // For docked objects, x and y serve as relative grid-offsets to their dock position
                // This allows animating docked objects!
                const offsetX = (obj.x || 0) * this.gridConfig.cellSize;
                const offsetY = (obj.y || 0) * this.gridConfig.cellSize;
                el.style.left = `${dockPos.left + offsetX}px`;
                el.style.top = `${dockPos.top + offsetY}px`;
                el.style.width = `${dockPos.width}px`;
                el.style.height = `${dockPos.height}px`;
            } else {
                el.style.left = `${(obj.x || 0) * this.gridConfig.cellSize}px`;
                el.style.top = `${(obj.y || 0) * this.gridConfig.cellSize}px`;
                el.style.width = `${(obj.width || 0) * this.gridConfig.cellSize}px`;
                el.style.height = `${(obj.height || 0) * this.gridConfig.cellSize}px`;
            }

            // Visibility - Robust check for booleans and strings
            const checkVisible = (val: any): boolean => {
                if (val === undefined || val === null) return true;
                if (typeof val === 'boolean') return val;
                if (typeof val === 'string') {
                    const clean = val.trim().toLowerCase();
                    if (clean === 'false') return false;
                    if (clean === 'true') return true;
                }
                return !!val;
            };

            let isVisible = checkVisible(obj.visible) && checkVisible(obj.style?.visible);

            // SPECIAL FIX: Hide blueprint-only services on regular stages
            // (e.g. Toaster, DataStore from blueprint or as local duplicates should not be visible in Editor)
            const isInherited = !!obj.isInherited;
            const isFromBlueprint = !!obj.isFromBlueprint;
            const isBlueprintOnly = !!obj.isBlueprintOnly;
            const isService = !!obj.isService;

            if (!this._isBlueprint) {
                if (isInherited && isFromBlueprint) {
                    isVisible = false;
                } else if (isBlueprintOnly && isService) {
                    isVisible = false;
                }
            }

            el.style.display = isVisible ? 'flex' : 'none';

            // Inherited/Ghosted State
            if (isInherited) {
                el.classList.add('inherited-object');
                el.style.pointerEvents = 'none'; // Disable direct interaction in child stage
            } else {
                el.classList.remove('inherited-object');
                el.style.pointerEvents = 'auto';
            }

            // Apply opacity if defined in style (e.g. for animations)
            // Apply opacity if defined in style or component specific property (e.g. imageOpacity for TImage)
            const opacity = (obj.style && obj.style.opacity !== undefined && obj.style.opacity !== null) ? obj.style.opacity : (obj.imageOpacity !== undefined ? obj.imageOpacity : undefined);

            if (opacity !== undefined && opacity !== null) {
                el.style.opacity = String(opacity);
            } else if (isInherited) {
                el.style.opacity = '0.4'; // Ghosting for inherited objects
            } else {
                el.style.opacity = '1';
            }

            // Styles
            if (obj.style) {
                // Background color is set in the grid overlay section below
                // CRITICAL: Suppress CSS border for TShape, as it uses SVG strokes instead
                const isTShape = className === 'TShape';
                if (!isTShape) {
                    el.style.border = `${obj.style.borderWidth || 0}px solid ${obj.style.borderColor || 'transparent'}`;
                } else {
                    el.style.border = 'none';
                }

                if (obj.style.color) el.style.color = obj.style.color;
                if (obj.style.fontSize) el.style.fontSize = typeof obj.style.fontSize === 'number' ? `${obj.style.fontSize}px` : obj.style.fontSize;
                if (obj.style.fontWeight) el.style.fontWeight = obj.style.fontWeight;
                if (obj.style.borderRadius) el.style.borderRadius = typeof obj.style.borderRadius === 'number' ? `${obj.style.borderRadius}px` : obj.style.borderRadius;

                // Apply z-index: user-defined value always wins, overlay defaults only if undefined
                if (obj.zIndex !== undefined) {
                    // User has explicitly set a zIndex (including 0) - use it
                    el.style.zIndex = String(obj.zIndex);
                } else if (obj.name && (obj.name.startsWith('Overlay') || obj.name.startsWith('Btn') || obj.name.startsWith('Input') || obj.name.startsWith('Status'))) {
                    // No zIndex defined, but this is an overlay element - use high default
                    el.style.zIndex = '2000';
                }
            }

            // Grid overlay for panels with showGrid=true in edit mode only
            if (obj.showGrid && !this.runMode) {
                const cellSize = this.gridConfig.cellSize;
                const bgColor = obj.style?.backgroundColor || 'transparent';
                // Convert hex color to rgba with opacity
                const gridColor = obj.gridColor || '#000000';
                const gridStyle = obj.gridStyle || 'lines';
                const hexToRgba = (hex: string, alpha: number) => {
                    let r = 0, g = 0, b = 0;
                    if (hex.length === 4) {
                        r = parseInt(hex[1] + hex[1], 16);
                        g = parseInt(hex[2] + hex[2], 16);
                        b = parseInt(hex[3] + hex[3], 16);
                    } else if (hex.length === 7) {
                        r = parseInt(hex.slice(1, 3), 16);
                        g = parseInt(hex.slice(3, 5), 16);
                        b = parseInt(hex.slice(5, 7), 16);
                    }
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };
                const gridRgba = hexToRgba(gridColor, 0.4);
                const dotRgba = hexToRgba(gridColor, 0.25);

                if (gridStyle === 'dots') {
                    // Dots at grid intersections - offset by half cell to align with grid lines
                    const halfCell = cellSize / 2;
                    el.style.background = `radial-gradient(circle, ${dotRgba} 1px, transparent 1px), ${bgColor}`;
                    el.style.backgroundSize = `${cellSize}px ${cellSize}px, 100% 100%`;
                    el.style.backgroundPosition = `${halfCell}px ${halfCell}px, 0 0`;
                } else {
                    // Lines grid
                    el.style.background = `linear-gradient(to right, ${gridRgba} 1px, transparent 1px), linear-gradient(to bottom, ${gridRgba} 1px, transparent 1px), ${bgColor}`;
                    el.style.backgroundSize = `${cellSize}px ${cellSize}px, ${cellSize}px ${cellSize}px, 100% 100%`;
                }
            } else {
                // No grid - just use background color or image
                const bgColor = obj.style?.backgroundColor || 'transparent';
                let bgImg = obj.backgroundImage || obj.src || obj.style?.backgroundImage;

                // If it's already a CSS url() string, extract the URL
                if (bgImg && bgImg.startsWith('url(')) {
                    const match = bgImg.match(/url\(['"]?([^'"]+)['"]?\)/);
                    if (match) bgImg = match[1];
                }

                // RESET TRACING ON RUN-MODE START to ensure fresh logs
                if (this.runMode && !(el as any).runModeTraceDone) {
                    (el as any).lastLoggedSrc = null;
                    (el as any).runModeTraceDone = true;
                }

                if (bgImg) {
                    // Robust path handling for images:
                    let src = (bgImg.startsWith('http') || bgImg.startsWith('/') || bgImg.startsWith('data:'))
                        ? bgImg
                        : `/images/${bgImg}`;

                    // URL-Encoding for filenames with spaces/special chars
                    if (!src.startsWith('data:')) {
                        const parts = src.split('/');
                        const lastPart = parts.pop() || '';
                        src = [...parts, encodeURIComponent(lastPart)].join('/');
                    }

                    // ONE-TIME LOG PER SOURCE to prove where it's fetched from
                    if ((el as any).lastLoggedSrc !== src) {
                        console.log(`[Stage] Component "${objId}" (${className}) setting image: "${src}" (from prop: ${obj.src ? 'src' : 'backgroundImage'})`);
                        (el as any).lastLoggedSrc = src;

                        // Diagnostic: Check if image really exists by creating an off-screen image
                        if (!src.startsWith('data:')) {
                            console.log(`[Stage] Testing image reachability for "${objId}": ${src}`);
                            const testImg = new Image();
                            const timeout = setTimeout(() => {
                                console.warn(`[Stage] TIMEOUT: Image test for "${objId}" is still pending after 3s: ${src}`);
                            }, 3000);

                            testImg.onload = () => {
                                clearTimeout(timeout);
                                console.log(`[Stage] SUCCESS: Image loaded successfully: ${src} (${testImg.width}x${testImg.height})`);
                            };
                            testImg.onerror = () => {
                                clearTimeout(timeout);
                                console.error(`[Stage] ERROR: Failed to load image: ${src}. Check path or server.`);
                            };
                            testImg.src = src;
                        }
                    }

                    const fit = obj.objectFit || 'contain';
                    el.style.backgroundImage = `url("${src}")`;
                    el.style.backgroundPosition = 'center';
                    el.style.backgroundSize = fit;
                    el.style.backgroundRepeat = 'no-repeat';
                    el.style.backgroundColor = bgColor;
                } else {
                    el.style.background = bgColor;
                }
            }

            // Content based on type
            // (className already defined above)

            // Interaction hints & Click handlers
            // Include TButtons with service binding as clickable
            const hasTaskClick = obj.Tasks && (obj.Tasks.onClick || obj.Tasks.onSingleClick || obj.Tasks.onMultiClick);
            const isClickable = hasTaskClick || (this.runMode && className === 'TButton');

            if (this.runMode && isClickable) {
                el.style.cursor = 'pointer';
                // ALWAYS attach click handler, not just on new
                el.onclick = (e) => {
                    e.stopPropagation();
                    console.log(`[Stage] Click on ${obj.name} (${obj.id}). Task: ${obj.Tasks?.onClick || 'none'}`);
                    if (this.onEvent) {
                        this.onEvent(obj.id, 'onClick');
                    } else {
                        console.error('[Stage] onEvent handler is missing!');
                    }
                };
            } else if (this.runMode) {
                el.style.cursor = 'default';
                if (isNew) el.onclick = null;
            }

            if (className === 'TCheckbox') {
                if (isNew) {
                    el.innerHTML = '';
                    const label = document.createElement('label');
                    label.style.display = 'flex';
                    label.style.alignItems = 'center';
                    label.style.gap = '8px';
                    label.style.width = '100%';
                    label.style.height = '100%';
                    label.style.cursor = 'inherit';

                    const input = document.createElement('input');
                    input.type = 'checkbox';
                    input.style.cursor = 'pointer';
                    input.onchange = () => {
                        obj.checked = input.checked;
                    };

                    const textSpan = document.createElement('span');
                    textSpan.className = 'checkbox-label';

                    label.appendChild(input);
                    label.appendChild(textSpan);
                    el.appendChild(label);
                }

                const input = el.querySelector('input') as HTMLInputElement;
                const textSpan = el.querySelector('.checkbox-label') as HTMLElement;

                if (input) {
                    input.checked = !!obj.checked;
                    // Checkbox size scaling? For now default
                }
                if (textSpan) {
                    textSpan.innerText = obj.label || obj.name;

                    // Apply Font Styles to the label text
                    textSpan.style.color = obj.style?.color || '#000000';
                    textSpan.style.fontSize = obj.style?.fontSize ? (typeof obj.style.fontSize === 'number' ? `${obj.style.fontSize}px` : obj.style.fontSize) : '14px';

                    const fw = obj.style?.fontWeight;
                    textSpan.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';

                    const fs = obj.style?.fontStyle;
                    textSpan.style.fontStyle = (fs === true || fs === 'italic') ? 'italic' : 'normal';

                    if (obj.style?.fontFamily) textSpan.style.fontFamily = obj.style.fontFamily;
                }

            } else if (className === 'TNumberInput') {
                if (isNew) {
                    el.innerHTML = '';
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.style.width = '100%';
                    input.style.height = '100%';
                    input.style.border = 'none';
                    input.style.background = 'transparent';
                    input.style.padding = '0 8px';
                    input.style.fontSize = 'inherit';
                    input.style.outline = 'none';
                    input.style.boxSizing = 'border-box';
                    input.oninput = () => {
                        obj.value = parseFloat(input.value);
                    };
                    el.appendChild(input);
                }
                const input = el.querySelector('input') as HTMLInputElement;
                if (input) {
                    if (parseFloat(input.value) !== obj.value) input.value = String(obj.value || 0);
                    if (obj.min !== undefined && obj.min !== -Infinity) input.min = String(obj.min);
                    if (obj.max !== undefined && obj.max !== Infinity) input.max = String(obj.max);
                    if (obj.step !== undefined) input.step = String(obj.step);

                    // Styles
                    input.style.color = obj.style?.color || '#000000';
                    input.style.backgroundColor = obj.style?.backgroundColor || 'transparent';
                    input.style.fontSize = obj.style?.fontSize ? (typeof obj.style.fontSize === 'number' ? `${obj.style.fontSize}px` : obj.style.fontSize) : 'inherit';
                    input.style.textAlign = obj.style?.textAlign || 'left';

                    const fw = obj.style?.fontWeight;
                    input.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';

                    const fs = obj.style?.fontStyle;
                    input.style.fontStyle = (fs === true || fs === 'italic') ? 'italic' : 'normal';

                    if (obj.style?.fontFamily) input.style.fontFamily = obj.style.fontFamily;
                }

            } else if (className === 'TEdit' || className === 'TTextInput') {
                const isInput = !this.runMode || className === 'TTextInput' || className === 'TEdit';

                if (isInput) {
                    if (isNew) {
                        el.innerHTML = '';
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.style.width = '100%';
                        input.style.height = '100%';
                        input.style.border = 'none';
                        input.style.background = 'transparent';
                        input.style.padding = '0 8px';
                        input.style.fontSize = 'inherit';
                        input.style.outline = 'none';
                        input.style.boxSizing = 'border-box';
                        input.oninput = () => {
                            let val = input.value;
                            if (obj.uppercase) val = val.toUpperCase();
                            obj.text = val;
                            input.value = val;
                        };
                        el.appendChild(input);
                    }
                    const input = el.querySelector('input') as HTMLInputElement;
                    if (input) {
                        if (input.value !== (obj.text || '')) input.value = obj.text || '';
                        input.placeholder = obj.placeholder || '';
                        // Explicitly set styles to ensure updates are applied
                        input.style.color = obj.style?.color || '#000000';
                        input.style.backgroundColor = obj.style?.backgroundColor || 'transparent'; // Ensure bg is transparent if not set, or matches
                        input.style.textAlign = obj.style?.textAlign || 'left';
                        input.style.fontSize = obj.style?.fontSize ? (typeof obj.style.fontSize === 'number' ? `${obj.style.fontSize}px` : obj.style.fontSize) : 'inherit';
                        // Handle boolean or string values for weight/style
                        const fw = obj.style?.fontWeight;
                        input.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';
                        const fs = obj.style?.fontStyle;
                        input.style.fontStyle = (fs === true || fs === 'italic') ? 'italic' : 'normal';
                        // Font Family
                        if (obj.style?.fontFamily) input.style.fontFamily = obj.style.fontFamily;
                    }
                } else {
                    el.innerText = obj.text || obj.placeholder || 'Enter text...';
                }
            } else if (className === 'TGameCard') {
                if (isNew) {
                    el.innerHTML = `
                        <div class="card-title" style="font-weight:bold;margin-bottom:10px"></div>
                        <div class="card-btns" style="display:flex;gap:5px">
                            <button class="btn-single" style="padding:6px;border:none;border-radius:4px;background:#4caf50;color:#fff;cursor:pointer">▶ Single</button>
                            <button class="btn-multi" style="padding:6px;border:none;border-radius:4px;background:#2196f3;color:#fff;cursor:pointer">👥 Multi</button>
                        </div>
                    `;
                    el.style.flexDirection = 'column';
                    el.querySelector('.btn-single')?.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (this.onEvent) this.onEvent(obj.id, 'onSingleClick');
                    });
                    el.querySelector('.btn-multi')?.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (this.onEvent) this.onEvent(obj.id, 'onMultiClick');
                    });
                }
                const titleEl = el.querySelector('.card-title') as HTMLElement;
                if (titleEl && titleEl.innerText !== obj.gameName) titleEl.innerText = obj.gameName;
            } else if (className === 'TButton') {
                // BUGFIX: Clear any existing table structures if element is reused from a previous buggy render
                if (el.querySelector('.table-title-bar')) el.innerHTML = '';

                if (el.innerText !== (obj.caption || obj.name)) el.innerText = obj.caption || obj.name;

                // Button Font Styles
                const fw = obj.style?.fontWeight;
                el.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';
                const fstyle = obj.style?.fontStyle;
                el.style.fontStyle = (fstyle === true || fstyle === 'italic') ? 'italic' : 'normal';

                if (obj.style?.fontSize) el.style.fontSize = typeof obj.style.fontSize === 'number' ? `${obj.style.fontSize}px` : obj.style.fontSize;
                if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;

                // Button Text Align (justify-content)
                const align = obj.style?.textAlign;
                el.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center'); // Default center for buttons
                if (this.runMode && isNew) {
                    el.onmouseenter = () => el.style.filter = 'brightness(1.1)';
                    el.onmouseleave = () => el.style.filter = 'none';
                    el.onmousedown = () => el.style.transform = 'scale(0.98)';
                    el.onmouseup = () => el.style.transform = 'none';
                }
            } else if (className === 'TEmojiPicker') {
                // Clear content
                el.innerHTML = '';

                // Grid Layout
                el.style.display = 'grid';
                const cols = obj.columns || 5;
                el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
                el.style.gap = '4px';
                el.style.padding = '8px';
                el.style.alignItems = 'center';
                el.style.justifyItems = 'center';
                el.style.overflowY = 'auto'; // Allow scrolling if too many emojis

                // Render Emojis
                const emojis = obj.emojis || ['😀', '😎', '🚀', '⭐', '🌈', '🍕', '🎮', '🦄', '🎈', '🎨'];
                emojis.forEach((emoji: string) => {
                    const btn = document.createElement('div');
                    btn.innerText = emoji;
                    btn.style.fontSize = '24px'; // Base size
                    btn.style.cursor = this.runMode ? 'pointer' : 'default';
                    btn.style.width = '100%';
                    btn.style.height = '100%';
                    btn.style.display = 'flex';
                    btn.style.alignItems = 'center';
                    btn.style.justifyContent = 'center';
                    btn.style.borderRadius = '8px';
                    btn.style.transition = 'background 0.2s, transform 0.1s';
                    btn.style.userSelect = 'none';

                    // Selection State
                    if (obj.selectedEmoji === emoji) {
                        btn.style.background = 'rgba(255, 255, 255, 0.3)';
                        btn.style.border = '1px solid rgba(255, 255, 255, 0.5)';
                    } else {
                        btn.style.border = '1px solid transparent';
                    }

                    if (this.runMode) {
                        btn.onmouseenter = () => {
                            if (obj.selectedEmoji !== emoji) btn.style.background = 'rgba(255, 255, 255, 0.1)';
                            btn.style.transform = 'scale(1.1)';
                        };
                        btn.onmouseleave = () => {
                            if (obj.selectedEmoji !== emoji) btn.style.background = 'transparent';
                            btn.style.transform = 'scale(1)';
                        };
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            obj.selectedEmoji = emoji;
                            console.log(`[Stage] TEmojiPicker selected: ${emoji}`);

                            // Trigger Event
                            if (this.onEvent) {
                                this.onEvent(obj.id, 'onSelect', emoji);
                            }

                            // Trigger property change for Editor
                            if (this.onEvent) {
                                this.onEvent(obj.id, 'propertyChange', { property: 'selectedEmoji', value: emoji });
                            }

                            // Re-render to showing selection state
                            this.renderObjects(this.lastRenderedObjects);
                        };
                    }

                    el.appendChild(btn);
                });

            } else if (className === 'TTable' || className === 'TObjectList') {
                Stage.renderTable(el, obj);
            } else if (className === 'TStringVariable' || className === 'TObjectVariable' || className === 'TIntegerVariable' || className === 'TBooleanVariable' || className === 'TListVariable') {
                // Force render for Variables
                el.style.display = 'flex';
                if (!this.runMode) {
                    el.style.backgroundColor = obj.style?.backgroundColor || '#673ab7';
                    el.style.border = '1px solid #ffffff';
                    el.style.color = '#ffffff';
                    el.style.fontSize = '12px';
                    el.innerText = obj.name || 'Variable';
                    el.setAttribute('title', `${className}: ${obj.name}`);
                } else {
                    el.style.display = 'none'; // Variables are hidden in run mode usually
                }
            } else if (obj.isVariable || obj.isService) {
                // Determine visibility based on flags
                let effectivelyVisible = true;

                if (this.runMode) {
                    if (obj.isHiddenInRun || obj.isVariable) effectivelyVisible = false;
                } else {
                    // Editor Mode: Hide if it's blueprint-only and we are NOT on a blueprint stage
                    // BUT: Only hide if inherited (to hide blueprint-globals on normal stages), 
                    // allow direct placements to be visible.
                    if (obj.isBlueprintOnly && !this.isBlueprint && obj.isInherited) effectivelyVisible = false;
                }

                if (!effectivelyVisible) {
                    el.style.display = 'none';
                } else {
                    el.style.display = 'flex'; // Ensure visible
                    if (!this.runMode) {
                        // System Component / Variable Editor Styling
                        el.style.backgroundColor =
                            className === 'TGameLoop' ? '#2196f3' :
                                (className === 'TInputController' ? '#9c27b0' :
                                    (className === 'TRepeater' ? '#ff9800' :
                                        (className === 'TGameState' ? '#607d8b' :
                                            (className === 'TGameServer' ? '#4caf50' :
                                                (className === 'THandshake' ? '#5c6bc0' :
                                                    (className === 'THeartbeat' ? '#e91e63' :
                                                        (className === 'TStageController' ? '#9c27b0' :
                                                            (className === 'TAPIServer' ? '#f44336' :
                                                                (className === 'TDataStore' ? '#3f51b5' :
                                                                    (obj.isVariable ? (obj.style?.backgroundColor || '#673ab7') : '#4caf50'))))))))));
                        el.innerText = obj.name;
                        el.style.color = '#ffffff';
                        el.style.fontSize = '12px';
                    } else {
                        el.innerText = ''; // Clear label in run mode
                    }
                }
            } else if (className === 'TLabel' || className === 'TNumberLabel' || (className !== 'TShape' && ('text' in obj || 'value' in obj))) {
                const textValue = (obj.text !== undefined && obj.text !== null) ? String(obj.text) :
                    (obj.value !== undefined && obj.value !== null) ? String(obj.value) : '';
                const text = textValue;
                if (el.innerText !== text) el.innerText = text;

                // Font Size
                const fs = obj.style?.fontSize || obj.fontSize;
                if (fs) el.style.fontSize = typeof fs === 'number' ? `${fs}px` : fs;

                // Color - default to white if not set (legacy behavior for Labels)
                el.style.color = obj.style?.color || '#ffffff';

                // Font Weight & Style
                const fw = obj.style?.fontWeight;
                el.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';

                const fstyle = obj.style?.fontStyle;
                el.style.fontStyle = (fstyle === true || fstyle === 'italic') ? 'italic' : 'normal';

                // Font Family
                if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;

                el.style.userSelect = 'text'; // Allow text selection for copying room codes
                el.style.cursor = 'text';

                // Alignment (justify-content because it's flex)
                const align = obj.style?.textAlign || obj.alignment;
                if (align === 'center') el.style.justifyContent = 'center';
                else if (align === 'right') el.style.justifyContent = 'flex-end';
                else el.style.justifyContent = 'flex-start'; // Default left
            } else if (className === 'TPanel') {
                if (!this.runMode) {
                    el.innerText = obj.name;
                    // Optional: styling for the editor-only label
                    el.style.color = '#777';
                    el.style.fontSize = '12px';
                    el.style.justifyContent = 'center';
                    el.style.alignItems = 'center';
                } else {
                    el.innerText = '';
                }
            } else if (className === 'TGameHeader') {
                if (el.innerText !== (obj.title || obj.caption || obj.name)) el.innerText = obj.title || obj.caption || obj.name;

                // Use standard style properties (inherited or set defaults)
                el.style.fontSize = obj.style?.fontSize ? (typeof obj.style.fontSize === 'number' ? `${obj.style.fontSize}px` : obj.style.fontSize) : '18px';

                const fw = obj.style?.fontWeight;
                el.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : (fw || 'bold');

                // Align
                const align = obj.style?.textAlign;
                el.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');

                if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
            } else if (className === 'TSprite') {
                el.style.backgroundColor = obj.style?.backgroundColor || obj.spriteColor || '#ff6b6b';
                el.style.borderRadius = obj.shape === 'circle' ? '50%' : '0';
                if (!this.runMode) el.innerText = obj.name;
            } else if (className === 'TShape') {
                // Render geometry shapes using SVG
                const shapeType = obj.shapeType || 'circle';
                // Prioritize explicit TShape properties over style 'transparent' defaults
                const fillColor = (obj.style?.backgroundColor && obj.style.backgroundColor !== 'transparent') ? obj.style.backgroundColor : (obj.fillColor || '#4fc3f7');
                const strokeColor = (obj.style?.borderColor && obj.style.borderColor !== 'transparent') ? obj.style.borderColor : (obj.strokeColor || '#29b6f6');
                const strokeWidth = (obj.style?.borderWidth !== undefined && obj.style.borderWidth !== 0) ? obj.style.borderWidth : (obj.strokeWidth || 0);
                const opacity = obj.style?.opacity ?? obj.opacity ?? 1;

                let svgContent = '';
                // We use a fixed viewBox of 100x100 for all shapes.
                // The SVG element itself will scale to the container (width=100%, height=100%).
                // This ensures smooth resizing feedback!
                if (shapeType === 'circle') {
                    svgContent = `<circle cx="50" cy="50" r="48" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
                } else if (shapeType === 'square' || shapeType === 'rectangle' || shapeType === 'rect') {
                    svgContent = `<rect x="1" y="1" width="98" height="98" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
                } else if (shapeType === 'triangle') {
                    svgContent = `<polygon points="50,2 2,98 98,98" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
                } else if (shapeType === 'ellipse') {
                    svgContent = `<ellipse cx="50" cy="50" rx="48" ry="48" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
                }

                // Add contentImage if present (centered)
                if (obj.contentImage) {
                    svgContent += `<image href="${obj.contentImage}" x="15" y="15" width="70" height="70" preserveAspectRatio="xMidYMid meet" />`;
                }

                // Add text if present (centered)
                if (obj.text) {
                    const fontSize = obj.style?.fontSize || 50; // ViewBox units
                    const fontColor = obj.style?.color || '#ffffff';
                    svgContent += `<text x="50" y="52" dominant-baseline="central" text-anchor="middle" font-size="${fontSize}" fill="${fontColor}" font-family="${obj.style?.fontFamily || 'Arial'}">${obj.text}</text>`;
                }

                // Start building the SVG
                // Using 100% for width/height to enable real-time scaling during mousemove
                let svgTag = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute; top:0; left:0; display:block; overflow:visible; pointer-events:all;">`;
                svgTag += svgContent;
                svgTag += `</svg>`;

                el.innerHTML = svgTag;
                if (isNew) {
                    const label = document.createElement('span');
                    label.innerText = obj.name;
                    label.style.cssText = 'position:absolute; font-size:10px; color:rgba(255,255,255,0.5); pointer-events:none;';
                    el.appendChild(label);
                }
            } else if (className === 'TInspectorTemplate') {
                // Render Inspector Designer preview
                if (this.runMode) {
                    el.style.display = 'none';
                } else {
                    el.style.backgroundColor = obj.style?.backgroundColor || '#2a2a2a';
                    el.style.flexDirection = 'column';
                    el.style.alignItems = 'stretch';
                    el.style.justifyContent = 'flex-start';
                    el.style.padding = '8px';
                    el.style.overflow = 'auto';

                    // Always re-render the preview to reflect layoutConfig changes
                    el.innerHTML = '';
                    const header = document.createElement('div');
                    header.className = 'inspector-preview-header';
                    header.style.cssText = 'font-weight:bold;color:#fff;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #444';
                    header.innerText = '📋 Inspector Designer';
                    el.appendChild(header);

                    const preview = document.createElement('div');
                    preview.className = 'inspector-preview';
                    preview.style.cssText = 'display:flex;flex-direction:column;gap:6px;font-size:11px;color:#ccc';

                    // Use layoutConfig for properties (respects visibility, labels, styles)
                    const layoutConfig = obj.layoutConfig;
                    if (layoutConfig && layoutConfig.properties) {
                        // Group properties by groupId
                        const groupedProps = new Map<string, any[]>();
                        const sortedProps = Object.values(layoutConfig.properties as Record<string, any>)
                            .filter((p: any) => p.visible !== false)
                            .sort((a: any, b: any) => a.order - b.order);

                        sortedProps.forEach((prop: any) => {
                            const groupId = prop.groupId || 'default';
                            if (!groupedProps.has(groupId)) {
                                groupedProps.set(groupId, []);
                            }
                            groupedProps.get(groupId)!.push(prop);
                        });

                        // Render by groups
                        (layoutConfig.groups as any[])?.sort((a: any, b: any) => a.order - b.order).forEach((group: any) => {
                            const props = groupedProps.get(group.id);
                            if (props && props.length > 0) {
                                const groupEl = document.createElement('div');
                                groupEl.style.cssText = 'font-weight:bold;color:#888;margin-top:6px;font-size:10px';
                                groupEl.innerText = group.label.toUpperCase();
                                preview.appendChild(groupEl);

                                props.forEach((prop: any) => {
                                    const row = document.createElement('div');
                                    row.style.cssText = 'display:flex;align-items:center;gap:4px';

                                    const label = document.createElement('span');
                                    label.style.cssText = 'flex:1';
                                    // Apply custom styles from layoutConfig
                                    if (prop.style?.color) label.style.color = prop.style.color;
                                    else label.style.color = '#aaa';
                                    if (prop.style?.fontSize) label.style.fontSize = prop.style.fontSize;
                                    if (prop.style?.backgroundColor) label.style.backgroundColor = prop.style.backgroundColor;
                                    label.innerText = prop.label;

                                    const input = document.createElement('span');
                                    input.style.cssText = 'flex:1;background:#333;padding:2px 4px;border-radius:2px;color:#fff';
                                    input.innerText = prop.type === 'boolean' ? '☐' :
                                        prop.type === 'color' ? '🎨' :
                                            prop.type === 'select' ? '▼' : '...';

                                    row.appendChild(label);
                                    row.appendChild(input);
                                    preview.appendChild(row);
                                });
                            }
                        });
                    }

                    el.appendChild(preview);
                }
            } else if (className === 'TEmojiPicker') {
                // Render Emoji Picker
                el.style.display = 'grid';
                el.style.gridTemplateColumns = `repeat(${obj.columns || 5}, 1fr)`;
                el.style.gap = '4px';
                el.style.padding = '8px';
                el.style.justifyItems = 'center';
                el.style.alignItems = 'center';
                el.style.overflow = 'hidden';

                // Check if we need to re-render content
                if (el.childElementCount !== (obj.emojis?.length || 0)) {
                    el.innerHTML = '';
                    const emojis = obj.emojis || [];
                    emojis.forEach((emoji: string) => {
                        const btn = document.createElement('div');
                        btn.style.cssText = 'font-size:20px; cursor:default;';
                        btn.innerText = emoji;
                        el.appendChild(btn);
                    });
                }
            } else if (className === 'TDialogRoot') {
                // Render TDialogRoot as a dialog container
                el.style.borderRadius = '12px';
                el.style.flexDirection = 'column';
                el.style.alignItems = 'stretch';
                el.style.justifyContent = 'flex-start';
                el.style.overflow = 'visible'; // Allow children to be seen

                // Title bar
                if (!el.querySelector('.dialog-title-bar')) {
                    const titleBar = document.createElement('div');
                    titleBar.className = 'dialog-title-bar';
                    titleBar.style.cssText = `
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 8px 12px;
                        border-bottom: 1px solid ${obj.style?.borderColor || '#4fc3f7'};
                        color: #fff;
                        font-weight: bold;
                    `;
                    titleBar.textContent = obj.caption || obj.title || obj.name;
                    el.appendChild(titleBar);
                }

                // Update title if changed
                const titleBar = el.querySelector('.dialog-title-bar');
                if (titleBar && titleBar.textContent !== (obj.caption || obj.title || obj.name)) {
                    titleBar.textContent = obj.caption || obj.title || obj.name;
                }

                // Render children (relative positioning)
                if (obj.children && Array.isArray(obj.children)) {
                    const parentX = obj.x * this.gridConfig.cellSize;
                    const parentY = obj.y * this.gridConfig.cellSize;

                    obj.children.forEach((child: any) => {
                        let childEl = this.element.querySelector(`[data-id="${child.id}"]`) as HTMLElement;

                        if (!childEl) {
                            childEl = document.createElement('div');
                            childEl.className = 'game-object dialog-child';
                            childEl.setAttribute('data-id', child.id);
                            childEl.style.position = 'absolute';
                            childEl.style.boxSizing = 'border-box';
                            childEl.style.display = 'flex';
                            childEl.style.alignItems = 'center';
                            childEl.style.justifyContent = 'center';
                            this.element.appendChild(childEl);
                        }

                        // Position relative to parent dialog (in absolute stage coords)
                        const childX = parentX + (child.x || 0) * this.gridConfig.cellSize;
                        const childY = parentY + (child.y || 0) * this.gridConfig.cellSize + 30; // +30 for title bar
                        childEl.style.left = `${childX}px`;
                        childEl.style.top = `${childY}px`;
                        childEl.style.width = `${(child.width || 4) * this.gridConfig.cellSize}px`;
                        childEl.style.height = `${(child.height || 2) * this.gridConfig.cellSize}px`;
                        childEl.style.zIndex = '10'; // Above parent

                        // Store parent offset for correct drag calculation
                        childEl.setAttribute('data-parent-x', (parentX / this.gridConfig.cellSize).toString());
                        childEl.setAttribute('data-parent-y', ((parentY + 30) / this.gridConfig.cellSize).toString());

                        // Apply child styles
                        if (child.style) {
                            childEl.style.backgroundColor = child.style.backgroundColor || 'transparent';
                            childEl.style.border = `${child.style.borderWidth || 0}px solid ${child.style.borderColor || 'transparent'}`;
                            if (child.style.color) childEl.style.color = child.style.color;
                        }

                        // Content based on type
                        const childClassName = child.className || child.constructor?.name;
                        if (childClassName === 'TButton') {
                            childEl.innerText = child.caption || child.name;
                            childEl.style.fontWeight = 'bold';
                            childEl.style.cursor = 'pointer';
                        } else if (childClassName === 'TLabel' || child.text) {
                            childEl.innerText = child.text || '';
                        } else if (childClassName === 'TEdit') {
                            if (!childEl.querySelector('input')) {
                                const input = document.createElement('input');
                                input.type = 'text';
                                input.style.cssText = 'width:100%;height:100%;border:none;background:transparent;padding:0 8px;font-size:inherit;';
                                childEl.appendChild(input);
                            }
                        } else {
                            childEl.innerText = child.name || '';
                        }

                        // Selection for children - with resize handles
                        if (this.selectedIds.has(child.id)) {
                            childEl.classList.add('selected');
                            childEl.style.outline = '2px solid #4fc3f7';
                            childEl.style.overflow = 'visible';

                            // Add resize handles if not present
                            if (!childEl.querySelector('.resize-handle')) {
                                const handleSize = 6;
                                const handles = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];
                                const handleStyles: Record<string, { top?: string, bottom?: string, left?: string, right?: string, cursor: string, transform?: string }> = {
                                    'nw': { top: '-6px', left: '-6px', cursor: 'nwse-resize' },
                                    'n': { top: '-6px', left: '50%', cursor: 'ns-resize', transform: 'translateX(-50%)' },
                                    'ne': { top: '-6px', right: '-6px', cursor: 'nesw-resize' },
                                    'w': { top: '50%', left: '-6px', cursor: 'ew-resize', transform: 'translateY(-50%)' },
                                    'e': { top: '50%', right: '-6px', cursor: 'ew-resize', transform: 'translateY(-50%)' },
                                    'sw': { bottom: '-6px', left: '-6px', cursor: 'nesw-resize' },
                                    's': { bottom: '-6px', left: '50%', cursor: 'ns-resize', transform: 'translateX(-50%)' },
                                    'se': { bottom: '-6px', right: '-6px', cursor: 'nwse-resize' }
                                };
                                handles.forEach(dir => {
                                    const handle = document.createElement('div');
                                    handle.className = `resize-handle ${dir}`;
                                    handle.style.position = 'absolute';
                                    handle.style.width = `${handleSize}px`;
                                    handle.style.height = `${handleSize}px`;
                                    handle.style.backgroundColor = '#000000';
                                    handle.style.zIndex = '100';
                                    handle.style.cursor = handleStyles[dir].cursor;
                                    if (handleStyles[dir].top) handle.style.top = handleStyles[dir].top;
                                    if (handleStyles[dir].bottom) handle.style.bottom = handleStyles[dir].bottom;
                                    if (handleStyles[dir].left) handle.style.left = handleStyles[dir].left;
                                    if (handleStyles[dir].right) handle.style.right = handleStyles[dir].right;
                                    if (handleStyles[dir].transform) handle.style.transform = handleStyles[dir].transform;
                                    childEl.appendChild(handle);
                                });
                            }
                        } else {
                            childEl.classList.remove('selected');
                            childEl.style.outline = 'none';
                            childEl.style.overflow = 'hidden';
                            // Remove handles when deselected
                            childEl.querySelectorAll('.resize-handle').forEach(h => h.remove());
                        }
                    });
                }
            }

            // Highlight selected
            if (this.selectedIds.has(objId)) {
                el.classList.add('selected');
                el.style.overflow = 'visible'; // Allow handles to extend outside
                // Create all 8 resize handles if not already present
                if (!el.querySelector('.resize-handle')) {
                    const handleSize = 6;
                    const handles = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];
                    // Positions are set so handles are completely OUTSIDE the element border
                    const handleStyles: Record<string, { top?: string, bottom?: string, left?: string, right?: string, cursor: string, transform?: string }> = {
                        'nw': { top: '-6px', left: '-6px', cursor: 'nwse-resize' },
                        'n': { top: '-6px', left: '50%', cursor: 'ns-resize', transform: 'translateX(-50%)' },
                        'ne': { top: '-6px', right: '-6px', cursor: 'nesw-resize' },
                        'w': { top: '50%', left: '-6px', cursor: 'ew-resize', transform: 'translateY(-50%)' },
                        'e': { top: '50%', right: '-6px', cursor: 'ew-resize', transform: 'translateY(-50%)' },
                        'sw': { bottom: '-6px', left: '-6px', cursor: 'nesw-resize' },
                        's': { bottom: '-6px', left: '50%', cursor: 'ns-resize', transform: 'translateX(-50%)' },
                        'se': { bottom: '-6px', right: '-6px', cursor: 'nwse-resize' }
                    };
                    handles.forEach(dir => {
                        const handle = document.createElement('div');
                        handle.className = `resize-handle ${dir}`;
                        handle.style.position = 'absolute';
                        handle.style.width = `${handleSize}px`;
                        handle.style.height = `${handleSize}px`;
                        handle.style.backgroundColor = '#000000';
                        handle.style.border = 'none';
                        handle.style.boxSizing = 'border-box';
                        handle.style.zIndex = '100';
                        handle.style.cursor = handleStyles[dir].cursor;

                        // Position
                        if (handleStyles[dir].top) handle.style.top = handleStyles[dir].top;
                        if (handleStyles[dir].bottom) handle.style.bottom = handleStyles[dir].bottom;
                        if (handleStyles[dir].left) handle.style.left = handleStyles[dir].left;
                        if (handleStyles[dir].right) handle.style.right = handleStyles[dir].right;
                        if (handleStyles[dir].transform) handle.style.transform = handleStyles[dir].transform;

                        el.appendChild(handle);
                    });
                }
            } else {
                el.classList.remove('selected');
                el.style.overflow = 'hidden'; // Restore overflow hidden
                // Remove handles when deselected
                el.querySelectorAll('.resize-handle').forEach(h => h.remove());
            }
        });
    }

    // ========================
    // Context Menu Methods
    // ========================

    private showContextMenu(clientX: number, clientY: number, objectId: string) {
        this.hideContextMenu();

        // Create context menu element
        this.contextMenuEl = document.createElement('div');
        this.contextMenuEl.className = 'stage-context-menu';
        this.contextMenuEl.style.cssText = `
            position: fixed;
            left: ${clientX}px;
            top: ${clientY}px;
            background: #2d2d2d;
            border: 1px solid #555;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            z-index: 10000;
            min-width: 120px;
            overflow: hidden;
        `;

        // Check object status
        const obj = this.lastRenderedObjects.find(o => o.id === objectId);
        if (obj) {
            // Option A: Pin Ghost (Preview -> Visible)
            if ((obj as any).isGhost) {
                const pinItem = document.createElement('div');
                pinItem.className = 'context-menu-item';
                pinItem.innerHTML = '📌 In Stage anzeigen';
                pinItem.style.cssText = `padding: 8px 12px; cursor: pointer; color: #4fc3f7; font-size: 13px; transition: background 0.15s; border-bottom: 1px solid #444;`;
                pinItem.onmouseenter = () => pinItem.style.background = '#3d3d3d';
                pinItem.onmouseleave = () => pinItem.style.background = 'transparent';
                pinItem.onclick = (e) => {
                    e.stopPropagation();
                    if (this.onEvent) this.onEvent(objectId, 'pinGlobal');
                    this.hideContextMenu();
                };
                this.contextMenuEl.appendChild(pinItem);
            }
            // Option B: Unpin Global (Visible -> Local Hidden)
            // It is pinned if it is global scope BUT NOT a ghost (so it's "real" on this stage)
            // And we are NOT on the blueprint stage itself (where globals are native)
            else if ((obj as any).scope === 'global' && !this.isBlueprint) {
                const unpinItem = document.createElement('div');
                unpinItem.className = 'context-menu-item';
                unpinItem.innerHTML = '🚫 Aus Stage entfernen';
                unpinItem.style.cssText = `padding: 8px 12px; cursor: pointer; color: #ffab91; font-size: 13px; transition: background 0.15s; border-bottom: 1px solid #444;`;
                unpinItem.onmouseenter = () => unpinItem.style.background = '#3d3d3d';
                unpinItem.onmouseleave = () => unpinItem.style.background = 'transparent';
                unpinItem.onclick = (e) => {
                    e.stopPropagation();
                    if (this.onEvent) this.onEvent(objectId, 'unpinGlobal');
                    this.hideContextMenu();
                };
                this.contextMenuEl.appendChild(unpinItem);
            }
        }

        // Copy option
        const copyItem = document.createElement('div');
        copyItem.className = 'context-menu-item';
        copyItem.innerHTML = '📋 Kopieren';
        copyItem.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            color: #fff;
            font-size: 13px;
            transition: background 0.15s;
        `;
        copyItem.onmouseenter = () => copyItem.style.background = '#3d3d3d';
        copyItem.onmouseleave = () => copyItem.style.background = 'transparent';
        copyItem.onclick = (e) => {
            e.stopPropagation();
            // If right-clicked object is not in selection, select only it
            if (!this.selectedIds.has(objectId)) {
                this.selectedIds.clear();
                this.selectedIds.add(objectId);
                if (this.onSelectCallback) {
                    this.onSelectCallback([objectId]);
                }
            }
            this.copySelection();
            this.hideContextMenu();
        };

        // Delete option
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        deleteItem.innerHTML = '🗑️ Löschen';
        deleteItem.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            color: #ff6b6b;
            font-size: 13px;
            transition: background 0.15s;
        `;
        deleteItem.onmouseenter = () => deleteItem.style.background = '#3d3d3d';
        deleteItem.onmouseleave = () => deleteItem.style.background = 'transparent';
        deleteItem.onclick = (e) => {
            e.stopPropagation();
            if (this.onEvent) {
                // If right-clicked object is in selection, delete all selected
                if (this.selectedIds.has(objectId) && this.selectedIds.size > 1) {
                    const idsToDelete = Array.from(this.selectedIds);
                    this.onEvent('', 'deleteMultiple', idsToDelete);
                    this.selectedIds.clear();
                } else {
                    // Delete only the right-clicked object
                    this.onEvent(objectId, 'delete');
                    this.selectedIds.delete(objectId);
                }
                if (this.onSelectCallback) {
                    this.onSelectCallback(Array.from(this.selectedIds));
                }
            }
            this.hideContextMenu();
        };

        this.contextMenuEl.appendChild(copyItem);
        this.contextMenuEl.appendChild(deleteItem);
        document.body.appendChild(this.contextMenuEl);
    }

    private hideContextMenu() {
        if (this.contextMenuEl) {
            this.contextMenuEl.remove();
            this.contextMenuEl = null;
        }
    }

    // ========================
    // Copy/Paste Methods (Multi-Selection Support)
    // ========================

    /**
     * Copy all selected objects to clipboard with relative positions
     */
    private copySelection() {
        if (!this.onCopyCallback) {
            console.warn('[Stage] onCopyCallback not set');
            return;
        }

        if (this.selectedIds.size === 0) return;

        // Clear previous clipboard
        this.clipboardObjects = [];

        // Find anchor point (top-left corner of bounding box)
        let minX = Infinity, minY = Infinity;
        const selectedArray = Array.from(this.selectedIds);

        // First pass: find the anchor (minimum x, y)
        selectedArray.forEach(id => {
            const el = this.element.querySelector(`[data-id="${id}"]`) as HTMLElement;
            if (el) {
                const left = parseFloat(el.style.left || '0') / this.gridConfig.cellSize;
                const top = parseFloat(el.style.top || '0') / this.gridConfig.cellSize;
                minX = Math.min(minX, left);
                minY = Math.min(minY, top);
            }
        });

        // Second pass: copy each object with relative offset
        selectedArray.forEach(id => {
            const clonedObj = this.onCopyCallback!(id);
            if (clonedObj) {
                const offsetX = (clonedObj.x || 0) - minX;
                const offsetY = (clonedObj.y || 0) - minY;
                this.clipboardObjects.push({ obj: clonedObj, offsetX, offsetY });
            }
        });

        if (this.clipboardObjects.length > 0) {
            console.log(`[Stage] Copied ${this.clipboardObjects.length} objects to clipboard`);
            this.startPlacingSelection();
        }
    }

    /**
     * Start placing mode for the copied selection
     */
    private startPlacingSelection() {
        if (this.clipboardObjects.length === 0) return;

        this.isPlacing = true;
        this.element.style.cursor = 'grab';

        // Calculate bounding box for all objects
        let maxOffsetX = 0, maxOffsetY = 0;
        this.clipboardObjects.forEach(item => {
            maxOffsetX = Math.max(maxOffsetX, item.offsetX + (item.obj.width || 1));
            maxOffsetY = Math.max(maxOffsetY, item.offsetY + (item.obj.height || 1));
        });

        // Create ghost container for the group
        this.placingGhostEl = document.createElement('div');
        this.placingGhostEl.className = 'placing-ghost-group';
        this.placingGhostEl.style.cssText = `
            position: absolute;
            width: ${maxOffsetX * this.gridConfig.cellSize}px;
            height: ${maxOffsetY * this.gridConfig.cellSize}px;
            pointer-events: none;
            z-index: 1000;
        `;

        // Create ghost for each object in the selection
        this.clipboardObjects.forEach(item => {
            const ghost = document.createElement('div');
            ghost.className = 'placing-ghost-item';
            ghost.style.cssText = `
                position: absolute;
                left: ${item.offsetX * this.gridConfig.cellSize}px;
                top: ${item.offsetY * this.gridConfig.cellSize}px;
                width: ${(item.obj.width || 1) * this.gridConfig.cellSize}px;
                height: ${(item.obj.height || 1) * this.gridConfig.cellSize}px;
                background: rgba(79, 195, 247, 0.3);
                border: 2px dashed #4fc3f7;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #4fc3f7;
                font-size: 11px;
                box-sizing: border-box;
            `;
            ghost.innerText = item.obj.name || 'Kopie';
            this.placingGhostEl!.appendChild(ghost);
        });

        this.element.appendChild(this.placingGhostEl);

        // Position immediately if we have a recorded mouse position
        if (this.lastMousePos) {
            const rect = this.element.getBoundingClientRect();
            const x = this.lastMousePos.x - rect.left;
            const y = this.lastMousePos.y - rect.top;
            const gridX = Math.floor(x / this.gridConfig.cellSize) * this.gridConfig.cellSize;
            const gridY = Math.floor(y / this.gridConfig.cellSize) * this.gridConfig.cellSize;
            this.placingGhostEl.style.left = `${gridX}px`;
            this.placingGhostEl.style.top = `${gridY}px`;
        }

        // Track mouse movement
        const moveHandler = (e: MouseEvent) => {
            if (!this.isPlacing || !this.placingGhostEl) return;

            const rect = this.element.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Snap to grid
            const gridX = Math.floor(x / this.gridConfig.cellSize) * this.gridConfig.cellSize;
            const gridY = Math.floor(y / this.gridConfig.cellSize) * this.gridConfig.cellSize;

            this.placingGhostEl.style.left = `${gridX}px`;
            this.placingGhostEl.style.top = `${gridY}px`;
        };

        // Place on click
        const clickHandler = (e: MouseEvent) => {
            if (!this.isPlacing) return;

            const rect = this.element.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const gridX = Math.floor(x / this.gridConfig.cellSize);
            const gridY = Math.floor(y / this.gridConfig.cellSize);

            this.finishPlacingSelection(gridX, gridY);

            // Clean up listeners
            this.element.removeEventListener('mousemove', moveHandler);
            this.element.removeEventListener('click', clickHandler);
        };

        this.element.addEventListener('mousemove', moveHandler);
        this.element.addEventListener('click', clickHandler);
    }

    /**
     * Finish placing and create all copied objects
     */
    private finishPlacingSelection(gridX: number, gridY: number) {
        if (this.clipboardObjects.length === 0 || !this.onPasteCallback) return;

        const newIds: string[] = [];

        // Paste each object with its offset
        this.clipboardObjects.forEach(item => {
            // Generate new ID for each paste
            const freshClone = JSON.parse(JSON.stringify(item.obj));
            freshClone.id = crypto.randomUUID();
            freshClone.name = `${item.obj.name}_copy`;

            const targetX = gridX + item.offsetX;
            const targetY = gridY + item.offsetY;

            const newId = this.onPasteCallback!(freshClone, targetX, targetY);
            if (newId) {
                newIds.push(newId);
            }
        });

        // Select all newly created objects
        if (newIds.length > 0) {
            this.selectedIds.clear();
            newIds.forEach(id => this.selectedIds.add(id));
            if (this.onSelectCallback) {
                this.onSelectCallback(newIds);
            }
            console.log(`[Stage] Placed ${newIds.length} new objects`);
        }

        this.cancelPlacing();
    }

    public cancelPlacing() {
        this.isPlacing = false;
        this.element.style.cursor = 'default';

        if (this.placingGhostEl) {
            this.placingGhostEl.remove();
            this.placingGhostEl = null;
        }
    }

    /**
     * Scrollt zum angegebenen Objekt und lässt es kurz aufleuchten.
     */
    public focusObject(id: string): void {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                const originalOutline = el.style.outline;
                el.style.outline = '4px solid #fff';
                el.style.zIndex = '9999';
                setTimeout(() => {
                    el.style.outline = (this.isSelected(id)) ? '2px solid #4fc3f7' : originalOutline;
                    el.style.zIndex = '';
                }, 1000);
            }
        }, 50); // Kleiner Delay damit das Tab-Switching im Editor ggf. erst abgeschlossen ist
    }

    /**
     * Rendert eine TTable-Komponente in ein HTML-Element.
     * Kann statisch aufgerufen werden (z.B. für den Management-View).
     */
    public static renderTable(el: HTMLElement, obj: any): void {
        if (!obj.columns) return; // Sicherheitscheck: Nur rendern wenn Spalten definiert sind

        el.style.flexDirection = 'column';
        el.style.overflow = 'hidden';
        el.style.display = 'flex';
        el.style.fontSize = '12px';

        // Container-Struktur sicherstellen
        let scrollArea = el.querySelector('.table-scroll-area') as HTMLElement;
        if (!scrollArea) {
            el.innerHTML = '';
            const titleBar = document.createElement('div');
            titleBar.className = 'table-title-bar';
            titleBar.style.cssText = 'padding:6px 12px; font-weight:bold; background:rgba(0,0,0,0.3); border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center; color:#fff; font-size: 13px;';
            el.appendChild(titleBar);

            scrollArea = document.createElement('div');
            scrollArea.className = 'table-scroll-area';
            scrollArea.style.cssText = 'flex:1; overflow-y:auto; overflow-x:hidden;';
            el.appendChild(scrollArea);
        }

        const titleBar = el.querySelector('.table-title-bar') as HTMLElement;
        if (titleBar) {
            titleBar.innerHTML = `<span>${obj.name}</span> <span style="font-weight:normal; opacity:0.6; font-size:11px;">(${obj.data?.length || 0} Einträge)</span>`;
        }

        // Render Table Headers & Rows
        if (scrollArea) {
            scrollArea.innerHTML = '';

            const table = document.createElement('table');
            table.style.cssText = 'width:100%; border-collapse:collapse; color:inherit; table-layout:fixed;';

            // Header
            if (obj.showHeader !== false && obj.columns) {
                const thead = document.createElement('thead');
                const hRow = document.createElement('tr');
                hRow.style.cssText = 'text-align:left; background:rgba(255,255,255,0.05);';
                obj.columns.forEach((col: any) => {
                    const th = document.createElement('th');
                    th.style.cssText = `padding:4px 8px; border-bottom:1px solid rgba(255,255,255,0.1); width:${col.width || 'auto'}; font-size:10px; opacity:0.7;`;
                    th.innerText = col.label;
                    hRow.appendChild(th);
                });
                thead.appendChild(hRow);
                table.appendChild(thead);
            }

            // Body
            const tbody = document.createElement('tbody');
            const data = obj.data || [];
            data.forEach((row: any, idx: number) => {
                const tr = document.createElement('tr');
                tr.style.cssText = `border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; height:${obj.rowHeight || 28}px;`;
                if (idx === obj.selectedIndex) tr.style.backgroundColor = 'rgba(255,255,255,0.1)';

                tr.onmouseenter = () => tr.style.backgroundColor = 'rgba(255,255,255,0.15)';
                tr.onmouseleave = () => tr.style.backgroundColor = (idx === obj.selectedIndex) ? 'rgba(255,255,255,0.1)' : 'transparent';
                tr.onclick = (e) => {
                    e.stopPropagation();
                    obj.selectedIndex = idx;
                    if (typeof obj.onRowClick === 'function') {
                        obj.onRowClick(row, idx);
                    }
                    Stage.renderTable(el, obj); // Re-render to show selection
                };

                if (obj.columns) {
                    obj.columns.forEach((col: any) => {
                        const td = document.createElement('td');
                        td.style.cssText = 'padding:4px 8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
                        let val = row[col.property] ?? '';

                        // Emoji support for scope
                        if (col.property === 'uiScope') {
                            val = val === 'global' ? '🌎' : (val === 'stage' ? '🎭' : (val === 'library' ? '📚' : '📍'));
                        }

                        td.innerText = String(val);
                        tr.appendChild(td);
                    });
                }
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            scrollArea.appendChild(table);
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
