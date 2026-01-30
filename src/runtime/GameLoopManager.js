/**
 * GameLoopManager - Singleton für die zentrale Verwaltung des Spiel-Loops.
 *
 * Dieser Manager ist KEIN Stage-Objekt und wird nicht durch das ReactiveRuntime
 * Proxy-System verarbeitet. Dadurch werden alle Probleme mit Arrow Functions
 * und this-Binding vermieden.
 *
 * Verwendung:
 * - GameLoopManager.getInstance().init(objects, gridConfig, renderCallback, eventCallback)
 * - GameLoopManager.getInstance().start()
 * - GameLoopManager.getInstance().stop()
 */
import { AnimationManager } from './AnimationManager';
export class GameLoopManager {
    constructor() {
        // State
        this.state = 'stopped';
        this.animationFrameId = null;
        this.lastTime = 0;
        // Configuration
        this.boundsOffsetTop = 0;
        this.boundsOffsetBottom = 0;
        // Grid reference - bounds are derived from this
        this.gridConfig = null;
        this.gameState = null;
        // Objects
        this.sprites = [];
        this.inputControllers = [];
        // Callbacks
        this.renderCallback = null;
        this.eventCallback = null;
        // Cooldowns and tracking
        this.collisionCooldowns = new Map();
        this.boundaryCooldowns = new Map();
        this.collidedThisFrame = new Set();
        this.COLLISION_COOLDOWN_MS = 200;
        this.BOUNDARY_COOLDOWN_MS = 500;
        // Private constructor for singleton
        // Bind the loop method to this instance
        this.loop = this.loop.bind(this);
    }
    static getInstance() {
        if (!GameLoopManager.instance) {
            GameLoopManager.instance = new GameLoopManager();
        }
        return GameLoopManager.instance;
    }
    // Getters for bounds - derived from gridConfig
    get boundsWidth() {
        const grid = this.gridConfig;
        return grid?.grid?.cols ?? grid?.cols ?? 64;
    }
    get boundsHeight() {
        const grid = this.gridConfig;
        return grid?.grid?.rows ?? grid?.rows ?? 40;
    }
    /**
     * Initialize the game loop with objects, grid config, and callbacks
     */
    init(objects, gridConfig, renderCallback, eventCallback) {
        console.log(`[GameLoopManager] init() called with ${objects.length} objects`);
        // Stop any existing loop
        this.stop();
        this.gridConfig = gridConfig;
        this.renderCallback = renderCallback;
        this.eventCallback = eventCallback || null;
        // Filter sprites and input controllers from objects
        this.sprites = objects.filter((obj) => obj.className === 'TSprite' || obj.constructor.name === 'TSprite');
        this.inputControllers = objects.filter(obj => obj.className === 'TInputController' || obj.constructor?.name === 'TInputController');
        // Find GameState component
        const gameStateObj = objects.find(obj => obj.className === 'TGameState' || obj.constructor?.name === 'TGameState');
        this.gameState = gameStateObj || null;
        // Look for any TGameLoop object to get configuration
        const gameLoopObj = objects.find(obj => obj.className === 'TGameLoop' || obj.constructor?.name === 'TGameLoop');
        if (gameLoopObj) {
            this.boundsOffsetTop = gameLoopObj.boundsOffsetTop || 0;
            this.boundsOffsetBottom = gameLoopObj.boundsOffsetBottom || 0;
            if (gameLoopObj.targetFPS) {
                console.log(`[GameLoopManager] Target FPS: ${gameLoopObj.targetFPS} (not currently used for capping)`);
            }
        }
        // Clear cooldowns on init
        this.collisionCooldowns.clear();
        this.boundaryCooldowns.clear();
        console.log(`[GameLoopManager] Initialized with ${this.sprites.length} sprites, ${this.inputControllers.length} input controllers, gameState: ${this.gameState?.name || 'null'}`);
    }
    /**
     * Start the game loop
     */
    start() {
        console.log(`[GameLoopManager] start() called. Current state: ${this.state}`);
        if (this.state === 'running') {
            console.log(`[GameLoopManager] Already running, returning.`);
            return;
        }
        this.state = 'running';
        this.lastTime = performance.now();
        console.log(`[GameLoopManager] Starting loop with ${this.sprites.length} sprites`);
        this.loop();
    }
    /**
     * Stop the game loop
     */
    stop() {
        console.log(`[GameLoopManager] stop() called. Current state: ${this.state}`);
        this.state = 'stopped';
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        // Clear tracking and cooldowns to prevent memory leaks and state carryover
        this.collisionCooldowns.clear();
        this.boundaryCooldowns.clear();
        this.collidedThisFrame.clear();
        this.sprites = [];
        this.inputControllers = [];
        this.renderCallback = null;
        this.eventCallback = null;
        this.gameState = null;
        this.gridConfig = null;
    }
    /**
     * Pause the game loop
     */
    pause() {
        if (this.state === 'running') {
            this.state = 'paused';
            console.log(`[GameLoopManager] Paused`);
        }
    }
    /**
     * Resume the game loop
     */
    resume() {
        if (this.state === 'paused') {
            this.state = 'running';
            this.lastTime = performance.now();
            console.log(`[GameLoopManager] Resumed`);
            this.loop();
        }
    }
    /**
     * Get current state
     */
    getState() {
        return this.state;
    }
    /**
     * Check if running
     */
    isRunning() {
        return this.state === 'running';
    }
    /**
     * Main game loop - NORMAL METHOD, not arrow function
     * OPTIMIZATION: Only renders when something has changed to avoid endless log spam
     */
    loop() {
        if (this.state !== 'running') {
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
        // Check if anything needs updating
        const spritesMoving = this.gameState ? this.gameState.spritesMoving : true;
        const hasActiveAnimations = AnimationManager.getInstance().hasActiveTweens();
        // Check if any sprite has velocity (is actually moving)
        const hasMovingSprites = spritesMoving && this.sprites.some(sprite => sprite.velocityX !== 0 || sprite.velocityY !== 0 || sprite.isAnimating);
        // Only do work if something is active
        const needsUpdate = hasActiveAnimations || hasMovingSprites;
        if (needsUpdate) {
            // Update all sprites
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
            // Render only when something changed
            if (this.renderCallback) {
                this.renderCallback();
            }
        }
        // Schedule next frame - always continue the loop to catch new activity
        this.animationFrameId = requestAnimationFrame(this.loop);
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
                // Skip if either sprite is currently animating
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
                    // Push out of collision
                    if (overlap.side === 'left' || overlap.side === 'right') {
                        if (Math.abs(spriteA.velocityX) >= Math.abs(spriteB.velocityX)) {
                            spriteA.x -= (overlap.side === 'left' ? -1 : 1) * overlap.depth;
                        }
                        else {
                            spriteB.x += (overlap.side === 'left' ? -1 : 1) * overlap.depth;
                        }
                    }
                    else {
                        if (Math.abs(spriteA.velocityY) >= Math.abs(spriteB.velocityY)) {
                            spriteA.y -= (overlap.side === 'top' ? -1 : 1) * overlap.depth;
                        }
                        else {
                            spriteB.y += (overlap.side === 'top' ? -1 : 1) * overlap.depth;
                        }
                    }
                    // Trigger collision events
                    if (this.eventCallback) {
                        this.eventCallback(spriteA.id, 'onCollision', {
                            other: spriteB.name,
                            otherSprite: spriteB,
                            hitSide: overlap.side
                        });
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
                        // Trigger specific side events
                        this.eventCallback(spriteA.id, `onCollision${this.capitalize(overlap.side)}`, { other: spriteB });
                        this.eventCallback(spriteB.id, `onCollision${this.capitalize(oppositeSide)}`, { other: spriteA });
                        // Track collision
                        this.collidedThisFrame.add(spriteA.id);
                        this.collidedThisFrame.add(spriteB.id);
                    }
                }
            }
        }
    }
    capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
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
            if (!bounds.left) {
                this.triggerBoundaryEvent(sprite, 'left');
            }
            if (!bounds.right) {
                this.triggerBoundaryEvent(sprite, 'right');
            }
            if (sprite.y < this.boundsOffsetTop) {
                this.triggerBoundaryEvent(sprite, 'top');
            }
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
        // Skip if we hit recently
        if (now - lastHit < this.BOUNDARY_COOLDOWN_MS)
            return;
        // Velocity protection: Only trigger if the sprite is actually moving TOWARDS that boundary
        // This prevents double-triggering when the task already flipped the velocity
        if (side === 'left' && sprite.velocityX >= 0)
            return;
        if (side === 'right' && sprite.velocityX <= 0)
            return;
        if (side === 'top' && sprite.velocityY >= 0)
            return;
        if (side === 'bottom' && sprite.velocityY <= 0)
            return;
        this.boundaryCooldowns.set(cooldownKey, now);
        // Stop sprite - but ONLY the component relevant to the boundary
        // We'll reset it to 0 so the task can then set it to a new value
        if (side === 'left' || side === 'right')
            sprite.velocityX = 0;
        if (side === 'top' || side === 'bottom')
            sprite.velocityY = 0;
        const EPSILON = 0.01; // Small offset to move away from boundary
        // Clamp position with small offset to avoid immediate re-trigger
        if (side === 'left')
            sprite.x = EPSILON;
        if (side === 'right')
            sprite.x = this.boundsWidth - sprite.width - EPSILON;
        if (side === 'top')
            sprite.y = this.boundsOffsetTop + EPSILON;
        if (side === 'bottom')
            sprite.y = this.boundsHeight - this.boundsOffsetBottom - sprite.height - EPSILON;
        if (this.eventCallback) {
            console.log(`[GameLoopManager] Boundary Hit: ${sprite.name} on ${side}. Task should handle bounce.`);
            this.eventCallback(sprite.id, 'onBoundaryHit', { hitSide: side });
        }
    }
}
GameLoopManager.instance = null;
