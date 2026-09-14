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
            const card = document.createElement('div');
            card.className = 'gcs-card-item';
            card.style.cssText = `position: relative; width: ${cardWidth}px; height: ${cardHeight}px; background: ${config.backgroundColor || 'rgba(255, 255, 255, 0.05)'}; border: ${config.borderWidth || 1}px solid ${config.borderColor || 'rgba(255, 255, 255, 0.1)'}; border-radius: ${config.borderRadius || 12}px; padding: ${config.padding || 12}px; cursor: pointer; overflow: hidden; transition: transform 0.2s, background 0.2s; box-sizing: border-box;`;

            if (idx === obj.selectedIndex) {
                card.style.background = 'rgba(255, 255, 255, 0.15)';
                card.style.borderColor = '#0ed7b5';
            }

            card.onmouseenter = () => card.style.transform = 'translateY(-2px)';
            card.onmouseleave = () => card.style.transform = 'none';
            card.onclick = (e) => {
                e.stopPropagation();
                const changed = obj.selectedIndex !== idx || obj.selectedRecord !== row;
                if (typeof obj.selectRow === 'function') obj.selectRow(idx); else obj.selectedIndex = idx;
                if (onEvent) { if (changed) onEvent(obj.id, 'onSelectionChanged', {index:idx, data:row, key:obj.selectedKey}); onEvent(obj.id, 'onRowClick', {index:idx, data:row, key:obj.selectedKey}); }
                if (onEvent) onEvent(obj.id, 'onSelect', { index: idx, data: row });
                this.renderTable(el, obj, onEvent);
            };

            cols.forEach((col: any) => {
                const fieldName = col.field || col.property;
                const value = row[fieldName] ?? '';
                const type = col.type || 'text';
                const colStyle = col.style || {};

                const itemEl = document.createElement('div');
                itemEl.style.position = 'absolute';
                if (col.x !== undefined) itemEl.style.left = `${col.x * cellSize}px`;
                if (col.y !== undefined) itemEl.style.top = `${col.y * cellSize}px`;
                if (col.width !== undefined) itemEl.style.width = `${col.width * cellSize}px`;
                if (col.height !== undefined) itemEl.style.height = `${col.height * cellSize}px`;

                if (colStyle.fontSize) itemEl.style.fontSize = typeof colStyle.fontSize === 'number' ? `${colStyle.fontSize}px` : colStyle.fontSize;
                if (colStyle.color) itemEl.style.color = colStyle.color;
                if (colStyle.fontWeight) itemEl.style.fontWeight = colStyle.fontWeight;

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
            hRow.style.cssText = 'background:rgba(0,0,0,0.05); position:sticky; top:0; z-index:1;';
            cols.forEach((col: any) => {
                const th = document.createElement('th');
                th.style.cssText = `padding:8px 12px; border-bottom:1px solid rgba(0,0,0,0.1); width:${col.width || 'auto'}; font-weight:600;`;
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
                tr.style.cssText = `border-bottom:1px solid rgba(0,0,0,0.05); cursor:pointer; height:${obj.rowHeight || 30}px;`;
                const isSelected = idx === obj.selectedIndex;
                const isStriped = obj.striped !== false && (idx % 2 === 1);
                tr.style.backgroundColor = isSelected ? 'rgba(0,0,0,0.1)' : (isStriped ? 'rgba(0,0,0,0.02)' : 'transparent');
                tr.onclick = (e) => {
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
                    td.innerText = String(col.format === 'boolean' ? (row[col.field || col.property] ? '✓' : '—') : (row[col.field || col.property] ?? ''));
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        }
        table.appendChild(tbody);
        scrollArea.appendChild(table);
    }
}
