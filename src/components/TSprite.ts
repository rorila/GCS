import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { ImageFit, IMAGE_DEFAULTS } from './ImageCapable';

export type SpriteShape = 'rect' | 'circle';

export class TSprite extends TWindow {
    // Motion properties
    public velocityX: number = 0;
    public velocityY: number = 0;

    // Collision properties
    public collisionEnabled: boolean = true;
    public collisionGroup: string = 'default';

    // Appearance
    public shape: SpriteShape = 'rect';
    public spriteColor: string = '#ff6b6b';
    public lerpSpeed: number = 0.1; // 0 to 1

    // Image support (optional sprite graphic)
    private _backgroundImage: string = '';
    private _objectFit: ImageFit = IMAGE_DEFAULTS.objectFit;

    // TImageList support
    public imageListId: string = '';
    public imageIndex: number = 0;

    // Error offset for smooth correction
    private errorX: number = 0;
    private errorY: number = 0;

    // Hitbox Properties
    public customHitbox: boolean = false;
    public hitboxShape: 'auto' | 'rect' | 'circle' = 'auto'; // 'auto' means fallback to this.shape
    public hitboxOffsetX: number = 0;
    public hitboxOffsetY: number = 0;
    public hitboxWidth: number = 0; // 0 bedeutet: nutzt this.width
    public hitboxHeight: number = 0; // 0 bedeutet: nutzt this.height

    constructor(name: string, x: number, y: number, width: number, height: number) {
        super(name, x, y, width, height);
        // Default sprite style - visible colored rectangle
        this.style.backgroundColor = this.spriteColor;
        this.style.borderColor = '#333333';
        this.style.borderWidth = 1;
    }

    // ─────────────────────────────────────────────
    // Image Properties (optional sprite graphic)
    // ─────────────────────────────────────────────

    get backgroundImage(): string {
        return this._backgroundImage;
    }

    set backgroundImage(value: string) {
        this._backgroundImage = value || '';
    }

    get objectFit(): ImageFit {
        return this._objectFit;
    }

    set objectFit(value: ImageFit) {
        this._objectFit = value;
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            // Motion group
            { name: 'velocityX', label: 'Velocity X', type: 'number', group: 'Motion' },
            { name: 'velocityY', label: 'Velocity Y', type: 'number', group: 'Motion' },
            // Interpolation group
            { name: 'lerpSpeed', label: 'Lerp Speed', type: 'number', group: 'Interpolation' },
            // Collision group
            { name: 'collisionEnabled', label: 'Collision', type: 'boolean', group: 'Collision' },
            { name: 'collisionGroup', label: 'Collision Group', type: 'string', group: 'Collision' },
            // Appearance group
            { name: 'shape', label: 'Shape', type: 'select', group: 'Appearance', options: ['rect', 'circle'] },
            { name: 'spriteColor', label: 'Sprite Color', type: 'color', group: 'Appearance' },
            { name: 'backgroundImage', label: 'Sprite Image', type: 'image_picker', group: 'Appearance' },
            { name: 'objectFit', label: 'Image Fit', type: 'select', group: 'Appearance', options: ['cover', 'contain', 'fill', 'none'] },
            { name: 'imageListId', label: 'Sprite Sheet', type: 'select', source: 'imageLists', group: 'Appearance', hint: 'Optional: Verknüpft das Sprite mit einer TImageList' },
            { name: 'imageIndex', label: 'Frame Index', type: 'number', min: 0, step: 1, group: 'Appearance', hint: '0-basierter Index des Frames aus der TImageList' },
            // Hitbox group
            { name: 'customHitbox', label: 'Custom Hitbox', type: 'boolean', group: 'Hitbox' },
            { name: 'hitboxShape', label: 'Hitbox Shape', type: 'select', group: 'Hitbox', options: ['auto', 'rect', 'circle'], dependsOn: { property: 'customHitbox', value: true } },
            { name: 'hitboxOffsetX', label: 'Offset X', type: 'number', group: 'Hitbox', dependsOn: { property: 'customHitbox', value: true } },
            { name: 'hitboxOffsetY', label: 'Offset Y', type: 'number', group: 'Hitbox', dependsOn: { property: 'customHitbox', value: true } },
            { name: 'hitboxWidth', label: 'Width (0=auto)', type: 'number', group: 'Hitbox', dependsOn: { property: 'customHitbox', value: true } },
            { name: 'hitboxHeight', label: 'Height (0=auto)', type: 'number', group: 'Hitbox', dependsOn: { property: 'customHitbox', value: true } }
        ];
    }


    /**
     * Smoothly sync to a new position using additive error correction
     */
    public smoothSync(remoteX: number, remoteY: number): void {
        const dx = remoteX - this.x;
        const dy = remoteY - this.y;

        // If the error is massive (> 10 units), snap immediately
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            this.x = remoteX;
            this.y = remoteY;
            this.errorX = 0;
            this.errorY = 0;
            return;
        }

        // Add the difference to our error buffer to be bled out over time
        this.errorX = dx;
        this.errorY = dy;
    }

    public update(deltaTime: number, applyVelocity: boolean = true): void {
        // Skip physics and smooth correction when a tween animation is running
        if (this.isAnimating) {
            return;
        }

        const moveFactor = deltaTime * 60; // Normalize to 60fps

        // 1. Regular velocity movement (Local Simulation / Dead Reckoning)
        if (applyVelocity) {
            this.x += this.velocityX * moveFactor;
            this.y += this.velocityY * moveFactor;
        }

        // 2. Additive Smooth correction
        if (this.errorX !== 0) {
            const corrX = this.errorX * this.lerpSpeed;
            this.x += corrX;
            this.errorX -= corrX;
            if (Math.abs(this.errorX) < 0.01) this.errorX = 0;
        }

        if (this.errorY !== 0) {
            const corrY = this.errorY * this.lerpSpeed;
            this.y += corrY;
            this.errorY -= corrY;
            if (Math.abs(this.errorY) < 0.01) this.errorY = 0;
        }
    }


    /**
     * Ermittelt die logische Hitbox (AABB-Maße und logische Shape).
     */
    public getHitbox(): { x: number, y: number, w: number, h: number, shape: 'rect' | 'circle' } {
        const shape = (this.hitboxShape === 'auto' || !this.hitboxShape) ? this.shape : this.hitboxShape;
        
        if (!this.customHitbox) {
            return { x: this.x, y: this.y, w: this.width, h: this.height, shape };
        }
        
        const w = (this.hitboxWidth && this.hitboxWidth > 0) ? this.hitboxWidth : this.width;
        const h = (this.hitboxHeight && this.hitboxHeight > 0) ? this.hitboxHeight : this.height;
        const x = this.x + (this.hitboxOffsetX || 0);
        const y = this.y + (this.hitboxOffsetY || 0);
        
        return { x, y, w, h, shape };
    }

    /**
     * Check collision with another sprite using Hitboxes
     */
    public checkCollision(other: TSprite): boolean {
        if (!this.collisionEnabled || !other.collisionEnabled) {
            return false;
        }

        const hbA = this.getHitbox();
        const hbB = other.getHitbox();

        if (hbA.shape === 'rect' && hbB.shape === 'rect') {
            return hbA.x < hbB.x + hbB.w &&
                   hbA.x + hbA.w > hbB.x &&
                   hbA.y < hbB.y + hbB.h &&
                   hbA.y + hbA.h > hbB.y;
        } else if (hbA.shape === 'circle' && hbB.shape === 'circle') {
            const rA = hbA.w / 2;
            const rB = hbB.w / 2;
            const cxA = hbA.x + rA;
            const cyA = hbA.y + hbA.h / 2;
            const cxB = hbB.x + rB;
            const cyB = hbB.y + hbB.h / 2;
            const dx = cxA - cxB;
            const dy = cyA - cyB;
            return (dx * dx + dy * dy) < ((rA + rB) * (rA + rB));
        } else {
            // Mixed: Rect vs Circle
            const rectHb = hbA.shape === 'rect' ? hbA : hbB;
            const circleHb = hbA.shape === 'circle' ? hbA : hbB;
            
            const r = circleHb.w / 2;
            const cx = circleHb.x + r;
            const cy = circleHb.y + circleHb.h / 2;
            
            const closestX = Math.max(rectHb.x, Math.min(cx, rectHb.x + rectHb.w));
            const closestY = Math.max(rectHb.y, Math.min(cy, rectHb.y + rectHb.h));
            
            const dx = cx - closestX;
            const dy = cy - closestY;
            return (dx * dx + dy * dy) < (r * r);
        }
    }

    /**
     * Get the side and depth of collision with another sprite
     */
    public getCollisionOverlap(other: TSprite): { side: 'left' | 'right' | 'top' | 'bottom', depth: number } | null {
        if (!this.checkCollision(other)) return null;

        const hbA = this.getHitbox();
        const hbB = other.getHitbox();

        const dx = (hbA.x + hbA.w / 2) - (hbB.x + hbB.w / 2);
        const dy = (hbA.y + hbA.h / 2) - (hbB.y + hbB.h / 2);
        const combinedHalfWidths = (hbA.w + hbB.w) / 2;
        const combinedHalfHeights = (hbA.h + hbB.h) / 2;

        const overlapX = combinedHalfWidths - Math.abs(dx);
        const overlapY = combinedHalfHeights - Math.abs(dy);

        if (overlapX < overlapY) {
            return {
                side: dx > 0 ? 'left' : 'right', // 'left' of THIS means 'right' of OTHER
                depth: overlapX
            };
        } else {
            return {
                side: dy > 0 ? 'top' : 'bottom',
                depth: overlapY
            };
        }
    }

    /**
     * Check if sprite is within bounds
     */
    public isWithinBounds(maxX: number, maxY: number): { left: boolean; right: boolean; top: boolean; bottom: boolean } {
        const hb = this.getHitbox();
        return {
            left: hb.x >= 0,
            right: hb.x + hb.w <= maxX,
            top: hb.y >= 0,
            bottom: hb.y + hb.h <= maxY
        };
    }

    public getEvents(): string[] {
        const events = super.getEvents();
        return [
            ...events,
            'onCollision',
            'onCollisionLeft',
            'onCollisionRight',
            'onCollisionTop',
            'onCollisionBottom',
            'onBoundaryHit',
            'onStageExit'
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            imageListId: this.imageListId,
            imageIndex: this.imageIndex
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TSprite', (objData: any) => new TSprite(objData.name, objData.x, objData.y, objData.width, objData.height));
