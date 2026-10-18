import { createPuzzleShape } from '../../../utils/PuzzleShape';
import { SpriteGeometry } from '../../../runtime/SpriteGeometry';
import type { ImagePiece } from '../../../utils/ImageSplitterModel';

const svgNS = 'http://www.w3.org/2000/svg';
let nextClipId = 0;
type PieceView = Pick<ImagePiece, 'sourceWidth' | 'sourceHeight' | 'x' | 'y' | 'width' | 'height' | 'puzzleEdges' | 'puzzleTabDepth'>;
const states = new WeakMap<HTMLElement, { key: string; svg: SVGSVGElement; overflow: string; contain: string; pointerEvents: string; border: string }>();

export class PuzzlePieceRenderer {
    public static createSvg(piece: PieceView, source: string, stroke: string, interactive = false): SVGSVGElement | null {
        const shape = createPuzzleShape(piece.width, piece.height, piece.puzzleEdges, Number(piece.puzzleTabDepth) || undefined);
        if (!shape) return null;
        const padding = shape.padding + Math.min(piece.width, piece.height) * 0.01;
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `${-padding} ${-padding} ${piece.width + 2 * padding} ${piece.height + 2 * padding}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.pointerEvents = 'none';
        const defs = document.createElementNS(svgNS, 'defs');
        const clip = document.createElementNS(svgNS, 'clipPath');
        const clipId = `gcs-puzzle-clip-${++nextClipId}`;
        clip.id = clipId;
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        const silhouette = document.createElementNS(svgNS, 'path');
        silhouette.setAttribute('d', shape.path);
        clip.appendChild(silhouette);
        defs.appendChild(clip);
        svg.appendChild(defs);
        const image = document.createElementNS(svgNS, 'image');
        image.setAttribute('href', source);
        image.setAttribute('x', String(-piece.x));
        image.setAttribute('y', String(-piece.y));
        image.setAttribute('width', String(piece.sourceWidth));
        image.setAttribute('height', String(piece.sourceHeight));
        image.setAttribute('preserveAspectRatio', 'none');
        image.setAttribute('clip-path', `url(#${clipId})`);
        image.style.pointerEvents = 'none';
        svg.appendChild(image);
        const outline = document.createElementNS(svgNS, 'path');
        outline.setAttribute('d', shape.path);
        outline.setAttribute('fill', 'transparent');
        outline.setAttribute('stroke', stroke || 'none');
        outline.setAttribute('stroke-width', '1');
        outline.setAttribute('stroke-linejoin', 'round');
        outline.setAttribute('vector-effect', 'non-scaling-stroke');
        outline.style.pointerEvents = interactive ? 'all' : 'none';
        svg.appendChild(outline);
        svg.setAttribute('x', String(piece.x - padding));
        svg.setAttribute('y', String(piece.y - padding));
        svg.setAttribute('width', String(piece.width + 2 * padding));
        svg.setAttribute('height', String(piece.height + 2 * padding));
        svg.dataset.padding = String(padding);
        return svg;
    }

    public static render(el: HTMLElement, obj: any, source: string, runMode: boolean): boolean {
        const piece: PieceView = {
            sourceWidth: Number(obj.sourceWidth), sourceHeight: Number(obj.sourceHeight),
            x: Number(obj.sourceRectX), y: Number(obj.sourceRectY),
            width: Number(obj.sourceRectWidth), height: Number(obj.sourceRectHeight),
            puzzleEdges: obj.puzzleEdges,
            puzzleTabDepth: Number(obj.puzzleTabDepth) || 0
        };
        if (!createPuzzleShape(piece.width, piece.height, piece.puzzleEdges, Number(obj.puzzleTabDepth) || undefined)
            || !SpriteGeometry.sourceRect(piece.sourceWidth, piece.sourceHeight, piece.x, piece.y, piece.width, piece.height)
            || ![Number(obj.width), Number(obj.height)].every(n => Number.isFinite(n) && n > 0)) return false;
        const key = JSON.stringify([piece, source, runMode]);
        const previous = states.get(el);
        if (!previous || previous.key !== key || previous.svg.parentElement !== el) {
            const svg = this.createSvg(piece, source, 'rgba(30,35,45,0.55)', runMode)!;
            svg.classList.add('puzzle-piece-layer');
            svg.style.position = 'absolute';
            previous?.svg.remove();
            el.querySelector('.sprite-image-layer')?.remove();
            el.childNodes.forEach(node => { if (node.nodeType === Node.TEXT_NODE) node.remove(); });
            el.appendChild(svg);
            states.set(el, {
                key, svg, overflow: previous?.overflow ?? el.style.overflow,
                contain: previous?.contain ?? el.style.contain,
                pointerEvents: previous?.pointerEvents ?? el.style.pointerEvents,
                border: previous?.border ?? el.style.border
            });
        }
        const svg = states.get(el)!.svg;
        const padding = Number(svg.dataset.padding);
        const fit = SpriteGeometry.containFit(piece.width / piece.height, Number(obj.width) / Number(obj.height));
        svg.style.left = `${fit.leftPercent - padding / piece.width * fit.widthPercent}%`;
        svg.style.top = `${fit.topPercent - padding / piece.height * fit.heightPercent}%`;
        svg.style.width = `${(1 + 2 * padding / piece.width) * fit.widthPercent}%`;
        svg.style.height = `${(1 + 2 * padding / piece.height) * fit.heightPercent}%`;
        el.dataset.puzzlePiece = 'true';
        el.style.overflow = 'visible';
        el.style.contain = 'layout style';
        el.style.pointerEvents = runMode ? 'none' : 'auto';
        el.style.border = 'none';
        el.style.borderRadius = '0';
        return true;
    }

    public static clear(el: HTMLElement): void {
        const state = states.get(el);
        if (!state) return;
        state.svg.remove();
        el.style.overflow = state.overflow;
        el.style.contain = state.contain;
        el.style.pointerEvents = state.pointerEvents;
        el.style.border = state.border;
        delete el.dataset.puzzlePiece;
        states.delete(el);
    }
}
