import { IRenderContext } from './IRenderContext';

export class ComplexComponentRenderer {
    
    public static renderInspectorTemplate(ctx: IRenderContext, el: HTMLElement, obj: any): void {
        if (ctx.host.runMode) {
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
            header.innerText = 'ðŸ“‹ Inspector Designer';
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
                            input.innerText = prop.type === 'boolean' ? 'â˜' : prop.type === 'color' ? 'ðŸŽ¨' : prop.type === 'select' ? 'â–¼' : '...';
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

    public static renderSidePanel(ctx: IRenderContext, el: HTMLElement, obj: any): void {
        el.style.borderRadius = '0px';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'stretch';
        el.style.justifyContent = 'flex-start';
        el.style.overflow = 'visible';

        // Editor CSS: Immer sichtbarer Container mit Titel
        if (!el.querySelector('.sidepanel-title-bar')) {
            const titleBar = document.createElement('div');
            titleBar.className = 'sidepanel-title-bar';
            titleBar.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid ${obj.style?.borderColor || '#4fc3f7'}; color: #fff; font-weight: bold; background: rgba(0,0,0,0.2)`;
            const titleText = document.createElement('span');
            titleText.className = 'sidepanel-title-text';
            titleBar.appendChild(titleText);
            
            // Ein Icon oder Hinweis, dass es ein SidePanel ist
            const iconEl = document.createElement('span');
            iconEl.textContent = obj.side === 'left' ? '⬅️' : '➡️';
            iconEl.style.fontSize = '12px';
            iconEl.style.opacity = '0.7';
            titleBar.appendChild(iconEl);

            el.appendChild(titleBar);
        }
        
        const titleBar = el.querySelector('.sidepanel-title-bar') as HTMLElement;
        const titleText = titleBar.querySelector('.sidepanel-title-text') as HTMLElement;
        if (titleText && titleText.textContent !== (obj.caption || obj.title || obj.name)) {
            titleText.textContent = obj.caption || obj.title || obj.name;
        }

        // Falls wir im RunMode sind, verhält es sich wie im TSidePanel runMode
        if (ctx.host.runMode) {
            // Im RunMode wird die Position und Sichtbarkeit (Slide-Animation)
            // komplett vom StageRenderer übernommen! Kein Display:none mehr!
        }
    }

    public static renderDialogRoot(ctx: IRenderContext, el: HTMLElement, obj: any): void {
        el.style.borderRadius = '12px';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'stretch';
        el.style.justifyContent = 'flex-start';
        el.style.overflow = 'visible';

        // Titelleiste als DOM-Kind des Dialogs (Design- und RunMode identisch)
        if (!el.querySelector('.dialog-title-bar')) {
            const titleBar = document.createElement('div');
            titleBar.className = 'dialog-title-bar';
            titleBar.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid ${obj.style?.borderColor || '#4fc3f7'}; color: #fff; font-weight: bold;`;
            const titleText = document.createElement('span');
            titleText.className = 'dialog-title-text';
            titleBar.appendChild(titleText);
            el.appendChild(titleBar);
        }
        const titleBar = el.querySelector('.dialog-title-bar') as HTMLElement;
        const titleText = titleBar.querySelector('.dialog-title-text') as HTMLElement;
        if (titleText && titleText.textContent !== (obj.caption || obj.title || obj.name)) {
            titleText.textContent = obj.caption || obj.title || obj.name;
        }

        if (ctx.host.runMode) {
            const cellSize = ctx.host.grid?.cellSize || 20;

            // KRITISCH: Die obj-Referenz wird bei JEDEM Render aktualisiert.
            // Event-Handler (Close, Drag) lesen sie von hier statt aus der Closure,
            // weil ein Voll-Render eine NEUE obj-Instanz uebergibt, aber die Handler
            // nur beim ERSTEN Render erstellt werden (stale closure).
            (titleBar as any)._dialogObj = obj;

            // 1. Closable
            if (obj.closable) {
                let closeBtn = titleBar.querySelector('.dialog-close-btn') as HTMLElement;
                if (!closeBtn) {
                    closeBtn = document.createElement('span');
                    closeBtn.className = 'dialog-close-btn';
                    closeBtn.textContent = '\u2715';
                    closeBtn.style.cssText = 'cursor:pointer; padding:0 8px; margin-right:-8px; font-weight:bold; transition:color 0.2s;';
                    closeBtn.onmouseenter = () => closeBtn.style.color = '#ff4444';
                    closeBtn.onmouseleave = () => closeBtn.style.color = '#fff';
                    closeBtn.onpointerdown = (e) => {
                        e.stopPropagation();
                    };
                    closeBtn.onmousedown = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                    };
                    closeBtn.onclick = (e) => {
                        e.stopPropagation();
                        // 1. Hole referenz auf Dialog Objekt (TDialogRoot oder TSidePanel)
                        const currentObj = (titleBar as any)._dialogObj;
                        
                        // Finde das MASTER-Objekt im Runtime-Context.
                        // KRITISCH: getObjects() gibt Spread-KOPIEN zurück!
                        // Eine Mutation auf einer Kopie hat KEINE Wirkung auf den
                        // reaktiven PropertyWatcher. Wir brauchen das echte Proxy-Objekt
                        // aus this.objects via getRawObject(id).
                        let masterObj = currentObj;
                        
                        if (ctx.host) {
                            // Priorität 1: GameRuntime.getRawObject() – direkter Zugriff auf this.objects
                            if (ctx.host.runtime && typeof ctx.host.runtime.getRawObject === 'function') {
                                const raw = ctx.host.runtime.getRawObject(currentObj.id);
                                if (raw) masterObj = raw;
                            }
                            // Priorität 2: Allgemeines getObject(id) Interface
                            else if (typeof (ctx.host as any).getObject === 'function') {
                                const raw = (ctx.host as any).getObject(currentObj.id);
                                if (raw) masterObj = raw;
                            }
                            // Priorität 3: Flaches objects-Array
                            else if (Array.isArray((ctx.host as any).objects)) {
                                const raw = (ctx.host as any).objects.find((o: any) => o.id === currentObj.id);
                                if (raw) masterObj = raw;
                            }
                        }

                        // 2. Setze visible=false auf dem echten reaktiven Objekt → löst PropertyWatcher aus
                        masterObj.visible = false;

                        // Sofortiges visuelles Feedback: (Schiebt den Dialog entsprechend StageRenderer Logik aus dem Bild)
                        const outOfBoundsOffset = currentObj.slideDirection === 'left' ? -1500 : 1500;
                        (el.style as any).translate = `${((currentObj.x || 0) * cellSize) + outOfBoundsOffset}px ${(currentObj.y || 0) * cellSize}px`;
                        el.style.pointerEvents = 'none';
                        (el as any)._wasCentered = false; // Zentrierungs-Zustand resetten

                        // Modal-Overlay ebenfalls verstecken
                        const overlay = document.getElementById(`dialog-overlay-${currentObj.id}`);
                        if (overlay) overlay.style.display = 'none';
                        
                        // KINDER ebenfalls aus dem Bild schieben (Flache DOM Hierarchie)
                        if (currentObj.children && Array.isArray(currentObj.children)) {
                            currentObj.children.forEach((child: any) => {
                                const childEl = ctx.host.element.querySelector(`[data-id="${child.id || child.name}"]`) as HTMLElement;
                                if (childEl) {
                                    childEl.style.pointerEvents = 'none';
                                    const absX = (currentObj.x || 0) + (child.x || 0);
                                    const absY = (currentObj.y || 0) + (child.y || 0);
                                    (childEl.style as any).translate = `${(absX * cellSize) + outOfBoundsOffset}px ${absY * cellSize}px`;
                                }
                            });
                        }
                    };
                    titleBar.appendChild(closeBtn);
                }
            } else {
                const closeBtn = titleBar.querySelector('.dialog-close-btn');
                if (closeBtn) closeBtn.remove();
            }

            // 2. Draggable
            if (obj.draggableAtRuntime) {
                titleBar.style.cursor = 'move';
                if (!(titleBar as any)._dragInit) {
                    (titleBar as any)._dragInit = true;
                    let isDragging = false;
                    let startX = 0, startY = 0;
                    let startObjX = 0, startObjY = 0;

                    titleBar.onpointerdown = (e) => {
                        if ((e.target as HTMLElement).classList.contains('dialog-close-btn')) return;
                        e.stopPropagation();
                        const currentObj = (titleBar as any)._dialogObj;
                        isDragging = true;
                        startX = e.clientX;
                        startY = e.clientY;
                        startObjX = currentObj.x || 0;
                        startObjY = currentObj.y || 0;
                        
                        console.log('[DIALOG-DEBUG] Drag START: x:', startObjX, 'y:', startObjY);
                        titleBar.setPointerCapture(e.pointerId);
                    };
                    titleBar.onpointermove = (e) => {
                        if (!isDragging) return;
                        e.stopPropagation();
                        const currentObj = (titleBar as any)._dialogObj;
                        const dx = e.clientX - startX;
                        const dy = e.clientY - startY;
                        
                        const deltaCellX = dx / cellSize;
                        const deltaCellY = dy / cellSize;
                        
                        currentObj.x = startObjX + deltaCellX;
                        currentObj.y = startObjY + deltaCellY;

                        // Sofortiges visuelles Dragging anwenden
                        (el.style as any).translate = `${currentObj.x * cellSize}px ${currentObj.y * cellSize}px`;
                        
                        // Kinder mitziehen (Relative Koordinaten c.x/y bleiben unverändert!)
                        if (currentObj.children && Array.isArray(currentObj.children)) {
                            currentObj.children.forEach((c: any) => {
                                const childEl = ctx.host.element.querySelector(`[data-id="${c.id || c.name}"]`) as HTMLElement;
                                if (childEl) {
                                    const absX = currentObj.x + (c.x || 0);
                                    const absY = currentObj.y + (c.y || 0);
                                    (childEl.style as any).translate = `${absX * cellSize}px ${absY * cellSize}px`;
                                }
                            });
                        }
                    };
                    titleBar.onpointerup = (e) => {
                        if (!isDragging) return;
                        isDragging = false;
                        titleBar.releasePointerCapture(e.pointerId);
                    };
                }
            } else {
                titleBar.style.cursor = 'default';
                titleBar.onpointerdown = null;
                titleBar.onpointermove = null;
                titleBar.onpointerup = null;
                (titleBar as any)._dragInit = false;
            }

            // 3. Center on Show
            if (obj.centerOnShow) {
                if (obj.visible && !(el as any)._wasCentered) {
                    (el as any)._wasCentered = true;
                    const stageW = ctx.host.element.clientWidth;
                    const stageH = ctx.host.element.clientHeight;
                    const stageWCells = stageW / cellSize;
                    const stageHCells = stageH / cellSize;
                    const objWCells = obj.width || 20;
                    const objHCells = obj.height || 15;
                    const newX = Math.max(0, Math.floor((stageWCells - objWCells) / 2));
                    const newY = Math.max(0, Math.floor((stageHCells - objHCells) / 2));
                    obj.x = newX;
                    obj.y = newY;
                    (el.style as any).translate = `${newX * cellSize}px ${newY * cellSize}px`;
                    el.style.left = '0px';
                    el.style.top = '0px';

                    // Kinder ebenfalls nachträglich zentrieren, da StageRenderer ihre absoluten
                    // Positionen evt. schon mit den alten (nicht-zentrierten) parent-x/y gerechnet hat
                    if (obj.children && Array.isArray(obj.children)) {
                        obj.children.forEach((c: any) => {
                            const childEl = ctx.host.element.querySelector(`[data-id="${c.id || c.name}"]`) as HTMLElement;
                            if (childEl) {
                                const absX = newX + (c.x || 0);
                                const absY = newY + (c.y || 0);
                                (childEl.style as any).translate = `${absX * cellSize}px ${absY * cellSize}px`;
                            }
                        });
                    }
                } else if (!obj.visible) {
                    (el as any)._wasCentered = false;
                }
            }

            // 4. Modal
            if (obj.modal) {
                const zIndexBase = obj.zIndex ? Number(obj.zIndex) : 20000;
                let overlay = document.getElementById(`dialog-overlay-${obj.id}`);
                if (obj.visible) {
                    if (!overlay) {
                        overlay = document.createElement('div');
                        overlay.id = `dialog-overlay-${obj.id}`;
                        overlay.className = 'dialog-overlay';
                        overlay.style.cssText = `position: absolute; top:0; left:0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); pointer-events: auto;`;
                        ctx.host.element.appendChild(overlay);
                    }
                    overlay.style.zIndex = String(zIndexBase - 1);
                    overlay.style.display = 'block';
                    overlay.onpointerdown = (e) => e.stopPropagation();
                    overlay.onclick = (e) => e.stopPropagation();
                } else if (overlay) {
                    overlay.style.display = 'none';
                }
            } else {
                const overlay = document.getElementById(`dialog-overlay-${obj.id}`);
                if (overlay) overlay.style.display = 'none';
            }
        }





        if (!ctx.host.runMode && obj.children && Array.isArray(obj.children)) {
            const cellSize = ctx.host.grid.cellSize;
            const parentX = obj.x * cellSize;
            const parentY = obj.y * cellSize;

            obj.children.forEach((child: any) => {
                let childEl = ctx.host.element.querySelector(`[data-id="${child.id}"]`) as HTMLElement;
                if (!childEl) {
                    childEl = document.createElement('div');
                    childEl.className = 'game-object dialog-child';
                    childEl.setAttribute('data-id', child.id);
                    childEl.style.position = 'absolute';
                    childEl.style.boxSizing = 'border-box';
                    childEl.style.display = 'flex';
                    childEl.style.alignItems = 'center';
                    childEl.style.justifyContent = 'center';
                    ctx.host.element.appendChild(childEl);
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
                    childEl.innerText = child.text || child.caption || child.name;
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

                ctx.updateSelectionState(childEl, child.id);
            });
        }
    }

    public static renderDataList(ctx: IRenderContext, el: HTMLElement, obj: any): void {
        const isRunMode = ctx.host.runMode;

        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.overflow = 'auto';
        el.style.alignItems = 'stretch';
        el.style.justifyContent = 'flex-start';
        el.style.padding = '4px';
        el.style.gap = `${obj.rowGap || 4}px`;

        if (isRunMode && obj._runtimeRows && obj._runtimeRows.length > 0) {
            const existingCards = el.querySelectorAll('.datalist-row');
            
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

                    card.onmouseenter = () => card.style.backgroundColor = '#252555';
                    card.onmouseleave = () => card.style.backgroundColor = rowData.style?.backgroundColor || '#1a1a3e';

                    if (rowData.children && Array.isArray(rowData.children)) {
                        for (const child of rowData.children) {
                            const childEl = this.renderDataListChild(ctx, child, obj, i);
                            if (childEl) card.appendChild(childEl);
                        }
                    } else {
                        const item = rowData._rowItem;
                        if (item) {
                            const text = typeof item === 'object' ? JSON.stringify(item) : String(item);
                            card.innerText = text.substring(0, 100);
                            card.style.color = '#ccc';
                            card.style.fontSize = '12px';
                        }
                    }

                    card.onclick = (e) => {
                        e.stopPropagation();
                        if (ctx.host.onEvent) {
                            ctx.host.onEvent(obj.id, 'onRowClick', {
                                item: rowData._rowItem,
                                rowIndex: i
                            });
                        }
                    };

                    el.appendChild(card);
                }
            }
        } else {
            const templatePanel = obj.children?.[0];
            const childCount = templatePanel?.children?.length || 0;

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

            const actionInfo = obj.dataAction ? `ðŸ“Š ${obj.dataAction}` : 'âš ï¸ Keine DataAction';
            infoBar.innerText = `ðŸ”„ Repeater | ${actionInfo} | ${childCount} Kinder im Template`;

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

                const childNames = (templatePanel.children || []).map((c: any) => {
                    const className = c.className || '?';
                    const text = c.text || c.caption || c.name || '';
                    return `[${className}] ${text}`;
                }).join(' | ');

                previewCard.innerText = childNames || 'Leeres Template â€” ziehe Komponenten hinein';
                previewCard.style.color = childNames ? '#aaa' : '#666';
                previewCard.style.fontSize = '11px';
            }
        }
    }

    private static renderDataListChild(ctx: IRenderContext, childData: any, parentObj: any, rowIndex: number): HTMLElement | null {
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
                if (ctx.host.onEvent) {
                    ctx.host.onEvent(parentObj.id, 'onClick', {
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
                let imgSrc = src.startsWith('http') || src.startsWith('/') || src.startsWith('.') || src.startsWith('data:') ? src : `./images/${src}`;
                if (imgSrc.startsWith('/images/')) imgSrc = '.' + imgSrc;
                img.src = imgSrc;
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
            childEl.innerText = childData.text || childData.caption || childData.name || '';
            childEl.style.color = childData.style?.color || '#aaa';
        }

        return childEl;
    }
}
