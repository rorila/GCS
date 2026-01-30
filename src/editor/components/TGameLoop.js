import { TWindow } from './TWindow';
import { AnimationManager } from '../runtime/AnimationManager';
/**
 * TGameLoop - A stage-placeable component that manages the game update cycle.
 * Place on stage, configure in Inspector, and it will drive sprite movement and collisions.
 * Bounds are read directly from the project's grid config.
 */
export class TGameLoop extends TWindow {
    constructor(name, x = 0, y = 0) {
        super(name, x, y, 3, 1);
        // Loop settings
        this.targetFPS = 60;
        this.state = 'stopped';
        // Grid reference (set via init) - bounds are derived from this
        this.gridConfig = null;
        this.gameState = null;
        // Offset for playable area (e.g., for headers)
        this.boundsOffsetTop = 0;
        this.boundsOffsetBottom = 0;
        // Internal state
        this.animationFrameId = null;
        this.lastTime = 0;
        this.sprites = [];
        this.inputControllers = [];
        this.renderCallback = null;
        this.eventCallback = null;
        this.collisionCooldowns = new Map();
        this.boundaryCooldowns = new Map();
        this.collidedThisFrame = new Set(); // Track sprites that collided this frame
        this.COLLISION_COOLDOWN_MS = 200;
        this.BOUNDARY_COOLDOWN_MS = 500; // Prevent repeated boundary events
        // CRITICAL: Private flag to bypass ReactiveRuntime proxy issues
        // Arrow functions bind 'this' to original object, but proxy changes are not reflected there
        this._isRunning = false;
        /**
         * Main game loop
         */
        this.loop = () => {
            // CRITICAL: Use _isRunning instead of state to bypass proxy issues
            if (!this._isRunning) {
                console.log(`[TGameLoop] loop() not running - _isRunning is false`);
                return;
            }
            const now = performance.now();
            const deltaTime = (now - this.lastTime) / 1000; // Convert to seconds
            this.lastTime = now;
            // Update input controllers first
            this.inputControllers.forEach((ic) => {
                if (ic.update)
                    ic.update();
            });
            // Update all sprites - ALWAYS call update so interpolation works,
            // but pass spritesMoving to control velocity application.
            const spritesMoving = this.gameState ? this.gameState.spritesMoving : true;
            console.log(`[TGameLoop] loop: spritesMoving=${spritesMoving}, sprites=${this.sprites.length}, gameState=${this.gameState?.name}`);
            this.updateSprites(deltaTime, spritesMoving);
            // Update tween animations
            AnimationManager.getInstance().update();
            // Clear collision tracking for this frame
            this.collidedThisFrame.clear();
            // Check collisions (physics still runs if movement enabled)
            if (spritesMoving) {
                this.checkCollisions();
                this.checkBoundaries();
            }
            // Render
            if (this.renderCallback) {
                this.renderCallback();
            }
            // Schedule next frame
            this.animationFrameId = requestAnimationFrame(this.loop);
        };
        // Visual indicator style
        this.style.backgroundColor = '#2196f3';
        this.style.borderColor = '#1565c0';
        this.style.borderWidth = 2;
        this.style.color = '#ffffff';
    }
    // Getter for bounds - derived from gridConfig
    get boundsWidth() {
        const grid = this.gridConfig;
        return grid?.grid?.cols ?? grid?.cols ?? 64;
    }
    set boundsWidth(_) {
        // No-op: bounds are determined by gridConfig
    }
    get boundsHeight() {
        const grid = this.gridConfig;
        return grid?.grid?.rows ?? grid?.rows ?? 40;
    }
    set boundsHeight(_) {
        // No-op: bounds are determined by gridConfig
    }
    getInspectorProperties() {
        return [
            ...super.getInspectorProperties(),
            { name: 'targetFPS', label: 'Target FPS', type: 'number', group: 'Loop Settings' },
            { name: 'boundsOffsetTop', label: 'Bounds Offset Top', type: 'number', group: 'Boundaries' },
            { name: 'boundsOffsetBottom', label: 'Bounds Offset Bottom', type: 'number', group: 'Boundaries' }
        ];
    }
    toJSON() {
        return super.toJSON();
    }
    onRuntimeStart() {
        // Die eigentliche start-Logik bleibt vorerst im GameLoopManager,
        // da dieser die Abhängigkeiten (objects, callbacks) kennt.
        // Der GameLoopManager wird in Zukunft die IRuntimeComponent-Signale nutzen.
    }
    initRuntime(callbacks) {
        this.init(callbacks.objects, callbacks.gridConfig, callbacks.render, callbacks.handleEvent);
    }
    /**
     * Initialize the game loop with objects, grid config, and callbacks
     */
    init(objects, gridConfig, renderCallback, eventCallback) {
        // Store grid reference for bounds
        this.gridConfig = gridConfig;
        // Filter sprites and input controllers
        this.sprites = objects.filter(obj => obj.className === 'TSprite' || obj.constructor.name === 'TSprite');
        this.inputControllers = objects.filter(obj => obj.className === 'TInputController' || obj.constructor.name === 'TInputController');
        this.gameState = objects.find(obj => obj.className === 'TGameState' || obj.constructor.name === 'TGameState') || null;
        this.renderCallback = renderCallback;
        this.eventCallback = eventCallback || null;
    }
    /**
     * Start the game loop
     */
    start() {
        console.log(`[TGameLoop] start() called. _isRunning: ${this._isRunning}, sprites: ${this.sprites.length}`);
        if (this._isRunning) {
            console.log(`[TGameLoop] Already running, returning.`);
            return;
        }
        this.state = 'running';
        this._isRunning = true; // CRITICAL: Set private flag
        console.log(`[TGameLoop] _isRunning set to: ${this._isRunning}`);
        this.lastTime = performance.now();
        // Trigger onStart event when the loop starts
        if (this.eventCallback) {
            this.eventCallback(this.id, 'onStart');
        }
        console.log(`[TGameLoop] Starting loop with ${this.sprites.length} sprites`);
        this.loop();
    }
    /**
     * Stop the game loop
     */
    stop() {
        this.state = 'stopped';
        this._isRunning = false; // CRITICAL: Clear private flag
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    /**
     * Pause the game loop
     */
    pause() {
        if (this._isRunning) {
            this.state = 'paused';
            this._isRunning = false; // CRITICAL: Clear private flag
        }
    }
    /**
     * Resume the game loop
     */
    resume() {
        if (this.state === 'paused' && !this._isRunning) {
            this.state = 'running';
            this._isRunning = true; // CRITICAL: Set private flag
            this.lastTime = performance.now();
            this.loop();
        }
    }
    /**
     * Update all sprites based on velocity
     */
    updateSprites(deltaTime, applyVelocity = true) {
        this.sprites.forEach(sprite => {
            sprite.update(deltaTime, applyVelocity);
        });
    }
    /**
     * Check collisions between sprites
     */
    checkCollisions() {
        for (let i = 0; i < this.sprites.length; i++) {
            for (let j = i + 1; j < this.sprites.length; j++) {
                const spriteA = this.sprites[i];
                const spriteB = this.sprites[j];
                // Skip if either sprite is currently animating (e.g. start animation)
                if (spriteA.isAnimating || spriteB.isAnimating) {
                    continue;
                }
                const overlap = spriteA.getCollisionOverlap(spriteB);
                if (overlap) {
                    // Check cooldown
                    const now = performance.now();
                    const pairKey = `${spriteA.id}_${spriteB.id}`;
                    const lastCollision = this.collisionCooldowns.get(pairKey) || 0;
                    if (now - lastCollision < this.COLLISION_COOLDOWN_MS) {
                        continue;
                    }
                    // Update cooldown
                    this.collisionCooldowns.set(pairKey, now);
                    // Push out of collision - only push the sprite that is moving
                    // This prevents paddles from being displaced when the ball hits them
                    if (overlap.side === 'left' || overlap.side === 'right') {
                        // Horizontal collision: check velocityX
                        if (Math.abs(spriteA.velocityX) >= Math.abs(spriteB.velocityX)) {
                            spriteA.x -= (overlap.side === 'left' ? -1 : 1) * overlap.depth;
                        }
                        else {
                            spriteB.x += (overlap.side === 'left' ? -1 : 1) * overlap.depth;
                        }
                    }
                    else {
                        // Vertical collision: check velocityY
                        if (Math.abs(spriteA.velocityY) >= Math.abs(spriteB.velocityY)) {
                            spriteA.y -= (overlap.side === 'top' ? -1 : 1) * overlap.depth;
                        }
                        else {
                            spriteB.y += (overlap.side === 'top' ? -1 : 1) * overlap.depth;
                        }
                    }
                    // Trigger collision event
                    if (this.eventCallback) {
                        // console.log(`[GameLoop] Collision detected: ${spriteA.name} (id: ${spriteA.id}) hit ${spriteB.name} (id: ${spriteB.id}) on side: ${overlap.side}`);
                        this.eventCallback(spriteA.id, 'onCollision', {
                            other: spriteB.name,
                            otherSprite: spriteB,
                            hitSide: overlap.side
                        });
                        // Note: For spriteB, the side is opposite
                        const oppositeSide = {
                            'left': 'right',
                            'right': 'left',
                            'top': 'bottom',
                            'bottom': 'top'
                        }[overlap.side];
                        this.eventCallback(spriteB.id, 'onCollision', {
                            other: spriteA.name,
                            otherSprite: spriteA,
                            hitSide: oppositeSide
                        });
                        // Trigger specific side events for Sprite A
                        if (overlap.side === 'left') {
                            this.eventCallback(spriteA.id, 'onCollisionLeft', { other: spriteB });
                        }
                        else if (overlap.side === 'right') {
                            this.eventCallback(spriteA.id, 'onCollisionRight', { other: spriteB });
                        }
                        else if (overlap.side === 'top') {
                            this.eventCallback(spriteA.id, 'onCollisionTop', { other: spriteB });
                        }
                        else if (overlap.side === 'bottom') {
                            this.eventCallback(spriteA.id, 'onCollisionBottom', { other: spriteB });
                        }
                        // Trigger specific side events for Sprite B (opposite side)
                        if (oppositeSide === 'left') {
                            this.eventCallback(spriteB.id, 'onCollisionLeft', { other: spriteA });
                        }
                        else if (oppositeSide === 'right') {
                            this.eventCallback(spriteB.id, 'onCollisionRight', { other: spriteA });
                        }
                        else if (oppositeSide === 'top') {
                            this.eventCallback(spriteB.id, 'onCollisionTop', { other: spriteA });
                        }
                        else if (oppositeSide === 'bottom') {
                            this.eventCallback(spriteB.id, 'onCollisionBottom', { other: spriteA });
                        }
                        // Track that these sprites collided this frame
                        // so boundary checks can skip them
                        this.collidedThisFrame.add(spriteA.id);
                        this.collidedThisFrame.add(spriteB.id);
                    }
                }
            }
        }
    }
    /**
     * Check if sprites hit stage boundaries
     */
    /**
     * Check if sprites hit stage boundaries
     */
    checkBoundaries() {
        this.sprites.forEach(sprite => {
            // Skip sprites that are currently animating
            if (sprite.isAnimating) {
                return;
            }
            // Skip sprites that collided with another object this frame
            if (this.collidedThisFrame.has(sprite.id)) {
                return;
            }
            const bounds = sprite.isWithinBounds(this.boundsWidth, this.boundsHeight);
            // Left
            if (!bounds.left) {
                this.triggerBoundaryEvent(sprite, 'left');
            }
            // Right
            if (!bounds.right) {
                this.triggerBoundaryEvent(sprite, 'right');
            }
            // Top (with offset)
            if (sprite.y < this.boundsOffsetTop) {
                this.triggerBoundaryEvent(sprite, 'top');
            }
            // Bottom (with offset)
            const bottomBoundary = this.boundsHeight - this.boundsOffsetBottom;
            if (sprite.y + sprite.height > bottomBoundary) {
                this.triggerBoundaryEvent(sprite, 'bottom');
            }
        });
    }
    triggerBoundaryEvent(sprite, side) {
        const cooldownKey = `${sprite.id}_${side}`;
        const now = performance.now();
        const lastHit = this.boundaryCooldowns.get(cooldownKey) || 0;
        if (now - lastHit > this.BOUNDARY_COOLDOWN_MS) {
            this.boundaryCooldowns.set(cooldownKey, now);
            // Stop sprite to prevent flying off endlessly if not handled
            if (side === 'left' || side === 'right')
                sprite.velocityX = 0;
            if (side === 'top' || side === 'bottom')
                sprite.velocityY = 0;
            // Clamp position
            if (side === 'left')
                sprite.x = 0;
            if (side === 'right')
                sprite.x = this.boundsWidth - sprite.width;
            if (side === 'top')
                sprite.y = this.boundsOffsetTop;
            if (side === 'bottom')
                sprite.y = this.boundsHeight - this.boundsOffsetBottom - sprite.height;
            if (this.eventCallback) {
                this.eventCallback(sprite.id, 'onBoundaryHit', { hitSide: side });
            }
        }
    }
}
