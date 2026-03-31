import { IRenderContext } from './IRenderContext';

export class SpriteRenderer {
    public static render(ctx: IRenderContext, el: HTMLElement, obj: any): void {
        const hasImage = !!obj.backgroundImage;
        
        el.style.backgroundColor = hasImage ? 'transparent' : (obj.style?.backgroundColor || obj.spriteColor || '#ff6b6b');
        
        if (hasImage) {
            el.style.borderColor = 'transparent';

            let imgEl = el.querySelector('.sprite-image-layer') as HTMLImageElement;
            let bgImg = obj.backgroundImage;
            const src = (bgImg.startsWith('http') || bgImg.startsWith('/') || bgImg.startsWith('data:'))
                ? bgImg
                : `/images/${bgImg}`;

            if (!imgEl) {
                imgEl = document.createElement('img');
                imgEl.className = 'sprite-image-layer';
                imgEl.style.position = 'absolute';
                imgEl.style.top = '0';
                imgEl.style.left = '0';
                imgEl.style.width = '100%';
                imgEl.style.height = '100%';
                imgEl.style.objectFit = obj.objectFit || 'contain';
                imgEl.style.pointerEvents = 'none';
                imgEl.style.userSelect = 'none';
                imgEl.draggable = false;
                imgEl.style.willChange = 'transform';
                imgEl.style.backfaceVisibility = 'hidden';
                imgEl.onerror = () => { imgEl.style.display = 'none'; };
                el.appendChild(imgEl);
            }

            if (imgEl.getAttribute('src') !== src) {
                imgEl.src = src;
                imgEl.style.display = '';
            }
            imgEl.style.objectFit = obj.objectFit || 'contain';
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
            if (!hasImage) {
                el.innerText = textValue;
            }
        }
    }
}
