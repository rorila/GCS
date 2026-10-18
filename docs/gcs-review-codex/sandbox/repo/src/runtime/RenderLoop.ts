import { TSprite } from '../components/TSprite';
import { AnimationManager } from './AnimationManager';

/**
 * RenderLoop kapselt alles, was mit dem Zusammenstellen und Ausgeben der
 * darzustellenden Objekte pro Frame zu tun hat.
 */
export class RenderLoop {
    private renderCallback: (() => void) | null = null;
    private spriteRenderCallback: ((objects: any[], dirtyObjects?: any[]) => void) | null = null;

    private readonly dirtySprites = new Set<any>();
    private readonly renderObjectBuffer: any[] = [];
    private readonly renderObjectSeen = new Set<any>();

    public setCallbacks(
        renderCallback: (() => void) | null,
        spriteRenderCallback: ((objects: any[], dirtyObjects?: any[]) => void) | null
    ): void {
        this.renderCallback = renderCallback;
        this.spriteRenderCallback = spriteRenderCallback;
    }

    public markSpriteDirty(sprite: any): void {
        this.dirtySprites.add(sprite);
    }

    public getAndClearDirtySprites(): any[] {
        const sprites = Array.from(this.dirtySprites);
        this.dirtySprites.clear();
        return sprites;
    }

    public syncRenderCoordinates(sprites: TSprite[]): void {
        for (const sprite of sprites) {
            sprite.renderX = sprite.x;
            sprite.renderY = sprite.y;
        }
    }

    public updateRenderPositions(sprites: TSprite[], alpha: number): void {
        for (const sprite of sprites) {
            if (!sprite.visible) continue;
            const dx = sprite.x - sprite.previousX;
            const dy = sprite.y - sprite.previousY;
            sprite.renderX = sprite.x + dx * alpha;
            sprite.renderY = sprite.y + dy * alpha;
        }
    }

    public collectRenderObjects(sprites: TSprite[]): any[] {
        const out = this.renderObjectBuffer;
        out.length = 0;

        const animationManager = AnimationManager.getInstance();
        if (!animationManager.hasActiveTweens()) {
            for (let i = 0; i < sprites.length; i++) {
                out.push(sprites[i]);
            }
            return out;
        }

        const seen = this.renderObjectSeen;
        seen.clear();
        for (let i = 0; i < sprites.length; i++) {
            const sprite = sprites[i];
            if (seen.has(sprite)) continue;
            seen.add(sprite);
            out.push(sprite);
        }

        const animated = animationManager.getAnimatedObjects();
        for (let i = 0; i < animated.length; i++) {
            const obj = animated[i];
            if (seen.has(obj)) continue;
            seen.add(obj);
            out.push(obj);
        }

        seen.clear();
        return out;
    }

    public render(objects: any[], dirtySprites: any[]): void {
        if (this.spriteRenderCallback) {
            this.spriteRenderCallback(objects, dirtySprites);
        } else if (this.renderCallback) {
            this.renderCallback();
        }
    }

    public clear(): void {
        this.dirtySprites.clear();
        this.renderObjectBuffer.length = 0;
        this.renderObjectSeen.clear();
        this.renderCallback = null;
        this.spriteRenderCallback = null;
    }
}
