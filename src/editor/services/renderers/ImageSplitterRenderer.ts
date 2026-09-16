import { ImageSplitConfig, createImagePieces, loadSplitterImage, resolveSplitterImageSource, validateImageSplit } from '../../../utils/ImageSplitterModel';

interface PreviewConfig extends ImageSplitConfig {
    showLines?: boolean;
    lineColor?: string;
    previewGap?: number;
}

interface PreviewState {
    key: string;
    source: string;
    size: Promise<{ width: number; height: number }> | null;
    content: HTMLElement;
}

const previews = new WeakMap<HTMLElement, PreviewState>();
const svgNS = 'http://www.w3.org/2000/svg';

export class ImageSplitterRenderer {
    public static render(el: HTMLElement, obj: PreviewConfig): void {
        const config = {
            id: obj.id, imageSource: obj.imageSource || '', rows: obj.rows ?? 2, columns: obj.columns ?? 3,
            showLines: obj.showLines !== false, lineColor: obj.lineColor || '#ffffff', previewGap: obj.previewGap ?? 0
        };
        const key = JSON.stringify(config);
        const previous = previews.get(el);
        if (previous?.key === key && previous.content.parentElement === el) return;
        let content = previous?.content;
        if (!content || content.parentElement !== el) {
            content = document.createElement('div');
            content.className = 'image-splitter-preview';
            content.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none;color:#dce7f5;font:14px sans-serif;text-align:center;';
            el.appendChild(content);
        }
        const error = validateImageSplit(config);
        content.textContent = error || 'Bild wird geladen…';
        if (error) {
            previews.set(el, { key, source: config.imageSource, size: null, content });
            return;
        }
        const size = (previous?.source === config.imageSource && previous.size) || loadSplitterImage(config.imageSource);
        const state = { key, source: config.imageSource, size, content };
        previews.set(el, state);
        size.then(dimensions => {
            if (previews.get(el) !== state) return;
            const svg = this.createPreview(config, dimensions.width, dimensions.height);
            content.replaceChildren(svg);
            content.title = `${dimensions.width} × ${dimensions.height} Pixel; ${config.rows * config.columns} Teile`;
        }).catch(error => {
            if (previews.get(el) === state) content.textContent = error instanceof Error ? error.message : String(error);
        });
    }

    public static createPreview(config: PreviewConfig, width: number, height: number): SVGSVGElement {
        const pieces = createImagePieces(config, width, height);
        const gap = Number.isFinite(config.previewGap) ? Math.max(0, Math.min(100, config.previewGap!)) : 0;
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${width + (config.columns - 1) * gap} ${height + (config.rows - 1) * gap}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('aria-label', `Bildaufteilung: ${config.rows} Zeilen, ${config.columns} Spalten`);
        const source = resolveSplitterImageSource(config.imageSource);
        for (const piece of pieces) {
            const tile = document.createElementNS(svgNS, 'svg');
            tile.setAttribute('data-piece-index', String(piece.index));
            tile.setAttribute('x', String(piece.x + piece.column * gap));
            tile.setAttribute('y', String(piece.y + piece.row * gap));
            tile.setAttribute('width', String(piece.width));
            tile.setAttribute('height', String(piece.height));
            tile.setAttribute('viewBox', `${piece.x} ${piece.y} ${piece.width} ${piece.height}`);
            tile.setAttribute('overflow', 'hidden');
            tile.setAttribute('preserveAspectRatio', 'none');
            const image = document.createElementNS(svgNS, 'image');
            image.setAttribute('href', source);
            image.setAttribute('width', String(width));
            image.setAttribute('height', String(height));
            image.setAttribute('preserveAspectRatio', 'none');
            tile.appendChild(image);
            if (config.showLines !== false) {
                const line = document.createElementNS(svgNS, 'rect');
                for (const name of ['x', 'y', 'width', 'height'] as const) line.setAttribute(name, String(piece[name]));
                line.setAttribute('fill', 'none');
                line.setAttribute('stroke', config.lineColor || '#ffffff');
                line.setAttribute('stroke-width', '2');
                line.setAttribute('vector-effect', 'non-scaling-stroke');
                tile.appendChild(line);
            }
            svg.appendChild(tile);
        }
        return svg;
    }
}
