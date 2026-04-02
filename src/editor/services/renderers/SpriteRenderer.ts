import { IRenderContext } from './IRenderContext';
import { ProjectRegistry } from '../../../services/ProjectRegistry';

export class SpriteRenderer {
    public static render(ctx: IRenderContext, el: HTMLElement, obj: any): void {
        const hasImageList = !!obj.imageListId;
        const hasDirectImage = !!obj.backgroundImage;
        
        let imageListObj: any = null;
        if (hasImageList) {
            imageListObj = ctx.host.lastRenderedObjects.find(o => o.name === obj.imageListId || o.id === obj.imageListId);
            
            // Fallback: If TImageList is a global object not currently rendered on the stage
            if (!imageListObj) {
                const registryObjs = ProjectRegistry.getInstance().getObjects();
                imageListObj = registryObjs.find((o: any) => o.name === obj.imageListId || o.id === obj.imageListId);
            }
        }

        const effectiveHasImage = hasDirectImage || (hasImageList && imageListObj && (imageListObj.backgroundImage || imageListObj.src));
        
        el.style.backgroundColor = effectiveHasImage ? 'transparent' : (obj.style?.backgroundColor || obj.spriteColor || '#ff6b6b');
        
        if (effectiveHasImage) {
            el.style.borderColor = 'transparent';

            let imgEl = el.querySelector('.sprite-image-layer') as HTMLElement;
            let isDivLayer = imgEl && imgEl.tagName.toLowerCase() === 'div';

            let bgImg = '';
            if (imageListObj) {
                bgImg = imageListObj.backgroundImage || imageListObj.src || '';
            } else {
                bgImg = obj.backgroundImage;
            }

            const src = (bgImg.startsWith('http') || bgImg.startsWith('/') || bgImg.startsWith('data:'))
                ? bgImg
                : `/images/${bgImg}`;

            if (!imgEl || (imageListObj && !isDivLayer) || (!imageListObj && isDivLayer)) {
                if (imgEl) imgEl.remove();
                
                if (imageListObj) {
                    imgEl = document.createElement('div');
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
                const rawIndex = obj.imageIndex !== undefined && obj.imageIndex >= 0 ? obj.imageIndex : (imageListObj.currentImageNumber || 0);
                const currentFrame = Math.max(0, Math.min(rawIndex, (hCount * vCount) - 1));

                const col = currentFrame % hCount;
                const row = Math.floor(currentFrame / hCount);

                const bgSizeX = hCount * 100;
                const bgSizeY = vCount * 100;
                const bgPosX = hCount <= 1 ? 0 : (col / (hCount - 1)) * 100;
                const bgPosY = vCount <= 1 ? 0 : (row / (vCount - 1)) * 100;

                imgEl.style.backgroundImage = `url("${src}")`;
                imgEl.style.backgroundSize = `${bgSizeX}% ${bgSizeY}%`;
                imgEl.style.backgroundPosition = `${bgPosX}% ${bgPosY}%`;
                imgEl.style.backgroundRepeat = 'no-repeat';
                imgEl.style.display = '';
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

            hbEl.style.left = `${x}px`;
            hbEl.style.top = `${y}px`;
            hbEl.style.width = `${w}px`;
            hbEl.style.height = `${h}px`;
            hbEl.style.borderRadius = shape === 'circle' ? '50%' : '0';
            hbEl.style.display = 'block';
        } else {
            const oldHb = el.querySelector('.hitbox-debug-layer');
            if (oldHb) oldHb.remove();
        }

        if (obj.style?.color) el.style.color = obj.style.color;

        const textValue = obj.caption || (ctx.host.runMode ? '' : obj.name);
        if (el.innerText !== textValue) {
            if (!effectiveHasImage) {
                el.innerText = textValue;
            }
        }
    }
}
