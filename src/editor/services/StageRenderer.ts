import { GridConfig } from '../../model/types';
import { Logger } from '../../utils/Logger';
import { EmojiPickerRenderer } from './EmojiPickerRenderer';
import { TableRenderer } from './TableRenderer';

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

export class StageRenderer {
    private host: StageHost;

    constructor(host: StageHost) {
        this.host = host;
    }

    public renderObjects(objects: any[]) {
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
                    console.table(objects.slice(0, 20).map(o => ({
                        name: o.name,
                        class: o.className || o.constructor?.name,
                        visible: o.visible,
                        isVar: o.isVariable || false,
                        scope: o.scope || '-',
                        value: o.isVariable ? JSON.stringify(o.value)?.substring(0, 80) : '-',
                        text: typeof o.text === 'string' ? o.text.substring(0, 60) : '-'
                    })));
                } else {
                    console.warn("[StageRenderer] Rendering an EMPTY stage in RunMode!");
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
                el.style.display = 'flex';
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
                finalX = (obj.x || 0) * gridConfig.cellSize;
                finalY = (obj.y || 0) * gridConfig.cellSize;
                finalW = (obj.width || 0) * gridConfig.cellSize;
                finalH = (obj.height || 0) * gridConfig.cellSize;
            }

            el.style.left = `${finalX}px`;
            el.style.top = `${finalY}px`;
            el.style.width = `${finalW}px`;
            el.style.height = `${finalH}px`;

            // NOTE: CSS transitions für Sprites wurden entfernt.
            // Direkte DOM-Updates über updateSpritePositions() ersetzen sie für flüssigere 60fps Bewegung.

            if (this.host.runMode) {
                // Log all objects in Run-Mode to trace layout issues
                const isMetric = obj.name?.includes('Metric') || obj.id?.includes('metric');
                if (isMetric || obj.id === 'dash_title' || obj.id === 'dash_back_btn' || obj.name?.includes('Button') || (obj.name && obj.name.includes('Emoji'))) {
                    logger.info(`%c[Layout:${this.host.element.id}] ${obj.name || obj.id} (RUN): align=${obj.align}, x=${obj.x}, y=${obj.y}, w=${obj.width}, cellSize=${gridConfig.cellSize} -> left=${finalX}, top=${finalY}`, 'color: #ff00ff; font-weight: bold');
                }
            }

            let isVisible = this.checkVisible(obj.visible) && this.checkVisible(obj.style?.visible);

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

            el.style.display = isVisible ? 'flex' : 'none';

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
            if (opacity !== undefined && opacity !== null) {
                el.style.opacity = String(opacity);
            } else if (isInherited && !this.host.runMode) {
                el.style.opacity = '0.4';
            } else {
                el.style.opacity = '1';
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
                if (obj.style.fontSize) el.style.fontSize = typeof obj.style.fontSize === 'number' ? `${obj.style.fontSize}px` : obj.style.fontSize;
                if (obj.style.fontWeight) el.style.fontWeight = obj.style.fontWeight;
                if (obj.style.borderRadius) el.style.borderRadius = typeof obj.style.borderRadius === 'number' ? `${obj.style.borderRadius}px` : obj.style.borderRadius;

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
                    console.log(`[StageRenderer] Click on ${obj.name} (${obj.id}). Task: ${obj.events?.onClick || obj.Tasks?.onClick || 'none'}`);
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
                console.log(`[StageRenderer] Component "${objId}" (${className}) setting image: "${src}"`);
                (el as any).lastLoggedSrc = src;
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

    private renderComponentContent(el: HTMLElement, obj: any, className: string, isNew: boolean) {
        if (className === 'TCheckbox') {
            this.renderCheckbox(el, obj, isNew);
        } else if (className === 'TNumberInput') {
            this.renderNumberInput(el, obj, isNew);
        } else if (className === 'TEdit' || className === 'TTextInput') {
            this.renderTextInput(el, obj, isNew);
        } else if (className === 'TGameCard') {
            this.renderGameCard(el, obj, isNew);
        } else if (className === 'TButton') {
            this.renderButton(el, obj, isNew);
        } else if (className === 'TEmojiPicker') {
            this.renderEmojiPickerInternal(el, obj);
        } else if (className === 'TTable' || className === 'TObjectList') {
            StageRenderer.renderTable(el, obj, this.host.onEvent?.bind(this.host), this.host.grid.cellSize);
        } else if (className === 'TDataList') {
            this.renderDataList(el, obj);
        } else if (className === 'TStringVariable' || className === 'TObjectVariable' || className === 'TIntegerVariable' || className === 'TBooleanVariable' || className === 'TListVariable' || obj.isVariable || obj.isService) {
            this.renderSystemComponent(el, obj, className);
        } else if (className === 'TLabel' || className === 'TNumberLabel') {
            this.renderLabel(el, obj);
        } else if (className === 'TPanel') {
            this.renderPanel(el, obj);
        } else if (className === 'TGameHeader') {
            this.renderGameHeader(el, obj);
        } else if (className === 'TSprite') {
            this.renderSprite(el, obj);
        } else if (className === 'TShape') {
            this.renderShape(el, obj, isNew);
        } else if (className === 'TInspectorTemplate') {
            this.renderInspectorTemplate(el, obj);
        } else if (className === 'TDialogRoot') {
            this.renderDialogRoot(el, obj);
        } else if (className !== 'TShape' && ('text' in obj || 'value' in obj)) {
            // Fallback for generic text objects
            this.renderLabel(el, obj);
        }
    }

    private renderCheckbox(el: HTMLElement, obj: any, isNew: boolean) {
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

            const textSpan = document.createElement('span');
            textSpan.className = 'checkbox-label';

            label.appendChild(input);
            label.appendChild(textSpan);
            el.appendChild(label);
        }

        const input = el.querySelector('input') as HTMLInputElement;
        const textSpan = el.querySelector('.checkbox-label') as HTMLElement;

        if (input) {
            if (this.host.runMode) {
                input.onchange = () => {
                    obj.checked = input.checked;
                };
            }
            input.checked = !!obj.checked;
        }
        if (textSpan) {
            textSpan.innerText = obj.label || obj.name;
            textSpan.style.color = obj.style?.color || '#000000';
            textSpan.style.fontSize = obj.style?.fontSize ? (typeof obj.style.fontSize === 'number' ? `${obj.style.fontSize}px` : obj.style.fontSize) : '14px';
            const fw = obj.style?.fontWeight;
            textSpan.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';
            const fs = obj.style?.fontStyle;
            textSpan.style.fontStyle = (fs === true || fs === 'italic') ? 'italic' : 'normal';
            if (obj.style?.fontFamily) textSpan.style.fontFamily = obj.style.fontFamily;
        }
    }

    private renderNumberInput(el: HTMLElement, obj: any, isNew: boolean) {
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
            el.appendChild(input);
        }
        const input = el.querySelector('input') as HTMLInputElement;
        if (input) {
            if (this.host.runMode) {
                input.oninput = () => {
                    obj.value = parseFloat(input.value);
                };
            }

            if (parseFloat(input.value) !== obj.value) input.value = String(obj.value || 0);
            if (obj.min !== undefined && obj.min !== -Infinity) input.min = String(obj.min);
            if (obj.max !== undefined && obj.max !== Infinity) input.max = String(obj.max);
            if (obj.step !== undefined) input.step = String(obj.step);

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
    }

    private renderTextInput(el: HTMLElement, obj: any, isNew: boolean) {
        const isInput = !this.host.runMode || obj.className === 'TTextInput' || obj.className === 'TEdit';
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
                el.appendChild(input);
            }
            const input = el.querySelector('input') as HTMLInputElement;
            if (input) {
                if (this.host.runMode) {
                    input.oninput = () => {
                        let val = input.value;
                        if (obj.uppercase) val = val.toUpperCase();
                        obj.text = val;
                        input.value = val;
                    };
                }
                if (input.value !== (obj.text || '')) input.value = obj.text || '';
                input.placeholder = obj.placeholder || '';
                input.style.color = obj.style?.color || '#000000';
                input.style.backgroundColor = obj.style?.backgroundColor || 'transparent';
                input.style.textAlign = obj.style?.textAlign || 'left';
                input.style.fontSize = obj.style?.fontSize ? (typeof obj.style.fontSize === 'number' ? `${obj.style.fontSize}px` : obj.style.fontSize) : 'inherit';
                const fw = obj.style?.fontWeight;
                input.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';
                const fs = obj.style?.fontStyle;
                input.style.fontStyle = (fs === true || fs === 'italic') ? 'italic' : 'normal';
                if (obj.style?.fontFamily) input.style.fontFamily = obj.style.fontFamily;
            }
        } else {
            el.innerText = obj.text || obj.placeholder || 'Enter text...';
        }
    }

    private renderGameCard(el: HTMLElement, obj: any, isNew: boolean) {
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
                if (this.host.onEvent) this.host.onEvent(obj.id, 'onSingleClick');
            });
            el.querySelector('.btn-multi')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.host.onEvent) this.host.onEvent(obj.id, 'onMultiClick');
            });
        }
        const titleEl = el.querySelector('.card-title') as HTMLElement;
        if (titleEl && titleEl.innerText !== obj.gameName) titleEl.innerText = obj.gameName;
    }

    private renderButton(el: HTMLElement, obj: any, _isNew: boolean) {
        if (el.querySelector('.table-title-bar')) el.innerHTML = '';
        if (el.innerText !== (obj.caption || obj.name)) el.innerText = obj.caption || obj.name;
        const fw = obj.style?.fontWeight;
        el.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';
        const fstyle = obj.style?.fontStyle;
        el.style.fontStyle = (fstyle === true || fstyle === 'italic') ? 'italic' : 'normal';
        if (obj.style?.fontSize) el.style.fontSize = typeof obj.style.fontSize === 'number' ? `${obj.style.fontSize}px` : obj.style.fontSize;
        if (obj.style?.color) el.style.color = obj.style.color;
        if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
        const align = obj.style?.textAlign;
        el.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
        if (this.host.runMode) {
            el.onmouseenter = () => el.style.filter = 'brightness(1.1)';
            el.onmouseleave = () => el.style.filter = 'none';
            el.onmousedown = () => el.style.transform = 'scale(0.98)';
            el.onmouseup = () => el.style.transform = 'none';
            // NEW: Trigger onClick event in runMode
            el.onclick = (e: MouseEvent) => {
                e.stopPropagation();
                if (this.host.onEvent) {
                    logger.debug(`[StageRenderer] Button clicked: ${obj.id} (${obj.name})`);
                    this.host.onEvent(obj.id, 'onClick');
                }
            };
        }
    }

    private renderEmojiPickerInternal(el: HTMLElement, obj: any) {
        el.innerHTML = '';
        el.style.display = 'grid';
        el.style.gridTemplateColumns = `repeat(${obj.columns || 5}, 1fr)`;
        el.style.gap = '4px';
        el.style.padding = '8px';
        el.style.alignItems = 'center';
        el.style.justifyItems = 'center';
        el.style.overflowY = 'auto';

        const emojis = obj.emojis || ['😀', '😎', '🚀', '⭐', '🌈', '🍕', '🎮', '🦄', '🎈', '🎨'];
        emojis.forEach((emoji: string) => {
            const btn = document.createElement('div');
            btn.innerText = emoji;
            btn.style.fontSize = '24px';
            btn.style.cursor = this.host.runMode ? 'pointer' : 'default';
            btn.style.width = '100%';
            btn.style.height = '100%';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.borderRadius = '8px';
            btn.style.transition = 'background 0.2s, transform 0.1s';
            btn.style.userSelect = 'none';

            if (obj.selectedEmoji === emoji) {
                btn.style.background = 'rgba(255, 255, 255, 0.3)';
                btn.style.border = '1px solid rgba(255, 255, 255, 0.5)';
            } else {
                btn.style.border = '1px solid transparent';
            }

            if (this.host.runMode) {
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
                    if (this.host.onEvent) {
                        this.host.onEvent(obj.id, 'onSelect', emoji);
                        this.host.onEvent(obj.id, 'propertyChange', { property: 'selectedEmoji', value: emoji });
                    }
                    this.renderObjects(this.host.lastRenderedObjects);
                };
            }
            el.appendChild(btn);
        });
    }

    private renderSystemComponent(el: HTMLElement, obj: any, className: string) {
        let effectivelyVisible = true;
        if (this.host.runMode) {
            if (obj.isHiddenInRun || obj.isVariable) effectivelyVisible = false;
        } else {
            if (obj.isBlueprintOnly && !this.host.isBlueprint && obj.isInherited) effectivelyVisible = false;
        }

        if (!effectivelyVisible) {
            el.style.display = 'none';
        } else {
            el.style.display = 'flex';
            if (!this.host.runMode) {
                el.style.backgroundColor = this.getSystemComponentColor(className, obj);

                let val = (obj.value !== undefined) ? obj.value : obj.defaultValue;
                if (val === undefined) val = '-';

                el.innerText = obj.isVariable ? `${obj.name}\n(${val})` : obj.name;
                el.style.color = '#ffffff';
                el.style.fontSize = '10px';
                el.style.textAlign = 'center';
                el.style.whiteSpace = 'pre-wrap';

                if (obj.isVariable) {
                    el.style.border = '1px solid rgba(255, 255, 255, 0.5)';
                }
            } else {
                el.innerText = '';
            }
        }
    }

    private getSystemComponentColor(className: string, obj: any): string {
        switch (className) {
            case 'TGameLoop': return '#2196f3';
            case 'TInputController': return '#9c27b0';
            case 'TRepeater': return '#ff9800';
            case 'TGameState': return '#607d8b';
            case 'TGameServer': return '#4caf50';
            case 'THandshake': return '#5c6bc0';
            case 'THeartbeat': return '#e91e63';
            case 'TStageController': return '#9c27b0';
            case 'TAPIServer': return '#f44336';
            case 'TDataStore': return '#3f51b5';
            default: return obj.isVariable ? (obj.style?.backgroundColor || '#673ab7') : '#4caf50';
        }
    }

    private renderLabel(el: HTMLElement, obj: any) {
        const textValue = (obj.text !== undefined && obj.text !== null) ? String(obj.text) :
            (obj.value !== undefined && obj.value !== null) ? String(obj.value) : '';
        if (el.innerText !== textValue) el.innerText = textValue;
        const fs = obj.style?.fontSize || obj.fontSize;
        if (fs) el.style.fontSize = typeof fs === 'number' ? `${fs}px` : fs;
        // REMOVED white fallback: Let CSS or container define the default color (usually dark grey/black)
        const color = obj.style?.color;
        if (color) {
            el.style.color = color;
        } else {
            // Reset to prevent carrying over color from recycled elements or inherited styles if not desired
            el.style.color = '';
        }
        const fw = obj.style?.fontWeight;
        el.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';
        const fstyle = obj.style?.fontStyle;
        el.style.fontStyle = (fstyle === true || fstyle === 'italic') ? 'italic' : 'normal';
        if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
        el.style.userSelect = 'text';
        el.style.cursor = 'text';
        const align = obj.style?.textAlign || obj.alignment;
        if (align === 'center') el.style.justifyContent = 'center';
        else if (align === 'right') el.style.justifyContent = 'flex-end';
        else el.style.justifyContent = 'flex-start';
    }

    private renderPanel(el: HTMLElement, obj: any) {
        const textValue = obj.caption || (this.host.runMode ? '' : obj.name);
        if (el.innerText !== textValue) el.innerText = textValue;

        const color = obj.style?.color || (!this.host.runMode ? '#777' : '');
        if (color) el.style.color = color;
        const fontSize = obj.style?.fontSize ? (typeof obj.style.fontSize === 'number' ? `${obj.style.fontSize}px` : obj.style.fontSize) : (!this.host.runMode ? '12px' : '');
        if (fontSize) el.style.fontSize = fontSize;
        const fw = obj.style?.fontWeight;
        el.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : (fw || 'normal');
        const fs = obj.style?.fontStyle;
        el.style.fontStyle = (fs === true || fs === 'italic') ? 'italic' : 'normal';
        if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
        const align = obj.style?.textAlign || 'center';
        el.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
        el.style.alignItems = 'center';
    }

    private renderGameHeader(el: HTMLElement, obj: any) {
        if (el.innerText !== (obj.title || obj.caption || obj.name)) el.innerText = obj.title || obj.caption || obj.name;
        el.style.fontSize = obj.style?.fontSize ? (typeof obj.style.fontSize === 'number' ? `${obj.style.fontSize}px` : obj.style.fontSize) : '18px';
        if (obj.style?.color) el.style.color = obj.style.color;
        const fw = obj.style?.fontWeight;
        el.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : (fw || 'bold');
        const align = obj.style?.textAlign;
        el.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
        if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
    }

    private renderSprite(el: HTMLElement, obj: any) {
        el.style.backgroundColor = obj.style?.backgroundColor || obj.spriteColor || '#ff6b6b';
        el.style.borderRadius = obj.shape === 'circle' ? '50%' : '0';
        if (obj.style?.color) el.style.color = obj.style.color;

        const textValue = obj.caption || (this.host.runMode ? '' : obj.name);
        if (el.innerText !== textValue) el.innerText = textValue;
    }

    private renderShape(el: HTMLElement, obj: any, isNew: boolean) {
        const shapeType = obj.shapeType || 'circle';
        const fillColor = (obj.style?.backgroundColor && obj.style.backgroundColor !== 'transparent') ? obj.style.backgroundColor : (obj.fillColor || '#4fc3f7');
        const strokeColor = (obj.style?.borderColor && obj.style.borderColor !== 'transparent') ? obj.style.borderColor : (obj.strokeColor || '#29b6f6');
        const strokeWidth = (obj.style?.borderWidth !== undefined && obj.style.borderWidth !== 0) ? obj.style.borderWidth : (obj.strokeWidth || 0);
        const opacity = obj.style?.opacity ?? obj.opacity ?? 1;

        let svgContent = '';
        if (shapeType === 'circle') {
            svgContent = `<circle cx="50" cy="50" r="48" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
        } else if (shapeType === 'square' || shapeType === 'rectangle' || shapeType === 'rect') {
            svgContent = `<rect x="1" y="1" width="98" height="98" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
        } else if (shapeType === 'triangle') {
            svgContent = `<polygon points="50,2 2,98 98,98" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
        } else if (shapeType === 'ellipse') {
            svgContent = `<ellipse cx="50" cy="50" rx="48" ry="48" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
        }

        if (obj.contentImage) {
            svgContent += `<image href="${obj.contentImage}" x="15" y="15" width="70" height="70" preserveAspectRatio="xMidYMid meet" />`;
        }
        if (obj.text) {
            const fontSize = obj.style?.fontSize || 50;
            const fontColor = obj.style?.color || '#ffffff';
            svgContent += `<text x="50" y="52" dominant-baseline="central" text-anchor="middle" font-size="${fontSize}" fill="${fontColor}" font-family="${obj.style?.fontFamily || 'Arial'}">${obj.text}</text>`;
        }

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
    }

    private renderInspectorTemplate(el: HTMLElement, obj: any) {
        if (this.host.runMode) {
            el.style.display = 'none';
        } else {
            el.style.backgroundColor = obj.style?.backgroundColor || '#2a2a2a';
            el.style.flexDirection = 'column';
            el.style.alignItems = 'stretch';
            el.style.justifyContent = 'flex-start';
            el.style.padding = '8px';
            el.style.overflow = 'auto';

            el.innerHTML = '';
            const header = document.createElement('div');
            header.className = 'inspector-preview-header';
            header.style.cssText = 'font-weight:bold;color:#fff;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #444';
            header.innerText = '📋 Inspector Designer';
            el.appendChild(header);

            const preview = document.createElement('div');
            preview.className = 'inspector-preview';
            preview.style.cssText = 'display:flex;flex-direction:column;gap:6px;font-size:11px;color:#ccc';

            const layoutConfig = obj.layoutConfig;
            if (layoutConfig && layoutConfig.properties) {
                const groupedProps = new Map<string, any[]>();
                const sortedProps = Object.values(layoutConfig.properties as Record<string, any>)
                    .filter((p: any) => p.visible !== false)
                    .sort((a: any, b: any) => a.order - b.order);

                sortedProps.forEach((prop: any) => {
                    const groupId = prop.groupId || 'default';
                    if (!groupedProps.has(groupId)) groupedProps.set(groupId, []);
                    groupedProps.get(groupId)!.push(prop);
                });

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
                            if (prop.style?.color) label.style.color = prop.style.color;
                            else label.style.color = '#aaa';
                            if (prop.style?.fontSize) label.style.fontSize = prop.style.fontSize;
                            label.innerText = prop.label;
                            const input = document.createElement('span');
                            input.style.cssText = 'flex:1;background:#333;padding:2px 4px;border-radius:2px;color:#fff';
                            input.innerText = prop.type === 'boolean' ? '☐' : prop.type === 'color' ? '🎨' : prop.type === 'select' ? '▼' : '...';
                            row.appendChild(label);
                            row.appendChild(input);
                            preview.appendChild(row);
                        });
                    }
                });
            }
            el.appendChild(preview);
        }
    }

    private renderDialogRoot(el: HTMLElement, obj: any) {
        el.style.borderRadius = '12px';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'stretch';
        el.style.justifyContent = 'flex-start';
        el.style.overflow = 'visible';

        if (!el.querySelector('.dialog-title-bar')) {
            const titleBar = document.createElement('div');
            titleBar.className = 'dialog-title-bar';
            titleBar.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid ${obj.style?.borderColor || '#4fc3f7'}; color: #fff; font-weight: bold;`;
            titleBar.textContent = obj.caption || obj.title || obj.name;
            el.appendChild(titleBar);
        }
        const titleBar = el.querySelector('.dialog-title-bar') as HTMLElement;
        if (titleBar && titleBar.textContent !== (obj.caption || obj.title || obj.name)) {
            titleBar.textContent = obj.caption || obj.title || obj.name;
        }

        if (!this.host.runMode && obj.children && Array.isArray(obj.children)) {
            const cellSize = this.host.grid.cellSize;
            const parentX = obj.x * cellSize;
            const parentY = obj.y * cellSize;

            obj.children.forEach((child: any) => {
                let childEl = this.host.element.querySelector(`[data-id="${child.id}"]`) as HTMLElement;
                if (!childEl) {
                    childEl = document.createElement('div');
                    childEl.className = 'game-object dialog-child';
                    childEl.setAttribute('data-id', child.id);
                    childEl.style.position = 'absolute';
                    childEl.style.boxSizing = 'border-box';
                    childEl.style.display = 'flex';
                    childEl.style.alignItems = 'center';
                    childEl.style.justifyContent = 'center';
                    this.host.element.appendChild(childEl);
                }

                const childX = parentX + (child.x || 0) * cellSize;
                const childY = parentY + (child.y || 0) * cellSize + 30;
                childEl.style.left = `${childX}px`;
                childEl.style.top = `${childY}px`;
                childEl.style.width = `${(child.width || 4) * cellSize}px`;
                childEl.style.height = `${(child.height || 2) * cellSize}px`;
                childEl.style.zIndex = '10';

                childEl.setAttribute('data-parent-x', (parentX / cellSize).toString());
                childEl.setAttribute('data-parent-y', ((parentY + 30) / cellSize).toString());

                if (child.style) {
                    childEl.style.backgroundColor = child.style.backgroundColor || 'transparent';
                    childEl.style.border = `${child.style.borderWidth || 0}px solid ${child.style.borderColor || 'transparent'}`;
                    if (child.style.color) childEl.style.color = child.style.color;
                }

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

                this.updateSelectionState(childEl, child.id);
            });
        }
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
    private renderDataList(el: HTMLElement, obj: any): void {
        const isRunMode = this.host.runMode;

        // Container-Styling
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.overflow = 'auto';
        el.style.alignItems = 'stretch';
        el.style.justifyContent = 'flex-start';
        el.style.padding = '4px';
        el.style.gap = `${obj.rowGap || 4}px`;

        if (isRunMode && obj._runtimeRows && obj._runtimeRows.length > 0) {
            // --- RUN-MODUS: Geklonte Karten rendern ---
            const existingCards = el.querySelectorAll('.datalist-row');
            
            // Nur neu rendern wenn Anzahl sich geändert hat
            if (existingCards.length !== obj._runtimeRows.length) {
                el.innerHTML = '';
                
                for (let i = 0; i < obj._runtimeRows.length; i++) {
                    const rowData = obj._runtimeRows[i];
                    const card = document.createElement('div');
                    card.className = 'datalist-row';
                    card.setAttribute('data-row-index', String(i));
                    card.style.minHeight = `${obj.rowHeight || 60}px`;
                    card.style.display = 'flex';
                    card.style.alignItems = 'center';
                    card.style.gap = '8px';
                    card.style.padding = '8px 12px';
                    card.style.borderRadius = `${rowData.style?.borderRadius || 8}px`;
                    card.style.backgroundColor = rowData.style?.backgroundColor || '#1a1a3e';
                    card.style.border = `${rowData.style?.borderWidth || 1}px solid ${rowData.style?.borderColor || '#2a2a5e'}`;
                    card.style.cursor = 'pointer';
                    card.style.transition = 'background 0.2s';
                    card.style.flexShrink = '0';

                    // Hover-Effekt
                    card.onmouseenter = () => card.style.backgroundColor = '#252555';
                    card.onmouseleave = () => card.style.backgroundColor = rowData.style?.backgroundColor || '#1a1a3e';

                    // Children der Karte rendern
                    if (rowData.children && Array.isArray(rowData.children)) {
                        for (const child of rowData.children) {
                            const childEl = this.renderDataListChild(child, obj, i);
                            if (childEl) card.appendChild(childEl);
                        }
                    } else {
                        // Fallback: Zeige Rohtext der Zeile
                        const item = rowData._rowItem;
                        if (item) {
                            const text = typeof item === 'object' ? JSON.stringify(item) : String(item);
                            card.innerText = text.substring(0, 100);
                            card.style.color = '#ccc';
                            card.style.fontSize = '12px';
                        }
                    }

                    // Zeilen-Klick Event
                    card.onclick = (e) => {
                        e.stopPropagation();
                        if (this.host.onEvent) {
                            this.host.onEvent(obj.id, 'onRowClick', {
                                item: rowData._rowItem,
                                rowIndex: i
                            });
                        }
                    };

                    el.appendChild(card);
                }
            }
        } else {
            // --- EDITOR-MODUS: Template-Vorschau ---
            const templatePanel = obj.children?.[0];
            const childCount = templatePanel?.children?.length || 0;

            // Info-Bar
            let infoBar = el.querySelector('.datalist-info') as HTMLElement;
            if (!infoBar) {
                el.innerHTML = '';
                infoBar = document.createElement('div');
                infoBar.className = 'datalist-info';
                infoBar.style.fontSize = '10px';
                infoBar.style.color = '#4da6ff';
                infoBar.style.padding = '4px 8px';
                infoBar.style.textAlign = 'center';
                infoBar.style.borderBottom = '1px solid #2a2a5e';
                infoBar.style.flexShrink = '0';
                el.appendChild(infoBar);
            }

            const actionInfo = obj.dataAction ? `📊 ${obj.dataAction}` : '⚠️ Keine DataAction';
            infoBar.innerText = `🔄 Repeater | ${actionInfo} | ${childCount} Kinder im Template`;

            // Template-Vorschau (1 Karte)
            if (templatePanel) {
                let previewCard = el.querySelector('.datalist-preview') as HTMLElement;
                if (!previewCard) {
                    previewCard = document.createElement('div');
                    previewCard.className = 'datalist-preview';
                    previewCard.style.minHeight = `${obj.rowHeight || 60}px`;
                    previewCard.style.display = 'flex';
                    previewCard.style.alignItems = 'center';
                    previewCard.style.gap = '8px';
                    previewCard.style.padding = '8px 12px';
                    previewCard.style.borderRadius = `${templatePanel.style?.borderRadius || 8}px`;
                    previewCard.style.backgroundColor = templatePanel.style?.backgroundColor || '#1a1a3e';
                    previewCard.style.border = `1px dashed ${templatePanel.style?.borderColor || '#4da6ff'}`;
                    el.appendChild(previewCard);
                }

                // Zeige Children-Namen als Preview
                const childNames = (templatePanel.children || []).map((c: any) => {
                    const className = c.className || '?';
                    const text = c.text || c.caption || c.name || '';
                    return `[${className}] ${text}`;
                }).join(' | ');

                previewCard.innerText = childNames || 'Leeres Template — ziehe Komponenten hinein';
                previewCard.style.color = childNames ? '#aaa' : '#666';
                previewCard.style.fontSize = '11px';
            }
        }
    }

    /**
     * Rendert ein einzelnes Kind-Element einer DataList-Karte
     */
    private renderDataListChild(childData: any, parentObj: any, rowIndex: number): HTMLElement | null {
        const className = childData.className;
        const childEl = document.createElement('span');

        if (className === 'TLabel' || className === 'TNumberLabel') {
            childEl.innerText = childData.text || '';
            childEl.style.color = childData.style?.color || '#ccc';
            if (childData.style?.fontSize) childEl.style.fontSize = typeof childData.style.fontSize === 'number' ? `${childData.style.fontSize}px` : childData.style.fontSize;
            if (childData.style?.fontWeight === 'bold' || childData.style?.fontWeight === true) childEl.style.fontWeight = 'bold';
            if (childData.style?.fontStyle === 'italic' || childData.style?.fontStyle === true) childEl.style.fontStyle = 'italic';
            if (childData.style?.fontFamily) childEl.style.fontFamily = childData.style.fontFamily;
        } else if (className === 'TButton') {
            childEl.innerText = childData.caption || childData.name || '?';
            childEl.style.cursor = 'pointer';
            childEl.style.padding = '4px 8px';
            childEl.style.borderRadius = '4px';
            childEl.style.backgroundColor = childData.style?.backgroundColor || '#333';
            childEl.style.color = childData.style?.color || '#fff';
            childEl.style.border = 'none';
            childEl.style.fontSize = childData.style?.fontSize ? `${childData.style.fontSize}px` : '12px';
            
            childEl.onclick = (e) => {
                e.stopPropagation();
                if (this.host.onEvent) {
                    this.host.onEvent(parentObj.id, 'onClick', {
                        item: childData._rowItem,
                        rowIndex: rowIndex,
                        buttonName: childData.name
                    });
                }
            };
        } else if (className === 'TImage' || className === 'TAvatar' || className === 'TShape') {
            const img = document.createElement('img');
            const src = childData.src || childData.backgroundImage || '';
            if (src) {
                img.src = src.startsWith('http') || src.startsWith('/') || src.startsWith('data:') ? src : `/images/${src}`;
            }
            img.style.width = '40px';
            img.style.height = '40px';
            img.style.borderRadius = className === 'TAvatar' || className === 'TShape' ? '50%' : `${childData.style?.borderRadius || 4}px`;
            img.style.objectFit = 'cover';
            img.onerror = () => { img.style.display = 'none'; };
            return img;
        } else if (className === 'TBadge') {
            childEl.innerText = childData.text || childData.value || '';
            childEl.style.padding = '2px 8px';
            childEl.style.borderRadius = '12px';
            childEl.style.fontSize = '10px';
            childEl.style.fontWeight = 'bold';
            childEl.style.backgroundColor = childData.style?.backgroundColor || '#4caf50';
            childEl.style.color = childData.style?.color || '#fff';
        } else {
            // Fallback: Text anzeigen
            childEl.innerText = childData.text || childData.caption || childData.name || '';
            childEl.style.color = childData.style?.color || '#aaa';
        }

        return childEl;
    }

    public static renderTable(el: HTMLElement, obj: any, onEvent?: (id: string, event: string, data?: any) => void, cellSize: number = 20): void {
        TableRenderer.renderTable(el, obj, onEvent, cellSize);
    }

    public static renderEmojiPicker(el: HTMLElement, obj: any, cellSize: number, onEvent?: (id: string, event: string, data?: any) => void): void {
        EmojiPickerRenderer.renderEmojiPicker(el, obj, cellSize, onEvent);
    }
    // ─────────────────────────────────────────────────────────────────
    // FAST PATH: Sprite-Positionen direkt im DOM aktualisieren
    // Wird 60×/sec vom GameLoopManager aufgerufen, OHNE volles Render.
    // Kein Dock-Recalc, kein Element-Create/Remove, keine Style-Updates.
    // ─────────────────────────────────────────────────────────────────
    public updateSpritePositions(sprites: { id: string; x: number; y: number }[]): void {
        const cellSize = this.host.grid.cellSize;
        for (const sprite of sprites) {
            const el = this.host.element.querySelector(
                `[data-id="${sprite.id}"]`
            ) as HTMLElement;
            if (!el) continue;
            el.style.left = `${(sprite.x || 0) * cellSize}px`;
            el.style.top = `${(sprite.y || 0) * cellSize}px`;
        }
    }
}
