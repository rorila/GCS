import { GridConfig } from '../../../model/types';
import { PropertyHelper } from '../../../runtime/PropertyHelper';
import { getDialogSlideOffset } from './DialogSlide';

/**
 * Minimale Host-Schnittstelle für das Layout-Engine.
 * Verhindert Zirkel-Importe mit StageRenderer.ts.
 */
export interface StageLayoutHost {
    grid: GridConfig;
    runMode: boolean;
    lastRenderedObjects: any[];
}

// Referenz-CellSize für fontSize-Skalierung
const REFERENCE_CELL_SIZE = 20;

export class StageLayoutEngine {
    private host: StageLayoutHost;
    private getVariableContext: () => Record<string, any>;
    private alignStateMap = new Map<string, { lastAlign?: string; original?: { x: any; y: any; width: any; height: any }; computed?: { x: number; y: number; width: number; height: number } | null }>();

    constructor(host: StageLayoutHost, getVariableContext: () => Record<string, any>) {
        this.host = host;
        this.getVariableContext = getVariableContext;
    }

    /**
     * Skaliert eine fontSize relativ zur aktuellen cellSize.
     * Referenz ist cellSize=20 — dort entspricht die fontSize 1:1 dem Eingabewert.
     * Bei cellSize=10 → halbe fontSize, bei cellSize=30 → 1.5× fontSize.
     */
    public scaleFontSize(rawSize: number | string | undefined): string {
        if (!rawSize) return '';
        const numSize = typeof rawSize === 'string' ? parseFloat(rawSize) : rawSize;
        if (isNaN(numSize)) return typeof rawSize === 'string' ? rawSize : '';
        const scale = this.host.grid.cellSize / REFERENCE_CELL_SIZE;
        return `${Math.round(numSize * scale)}px`;
    }

    /**
     * Löst eine ggf. gebundene Eigenschaft (z.B. "${myVar}") in einen numerischen Wert auf.
     * Wenn keine Auflösung möglich ist, wird 0 zurückgegeben, damit das Layout nicht mit NaN bricht.
     */
    public getResolvedNumber(obj: any, prop: string, objects?: any[]): number {
        if (!obj) return 0;
        if (prop === 'x' && (obj.className === 'TSprite' || obj.constructor?.name === 'TSprite') && obj.renderX != null) return obj.renderX;
        if (prop === 'y' && (obj.className === 'TSprite' || obj.constructor?.name === 'TSprite') && obj.renderY != null) return obj.renderY;
        const vars = this.getVariableContext();
        const val = PropertyHelper.getResolvedPropertyValue(obj, prop, vars, objects);
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const num = Number(val);
            return isNaN(num) ? 0 : num;
        }
        return val ?? 0;
    }

    /**
     * Löst einen Style-Wert (z. B. opacity) auf, falls er ein Binding wie "${myVar}" ist.
     * Gibt ansonsten den Rohwert zurück.
     */
    public getResolvedStyleValue(obj: any, prop: string, objects?: any[]): any {
        if (!obj || !obj.style) return undefined;
        const raw = obj.style[prop];
        if (raw === undefined || raw === null) return undefined;
        if (typeof raw === 'string' && PropertyHelper.isBinding(raw)) {
            const vars = this.getVariableContext();
            const resolved = PropertyHelper.getResolvedPropertyValue(obj, `style.${prop}`, vars, objects);
            return resolved !== undefined ? resolved : raw;
        }
        return raw;
    }

    public getAlignState(obj: any) {
        const id = obj.id || obj.name;
        if (!id) return {};
        if (!this.alignStateMap.has(id)) {
            this.alignStateMap.set(id, {});
        }
        return this.alignStateMap.get(id)!;
    }

    /**
     * Returns the original width/height captured before alignment was applied.
     * Preserves binding expressions by resolving them from the persistent source object.
     */
    public getDesignDimension(obj: any, prop: 'width' | 'height', objects?: any[]): number {
        const alignState = this.getAlignState(obj);
        const raw = alignState.original?.[prop];
        if (raw !== undefined) {
            if (typeof raw === 'number') return raw;
            if (typeof raw === 'string' && PropertyHelper.isBinding(raw)) {
                const sourceObj = obj.__rawSource || obj;
                return this.getResolvedNumber(sourceObj, prop, objects);
            }
            const num = Number(raw);
            return isNaN(num) ? 0 : num;
        }
        return this.getResolvedNumber(obj, prop, objects);
    }

    /**
     * Returns the value to use for layout/positioning.
     * For aligned objects the last computed layout values are preferred so that
     * partial updates (updateSingleObject) keep the dock dimensions.
     */
    public getLayoutValue(obj: any, prop: 'x' | 'y' | 'width' | 'height', objects?: any[]): number {
        const alignState = this.getAlignState(obj);
        if (obj.align && obj.align !== 'NONE' && alignState.computed && alignState.computed[prop] !== undefined) {
            return alignState.computed[prop];
        }
        return this.getResolvedNumber(obj, prop, objects);
    }

    /**
     * Handles align transitions and computes geometry for a single object update
     * (used by updateSingleObject, where renderObjects is not invoked).
     */
    public handleSingleObjectAlign(obj: any, gridConfig: any, objects?: any[]): void {
        const newAlign = obj.align || 'NONE';
        const objId = obj.id || obj.name;
        if (!objId) return;
        const alignState = this.getAlignState(obj);
        const lastAlign = alignState.lastAlign;
        const sourceObj = obj.__rawSource || obj;

        if (newAlign === 'NONE' && !alignState.original) {
            alignState.original = {
                x: sourceObj.x,
                y: sourceObj.y,
                width: sourceObj.width,
                height: sourceObj.height
            };
        }

        if ((lastAlign === undefined || lastAlign === 'NONE') && newAlign !== 'NONE') {
            if (!alignState.original) {
                alignState.original = {
                    x: sourceObj.x,
                    y: sourceObj.y,
                    width: sourceObj.width,
                    height: sourceObj.height
                };
            }
        } else if (lastAlign !== undefined && lastAlign !== 'NONE' && newAlign === 'NONE') {
            const orig = alignState.original;
            if (orig) {
                const restore = (prop: string) => {
                    const origValue = (orig as any)[prop];
                    if (origValue === undefined) return;
                    const currentValue = (sourceObj as any)[prop];
                    if (typeof currentValue === 'string' && PropertyHelper.isBinding(currentValue)) return;
                    (sourceObj as any)[prop] = origValue;
                };
                restore('x');
                restore('y');
                restore('width');
                restore('height');
            }
            alignState.original = undefined;
            alignState.computed = null;
        }

        alignState.lastAlign = newAlign;

        if (newAlign === 'NONE') {
            alignState.computed = null;
            return;
        }

        const cellSize = gridConfig.cellSize;
        const stageWidth = gridConfig.cols * cellSize;
        const stageHeight = gridConfig.rows * cellSize;
        const isPixelBased = obj.className === 'TStatusBar';

        const origW = this.getDesignDimension(obj, 'width', objects);
        const origH = this.getDesignDimension(obj, 'height', objects);

        let actualW = isPixelBased ? origW : origW * cellSize;
        let actualH = isPixelBased ? origH : origH * cellSize;

        let left = 0;
        let top = 0;
        let width = 0;
        let height = 0;

        switch (newAlign) {
            case 'TOP':
                left = 0; top = 0; width = stageWidth; height = actualH; break;
            case 'BOTTOM':
                left = 0; top = stageHeight - actualH; width = stageWidth; height = actualH; break;
            case 'LEFT':
                left = 0; top = 0; width = actualW; height = stageHeight; break;
            case 'RIGHT':
                left = stageWidth - actualW; top = 0; width = actualW; height = stageHeight; break;
            case 'CLIENT':
                left = 0; top = 0; width = stageWidth; height = stageHeight; break;
        }

        alignState.computed = {
            x: isPixelBased ? left : left / cellSize,
            y: isPixelBased ? top : top / cellSize,
            width: isPixelBased ? width : width / cellSize,
            height: isPixelBased ? height : height / cellSize
        };
    }

    /**
     * 0. Detect align transitions and preserve/restore original geometry
     */
    public detectAlignTransitions(objects: any[]): void {
        objects.forEach(obj => {
            const newAlign = obj.align || 'NONE';
            const objId = obj.id || obj.name;
            if (!objId) return;
            const alignState = this.getAlignState(obj);
            const lastAlign = alignState.lastAlign;
            const sourceObj = obj.__rawSource || obj;

            if (newAlign === 'NONE' && !alignState.original) {
                alignState.original = {
                    x: sourceObj.x,
                    y: sourceObj.y,
                    width: sourceObj.width,
                    height: sourceObj.height
                };
            }

            if ((lastAlign === undefined || lastAlign === 'NONE') && newAlign !== 'NONE') {
                if (!alignState.original) {
                    alignState.original = {
                        x: sourceObj.x,
                        y: sourceObj.y,
                        width: sourceObj.width,
                        height: sourceObj.height
                    };
                }
            } else if (lastAlign !== undefined && lastAlign !== 'NONE' && newAlign === 'NONE') {
                const orig = alignState.original;
                if (orig) {
                    const restore = (prop: string) => {
                        const origValue = (orig as any)[prop];
                        if (origValue === undefined) return;
                        const currentValue = (sourceObj as any)[prop];
                        if (typeof currentValue === 'string' && PropertyHelper.isBinding(currentValue)) return;
                        (sourceObj as any)[prop] = origValue;
                        (obj as any)[prop] = origValue;
                    };
                    restore('x');
                    restore('y');
                    restore('width');
                    restore('height');
                }
                alignState.original = undefined;
                alignState.computed = null;
            }

            alignState.lastAlign = newAlign;
        });
    }

    /**
     * 1. Calculate dock positions and back-sync them to the object model.
     * Returns a map of docked object ids to their pixel geometry.
     */
    public calculateDockPositions(objects: any[], gridConfig: any): Map<string, { left: number, top: number, width: number, height: number }> {
        const stageWidth = gridConfig.cols * gridConfig.cellSize;
        const stageHeight = gridConfig.rows * gridConfig.cellSize;
        const dockArea = { left: 0, top: 0, right: stageWidth, bottom: stageHeight };
        const dockPositions = new Map<string, { left: number, top: number, width: number, height: number }>();

        objects.forEach(obj => {
            const align = obj.align || 'NONE';
            if (align === 'NONE' || align === 'CLIENT') return; // Skip CLIENT in first pass

            const objId = obj.id || obj.name;
            if (!objId) return;

            const objHeight = this.getDesignDimension(obj, 'height', objects) * gridConfig.cellSize;
            const objWidth = this.getDesignDimension(obj, 'width', objects) * gridConfig.cellSize;

            // SPECIAL CASE: TStatusBar defines height in pixels (e.g. 28), not grid units
            let actualHeight = objHeight;
            let actualWidth = objWidth;

            if (obj.className === 'TStatusBar') {
                actualHeight = this.getResolvedNumber(obj, 'height', objects); // Use pixels directly
                actualWidth = this.getResolvedNumber(obj, 'width', objects);
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
                if (!PropertyHelper.isBinding(obj.x)) obj.x = dockPos.left;
                if (!PropertyHelper.isBinding(obj.y)) obj.y = dockPos.top;
                if (!PropertyHelper.isBinding(obj.width)) obj.width = dockPos.width;
                if (!PropertyHelper.isBinding(obj.height)) obj.height = dockPos.height;
            } else {
                if (!PropertyHelper.isBinding(obj.x)) obj.x = dockPos.left / gridConfig.cellSize;
                if (!PropertyHelper.isBinding(obj.y)) obj.y = dockPos.top / gridConfig.cellSize;
                if (!PropertyHelper.isBinding(obj.width)) obj.width = dockPos.width / gridConfig.cellSize;
                if (!PropertyHelper.isBinding(obj.height)) obj.height = dockPos.height / gridConfig.cellSize;
            }

            const alignState = this.getAlignState(obj);
            alignState.computed = {
                x: isPixelBased ? dockPos.left : dockPos.left / gridConfig.cellSize,
                y: isPixelBased ? dockPos.top : dockPos.top / gridConfig.cellSize,
                width: isPixelBased ? dockPos.width : dockPos.width / gridConfig.cellSize,
                height: isPixelBased ? dockPos.height : dockPos.height / gridConfig.cellSize
            };
        });

        return dockPositions;
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

    /**
     * Positioniert ein einzelnes Objekt im DOM (für updateSingleObject).
     */
    public updateObjectPosition(el: HTMLElement, obj: any, className: string, isVisible: boolean): void {
        const grid = this.host.grid;
        if (!grid) return;
        const objects = this.host.lastRenderedObjects || [];
        const cellSize = grid.cellSize;
        const isPixelBased = className === 'TStatusBar';

        let absX = this.getLayoutValue(obj, 'x', objects);
        let absY = this.getLayoutValue(obj, 'y', objects);

        if (!obj.align || obj.align === 'NONE') {
            // For non-aligned objects, sum parent chain offsets
            let parentId = obj.parentId;
            let depth = 0;
            while (parentId && depth < 100) {
                const p = objects.find((o: any) => (o.id || o.name) === parentId);
                if (!p) break;
                absX += this.getResolvedNumber(p, 'x', objects);
                absY += this.getResolvedNumber(p, 'y', objects);
                parentId = p.parentId;
                depth++;
            }
        }

        const layoutW = this.getLayoutValue(obj, 'width', objects);
        const layoutH = this.getLayoutValue(obj, 'height', objects);

        const finalX = isPixelBased ? absX : absX * cellSize;
        const finalY = isPixelBased ? absY : absY * cellSize;
        const finalW = isPixelBased ? layoutW : layoutW * cellSize;
        const finalH = isPixelBased ? layoutH : layoutH * cellSize;

        // Determine if this object is a dialog or child of a dialog
        let parentDialog: any = null;
        if ((className === 'TDialogRoot' || className === 'TThemeDialog') || className === 'TSidePanel') {
            parentDialog = obj;
        } else if (obj.parentId) {
            let currId = obj.parentId;
            let sanity = 0;
            while (currId && sanity++ < 20) {
                const p = objects.find((o: any) => (o.id || o.name) === currId);
                if (p && ((p.className === 'TDialogRoot' || p.className === 'TThemeDialog') || p.className === 'TSidePanel' || p.constructor?.name === 'TDialogRoot' || p.constructor?.name === 'TThemeDialog')) {
                    parentDialog = p;
                    break;
                }
                currId = p?.parentId;
            }
        }

        const isDialogVisible = parentDialog
            ? this.checkVisible(parentDialog.visible) && this.checkVisible(parentDialog.style?.visible)
            : isVisible;

        if (this.host.runMode) {
            el.style.left = '0px';
            el.style.top = '0px';
            el.style.width = `${finalW}px`;
            el.style.height = `${finalH}px`;

            if (className === 'TVirtualGamepad') {
                (el.style as any).translate = 'none';
            } else if (parentDialog) {
                el.style.transition = 'translate 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease';
                if (isDialogVisible) {
                    (el.style as any).translate = `${finalX}px ${finalY}px`;
                    el.style.pointerEvents = 'auto';
                } else {
                    const outOfBounds = getDialogSlideOffset(parentDialog, cellSize);
                    (el.style as any).translate = `${finalX + outOfBounds}px ${finalY}px`;
                    el.style.pointerEvents = 'none';
                }
            } else {
                // Die Transition gehört waehrend einer CSS-Animation dem
                // AnimationManager; ein Reset wuerde sie sofort beenden.
                if (!(el as any)._cssAnimActive) {
                    el.style.transition = '';
                }
                (el.style as any).translate = `${finalX}px ${finalY}px`;
            }
        } else {
            el.style.left = `${finalX}px`;
            el.style.top = `${finalY}px`;
            el.style.width = `${finalW}px`;
            el.style.height = `${finalH}px`;
        }
    }
}
