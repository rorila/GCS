import { getDialogSlideOffset } from './DialogSlide';
import { SpriteGeometry } from '../../../runtime/SpriteGeometry';
import { SpriteRenderer } from './SpriteRenderer';
import { projectObjectRegistry } from '../../../services/registry/ObjectRegistry';
import { StageLayoutEngine } from './StageLayoutEngine';
import type { StageHost } from '../StageRenderer';

export class StageFastPathUpdater {
    private host: StageHost;
    private layoutEngine: StageLayoutEngine;
    private updateSelectionState: (el: HTMLElement, id: string) => void;

    private spriteElementCache: Map<string, HTMLElement> = new Map();
    /** Index-Caches fuer den 60fps-Fast-Path. Werden bei jedem renderObjects() invalidiert. */
    private fastPathObjectsRef: any[] | null = null;
    private fastPathById: Map<string, any> = new Map();
    private fastPathChildrenByParent: Map<string, any[]> = new Map();
    private fastPathDialogParent: Map<string, any> = new Map();
    /** PERF: Wiederverwendete Puffer fuer updateSpritePositions (kein Muell pro Frame). */
    private fastPathUpdateMap: Map<string, any> = new Map();
    private fastPathMergedBuffer: any[] = [];
    private fastPathKidBuffer: any[] = [];
    private fastPathAbsX: number = 0;
    private fastPathAbsY: number = 0;

    constructor(host: StageHost, layoutEngine: StageLayoutEngine, updateSelectionState: (el: HTMLElement, id: string) => void) {
        this.host = host;
        this.layoutEngine = layoutEngine;
        this.updateSelectionState = updateSelectionState;
    }

    public cacheElement(id: string, el: HTMLElement): void {
        this.spriteElementCache.set(id, el);
    }

    public clearSpriteElementCache(): void {
        this.spriteElementCache.clear();
    }

    /**
     * PERF: Liefert das DOM-Element einer Objekt-ID aus dem Cache.
     * Vermeidet `querySelector` in den 60fps-Pfaden (Frame- und Positions-Update).
     */
    public getCachedElement(objId: string | undefined): HTMLElement | null {
        if (!objId || !this.host || !this.host.element) return null;
        const cached = this.spriteElementCache.get(objId);
        if (cached && cached.isConnected && cached.getAttribute('data-id') === objId) {
            return cached;
        }
        const el = this.host.element.querySelector(`[data-id="${objId}"]`) as HTMLElement | null;
        if (el) this.spriteElementCache.set(objId, el);
        return el;
    }

    /** Verwirft die Fast-Path-Indizes; wird bei jedem vollen Render aufgerufen. */
    public invalidateFastPathIndex(): void {
        this.fastPathObjectsRef = null;
        this.fastPathById.clear();
        this.fastPathChildrenByParent.clear();
        this.fastPathDialogParent.clear();
    }

    /**
     * PERF: Baut Id- und Parent-Indizes einmalig auf, statt in jedem Frame
     * `Array.find`/`Array.filter` ueber alle Stage-Objekte laufen zu lassen.
     */
    public ensureFastPathIndex(allObjects: any[]): void {
        if (this.fastPathObjectsRef === allObjects && this.fastPathById.size > 0) return;

        this.fastPathObjectsRef = allObjects;
        this.fastPathById.clear();
        this.fastPathChildrenByParent.clear();
        this.fastPathDialogParent.clear();

        for (const o of allObjects) {
            const id = o?.id || o?.name;
            if (id && !this.fastPathById.has(id)) this.fastPathById.set(id, o);
            if (o?.parentId) {
                const siblings = this.fastPathChildrenByParent.get(o.parentId);
                if (siblings) siblings.push(o);
                else this.fastPathChildrenByParent.set(o.parentId, [o]);
            }
        }
    }

    /**
     * Ermittelt den Dialog-/SidePanel-Vorfahren eines Objekts.
     * Die Baumstruktur aendert sich zwischen zwei vollen Renders nicht, daher
     * wird das Ergebnis gecacht (der `visible`-Zustand wird weiterhin live gelesen).
     */
    public resolveDialogParent(obj: any, lookupObject: (id: string) => any): any {
        const isDialogLike = (o: any): boolean =>
            !!o && (o.className === 'TDialogRoot' || o.className === 'TThemeDialog' || o.className === 'TSidePanel'
                || o.constructor?.name === 'TDialogRoot' || o.constructor?.name === 'TThemeDialog');

        if (obj.className === 'TDialogRoot' || obj.className === 'TThemeDialog' || obj.className === 'TSidePanel') {
            return obj;
        }

        const objId = obj.id || obj.name;
        if (objId && this.fastPathDialogParent.has(objId)) {
            return this.fastPathDialogParent.get(objId);
        }

        let parentDialog: any = null;
        let currId = obj.parentId;
        let sanity = 0;
        while (currId && sanity++ < 20) {
            const p = lookupObject(currId);
            if (isDialogLike(p)) {
                parentDialog = p;
                break;
            }
            currId = p?.parentId;
        }

        if (objId) this.fastPathDialogParent.set(objId, parentDialog);
        return parentDialog;
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
     * PERF-FAST-PATH: Schreibt ausschliesslich transform/opacity ins DOM.
     *
     * @returns true, wenn der Fast-Path angewendet wurde.
     */
    public updateObjectTransform(obj: any): boolean {
        if (!this.host || !this.host.element || !obj || !obj.id) return false;

        const el = this.getCachedElement(obj.id);
        if (!el) return false;

        const fp = ((el as any)._fp ||= {});

        // Waehrend einer CSS-Animation gehoert der Transform dem AnimationManager.
        if (!(el as any)._cssAnimActive) {
            let transformStr = (obj.style && obj.style.transform !== undefined) ? obj.style.transform : '';
            if (obj.rotation) {
                transformStr += ` rotate(${obj.rotation}deg)`;
            }
            transformStr = transformStr.trim();
            if (fp.transform !== transformStr) {
                fp.transform = transformStr;
                el.style.transform = transformStr;
            }
        }

        if (obj.style && obj.style.opacity !== undefined) {
            const resolved = this.layoutEngine.getResolvedStyleValue(obj, 'opacity');
            if (resolved !== undefined) {
                const opacityValue = String(resolved);
                if (fp.opacity !== opacityValue) {
                    fp.opacity = opacityValue;
                    el.style.opacity = opacityValue;
                }
            }
        } else if (obj.opacity !== undefined) {
            const opacityValue = String(obj.opacity);
            if (fp.opacity !== opacityValue) {
                fp.opacity = opacityValue;
                el.style.opacity = opacityValue;
            }
        }

        return true;
    }

    /**
     * PERF-FAST-PATH: Aktualisiert nur den Frame-Ausschnitt eines Sprites.
     *
     * @returns true, wenn der Fast-Path angewendet wurde.
     */
    public updateSpriteFrame(obj: any): boolean {
        if (!this.host || !this.host.element || !obj || !obj.id) return false;
        if (obj.className !== 'TSprite' && obj.className !== 'TSpriteTemplate') return false;

        const el = this.getCachedElement(obj.id);
        if (!el) return false;

        const ctx = {
            host: this.host,
            scaleFontSize: this.layoutEngine.scaleFontSize.bind(this.layoutEngine),
            updateSelectionState: this.updateSelectionState
        };

        SpriteRenderer.render(ctx, el, obj);
        return true;
    }

    /**
     * DIRTY-FRAME FAST-PATH: Aktualisiert nur den Frame-Index (transform) für eine
     * Liste von Sprites, ohne SpriteRenderer.render() pro Sprite aufzurufen.
     */
    public updateSpriteFrames(objects: any[]): void {
        const ctx = {
            host: this.host,
            scaleFontSize: this.layoutEngine.scaleFontSize.bind(this.layoutEngine),
            updateSelectionState: this.updateSelectionState
        };

        for (const obj of objects) {
            if (!obj || !obj.id) continue;
            if (obj.className !== 'TSprite' && obj.className !== 'TSpriteTemplate') continue;

            const el = this.getCachedElement(obj.id);
            if (!el) continue;

            const imgEl = el.querySelector('.sprite-image-layer') as HTMLElement;
            const sheetEl = imgEl ? imgEl.querySelector('.sprite-sheet-layer') as HTMLElement : null;
            if (!imgEl || !sheetEl) {
                SpriteRenderer.render(ctx, el, obj);
                continue;
            }

            const appearanceMode = obj.appearanceMode || (obj.animationId ? 'animation' : (obj.imageListId ? 'spritesheet' : (obj.videoSource ? 'video' : (obj.backgroundImage ? 'simple' : 'simple'))));
            if (appearanceMode !== 'animation' && appearanceMode !== 'spritesheet') {
                SpriteRenderer.render(ctx, el, obj);
                continue;
            }

            let imageListId = obj.imageListId || '';
            if (appearanceMode === 'animation' && obj.animationId) {
                const animObj = this.host.lastRenderedObjects.find((o: any) =>
                    (o.name === obj.animationId || o.id === obj.animationId) &&
                    (o.className === 'TAnimation' || o.constructor?.name === 'TAnimation')
                ) || projectObjectRegistry.getObjects().find((o: any) =>
                    (o.name === obj.animationId || o.id === obj.animationId) &&
                    (o.className === 'TAnimation' || o.constructor?.name === 'TAnimation')
                );
                if (animObj) imageListId = animObj.imageListId || '';
            }

            if (!imageListId) {
                SpriteRenderer.render(ctx, el, obj);
                continue;
            }

            const imageListObj = this.host.lastRenderedObjects.find((o: any) =>
                (o.name === imageListId || o.id === imageListId) &&
                (o.className === 'TImageList' || o.constructor?.name === 'TImageList')
            ) || projectObjectRegistry.getObjects().find((o: any) =>
                (o.name === imageListId || o.id === imageListId) &&
                (o.className === 'TImageList' || o.constructor?.name === 'TImageList')
            );

            if (!imageListObj) {
                SpriteRenderer.render(ctx, el, obj);
                continue;
            }

            const hCount = imageListObj.imageCountHorizontal || 1;
            const vCount = imageListObj.imageCountVertical || 1;
            const sheetKey = `${hCount}x${vCount}`;

            const rawIndex = appearanceMode === 'animation'
                ? (obj.imageIndex !== undefined && obj.imageIndex >= 0 ? obj.imageIndex : 0)
                : (obj.imageIndex !== undefined && obj.imageIndex >= 0 ? obj.imageIndex : (imageListObj.currentImageNumber || 0));
            const currentFrame = Math.max(0, Math.min(rawIndex, (hCount * vCount) - 1));
            const col = currentFrame % hCount;
            const row = Math.floor(currentFrame / hCount);

            const { tx, ty } = SpriteGeometry.frameOffsetPercent(col, row, hCount, vCount);

            const cache = sheetEl as any;
            const poolSize = Number(obj.poolSize) || 1;
            const promote = appearanceMode === 'animation' && hCount * vCount <= 12 && poolSize <= 8;
            const transform = promote ? `translate3d(${tx}%, ${ty}%, 0)` : `translate(${tx}%, ${ty}%)`;

            if (cache._imageListId !== imageListId && cache._imageListId !== undefined) {
                SpriteRenderer.render(ctx, el, obj);
                continue;
            }
            if (cache._sheetKey !== sheetKey && cache._sheetKey !== undefined) {
                SpriteRenderer.render(ctx, el, obj);
                continue;
            }

            cache._imageListId = imageListId;
            cache._sheetKey = sheetKey;

            if (cache._transform !== transform) {
                cache._transform = transform;
                sheetEl.style.transform = transform;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // FAST PATH: Sprite-Positionen direkt im DOM aktualisieren
    // Wird 60×/sec vom GameLoopManager aufgerufen, OHNE volles Render.
    // Kein Dock-Recalc, kein Element-Create/Remove.
    // ─────────────────────────────────────────────────────────────────
    public updateSpritePositions(objects: any[]): void {
        const cellSize = this.host.grid.cellSize;
        const allObjects = this.host.lastRenderedObjects || [];
        this.ensureFastPathIndex(allObjects);

        const objectsToUpdateMap = this.fastPathUpdateMap;
        objectsToUpdateMap.clear();

        // 1. Zuerst die primär animierten Original-Objekte (aus dem GameRuntime) aufnehmen
        for (const obj of objects) {
            if (obj && (obj.id || obj.name)) {
                objectsToUpdateMap.set(obj.id || obj.name, obj);
            }
        }

        // 2. Kinder ueber den vorberechneten Parent-Index sammeln (statt O(n^2) filter)
        const collectChildren = (parentId: string, out: any[], depth: number): void => {
            if (depth > 100) return;
            const kids = this.fastPathChildrenByParent.get(parentId);
            if (!kids) return;
            for (const k of kids) {
                out.push(k);
                const kId = k.id || k.name;
                if (kId) collectChildren(kId, out, depth + 1);
            }
        };

        // 3. Auch alle Kinder in den Update-Zyklus einbeziehen, damit sie sich
        // synchron mit ihren animierten Containern mitbewegen.
        const kidBuffer = this.fastPathKidBuffer;
        for (const obj of objects) {
            if (!obj.id && !obj.name) continue;
            kidBuffer.length = 0;
            collectChildren(obj.id || obj.name, kidBuffer, 0);
            for (const k of kidBuffer) {
                const kId = k.id || k.name;
                // Originale (aktiv animierte) haben Vorrang! Überschreibe keine bestehenden Einträge.
                if (kId && !objectsToUpdateMap.has(kId)) {
                    objectsToUpdateMap.set(kId, k);
                }
            }
        }

        const mergedObjectsArray = this.fastPathMergedBuffer;
        mergedObjectsArray.length = 0;
        for (const value of objectsToUpdateMap.values()) {
            mergedObjectsArray.push(value);
        }

        /** Parent-Lookup: bevorzugt die aktuell animierten Objekte, sonst der Stage-Index. */
        const lookupObject = (id: string): any =>
            objectsToUpdateMap.get(id) || this.fastPathById.get(id);

        // Helfer, um absolute Position eines Objekts zu berechnen (Parent-Chain).
        const accumulateAbsPos = (obj: any): void => {
            let absX = this.layoutEngine.getResolvedNumber(obj, 'x', mergedObjectsArray);
            let absY = this.layoutEngine.getResolvedNumber(obj, 'y', mergedObjectsArray);
            let curr = obj.parentId;
            let depth = 0;
            while (curr && depth < 100) {
                const p = lookupObject(curr);
                if (p) {
                    absX += this.layoutEngine.getResolvedNumber(p, 'x', mergedObjectsArray);
                    absY += this.layoutEngine.getResolvedNumber(p, 'y', mergedObjectsArray);
                    curr = p.parentId;
                } else {
                    break;
                }
                depth++;
            }
            this.fastPathAbsX = absX;
            this.fastPathAbsY = absY;
        };

        for (const obj of mergedObjectsArray) {
            const el = this.getCachedElement(obj.id);
            if (!el) continue;
            const fp = ((el as any)._fp ||= {});

            // Rekursive Parent-Positionierung berücksichtigen!
            accumulateAbsPos(obj);
            const transX = this.fastPathAbsX * cellSize;
            const transY = this.fastPathAbsY * cellSize;

            let finalTransX = transX;
            let finalTransY = transY;

            if (this.host.runMode) {
                // ── Sichtbarkeits-Sync (Pool-Sprites) ──
                let isVisible = this.checkVisible(obj.visible) && this.checkVisible(obj.style?.visible);
                if (obj.isHiddenInRun) isVisible = false;

                const isFromBlueprint = !!obj.isFromBlueprint;
                const isBlueprintOnly = !!obj.isBlueprintOnly;
                const isService = !!obj.isService;
                if (!this.host.isBlueprint) {
                    if (isFromBlueprint && (isService || isBlueprintOnly)) {
                        isVisible = false;
                    }
                } else {
                    if (isFromBlueprint || isService || isBlueprintOnly) {
                        isVisible = true;
                    }
                }

                // Feststellen, ob es zum Dialog-Zweig gehört (Ergebnis wird gecacht)
                const parentDialog = this.resolveDialogParent(obj, lookupObject);

                // Display
                const displayValue = (isVisible || parentDialog)
                    ? (obj.className === 'TRichText' ? 'block' : 'flex')
                    : 'none';
                if (fp.display !== displayValue) {
                    fp.display = displayValue;
                    el.style.display = displayValue;
                }

                // GPU Compositing: Native CSS translate Property
                let translateValue: string;
                if (obj.className === 'TVirtualGamepad') {
                    translateValue = 'none';
                } else if (parentDialog) {
                    if (this.checkVisible(parentDialog.visible) && this.checkVisible(parentDialog.style?.visible)) {
                        translateValue = `${finalTransX}px ${finalTransY}px`;
                    } else {
                        const outOfBoundsOffset = getDialogSlideOffset(parentDialog, cellSize);
                        translateValue = `${finalTransX + outOfBoundsOffset}px ${finalTransY}px`;
                    }
                } else {
                    translateValue = `${finalTransX}px ${finalTransY}px`;
                }
                if (fp.translate !== translateValue) {
                    fp.translate = translateValue;
                    (el.style as any).translate = translateValue;
                }

                let transformStr = (obj.style && obj.style.transform !== undefined) ? obj.style.transform : '';
                if (obj.rotation) {
                    transformStr += ` rotate(${obj.rotation}deg)`;
                }
                transformStr = transformStr.trim();
                if (fp.transform !== transformStr) {
                    fp.transform = transformStr;
                    el.style.transform = transformStr;
                }

                if (obj.style && obj.style.opacity !== undefined) {
                    const resolvedOpacity = this.layoutEngine.getResolvedStyleValue(obj, 'opacity', mergedObjectsArray);
                    if (resolvedOpacity !== undefined) {
                        const opacityValue = String(resolvedOpacity);
                        if (fp.opacity !== opacityValue) {
                            fp.opacity = opacityValue;
                            el.style.opacity = opacityValue;
                        }
                    }
                } else if (obj.opacity !== undefined) {
                    const opacityValue = String(obj.opacity);
                    if (fp.opacity !== opacityValue) {
                        fp.opacity = opacityValue;
                        el.style.opacity = opacityValue;
                    }
                }

                // Größen-Sync (für grow/shrink Animationen)
                if (obj.width !== undefined) {
                    const widthValue = `${this.layoutEngine.getResolvedNumber(obj, 'width', mergedObjectsArray) * cellSize}px`;
                    if (fp.width !== widthValue) {
                        fp.width = widthValue;
                        el.style.width = widthValue;
                    }
                }
                if (obj.height !== undefined) {
                    const heightValue = `${this.layoutEngine.getResolvedNumber(obj, 'height', mergedObjectsArray) * cellSize}px`;
                    if (fp.height !== heightValue) {
                        fp.height = heightValue;
                        el.style.height = heightValue;
                    }
                }

            } else {
                // Fallback Layout für Inspektion
                if (obj.x !== undefined) el.style.left = `${transX}px`;
                if (obj.y !== undefined) el.style.top = `${transY}px`;

                if (obj.style) {
                    let tStr = (obj.style.transform !== undefined) ? obj.style.transform : '';
                    if (obj.rotation) tStr += ` rotate(${obj.rotation}deg)`;
                    if (tStr.trim()) el.style.transform = tStr.trim();
                    const resolvedOpacity = this.layoutEngine.getResolvedStyleValue(obj, 'opacity', mergedObjectsArray);
                    if (resolvedOpacity !== undefined) {
                        el.style.opacity = String(resolvedOpacity);
                    }
                } else if (obj.opacity !== undefined) {
                    el.style.opacity = String(obj.opacity);
                }
            }
        }
    }
}
