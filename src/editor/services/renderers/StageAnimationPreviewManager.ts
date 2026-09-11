import { Logger } from '../../../utils/Logger';
import { projectObjectRegistry } from '../../../services/registry/ObjectRegistry';
import { SpecialComponentRenderer, ISpecialComponentContext } from './SpecialComponentRenderer';
import { SpriteRenderer } from './SpriteRenderer';
import { IRenderContext } from './IRenderContext';
import type { StageHost } from '../StageRenderer';

const logger = Logger.get('StageAnimationPreviewManager', 'Component_Manipulation');

export class StageAnimationPreviewManager {
    private host: StageHost;
    private animationPreview: { id: string; timer: number | null; el: HTMLElement; imageList: any; frameDuration: number; imageCount: number; loop: boolean; enabled: boolean; currentFrame: number } | null = null;
    private spriteAnimationPreview: { id: string; timer: number | null; el: HTMLElement; obj: any; ctx: IRenderContext; animObj: any; frameDuration: number; imageCount: number; loop: boolean; enabled: boolean; currentFrame: number; tick: (() => void) | null } | null = null;

    constructor(host: StageHost) {
        this.host = host;
    }

    /**
     * Rendert eine TAnimation: Zeigt das 1. Frame der verknüpften TImageList.
     * Falls keine ImageList/Bild vorhanden ist, wird der Platzhalter angezeigt.
     */
    public renderAnimation(el: HTMLElement, obj: any, specialCtx: ISpecialComponentContext): void {
        const imageListId = obj.imageListId || '';
        const imageList = imageListId ? this.resolveImageList(imageListId) : null;

        const hasSrc = imageList && (imageList.backgroundImage || imageList.src);
        if (!hasSrc) {
            SpecialComponentRenderer.renderDefaultImagePlaceholder(el, 'Animation');
            return;
        }
        SpecialComponentRenderer.renderImageList(specialCtx, el, {
            backgroundImage: imageList.backgroundImage,
            src: imageList.src,
            imageCountHorizontal: imageList.imageCountHorizontal,
            imageCountVertical: imageList.imageCountVertical,
            currentImageNumber: 0
        });

        // TAnimation-Kennzeichnung, auch wenn ein Bild gerendert wird
        let labelEl = el.querySelector('.animation-type-label') as HTMLElement;
        if (!labelEl) {
            labelEl = document.createElement('div');
            labelEl.className = 'animation-type-label';
            labelEl.style.cssText = `
                position: absolute;
                bottom: 4px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(30, 30, 46, 0.85);
                color: #f9e2af;
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
        labelEl.textContent = 'Animation';

        const id = obj.id || obj.name;
        if (this.animationPreview && this.animationPreview.id === id && !this.host.selectedIds.has(id)) {
            this.stopAnimationPreview();
        }
        if (id && this.host.selectedIds.has(id)) {
            this.startAnimationPreview(el, obj, imageList, specialCtx);
        }
    }

    public startAnimationPreview(el: HTMLElement, obj: any, imageList: any, specialCtx: ISpecialComponentContext): void {
        const id = obj.id || obj.name;
        const frameDuration = Math.max(1, obj.frameDuration || 100);
        const imageCount = Math.max(1, obj.imageCount || 1);
        const loop = !!obj.loop;
        const enabled = !!obj.enabled;

        if (this.animationPreview && this.animationPreview.id === id) {
            this.animationPreview.frameDuration = frameDuration;
            this.animationPreview.imageCount = imageCount;
            this.animationPreview.loop = loop;
            this.animationPreview.enabled = enabled;
            this.animationPreview.el = el;
            this.animationPreview.imageList = imageList;
            if (!enabled || imageCount <= 1) {
                this.stopAnimationPreview();
            }
            return;
        }

        this.stopAnimationPreview();

        if (!enabled || imageCount <= 1) {
            return;
        }

        this.animationPreview = { id, timer: null, el, imageList, frameDuration, imageCount, loop, enabled, currentFrame: 0 };

        const tick = () => {
            if (!this.animationPreview || this.animationPreview.id !== id) return;
            const preview = this.animationPreview;
            const frame = preview.currentFrame;

            SpecialComponentRenderer.renderImageList(specialCtx, preview.el, {
                backgroundImage: preview.imageList.backgroundImage,
                src: preview.imageList.src,
                imageCountHorizontal: preview.imageList.imageCountHorizontal,
                imageCountVertical: preview.imageList.imageCountVertical,
                currentImageNumber: frame
            });

            let labelEl = preview.el.querySelector('.animation-type-label') as HTMLElement;
            if (!labelEl) {
                labelEl = document.createElement('div');
                labelEl.className = 'animation-type-label';
                labelEl.style.cssText = `
                    position: absolute;
                    bottom: 4px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(30, 30, 46, 0.85);
                    color: #f9e2af;
                    font-size: 10px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 3px;
                    pointer-events: none;
                    z-index: 10;
                    white-space: nowrap;
                `;
                preview.el.appendChild(labelEl);
            }
            labelEl.textContent = 'Animation';

            const nextFrame = preview.currentFrame + 1;
            if (nextFrame >= preview.imageCount) {
                if (preview.loop) {
                    preview.currentFrame = 0;
                    preview.timer = window.setTimeout(tick, preview.frameDuration);
                } else {
                    this.stopAnimationPreview();
                }
            } else {
                preview.currentFrame = nextFrame;
                preview.timer = window.setTimeout(tick, preview.frameDuration);
            }
        };

        tick();
    }

    public stopAnimationPreview(): void {
        if (this.animationPreview && this.animationPreview.timer !== null) {
            window.clearTimeout(this.animationPreview.timer);
        }
        this.animationPreview = null;
    }

    public startSpriteAnimationPreview(el: HTMLElement, obj: any, ctx: IRenderContext, _specialCtx?: any): void {
        const id = obj.id || obj.name;
        const selected = this.host.selectedIds.has(id);

        if (!selected) {
            if (this.spriteAnimationPreview && this.spriteAnimationPreview.id === id) {
                this.stopSpriteAnimationPreview();
            }
            return;
        }

        const animId = obj.animationId;
        if (!animId) {
            if (this.spriteAnimationPreview && this.spriteAnimationPreview.id === id) {
                this.stopSpriteAnimationPreview();
            }
            return;
        }

        const animObj = this.resolveAnimationObject(animId);

        if (this.spriteAnimationPreview && this.spriteAnimationPreview.id === id) {
            if (!animObj) {
                this.stopSpriteAnimationPreview();
                return;
            }
            const preview = this.spriteAnimationPreview;
            const newDuration = Math.max(1, animObj.frameDuration || 100);
            const durationChanged = preview.frameDuration !== newDuration;
            preview.frameDuration = newDuration;
            preview.imageCount = Math.max(1, animObj.imageCount || 1);
            preview.loop = !!animObj.loop;
            preview.enabled = !!animObj.enabled;
            preview.animObj = animObj;
            preview.el = el;
            preview.obj = obj;
            preview.ctx = ctx;
            if (!preview.enabled || preview.imageCount <= 1) {
                this.stopSpriteAnimationPreview();
                return;
            }
            // Geänderte Geschwindigkeit sofort anwenden: der bereits geplante Timer
            // würde sonst noch mit der alten Dauer ablaufen.
            if (durationChanged && preview.tick) {
                if (preview.timer !== null) {
                    window.clearTimeout(preview.timer);
                    preview.timer = null;
                }
                preview.timer = window.setTimeout(preview.tick, newDuration);
            }
            return;
        }

        if (!animObj) return;

        this.stopSpriteAnimationPreview();

        const frameDuration = Math.max(1, animObj.frameDuration || 100);
        const imageCount = Math.max(1, animObj.imageCount || 1);
        const loop = !!animObj.loop;
        const enabled = !!animObj.enabled;

        if (!enabled || imageCount <= 1) {
            return;
        }

        logger.info(
            `Sprite-Vorschau '${obj.name}' nutzt TAnimation '${animId}': ` +
            `frameDuration=${frameDuration}ms, imageCount=${imageCount}, loop=${loop}`
        );

        this.spriteAnimationPreview = { id, timer: null, el, obj, ctx, animObj, frameDuration, imageCount, loop, enabled, currentFrame: 0, tick: null };

        const tick = () => {
            if (!this.spriteAnimationPreview || this.spriteAnimationPreview.id !== id) return;
            const preview = this.spriteAnimationPreview;

            // Werte bei JEDEM Tick frisch auflösen: sonst liefe die Vorschau mit der
            // Geschwindigkeit weiter, die beim Start der Vorschau gültig war.
            const live = this.resolveAnimationObject(animId);
            if (live) {
                preview.animObj = live;
                preview.frameDuration = Math.max(1, live.frameDuration || 100);
                preview.imageCount = Math.max(1, live.imageCount || 1);
                preview.loop = !!live.loop;
                preview.enabled = !!live.enabled;
                if (!preview.enabled || preview.imageCount <= 1) {
                    this.stopSpriteAnimationPreview();
                    return;
                }
            }

            if (preview.currentFrame >= preview.imageCount) preview.currentFrame = 0;
            const frame = preview.currentFrame;

            // WICHTIG: kein Spread — Getter wie appearanceMode/animationId liegen auf dem
            // Prototyp und gingen dabei verloren. Ein Proxy überlagert nur imageIndex.
            const frameObj = new Proxy(preview.obj, {
                get(target, prop, receiver) {
                    if (prop === 'imageIndex') return frame;
                    return Reflect.get(target, prop, receiver);
                }
            });
            SpriteRenderer.render(preview.ctx, preview.el, frameObj);

            const nextFrame = preview.currentFrame + 1;
            if (nextFrame >= preview.imageCount) {
                if (preview.loop) {
                    preview.currentFrame = 0;
                    preview.timer = window.setTimeout(tick, preview.frameDuration);
                } else {
                    this.stopSpriteAnimationPreview();
                }
            } else {
                preview.currentFrame = nextFrame;
                preview.timer = window.setTimeout(tick, preview.frameDuration);
            }
        };

        this.spriteAnimationPreview.tick = tick;
        tick();
    }

    /**
     * Löst eine TAnimation über Name oder Id auf. Erst über die aktuell gerenderten
     * Objekte (Live-Instanzen der Stage), dann über die Projekt-Registry.
     */
    private resolveAnimationObject(animId: string): any | null {
        const isAnim = (o: any) => (o.name === animId || o.id === animId) &&
            (o.className === 'TAnimation' || o.constructor?.name === 'TAnimation');

        const fromStage = this.host.lastRenderedObjects.find(isAnim);
        if (fromStage) return fromStage;

        const fromRegistry = projectObjectRegistry.getObjects().find(isAnim);
        return fromRegistry || null;
    }

    public stopSpriteAnimationPreview(): void {
        if (this.spriteAnimationPreview && this.spriteAnimationPreview.timer !== null) {
            window.clearTimeout(this.spriteAnimationPreview.timer);
        }
        this.spriteAnimationPreview = null;
    }

    public stopIfNotSelected(selectedIds: Set<string>): void {
        if (this.animationPreview && !selectedIds.has(this.animationPreview.id)) {
            this.stopAnimationPreview();
        }
        if (this.spriteAnimationPreview && !selectedIds.has(this.spriteAnimationPreview.id)) {
            this.stopSpriteAnimationPreview();
        }
    }

    private resolveImageList(imageListId: string): any {
        return this.host.lastRenderedObjects.find((o: any) =>
            (o.name === imageListId || o.id === imageListId) &&
            (o.className === 'TImageList' || o.constructor?.name === 'TImageList')
        ) || projectObjectRegistry.getObjects().find((o: any) =>
            (o.name === imageListId || o.id === imageListId) &&
            (o.className === 'TImageList' || o.constructor?.name === 'TImageList')
        ) || null;
    }
}
