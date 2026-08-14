import { IRenderContext } from './IRenderContext';
import { projectObjectRegistry } from '../../../services/registry/ObjectRegistry';
import { PropertyHelper } from '../../../runtime/PropertyHelper';
import { Logger } from '../../../utils/Logger';

const spriteLogger = Logger.get('SpriteRenderer', 'Asset_Diagnostics');

export class SpriteRenderer {
    public static render(ctx: IRenderContext, el: HTMLElement, obj: any): void {
        const appearanceMode = obj.appearanceMode || (obj.animationId ? 'animation' : (obj.imageListId ? 'spritesheet' : (obj.videoSource ? 'video' : (obj.backgroundImage ? 'simple' : 'simple'))));
        let imageListId = obj.imageListId || '';
        const useImageList = appearanceMode === 'spritesheet' || appearanceMode === 'animation';
        const hasDirectImage = appearanceMode === 'simple' && !!obj.backgroundImage;
        const hasVideo = appearanceMode === 'video' && !!obj.videoSource;

        // Bei Animation: TAnimation auflösen und deren imageListId verwenden
        if (appearanceMode === 'animation' && obj.animationId) {
            let animObj = ctx.host.lastRenderedObjects.find(o => (o.name === obj.animationId || o.id === obj.animationId) && (o.className === 'TAnimation' || o.constructor?.name === 'TAnimation'));
            if (!animObj) {
                animObj = projectObjectRegistry.getObjects().find((o: any) => (o.name === obj.animationId || o.id === obj.animationId) && (o.className === 'TAnimation' || o.constructor?.name === 'TAnimation'));
            }
            if (animObj) {
                imageListId = animObj.imageListId || '';
            }
        }

        let imageListObj: any = null;
        const hasImageList = useImageList && !!imageListId;
        if (hasImageList) {
            imageListObj = ctx.host.lastRenderedObjects.find(o =>
                (o.name === imageListId || o.id === imageListId) &&
                (o.className === 'TImageList' || o.constructor?.name === 'TImageList')
            );

            // Fallback: If TImageList is a global object not currently rendered on the stage
            if (!imageListObj) {
                const registryObjs = projectObjectRegistry.getObjects();
                imageListObj = registryObjs.find((o: any) =>
                    (o.name === imageListId || o.id === imageListId) &&
                    (o.className === 'TImageList' || o.constructor?.name === 'TImageList')
                );
            }
        }

        const effectiveHasMedia = hasDirectImage || (hasImageList && imageListObj && (imageListObj.backgroundImage || imageListObj.src)) || hasVideo;

        if ((obj.className === 'TSprite' || obj.className === 'TSpriteTemplate') && !effectiveHasMedia && !(el as any)._spriteNoMediaDiag) {
            (el as any)._spriteNoMediaDiag = true;
            spriteLogger.warn('[SPRITE-DIAG] TSprite hat kein Medium', {
                name: obj.name,
                id: obj.id,
                className: obj.className,
                appearanceMode,
                animationId: obj.animationId,
                imageListId,
                imageListObjFound: !!imageListObj,
                imageListObjName: imageListObj?.name,
                imageListObjBackgroundImage: imageListObj?.backgroundImage,
                imageListObjSrc: imageListObj?.src,
                hasImageList,
                hasDirectImage,
                hasVideo,
                objBackgroundImage: obj.backgroundImage,
                objSrc: obj.src,
                objVideoSource: obj.videoSource
            });
        }

        el.style.backgroundColor = effectiveHasMedia ? 'transparent' : (obj.style?.backgroundColor || obj.spriteColor || '#ff6b6b');

        if (effectiveHasMedia) {
            el.style.borderColor = 'transparent';

            let imgEl = el.querySelector('.sprite-image-layer') as HTMLElement;
            const expectedTag = hasVideo ? 'video' : (imageListObj ? 'div' : 'img');

            let bgImg = '';
            let src = '';
            const resolveSrc = (raw: string) => {
                if (raw && typeof raw === 'string' && raw.includes('${')) {
                    const vars = ctx.host.getVariableContext ? ctx.host.getVariableContext() : {};
                    const objects = ctx.host.lastRenderedObjects || [];
                    raw = PropertyHelper.interpolate(raw, vars, objects);
                }
                return raw;
            };

            if (hasVideo) {
                bgImg = resolveSrc(obj.videoSource || '');
                src = (bgImg.startsWith('http') || bgImg.startsWith('/') || bgImg.startsWith('.') || bgImg.startsWith('data:'))
                    ? bgImg
                    : `./videos/${bgImg}`;
                if (src.startsWith('/videos/')) src = '.' + src;
            } else {
                if (imageListObj) {
                    bgImg = resolveSrc(imageListObj.backgroundImage || imageListObj.src || '');
                } else {
                    bgImg = resolveSrc(obj.backgroundImage || '');
                }
                src = (bgImg.startsWith('http') || bgImg.startsWith('/') || bgImg.startsWith('.') || bgImg.startsWith('data:'))
                    ? bgImg
                    : `./images/${bgImg}`;
                if (src.startsWith('/images/') || src.startsWith('/audio/')) {
                    src = '.' + src;
                }
            }

            // ── DIAGNOSE: Pfad-Auflösung ──
            if (!(el as any)._spritePathLogged) {
                spriteLogger.info(`[PATH-DIAG] Sprite "${obj.name}" (${obj.id}): raw="${bgImg.substring(0, 80)}" → resolved="${src.substring(0, 120)}" runMode=${ctx.host.runMode}`);
                (el as any)._spritePathLogged = true;
            }

            const isCorrectLayer = imgEl && imgEl.tagName.toLowerCase() === expectedTag;
            if (!isCorrectLayer) {
                if (imgEl) imgEl.remove();

                if (imageListObj) {
                    imgEl = document.createElement('div');
                } else if (hasVideo) {
                    imgEl = document.createElement('video');
                    (imgEl as HTMLVideoElement).onerror = () => { imgEl.style.display = 'none'; };
                } else {
                    imgEl = document.createElement('img');
                    (imgEl as HTMLImageElement).onerror = () => { imgEl.style.display = 'none'; };
                    imgEl.style.willChange = 'transform';
                    imgEl.style.backfaceVisibility = 'hidden';
                }

                imgEl.className = 'sprite-image-layer';
                imgEl.style.position = 'absolute';
                imgEl.style.top = '0';
                imgEl.style.left = '0';
                imgEl.style.width = '100%';
                imgEl.style.height = '100%';
                imgEl.style.pointerEvents = 'none';
                imgEl.style.userSelect = 'none';
                imgEl.draggable = false;

                el.appendChild(imgEl);
            }

            if (imageListObj) {
                const hCount = imageListObj.imageCountHorizontal || 1;
                const vCount = imageListObj.imageCountVertical || 1;
                const rawIndex = appearanceMode === 'animation'
                    ? (obj.imageIndex !== undefined && obj.imageIndex >= 0 ? obj.imageIndex : 0)
                    : (obj.imageIndex !== undefined && obj.imageIndex >= 0 ? obj.imageIndex : (imageListObj.currentImageNumber || 0));
                const currentFrame = Math.max(0, Math.min(rawIndex, (hCount * vCount) - 1));

                const col = currentFrame % hCount;
                const row = Math.floor(currentFrame / hCount);

                const bgSizeX = hCount * 100;
                const bgSizeY = vCount * 100;
                const bgPosX = hCount <= 1 ? 0 : (col / (hCount - 1)) * 100;
                const bgPosY = vCount <= 1 ? 0 : (row / (vCount - 1)) * 100;

                // PERF: Styles nur schreiben, wenn sich der Wert geändert hat.
                // Im Standalone-Export sind Bilder als Base64-Data-URL eingebettet — eine
                // erneute Zuweisung kostet dort pro Frame das Parsen eines mehrere MB
                // großen Strings und war die Ursache für Ruckeln.
                const cache = imgEl as any;
                if (cache._bgSrc !== src) {
                    cache._bgSrc = src;
                    imgEl.style.backgroundImage = `url("${SpriteRenderer.encodeImageUrl(src)}")`;
                }

                const bgSize = `${bgSizeX}% ${bgSizeY}%`;
                if (cache._bgSize !== bgSize) {
                    cache._bgSize = bgSize;
                    imgEl.style.backgroundSize = bgSize;
                }

                const bgPos = `${bgPosX}% ${bgPosY}%`;
                if (cache._bgPos !== bgPos) {
                    cache._bgPos = bgPos;
                    imgEl.style.backgroundPosition = bgPos;
                }

                if (!cache._bgRepeatSet) {
                    cache._bgRepeatSet = true;
                    imgEl.style.backgroundRepeat = 'no-repeat';
                }
                if (imgEl.style.display !== '') imgEl.style.display = '';
            } else if (hasVideo) {
                const videoEl = imgEl as HTMLVideoElement;
                if (videoEl.getAttribute('src') !== src) {
                    videoEl.src = src;
                    videoEl.load();
                }
                videoEl.style.objectFit = obj.videoObjectFit || 'contain';
                videoEl.playbackRate = typeof obj.videoPlaybackRate === 'number' ? Math.max(0.1, obj.videoPlaybackRate) : 1;
                if (ctx.host.runMode) {
                    videoEl.autoplay = obj.videoAutoplay;
                    videoEl.loop = obj.videoLoop;
                    videoEl.muted = obj.videoMuted;
                    videoEl.volume = typeof obj.videoVolume === 'number' ? Math.max(0, Math.min(1, obj.videoVolume)) : 1;
                    videoEl.play().catch(() => { /* Autoplay may be blocked */ });
                } else {
                    videoEl.autoplay = false;
                    videoEl.loop = false;
                    videoEl.muted = true;
                    videoEl.volume = 0;
                    videoEl.pause();
                }
                videoEl.style.display = '';
            } else {
                const imgNode = imgEl as HTMLImageElement;
                if (imgNode.getAttribute('src') !== src) {
                    imgNode.src = src;
                    imgNode.style.display = '';
                }
                imgNode.style.objectFit = obj.objectFit || 'contain';
            }
            imgEl.style.borderRadius = obj.shape === 'circle' ? '50%' : '0';
        } else {
            const oldImg = el.querySelector('.sprite-image-layer');
            if (oldImg) oldImg.remove();
        }

        el.style.borderRadius = obj.shape === 'circle' ? '50%' : '0';

        if (!ctx.host.runMode && obj.customHitbox) {
            let hbEl = el.querySelector('.hitbox-debug-layer') as HTMLElement;
            if (!hbEl) {
                hbEl = document.createElement('div');
                hbEl.className = 'hitbox-debug-layer';
                hbEl.style.position = 'absolute';
                hbEl.style.border = '2px dashed red';
                hbEl.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
                hbEl.style.pointerEvents = 'none';
                hbEl.style.zIndex = '100';
                el.appendChild(hbEl);
            }

            const w = (obj.hitboxWidth && obj.hitboxWidth > 0) ? obj.hitboxWidth : obj.width;
            const h = (obj.hitboxHeight && obj.hitboxHeight > 0) ? obj.hitboxHeight : obj.height;
            const x = obj.hitboxOffsetX || 0;
            const y = obj.hitboxOffsetY || 0;
            const shape = (obj.hitboxShape === 'auto' || !obj.hitboxShape) ? obj.shape : obj.hitboxShape;

            const wPct = obj.width > 0 ? (w / obj.width) * 100 : 100;
            const hPct = obj.height > 0 ? (h / obj.height) * 100 : 100;
            const xPct = obj.width > 0 ? (x / obj.width) * 100 : 0;
            const yPct = obj.height > 0 ? (y / obj.height) * 100 : 0;

            hbEl.style.left = `${xPct}%`;
            hbEl.style.top = `${yPct}%`;
            hbEl.style.width = `${wPct}%`;
            hbEl.style.height = `${hPct}%`;
            hbEl.style.borderRadius = shape === 'circle' ? '50%' : '0';
            hbEl.style.display = 'block';
        } else {
            const oldHb = el.querySelector('.hitbox-debug-layer');
            if (oldHb) oldHb.remove();
        }

        if (obj.style?.color) el.style.color = obj.style.color;

        const textValue = obj.caption || (ctx.host.runMode ? '' : obj.name);
        if (el.innerText !== textValue) {
            if (!effectiveHasMedia) {
                el.innerText = textValue;
            }
        }
    }

    private static encodeImageUrl(url: string): string {
        if (!url || url.startsWith('data:')) return url;
        const parts = url.split('/');
        const last = encodeURIComponent(parts.pop() || '');
        return [...parts, last].join('/');
    }
}
