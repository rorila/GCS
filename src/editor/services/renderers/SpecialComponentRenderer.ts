import type { StageHost } from '../StageRenderer';
import { PropertyHelper } from '../../../runtime/PropertyHelper';

const DEFAULT_NO_FRAMES_SVG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="8" fill="#252536"/><rect x="8" y="18" width="48" height="28" rx="4" stroke="#7f849c" stroke-width="3" fill="none"/><circle cx="24" cy="32" r="7" fill="#7f849c"/><path d="M38 26L48 32L38 38V26Z" fill="#7f849c"/><rect x="10" y="14" width="6" height="4" rx="1" fill="#7f849c"/><rect x="48" y="14" width="6" height="4" rx="1" fill="#7f849c"/><rect x="10" y="46" width="6" height="4" rx="1" fill="#7f849c"/><rect x="48" y="46" width="6" height="4" rx="1" fill="#7f849c"/></svg>');

export interface ISpecialComponentContext {
    host: StageHost;
    getVariableContext(): Record<string, any>;
}

export class SpecialComponentRenderer {
    /**
     * Rendert einen TSpawner: Design-Mode Platzhalter, da der Spawner zur Laufzeit unsichtbar ist.
     */
    public static renderSpawner(el: HTMLElement, obj: any): void {
        el.innerHTML = '';
        el.style.background = 'rgba(16, 185, 129, 0.15)';
        el.style.border = '1px dashed rgba(16, 185, 129, 0.6)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = '#34d399';
        el.style.fontSize = '12px';
        el.style.fontFamily = 'sans-serif';
        el.style.textAlign = 'center';
        el.textContent = `Spawner: ${obj.templateName || '---'}\n${obj.spawnInterval}s`;
        el.style.whiteSpace = 'pre-line';
    }

    /**
     * Rendert TSpeedlines: Übergibt das DOM-Element an die Komponente.
     */
    public static renderSpeedlines(el: HTMLElement, obj: any, cellSize: number, runMode: boolean): void {
        if (!obj || typeof obj.setElement !== 'function') return;
        obj.setElement(el, cellSize, runMode);
    }

    /**
     * Rendert einen TParallaxBackground: Übergibt das DOM-Element an die Komponente,
     * die sich selbst um das Aufbauen und Animieren der Ebenen kümmert.
     */
    public static renderParallaxBackground(el: HTMLElement, obj: any, cellSize: number, runMode: boolean): void {
        if (!obj || typeof obj.setElement !== 'function') return;
        obj.setElement(el, cellSize, runMode);
    }

    /**
     * Standard-Platzhalter für TImageList/TAnimation ohne Frames/Bild.
     * Zeigt ein SVG-Default-Bild und den Komponententyp als Text.
     */
    public static renderDefaultImagePlaceholder(el: HTMLElement, label: string): void {
        el.style.backgroundImage = `url("${DEFAULT_NO_FRAMES_SVG}")`;
        el.style.backgroundSize = 'contain';
        el.style.backgroundPosition = 'center';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.backgroundColor = '#1e1e2e';

        el.querySelector('.animation-type-label')?.remove();
        let labelEl = el.querySelector('.component-type-label') as HTMLElement;
        if (!labelEl) {
            labelEl = document.createElement('div');
            labelEl.className = 'component-type-label';
            labelEl.style.cssText = `
                position: absolute;
                bottom: 4px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(30, 30, 46, 0.85);
                color: #89b4fa;
                font-size: 10px;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 3px;
                pointer-events: none;
                z-index: 10;
                white-space: nowrap;
            `;
            el.appendChild(labelEl);
        }
        labelEl.textContent = label;
    }

    /**
     * Rendert eine TImageList: Zeigt den aktuellen Frame des Sprite-Sheets an.
     * Nutzt CSS background-size + background-position für pixelgenaues Clipping.
     */
    public static renderImageList(ctx: ISpecialComponentContext, el: HTMLElement, obj: any): void {
        let src = obj.backgroundImage || obj.src || '';
        const hCount = obj.imageCountHorizontal || 1;
        const vCount = obj.imageCountVertical || 1;
        const currentFrame = obj.currentImageNumber || 0;

        if (src && typeof src === 'string') {
            const vars = ctx.getVariableContext();
            const objects = ctx.host.lastRenderedObjects || [];
            for (let i = 0; i < 3 && typeof src === 'string' && src.includes('${'); i++) {
                src = PropertyHelper.interpolate(src, vars, objects);
            }
        }

        if (!src) {
            SpecialComponentRenderer.renderDefaultImagePlaceholder(el, 'ImageList');
            return;
        }

        const existing = el.querySelector('.imagelist-placeholder');
        if (existing) existing.remove();
        el.querySelector('.component-type-label')?.remove();

        let imgSrc = src;
        if (!imgSrc.startsWith('http') && !imgSrc.startsWith('/') && !imgSrc.startsWith('.') && !imgSrc.startsWith('data:')) {
            imgSrc = `./images/${imgSrc}`;
        }
        if (imgSrc.startsWith('/images/') || imgSrc.startsWith('/audio/')) {
            imgSrc = '.' + imgSrc;
        }
        if (!imgSrc.startsWith('data:')) {
            const parts = imgSrc.split('/');
            const lastPart = parts.pop() || '';
            imgSrc = [...parts, encodeURIComponent(lastPart)].join('/');
        }

        const col = currentFrame % hCount;
        const row = Math.floor(currentFrame / hCount);

        const bgSizeX = hCount * 100;
        const bgSizeY = vCount * 100;
        const bgPosX = hCount <= 1 ? 0 : (col / (hCount - 1)) * 100;
        const bgPosY = vCount <= 1 ? 0 : (row / (vCount - 1)) * 100;

        el.style.backgroundImage = `url("${imgSrc}")`;
        el.style.backgroundSize = `${bgSizeX}% ${bgSizeY}%`;
        el.style.backgroundPosition = `${bgPosX}% ${bgPosY}%`;
        el.style.backgroundRepeat = 'no-repeat';

        if (!ctx.host.runMode) {
            let badge = el.querySelector('.imagelist-badge') as HTMLElement;
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'imagelist-badge';
                badge.style.cssText = `
                    position: absolute; top: 2px; right: 2px;
                    background: rgba(30, 30, 46, 0.85); color: #89b4fa;
                    font-size: 10px; font-weight: bold; padding: 2px 6px;
                    border-radius: 3px; pointer-events: none; z-index: 10;
                `;
                el.appendChild(badge);
            }
            badge.textContent = `#${currentFrame}/${hCount * vCount}`;
        } else {
            const badge = el.querySelector('.imagelist-badge');
            if (badge) badge.remove();
        }
    }

    /**
     * Rendert TVideo: Platzhalter im Editor, echtes <video>-Element im Run-Mode.
     */
    public static renderVideo(ctx: ISpecialComponentContext, el: HTMLElement, obj: any): void {
        const runMode = ctx.host.runMode;
        const src = obj._videoSource || obj.videoSource || '';

        if (!runMode) {
            const existing = el.querySelector('video');
            if (existing) existing.remove();
            if (!el.querySelector('.tvideo-placeholder')) {
                el.innerHTML = '';
                const ph = document.createElement('div');
                ph.className = 'tvideo-placeholder';
                ph.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;opacity:0.5;pointer-events:none;background:#000;color:#fff;';
                ph.textContent = '🎥';
                el.appendChild(ph);
            }
            return;
        }

        let videoEl = el.querySelector('video') as HTMLVideoElement | null;
        const placeholder = el.querySelector('.tvideo-placeholder');
        if (placeholder) placeholder.remove();

        if (!videoEl) {
            el.innerHTML = '';
            videoEl = document.createElement('video');
            videoEl.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;';
            el.appendChild(videoEl);
        }

        const normalizedSrc = src.startsWith('data:') ? src : (src.startsWith('/videos/') ? '.' + src : src);
        if (videoEl.getAttribute('src') !== normalizedSrc) {
            videoEl.src = normalizedSrc;
        }
        videoEl.style.objectFit = (obj._objectFit || obj.objectFit || 'contain') as any;
        videoEl.style.opacity = String(obj._imageOpacity ?? obj.imageOpacity ?? 1);
        videoEl.loop = !!(obj._loop ?? obj.loop);
        videoEl.muted = !!(obj._muted ?? obj.muted);
        videoEl.playbackRate = obj._playbackRate ?? obj.playbackRate ?? 1;

        if (obj.resetRequested) {
            videoEl.currentTime = 0;
            obj.resetRequested = false;
        }

        const shouldPlay = !!(obj._isPlaying ?? obj.isPlaying);
        if (shouldPlay && videoEl.paused) videoEl.play().catch(() => {});
        else if (!shouldPlay && !videoEl.paused) videoEl.pause();
    }

    /**
     * Rendert TLink: klickbarer Link-Text der eine URL in einem neuen Tab öffnet.
     */
    public static renderLink(ctx: ISpecialComponentContext, el: HTMLElement, obj: any): void {
        const text = obj.text || obj.name || 'Link';
        const underline = obj.underline !== false;
        const color = obj.style?.color || '#4fc3f7';
        const fontSize = obj.style?.fontSize || 14;

        let span = el.querySelector('.tlink-text') as HTMLElement | null;
        if (!span) {
            el.innerHTML = '';
            span = document.createElement('span');
            span.className = 'tlink-text';
            el.appendChild(span);
        }
        span.textContent = text;
        span.style.cssText = `color:${color};font-size:${fontSize}px;text-decoration:${underline ? 'underline' : 'none'};cursor:pointer;`;

        if (ctx.host.runMode) {
            el.onclick = (e) => {
                e.stopPropagation();
                if (obj.events?.onClick && ctx.host.onEvent) ctx.host.onEvent(obj.id, 'onClick');
                else if (typeof obj.open === 'function') obj.open();
            };
        } else {
            el.onclick = null;
        }
    }
}
