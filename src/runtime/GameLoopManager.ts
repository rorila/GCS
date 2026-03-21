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

import { TSprite } from '../components/TSprite';
import { TGameState } from '../components/TGameState';
import { TWindow } from '../components/TWindow';
import { GridConfig } from '../model/types';
import { AnimationManager } from './AnimationManager';

export type GameLoopState = 'stopped' | 'running' | 'paused' | 'sleeping';

export class GameLoopManager {
    private static instance: GameLoopManager | null = null;

    // State
    private state: GameLoopState = 'stopped';
    private animationFrameId: number | null = null;
    private lastTime: number = 0;

    // Configuration
    private boundsOffsetTop: number = 0;
    private boundsOffsetBottom: number = 0;

    // Grid reference - bounds are derived from this
    private gridConfig: GridConfig | null = null;
    private gameState: TGameState | null = null;

    // Objects
    private sprites: TSprite[] = [];
    private inputControllers: any[] = [];

    // Callbacks
    private renderCallback: (() => void) | null = null;
    private spriteRenderCallback: ((objects: any[]) => void) | null = null;
    private eventCallback: ((spriteId: string, eventName: string, data?: any) => void) | null = null;

    // Cooldowns and tracking
    private collisionCooldowns: Map<string, number> = new Map();
    private boundaryCooldowns: Map<string, number> = new Map();
    private collidedThisFrame: Set<string> = new Set();
    private readonly COLLISION_COOLDOWN_MS = 200;
    private readonly BOUNDARY_COOLDOWN_MS = 500;

    // Auto-Sleep: Nach N aufeinanderfolgenden Idle-Frames wird der rAF-Loop gestoppt
    private idleFrameCount: number = 0;
    private readonly IDLE_THRESHOLD = 3;

    private constructor() {
        // Private constructor for singleton
        // Bind the loop method to this instance
        this.loop = this.loop.bind(this);
    }

    public static getInstance(): GameLoopManager {
        if (!GameLoopManager.instance) {
            GameLoopManager.instance = new GameLoopManager();
        }
        return GameLoopManager.instance;
    }

    // Getters for bounds - derived from gridConfig
    public get boundsWidth(): number {
        const grid = this.gridConfig as any;
        return grid?.grid?.cols ?? grid?.cols ?? 64;
    }

    public get boundsHeight(): number {
        const grid = this.gridConfig as any;
        return grid?.grid?.rows ?? grid?.rows ?? 40;
    }

    /**
     * Initialize the game loop with objects, grid config, and callbacks
     */
    public init(
        objects: TWindow[],
        gridConfig: GridConfig,
        renderCallback: () => void,
        eventCallback?: (spriteId: string, eventName: string, data?: any) => void,
        spriteRenderCallback?: (sprites: any[]) => void
    ): void {


        // Stop any existing loop
        this.stop();

        this.gridConfig = gridConfig;
        this.renderCallback = renderCallback;
        this.spriteRenderCallback = spriteRenderCallback || null;
        this.eventCallback = eventCallback || null;

        // Filter sprites and input controllers from objects
        this.sprites = objects.filter((obj): obj is TSprite =>
            obj.className === 'TSprite' || obj.constructor.name === 'TSprite'
        );

        this.inputControllers = objects.filter(obj =>
            obj.className === 'TInputController' || obj.constructor?.name === 'TInputController'
        );

        // Find GameState component
        const gameStateObj = objects.find(obj =>
            obj.className === 'TGameState' || obj.constructor?.name === 'TGameState'
        );
        this.gameState = gameStateObj as TGameState || null;

        // Look for any TGameLoop object to get configuration
        const gameLoopObj = objects.find(obj =>
            obj.className === 'TGameLoop' || obj.constructor?.name === 'TGameLoop'
        ) as any;

        if (gameLoopObj) {
            this.boundsOffsetTop = gameLoopObj.boundsOffsetTop || 0;
            this.boundsOffsetBottom = gameLoopObj.boundsOffsetBottom || 0;

        }

        // Clear cooldowns on init
        this.collisionCooldowns.clear();
        this.boundaryCooldowns.clear();


    }

    /**
     * Start the game loop
     */
    public start(): void {


        if (this.state === 'running') {

            return;
        }

        this.state = 'running';
        this.lastTime = performance.now();
        this.idleFrameCount = 0;

        this.loop();
    }

    /**
     * Stop the game loop
     */
    public stop(): void {


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
        this.spriteRenderCallback = null;
        this.eventCallback = null;
        this.gameState = null;
        this.gridConfig = null;
    }

    /**
     * Pause the game loop
     */
    public pause(): void {
        if (this.state === 'running') {
            this.state = 'paused';
            console.log(`[GameLoopManager] Paused`);
        }
    }

    /**
     * Resume the game loop
     */
    public resume(): void {
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
    public getState(): GameLoopState {
        return this.state;
    }

    /**
     * Check if running (includes sleeping state — loop is initialized but idle)
     */
    public isRunning(): boolean {
        return this.state === 'running' || this.state === 'sleeping';
    }

    /**
     * Weckt den Loop aus dem Sleep-Zustand auf.
     * Wird aufgerufen wenn Events eintreten, Animationen starten
     * oder spritesMoving auf true wechselt.
     */
    public wakeUp(): void {
        if (this.state === 'sleeping') {
            this.state = 'running';
            this.lastTime = performance.now();
            this.idleFrameCount = 0;
            console.log(`[GameLoopManager] Woke up from sleep`);
            this.loop();
        }
    }

    /**
     * Main game loop - NORMAL METHOD, not arrow function
     * OPTIMIZATION: Only renders when something has changed to avoid endless log spam
     */
    private loop(): void {
        if (this.state !== 'running') {
            return;
        }

        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = now;

        // Update input controllers first
        this.inputControllers.forEach((ic: any) => {
            if (ic.update) ic.update();
        });

        // Check if anything needs updating
        const spritesMoving = this.gameState ? this.gameState.spritesMoving : true;
        const hasActiveAnimations = AnimationManager.getInstance().hasActiveTweens();

        // Check if any sprite has velocity (is actually moving)
        const hasMovingSprites = spritesMoving && this.sprites.some(sprite =>
            sprite.velocityX !== 0 || sprite.velocityY !== 0 || sprite.isAnimating
        );

        // Only do work if something is active
        const needsUpdate = hasActiveAnimations || hasMovingSprites;

        if (needsUpdate) {
            this.idleFrameCount = 0;

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

            // Render: Fast-Path für Sprite-Positionen (kein volles DOM-Rebuild)
            // Der spriteRenderCallback aktualisiert nur style.left/top der Sprites.
            // Der volle renderCallback wird nur bei strukturellen Änderungen benötigt.
            if (this.spriteRenderCallback) {
                this.spriteRenderCallback(this.sprites);
            } else if (this.renderCallback) {
                this.renderCallback();
            }
        } else {
            // Idle-Frame: Nichts zu tun
            this.idleFrameCount++;

            // Auto-Sleep: Nach IDLE_THRESHOLD aufeinanderfolgenden Idle-Frames
            // den rAF-Loop stoppen um CPU/Batterie zu sparen
            if (this.idleFrameCount >= this.IDLE_THRESHOLD) {
                this.state = 'sleeping';
                console.log(`[GameLoopManager] Entering sleep (${this.idleFrameCount} idle frames)`);
                return; // Kein requestAnimationFrame → Loop stoppt
            }
        }

        // Schedule next frame — nur wenn noch running (nicht sleeping)
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    /**
     * Update all sprites based on velocity
     */
    private updateSprites(deltaTime: number, applyVelocity: boolean = true): void {
        this.sprites.forEach(sprite => {
            sprite.update(deltaTime, applyVelocity);
        });
    }

    /**
     * Check collisions between sprites
     */
    private checkCollisions(): void {
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
                        } else {
                            spriteB.x += (overlap.side === 'left' ? -1 : 1) * overlap.depth;
                        }
                    } else {
                        if (Math.abs(spriteA.velocityY) >= Math.abs(spriteB.velocityY)) {
                            spriteA.y -= (overlap.side === 'top' ? -1 : 1) * overlap.depth;
                        } else {
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
                        }[overlap.side] as string;

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

    private capitalize(s: string): string {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    /**
     * Check if sprites hit stage boundaries
     */
    private checkBoundaries(): void {
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

    private triggerBoundaryEvent(sprite: TSprite, side: 'left' | 'right' | 'top' | 'bottom'): void {
        const cooldownKey = `${sprite.id}_${side}`;
        const now = performance.now();
        const lastHit = this.boundaryCooldowns.get(cooldownKey) || 0;

        // Skip if we hit recently
        if (now - lastHit < this.BOUNDARY_COOLDOWN_MS) return;

        // Velocity protection: Only trigger if the sprite is actually moving TOWARDS that boundary
        // This prevents double-triggering when the task already flipped the velocity
        if (side === 'left' && sprite.velocityX >= 0) return;
        if (side === 'right' && sprite.velocityX <= 0) return;
        if (side === 'top' && sprite.velocityY >= 0) return;
        if (side === 'bottom' && sprite.velocityY <= 0) return;

        this.boundaryCooldowns.set(cooldownKey, now);

        // Save previous velocity before zeroing (needed for collision-negate in same frame)
        if (side === 'left' || side === 'right') {
            (sprite as any)._prevVelocityX = sprite.velocityX;
            sprite.velocityX = 0;
        }
        if (side === 'top' || side === 'bottom') {
            (sprite as any)._prevVelocityY = sprite.velocityY;
            sprite.velocityY = 0;
        }

        const EPSILON = 0.01; // Small offset to move away from boundary

        // Clamp position with small offset to avoid immediate re-trigger
        if (side === 'left') sprite.x = EPSILON;
        if (side === 'right') sprite.x = this.boundsWidth - sprite.width - EPSILON;
        if (side === 'top') sprite.y = this.boundsOffsetTop + EPSILON;
        if (side === 'bottom') sprite.y = this.boundsHeight - this.boundsOffsetBottom - sprite.height - EPSILON;

        if (this.eventCallback) {
            // console.log(`[GameLoopManager] Boundary Hit: ${sprite.name} on ${side}. Task should handle bounce.`);
            this.eventCallback(sprite.id, 'onBoundaryHit', { hitSide: side });
        }
    }
}
