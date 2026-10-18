import { ComponentData, GameProject, StageDefinition } from '../../model/types';

interface PreviewObject {
    id: string; kind: string; name: string; text: string; src: string;
    x: number; y: number; width: number; height: number; z: number;
    color: string; background: string; border: string; font: number; hidden: boolean;
}
export interface StagePreviewScene { cols: number; rows: number; cell: number; background: string; objects: PreviewObject[]; technical: boolean }
const number = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const text = (value: unknown) => typeof value === 'string' ? value.replace(/\$\{[^}]*\}/g, '…') : '';

/** Read only design data. Never hydrate components or execute stage logic. */
export function stagePreviewScene(project: GameProject, stage: StageDefinition): StagePreviewScene {
    const grid = stage.grid || project.stage.grid;
    const technical = stage.id.startsWith('stage_server_') || stage.type === 'blueprint';
    const objects: PreviewObject[] = [], seen = new Set<string>();
    const append = (items: ComponentData[], parentX = 0, parentY = 0) => {
        for (const o of items) {
            if (seen.has(o.id)) continue;
            seen.add(o.id);
            const x = number(o.x, 0) + parentX, y = number(o.y, 0) + parentY;
            if (!technical && (o.isService || o.isVariable || o.isHiddenInRun)) continue;
            const raw = o as ComponentData & { src?: string; caption?: string; placeholder?: string };
            objects.push({ id: o.id, kind: o.className, name: o.name, text: text(o.text || raw.caption || raw.placeholder), src: text(raw.src),
                x, y, width: Math.max(.2, number(o.width, 4)), height: Math.max(.2, number(o.height, 2)), z: number(o.zIndex, 0),
                color: String(o.style?.color || '#e2e8f0'), background: String(o.style?.backgroundColor || ''), border: String(o.style?.borderColor || ''),
                font: number(o.style?.fontSize, 14), hidden: o.visible === false });
            if (o.children) append(o.children, x, y);
        }
    };
    if (stage.type !== 'blueprint') {
        const blueprint = project.stages?.find(s => s.type === 'blueprint');
        const excluded = new Set(stage.excludedBlueprintIds || []);
        const localIds = new Set(stage.objects.map(o => o.id));
        append((blueprint?.objects || []).filter(o => !excluded.has(o.id) && !localIds.has(o.id)));
    }
    append(stage.objects);
    objects.sort((a, b) => a.z - b.z);
    const cols = Math.max(1, number(grid.cols, 64)), rows = Math.max(1, number(grid.rows, 40));
    return { cols: technical ? Math.max(cols, ...objects.map(o => o.x + o.width + 1)) : cols,
        rows: technical ? Math.max(rows, ...objects.map(o => o.y + o.height + 1)) : rows,
        cell: Math.max(1, number(grid.cellSize, 18)), background: stage.backgroundColor || grid.backgroundColor || '#122b39', objects, technical };
}

export class StageThumbnailService {
    private entries = new Map<string, { signature: string; url: string }>();
    private images = new Map<string, Promise<HTMLImageElement | null>>();
    private disposed = false;

    dispose(): void {
        this.disposed = true;
        for (const entry of this.entries.values()) URL.revokeObjectURL(entry.url);
        this.entries.clear(); this.images.clear();
    }

    private loadImage(src: string): Promise<HTMLImageElement | null> {
        if (!src || src.includes('…')) return Promise.resolve(null);
        let url: URL;
        try { url = new URL(src, location.href); } catch { return Promise.resolve(null); }
        // Avoid canvas tainting and requests to remote image hosts.
        if (url.origin !== location.origin && !src.startsWith('data:image/') && !src.startsWith('blob:')) return Promise.resolve(null);
        if (!['http:', 'https:', 'data:', 'blob:'].includes(url.protocol)) return Promise.resolve(null);
        const known = this.images.get(src); if (known) return known;
        const pending = new Promise<HTMLImageElement | null>(resolve => {
            const image = new Image();
            const finish = (loaded: boolean) => { clearTimeout(timer); image.onload = null; image.onerror = null; resolve(loaded ? image : null); };
            const timer = setTimeout(() => finish(false), 1200);
            image.onload = () => finish(true); image.onerror = () => finish(false); image.src = src;
        });
        // Bound decoded image retention as well as the thumbnail cache.
        if (this.images.size >= 120) this.images.delete(this.images.keys().next().value!);
        this.images.set(src, pending);
        return pending;
    }

    async thumbnail(stageId: string, scene: StagePreviewScene): Promise<string> {
        const signature = JSON.stringify(scene), old = this.entries.get(stageId);
        if (old?.signature === signature) {
            this.entries.delete(stageId); this.entries.set(stageId, old);
            return old.url;
        }
        const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 225;
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas nicht verfügbar');
        ctx.fillStyle = scene.background; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / scene.cols, canvas.height / scene.rows);
        const ox = (canvas.width - scene.cols * scale) / 2, oy = (canvas.height - scene.rows * scale) / 2;
        const sources = [...new Set(scene.objects.filter(o => o.kind === 'TImage').map(o => o.src))];
        const images = new Map(await Promise.all(sources.map(async src => [src, await this.loadImage(src)] as const)));
        for (const o of scene.objects) {
            const x = ox + o.x * scale, y = oy + o.y * scale, w = o.width * scale, h = o.height * scale;
            ctx.save(); ctx.globalAlpha = o.hidden ? .4 : 1;
            ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
            const control = /Button|Edit|Dropdown|Table|Picker/.test(o.kind);
            const panel = /Panel|Memo|Window/.test(o.kind);
            if (o.background && o.background !== 'transparent' || control || panel || scene.technical) {
                ctx.fillStyle = o.background && o.background !== 'transparent' ? o.background : scene.technical ? '#193b49' : control ? '#214b59' : '#142837';
                ctx.fillRect(x, y, w, h);
            }
            if (o.border || control || scene.technical) { ctx.strokeStyle = o.border || '#3b7182'; ctx.lineWidth = .6; ctx.strokeRect(x + .3, y + .3, w - .6, h - .6); }
            const image = images.get(o.src);
            if (o.kind === 'TImage' && image) ctx.drawImage(image, x, y, w, h);
            else if (o.kind === 'TImage') {
                ctx.fillStyle = '#315b6d'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#b9d1da';
                ctx.beginPath(); ctx.arc(x + w / 2, y + h * .35, Math.min(w, h) * .15, 0, Math.PI * 2); ctx.fill();
            }
            if (/Table/.test(o.kind)) {
                ctx.strokeStyle = '#4b6978'; ctx.lineWidth = .4;
                for (let row = 1; row <= 4; row++) { ctx.beginPath(); ctx.moveTo(x, y + row * h / 5); ctx.lineTo(x + w, y + row * h / 5); ctx.stroke(); }
            }
            ctx.fillStyle = o.color;
            ctx.font = `${Math.max(3, Math.min(12, o.font / scene.cell * scale))}px Segoe UI, sans-serif`;
            ctx.textBaseline = 'middle';
            const caption = scene.technical ? `${o.name} · ${o.kind}` : o.text;
            if (caption) ctx.fillText(caption.split('\n')[0], x + 2, y + Math.min(h / 2, 9), Math.max(1, w - 4));
            ctx.restore();
        }
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Vorschau konnte nicht erstellt werden')), 'image/webp', .8));
        if (this.disposed) throw new Error('Vorschau geschlossen');
        const url = URL.createObjectURL(blob);
        if (old) URL.revokeObjectURL(old.url);
        this.entries.delete(stageId); this.entries.set(stageId, { signature, url });
        if (this.entries.size > 120) { const oldest = this.entries.keys().next().value!; URL.revokeObjectURL(this.entries.get(oldest)!.url); this.entries.delete(oldest); }
        return url;
    }
}
