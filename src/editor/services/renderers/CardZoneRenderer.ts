import { PropertyHelper } from '../../../runtime/PropertyHelper';
import { dataUrlToBlobUrl } from '../../../utils/BlobUrlCache';
import { IRenderContext } from './IRenderContext';

/**
 * CardZoneRenderer - Zeigt gefilterte Records einer TObjectList als Karten an.
 * Die Karten sind Ansichten der Daten, keine eigenstaendigen Stage-Objekte.
 */
export class CardZoneRenderer {
    public static render(ctx: IRenderContext, el: HTMLElement, obj: any): void {
        el.innerHTML = '';
        const runMode = !!ctx.host.runMode;
        const rect = el.getBoundingClientRect();
        const zoneW = Math.max(0, rect.width);
        const zoneH = Math.max(0, rect.height);
        const config = obj.cardConfig || {};
        const cellSize = Math.max(1, Number(ctx.host.grid?.cellSize) || 20);
        const itemWidth = Number(obj.itemWidth);
        const itemHeight = Number(obj.itemHeight);
        const itemGap = Number(obj.gap);
        const cardW = Math.max(1, (Number.isFinite(itemWidth) ? itemWidth : 3.1) * cellSize);
        const cardH = Math.max(1, (Number.isFinite(itemHeight) ? itemHeight : 4.5) * cellSize);
        const gap = Math.max(0, (Number.isFinite(itemGap) ? itemGap : 0.4) * cellSize);
        const rows = typeof obj.getRows === 'function' ? obj.getRows() : (Array.isArray(obj.data) ? obj.data : []);

        const content = document.createElement('div');
        content.className = 'card-zone-content';
        content.style.cssText = 'position:absolute;inset:0;overflow:visible;';
        el.appendChild(content);

        if (!rows.length) {
            if (!runMode) {
                const hint = document.createElement('div');
                hint.textContent = '0 Karten';
                hint.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border:1px dashed rgba(0,0,0,.25);border-radius:8px;color:rgba(0,0,0,.35);font:12px sans-serif;pointer-events:none;';
                content.appendChild(hint);
            }
            return;
        }

        const orientation = obj.orientation || 'horizontal';
        const step = this.stepFor(zoneW, zoneH, cardW, cardH, gap, rows.length, orientation);
        const stackStep = rows.length > 1
            ? Math.min(2, Math.max(0, (zoneW - cardW) / (rows.length - 1)), Math.max(0, (zoneH - cardH) / (rows.length - 1)))
            : 0;
        const startX = orientation === 'vertical' || orientation === 'stack'
            ? Math.max(0, (zoneW - cardW - stackStep * (rows.length - 1)) / 2)
            : Math.max(0, (zoneW - (cardW + step * (rows.length - 1))) / 2);
        const startY = orientation === 'horizontal' || orientation === 'stack'
            ? Math.max(0, (zoneH - cardH - stackStep * (rows.length - 1)) / 2)
            : Math.max(0, (zoneH - (cardH + step * (rows.length - 1))) / 2);

        rows.forEach((row: any, idx: number) => {
            const card = document.createElement('div');
            card.className = 'card-zone-card';
            const isSelected = idx === obj.selectedIndex;
            const isHighlighted = !!(obj.highlightField && row?.[obj.highlightField]);
            const borderColor = isSelected || isHighlighted
                ? String(obj.selectionColor || '#0ed7b5')
                : String(config.borderColor || 'transparent');
            const borderWidth = isSelected || isHighlighted
                ? Math.max(3, Number(config.borderWidth) || 0)
                : Math.max(0, Number(config.borderWidth) || 0);
            const boxShadow = isSelected
                ? `0 0 0 3px ${obj.selectionColor || '#0ed7b5'}`
                : isHighlighted
                    ? `0 0 10px 2px ${obj.selectionColor || '#0ed7b5'}`
                    : 'none';

            const left = orientation === 'vertical'
                ? startX
                : orientation === 'stack'
                    ? startX + idx * stackStep
                    : startX + idx * step;
            const top = orientation === 'horizontal'
                ? startY
                : orientation === 'stack'
                    ? startY + idx * stackStep
                    : startY + idx * step;

            card.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${cardW}px;height:${cardH}px;box-sizing:border-box;border:${Math.max(0, borderWidth)}px solid ${borderColor};border-radius:${config.borderRadius ?? 8}px;background:${config.backgroundColor || 'transparent'};padding:${config.padding ?? 0}px;overflow:hidden;${runMode ? 'cursor:pointer;' : ''}box-shadow:${boxShadow};z-index:${idx};`;

            const faceUp = obj.faceUpField ? row?.[obj.faceUpField] === true : true;
            const rawImage = faceUp ? row?.[obj.imageField || 'image'] : (obj.src || row?.[obj.imageField || 'image']);
            const imgSrc = this.resolveMediaPath(String(rawImage || ''), ctx);
            if (imgSrc) {
                const img = document.createElement('img');
                img.src = imgSrc;
                img.alt = String(row?.cardName || row?.name || row?.[obj.keyField || 'id'] || `Karte ${idx + 1}`);
                img.draggable = false;
                img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;pointer-events:none;';
                card.appendChild(img);
            } else {
                card.textContent = String(row?.cardName || row?.name || row?.[obj.keyField || 'id'] || '');
                card.style.display = 'flex';
                card.style.alignItems = 'center';
                card.style.justifyContent = 'center';
                card.style.font = '12px sans-serif';
            }

            if (runMode) {
                card.onclick = (e: MouseEvent) => {
                    e.stopPropagation();
                    const changed = obj.selectedIndex !== idx || obj.selectedRecord !== row;
                    if (typeof obj.selectRow === 'function') obj.selectRow(idx);
                    else {
                        obj.selectedIndex = idx;
                        obj.selectedRecord = row;
                        obj.selectedKey = row?.[obj.keyField || 'id'] ?? '';
                    }
                    if (ctx.host.onEvent) {
                        const data = { index: idx, data: row, key: obj.selectedKey };
                        if (changed) ctx.host.onEvent(obj.id, 'onSelectionChanged', data);
                        ctx.host.onEvent(obj.id, 'onRowClick', data);
                        ctx.host.onEvent(obj.id, 'onSelect', data);
                    }
                };
            }

            content.appendChild(card);
        });
    }

    private static stepFor(zoneW: number, zoneH: number, cardW: number, cardH: number, gap: number, count: number, orientation: string): number {
        if (count <= 1 || orientation === 'stack') return 0;
        const size = orientation === 'vertical' ? zoneH : zoneW;
        const cardSize = orientation === 'vertical' ? cardH : cardW;
        const requested = cardSize + gap;
        return Math.min(requested, Math.max(0, (size - cardSize) / (count - 1)));
    }

    private static resolveMediaPath(raw: string, ctx: IRenderContext): string {
        if (!raw) return '';
        let src = raw;
        if (src.includes('${')) {
            const vars = ctx.host.getVariableContext ? ctx.host.getVariableContext() : {};
            src = PropertyHelper.interpolate(src, vars, ctx.host.lastRenderedObjects || []);
        }
        if (!src) return '';
        if (!(src.startsWith('http') || src.startsWith('/') || src.startsWith('.') || src.startsWith('data:'))) {
            src = src.startsWith('images/') || src.startsWith('audio/') || src.startsWith('video/') || src.startsWith('assets/')
                ? './' + src
                : './images/' + src;
        }
        if (src.startsWith('/images/') || src.startsWith('/audio/')) src = '.' + src;
        if (!src.startsWith('data:')) {
            const parts = src.split('/');
            const lastPart = parts.pop() || '';
            src = [...parts, encodeURIComponent(lastPart)].join('/');
        }
        return dataUrlToBlobUrl(src);
    }
}
