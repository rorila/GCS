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
import { PerfOverlay } from '../utils/PerfOverlay';
import { TGameState } from '../components/TGameState';
import { TWindow } from '../components/TWindow';
import { GridConfig } from '../model/types';
import { AnimationManager } from './AnimationManager';
import { BoundaryMode } from '../components/TGameLoop';
import { Logger } from '../utils/Logger';
import { InputManager } from './InputManager';
import { RenderLoop } from './RenderLoop';
import { CollisionManager, BoundsInfo } from './CollisionManager';
import { LoopLifecycle, type ILoopHost, type GameLoopState } from './LoopLifecycle';

const logger = Logger.get('GameLoopManager', 'Runtime_Execution');

export type { GameLoopState };

export class GameLoopManager implements ILoopHost {
    private static instance: GameLoopManager | null = null;

    private lifecycle: LoopLifecycle;
    private renderLoop: RenderLoop;
    private collisionManager: CollisionManager;
    private inputManager: InputManager;

    // Configuration
    private boundsOffsetTop = 0;
    private boundsOffsetBottom = 0;
    private boundaryMode: BoundaryMode = 'clamp';

    // Grid reference - bounds are derived from this
    private gridConfig: GridConfig | null = null;
    private gameState: TGameState | null = null;
    private gameLoopRef: any = null;

    // Objects
    private sprites: TSprite[] = [];
    private inputControllers: any[] = [];
    private panels: any[] = [];
    private runtimeUpdatables: any[] = [];
    private pendingTimerTicks: (() => void)[] = [];

    /**
     * True, während der Loop seinen eigenen Arbeitsblock abarbeitet.
     */
    private isLoopUpdating = false;

    private constructor() {
        this.lifecycle = new LoopLifecycle(this);
        this.renderLoop = new RenderLoop();
        this.collisionManager = new CollisionManager();
        this.inputManager = new InputManager();
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
        spriteRenderCallback?: (sprites: any[], dirtySprites?: any[]) => void
    ): void {
        // Stop any existing loop
        this.stop();

        this.gridConfig = gridConfig;

        // Filter sprites and input controllers from objects
        this.sprites = objects.filter((obj): obj is TSprite =>
            obj.className === 'TSprite' || obj.constructor.name === 'TSprite'
        );

        // Interpolations-Startwerte setzen
        this.sprites.forEach(sprite => {
            sprite.previousX = sprite.x;
            sprite.previousY = sprite.y;
            sprite.renderX = sprite.x;
            sprite.renderY = sprite.y;
        });

        this.inputControllers = objects.filter(obj =>
            obj.className === 'TInputController' || obj.constructor?.name === 'TInputController'
        );

        this.panels = objects.filter(obj =>
            obj.className === 'TPanel' || obj.className === 'TGroupPanel' || obj.constructor?.name === 'TPanel' || obj.constructor?.name === 'TGroupPanel'
        );

        // Komponenten mit onRuntimeUpdate sammeln (z.B. TParallaxBackground)
        this.runtimeUpdatables = objects.filter((obj: any) => typeof obj.onRuntimeUpdate === 'function');

        // Find GameState component
        const gameStateObj = objects.find(obj =>
            obj.className === 'TGameState' || obj.constructor?.name === 'TGameState'
        );
        this.gameState = gameStateObj as TGameState || null;

        // Look for any TGameLoop object to get configuration
        const gameLoopObj = objects.find(obj =>
            obj.className === 'TGameLoop' || obj.constructor?.name === 'TGameLoop'
        ) as any;

        this.gameLoopRef = gameLoopObj || null;
        let targetFPS = 60;
        let autoAdjust = true;
        if (gameLoopObj) {
            this.boundsOffsetTop = gameLoopObj.boundsOffsetTop || 0;
            this.boundsOffsetBottom = gameLoopObj.boundsOffsetBottom || 0;
            this.boundaryMode = gameLoopObj.boundaryMode || 'clamp';
            targetFPS = typeof gameLoopObj.targetFPS === 'number' ? Math.max(1, gameLoopObj.targetFPS) : 60;
            autoAdjust = gameLoopObj.autoAdjustFPS !== false;
        }

        this.lifecycle.configure(targetFPS, autoAdjust);
        this.collisionManager.configure(this.gridConfig, this.boundaryMode, eventCallback);

        // Clear cooldowns on init
        this.collisionManager.clear();
        this.renderLoop.clear();
        this.pendingTimerTicks.length = 0;
        this.renderLoop.setCallbacks(renderCallback, spriteRenderCallback || null);
    }

    /**
     * Start the game loop
     */
    public start(): void {
        this.lifecycle.start();
    }

    /**
     * Stop the game loop
     */
    public stop(): void {
        this.lifecycle.stop();

        // Clear tracking and cooldowns to prevent memory leaks and state carryover
        this.collisionManager.clear();
        this.renderLoop.clear();

        this.sprites = [];
        this.inputControllers = [];
        this.panels = [];
        this.runtimeUpdatables = [];
        this.pendingTimerTicks.length = 0;

        this.gameState = null;
        this.gridConfig = null;
        this.gameLoopRef = null;

        this.boundsOffsetTop = 0;
        this.boundsOffsetBottom = 0;
        this.boundaryMode = 'clamp';
        this.isLoopUpdating = false;
    }

    /**
     * Pause the game loop
     */
    public pause(): void {
        this.lifecycle.pause();
    }

    /**
     * Resume the game loop
     */
    public resume(): void {
        this.lifecycle.resume();
    }

    /**
     * Get current state
     */
    public getState(): GameLoopState {
        return this.lifecycle.getState();
    }

    /**
     * Liefert die aktuell gewählte Ziel-Framerate.
     */
    public getTargetFPS(): number {
        return this.lifecycle.getTargetFPS();
    }

    /**
     * Liefert, ob die automatische FPS-Anpassung aktiv ist.
     */
    public getAutoAdjustFPS(): boolean {
        return this.lifecycle.getAutoAdjustFPS();
    }

    /**
     * Schaltet die automatische FPS-Anpassung ein oder aus.
     */
    public setAutoAdjustFPS(value: boolean): void {
        this.lifecycle.setAutoAdjustFPS(value);
        if (this.gameLoopRef) {
            this.gameLoopRef.targetFPS = this.lifecycle.getTargetFPS();
            this.gameLoopRef.autoAdjustFPS = value;
        }
    }

    /**
     * Setzt die Ziel-FPS manuell (deaktiviert automatische Anpassung).
     */
    public setTargetFPS(value: number): void {
        this.lifecycle.setTargetFPS(value);
        if (this.gameLoopRef) {
            this.gameLoopRef.targetFPS = this.lifecycle.getTargetFPS();
            this.gameLoopRef.autoAdjustFPS = false;
        }
    }

    /**
     * Check if running (includes sleeping state — loop is initialized but idle)
     */
    public isRunning(): boolean {
        return this.lifecycle.isRunning();
    }

    /**
     * Weckt den Loop aus dem Sleep-Zustand auf.
     */
    public wakeUp(): void {
        this.lifecycle.wakeUp();
    }

    public enqueueTimerTick(tick: () => void): void {
        this.pendingTimerTicks.push(tick);
        if (this.lifecycle.getState() === 'sleeping') {
            this.lifecycle.wakeUp();
        }
    }

    private flushPendingTimerTicks(): void {
        if (this.pendingTimerTicks.length === 0) return;
        const ticks = this.pendingTimerTicks;
        this.pendingTimerTicks = [];
        for (const tick of ticks) {
            try {
                tick();
            } catch (e) {
                logger.error('Error executing timer tick:', e);
            }
        }
    }

    /**
     * Erzwingt einen einmaligen Render-Frame für Sprites.
     */
    public requestRender(): void {
        // Der Loop schreibt gerade selbst und zeichnet am Frame-Ende. Ein Render
        // pro Koordinatenzuweisung wäre nicht nur redundant, sondern quadratisch:
        // jedes bewegte Sprite löste einen Durchlauf über ALLE Sprites aus.
        if (this.isLoopUpdating) return;

        // Synchronisiere interpolierte Render-Koordinaten, damit Aktionen
        // die Position direkt anzeigen, ohne auf den nächsten rAF-Schritt zu warten.
        this.renderLoop.syncRenderCoordinates(this.sprites);

        const state = this.lifecycle.getState();

        if (state === 'paused') {
            // Im Pause-Zustand nur einmalig zeichnen, den Loop aber nicht starten.
            this.renderLoop.render(this.sprites, this.renderLoop.getAndClearDirtySprites());
            return;
        }
        if (state === 'sleeping') {
            this.lifecycle.wakeUp();
            return;
        }

        this.lifecycle.resetIdle();
        this.renderLoop.render(this.sprites, this.renderLoop.getAndClearDirtySprites());
    }

    /**
     * Markiert einen Sprite als dirty, weil sich dessen Bild geändert hat.
     */
    public markSpriteDirty(sprite: any): void {
        this.renderLoop.markSpriteDirty(sprite);
    }

    /**
     * Liefert alle als dirty markierten Sprites und leert die Menge.
     */
    public getAndClearDirtySprites(): any[] {
        return this.renderLoop.getAndClearDirtySprites();
    }

    /**
     * Wird vom LoopLifecycle einmal pro Frame aufgerufen.
     */
    public processFrame(steps: number, alpha: number, fixedDt: number): boolean {
        // Update input controllers first
        this.inputManager.update(this.inputControllers);

        // Check if anything needs updating
        const spritesMoving = this.gameState ? this.gameState.spritesMoving : true;
        const hasActiveAnimations = AnimationManager.getInstance().hasActiveTweens();

        let hasMovingSprites = false;
        if (spritesMoving) {
            for (let i = 0; i < this.sprites.length; i++) {
                const sprite = this.sprites[i];
                if (sprite.velocityX !== 0 || sprite.velocityY !== 0 || sprite.isAnimating) {
                    hasMovingSprites = true;
                    break;
                }
            }
        }

        const hasRuntimeUpdatables = this.runtimeUpdatables.length > 0;
        const hasPendingTimerTicks = this.pendingTimerTicks.length > 0;
        const needsUpdate = hasActiveAnimations || hasMovingSprites || hasRuntimeUpdatables || hasPendingTimerTicks;

        if (!needsUpdate) {
            return false;
        }

        // DIAGNOSE: Klammert die eigene Loop-Arbeit ein, damit sich in der
        // PerfOverlay unterscheiden lässt, ob eine lange Frame-Zeit von
        // unserem Code oder vom Zeichnen des Browsers kommt.
        PerfOverlay.markWorkBegin();

        // Sperrt Zwischen-Renders aus dem Reaktivitätssystem, solange wir
        // selbst schreiben. Freigabe unten vor markWorkEnd().
        this.isLoopUpdating = true;

        // Timer-Ticks im Loop verarbeiten, damit isLoopUpdating Folge-Renders bündelt
        this.flushPendingTimerTicks();

        // Feste Zeitschritte abarbeiten
        for (let i = 0; i < steps; i++) {
            PerfOverlay.phaseBegin('spr');
            this.updateSprites(fixedDt, spritesMoving);
            PerfOverlay.phaseEnd('spr');
        }
        PerfOverlay.markFrameStats(steps, this.sprites.length);

        // Zeitbasierte Komponenten laufen EINMAL pro Frame mit der Summe der Schritte
        PerfOverlay.phaseBegin('upd');
        this.updateRuntimeUpdatables(steps * fixedDt);
        PerfOverlay.phaseEnd('upd');

        // Update tween animations (eigene Zeitbasis)
        PerfOverlay.phaseBegin('anim');
        AnimationManager.getInstance().update();
        PerfOverlay.phaseEnd('anim');

        const bounds: BoundsInfo = {
            width: this.boundsWidth,
            height: this.boundsHeight,
            offsetTop: this.boundsOffsetTop,
            offsetBottom: this.boundsOffsetBottom
        };

        // Check collisions (physics still runs if movement enabled)
        // WICHTIG: vor updateRenderPositions, damit ein Abpraller noch im selben
        // Frame in die Interpolation einfliesst statt einen Frame zu überschiessen.
        PerfOverlay.phaseBegin('coll');
        if (spritesMoving) {
            this.collisionManager.checkCollisions(this.sprites, this.panels);
            this.collisionManager.checkBoundaries(this.sprites, this.panels, bounds);
            this.collisionManager.checkStageExits(this.sprites, this.panels, bounds);
        }
        PerfOverlay.phaseEnd('coll');

        // Sub-Frame-Interpolationspositionen für das Rendering berechnen
        PerfOverlay.phaseBegin('interp');
        this.renderLoop.updateRenderPositions(this.sprites, alpha);
        PerfOverlay.phaseEnd('interp');

        // Render: Fast-Path für Sprite-Positionen und animierte Objekte (kein volles DOM-Rebuild)
        PerfOverlay.phaseBegin('dom');
        this.renderLoop.render(
            this.renderLoop.collectRenderObjects(this.sprites),
            this.renderLoop.getAndClearDirtySprites()
        );
        PerfOverlay.phaseEnd('dom');

        this.isLoopUpdating = false;
        PerfOverlay.markWorkEnd();

        return true;
    }

    /**
     * Update all sprites based on velocity
     */
    private updateSprites(deltaTime: number, applyVelocity: boolean = true): void {
        this.sprites.forEach(sprite => {
            if (!sprite.visible) return; // Pool-Instanz im Leerlauf
            sprite.previousX = sprite.x;
            sprite.previousY = sprite.y;
            sprite.update(deltaTime, applyVelocity);
        });
    }

    /**
     * Update components that provide their own runtime loop hook.
     */
    private updateRuntimeUpdatables(deltaTime: number): void {
        for (let i = 0; i < this.runtimeUpdatables.length; i++) {
            const obj = this.runtimeUpdatables[i];
            if (obj && typeof obj.onRuntimeUpdate === 'function') {
                obj.onRuntimeUpdate(deltaTime);
            }
        }
    }

    /**
     * Setzt alle Kollisions-/Boundary-Cooldowns eines Sprites zurück.
     */
    public clearTrackingFor(spriteId: string): void {
        this.collisionManager.clearTrackingFor(spriteId);
    }

    /**
     * Kollisionsprüfung (wird von Tests direkt aufgerufen).
     */
    public checkCollisions(): void {
        this.collisionManager.checkCollisions(this.sprites, this.panels);
    }

    public onTargetFPSChanged(targetFPS: number): void {
        if (this.gameLoopRef) {
            this.gameLoopRef.targetFPS = targetFPS;
        }
    }
}
