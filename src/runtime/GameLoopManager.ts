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
import { BoundaryMode } from '../components/TGameLoop';
import { Logger } from '../utils/Logger';

const logger = Logger.get('GameLoopManager', 'Runtime_Execution');

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
    private boundaryMode: BoundaryMode = 'clamp';

    // Grid reference - bounds are derived from this
    private gridConfig: GridConfig | null = null;
    private gameState: TGameState | null = null;

    // Objects
    private sprites: TSprite[] = [];
    private inputControllers: any[] = [];
    private panels: any[] = [];

    // Callbacks
    private renderCallback: (() => void) | null = null;
    private spriteRenderCallback: ((objects: any[]) => void) | null = null;
    private eventCallback: ((spriteId: string, eventName: string, data?: any) => void) | null = null;

    // Cooldowns and tracking
    private collisionCooldowns: Map<string, number> = new Map();
    private boundaryCooldowns: Map<string, number> = new Map();
    private collidedThisFrame: Set<string> = new Set();
    private exitedSprites: Set<string> = new Set(); // Track sprites that already fired onStageExit
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

        this.panels = objects.filter(obj =>
            obj.className === 'TPanel' || obj.className === 'TGroupPanel' || obj.constructor?.name === 'TPanel' || obj.constructor?.name === 'TGroupPanel'
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
            this.boundaryMode = gameLoopObj.boundaryMode || 'clamp';
        }

        // Clear cooldowns on init
        this.collisionCooldowns.clear();
        this.boundaryCooldowns.clear();
        this.exitedSprites.clear();


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
        this.exitedSprites.clear();
        this.collidedThisFrame.clear();
        this.sprites = [];
        this.inputControllers = [];
        this.panels = [];
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
            logger.debug(`Paused`);
        }
    }

    /**
     * Resume the game loop
     */
    public resume(): void {
        if (this.state === 'paused') {
            this.state = 'running';
            this.lastTime = performance.now();
            logger.debug(`Resumed`);
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
            logger.debug(`Woke up from sleep`);
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
        let deltaTime = (now - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = now;

        // 🚀 ANTI-JITTER: Smooth/Clamp Time Step
        // Wenn die Framerate leicht schwankt, erzwinge exakte 60 FPS Physikschritte, 
        // um stotternde Vektor-Bewegungen (Micro-Physics-Jitter) zu eliminieren.
        if (deltaTime > 0.014 && deltaTime < 0.019) {
            deltaTime = 0.01666666; 
        } else if (deltaTime > 0.033) {
            deltaTime = 0.033; // HARTES CLAMPING f�r Iframe-Lade-Lags (max 30fps step)
        }

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
                this.checkStageExits();
            }

            // Render: Fast-Path für Sprite-Positionen und animierte Objekte (kein volles DOM-Rebuild)
            const animatedObjects = AnimationManager.getInstance().getAnimatedObjects();

            if (this.spriteRenderCallback) {
                const activeObjects = new Set(this.sprites);
                animatedObjects.forEach(o => activeObjects.add(o));
                this.spriteRenderCallback(Array.from(activeObjects));
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
                logger.debug(`Entering sleep (${this.idleFrameCount} idle frames)`);
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
            if (!sprite.visible) return; // Pool-Instanz im Leerlauf
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

                // Skip invisible pool instances
                if (!spriteA.visible || !spriteB.visible) {
                    continue;
                }

                // Skip if either sprite is currently animating
                if (spriteA.isAnimating || spriteB.isAnimating) {
                    continue;
                }

                // Coordinate space isolation: Only collide sprites in the same container
                const parentA = (spriteA as any).parentId || (spriteA.parent ? spriteA.parent.id : null);
                const parentB = (spriteB as any).parentId || (spriteB.parent ? spriteB.parent.id : null);
                if (parentA !== parentB) {
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

        // --- SPRITE VS PANEL COLLISIONS ---
        for (let i = 0; i < this.sprites.length; i++) {
            for (let j = 0; j < this.panels.length; j++) {
                const sprite = this.sprites[i];
                const panel = this.panels[j];

                // Skip invisible pool instances
                if (!sprite.visible || !panel.visible) continue;
                if (sprite.isAnimating || panel.isAnimating) continue;

                const spriteParentId = (sprite as any).parentId || (sprite.parent ? sprite.parent.id : null);
                
                // Skip if the panel IS the sprite's parent (inside walls are handled by checkBoundaries)
                if (spriteParentId === panel.id || spriteParentId === panel.name) {
                    continue;
                }

                // Coordinate space isolation: Only collide if both are in the same container
                const panelParentId = (panel as any).parentId || (panel.parent ? panel.parent.id : null);
                if (spriteParentId !== panelParentId) {
                    continue;
                }

                // Panels are always rects. We construct a dummy hitbox for the panel
                const panelHitbox = {
                    x: panel.x,
                    y: panel.y,
                    w: panel.width,
                    h: panel.height,
                    shape: 'rect' as const
                };

                const spriteHb = sprite.getHitbox();

                // Simple AABB vs Rect/Circle collision
                let isColliding = false;
                if (spriteHb.shape === 'rect') {
                    isColliding = spriteHb.x < panelHitbox.x + panelHitbox.w &&
                                  spriteHb.x + spriteHb.w > panelHitbox.x &&
                                  spriteHb.y < panelHitbox.y + panelHitbox.h &&
                                  spriteHb.y + spriteHb.h > panelHitbox.y;
                } else if (spriteHb.shape === 'circle') {
                    const r = spriteHb.w / 2;
                    const cx = spriteHb.x + r;
                    const cy = spriteHb.y + spriteHb.h / 2;
                    const closestX = Math.max(panelHitbox.x, Math.min(cx, panelHitbox.x + panelHitbox.w));
                    const closestY = Math.max(panelHitbox.y, Math.min(cy, panelHitbox.y + panelHitbox.h));
                    const dx = cx - closestX;
                    const dy = cy - closestY;
                    isColliding = (dx * dx + dy * dy) < (r * r);
                }

                if (isColliding) {
                    const now = performance.now();
                    const pairKey = `panel_${sprite.id}_${panel.id}`;
                    const lastCollision = this.collisionCooldowns.get(pairKey) || 0;

                    if (now - lastCollision < this.COLLISION_COOLDOWN_MS) {
                        continue;
                    }
                    this.collisionCooldowns.set(pairKey, now);

                    // Calculate Overlap for Push-Out
                    const dx = (spriteHb.x + spriteHb.w / 2) - (panelHitbox.x + panelHitbox.w / 2);
                    const dy = (spriteHb.y + spriteHb.h / 2) - (panelHitbox.y + panelHitbox.h / 2);
                    const combinedHalfWidths = (spriteHb.w + panelHitbox.w) / 2;
                    const combinedHalfHeights = (spriteHb.h + panelHitbox.h) / 2;

                    const overlapX = combinedHalfWidths - Math.abs(dx);
                    const overlapY = combinedHalfHeights - Math.abs(dy);

                    let hitSide = 'left';
                    let depth = 0;

                    // VELOCITY-AWARE COLLISION RESOLUTION
                    const vX = sprite.velocityX || 0;
                    const vY = sprite.velocityY || 0;
                    
                    if (Math.abs(vX) > Math.abs(vY)) {
                        hitSide = dx > 0 ? 'left' : 'right';
                        depth = overlapX;
                        console.log('[PHYSICS] Velocity-Horizontal: vX=' + vX + ', vY=' + vY + ', hitSide=' + hitSide + ', depth=' + depth);
                    } else if (Math.abs(vY) > Math.abs(vX)) {
                        hitSide = dy > 0 ? 'top' : 'bottom';
                        depth = overlapY;
                        console.log('[PHYSICS] Velocity-Vertical: vX=' + vX + ', vY=' + vY + ', hitSide=' + hitSide + ', depth=' + depth);
                    } else {
                        if (overlapX < overlapY) {
                            hitSide = dx > 0 ? 'left' : 'right';
                            depth = overlapX;
                            console.log('[PHYSICS] Geometric-Horizontal: overlapX=' + overlapX + ' < overlapY=' + overlapY + ', hitSide=' + hitSide + ', depth=' + depth);
                        } else {
                            hitSide = dy > 0 ? 'top' : 'bottom';
                            depth = overlapY;
                            console.log('[PHYSICS] Geometric-Vertical: overlapY=' + overlapY + ' <= overlapX=' + overlapX + ', hitSide=' + hitSide + ', depth=' + depth);
                        }
                    }
                    console.log('[PHYSICS] pre-resolution y: ' + sprite.y + ', hitSide: ' + hitSide);

                    // Trigger Events (Sprite is the one triggering it)
                    if (this.eventCallback) {
                        this.eventCallback(sprite.id, 'onCollision', {
                            other: panel.name,
                            otherSprite: panel,
                            hitSide: hitSide
                        });
                        this.eventCallback(sprite.id, `onCollision${this.capitalize(hitSide)}`, { other: panel });
                        this.collidedThisFrame.add(sprite.id);
                    }

                    // Push out of collision ONLY IF the event is mapped!
                    // This creates the "solid wall" effect
                    const hasCollisionEvent = sprite.events?.onCollision || sprite.events?.[`onCollision${this.capitalize(hitSide)}`];
                    
                    if (hasCollisionEvent) {
                        if (hitSide === 'left' || hitSide === 'right') {
                            sprite.x -= (hitSide === 'left' ? -1 : 1) * depth;
                            // Optionally stop velocity like bouncing
                            if (this.boundaryMode === 'bounce') sprite.velocityX = -sprite.velocityX;
                        } else {
                            sprite.y -= (hitSide === 'top' ? -1 : 1) * depth;
                            if (this.boundaryMode === 'bounce') sprite.velocityY = -sprite.velocityY;
                        }
                        console.log('[PHYSICS] post-resolution y: ' + sprite.y + ', resolved on ' + hitSide);
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
            // Skip invisible pool instances
            if (!sprite.visible) return;

            // Skip sprites that are currently animating
            if (sprite.isAnimating) return;

            // Skip sprites that collided with another object this frame
            if (this.collidedThisFrame.has(sprite.id)) return;

            let bWidth = this.boundsWidth;
            let bHeight = this.boundsHeight;
            let bOffTop = this.boundsOffsetTop;
            let bOffBottom = this.boundsOffsetBottom;

            // Local Boundary Check if sprite is in a Panel
            let parentPanel: any = null;
            if ((sprite as any).parentId) {
                parentPanel = this.panels.find(p => p.id === (sprite as any).parentId || p.name === (sprite as any).parentId);
            } else if (sprite.parent) {
                parentPanel = sprite.parent;
            }

            if (parentPanel && (parentPanel.className === 'TPanel' || parentPanel.className === 'TGroupPanel')) {
                let bw = 0;
                if (parentPanel.style?.borderWidth) {
                    bw = parseInt(String(parentPanel.style.borderWidth), 10) || 0;
                }
                bWidth = parentPanel.width - (bw * 2);
                bHeight = parentPanel.height - (bw * 2);
                bOffTop = 0; // Ignore global offsets when inside a panel
                bOffBottom = 0;
            }

            const bounds = sprite.isWithinBounds(bWidth, bHeight, 0, 0);

            if (!bounds.left) {
                this.triggerBoundaryEvent(sprite, 'left', bWidth, bHeight, bOffTop, bOffBottom);
            }
            if (!bounds.right) {
                this.triggerBoundaryEvent(sprite, 'right', bWidth, bHeight, bOffTop, bOffBottom);
            }
            if (sprite.y < bOffTop) {
                this.triggerBoundaryEvent(sprite, 'top', bWidth, bHeight, bOffTop, bOffBottom);
            }
            const bottomBoundary = bHeight - bOffBottom;
            if (sprite.y + sprite.height > bottomBoundary) {
                this.triggerBoundaryEvent(sprite, 'bottom', bWidth, bHeight, bOffTop, bOffBottom);
            }
        });
    }

    private triggerBoundaryEvent(sprite: TSprite, side: 'left' | 'right' | 'top' | 'bottom', bWidth: number, bHeight: number, bOffTop: number, bOffBottom: number): void {
        const cooldownKey = `${sprite.id}_${side}`;
        const now = performance.now();
        const lastHit = this.boundaryCooldowns.get(cooldownKey) || 0;

        // Skip if we hit recently
        if (now - lastHit < this.BOUNDARY_COOLDOWN_MS) return;

        // Velocity protection: Only trigger if the sprite is actually moving TOWARDS that boundary
        if (side === 'left' && sprite.velocityX >= 0) return;
        if (side === 'right' && sprite.velocityX <= 0) return;
        if (side === 'top' && sprite.velocityY >= 0) return;
        if (side === 'bottom' && sprite.velocityY <= 0) return;

        this.boundaryCooldowns.set(cooldownKey, now);

        // ONLY apply physical clamp/bounce if the onBoundaryHit event is assigned!
        const hasBoundaryEvent = sprite.events?.onBoundaryHit;

        if (hasBoundaryEvent) {
            // --- Mode-abhängiges Verhalten ---
            if (this.boundaryMode === 'clamp') {
                // Velocity stoppen und Position clampen
                if (side === 'left' || side === 'right') {
                    (sprite as any)._prevVelocityX = sprite.velocityX;
                    sprite.velocityX = 0;
                }
                if (side === 'top' || side === 'bottom') {
                    (sprite as any)._prevVelocityY = sprite.velocityY;
                    sprite.velocityY = 0;
                }
                const EPSILON = 0.01;
                if (side === 'left') sprite.x = EPSILON;
                if (side === 'right') sprite.x = bWidth - sprite.width - EPSILON;
                if (side === 'top') sprite.y = bOffTop + EPSILON;
                if (side === 'bottom') sprite.y = bHeight - bOffBottom - sprite.height - EPSILON;
            } else if (this.boundaryMode === 'bounce') {
                // Velocity umkehren
                if (side === 'left' || side === 'right') sprite.velocityX = -sprite.velocityX;
                if (side === 'top' || side === 'bottom') sprite.velocityY = -sprite.velocityY;
                
                // Position minimal korrigieren damit kein Re-Trigger
                const EPSILON = 0.01;
                if (side === 'left') sprite.x = EPSILON;
                if (side === 'right') sprite.x = bWidth - sprite.width - EPSILON;
                if (side === 'top') sprite.y = bOffTop + EPSILON;
                if (side === 'bottom') sprite.y = bHeight - bOffBottom - sprite.height - EPSILON;
            }
        }

        if (this.eventCallback) {
            this.eventCallback(sprite.id, 'onBoundaryHit', { hitSide: side });
        }
    }
    /**
     * Prüfe ob Sprites die Stage komplett verlassen haben.
     * Feuert onStageExit mit { exitSide } wenn das Sprite vollständig außerhalb ist.
     * Wird nur im Modus 'event-only' relevant (bei 'clamp'/'bounce' können Sprites den Rand nicht verlassen).
     */
    private checkStageExits(): void {
        // We now check Stage Exits regardless of boundary mode because sprites can fly off 
        // if they don't have onBoundaryHit mapped!
        this.sprites.forEach(sprite => {
            if (sprite.isAnimating) return;

            const spriteKey = sprite.id || sprite.name;
            if (this.exitedSprites.has(spriteKey)) return; // Schon gefeuert

            let bWidth = this.boundsWidth;
            let bHeight = this.boundsHeight;
            let bOffTop = this.boundsOffsetTop;
            let bOffBottom = this.boundsOffsetBottom;

            // Local Boundary Check if sprite is in a Panel
            let parentPanel: any = null;
            if ((sprite as any).parentId) {
                parentPanel = this.panels.find(p => p.id === (sprite as any).parentId || p.name === (sprite as any).parentId);
            } else if (sprite.parent) {
                parentPanel = sprite.parent;
            }

            if (parentPanel && (parentPanel.className === 'TPanel' || parentPanel.className === 'TGroupPanel')) {
                let bw = 0;
                if (parentPanel.style?.borderWidth) {
                    bw = parseInt(String(parentPanel.style.borderWidth), 10) || 0;
                }
                bWidth = parentPanel.width - (bw * 2);
                bHeight = parentPanel.height - (bw * 2);
                bOffTop = 0;
                bOffBottom = 0;
            }

            let exitSide: string | null = null;

            // Komplett links raus: rechter Rand des Sprites < 0
            if (sprite.x + sprite.width < 0) {
                exitSide = 'left';
            }
            // Komplett rechts raus: linker Rand > Stage-Breite
            else if (sprite.x > bWidth) {
                exitSide = 'right';
            }
            // Komplett oben raus: unterer Rand < boundsOffsetTop
            else if (sprite.y + sprite.height < bOffTop) {
                exitSide = 'top';
            }
            // Komplett unten raus: oberer Rand > Stage-Höhe
            else if (sprite.y > bHeight - bOffBottom) {
                exitSide = 'bottom';
            }

            if (exitSide && this.eventCallback) {
                this.exitedSprites.add(spriteKey);
                this.eventCallback(sprite.id, 'onStageExit', { exitSide });
            }
        });
    }
}





