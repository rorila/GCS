import { Logger } from '../../../utils/Logger';

const logger = Logger.get('TableRenderer', 'Inspector_Update');

/**
 * TableRenderer - Handles rendering of TTable and TGrid component content.
 */
export class TableRenderer {

    /**
     * Main entry point for rendering any table/grid structure.
     */
    public static renderTable(
        el: HTMLElement,
        obj: any,
        onEvent?: (id: string, event: string, data?: any) => void,
        cellSize: number = 20
    ): void {
        try {
            el.innerHTML = '';
            const scrollArea = document.createElement('div');
            scrollArea.style.cssText = 'width:100%; height:100%; overflow:auto;';
            el.appendChild(scrollArea);

            let cols: any[] = Array.isArray(obj.columns) ? obj.columns : [];
            if (cols.length === 0 && typeof obj.columns === 'string' && obj.columns.trim().startsWith('[')) {
                try { const parsed = JSON.parse(obj.columns); if (Array.isArray(parsed)) cols = parsed; } catch { /* ungültig – Auto-Columns nutzen */ }
            }
            const rawData = typeof obj.getRows === 'function' ? obj.getRows() : (Array.isArray(obj.data) ? obj.data : []);

            // Auto-Columns: leere Spaltenliste wird aus dem ersten Datensatz abgeleitet
            if (cols.length === 0 && rawData.length > 0 && typeof rawData[0] === 'object' && rawData[0] !== null) {
                cols = Object.keys(rawData[0]).map(key => ({
                    field: key,
                    label: key.charAt(0).toUpperCase() + key.slice(1)
                }));
            }

            if (obj.viewType === 'grid' || obj.displayMode === 'cards') {
                this.renderGrid(scrollArea, el, obj, cols, rawData, onEvent, cellSize);
            } else {
                this.renderStandardTable(scrollArea, el, obj, cols, rawData, onEvent);
            }
        } catch (e) {
            logger.error('Error rendering table:', e);
        }
    }

    private static renderGrid(
        scrollArea: HTMLElement,
        el: HTMLElement,
        obj: any,
        cols: any[],
        rawData: any[],
        onEvent?: any,
        cellSize: number = 20
    ) {
        console.log('[KarteFlip] renderGrid', obj.name, '| flippable =', obj.flippable, '| rows =', rawData.length, '| cellSize =', cellSize);
        const config = obj.gridConfig || obj.cardConfig || {};
        const cardWidth = config.cardWidth ?? config.width ?? 180;
        const cardHeight = config.cardHeight ?? config.height ?? 120;
        const gap = config.gap ?? 16;

        scrollArea.style.display = 'flex';
        scrollArea.style.flexWrap = 'wrap';
        scrollArea.style.gap = `${gap}px`;
        scrollArea.style.padding = `${gap}px`;
        scrollArea.style.alignContent = 'flex-start';

        rawData.forEach((row: any, idx: number) => {
            const card: any = document.createElement('div');
            card.className = 'gcs-card-item';
            card.style.cssText = `position: relative; width: ${cardWidth}px; height: ${cardHeight}px; background: ${config.backgroundColor || 'rgba(255, 255, 255, 0.05)'}; border: ${config.borderWidth || 1}px solid ${config.borderColor || 'rgba(255, 255, 255, 0.1)'}; border-radius: ${config.borderRadius || 12}px; padding: ${config.padding || 12}px; cursor: pointer; overflow: hidden; transition: transform 0.2s, background 0.2s; box-sizing: border-box;`;

            if (idx === obj.selectedIndex) {
                card.style.background = 'rgba(255, 255, 255, 0.15)';
                card.style.borderColor = '#0ed7b5';
            }

            card.onmouseenter = () => { if (!card.__flipping) card.style.transform = 'translateY(-2px)'; };
            card.onmouseleave = () => { if (!card.__flipping) card.style.transform = 'none'; };
            card.onclick = (e: MouseEvent) => {
                e.stopPropagation();
                console.log('[KarteFlip] Klick auf', obj.name, '| flippable =', obj.flippable, '| flipped =', !!row.__flipped);
                if (obj.flippable) {
                    // Memory-Flip: scaleX 1→0→1, am Wendepunkt wird die Rückseite aufgebaut.
                    // Auswahl + Events laufen erst NACH der Animation — selectRow löst ein
                    // Re-Render aus, das das animierte DOM-Element sonst sofort verwirft.
                    if (card.__flipping) return;
                    card.__flipping = true;
                    const half = Math.max(1, (Number(obj.flipDuration) || 500) / 2);
                    card.style.transition = `transform ${half}ms ease-in`;
                    card.style.transform = 'scaleX(0)';
                    setTimeout(() => {
                        row.__flipped = !row.__flipped;
                        console.log('[KarteFlip] Wendepunkt →', row.__flipped ? 'Rückseite' : 'Vorderseite');
                        buildItems();
                        card.style.transition = `transform ${half}ms ease-out`;
                        card.style.transform = 'scaleX(1)';
                        setTimeout(() => {
                            card.__flipping = false;
                            const changed = obj.selectedIndex !== idx || obj.selectedRecord !== row;
                            if (typeof obj.selectRow === 'function') obj.selectRow(idx); else obj.selectedIndex = idx;
                            if (onEvent) { if (changed) onEvent(obj.id, 'onSelectionChanged', {index:idx, data:row, key:obj.selectedKey}); onEvent(obj.id, 'onRowClick', {index:idx, data:row, key:obj.selectedKey}); }
                            if (onEvent) onEvent(obj.id, 'onSelect', { index: idx, data: row });
                            this.renderTable(el, obj, onEvent, cellSize);
                        }, half);
                    }, half);
                    return;
                }
                const changed = obj.selectedIndex !== idx || obj.selectedRecord !== row;
                if (typeof obj.selectRow === 'function') obj.selectRow(idx); else obj.selectedIndex = idx;
                if (onEvent) { if (changed) onEvent(obj.id, 'onSelectionChanged', {index:idx, data:row, key:obj.selectedKey}); onEvent(obj.id, 'onRowClick', {index:idx, data:row, key:obj.selectedKey}); }
                if (onEvent) onEvent(obj.id, 'onSelect', { index: idx, data: row });
                this.renderTable(el, obj, onEvent, cellSize);
            };

            const buildItems = () => {
                card.querySelectorAll('.gcs-card-field').forEach((n: any) => n.remove());
                const flipped = !!row.__flipped;
            cols.forEach((col: any) => {
                const baseField = col.field || col.property;
                const fieldName = flipped ? (col.flipField || baseField) : baseField;
                let value = fieldName ? (row[fieldName] ?? '') : (flipped ? (col.flipText ?? col.text ?? '') : (col.text ?? ''));
                if (Array.isArray(value)) value = value.join(' / ');
                const type = col.type || 'text';
                const colStyle = col.style || {};

                const itemEl = document.createElement('div');
                itemEl.className = 'gcs-card-field';
                itemEl.style.position = 'absolute';
                if (col.x !== undefined) itemEl.style.left = `${col.x * cellSize}px`;
                if (col.y !== undefined) itemEl.style.top = `${col.y * cellSize}px`;
                if (col.width !== undefined) itemEl.style.width = `${col.width * cellSize}px`;
                if (col.height !== undefined) itemEl.style.height = `${col.height * cellSize}px`;

                if (colStyle.fontSize) itemEl.style.fontSize = typeof colStyle.fontSize === 'number' ? `${colStyle.fontSize}px` : colStyle.fontSize;
                if (colStyle.color) itemEl.style.color = colStyle.color;
                if (colStyle.fontWeight) itemEl.style.fontWeight = colStyle.fontWeight;
                if (colStyle.textAlign) itemEl.style.textAlign = colStyle.textAlign;

                if (type === 'image') {
                    itemEl.style.borderRadius = '50%';
                    itemEl.style.backgroundImage = `url(${value})`;
                    itemEl.style.backgroundSize = 'cover';
                    itemEl.style.backgroundPosition = 'center';
                    if (!col.width) itemEl.style.width = '40px';
                    if (!col.height) itemEl.style.height = '40px';
                } else if (type === 'badge') {
                    itemEl.innerText = String(value).toUpperCase();
                    itemEl.style.cssText += 'padding: 2px 8px; border-radius: 100px; font-size: 9px; font-weight: bold; border: 1px solid currentColor; background: rgba(0,0,0,0.2); display: inline-flex; align-items: center; justify-content: center;';
                } else {
                    itemEl.innerText = String(value);
                    if (type === 'header') itemEl.style.fontWeight = 'bold';
                    else if (type === 'meta') itemEl.style.opacity = '0.6';
                }
                card.appendChild(itemEl);
            });
            };
            buildItems();
            scrollArea.appendChild(card);
        });
    }

    private static renderStandardTable(
        scrollArea: HTMLElement,
        el: HTMLElement,
        obj: any,
        cols: any[],
        rawData: any[],
        onEvent?: any
    ) {
        const table = document.createElement('table');
        table.style.cssText = 'width:100%; border-collapse:collapse; color:inherit; text-align:left;';

        if (obj.showHeader !== false && cols.length > 0) {
            const thead = document.createElement('thead');
            const hRow = document.createElement('tr');
            hRow.style.cssText = 'background:rgba(16,34,48,0.9); position:sticky; top:0; z-index:1;';
            cols.forEach((col: any) => {
                const th = document.createElement('th');
                th.style.cssText = `padding:8px 12px; border-bottom:1px solid #1c384d; width:${col.width || 'auto'}; font-weight:600; font-size:11px; letter-spacing:0.04em; text-transform:uppercase; opacity:0.85;`;
                th.innerText = col.label ?? col.field ?? col.property;
                hRow.appendChild(th);
            });
            thead.appendChild(hRow);
            table.appendChild(thead);
        }

        const tbody = document.createElement('tbody');
        if (rawData.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = Math.max(1, cols.length);
            td.innerText = "Keine Daten vorhanden.";
            td.style.cssText = 'padding:12px; text-align:center; opacity:0.6; font-style:italic;';
            tr.appendChild(td);
            tbody.appendChild(tr);
        } else {
            rawData.forEach((row: any, idx: number) => {
                const tr = document.createElement('tr');
                tr.style.cssText = `border-bottom:1px solid #172d3d; cursor:pointer; height:${obj.rowHeight || 30}px; transition:background 0.12s;`;
                const isSelected = idx === obj.selectedIndex;
                const isStriped = obj.striped !== false && (idx % 2 === 1);
                tr.style.backgroundColor = isSelected ? '#163042' : (isStriped ? 'rgba(255,255,255,0.015)' : 'transparent');
                tr.onmouseenter = () => { if (idx !== obj.selectedIndex) tr.style.backgroundColor = '#142838'; };
                tr.onmouseleave = () => { if (idx !== obj.selectedIndex) tr.style.backgroundColor = isStriped ? 'rgba(255,255,255,0.015)' : 'transparent'; };
                tr.onclick = (e: MouseEvent) => {
                    e.stopPropagation();
                    const changed = obj.selectedIndex !== idx || obj.selectedRecord !== row;
                if (typeof obj.selectRow === 'function') obj.selectRow(idx); else obj.selectedIndex = idx;
                if (onEvent) { if (changed) onEvent(obj.id, 'onSelectionChanged', {index:idx, data:row, key:obj.selectedKey}); onEvent(obj.id, 'onRowClick', {index:idx, data:row, key:obj.selectedKey}); }
                    if (onEvent) onEvent(obj.id, 'onSelect', { index: idx, data: row });
                    this.renderTable(el, obj, onEvent);
                };
                cols.forEach((col: any) => {
                    const td = document.createElement('td');
                    td.style.cssText = 'padding:6px 12px;';
                    const fieldName = col.field || col.property;
                    const type = col.type || 'text';
                    if (type === 'image') {
                        const size = Math.max(18, Math.min(64, (obj.rowHeight || 30) - 8));
                        const thumb = document.createElement('div');
                        thumb.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;`
                            + `background:rgba(255,255,255,0.08);display:flex;align-items:center;`
                            + `justify-content:center;overflow:hidden;`;
                        const src = row[fieldName];
                        if (src) {
                            thumb.style.backgroundImage = `url(${src})`;
                            thumb.style.backgroundSize = 'cover';
                            thumb.style.backgroundPosition = 'center';
                        } else if (col.fallback) {
                            thumb.innerText = String(row[col.fallback] ?? '');
                            thumb.style.fontSize = `${Math.round(size * 0.6)}px`;
                        }
                        td.appendChild(thumb);
                    } else if (type === 'badge') {
                        // Pill-Badge wie im Kartenmodus; badgeColor steuert Text-/Rahmenfarbe,
                        // dot:true stellt einen Statuspunkt voran.
                        const cellVal = row[fieldName];
                        const pill = document.createElement('span');
                        const badgeColor = col.badgeColor || col.style?.color || '#0ed7b5';
                        if (col.dot) {
                            const dot = document.createElement('span');
                            dot.style.cssText = `display:inline-block;width:7px;height:7px;border-radius:50%;background:${badgeColor};margin-right:6px;`;
                            pill.appendChild(dot);
                        }
                        pill.appendChild(document.createTextNode(String(cellVal ?? '')));
                        pill.style.cssText += `display:inline-flex;align-items:center;padding:2px 10px;border-radius:100px;font-size:${col.style?.fontSize || 11}px;font-weight:600;color:${badgeColor};border:1px solid ${badgeColor};background:rgba(0,0,0,0.25);white-space:nowrap;`;
                        td.appendChild(pill);
                    } else if (type === 'action') {
                        // Aktions-Button pro Zeile: wählt die Zeile und feuert onAction
                        // (Action-Name via col.actionName, Beschriftung col.actionLabel).
                        const btn = document.createElement('button');
                        btn.innerText = col.actionLabel || '✎';
                        btn.title = col.title || col.actionName || '';
                        btn.style.cssText = 'padding:2px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.25);background:transparent;color:inherit;cursor:pointer;font-size:12px;';
                        btn.onclick = (e: MouseEvent) => {
                            e.stopPropagation();
                            if (typeof obj.selectRow === 'function') obj.selectRow(idx); else obj.selectedIndex = idx;
                            if (onEvent) {
                                onEvent(obj.id, 'onSelectionChanged', { index: idx, data: row, key: obj.selectedKey });
                                onEvent(obj.id, 'onAction', { index: idx, data: row, key: obj.selectedKey, action: col.actionName || 'edit' });
                            }
                        };
                        td.appendChild(btn);
                    } else {
                        const cellVal = row[fieldName];
                        td.innerText = col.format === 'boolean' ? (cellVal ? '✓' : '—') : (Array.isArray(cellVal) ? cellVal.join(' / ') : String(cellVal ?? ''));
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        }
        table.appendChild(tbody);
        scrollArea.appendChild(table);
    }
}
