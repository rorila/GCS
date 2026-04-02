import { GridConfig } from '../../model/types';
import { Logger } from '../../utils/Logger';
import { EmojiPickerRenderer } from './renderers/EmojiPickerRenderer';
import { TableRenderer } from './renderers/TableRenderer';


import { IRenderContext } from './renderers/IRenderContext';
import { SpriteRenderer } from './renderers/SpriteRenderer';
import { ShapeRenderer } from './renderers/ShapeRenderer';
import { InputRenderer } from './renderers/InputRenderer';
import { SystemComponentRenderer } from './renderers/SystemComponentRenderer';
import { TextObjectRenderer } from './renderers/TextObjectRenderer';
    import { ComplexComponentRenderer } from './renderers/ComplexComponentRenderer';
const logger = Logger.get('StageRenderer', 'Component_Manipulation');

/**
 * Interface für den Host (Stage), damit der Renderer auf notwendige Eigenschaften zugreifen kann.
 */
export interface StageHost {
    element: HTMLElement;
    grid: GridConfig;
    runMode: boolean;
    isBlueprint: boolean;
    selectedIds: Set<string>;
    onEvent: ((id: string, eventName: string, data?: any) => void) | null;
    lastRenderedObjects: any[];
}

// Referenz-CellSize für fontSize-Skalierung
const REFERENCE_CELL_SIZE = 20;

export class StageRenderer {
    private host: StageHost;

    constructor(host: StageHost) {
        this.host = host;
    }

    /**
     * Skaliert eine fontSize relativ zur aktuellen cellSize.
     * Referenz ist cellSize=20 — dort entspricht die fontSize 1:1 dem Eingabewert.
     * Bei cellSize=10 → halbe fontSize, bei cellSize=30 → 1.5× fontSize.
     */
    private scaleFontSize(rawSize: number | string | undefined): string {
        if (!rawSize) return '';
        const numSize = typeof rawSize === 'string' ? parseFloat(rawSize) : rawSize;
        if (isNaN(numSize)) return typeof rawSize === 'string' ? rawSize : '';
        const scale = this.host.grid.cellSize / REFERENCE_CELL_SIZE;
        return `${Math.round(numSize * scale)}px`;
    }

    public renderObjects(objects: any[]) {
        if (!this.host || !this.host.element) return;
        
        // Update object hash for internal bookkeeping
        const objectHash = objects.map(o => `${o.id}@${Number(o.x || 0).toFixed(1)},${Number(o.y || 0).toFixed(1)}`).join('|');

        if (this.host.runMode) {
            (this.host as any).lastObjectHash = objectHash;
            const gridConfig = this.host.grid;
            logger.info(`%c[Layout] renderObjects: Using cellSize=${gridConfig.cellSize} for ${objects.length} objects`, 'color: #00ff00; font-weight: bold');

            // RADICAL PERFORMANCE/DEBUG LOG: Only once per run-session
            if (!(this.host as any).runModeLogDone) {
                (this.host as any).runModeLogDone = true; // Mark as done after first log
                logger.info(`RunMode Render Start. Rendering ${objects.length} objects.`);
                if (objects.length > 0) {
                    logger.debug(`RunMode objects dump:`, objects.slice(0, 20).map(o => ({
                        name: o.name,
                        class: o.className || o.constructor?.name,
                        visible: o.visible,
                        isVar: o.isVariable || false,
                        scope: o.scope || '-',
                        value: o.isVariable ? JSON.stringify(o.value)?.substring(0, 80) : '-',
                        text: typeof o.text === 'string' ? o.text.substring(0, 60) : '-'
                    })));
                } else {
                    logger.warn(`Rendering an EMPTY stage in RunMode!`);
                }
            }
        }

        this.host.lastRenderedObjects = objects;
        const gridConfig = this.host.grid;
        const stageWidth = gridConfig.cols * gridConfig.cellSize;
        const stageHeight = gridConfig.rows * gridConfig.cellSize;

        if (this.host.runMode) {
            logger.info(`[StageRenderer:Layout] Stage Size: ${stageWidth}x${stageHeight} (cols: ${gridConfig.cols}, nodes: ${objects.length})`);
        }

        // 1. Calculate dock positions
        const dockArea = { left: 0, top: 0, right: stageWidth, bottom: stageHeight };
        const dockPositions = new Map<string, { left: number, top: number, width: number, height: number }>();

        objects.forEach(obj => {
            const align = obj.align || 'NONE';
            if (align === 'NONE' || align === 'CLIENT') return; // Skip CLIENT in first pass

            const objId = obj.id || obj.name; // Fallback to name
            if (!objId) return;

            const objHeight = (obj.height || 0) * gridConfig.cellSize;
            const objWidth = (obj.width || 0) * gridConfig.cellSize;

            // SPECIAL CASE: TStatusBar defines height in pixels (e.g. 28), not grid units
            let actualHeight = objHeight;
            let actualWidth = objWidth;

            if (obj.className === 'TStatusBar') {
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

            const clientWidth = dockArea.right - dockArea.left;
            const clientHeight = dockArea.bottom - dockArea.top;
            dockPositions.set(objId, {
                left: dockArea.left,
                top: dockArea.top,
                width: clientWidth,
                height: clientHeight
            });
        });

        // 1c. Rück-Sync: Dock-Positionen auf Objekt-Properties zurückschreiben (Grid-Einheiten)
        // Damit Inspector und JSON konsistent mit der visuellen Darstellung bleiben.
        objects.forEach(obj => {
            const objId = obj.id || obj.name;
            if (!objId) return;
            const dockPos = dockPositions.get(objId);
            if (!dockPos) return;

            // TStatusBar verwendet Pixel direkt, keine Grid-Konvertierung
            const isPixelBased = obj.className === 'TStatusBar';
            if (isPixelBased) {
                obj.x = dockPos.left;
                obj.y = dockPos.top;
                obj.width = dockPos.width;
                obj.height = dockPos.height;
            } else {
                obj.x = dockPos.left / gridConfig.cellSize;
                obj.y = dockPos.top / gridConfig.cellSize;
                obj.width = dockPos.width / gridConfig.cellSize;
                obj.height = dockPos.height / gridConfig.cellSize;
            }
        });

        const currentIds = this.collectAllIds(objects);
        const renderedElements = Array.from(this.host.element.querySelectorAll('.game-object')) as HTMLElement[];

        // Remove elements that are no longer in the objects list
        renderedElements.forEach(el => {
            const id = el.getAttribute('data-id');
            if (id && !currentIds.has(id)) {
                el.remove();
            }
        });

        // Sort objects by zIndex for proper layer ordering
        const sortedObjects = [...objects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        // Update or Create elements
        sortedObjects.forEach((obj) => {
            const objId = obj.id || obj.name;
            if (!objId) return;

            let el = this.host.element.querySelector(`[data-id="${objId}"]`) as HTMLElement;
            let isNew = false;

            if (!el) {
                el = document.createElement('div');
                el.setAttribute('data-id', objId);
                el.style.position = 'absolute';
                el.style.boxSizing = 'border-box';
                el.style.overflow = 'hidden'; // Wichtig für border-radius + children!
                // ── Anti-Blink: Element startet unsichtbar, damit es nicht für
                // einen Frame bei Position (0,0) aufblitzt, bevor Transform und
                // Sichtbarkeit konfiguriert sind (Zeile ~275).
                el.style.display = 'none';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                el.style.userSelect = 'none';
                this.host.element.appendChild(el);
                isNew = true;
            }

            const className = obj.className || obj.constructor?.name;
            el.className = 'game-object' + (className ? ' ' + className : '');
            el.setAttribute('data-align', obj.align || 'NONE');

            // Apply positioning
            const dockPos = dockPositions.get(objId);
            let finalX, finalY, finalW, finalH;

            if (dockPos) {
                // FIXED: For docked objects, we ignore the internal x/y coordinates to prevent "jumping out" of the stage
                // The alignment (TOP, BOTTOM, LEFT, RIGHT, CLIENT) is the primary source of truth.
                finalX = dockPos.left;
                finalY = dockPos.top;
                finalW = dockPos.width;
                finalH = dockPos.height;
            } else {
                let absX = obj.x || 0;
                let absY = obj.y || 0;
                let curr = obj.parentId;
                while (curr) {
                    const p = objects.find(o => (o.id || o.name) === curr);
                    if (p) {
                        absX += p.x || 0;
                        absY += p.y || 0;
                        curr = p.parentId;
                    } else {
                        break;
                    }
                }

                finalX = absX * gridConfig.cellSize;
                finalY = absY * gridConfig.cellSize;
                finalW = (obj.width || 0) * gridConfig.cellSize;
                finalH = (obj.height || 0) * gridConfig.cellSize;
            }

            // 🎮 PERFORMANTE SPIELE-SCHLEIFE (GPU COMPOSITING)
            if (this.host.runMode) {
                // Hardware Acceleration: Anker auf Null setzen, damit die GPU Texturen schiebt statt der CPU Layouts rechnet
                el.style.willChange = 'transform, opacity';
                el.style.backfaceVisibility = 'hidden';
                el.style.left = '0px';
                el.style.top = '0px';
                
                // Initiale Position als Transform (inkl. custom-Styling)
                let finalTransform = `translate3d(${finalX}px, ${finalY}px, 0)`;
                if (obj.style && obj.style.transform) {
                    finalTransform += ` ${obj.style.transform}`;
                }
                el.style.transform = finalTransform;

                // Log all objects in Run-Mode to trace layout issues (Metrics)
                const isMetric = obj.name?.includes('Metric') || obj.id?.includes('metric');
                if (isMetric || obj.id === 'dash_title' || obj.id === 'dash_back_btn' || obj.name?.includes('Button') || (obj.name && obj.name.includes('Emoji'))) {
                    logger.info(`%c[HW-Layout:${this.host.element.id}] ${obj.name || obj.id} (RUN): align=${obj.align}, x=${obj.x}, y=${obj.y}, w=${obj.width}, cellSize=${gridConfig.cellSize} -> GPU_transform: ${finalX}/${finalY}`, 'color: #00ffff; font-weight: bold');
                }
            } else {
                // 🖌️ DESIGN-MODUS (Klassischer DOM für Drag & Drop)
                el.style.left = `${finalX}px`;
                el.style.top = `${finalY}px`;
            }

            el.style.width = `${finalW}px`;
            el.style.height = `${finalH}px`;

            let isVisible = this.checkVisible(obj.visible) && this.checkVisible(obj.style?.visible);

            // ── isHiddenInRun-Fix: Templates, Services und andere Objekte mit
            // isHiddenInRun=true MÜSSEN im Run-Mode unsichtbar sein, auch wenn
            // visible=true gesetzt ist. Ohne diesen Check erscheinen z.B.
            // TSpriteTemplate-Bilder als "Ghost-Images" auf der Stage.
            if (this.host.runMode && obj.isHiddenInRun) {
                isVisible = false;
            }

            // SPECIAL FIX: Hide blueprint-only services on regular stages
            const isInherited = !!obj.isInherited;
            const isFromBlueprint = !!obj.isFromBlueprint;
            const isBlueprintOnly = !!obj.isBlueprintOnly;
            const isService = !!obj.isService;

            if (!this.host.isBlueprint) {
                // Hide services and strictly blueprint-only marker objects on regular stages
                if (isFromBlueprint && (isService || isBlueprintOnly)) {
                    isVisible = false;
                }
            } else {
                // In blueprint stage, we ALWAYS want to see blueprint elements
                if (isFromBlueprint || isService || isBlueprintOnly) {
                    isVisible = true;
                }
            }

            if (!this.host.runMode && (!isVisible || obj.isHiddenInRun || isService || isBlueprintOnly)) {
                el.style.display = 'flex';
                el.classList.add('invisible-object-in-editor');
            } else {
                el.style.display = isVisible ? 'flex' : 'none';
                el.classList.remove('invisible-object-in-editor');
            }

            // Inherited/Ghosted State — nur im Design-Mode schemenhaft
            if (isInherited && !this.host.runMode) {
                el.classList.add('inherited-object');
                el.style.pointerEvents = 'auto';
                el.style.cursor = 'default';
                el.draggable = false;
            } else {
                el.classList.remove('inherited-object');
                el.style.pointerEvents = 'auto';
            }

            const opacity = (obj.style && obj.style.opacity !== undefined && obj.style.opacity !== null) ? obj.style.opacity : (obj.imageOpacity !== undefined ? obj.imageOpacity : undefined);
            const needsPlaceholder = (!isVisible || obj.isHiddenInRun || isService || isBlueprintOnly) && !this.host.runMode;

            if (opacity !== undefined && opacity !== null) {
                el.style.opacity = String(opacity);
            } else if (isInherited && !this.host.runMode) {
                el.style.opacity = '0.4';
            } else if (needsPlaceholder) {
                el.style.opacity = '0.4';
                el.style.outline = '2px dashed #ff4444';
                el.style.outlineOffset = '-2px';
            } else {
                el.style.opacity = '1';
                el.style.outline = '';
            }

            // Styles
            if (obj.style) {
                const isTShape = className === 'TShape';
                if (!isTShape) {
                    el.style.border = `${obj.style.borderWidth || 0}px solid ${obj.style.borderColor || 'transparent'}`;
                } else {
                    el.style.border = 'none';
                }

                if (obj.style.color) {
                    el.style.color = obj.style.color;
                    if (obj.className === 'TLabel' || obj.className === 'TButton') {
                        // Color applied
                    }
                }
                if (obj.style.fontSize) el.style.fontSize = this.scaleFontSize(obj.style.fontSize);
                if (obj.style.fontWeight) el.style.fontWeight = obj.style.fontWeight;
                if (obj.style.borderRadius) el.style.borderRadius = typeof obj.style.borderRadius === 'number' ? `${obj.style.borderRadius}px` : obj.style.borderRadius;
                // Transform wird jetzt zusammen mit der Positions-Zuweisung berechnet,
                // damit das translate3d() (Basis-Positionierung) nicht zerstört wird.
                if (!this.host.runMode) {
                    if (obj.style && obj.style.transform) {
                        el.style.transform = obj.style.transform;
                    } else if (el.style.transform) {
                        el.style.transform = '';
                    }
                }
                // Glow/Shadow-Effekt: Prio 1 = expliziter boxShadow CSS-String, Prio 2 = glowColor + glowBlur + glowSpread
                if (obj.style.boxShadow) {
                    el.style.boxShadow = obj.style.boxShadow;
                } else if (obj.style.glowColor && (obj.style.glowBlur || obj.style.glowSpread)) {
                    const blur = obj.style.glowBlur || 20;
                    const spread = obj.style.glowSpread || 5;
                    el.style.boxShadow = `0 0 ${blur}px ${spread}px ${obj.style.glowColor}`;
                } else {
                    el.style.boxShadow = '';
                }

                if (obj.zIndex !== undefined) {
                    el.style.zIndex = String(obj.zIndex);
                } else if (obj.name && (obj.name.startsWith('Overlay') || obj.name.startsWith('Btn') || obj.name.startsWith('Input')) || obj.className === 'TStatusBar') {
                    el.style.zIndex = '2000';
                }
            }

            // Grid overlay
            if (obj.showGrid && !this.host.runMode) {
                this.applyGridOverlay(el, obj);
            } else {
                this.applyBackground(el, obj, className, objId);
            }

            // Interaction hints & Click handlers
            const hasTaskClick = (obj.Tasks && (obj.Tasks.onClick || obj.Tasks.onSingleClick || obj.Tasks.onMultiClick)) ||
                (obj.events && (obj.events.onClick || obj.events.onSingleClick || obj.events.onMultiClick));
            const isClickable = hasTaskClick || (this.host.runMode && className === 'TButton');

            if (this.host.runMode && isClickable) {
                el.style.cursor = 'pointer';
                el.onclick = (e) => {
                    e.stopPropagation();
                    logger.debug(`Click on ${obj.name} (${obj.id}). Task: ${obj.events?.onClick || obj.Tasks?.onClick || 'none'}`);
                    if (this.host.onEvent) {
                        this.host.onEvent(obj.id, 'onClick');
                    }
                };
            } else if (this.host.runMode) {
                // FALLBACK: Even if not explicitly "clickable" (no task assigned yet), 
                // we might want to catch clicks in runMode for other reasons or ensure old handlers are cleared.
                el.style.cursor = 'default';
                if (isNew) el.onclick = null;
            }

            // Component specific rendering
            this.renderComponentContent(el, obj, className, isNew);

            // Highlight selected
            this.updateSelectionState(el, objId);
        });
    }

    private collectAllIds(objs: any[]): Set<string> {
        const ids = new Set<string>();
        objs.forEach(o => {
            const objId = o.id || o.name;
            if (objId) ids.add(objId);
            if (o.children && Array.isArray(o.children)) {
                o.children.forEach((c: any) => {
                    const childId = c.id || c.name;
                    if (childId) ids.add(childId);
                });
            }
        });
        return ids;
    }

    private checkVisible(val: any): boolean {
        if (val === undefined || val === null) return true;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') {
            const clean = val.trim().toLowerCase();
            if (clean === 'false') return false;
            if (clean === 'true') return true;
        }
        return !!val;
    }

    private applyGridOverlay(el: HTMLElement, obj: any) {
        const cellSize = this.host.grid.cellSize;
        const bgColor = obj.style?.backgroundColor || 'transparent';
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
            const halfCell = cellSize / 2;
            el.style.background = `radial-gradient(circle, ${dotRgba} 1px, transparent 1px), ${bgColor}`;
            el.style.backgroundSize = `${cellSize}px ${cellSize}px, 100% 100%`;
            el.style.backgroundPosition = `${halfCell}px ${halfCell}px, 0 0`;
        } else {
            el.style.background = `linear-gradient(to right, ${gridRgba} 1px, transparent 1px), linear-gradient(to bottom, ${gridRgba} 1px, transparent 1px), ${bgColor}`;
            el.style.backgroundSize = `${cellSize}px ${cellSize}px, ${cellSize}px ${cellSize}px, 100% 100%`;
        }
    }

    private applyBackground(el: HTMLElement, obj: any, className: string, objId: string) {
        const bgColor = obj.style?.backgroundColor || 'transparent';
        let bgImg = obj.backgroundImage || obj.src || obj.style?.backgroundImage;

        if (bgImg && bgImg.startsWith('url(')) {
            const match = bgImg.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (match) bgImg = match[1];
        }

        if (this.host.runMode && !(el as any).runModeTraceDone) {
            (el as any).lastLoggedSrc = null;
            (el as any).runModeTraceDone = true;
        }

        // ── GPU-OPTIMIERUNG: TSprite-Images werden als natives <img>-Tag im renderSprite()
        // gerendert, NICHT als CSS background-image. CSS background-image erzwingt CPU-Rasterung
        // bei translate3d-Animationen, ein <img>-Tag wird dagegen als eigenständige GPU-Textur
        // composited und erlaubt jitterfreie Subpixel-Bewegungen.
        if (bgImg && className === 'TSprite') {
            // Nur Hintergrundfarbe setzen; das Bild wird als <img> Child gerendert
            el.style.background = bgColor;
            el.style.backgroundImage = 'none';
            return;
        }

        if (bgImg) {
            let src = (bgImg.startsWith('http') || bgImg.startsWith('/') || bgImg.startsWith('data:'))
                ? bgImg
                : `/images/${bgImg}`;

            if (!src.startsWith('data:')) {
                const parts = src.split('/');
                const lastPart = parts.pop() || '';
                src = [...parts, encodeURIComponent(lastPart)].join('/');
            }

            if ((el as any).lastLoggedSrc !== src) {
                logger.debug(`Component "${objId}" (${className}) setting image: "${src}"`);
                (el as any).lastLoggedSrc = src;
            }

            const fit = obj.objectFit || 'contain';
            el.style.backgroundImage = `url("${src}")`;
            el.style.backgroundPosition = 'center';
            el.style.backgroundSize = fit;
            el.style.backgroundRepeat = 'no-repeat';
            el.style.backgroundColor = bgColor;
        } else {
            // TGroupPanel: Im Editor-Modus hellgrau hinterlegen damit es sichtbar bleibt,
            // im Run-Modus transparent.
            if (className === 'TGroupPanel' && !this.host.runMode) {
                el.style.background = bgColor !== 'transparent' ? bgColor : 'rgba(200, 200, 210, 0.15)';
                el.style.border = el.style.border || '1px dashed rgba(150, 150, 170, 0.4)';
            } else {
                el.style.background = bgColor;
            }
        }
    }

    private renderComponentContent(el: HTMLElement, obj: any, className: string, isNew: boolean) {
        const ctx: IRenderContext = {
            host: this.host,
            scaleFontSize: this.scaleFontSize.bind(this),
            updateSelectionState: this.updateSelectionState.bind(this)
        };

        if (className === 'TCheckbox') InputRenderer.renderCheckbox(ctx, el, obj, isNew);
        else if (className === 'TNumberInput') InputRenderer.renderNumberInput(ctx, el, obj, isNew);
        else if (className === 'TEdit' || className === 'TTextInput') InputRenderer.renderTextInput(ctx, el, obj, isNew);
        else if (className === 'TGameCard') TextObjectRenderer.renderGameCard(ctx, el, obj, isNew);
        else if (className === 'TButton') TextObjectRenderer.renderButton(ctx, el, obj, isNew);
        else if (className === 'TEmojiPicker') EmojiPickerRenderer.renderEmojiPicker(el, obj, this.host.grid.cellSize, this.host.onEvent?.bind(this.host));
        else if (className === 'TTable' || className === 'TObjectList') TableRenderer.renderTable(el, obj, this.host.onEvent?.bind(this.host), this.host.grid.cellSize);
        else if (className === 'TDataList') ComplexComponentRenderer.renderDataList(ctx, el, obj);
        else if (className === 'TStringVariable' || className === 'TObjectVariable' || className === 'TIntegerVariable' || className === 'TBooleanVariable' || className === 'TListVariable' || obj.isVariable || obj.isService) SystemComponentRenderer.render(ctx, el, obj, className);
        else if (className === 'TLabel' || className === 'TNumberLabel') TextObjectRenderer.renderLabel(ctx, el, obj);
        else if (className === 'TPanel') TextObjectRenderer.renderPanel(ctx, el, obj);
        else if (className === 'TGameHeader') TextObjectRenderer.renderGameHeader(ctx, el, obj);
        else if (className === 'TSprite') SpriteRenderer.render(ctx, el, obj);
        else if (className === 'TShape') ShapeRenderer.render(ctx, el, obj, isNew);
        else if (className === 'TInspectorTemplate') ComplexComponentRenderer.renderInspectorTemplate(ctx, el, obj);
        else if (className === 'TDialogRoot') ComplexComponentRenderer.renderDialogRoot(ctx, el, obj);
        else if (className === 'TColorPicker') InputRenderer.renderColorPicker(ctx, el, obj, isNew);
        else if (className === 'TImageList') this.renderImageList(el, obj);
        else if (className === 'TDropdown') InputRenderer.renderDropdown(ctx, el, obj, isNew);
        else if (className !== 'TShape' && ('text' in obj || 'value' in obj)) TextObjectRenderer.renderLabel(ctx, el, obj);
    }
private updateSelectionState(el: HTMLElement, id: string) {
        if (this.host.selectedIds.has(id)) {
            el.classList.add('selected');
            el.style.overflow = 'visible';
            el.style.outline = '2px solid #4fc3f7';
            if (!el.querySelector('.resize-handle')) {
                this.addResizeHandles(el);
            }
        } else {
            el.classList.remove('selected');
            el.style.overflow = 'hidden';
            el.style.outline = 'none';
            el.querySelectorAll('.resize-handle').forEach(h => h.remove());
        }
    }

    private addResizeHandles(el: HTMLElement) {
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
            el.appendChild(handle);
        });
    }

    /**
     * Rendert eine TDataList: Im Editor das Template, im Run-Modus die geklonten Karten
     */
    
    /**
     * Rendert eine TImageList: Zeigt den aktuellen Frame des Sprite-Sheets an.
     * Nutzt CSS background-size + background-position für pixelgenaues Clipping.
     */
    private renderImageList(el: HTMLElement, obj: any): void {
        const src = obj.backgroundImage || obj.src || '';
        const hCount = obj.imageCountHorizontal || 1;
        const vCount = obj.imageCountVertical || 1;
        const currentFrame = obj.currentImageNumber || 0;

        if (!src) {
            // Kein Bild: Platzhalter anzeigen
            el.style.backgroundImage = 'none';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            if (!el.querySelector('.imagelist-placeholder')) {
                const placeholder = document.createElement('div');
                placeholder.className = 'imagelist-placeholder';
                placeholder.textContent = '🎞️';
                placeholder.style.cssText = 'font-size: 24px; opacity: 0.5; pointer-events: none;';
                el.appendChild(placeholder);
            }
            return;
        }

        // Platzhalter entfernen falls vorhanden
        const existing = el.querySelector('.imagelist-placeholder');
        if (existing) existing.remove();

        // URL normalisieren
        let imgSrc = src;
        if (!imgSrc.startsWith('http') && !imgSrc.startsWith('/') && !imgSrc.startsWith('data:')) {
            imgSrc = `/images/${imgSrc}`;
        }
        if (!imgSrc.startsWith('data:')) {
            const parts = imgSrc.split('/');
            const lastPart = parts.pop() || '';
            imgSrc = [...parts, encodeURIComponent(lastPart)].join('/');
        }

        // CSS Sprite-Sheet Clipping:
        // background-size: H*100% V*100% → vergrößert das Bild so, dass jeder Frame exakt die Element-Größe hat
        // background-position: berechnet den Offset zum gewünschten Frame
        const col = currentFrame % hCount;
        const row = Math.floor(currentFrame / hCount);

        const bgSizeX = hCount * 100;
        const bgSizeY = vCount * 100;
        const bgPosX = hCount <= 1 ? 0 : (col / (hCount - 1)) * 100;
        const bgPosY = vCount <= 1 ? 0 : (row / (vCount - 1)) * 100;

        el.style.backgroundImage = `url("${imgSrc}")`;
        el.style.backgroundSize = `${bgSizeX}% ${bgSizeY}%`;
        el.style.backgroundPosition = `${bgPosX}% ${bgPosY}%`;
        el.style.backgroundRepeat = 'no-repeat';

        // Im Editor-Modus: Frame-Nummer anzeigen
        if (!this.host.runMode) {
            let badge = el.querySelector('.imagelist-badge') as HTMLElement;
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'imagelist-badge';
                badge.style.cssText = `
                    position: absolute; top: 2px; right: 2px;
                    background: rgba(30, 30, 46, 0.85); color: #89b4fa;
                    font-size: 10px; font-weight: bold; padding: 2px 6px;
                    border-radius: 3px; pointer-events: none; z-index: 10;
                `;
                el.appendChild(badge);
            }
            badge.textContent = `#${currentFrame}/${hCount * vCount}`;
        } else {
            // Im Run-Modus Badge entfernen
            const badge = el.querySelector('.imagelist-badge');
            if (badge) badge.remove();
        }
    }
    // ─────────────────────────────────────────────────────────────────
    // FAST PATH: Sprite-Positionen direkt im DOM aktualisieren
    // Wird 60×/sec vom GameLoopManager aufgerufen, OHNE volles Render.
    // Kein Dock-Recalc, kein Element-Create/Remove.
    // ─────────────────────────────────────────────────────────────────
    public updateSpritePositions(objects: any[]): void {
        const cellSize = this.host.grid.cellSize;
        for (const obj of objects) {
            const el = this.host.element.querySelector(
                `[data-id="${obj.id}"]`
            ) as HTMLElement;
            if (!el) continue;
            
            // Hardware-Textur-Verschiebung im Subpixel-Raum
            const transX = (obj.x || 0) * cellSize;
            const transY = (obj.y || 0) * cellSize;

            if (this.host.runMode) {
                // ── Sichtbarkeits-Sync (Pool-Sprites) ──
                // Pool-Sprites wechseln visible im Fast-Path (acquire/release).
                // Berücksichtigt `isHiddenInRun` für Templates, damit sie durch Updates nicht sichtbar werden!
                let isVisible = obj.visible !== false;
                if (obj.isHiddenInRun) isVisible = false;

                if (isVisible) {
                    el.style.display = 'flex';
                } else {
                    el.style.display = 'none';
                }

                // GPU Compositing: Subpixel-genaue Positionierung für butterweiche Bewegungen.
                // Kein Math.round() mehr nötig, da Sprite-Bilder jetzt als natives <img>-Tag
                // (eigene GPU-Textur) gerendert werden statt als CSS background-image.
                let finalTransform = `translate3d(${transX}px, ${transY}px, 0)`;
                
                if (obj.style && obj.style.transform !== undefined) {
                    finalTransform += ` ${obj.style.transform}`;
                }
                el.style.transform = finalTransform;

                if (obj.style && obj.style.opacity !== undefined) {
                    el.style.opacity = String(obj.style.opacity);
                } else if (obj.opacity !== undefined) {
                    el.style.opacity = String(obj.opacity);
                }
            } else {
                // Fallback Layout für Inspektion
                if (obj.x !== undefined) el.style.left = `${transX}px`;
                if (obj.y !== undefined) el.style.top = `${transY}px`;
                
                if (obj.style) {
                    if (obj.style.transform !== undefined) el.style.transform = obj.style.transform;
                    if (obj.style.opacity !== undefined) el.style.opacity = String(obj.style.opacity);
                } else if (obj.opacity !== undefined) {
                    el.style.opacity = String(obj.opacity);
                }
            }
        }
    }
}
