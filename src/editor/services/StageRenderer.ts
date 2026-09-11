import { GridConfig } from '../../model/types';
import { Logger } from '../../utils/Logger';
import { themeRegistry } from '../../runtime/ThemeRegistry';
import { StageLayoutEngine } from './renderers/StageLayoutEngine';
import { StageAnimationPreviewManager } from './renderers/StageAnimationPreviewManager';
import { StageFastPathUpdater } from './renderers/StageFastPathUpdater';
import { StageObjectRenderer, ObjectRenderContext, DockRect } from './renderers/StageObjectRenderer';

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
    /** Optionale Referenz auf die aktive GameRuntime (nur im RunMode gesetzt) */
    runtime?: { getRawObject(id: string): any | undefined } | any;
    /** Liefert Variablenwerte für die Auflösung von ${...}-Bindings im Editor. */
    getVariableContext?(): Record<string, any>;
}

export class StageRenderer {
    private host: StageHost;
    private cachedVariableContext: Record<string, any> | undefined;
    private variableContextCached = false;
    private layoutEngine: StageLayoutEngine;
    private animationPreviewManager: StageAnimationPreviewManager;
    private fastPath: StageFastPathUpdater;
    private objectRenderer: StageObjectRenderer;
    private objectRenderContext: ObjectRenderContext;

    constructor(host: StageHost) {
        this.host = host;
        this.layoutEngine = new StageLayoutEngine(host, () => this.getVariableContext());
        this.animationPreviewManager = new StageAnimationPreviewManager(this.host);
        this.objectRenderContext = {
            host: this.host,
            objects: [],
            layoutEngine: this.layoutEngine,
            animationPreviewManager: this.animationPreviewManager,
            getVariableContext: () => this.getVariableContext(),
            scaleFontSize: (rawSize) => this.layoutEngine.scaleFontSize(rawSize),
            updateSelectionState: () => { /* wird nach Initialisierung ueberschrieben */ }
        };
        this.objectRenderer = new StageObjectRenderer(this.objectRenderContext);
        this.objectRenderContext.updateSelectionState = this.objectRenderer.updateSelectionState.bind(this.objectRenderer);
        this.fastPath = new StageFastPathUpdater(this.host, this.layoutEngine, this.objectRenderer.updateSelectionState.bind(this.objectRenderer));
    }

    private resetVariableContext(): void {
        this.variableContextCached = false;
        this.cachedVariableContext = undefined;
    }

    private getVariableContext(): Record<string, any> {
        if (!this.variableContextCached) {
            this.cachedVariableContext = this.host.getVariableContext ? this.host.getVariableContext() : {};
            this.variableContextCached = true;
        }
        return this.cachedVariableContext ?? {};
    }

    /**
     * Delegiert an StageLayoutEngine.
     */
    private scaleFontSize(rawSize: number | string | undefined): string {
        return this.layoutEngine.scaleFontSize(rawSize);
    }

    private getResolvedNumber(obj: any, prop: string, objects?: any[]): number {
        return this.layoutEngine.getResolvedNumber(obj, prop, objects);
    }

    private getResolvedStyleValue(obj: any, prop: string, objects?: any[]): any {
        return this.layoutEngine.getResolvedStyleValue(obj, prop, objects);
    }

    public renderObjects(objects: any[]) {
        if (!this.host || !this.host.element) return;

        this.resetVariableContext();
        this.fastPath.clearSpriteElementCache();
        this.fastPath.invalidateFastPathIndex();

        // Update object hash for internal bookkeeping
        const objectHash = objects.map(o => `${o.id}@${Number(this.getResolvedNumber(o, 'x', objects)).toFixed(1)},${Number(this.getResolvedNumber(o, 'y', objects)).toFixed(1)}`).join('|');

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

        // 0. Detect align transitions and preserve/restore original geometry
        this.layoutEngine.detectAlignTransitions(objects);

        // 1. Calculate dock positions (incl. CLIENT fill and back-sync)
        const dockPositions = this.layoutEngine.calculateDockPositions(objects, gridConfig) as Map<string, DockRect>;

        const currentIds = StageObjectRenderer.collectAllIds(objects);
        const renderedElements = Array.from(this.host.element.querySelectorAll('.game-object')) as HTMLElement[];

        // Remove elements that are no longer in the objects list
        renderedElements.forEach(el => {
            const id = el.getAttribute('data-id');
            if (id && !currentIds.has(id)) {
                el.remove();
            }
        });

        // Sort objects by zIndex for proper layer ordering
        const getDepth = (objId: string, visited = new Set<string>()): number => {
            if (!objId || visited.has(objId)) {
                if (visited.has(objId)) logger.error(`[StageRenderer] Cycle detected in getDepth for id: ${objId}`);
                return 0;
            }
            visited.add(objId);
            const o = objects.find(ox => (ox.id || ox.name) === objId);
            if (!o || !o.parentId) return 0;
            return 1 + getDepth(o.parentId, visited);
        };
        const sortedObjects = [...objects].sort((a, b) => {
            const zA = a.zIndex || 0;
            const zB = b.zIndex || 0;
            if (zA !== zB) return zA - zB;
            return getDepth(a.id || a.name) - getDepth(b.id || b.name);
        });

        // Update or Create elements
        this.objectRenderContext.objects = objects;
        sortedObjects.forEach((rawObj) => {
            const objId = rawObj.id || rawObj.name;
            if (!objId) return;

            let el = this.host.element.querySelector(`[data-id="${objId}"]`) as HTMLElement;
            let isNew = false;

            if (!el) {
                el = document.createElement('div');
                el.setAttribute('data-id', objId);
                el.style.position = 'absolute';
                el.style.boxSizing = 'border-box';
                el.style.overflow = 'hidden'; // Wichtig für border-radius + children!
                // Anti-Blink: Element startet unsichtbar, damit es nicht für
                // einen Frame bei Position (0,0) aufblitzt, bevor Transform und
                // Sichtbarkeit konfiguriert sind.
                el.style.display = 'none';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                el.style.userSelect = 'none';
                this.host.element.appendChild(el);
                isNew = true;
            }
            this.fastPath.cacheElement(objId, el);

            this.objectRenderer.render(el, rawObj, isNew, dockPositions, this.objectRenderContext);
        });

        // Stop running animation/sprite previews if their owning object is no longer selected
        this.animationPreviewManager.stopIfNotSelected(this.host.selectedIds);
    }

    /**
     * PERF-FAST-PATH: Schreibt ausschliesslich transform/opacity ins DOM.
     *
     * Animationen (z.B. der flip-Effekt) setzen diese beiden Werte bis zu 60x pro
     * Sekunde — und zwar auf dem Ziel UND allen seinen Kindern. Ueber
     * `updateSingleObject` haenge daran jedes Mal Theme-Merge, Align-Rechnung,
     * `applyBackground` und ein kompletter Inhalts-Rebuild.
     *
     * Bewusst NICHT an den Tween-Zustand gekoppelt: Der letzte Schreibzugriff einer
     * Animation (Reset auf '') erfolgt erst, wenn der Tween bereits entfernt ist.
     * Eine Kopplung wuerde genau diesen Reset verschlucken und das Objekt sichtbar
     * im Zwischenzustand stehen lassen.
     *
     * @returns true, wenn der Fast-Path angewendet wurde.
     */
    public updateObjectTransform(obj: any): boolean {
        return this.fastPath.updateObjectTransform(obj);
    }

    /**
     * PERF-FAST-PATH: Aktualisiert nur den Frame-Ausschnitt eines Sprites.
     * Ein Frame-Wechsel (imageIndex) benötigt lediglich eine neue backgroundPosition;
     * `updateSingleObject` würde dagegen Theme-Merge, Align und Layout neu berechnen.
     *
     * @returns true, wenn der Fast-Path angewendet wurde.
     */
    public updateSpriteFrame(obj: any): boolean {
        return this.fastPath.updateSpriteFrame(obj);
    }

    /**
     * DIRTY-FRAME FAST-PATH: Aktualisiert nur den Frame-Index (transform) für eine
     * Liste von Sprites, ohne SpriteRenderer.render() pro Sprite aufzurufen.
     */
    public updateSpriteFrames(objects: any[]): void {
        this.fastPath.updateSpriteFrames(objects);
    }

    /**
     * Targeted Rendering: Aktualisiert nur Eigenschaften eines spezifischen Nodes 
     * (wie Texte, Sichtbarkeit, Farben), ohne den DOM-Tree Layout-Thrashing zuzumuten!
     */
    public updateSingleObject(obj: any): void {
        if (!this.host || !this.host.element || !obj || !obj.id) return;

        // --- INJECT THEME STYLES ---
        const mergedStyle = themeRegistry.getMergedStyle(obj.className || 'TObject', obj.style);
        // Proxy statt Object.create: Style wird ueberlagert, SCHREIBENDE Zugriffe
        // (z.B. Eingabe in TEdit) landen aber weiterhin auf dem Originalobjekt.
        const themedObj = new Proxy(obj, {
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
        obj = themedObj;
        // ---------------------------

        const grid = this.host.grid;
        if (grid) {
            this.layoutEngine.handleSingleObjectAlign(obj, grid, this.host.lastRenderedObjects || []);
        }

        // SONDERFALL: Wenn das Objekt die Stage selbst ist (z.B. Hintergrund/Grid wird reaktiv geändert)
        if (obj.className === 'TStage' || obj.type === 'main' || obj.type === 'splash' || obj.type === 'blueprint' || obj.grid) {
            if (typeof (this.host as any).updategrid === 'function') {
                // Wir synchronisieren das Grid zurück zum Host und triggern den Update
                (this.host as any).gridConfig = obj.grid; // Host's interner Zustand aktualisieren
                (this.host as any).updategrid();          // Background auf das native Element anwenden
            }
            return;
        }

        const el = this.host.element.querySelector(`[data-id="${obj.id}"]`) as HTMLElement;
        if (!el) return;

        const className = obj.className || 'TObject';

        // 1. Sichtbarkeit syncen
        let isVisible = this.objectRenderer.checkVisible(obj.visible) && this.objectRenderer.checkVisible(obj.style?.visible);
        if (this.host.runMode && obj.isHiddenInRun) isVisible = false;
        
        if (!this.host.runMode && (!isVisible || obj.isHiddenInRun || obj.isService || obj.isBlueprintOnly)) {
            el.style.display = className === 'TRichText' ? 'block' : 'flex';
            el.classList.add('invisible-object-in-editor');
            if (className === 'TInfoWindow') logger.debug(`[VISIBILITY-DEBUG] StageRenderer.updateSingleObject (TInfoWindow ${obj.id}) - DESIGN MODE -> display: ${className === 'TRichText' ? 'block' : 'flex'} (invisible-object)`);
        } else {
            let finalDisplay = isVisible ? (className === 'TRichText' ? 'block' : 'flex') : 'none';
            if (this.host.runMode && ((className === 'TDialogRoot' || className === 'TThemeDialog') || className === 'TSidePanel')) {
                finalDisplay = className === 'TRichText' ? 'block' : 'flex'; // Niemals none, sonst bricht die Slide-Animation!
            }
            if (className === 'TInfoWindow') logger.debug(`[VISIBILITY-DEBUG] StageRenderer.updateSingleObject (TInfoWindow ${obj.id}) - RUN MODE -> isVisible=${isVisible}, setting finalDisplay=${finalDisplay}`);
            el.style.display = finalDisplay;
            el.classList.remove('invisible-object-in-editor');
        }

        // 2. Position & Groesse syncen
        this.resetVariableContext();
        this.layoutEngine.updateObjectPosition(el, obj, className, isVisible);

        // 3. Basiseigenschaften
        if (className !== 'TParallaxBackground') {
            this.objectRenderer.applyBackground(el, obj, className, obj.id);
        }

        if (obj.style) {
            if (obj.style.color !== undefined) el.style.color = obj.style.color;
            const resolvedOpacity = this.getResolvedStyleValue(obj, 'opacity');
            if (resolvedOpacity !== undefined) {
                el.style.opacity = String(resolvedOpacity);
            }
            if (obj.style.fontFamily !== undefined) el.style.fontFamily = obj.style.fontFamily;
            if (obj.style.fontWeight !== undefined) el.style.fontWeight = obj.style.fontWeight;
            if (obj.style.textShadow !== undefined) el.style.textShadow = obj.style.textShadow;
            if (obj.style.fontSize !== undefined) el.style.fontSize = this.scaleFontSize(obj.style.fontSize);
            // Waehrend einer CSS-Animation (siehe AnimationManager.runCssTransform)
            // liegt der aktuelle Transform nur am DOM, nicht im Modell. Ein
            // Zurueckschreiben wuerde die laufende Animation abbrechen.
            if (!(el as any)._cssAnimActive) {
                let tStr = (obj.style.transform !== undefined) ? obj.style.transform : '';
                if (obj.rotation) tStr += ` rotate(${obj.rotation}deg)`;
                el.style.transform = tStr.trim();
            }

            // Glow/Shadow-Effekt: Prio 1 = expliziter boxShadow CSS-String, Prio 2 = glowColor, Prio 3 = strukturierte Shadow-Parameter
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
            } else if (obj.style.boxShadow === '' || (!obj.style.glowColor && !obj.style.shadowColor)) {
                el.style.boxShadow = '';
            }

            if (obj.style.borderRadius !== undefined) el.style.borderRadius = typeof obj.style.borderRadius === 'number' ? `${obj.style.borderRadius}px` : obj.style.borderRadius;
            if (obj.style.borderColor !== undefined) el.style.borderColor = obj.style.borderColor;
            if (obj.style.borderWidth !== undefined) el.style.borderWidth = `${obj.style.borderWidth}px`;
            // zIndex muss auch bei Einzel-Updates (z.B. durch Bindvariable) am DOM gesetzt werden.
            // AUSNAHME: Dialoge/Side-Panels und deren Kinder haben eine eigene z-Basis
            // (data-dialog-z). obj.zIndex ist dort meist 0 (TWindow-Default) und wuerde
            // das Panel auf die Sprite-Ebene zurueckwerfen.
            if (el.dataset.dialogZ) {
                el.style.zIndex = el.dataset.dialogZ;
            } else if (obj.zIndex !== undefined) {
                el.style.zIndex = String(obj.zIndex);
            }
        } else if (obj.opacity !== undefined) {
            el.style.opacity = String(obj.opacity);
        }

        // 3. Inhalt (z.B. TLabel Text, Bilder)
        this.objectRenderer.renderComponentContent(el, obj, className, false);

        // 4. TVideo: _isPlaying-State auf das DOM-<video>-Element übertragen
        if (className === 'TVideo') {
            const videoEl = el.querySelector('video') as HTMLVideoElement | null;
            if (videoEl) {
                if (obj._isPlaying && videoEl.paused) videoEl.play().catch(() => {});
                else if (!obj._isPlaying && !videoEl.paused) videoEl.pause();
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // FAST PATH: Sprite-Positionen direkt im DOM aktualisieren
    // Wird 60×/sec vom GameLoopManager aufgerufen, OHNE volles Render.
    // Kein Dock-Recalc, kein Element-Create/Remove.
    // ─────────────────────────────────────────────────────────────────
    public updateSpritePositions(objects: any[]): void {
        this.resetVariableContext();
        this.fastPath.updateSpritePositions(objects);
    }
}
