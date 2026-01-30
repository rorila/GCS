import { TWindow } from './TWindow';
import { IMAGE_DEFAULTS } from './ImageCapable';
export class TSprite extends TWindow {
    constructor(name, x, y, width, height) {
        super(name, x, y, width, height);
        // Motion properties
        this.velocityX = 0;
        this.velocityY = 0;
        // Collision properties
        this.collisionEnabled = true;
        this.collisionGroup = 'default';
        // Appearance
        this.shape = 'rect';
        this.spriteColor = '#ff6b6b';
        this.lerpSpeed = 0.1; // 0 to 1
        // Image support (optional sprite graphic)
        this._backgroundImage = '';
        this._objectFit = IMAGE_DEFAULTS.objectFit;
        // Error offset for smooth correction
        this.errorX = 0;
        this.errorY = 0;
        // Default sprite style - visible colored rectangle
        this.style.backgroundColor = this.spriteColor;
        this.style.borderColor = '#333333';
        this.style.borderWidth = 1;
    }
    // ─────────────────────────────────────────────
    // Image Properties (optional sprite graphic)
    // ─────────────────────────────────────────────
    get backgroundImage() {
        return this._backgroundImage;
    }
    set backgroundImage(value) {
        this._backgroundImage = value || '';
    }
    get objectFit() {
        return this._objectFit;
    }
    set objectFit(value) {
        this._objectFit = value;
    }
    getInspectorProperties() {
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
            { name: 'objectFit', label: 'Image Fit', type: 'select', group: 'Appearance', options: ['cover', 'contain', 'fill', 'none'] }
        ];
    }
    /**
     * Smoothly sync to a new position using additive error correction
     */
    smoothSync(remoteX, remoteY) {
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
    update(deltaTime, applyVelocity = true) {
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
            if (Math.abs(this.errorX) < 0.01)
                this.errorX = 0;
        }
        if (this.errorY !== 0) {
            const corrY = this.errorY * this.lerpSpeed;
            this.y += corrY;
            this.errorY -= corrY;
            if (Math.abs(this.errorY) < 0.01)
                this.errorY = 0;
        }
    }
    /**
     * Check collision with another sprite using AABB
     */
    checkCollision(other) {
        if (!this.collisionEnabled || !other.collisionEnabled) {
            return false;
        }
        return this.x < other.x + other.width &&
            this.x + this.width > other.x &&
            this.y < other.y + other.height &&
            this.y + this.height > other.y;
    }
    /**
     * Get the side and depth of collision with another sprite
     */
    getCollisionOverlap(other) {
        if (!this.checkCollision(other))
            return null;
        const dx = (this.x + this.width / 2) - (other.x + other.width / 2);
        const dy = (this.y + this.height / 2) - (other.y + other.height / 2);
        const combinedHalfWidths = (this.width + other.width) / 2;
        const combinedHalfHeights = (this.height + other.height) / 2;
        const overlapX = combinedHalfWidths - Math.abs(dx);
        const overlapY = combinedHalfHeights - Math.abs(dy);
        if (overlapX < overlapY) {
            return {
                side: dx > 0 ? 'left' : 'right', // 'left' of THIS means 'right' of OTHER
                depth: overlapX
            };
        }
        else {
            return {
                side: dy > 0 ? 'top' : 'bottom',
                depth: overlapY
            };
        }
    }
    /**
     * Check if sprite is within bounds
     */
    isWithinBounds(maxX, maxY) {
        return {
            left: this.x >= 0,
            right: this.x + this.width <= maxX,
            top: this.y >= 0,
            bottom: this.y + this.height <= maxY
        };
    }
    getEvents() {
        const events = super.getEvents();
        return [
            ...events,
            'onCollision',
            'onCollisionLeft',
            'onCollisionRight',
            'onCollisionTop',
            'onCollisionBottom',
            'onBoundaryHit'
        ];
    }
}
