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
    private gameLoopRef: any = null;

    // Objects
    private sprites: TSprite[] = [];

    /**
     * True, waehrend der Loop seinen eigenen Arbeitsblock abarbeitet.
     *
     * Der reaktive globale Listener kann nicht erkennen, ob eine Positions-
     * aenderung von einer Action oder vom Loop selbst stammt, und loeste bisher
     * pro Koordinatenzuweisung ein DOM-Update aus. Der Loop zeichnet am Ende
     * jedes Frames ohnehin — diese Zwischen-Renders waren also samt und sonders
     * redundant.
     */
    private isLoopUpdating: boolean = false;
    private inputControllers: any[] = [];
    private panels: any[] = [];
    private runtimeUpdatables: any[] = [];
    private pendingTimerTicks: (() => void)[] = [];

    // Callbacks
    private renderCallback: (() => void) | null = null;
    private spriteRenderCallback: ((objects: any[], dirtyObjects?: any[]) => void) | null = null;
    private eventCallback: ((spriteId: string, eventName: string, data?: any) => void) | null = null;

    // Cooldowns and tracking
    private collisionCooldowns: Map<string, number> = new Map();
    private boundaryCooldowns: Map<string, number> = new Map();
    private collidedThisFrame: Set<string> = new Set();
    private exitedSprites: Set<string> = new Set(); // Track sprites that already fired onStageExit
    private dirtySprites: Set<any> = new Set(); // Sprites, deren Bild sich in diesem Frame geändert hat
    private readonly COLLISION_COOLDOWN_MS = 200;
    private readonly BOUNDARY_COOLDOWN_MS = 500;

    // Adaptive FPS: permanentes gleitendes Fenster fuer regelmaessige Neubewertung
    private targetFPS: number = 60;
    private userTargetFPS: number = 60;
    private autoAdjustFPS: boolean = true;

    // Fixed timestep + sub-frame interpolation
    private fixedDt: number = 1 / 60;
    private accumulator: number = 0;

    private frameTimeHistory: number[] = [];
    private frameTimeIndex: number = 0;
    private fpsCheckCounter: number = 0;
    private fpsWarmupFrames: number = 0;
    private readonly FPS_WINDOW_SIZE = 90;
    private readonly FPS_CHECK_INTERVAL = 30;
    private readonly FPS_WARMUP_FRAMES = 30;
    private readonly FPS_SLOW_THRESHOLD_MS = 22; // ~45 FPS
    private readonly FPS_UPGRADE_AVG_MS = 17;     // ~58 FPS
    private readonly FPS_UPGRADE_SLOW_PCT = 0.10; // nur wenige langsame Frames
    private readonly FPS_DOWNGRADE_AVG_MS = 24;   // ~41 FPS
    private readonly FPS_DOWNGRADE_SLOW_PCT = 0.35;

    // Auto-Sleep: Nach N aufeinanderfolgenden Idle-Frames wird der rAF-Loop gestoppt
    private idleFrameCount: number = 0;
    private readonly IDLE_THRESHOLD = 30;
    private lastFrameTime: number = 0;
    /** true, solange der naechste Frame die Zeitbasis neu setzen soll (Start/Wake/Resume). */
    private resyncClock: boolean = true;

    // PERF: Wiederverwendete Puffer, damit der 60fps-Pfad keine Objekte pro Frame
    // allokiert. Frische Arrays/Sets erzeugen sonst regelmaessige GC-Pausen, die
    // sich als kurze Ruckler zeigen.
    private readonly activeSpriteBuffer: TSprite[] = [];
    private readonly activePanelBuffer: any[] = [];
    private readonly renderObjectBuffer: any[] = [];
    private readonly renderObjectSeen: Set<any> = new Set();

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
        spriteRenderCallback?: (sprites: any[], dirtySprites?: any[]) => void
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
        if (gameLoopObj) {
            this.boundsOffsetTop = gameLoopObj.boundsOffsetTop || 0;
            this.boundsOffsetBottom = gameLoopObj.boundsOffsetBottom || 0;
            this.boundaryMode = gameLoopObj.boundaryMode || 'clamp';
            this.targetFPS = typeof gameLoopObj.targetFPS === 'number' ? Math.max(1, gameLoopObj.targetFPS) : 60;
            this.userTargetFPS = this.targetFPS;
            this.autoAdjustFPS = gameLoopObj.autoAdjustFPS !== false;
        }
        this.fixedDt = 1 / this.targetFPS;

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
        this.lastFrameTime = this.lastTime;
        this.accumulator = 0;
        this.idleFrameCount = 0;
        this.resyncClock = true;

        if (this.autoAdjustFPS) {
            this.frameTimeHistory = new Array(this.FPS_WINDOW_SIZE).fill(0);
            this.frameTimeIndex = 0;
            this.fpsCheckCounter = 0;
            this.fpsWarmupFrames = 0;
            logger.info(`[GameLoopManager] Starte dynamische FPS-Überwachung`);
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
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
        this.dirtySprites.clear();
        this.sprites = [];
        this.inputControllers = [];
        this.panels = [];
        this.runtimeUpdatables = [];
        this.renderCallback = null;
        this.spriteRenderCallback = null;
        this.eventCallback = null;
        this.gameState = null;
        this.gridConfig = null;
        this.pendingTimerTicks.length = 0;
    }

    /**
     * Pause the game loop
     */
    public pause(): void {
        // Auch aus 'sleeping' pausieren: sonst koennte ein Event den Loop per
        // wakeUp() wieder starten, obwohl das Spiel angehalten sein soll.
        if (this.state === 'running' || this.state === 'sleeping') {
            this.state = 'paused';
            if (this.animationFrameId !== null) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
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
            this.resyncClock = true;
            logger.debug(`Resumed`);
            this.animationFrameId = requestAnimationFrame(this.loop);
        }
    }

    /**
     * Get current state
     */
    public getState(): GameLoopState {
        return this.state;
    }

    /**
     * Liefert die aktuell gewaehlte Ziel-Framerate.
     * Nach dem automatischen Benchmark kann das 30 statt 60 sein.
     */
    public getTargetFPS(): number {
        return this.targetFPS;
    }

    /**
     * Liefert, ob die automatische FPS-Anpassung aktiv ist.
     */
    public getAutoAdjustFPS(): boolean {
        return this.autoAdjustFPS;
    }

    /**
     * Schaltet die automatische FPS-Anpassung ein oder aus.
     */
    public setAutoAdjustFPS(value: boolean): void {
        this.autoAdjustFPS = value;
        if (value) {
            this.targetFPS = this.userTargetFPS;
            this.fixedDt = 1 / this.targetFPS;
            if (this.gameLoopRef) {
                this.gameLoopRef.targetFPS = this.targetFPS;
            }
            this.frameTimeHistory = new Array(this.FPS_WINDOW_SIZE).fill(0);
            this.frameTimeIndex = 0;
            this.fpsCheckCounter = 0;
            this.fpsWarmupFrames = 0;
        }
        if (this.gameLoopRef) {
            this.gameLoopRef.autoAdjustFPS = value;
        }
    }

    /**
     * Setzt die Ziel-FPS manuell (deaktiviert automatische Anpassung).
     */
    public setTargetFPS(value: number): void {
        const clamped = Math.max(1, Math.min(120, value));
        this.userTargetFPS = clamped;
        this.targetFPS = clamped;
        this.fixedDt = 1 / clamped;
        this.autoAdjustFPS = false;
        if (this.gameLoopRef) {
            this.gameLoopRef.targetFPS = clamped;
            this.gameLoopRef.autoAdjustFPS = false;
        }
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
            this.resyncClock = true;
            logger.debug(`Woke up from sleep`);
            this.animationFrameId = requestAnimationFrame(this.loop);
        }
    }

    public enqueueTimerTick(tick: () => void): void {
        this.pendingTimerTicks.push(tick);
        if (this.state === 'sleeping') {
            this.wakeUp();
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
     * Wird aufgerufen wenn x/y eines Sprites per Action direkt gesetzt wird
     * (nicht durch Velocity im Loop) – für Gleichbehandlung mit TButton/TPanel.
     */
    public requestRender(): void {
        // Der Loop schreibt gerade selbst und zeichnet am Frame-Ende. Ein Render
        // pro Koordinatenzuweisung waere nicht nur redundant, sondern quadratisch:
        // jedes bewegte Sprite loeste einen Durchlauf ueber ALLE Sprites aus.
        if (this.isLoopUpdating) return;

        // Synchronisiere interpolierte Render-Koordinaten, damit Aktionen
        // die Position direkt anzeigen, ohne auf den naechsten rAF-Schritt zu warten.
        this.sprites.forEach(sprite => {
            sprite.renderX = sprite.x;
            sprite.renderY = sprite.y;
        });

        if (this.state === 'paused') {
            // Im Pause-Zustand nur einmalig zeichnen, den Loop aber nicht starten.
            if (this.spriteRenderCallback) {
                this.spriteRenderCallback(this.sprites, this.getAndClearDirtySprites());
            } else if (this.renderCallback) {
                this.renderCallback();
            }
            return;
        }
        if (this.state === 'sleeping') {
            this.wakeUp();
            return;
        }
        this.idleFrameCount = 0;
        if (this.spriteRenderCallback) {
            this.spriteRenderCallback(this.sprites, this.getAndClearDirtySprites());
        } else if (this.renderCallback) {
            this.renderCallback();
        }
    }

    /**
     * Markiert einen Sprite als dirty, weil sich dessen Bild (imageListId/imageIndex) geändert hat.
     * Die Liste wird am Ende des Frames im dom-Teil des Loops in einem Schwung abgearbeitet.
     */
    public markSpriteDirty(sprite: any): void {
        this.dirtySprites.add(sprite);
    }

    /**
     * Liefert alle als dirty markierten Sprites und leert die Menge für den nächsten Frame.
     */
    public getAndClearDirtySprites(): any[] {
        const sprites = Array.from(this.dirtySprites);
        this.dirtySprites.clear();
        return sprites;
    }

    /**
     * Main game loop - NORMAL METHOD, not arrow function
     * OPTIMIZATION: Only renders when something has changed to avoid endless log spam
     */
    private loop(timestamp?: number): void {
        if (this.state !== 'running') {
            return;
        }

        // WICHTIG: Der von requestAnimationFrame gelieferte Timestamp ist am VSync
        // ausgerichtet. performance.now() innerhalb des Callbacks schwankt dagegen
        // um mehrere Millisekunden, je nachdem wie viel der Browser vor dem Dispatch
        // erledigt hat. Genau diese Schwankung landete bisher im Akkumulator und
        // liess die Sub-Frame-Interpolation sichtbar zittern.
        const now = timestamp !== undefined ? timestamp : performance.now();

        // Nach Start/Resume/WakeUp ist die alte Zeitbasis wertlos: ohne Reset
        // wuerde ein einzelner Riesen-Frame mehrere Physikschritte auf einmal
        // nachholen und als Sprung sichtbar werden.
        if (this.resyncClock) {
            this.resyncClock = false;
            this.lastFrameTime = now;
            this.accumulator = 0;
        }

        const frameMs = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Adaptive FPS: Frame-Zeiten in gleitendes Fenster schreiben.
        if (this.autoAdjustFPS) {
            this.fpsWarmupFrames++;

            if (this.fpsWarmupFrames > this.FPS_WARMUP_FRAMES) {
                const cappedFrameMs = Math.min(frameMs, 100);
                this.frameTimeHistory[this.frameTimeIndex] = cappedFrameMs;
                this.frameTimeIndex = (this.frameTimeIndex + 1) % this.FPS_WINDOW_SIZE;
                this.fpsCheckCounter++;

                if (this.fpsCheckCounter >= this.FPS_CHECK_INTERVAL) {
                    this.fpsCheckCounter = 0;
                    this.evaluateAdaptiveFPS();
                }
            }
        }

        // Feste Logik-Schrittweite mit Akkumulator + sub-frame Interpolation.
        this.accumulator += Math.min(frameMs / 1000, 0.1);
        this.lastTime = now;

        // Update input controllers first
        this.inputControllers.forEach((ic: any) => {
            if (ic.update) ic.update();
        });

        // Check if anything needs updating
        const spritesMoving = this.gameState ? this.gameState.spritesMoving : true;
        const hasActiveAnimations = AnimationManager.getInstance().hasActiveTweens();

        // Check if any sprite has velocity (is actually moving)
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

        // Keep loop alive for runtime-updatable components (e.g. TParallaxBackground)
        const hasRuntimeUpdatables = this.runtimeUpdatables.length > 0;

        // Only do work if something is active
        const hasPendingTimerTicks = this.pendingTimerTicks.length > 0;
        const needsUpdate = hasActiveAnimations || hasMovingSprites || hasRuntimeUpdatables || hasPendingTimerTicks;

        if (needsUpdate) {
            // DIAGNOSE: Klammert die eigene Loop-Arbeit ein, damit sich in der
            // PerfOverlay unterscheiden laesst, ob eine lange Frame-Zeit von
            // unserem Code oder vom Zeichnen des Browsers kommt.
            PerfOverlay.markWorkBegin();

            // Sperrt Zwischen-Renders aus dem Reaktivitaetssystem, solange wir
            // selbst schreiben. Freigabe unten vor markWorkEnd().
            this.isLoopUpdating = true;

            this.idleFrameCount = 0;

            // Timer-Ticks im Loop verarbeiten, damit isLoopUpdating Folge-Renders bündelt
            this.flushPendingTimerTicks();

            // Feste Zeitschritte abarbeiten
            let steps = 0;
            while (this.accumulator >= this.fixedDt) {
                this.accumulator -= this.fixedDt;
                steps++;
                PerfOverlay.phaseBegin('spr');
                this.updateSprites(this.fixedDt, spritesMoving);
                PerfOverlay.phaseEnd('spr');
            }
            PerfOverlay.markFrameStats(steps, this.sprites.length);

            // Zeitbasierte Komponenten (Animation, Spawner, Parallax) laufen
            // EINMAL pro Frame mit der Summe der Schritte statt einmal pro
            // Schritt. Die vergangene Zeit ist identisch, aber bei mehreren
            // Schritten pro Frame entfaellt die mehrfache Arbeit — die zuvor
            // eine Aufschaukelung speiste: langsame Frames erzwingen mehr
            // Schritte, die wiederum den Frame verlangsamten.
            PerfOverlay.phaseBegin('upd');
            this.updateRuntimeUpdatables(steps * this.fixedDt);
            PerfOverlay.phaseEnd('upd');

            // Update tween animations (eigene Zeitbasis)
            PerfOverlay.phaseBegin('anim');
            AnimationManager.getInstance().update();
            PerfOverlay.phaseEnd('anim');

            // Clear collision tracking for this frame
            this.collidedThisFrame.clear();

            // Check collisions (physics still runs if movement enabled)
            // WICHTIG: vor updateRenderPositions, damit ein Abpraller noch im selben
            // Frame in die Interpolation einfliesst statt einen Frame zu ueberschiessen.
            PerfOverlay.phaseBegin('coll');
            if (spritesMoving) {
                this.checkCollisions();
                this.checkBoundaries();
                this.checkStageExits();
            }
            PerfOverlay.phaseEnd('coll');

            // Sub-Frame-Interpolationspositionen fuer das Rendering berechnen
            PerfOverlay.phaseBegin('interp');
            this.updateRenderPositions(this.accumulator / this.fixedDt);
            PerfOverlay.phaseEnd('interp');

            // Render: Fast-Path für Sprite-Positionen und animierte Objekte (kein volles DOM-Rebuild)
            PerfOverlay.phaseBegin('dom');
            if (this.spriteRenderCallback) {
                this.spriteRenderCallback(this.collectRenderObjects(), this.getAndClearDirtySprites());
            } else if (this.renderCallback) {
                this.renderCallback();
            }
            PerfOverlay.phaseEnd('dom');

            this.isLoopUpdating = false;
            PerfOverlay.markWorkEnd();
        } else {
            // Idle-Frame: Nichts zu tun
            this.idleFrameCount++;

            // Auto-Sleep: Nach IDLE_THRESHOLD aufeinanderfolgenden Idle-Frames
            // den rAF-Loop stoppen um CPU/Batterie zu sparen.
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
     * Stellt die Liste der zu rendernden Objekte zusammen (Sprites + getweente Objekte).
     *
     * PERF: Nutzt wiederverwendete Puffer. Die frueheren `new Set(...)` /
     * `Array.from(...)` pro Frame erzeugten Muell, der als periodische GC-Pause
     * sichtbar wurde.
     */
    private collectRenderObjects(): any[] {
        const out = this.renderObjectBuffer;
        out.length = 0;

        const animationManager = AnimationManager.getInstance();
        if (!animationManager.hasActiveTweens()) {
            // Normalfall: nur Sprites, kein Duplikat-Check noetig.
            for (let i = 0; i < this.sprites.length; i++) {
                out.push(this.sprites[i]);
            }
            return out;
        }

        const seen = this.renderObjectSeen;
        seen.clear();
        for (let i = 0; i < this.sprites.length; i++) {
            const sprite = this.sprites[i];
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

    /**
     * Bewertet das gleitende Frame-Zeit-Fenster neu und passt targetFPS an.
     */
    private evaluateAdaptiveFPS(): void {
        let total = 0;
        let slow = 0;
        let count = 0;

        for (const ms of this.frameTimeHistory) {
            if (ms <= 0) continue;
            total += ms;
            count++;
            if (ms > this.FPS_SLOW_THRESHOLD_MS) slow++;
        }
        if (count === 0) return;

        const avgMs = total / count;
        const slowRatio = slow / count;
        const previous = this.targetFPS;

        if (this.targetFPS === 60) {
            if (avgMs > this.FPS_DOWNGRADE_AVG_MS && slowRatio > this.FPS_DOWNGRADE_SLOW_PCT) {
                this.targetFPS = 30;
            }
        } else if (this.targetFPS === 30) {
            if (avgMs < this.FPS_UPGRADE_AVG_MS && slowRatio < this.FPS_UPGRADE_SLOW_PCT) {
                this.targetFPS = 60;
            }
        }

        if (this.targetFPS !== previous) {
            this.fixedDt = 1 / this.targetFPS;
            if (this.gameLoopRef) {
                this.gameLoopRef.targetFPS = this.targetFPS;
            }
            logger.info(`[GameLoopManager] FPS-Anpassung: avg=${avgMs.toFixed(2)}ms, ${(slowRatio * 100).toFixed(0)}% langsam -> targetFPS=${this.targetFPS}`);
        }
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
     * Berechnet sub-frame interpolierte Render-Koordinaten fuer alle Sprites.
     */
    private updateRenderPositions(alpha: number): void {
        this.sprites.forEach(sprite => {
            if (!sprite.visible) return;
            const dx = sprite.x - sprite.previousX;
            const dy = sprite.y - sprite.previousY;
            sprite.renderX = sprite.x + dx * alpha;
            sprite.renderY = sprite.y + dy * alpha;
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
     * Check collisions between sprites
     */
    private checkCollisions(): void {
        // PERF: Diese Paar-Schleife ist quadratisch und damit die einzige Stelle im
        // Loop, die nicht linear mit der Sprite-Anzahl skaliert. Unsichtbare
        // Pool-Instanzen wuerden jedes Paar ohnehin verwerfen, verursachten aber
        // trotzdem den Schleifendurchlauf: Bei 30 Pool-Sprites mit 5 aktiven sind
        // das 435 statt 10 Paaren pro Frame.
        // Der Filter ist eine Momentaufnahme zum Frame-Beginn. Die Pruefungen im
        // Rumpf bleiben deshalb erhalten, weil ein onCollision-Handler ein Sprite
        // mitten in der Schleife freigeben (visible=false) oder animieren kann.
        const activeSprites = this.activeSpriteBuffer;
        activeSprites.length = 0;
        for (const sprite of this.sprites) {
            if (!sprite.visible) continue;
            if (sprite.isAnimating) continue;
            if ((sprite as any).collisionEnabled === false) continue;
            activeSprites.push(sprite);
        }

        for (let i = 0; i < activeSprites.length; i++) {
            for (let j = i + 1; j < activeSprites.length; j++) {
                const spriteA = activeSprites[i];
                const spriteB = activeSprites[j];

                // Erneut pruefen: ein Event-Handler kann den Zustand mitten im Frame aendern.
                if (!spriteA.visible || !spriteB.visible) {
                    continue;
                }

                if (spriteA.isAnimating || spriteB.isAnimating) {
                    continue;
                }

                if ((spriteA as any).collisionEnabled === false || (spriteB as any).collisionEnabled === false) {
                    continue;
                }

                // Coordinate space isolation: Only collide sprites in the same container
                const parentA = (spriteA as any).parentId || (spriteA.parent ? spriteA.parent.id : null);
                const parentB = (spriteB as any).parentId || (spriteB.parent ? spriteB.parent.id : null);
                if (parentA !== parentB) {
                    continue;
                }

                // CollisionGroup-Filter: Sprites mit gleicher, explizit gesetzter Gruppe
                // kollidieren NICHT miteinander (z.B. Ufo-vs-Ufo wird übersprungen).
                // Unterschiedliche Gruppen (z.B. "ufo" vs "bullet") kollidieren normal.
                // 'default' wird als "keine Gruppe" behandelt – dort greift der Filter nicht.
                const groupA = (spriteA as any).collisionGroup || 'default';
                const groupB = (spriteB as any).collisionGroup || 'default';
                if (groupA !== 'default' && groupA === groupB) {
                    continue;
                }

                // Skip collision if NEITHER sprite has any collision event handler defined.
                // Without a handler, there is no reason for push-out or event-firing.
                const eventsA = (spriteA as any).events || (spriteA as any).Tasks || {};
                const eventsB = (spriteB as any).events || (spriteB as any).Tasks || {};
                const hasCollisionHandler =
                    eventsA.onCollision || eventsA.onCollisionTop || eventsA.onCollisionBottom ||
                    eventsA.onCollisionLeft || eventsA.onCollisionRight ||
                    eventsB.onCollision || eventsB.onCollisionTop || eventsB.onCollisionBottom ||
                    eventsB.onCollisionLeft || eventsB.onCollisionRight;
                if (!hasCollisionHandler) {
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

                    // Push-Out NUR wenn explizit gewünscht (z.B. für Pong-artige Spiele).
                    // Standard: false → Sprites fliegen durcheinander und lösen nur Events aus.
                    const wantsPushOut = (spriteA as any).pushOutOnCollision || (spriteB as any).pushOutOnCollision;
                    if (wantsPushOut) {
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
                    }

                    // Trigger collision events
                    if (this.eventCallback) {
                        this.eventCallback(spriteA.id, 'onCollision', {
                            other: spriteB.name,
                            otherSprite: spriteB,
                            hitSide: overlap.side,
                            contactX: overlap.contactX,
                            contactY: overlap.contactY
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
                            hitSide: oppositeSide,
                            contactX: overlap.contactX,
                            contactY: overlap.contactY
                        });

                        // Trigger specific side events – mit vollständigen Daten,
                        // damit Conditions auf otherSprite.templateName etc. zugreifen können.
                        this.eventCallback(spriteA.id, `onCollision${this.capitalize(overlap.side)}`, {
                            other: spriteB.name,
                            otherSprite: spriteB,
                            hitSide: overlap.side,
                            contactX: overlap.contactX,
                            contactY: overlap.contactY
                        });
                        this.eventCallback(spriteB.id, `onCollision${this.capitalize(oppositeSide)}`, {
                            other: spriteA.name,
                            otherSprite: spriteA,
                            hitSide: oppositeSide,
                            contactX: overlap.contactX,
                            contactY: overlap.contactY
                        });

                        // Track collision
                        this.collidedThisFrame.add(spriteA.id);
                        this.collidedThisFrame.add(spriteB.id);
                    }
                }
            }
        }

        // --- SPRITE VS PANEL COLLISIONS ---
        // PERF: Gleiche Filterung wie oben. Zusaetzlich werden inaktive Panels
        // einmalig aussortiert, statt sie pro Sprite erneut zu pruefen.
        const activePanels = this.activePanelBuffer;
        activePanels.length = 0;
        for (const panel of this.panels) {
            if (!panel.visible) continue;
            if (panel.isAnimating) continue;
            if (panel.collisionEnabled === false) continue;
            activePanels.push(panel);
        }

        for (let i = 0; i < activeSprites.length; i++) {
            for (let j = 0; j < activePanels.length; j++) {
                const sprite = activeSprites[i];
                const panel = activePanels[j];

                // Erneut pruefen: Zustand kann sich mitten im Frame geaendert haben.
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

                if ((sprite as any).collisionEnabled === false || (panel as any).collisionEnabled === false) {
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
                        logger.debug(`[PHYSICS] Velocity-Horizontal: vX=${vX}, vY=${vY}, hitSide=${hitSide}, depth=${depth}`);
                    } else if (Math.abs(vY) > Math.abs(vX)) {
                        hitSide = dy > 0 ? 'top' : 'bottom';
                        depth = overlapY;
                        logger.debug(`[PHYSICS] Velocity-Vertical: vX=${vX}, vY=${vY}, hitSide=${hitSide}, depth=${depth}`);
                    } else {
                        if (overlapX < overlapY) {
                            hitSide = dx > 0 ? 'left' : 'right';
                            depth = overlapX;
                            logger.debug(`[PHYSICS] Geometric-Horizontal: overlapX=${overlapX} < overlapY=${overlapY}, hitSide=${hitSide}, depth=${depth}`);
                        } else {
                            hitSide = dy > 0 ? 'top' : 'bottom';
                            depth = overlapY;
                            logger.debug(`[PHYSICS] Geometric-Vertical: overlapY=${overlapY} <= overlapX=${overlapX}, hitSide=${hitSide}, depth=${depth}`);
                        }
                    }
                    logger.debug(`[PHYSICS] pre-resolution y: ${sprite.y}, hitSide: ${hitSide}`);

                    const contactLeft = Math.max(spriteHb.x, panelHitbox.x);
                    const contactTop = Math.max(spriteHb.y, panelHitbox.y);
                    const contactRight = Math.min(spriteHb.x + spriteHb.w, panelHitbox.x + panelHitbox.w);
                    const contactBottom = Math.min(spriteHb.y + spriteHb.h, panelHitbox.y + panelHitbox.h);
                    const contactX = contactLeft + (contactRight - contactLeft) / 2;
                    const contactY = contactTop + (contactBottom - contactTop) / 2;

                    // Trigger Events (Sprite is the one triggering it)
                    if (this.eventCallback) {
                        this.eventCallback(sprite.id, 'onCollision', {
                            other: panel.name,
                            otherSprite: panel,
                            hitSide: hitSide,
                            contactX,
                            contactY
                        });
                        this.eventCallback(sprite.id, `onCollision${this.capitalize(hitSide)}`, { other: panel });
                        this.collidedThisFrame.add(sprite.id);
                    }

                    // Push out of collision ONLY IF explicitly desired via pushOutOnCollision
                    // (z.B. für Jump & Run Plattformen oder Wände)
                    const wantsPushOut = (sprite as any).pushOutOnCollision || (panel as any).pushOutOnCollision;
                    
                    if (wantsPushOut) {
                        if (hitSide === 'left' || hitSide === 'right') {
                            sprite.x -= (hitSide === 'left' ? -1 : 1) * depth;
                            // Optionally stop velocity like bouncing
                            if (this.boundaryMode === 'bounce') sprite.velocityX = -sprite.velocityX;
                        } else {
                            sprite.y -= (hitSide === 'top' ? -1 : 1) * depth;
                            if (this.boundaryMode === 'bounce') sprite.velocityY = -sprite.velocityY;
                        }
                        logger.debug(`[PHYSICS] post-resolution y: ${sprite.y}, resolved on ${hitSide}`);
                    }
                }
            }
        }
    }

    private capitalize(s: string): string {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    /**
     * Setzt alle Kollisions-/Boundary-Cooldowns eines Sprites zurueck.
     *
     * Notwendig fuer Object-Pooling: Pool-Instanzen behalten ihre ID ueber
     * release/acquire hinweg. Ohne Reset wuerde eine neu gespawnte Instanz die
     * Cooldowns ihres Vorlebens erben und ihre erste Kollision verschlucken.
     */
    public clearTrackingFor(spriteId: string): void {
        if (!spriteId) return;

        this.collidedThisFrame.delete(spriteId);
        this.exitedSprites.delete(spriteId);

        for (const key of Array.from(this.collisionCooldowns.keys())) {
            if (key.startsWith(`${spriteId}_`) || key.endsWith(`_${spriteId}`)) {
                this.collisionCooldowns.delete(key);
            }
        }
        for (const key of Array.from(this.boundaryCooldowns.keys())) {
            if (key.startsWith(`${spriteId}_`)) {
                this.boundaryCooldowns.delete(key);
            }
        }
    }

    /**
     * Check if sprites hit stage boundaries
     */
    private checkBoundaries(): void {
        this.sprites.forEach(sprite => {
            if (!sprite.visible) return;
            if ((sprite as any).collisionEnabled === false) return;

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
                const cellSize = (this.gridConfig as any)?.cellSize ?? (this.gridConfig as any)?.grid?.cellSize ?? 20;
                const bwCells = bw / cellSize;
                bWidth = parentPanel.width - (bwCells * 2);
                bHeight = parentPanel.height - (bwCells * 2);
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

        // Velocity protection: Only trigger if the sprite is actually moving TOWARDS that boundary
        if (side === 'left' && sprite.velocityX >= 0) return;
        if (side === 'right' && sprite.velocityX <= 0) return;
        if (side === 'top' && sprite.velocityY >= 0) return;
        if (side === 'bottom' && sprite.velocityY <= 0) return;

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

        // Skip event firing if we hit recently
        if (now - lastHit < this.BOUNDARY_COOLDOWN_MS) return;
        this.boundaryCooldowns.set(cooldownKey, now);

        const hb = sprite.getHitbox();
        let contactX = 0;
        let contactY = 0;
        if (side === 'left') {
            contactX = 0;
            contactY = hb.y + hb.h / 2;
        } else if (side === 'right') {
            contactX = bWidth;
            contactY = hb.y + hb.h / 2;
        } else if (side === 'top') {
            contactX = hb.x + hb.w / 2;
            contactY = bOffTop;
        } else if (side === 'bottom') {
            contactX = hb.x + hb.w / 2;
            contactY = bHeight - bOffBottom;
        }

        if (this.eventCallback) {
            this.eventCallback(sprite.id, 'onBoundaryHit', { hitSide: side, contactX, contactY });
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
            if ((sprite as any).collisionEnabled === false) return;

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
                const cellSize = (this.gridConfig as any)?.cellSize ?? (this.gridConfig as any)?.grid?.cellSize ?? 20;
                const bwCells = bw / cellSize;
                bWidth = parentPanel.width - (bwCells * 2);
                bHeight = parentPanel.height - (bwCells * 2);
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





