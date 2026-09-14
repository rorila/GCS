import { Logger } from '../../../utils/Logger';
import { PropertyHelper } from '../../../runtime/PropertyHelper';
import { dataUrlToBlobUrl } from '../../../utils/BlobUrlCache';
import { getDialogSlideOffset } from './DialogSlide';
import { IRenderContext } from './IRenderContext';
import { EmojiPickerRenderer } from './EmojiPickerRenderer';
import { TableRenderer } from './TableRenderer';
import { TetrisRenderer } from './TetrisRenderer';
import { GridBoardRenderer } from './GridBoardRenderer';
import { SpriteRenderer } from './SpriteRenderer';
import { ShapeRenderer } from './ShapeRenderer';
import { InputRenderer } from './InputRenderer';
import { SystemComponentRenderer } from './SystemComponentRenderer';
import { VirtualGamepadRenderer } from './VirtualGamepadRenderer';
import { TextObjectRenderer } from './TextObjectRenderer';
import { ComplexComponentRenderer } from './ComplexComponentRenderer';
import { SpecialComponentRenderer, ISpecialComponentContext } from './SpecialComponentRenderer';
import { StageLayoutEngine } from './StageLayoutEngine';
import { StageAnimationPreviewManager } from './StageAnimationPreviewManager';
import { themeRegistry } from '../../../runtime/ThemeRegistry';
import { projectObjectRegistry } from '../../../services/registry/ObjectRegistry';
import type { StageHost } from '../StageRenderer';

const logger = Logger.get('StageObjectRenderer', 'Component_Manipulation');

export interface DockRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface ObjectRenderContext {
    host: StageHost;
    objects: any[];
    layoutEngine: StageLayoutEngine;
    animationPreviewManager: StageAnimationPreviewManager;
    getVariableContext(): Record<string, any>;
    scaleFontSize(rawSize: number | string | undefined): string;
    updateSelectionState(el: HTMLElement, id: string): void;
}

export class StageObjectRenderer {
    private ctx: ObjectRenderContext;

    constructor(ctx: ObjectRenderContext) {
        this.ctx = ctx;
    }

    public render(el: HTMLElement, rawObj: any, isNew: boolean, dockPositions: Map<string, DockRect>, ctx: ObjectRenderContext): void {
        this.ctx = ctx;

        const mergedStyle = themeRegistry.getMergedStyle(rawObj.className || 'TObject', rawObj.style);
        const obj = new Proxy(rawObj, {
            get(target, prop: string | symbol, receiver) {
                if (prop === 'style') return mergedStyle;
                const value = Reflect.get(target, prop, receiver);
                if (value && typeof value === 'object' && (value as any).__isProxy__) return value;
                return value;
            },
            set(target, prop: string | symbol, value, receiver) {
                return Reflect.set(target, prop, value, receiver);
            }
        });

        const objId = obj.id || obj.name;
        if (!objId) return;

        const objects = this.ctx.objects;
        const gridConfig = this.ctx.host.grid;
        const className = obj.className || obj.constructor?.name;

        el.className = 'game-object' + (className ? ' ' + className : '');
        el.setAttribute('data-align', obj.align || 'NONE');

        // Style-Diff-Cache des Fast-Path verwerfen, da renderObjects direkt schreibt.
        (el as any)._fp = undefined;

        const dockPos = dockPositions.get(objId);
        let finalX: number, finalY: number, finalW: number, finalH: number;

        if (dockPos) {
            finalX = dockPos.left;
            finalY = dockPos.top;
            finalW = dockPos.width;
            finalH = dockPos.height;
        } else {
            let absX = this.ctx.layoutEngine.getResolvedNumber(obj, 'x', objects);
            let absY = this.ctx.layoutEngine.getResolvedNumber(obj, 'y', objects);
            let curr = obj.parentId;
            let depth = 0;
            while (curr && depth < 100) {
                const p = objects.find((o: any) => (o.id || o.name) === curr);
                if (p) {
                    absX += this.ctx.layoutEngine.getResolvedNumber(p, 'x', objects);
                    absY += this.ctx.layoutEngine.getResolvedNumber(p, 'y', objects);
                    curr = p.parentId;
                } else {
                    break;
                }
                depth++;
            }
            if (depth >= 100) {
                logger.error(`[StageObjectRenderer] Cycle detected calculating absolute position for id: ${objId}`);
            }

            finalX = absX * gridConfig.cellSize;
            finalY = absY * gridConfig.cellSize;
            finalW = this.ctx.layoutEngine.getResolvedNumber(obj, 'width', objects) * gridConfig.cellSize;
            finalH = this.ctx.layoutEngine.getResolvedNumber(obj, 'height', objects) * gridConfig.cellSize;
        }

        let parentDialog: any = null;
        if (this.ctx.host.runMode) {
            if ((className === 'TDialogRoot' || className === 'TThemeDialog') || className === 'TSidePanel') parentDialog = obj;
            else if (obj.parentId) {
                parentDialog = this.resolveDialogParent(obj);
            }
        }

        if (this.ctx.host.runMode) {
            el.style.willChange = 'translate, transform, opacity';
            el.style.backfaceVisibility = 'hidden';
            el.style.left = '0px';
            el.style.top = '0px';

            if (className === 'TVirtualGamepad') {
                (el.style as any).translate = 'none';
            } else if (parentDialog) {
                el.style.transition = 'translate 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease';

                if (parentDialog.visible) {
                    (el.style as any).translate = `${finalX}px ${finalY}px`;
                    el.style.pointerEvents = 'auto';
                } else {
                    const outOfBoundsOffset = getDialogSlideOffset(parentDialog, gridConfig.cellSize);
                    (el.style as any).translate = `${finalX + outOfBoundsOffset}px ${finalY}px`;
                    el.style.pointerEvents = 'none';
                }
            } else {
                el.style.transition = '';
                (el.style as any).translate = `${finalX}px ${finalY}px`;
            }
            let transformStr = (obj.style && obj.style.transform) ? obj.style.transform : '';
            if (obj.rotation) {
                transformStr += ` rotate(${obj.rotation}deg)`;
            }
            el.style.transform = transformStr.trim();

            const isMetric = obj.name?.includes('Metric') || obj.id?.includes('metric');
            if (isMetric || obj.id === 'dash_title' || obj.id === 'dash_back_btn' || obj.name?.includes('Button') || (obj.name && obj.name.includes('Emoji'))) {
                logger.info(`%c[HW-Layout:${this.ctx.host.element.id}] ${obj.name || obj.id} (RUN): align=${obj.align}, x=${obj.x}, y=${obj.y}, w=${obj.width}, cellSize=${gridConfig.cellSize} -> GPU_transform: ${finalX}/${finalY}`, 'color: #00ffff; font-weight: bold');
            }
        } else {
            el.style.left = `${finalX}px`;
            el.style.top = `${finalY}px`;
        }

        el.style.width = `${finalW}px`;
        el.style.height = `${finalH}px`;

        let isVisible = this.checkVisible(obj.visible) && this.checkVisible(obj.style?.visible);

        if (this.ctx.host.runMode && obj.isHiddenInRun) {
            isVisible = false;
        }

        const isInherited = !!obj.isInherited;
        const isFromBlueprint = !!obj.isFromBlueprint;
        const isBlueprintOnly = !!obj.isBlueprintOnly;
        const isService = !!obj.isService;

        if (!this.ctx.host.isBlueprint) {
            if (isFromBlueprint && (isService || isBlueprintOnly)) {
                isVisible = false;
            }
        } else {
            if (isFromBlueprint || isService || isBlueprintOnly) {
                isVisible = true;
            }
        }

        if (!this.ctx.host.runMode && (!isVisible || obj.isHiddenInRun || isService || isBlueprintOnly)) {
            el.style.display = obj.className === 'TRichText' ? 'block' : 'flex';
            el.classList.add('invisible-object-in-editor');
        } else {
            let finalDisplay = isVisible ? (obj.className === 'TRichText' ? 'block' : 'flex') : 'none';

            if (this.ctx.host.runMode) {
                let keepVisible = false;
                if ((obj.className === 'TDialogRoot' || obj.className === 'TThemeDialog') || obj.className === 'TSidePanel') {
                    keepVisible = true;
                } else if (obj.parentId) {
                    let currId = obj.parentId;
                    let sanity = 0;
                    while (currId && sanity++ < 20) {
                        const p = objects.find((o: any) => (o.id || o.name) === currId);
                        if (p && ((p.className === 'TDialogRoot' || p.className === 'TThemeDialog') || p.className === 'TSidePanel' || p.constructor?.name === 'TDialogRoot' || p.constructor?.name === 'TThemeDialog')) {
                            keepVisible = true;
                            break;
                        }
                        currId = p?.parentId;
                    }
                }
                if (keepVisible) {
                    finalDisplay = obj.className === 'TRichText' ? 'block' : 'flex';
                }
            }

            el.style.display = finalDisplay;
            el.classList.remove('invisible-object-in-editor');
        }

        if (isInherited && !this.ctx.host.runMode) {
            el.classList.add('inherited-object');
            el.style.pointerEvents = 'auto';
            el.style.cursor = 'default';
            el.draggable = false;
        } else {
            el.classList.remove('inherited-object');
            el.style.pointerEvents = 'auto';
        }

        const opacity = (obj.style && obj.style.opacity !== undefined && obj.style.opacity !== null)
            ? this.ctx.layoutEngine.getResolvedStyleValue(obj, 'opacity', objects)
            : (obj.imageOpacity !== undefined ? obj.imageOpacity : undefined);
        const needsPlaceholder = (!isVisible || obj.isHiddenInRun || isService || isBlueprintOnly) && !this.ctx.host.runMode;

        if (opacity !== undefined && opacity !== null) {
            el.style.opacity = String(opacity);
        } else if (isInherited && !this.ctx.host.runMode) {
            el.style.opacity = '0.4';
        } else if (needsPlaceholder) {
            el.style.opacity = '0.4';
            el.style.outline = '2px dashed #ff4444';
            el.style.outlineOffset = '-2px';
        } else {
            el.style.opacity = '1';
            el.style.outline = '';
        }

        if (obj.style) {
            const isTShape = className === 'TShape';
            if (!isTShape) {
                el.style.border = `${obj.style.borderWidth || 0}px solid ${obj.style.borderColor || 'transparent'}`;
            } else {
                el.style.border = 'none';
            }

            if (obj.style.color) {
                el.style.color = obj.style.color;
                if (obj.className === 'TLabel' || obj.className === 'TButton' || obj.className === 'TStickyNote') {
                    // Color applied
                }
            }
            if (obj.style.fontSize) el.style.fontSize = this.ctx.scaleFontSize(obj.style.fontSize);
            if (obj.style.fontWeight) el.style.fontWeight = obj.style.fontWeight;
            if (obj.style.fontFamily) el.style.fontFamily = obj.style.fontFamily;
            if (obj.style.textShadow) el.style.textShadow = obj.style.textShadow;
            if (obj.style.borderRadius) el.style.borderRadius = typeof obj.style.borderRadius === 'number' ? `${obj.style.borderRadius}px` : obj.style.borderRadius;

            if (!this.ctx.host.runMode) {
                let transformStr = (obj.style && obj.style.transform) ? obj.style.transform : '';
                if (obj.rotation) {
                    transformStr += ` rotate(${obj.rotation}deg)`;
                }
                el.style.transform = transformStr.trim();
            }

            if (obj.style.boxShadow) {
                el.style.boxShadow = obj.style.boxShadow;
            } else if (obj.style.glowColor) {
                const blur = obj.style.glowBlur ?? 20;
                const spread = obj.style.glowSpread ?? 5;
                el.style.boxShadow = `0 0 ${blur}px ${spread}px ${obj.style.glowColor}`;
            } else if (obj.style.shadowColor) {
                const inset = obj.style.shadowInset ? 'inset ' : '';
                const offsetX = obj.style.shadowOffsetX ?? 4;
                const offsetY = obj.style.shadowOffsetY ?? 4;
                const blur = obj.style.shadowBlur ?? 10;
                const spread = obj.style.shadowSpread ?? 0;
                el.style.boxShadow = `${inset}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${obj.style.shadowColor}`;
            } else {
                el.style.boxShadow = '';
            }

            if (this.ctx.host.runMode && parentDialog) {
                const isSidePanelRoot = parentDialog.className === 'TSidePanel' || parentDialog.constructor?.name === 'TSidePanel';
                const dialogZBase = parentDialog.zIndex
                    ? Number(parentDialog.zIndex)
                    : (isSidePanelRoot ? 100000 : 20000);
                if ((className === 'TDialogRoot' || className === 'TThemeDialog') || className === 'TSidePanel') {
                    el.style.zIndex = String(dialogZBase);
                } else {
                    el.style.zIndex = String(dialogZBase + 1);
                }
                el.dataset.dialogZ = el.style.zIndex;
            } else if (obj.zIndex !== undefined) {
                delete el.dataset.dialogZ;
                el.style.zIndex = String(obj.zIndex);
            } else if (obj.name && (obj.name.startsWith('Overlay') || obj.name.startsWith('Btn') || obj.name.startsWith('Input')) || obj.className === 'TStatusBar') {
                el.style.zIndex = '2000';
            }
        }

        if (className === 'TParallaxBackground') {
            // TParallaxBackground verwaltet seinen Hintergrund selbst (Design-Platzhalter / Ebenen)
        } else if (obj.showGrid && !this.ctx.host.runMode) {
            this.applyGridOverlay(el, obj);
        } else {
            this.applyBackground(el, obj, className, objId);
        }

        const hasTaskClick = (obj.Tasks && (obj.Tasks.onClick || obj.Tasks.onSingleClick || obj.Tasks.onMultiClick)) ||
            (obj.events && (obj.events.onClick || obj.events.onSingleClick || obj.events.onMultiClick));
        const isClickable = hasTaskClick || (this.ctx.host.runMode && className === 'TButton');

        if (this.ctx.host.runMode && isClickable) {
            el.style.cursor = 'pointer';
            el.onclick = (e) => {
                e.stopPropagation();
                const wasTouchStart = (el as any).__wasTouchStart;
                (el as any).__wasTouchStart = false;
                if (wasTouchStart) return;

                logger.debug(`Click on ${obj.name} (${obj.id}). Task: ${obj.events?.onClick || obj.Tasks?.onClick || 'none'}`);
                if (this.ctx.host.onEvent) {
                    this.ctx.host.onEvent(obj.id, 'onClick');
                }
            };
        } else if (this.ctx.host.runMode) {
            el.style.cursor = 'default';
            if (isNew) el.onclick = null;
        }

        if (this.ctx.host.runMode) {
            const hasMouseEnter = obj.events?.onMouseEnter || obj.Tasks?.onMouseEnter;
            const hasMouseLeave = obj.events?.onMouseLeave || obj.Tasks?.onMouseLeave;
            const hasDoubleClick = obj.events?.onDoubleClick || obj.Tasks?.onDoubleClick;

            if (hasMouseEnter) {
                el.onmouseenter = (e: MouseEvent) => {
                    e.stopPropagation();
                    if (this.ctx.host.onEvent) this.ctx.host.onEvent(obj.id, 'onMouseEnter');
                };
            } else if (isNew) {
                el.onmouseenter = null;
            }

            if (hasMouseLeave) {
                el.onmouseleave = (e: MouseEvent) => {
                    e.stopPropagation();
                    if (this.ctx.host.onEvent) this.ctx.host.onEvent(obj.id, 'onMouseLeave');
                };
            } else if (isNew) {
                el.onmouseleave = null;
            }

            if (hasDoubleClick) {
                el.ondblclick = (e: MouseEvent) => {
                    e.stopPropagation();
                    if (this.ctx.host.onEvent) this.ctx.host.onEvent(obj.id, 'onDoubleClick');
                };
            } else if (isNew) {
                el.ondblclick = null;
            }
        }

        if (this.ctx.host.runMode) {
            const hasDragStart = obj.events?.onDragStart || obj.Tasks?.onDragStart;
            const hasDragEnd = obj.events?.onDragEnd || obj.Tasks?.onDragEnd;
            const hasDrop = obj.events?.onDrop || obj.Tasks?.onDrop;

            const getDragData = (e: DragEvent) => {
                const rect = this.ctx.host.element.getBoundingClientRect();
                const cellSize = this.ctx.host.grid.cellSize;
                return {
                    x: Math.round((e.clientX - rect.left) / cellSize * 10) / 10,
                    y: Math.round((e.clientY - rect.top) / cellSize * 10) / 10
                };
            };

            if (hasDragStart || hasDragEnd) {
                el.draggable = true;
                if (hasDragStart) {
                    el.ondragstart = (e: DragEvent) => {
                        e.stopPropagation();
                        e.dataTransfer?.setData('text/plain', obj.id || obj.name || '');
                        if (this.ctx.host.onEvent) this.ctx.host.onEvent(obj.id, 'onDragStart', getDragData(e));
                    };
                } else if (isNew) {
                    el.ondragstart = null;
                }
                if (hasDragEnd) {
                    el.ondragend = (e: DragEvent) => {
                        e.stopPropagation();
                        if (this.ctx.host.onEvent) this.ctx.host.onEvent(obj.id, 'onDragEnd', getDragData(e));
                    };
                } else if (isNew) {
                    el.ondragend = null;
                }
            } else if (isNew) {
                el.draggable = false;
                el.ondragstart = null;
                el.ondragend = null;
            }

            if (hasDrop) {
                el.ondragover = (e: DragEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                };
                el.ondrop = (e: DragEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const sourceId = e.dataTransfer?.getData('text/plain');
                    if (this.ctx.host.onEvent) this.ctx.host.onEvent(obj.id, 'onDrop', { sourceId, ...getDragData(e) });
                };
            } else if (isNew) {
                el.ondrop = null;
                el.ondragover = null;
            }
        }

        if (this.ctx.host.runMode) {
            const hasTouchStart = obj.events?.onTouchStart || obj.Tasks?.onTouchStart;
            const hasTouchMove = obj.events?.onTouchMove || obj.Tasks?.onTouchMove;
            const hasTouchEnd = obj.events?.onTouchEnd || obj.Tasks?.onTouchEnd;

            const getPointerData = (e: PointerEvent) => {
                const rect = this.ctx.host.element.getBoundingClientRect();
                const cellSize = this.ctx.host.grid.cellSize;
                return {
                    x: Math.round((e.clientX - rect.left) / cellSize * 10) / 10,
                    y: Math.round((e.clientY - rect.top) / cellSize * 10) / 10,
                    pointerId: e.pointerId,
                    pointerType: e.pointerType
                };
            };

            if (hasTouchStart) {
                el.onpointerdown = (e: PointerEvent) => {
                    e.stopPropagation();
                    (el as any).__wasTouchStart = e.pointerType === 'touch';
                    if (e.pointerType !== 'touch') return;

                    el.setPointerCapture(e.pointerId);
                    el.style.touchAction = 'none';
                    if (this.ctx.host.onEvent) {
                        this.ctx.host.onEvent(obj.id, 'onTouchStart', getPointerData(e));
                    }
                };
            }

            if (hasTouchMove) {
                let moveThrottled = false;
                el.onpointermove = (e: PointerEvent) => {
                    if (e.pointerType !== 'touch') return;
                    if (moveThrottled) return;
                    moveThrottled = true;
                    requestAnimationFrame(() => {
                        moveThrottled = false;
                        if (this.ctx.host.onEvent) {
                            this.ctx.host.onEvent(obj.id, 'onTouchMove', getPointerData(e));
                        }
                    });
                };
            }

            if (hasTouchEnd) {
                el.onpointerup = (e: PointerEvent) => {
                    e.stopPropagation();
                    if (e.pointerType !== 'touch') return;
                    if (this.ctx.host.onEvent) {
                        this.ctx.host.onEvent(obj.id, 'onTouchEnd', getPointerData(e));
                    }
                };
            }
        }

        this.renderComponentContent(el, obj, className, isNew);

        this.ctx.updateSelectionState(el, objId);
    }

    public static collectAllIds(objs: any[]): Set<string> {
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

    public checkVisible(val: any): boolean {
        if (val === undefined || val === null) return true;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') {
            const clean = val.trim().toLowerCase();
            if (clean === 'false') return false;
            if (clean === 'true') return true;
        }
        return !!val;
    }

    public resolveDialogParent(obj: any): any {
        const isDialogLike = (o: any): boolean =>
            !!o && (o.className === 'TDialogRoot' || o.className === 'TThemeDialog' || o.className === 'TSidePanel'
                || o.constructor?.name === 'TDialogRoot' || o.constructor?.name === 'TThemeDialog');

        if (isDialogLike(obj)) return obj;

        let parentDialog: any = null;
        let currId = obj.parentId;
        let sanity = 0;
        while (currId && sanity++ < 20) {
            const p = this.ctx.objects.find((o: any) => (o.id || o.name) === currId);
            if (isDialogLike(p)) {
                parentDialog = p;
                break;
            }
            currId = p?.parentId;
        }
        return parentDialog;
    }

    private applyGridOverlay(el: HTMLElement, obj: any) {
        const cellSize = this.ctx.host.grid.cellSize;
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

    public applyBackground(el: HTMLElement, obj: any, className: string, objId: string) {
        const bgColor = obj.style?.backgroundColor || 'transparent';
        let bgImg = obj.backgroundImage || obj.src || obj.style?.backgroundImage;

        if (bgImg && typeof bgImg === 'string') {
            const vars = this.ctx.getVariableContext();
            const objects = [...(this.ctx.host.lastRenderedObjects || []), ...projectObjectRegistry.getObjects()];
            for (let i = 0; i < 3 && typeof bgImg === 'string' && bgImg.includes('${'); i++) {
                bgImg = PropertyHelper.interpolate(bgImg, vars, objects);
            }

            if (typeof bgImg !== 'string') {
                logger.warn(`[StageObjectRenderer] Resolved image src is not a string for ${objId} (${className}): ${bgImg}`);
                bgImg = String(bgImg ?? '');
            }
            if (bgImg.includes(',') && !bgImg.startsWith('data:')) {
                const first = bgImg.split(',')[0].trim();
                logger.warn(`[StageObjectRenderer] Resolved image src is a list for ${objId} (${className}); using first entry: ${first}`);
                bgImg = first;
            }

            if (bgImg.startsWith('url(')) {
                const match = bgImg.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (match) bgImg = match[1];
            }
        }

        if (this.ctx.host.runMode && !(el as any).runModeTraceDone) {
            (el as any).lastLoggedSrc = null;
            (el as any).runModeTraceDone = true;
        }

        if (bgImg && (className === 'TSprite' || className === 'TSpriteTemplate')) {
            el.style.background = bgColor;
            el.style.backgroundImage = 'none';
            const spriteFp = (el as any)._fp;
            if (spriteFp) spriteFp.bgImage = undefined;
        }

        if (bgImg) {
            if (this.ctx.host.runMode && !(el as any)._bgPathLogged) {
                logger.info(`%c[BG-PATH-DIAG] "${objId}" (${className}): raw bgImg="${String(bgImg).substring(0, 100)}" location.protocol="${window.location.protocol}" location.origin="${window.location.origin}"`, 'color: #ff6b6b; font-weight: bold');
                (el as any)._bgPathLogged = true;
            }
            let src = bgImg;
            if (!bgImg.startsWith('http') && !bgImg.startsWith('/') && !bgImg.startsWith('.') && !bgImg.startsWith('data:')) {
                if (bgImg.startsWith('images/') || bgImg.startsWith('audio/') || bgImg.startsWith('video/') || bgImg.startsWith('assets/')) {
                    src = './' + bgImg;
                } else {
                    src = `./images/${bgImg}`;
                }
            }

            if (src.startsWith('/images/') || src.startsWith('/audio/')) {
                src = '.' + src;
            }

            if (!src.startsWith('data:')) {
                const parts = src.split('/');
                const lastPart = parts.pop() || '';
                src = [...parts, encodeURIComponent(lastPart)].join('/');
            }

            src = dataUrlToBlobUrl(src);

            if ((el as any).lastLoggedSrc !== src) {
                logger.info(`%c[BG-PATH-DIAG] "${objId}" (${className}) FINAL path: "${src.substring(0, 150)}" runMode=${this.ctx.host.runMode}`, 'color: #ffa500; font-weight: bold');
                (el as any).lastLoggedSrc = src;
            }

            const fit = obj.objectFit || 'contain';
            const bgFp = ((el as any)._fp ||= {});
            if (bgFp.bgImage !== src) {
                bgFp.bgImage = src;
                el.style.backgroundImage = `url("${src}")`;
            }
            if (bgFp.bgFit !== fit) {
                bgFp.bgFit = fit;
                el.style.backgroundSize = fit;
                el.style.backgroundPosition = 'center';
                el.style.backgroundRepeat = 'no-repeat';
            }
            el.style.backgroundColor = bgColor;
        } else {
            if (className === 'TGroupPanel' && !this.ctx.host.runMode) {
                el.style.background = (bgColor && bgColor !== 'transparent') ? bgColor : 'rgba(255, 255, 255, 0.05)';
                if (!obj.style?.borderWidth || obj.style.borderWidth === 0 || obj.style.borderWidth === '0') {
                    el.style.border = '2px dashed rgba(0, 255, 128, 0.6)';
                }
            } else {
                el.style.background = bgColor;
            }
            const clearedFp = (el as any)._fp;
            if (clearedFp) clearedFp.bgImage = undefined;
        }
    }

    public renderComponentContent(el: HTMLElement, obj: any, className: string, isNew: boolean) {
        const ctx: IRenderContext = {
            host: this.ctx.host,
            scaleFontSize: this.ctx.scaleFontSize,
            updateSelectionState: this.updateSelectionState.bind(this)
        };
        const specialCtx: ISpecialComponentContext = {
            host: this.ctx.host,
            getVariableContext: this.ctx.getVariableContext
        };

        if (className === 'TCheckbox') InputRenderer.renderCheckbox(ctx, el, obj, isNew);
        else if (className === 'TNumberInput') InputRenderer.renderNumberInput(ctx, el, obj, isNew);
        else if (className === 'TEdit' || className === 'TTextInput') InputRenderer.renderTextInput(ctx, el, obj, isNew);
        else if (className === 'TGameCard') TextObjectRenderer.renderGameCard(ctx, el, obj, isNew);
        else if (className === 'TCard') TextObjectRenderer.renderCard(ctx, el, obj);
        else if (className === 'TButton') TextObjectRenderer.renderButton(ctx, el, obj, isNew);
        else if (className === 'TEmojiPicker') EmojiPickerRenderer.renderEmojiPicker(el, obj, this.ctx.host.grid.cellSize, this.ctx.host.onEvent?.bind(this.ctx.host));
        else if (className === 'TTetris') TetrisRenderer.renderTetris(el, obj);
        else if (className === 'TGridBoard') GridBoardRenderer.renderGridBoard(el, obj, this.ctx.host.onEvent?.bind(this.ctx.host));
        else if (className === 'TTable' || className === 'TObjectList') {
            if (!this.ctx.host.runMode) obj.setDataContext?.(this.ctx.objects);
            TableRenderer.renderTable(el, obj, this.ctx.host.onEvent?.bind(this.ctx.host), this.ctx.host.grid.cellSize);
        }
        else if (className === 'TDataList') ComplexComponentRenderer.renderDataList(ctx, el, obj);
        else if (className === 'TVirtualGamepad') VirtualGamepadRenderer.render(ctx, el, obj, className);
        else if (className === 'TStringVariable' || className === 'TObjectVariable' || className === 'TIntegerVariable' || className === 'TBooleanVariable' || className === 'TListVariable' || obj.isVariable || obj.isService) SystemComponentRenderer.render(ctx, el, obj, className);
        else if (className === 'TLabel' || className === 'TNumberLabel') TextObjectRenderer.renderLabel(ctx, el, obj);
        else if (className === 'TStickyNote') TextObjectRenderer.renderStickyNote(ctx, el, obj, isNew);
        else if (className === 'TPanel') TextObjectRenderer.renderPanel(ctx, el, obj);
        else if (className === 'TParallaxBackground') SpecialComponentRenderer.renderParallaxBackground(el, obj, this.ctx.host.grid.cellSize, this.ctx.host.runMode);
        else if (className === 'TRichText') TextObjectRenderer.renderRichText(ctx, el, obj);
        else if (className === 'TGameHeader') TextObjectRenderer.renderGameHeader(ctx, el, obj);
        else if (className === 'TSpawner') SpecialComponentRenderer.renderSpawner(el, obj);
        else if (className === 'TSpeedlines') SpecialComponentRenderer.renderSpeedlines(el, obj, this.ctx.host.grid.cellSize, this.ctx.host.runMode);
        else if (className === 'TSprite' || className === 'TSpriteTemplate') {
            SpriteRenderer.render(ctx, el, obj);
            if (className === 'TSprite') {
                this.ctx.animationPreviewManager.startSpriteAnimationPreview(el, obj, ctx, specialCtx);
            }
        }
        else if (className === 'TShape') ShapeRenderer.render(ctx, el, obj, isNew);
        else if (className === 'TInspectorTemplate') ComplexComponentRenderer.renderInspectorTemplate(ctx, el, obj);
        else if ((className === 'TDialogRoot' || className === 'TThemeDialog')) ComplexComponentRenderer.renderDialogRoot(ctx, el, obj);
        else if (className === 'TSidePanel') ComplexComponentRenderer.renderSidePanel(ctx, el, obj);
        else if (className === 'TInfoWindow') ComplexComponentRenderer.renderInfoWindow(ctx, el, obj, isNew);
        else if (className === 'TColorPicker') InputRenderer.renderColorPicker(ctx, el, obj, isNew);
        else if (className === 'TImageList') SpecialComponentRenderer.renderImageList(specialCtx, el, obj);
        else if (className === 'TAnimation') this.ctx.animationPreviewManager.renderAnimation(el, obj, specialCtx);
        else if (className === 'TVideo') SpecialComponentRenderer.renderVideo(specialCtx, el, obj);
        else if (className === 'TLink') SpecialComponentRenderer.renderLink(specialCtx, el, obj);
        else if (className === 'TDropdown') InputRenderer.renderDropdown(ctx, el, obj, isNew);
        else if (className !== 'TShape' && ('text' in obj || 'value' in obj)) TextObjectRenderer.renderLabel(ctx, el, obj);
    }

    public updateSelectionState(el: HTMLElement, id: string) {
        if (this.ctx.host.selectedIds.has(id)) {
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
}
