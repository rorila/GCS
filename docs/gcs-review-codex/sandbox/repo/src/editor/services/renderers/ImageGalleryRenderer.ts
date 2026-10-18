import { IRenderContext } from './IRenderContext';
import { getGalleryItems, hasGalleryFolder, loadImageGalleryManifest, GalleryItem } from '../../../utils/ImageGalleryModel';

interface GalleryConfig {
    folder: string;
    columns: number;
    tileHeight: number;
    gap: number;
    selectionColor: string;
    showFileNames: boolean;
    selectedImage: string;
}

interface GalleryState {
    key: string;
    content: HTMLElement;
}

const states = new WeakMap<HTMLElement, GalleryState>();

function toConfig(obj: any, cellSize: number): GalleryConfig {
    const intIn = (value: any, min: number, max: number, fallback: number) => {
        const n = Math.round(Number(value));
        return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
    };
    return {
        folder: String(obj.folder || ''),
        columns: intIn(obj.columns, 1, 10, 4),
        tileHeight: Math.max(1, Number(obj.tileHeight) || 5) * cellSize,
        gap: Math.max(0, Math.min(60, Number(obj.gap) || 0)),
        selectionColor: String(obj.selectionColor || '#ffb300'),
        showFileNames: obj.showFileNames === true,
        selectedImage: String(obj.selectedImage || '')
    };
}

export class ImageGalleryRenderer {
    public static render(ctx: IRenderContext, el: HTMLElement, obj: any): void {
        const runMode = !!ctx.host.runMode;
        const cellSize = ctx.host.grid?.cellSize || 26;
        const config = toConfig(obj, cellSize);
        const key = JSON.stringify({ ...config, runMode });

        const previous = states.get(el);
        if (previous?.key === key && previous.content.parentElement === el) return;

        let content = previous?.content;
        if (!content || content.parentElement !== el) {
            content = document.createElement('div');
            content.className = 'image-gallery';
            content.style.cssText = 'position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;color:#dce7f5;font:14px sans-serif;';
            el.appendChild(content);
        }
        const state = { key, content };
        states.set(el, state);
        content.style.padding = '8px';
        content.textContent = 'Bilder werden geladen…';

        loadImageGalleryManifest().then(manifest => {
            if (states.get(el) !== state) return;
            if (!hasGalleryFolder(manifest, config.folder)) {
                content.textContent = config.folder
                    ? `Ordner „${config.folder}“ wurde im Medienmanifest nicht gefunden.`
                    : 'Das Medienmanifest enthält keine Bilder.';
                return;
            }
            const items = getGalleryItems(manifest, config.folder);
            if (!items.length) {
                content.textContent = 'In diesem Ordner sind keine Bilder enthalten.';
                return;
            }
            content.replaceChildren(this.createGrid(ctx, obj, config, items, runMode));
        }).catch(() => {
            if (states.get(el) === state) {
                content.textContent = 'Das Medienmanifest konnte nicht geladen werden.';
            }
        });
    }

    private static createGrid(ctx: IRenderContext, obj: any, config: GalleryConfig, items: GalleryItem[], runMode: boolean): HTMLElement {
        const grid = document.createElement('div');
        grid.style.cssText = `display:grid;grid-template-columns:repeat(${config.columns},1fr);gap:${config.gap}px;`;

        const tiles: HTMLElement[] = [];
        const markSelected = (selected: HTMLElement | null) => {
            for (const tile of tiles) {
                const active = tile === selected;
                tile.style.borderColor = active ? config.selectionColor : 'transparent';
                tile.style.boxShadow = active ? `0 0 0 3px ${config.selectionColor}` : 'none';
                tile.style.transform = active ? 'scale(1.02)' : 'none';
            }
        };

        for (const item of items) {
            const tile = document.createElement('div');
            tile.className = 'image-gallery-tile';
            tile.dataset.path = item.path;
            tile.style.cssText = `position:relative;height:${config.tileHeight}px;background:#0f172a;border:3px solid transparent;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:transform .15s,box-shadow .15s,border-color .15s;${runMode ? 'cursor:pointer;' : ''}`;

            const img = document.createElement('img');
            img.src = item.url;
            img.alt = item.file;
            img.loading = 'lazy';
            img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;flex:1;min-height:0;pointer-events:none;';
            img.onerror = () => {
                img.style.display = 'none';
                tile.style.color = '#f38ba8';
                tile.textContent = 'Bild fehlt';
            };
            tile.appendChild(img);

            if (config.showFileNames) {
                const label = document.createElement('div');
                label.textContent = item.file;
                label.title = item.file;
                label.style.cssText = 'width:100%;padding:3px 6px;font-size:11px;color:#aab8d0;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(0,0,0,.35);box-sizing:border-box;';
                tile.appendChild(label);
            }

            tiles.push(tile);
            if (item.path === config.selectedImage) markSelected(tile);

            if (runMode) {
                tile.onclick = (e: MouseEvent) => {
                    e.stopPropagation();
                    obj.selectedImage = item.path;
                    markSelected(tile);
                    ctx.host.onEvent?.(obj.id, 'onSelectionChanged', { path: item.path, file: item.file });
                };
            }
            grid.appendChild(tile);
        }
        return grid;
    }
}
