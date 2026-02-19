import { TPropertyDef, IRuntimeComponent } from './TComponent';
import { TWindow } from './TWindow';
import { TSprite } from './TSprite';
import { TGameState } from './TGameState';
import { GridConfig } from '../model/types';
import { AnimationManager } from '../runtime/AnimationManager';

export type GameLoopState = 'stopped' | 'running' | 'paused';

/**
 * TGameLoop - A stage-placeable component that manages the game update cycle.
 * Place on stage, configure in Inspector, and it will drive sprite movement and collisions.
 * Bounds are read directly from the project's grid config.
 */
export class TGameLoop extends TWindow implements IRuntimeComponent {
    // Loop settings
    public targetFPS: number = 60;
    public state: GameLoopState = 'stopped';

    // Grid reference (set via init) - bounds are derived from this
    private gridConfig: GridConfig | null = null;
    private gameState: TGameState | null = null;

    // Offset for playable area (e.g., for headers)
    public boundsOffsetTop: number = 0;
    public boundsOffsetBottom: number = 0;

    // Internal state
    private animationFrameId: number | null = null;
    private lastTime: number = 0;
    private sprites: TSprite[] = [];
    private inputControllers: any[] = [];
    private renderCallback: (() => void) | null = null;
    private eventCallback: ((spriteId: string, eventName: string, data?: any) => void) | null = null;
    private collisionCooldowns: Map<string, number> = new Map();
    private boundaryCooldowns: Map<string, number> = new Map();
    private collidedThisFrame: Set<string> = new Set(); // Track sprites that collided this frame
    private readonly COLLISION_COOLDOWN_MS = 200;
    private readonly BOUNDARY_COOLDOWN_MS = 500; // Prevent repeated boundary events

    // CRITICAL: Private flag to bypass ReactiveRuntime proxy issues
    // Arrow functions bind 'this' to original object, but proxy changes are not reflected there
    private _isRunning: boolean = false;

    constructor(name: string, x: number = 0, y: number = 0) {
        super(name, x, y, 3, 1);
        // Visual indicator style
        this.style.backgroundColor = '#2196f3';
        this.style.borderColor = '#1565c0';
        this.style.borderWidth = 2;
        this.style.color = '#ffffff';

        // Visibility & Scoping Meta-Flags
        this.isService = true;
        this.isHiddenInRun = true;
        (this as any).isBlueprintOnly = true;
    }

    // Getter for bounds - derived from gridConfig
    public get boundsWidth(): number {
        const grid = this.gridConfig as any;
        return grid?.grid?.cols ?? grid?.cols ?? 64;
    }
    public set boundsWidth(_) {
        // No-op: bounds are determined by gridConfig
    }

    public get boundsHeight(): number {
        const grid = this.gridConfig as any;
        return grid?.grid?.rows ?? grid?.rows ?? 40;
    }
    public set boundsHeight(_) {
        // No-op: bounds are determined by gridConfig
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'targetFPS', label: 'Target FPS', type: 'number', group: 'Loop Settings' },
            { name: 'boundsOffsetTop', label: 'Bounds Offset Top', type: 'number', group: 'Boundaries' },
            { name: 'boundsOffsetBottom', label: 'Bounds Offset Bottom', type: 'number', group: 'Boundaries' }
        ];
    }

    public toJSON(): any {
        return super.toJSON();
    }

    public onRuntimeStart(): void {
        // Die eigentliche start-Logik bleibt vorerst im GameLoopManager,
        // da dieser die Abhängigkeiten (objects, callbacks) kennt.
        // Der GameLoopManager wird in Zukunft die IRuntimeComponent-Signale nutzen.
    }

    public initRuntime(callbacks: { handleEvent: any; render: any; gridConfig: any; objects: any[] }): void {
        this.init(
            callbacks.objects,
            callbacks.gridConfig,
            callbacks.render,
            callbacks.handleEvent
        );
    }

    /**
     * Initialize the game loop with objects, grid config, and callbacks
     */
    public init(
        objects: TWindow[],
        gridConfig: GridConfig,
        renderCallback: () => void,
        eventCallback?: (spriteId: string, eventName: string, data?: any) => void
    ): void {
        // Store grid reference for bounds
        this.gridConfig = gridConfig;

        // Filter sprites and input controllers
        this.sprites = objects.filter(obj =>
            (obj as any).className === 'TSprite' || obj.constructor.name === 'TSprite'
        ) as TSprite[];

        this.inputControllers = objects.filter(obj =>
            (obj as any).className === 'TInputController' || obj.constructor.name === 'TInputController'
        );

        this.gameState = objects.find(obj =>
            (obj as any).className === 'TGameState' || obj.constructor.name === 'TGameState'
        ) as TGameState || null;

        this.renderCallback = renderCallback;
        this.eventCallback = eventCallback || null;
    }

    /**
     * Start the game loop
     */
    public start(): void {
        console.log(`[TGameLoop] start() called. _isRunning: ${this._isRunning}, sprites: ${this.sprites.length}`);
        if (this._isRunning) {
            console.log(`[TGameLoop] Already running, returning.`);
            return;
        }

        this.state = 'running';
        this._isRunning = true;  // CRITICAL: Set private flag
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
    public stop(): void {
        this.state = 'stopped';
        this._isRunning = false;  // CRITICAL: Clear private flag
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Pause the game loop
     */
    public pause(): void {
        if (this._isRunning) {
            this.state = 'paused';
            this._isRunning = false;  // CRITICAL: Clear private flag
        }
    }

    /**
     * Resume the game loop
     */
    public resume(): void {
        if (this.state === 'paused' && !this._isRunning) {
            this.state = 'running';
            this._isRunning = true;  // CRITICAL: Set private flag
            this.lastTime = performance.now();
            this.loop();
        }
    }

    /**
     * Main game loop
     */
    private loop = (): void => {
        // CRITICAL: Use _isRunning instead of state to bypass proxy issues
        if (!this._isRunning) {
            console.log(`[TGameLoop] loop() not running - _isRunning is false`);
            return;
        }

        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = now;

        // Update input controllers first
        this.inputControllers.forEach((ic: any) => {
            if (ic.update) ic.update();
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
                        } else {
                            spriteB.x += (overlap.side === 'left' ? -1 : 1) * overlap.depth;
                        }
                    } else {
                        // Vertical collision: check velocityY
                        if (Math.abs(spriteA.velocityY) >= Math.abs(spriteB.velocityY)) {
                            spriteA.y -= (overlap.side === 'top' ? -1 : 1) * overlap.depth;
                        } else {
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
                        }[overlap.side] as any;

                        this.eventCallback(spriteB.id, 'onCollision', {
                            other: spriteA.name,
                            otherSprite: spriteA,
                            hitSide: oppositeSide
                        });

                        // Trigger specific side events for Sprite A
                        if (overlap.side === 'left') {
                            this.eventCallback(spriteA.id, 'onCollisionLeft', { other: spriteB });
                        } else if (overlap.side === 'right') {
                            this.eventCallback(spriteA.id, 'onCollisionRight', { other: spriteB });
                        } else if (overlap.side === 'top') {
                            this.eventCallback(spriteA.id, 'onCollisionTop', { other: spriteB });
                        } else if (overlap.side === 'bottom') {
                            this.eventCallback(spriteA.id, 'onCollisionBottom', { other: spriteB });
                        }

                        // Trigger specific side events for Sprite B (opposite side)
                        if (oppositeSide === 'left') {
                            this.eventCallback(spriteB.id, 'onCollisionLeft', { other: spriteA });
                        } else if (oppositeSide === 'right') {
                            this.eventCallback(spriteB.id, 'onCollisionRight', { other: spriteA });
                        } else if (oppositeSide === 'top') {
                            this.eventCallback(spriteB.id, 'onCollisionTop', { other: spriteA });
                        } else if (oppositeSide === 'bottom') {
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

    private triggerBoundaryEvent(sprite: TSprite, side: 'left' | 'right' | 'top' | 'bottom') {
        const cooldownKey = `${sprite.id}_${side}`;
        const now = performance.now();
        const lastHit = this.boundaryCooldowns.get(cooldownKey) || 0;

        if (now - lastHit > this.BOUNDARY_COOLDOWN_MS) {
            this.boundaryCooldowns.set(cooldownKey, now);

            // Stop sprite to prevent flying off endlessly if not handled
            if (side === 'left' || side === 'right') sprite.velocityX = 0;
            if (side === 'top' || side === 'bottom') sprite.velocityY = 0;

            // Clamp position
            if (side === 'left') sprite.x = 0;
            if (side === 'right') sprite.x = this.boundsWidth - sprite.width;
            if (side === 'top') sprite.y = this.boundsOffsetTop;
            if (side === 'bottom') sprite.y = this.boundsHeight - this.boundsOffsetBottom - sprite.height;

            if (this.eventCallback) {
                this.eventCallback(sprite.id, 'onBoundaryHit', { hitSide: side });
            }
        }
    }
}
