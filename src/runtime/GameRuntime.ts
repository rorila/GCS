import { ReactiveRuntime } from './ReactiveRuntime';
import { ActionExecutor } from './ActionExecutor';
import { TaskExecutor } from './TaskExecutor';
import { AnimationManager } from './AnimationManager';
import { GameLoopManager } from './GameLoopManager';
import { RuntimeVariableManager, IVariableHost } from './RuntimeVariableManager';
import { RuntimeStageManager } from './RuntimeStageManager';
import { DebugLogService } from '../services/DebugLogService';
import { hydrateObjects } from '../utils/Serialization';
import { TStageController } from '../components/TStageController';
import { TSpriteTemplate } from '../components/TSpriteTemplate';
import { SpritePool } from './SpritePool';
import { AudioManager } from './AudioManager';
import { Logger } from '../utils/Logger';

const logger = Logger.get('GameRuntime', 'Runtime_Execution');
export interface RuntimeOptions {
    multiplayerManager?: any;
    onNavigate?: (target: string, params?: any) => void;
    initialGlobalVars?: Record<string, any>;
    makeReactive?: boolean;
    onRender?: () => void;
    onSpriteRender?: (sprites: any[]) => void;
    startStageId?: string;
    onStageSwitch?: (stageId: string) => void;
}

export class GameRuntime implements IVariableHost {
    public reactiveRuntime: ReactiveRuntime;
    private actionExecutor: ActionExecutor;
    public taskExecutor: TaskExecutor | null = null;

    private variableManager: RuntimeVariableManager;
    private stageManager: RuntimeStageManager;

    private objects: any[] = [];
    public spritePool: SpritePool = new SpritePool();
    private isSplashActive: boolean = false;
    private splashTimerId: any = null;
    public stage: any = null;
    private stageController: TStageController | null = null;
    private varTimers: Map<string, any> = new Map();
    private _globalKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
    private _globalKeyupHandler: ((e: KeyboardEvent) => void) | null = null;

    public get contextVars() { return this.variableManager.contextVars; }
    public get projectVariables() { return this.variableManager.projectVariables; }
    public get stageVariables() { return this.variableManager.stageVariables; }

    constructor(
        public project: any,
        objects?: any[],
        private options: RuntimeOptions = {}
    ) {
        this.reactiveRuntime = new ReactiveRuntime();
        this.variableManager = new RuntimeVariableManager(this, options.initialGlobalVars);
        this.variableManager.initializeVariables(project);
        this.stageManager = new RuntimeStageManager(project);

        const hasStages = project.stages && project.stages.length > 0;
        let activeStage = null;

        if (options.startStageId && hasStages) {
            activeStage = project.stages.find((s: any) => s.id === options.startStageId);
        } else if (hasStages) {
            activeStage = project.stages.find((s: any) => s.type === 'splash') ||
                project.stages.find((s: any) => s.id === project.activeStageId) ||
                project.stages[0];
        }

        if (objects) {
            this.objects = objects;
            this.actionExecutor = new ActionExecutor(this.objects, options.multiplayerManager, options.onNavigate);
            this.taskExecutor = new TaskExecutor(project, project.actions || [], this.actionExecutor, project.flowCharts, options.multiplayerManager, project.tasks);
        } else if (activeStage) {
            this.stage = activeStage;
            this.isSplashActive = activeStage.type === 'splash';

            const merged = this.stageManager.getMergedStageData(activeStage.id);
            this.objects = merged.objects;

            // Apply merged stage properties (grid, background)
            if (merged.grid) activeStage.grid = { ...activeStage.grid, ...merged.grid };
            if (merged.backgroundColor) {
                if (!activeStage.grid) activeStage.grid = {};
                activeStage.grid.backgroundColor = merged.backgroundColor;
            }
            if (merged.backgroundImage) activeStage.backgroundImage = merged.backgroundImage;

            // NEW: Initialize stage variables for the first stage correctly!
            this.variableManager.initializeStageVariables(activeStage);
            this.syncVariableComponents();

            // ─── OBJECT POOL: TSpriteTemplate → Pool-Instanzen erzeugen ───
            // Pool-Instanzen werden VOR dem Proxy-Wrapping in this.objects eingefügt,
            // damit sie beim nächsten renderObjects() echte DOM-Elemente bekommen.
            const templates = this.objects.filter(obj =>
                obj.className === 'TSpriteTemplate' || obj.constructor?.name === 'TSpriteTemplate'
            ) as TSpriteTemplate[];

            templates.forEach(template => {
                this.spritePool.init(template, this.objects);
            });
            // ─── ENDE OBJECT POOL ───────────────────────────────────────────

            if (options.makeReactive) {
                this.objects.forEach(obj => this.reactiveRuntime.registerObject(obj.name, obj, true));
                this.reactiveRuntime.setVariable('isSplashActive', this.isSplashActive);
                const mp = options.multiplayerManager || (window as any).multiplayerManager;
                this.reactiveRuntime.setVariable('isMultiplayer', !!mp);
                if (mp) {
                    this.reactiveRuntime.setVariable('playerNumber', mp.playerNumber || 1);
                    this.reactiveRuntime.setVariable('isHost', mp.isHost !== undefined ? mp.isHost : (mp.playerNumber === 1));
                } else {
                    this.reactiveRuntime.setVariable('playerNumber', 1);
                    this.reactiveRuntime.setVariable('isHost', true);
                }

                // Register global render listener — FILTERED!
                // Sprite position properties (x, y, velocityX, velocityY, errorX, errorY)
                // are updated 60x/sec by the GameLoopManager which already calls renderCallback.
                // Without this filter, EACH sprite.x and sprite.y change triggers an ADDITIONAL
                // full StageRenderer.renderObjects() = 3+ full renders per frame instead of 1.
                if (options.onRender) {
                    // ── PERFORMANCE-KRITISCH: Diese TSprite-Properties werden vom
                    // 60Hz Fast-Path (updateSpritePositions) gehandhabt und dürfen
                    // KEINEN vollen renderObjects() triggern. Ohne 'visible' im Filter
                    // verursacht jeder SpritePool.acquire() einen Komplett-Re-Render
                    // aller Objekte → Bildschirm-Blink mit Ghost-Images bei (0,0).
                    const SPRITE_PROPS = new Set([
                        'x', 'y', 'velocityX', 'velocityY', 'errorX', 'errorY', 'visible',
                        '_prevVelocityX', '_prevVelocityY', '_prevX', '_prevY'
                    ]);
                    let renderScheduled = false;
                    this.reactiveRuntime.getWatcher().addGlobalListener(
                        (obj: any, prop: string) => {
                            if (SPRITE_PROPS.has(prop) && obj?.className === 'TSprite') return;
                            // RAF-Debounce: Egal wie viele Properties sich ändern,
                            // nur EIN render() pro Animation-Frame.
                            if (!renderScheduled) {
                                renderScheduled = true;
                                requestAnimationFrame(() => {
                                    renderScheduled = false;
                                    options.onRender!();
                                });
                            }
                        }
                    );
                }

                this.objects = this.reactiveRuntime.getObjects();
                this.initializeReactiveBindings();
            }

            this.actionExecutor = new ActionExecutor(this.objects, options.multiplayerManager, options.onNavigate, this.spawnObject.bind(this), this.destroyObject.bind(this));
            this.taskExecutor = new TaskExecutor(project, merged.actions, this.actionExecutor, merged.flowCharts, options.multiplayerManager, merged.tasks);
        } else {
            this.objects = [];
            this.actionExecutor = new ActionExecutor(this.objects, options.multiplayerManager, options.onNavigate);
            this.taskExecutor = new TaskExecutor(project, project.actions || [], this.actionExecutor, project.flowCharts, options.multiplayerManager, project.tasks);
        }

        if (options.multiplayerManager) {
            options.multiplayerManager.onRemoteTask = (msg: any) => this.executeRemoteTask(msg.taskName, msg.params);
        }

        this.init();
        this.initStageController();
        if (activeStage && options.onStageSwitch) options.onStageSwitch(activeStage.id);
    }

    /**
     * Aktualisiert die Projektdaten zur Laufzeit (Live Sync)
     */
    public updateRuntimeData(project: any) {
        this.project = project;

        // 1. Sync TaskExecutor (Flows, Actions, Tasks)
        if (this.taskExecutor) {
            logger.info('Updating runtime data (FlowCharts, Actions, Tasks)');
            const stageId = this.stage?.id || this.project.activeStageId;
            const merged = this.stageManager.getMergedStageData(stageId);

            this.taskExecutor.setFlowCharts(merged.flowCharts);
            this.taskExecutor.setActions(merged.actions);
            this.taskExecutor.setTasks(merged.tasks || []);

            // 2. LIVE SYNC: Update Object Styles & Design Properties
            // We iterate over the current runtime objects and find their counterparts in the new project data.
            // This allows changing color/size/position in the Inspector while the game is running.
            this.objects.forEach(obj => {
                const projectObj = merged.objects.find(po => po.id === obj.id);
                if (projectObj) {
                    // Sync common style properties
                    if (projectObj.style) {
                        obj.style = { ...(obj.style || {}), ...projectObj.style };
                    }

                    // Sync caption/text if not dynamically changed by game logic
                    if (projectObj.caption !== undefined) obj.caption = projectObj.caption;
                    if (projectObj.text !== undefined && !obj.isVariable) obj.text = projectObj.text;

                    // Sync geometry
                    if (projectObj.x !== undefined) obj.x = projectObj.x;
                    if (projectObj.y !== undefined) obj.y = projectObj.y;
                    if (projectObj.width !== undefined) obj.width = projectObj.width;
                    if (projectObj.height !== undefined) obj.height = projectObj.height;
                    if (projectObj.visible !== undefined) obj.visible = projectObj.visible;
                    if (projectObj.opacity !== undefined) obj.opacity = projectObj.opacity;
                }
            });

            // Trigger a re-render to make changes visible
            if (this.options.onRender) this.options.onRender();
        }
    }

    public stop() {
        logger.info(`[GameRuntime] STOP() called, objectCount=${this.objects.length}`);
        if (this.splashTimerId) { clearTimeout(this.splashTimerId); this.splashTimerId = null; }

        // 0. Globale Keyboard-Listener SOFORT entfernen (Single-Global-Handler Pattern)
        if (this._globalKeydownHandler) {
            window.removeEventListener('keydown', this._globalKeydownHandler);
            this._globalKeydownHandler = null;
        }
        if (this._globalKeyupHandler) {
            window.removeEventListener('keyup', this._globalKeyupHandler);
            this._globalKeyupHandler = null;
        }

        // 1. Sicheres Stoppen ALLER Komponenten
        this.objects.forEach(obj => {
            try {
                if (typeof obj.onRuntimeStop === 'function') obj.onRuntimeStop();
                if (typeof (obj as any).stop === 'function') (obj as any).stop();
            } catch (e) {
                logger.error(`Error stopping object ${obj.id}:`, e);
            }
        });

        GameLoopManager.getInstance().stop();
        AnimationManager.getInstance().clear();
        AudioManager.getInstance().stopAll();

        // 2. Objekt-Pools leeren
        if (this.spritePool) {
            this.spritePool.destroy();
        }

        // 3. Komplettes Wipe-Out der Proxies und Context-Referenzen
        if (this.reactiveRuntime) {
            this.reactiveRuntime.clear(true);
        }

        this.objects = [];
        logger.info(`[GameRuntime] STOP() done`);
    }

    public start() {
        logger.info(`[GameRuntime] START() called, objectCount=${this.objects.length}, splash=${this.isSplashActive}, stage=${this.stage?.id}`);
        if (this.options.onRender) this.options.onRender();
        this.objects.forEach(obj => this.handleEvent(obj.id, 'onStart'));

        // InputController MUSS vor dem Splash-Check initialisiert werden,
        // damit Keyboard-Events bereits während/nach dem Splash funktionieren.
        this.initInputControllers();

        if (this.isSplashActive) {
            if (this.project.splashAutoHide) {
                const duration = (this.stage as any)?.duration || this.project.splashDuration || 3000;
                this.splashTimerId = setTimeout(() => this.finishSplash(), duration);
            }
            return;
        }
        this.initMainGame();
    }

    /**
     * Initialisiert alle InputController mit handleEvent-Callback und startet sie.
     * Wird VOR dem Splash-Check aufgerufen, damit Keyboard-Input sofort funktioniert.
     */
    /**
     * Single-Global-Handler Pattern für InputController.
     * 
     * Problem: hydrateObjects() gibt TWindow-Instanzen unverändert zurück.
     * Dadurch können stale `window.addEventListener` Handler aus früheren Runs
     * überleben, die nicht via removeEventListener entfernbar sind (andere 
     * Funktionsreferenz). 
     * 
     * Lösung: GameRuntime verwaltet EIN Listener-Paar auf window und delegiert
     * an alle aktiven TInputController. Keine Komponente hängt eigene Listener.
     */
    private initInputControllers(): void {
        // 1. Alte globale Handler entfernen (falls vorhanden, z.B. bei Stage-Change)
        if (this._globalKeydownHandler) {
            window.removeEventListener('keydown', this._globalKeydownHandler);
            this._globalKeydownHandler = null;
        }
        if (this._globalKeyupHandler) {
            window.removeEventListener('keyup', this._globalKeyupHandler);
            this._globalKeyupHandler = null;
        }

        // 2. InputController finden, Force-Reset, init und aktivieren
        const handleEventCb = (id: string, ev: string, data?: any) => this.handleEvent(id, ev, data);
        const activeICs: any[] = [];

        this.objects.forEach(obj => {
            if ((obj as any).className === 'TInputController' || obj.constructor?.name === 'TInputController') {
                const rawObj = (obj as any).__raw__ || (obj as any).__v_raw || obj;

                // Force-Reset: Zustand aus vorheigen Runs bereinigen
                rawObj.isActive = false;
                rawObj.eventCallback = null;
                if (rawObj.keysPressed) rawObj.keysPressed.clear();

                // Init: Callback setzen
                if (typeof rawObj.init === 'function') {
                    rawObj.init(this.objects, handleEventCb);
                }

                // Aktivieren (setzt nur isActive=true, KEINE window.addEventListener!)
                rawObj.isActive = true;
                activeICs.push(rawObj);

                logger.info(`[GameRuntime] InputController "${rawObj.name}" initialized (id=${rawObj._instanceId})`);
            }
        });

        // 3. EIN globales Listener-Paar installieren, das an alle aktiven ICs delegiert
        if (activeICs.length > 0) {
            this._globalKeydownHandler = (e: KeyboardEvent) => {
                activeICs.forEach(ic => ic.handleKeyDownEvent?.(e));
            };
            this._globalKeyupHandler = (e: KeyboardEvent) => {
                activeICs.forEach(ic => ic.handleKeyUpEvent?.(e));
            };
            window.addEventListener('keydown', this._globalKeydownHandler);
            window.addEventListener('keyup', this._globalKeyupHandler);
            logger.info(`[GameRuntime] Global keyboard handler installed for ${activeICs.length} InputController(s)`);
        }

        // 4. Callback auch global speichern (für initRuntime/Multiplayer-Kompatibilität)
        (window as any).__inputControllerCallback = handleEventCb;
    }

    private initMainGame() {
        let stageConfig = this.stage || this.project.stage || this.project.grid;

        const gridConfig = (this.stage && this.stage.grid) || this.project.stage?.grid || this.project.grid;
        const runtimeCallbacks = {
            handleEvent: (id: string, ev: string, data?: any) => this.handleEvent(id, ev, data),
            render: this.options.onRender || (() => { }),
            gridConfig,
            objects: this.objects
        };

        this.objects.forEach(obj => {
            obj.initRuntime?.(runtimeCallbacks);
            obj.onRuntimeStart?.();
        });

        // START GAME LOOP via GameLoopManager Singleton
        // The GameLoopManager is NOT a stage object and NOT proxied by ReactiveRuntime.
        // This completely bypasses all Proxy issues that prevent TGameLoop from working.
        // The GameLoopManager reads TGameLoop config (boundsOffset etc.) from the objects.
        const glm = GameLoopManager.getInstance();
        glm.init(
            this.objects,
            gridConfig,
            this.options.onRender || (() => { }),
            (id: string, ev: string, data?: any) => this.handleEvent(id, ev, data),
            this.options.onSpriteRender
        );
        glm.start();

        this.initMultiplayer();

        // Start-Animation NACH glm.start(): Tweens werden erst erstellt wenn die
        // Game Loop bereits läuft und AnimationManager.update() pro Frame aufgerufen wird.
        console.log(`[GameRuntime.initMainGame] startAnimation="${stageConfig?.startAnimation}", id="${stageConfig?.id}", objects: ${this.objects.length}`);
        if (stageConfig?.startAnimation && stageConfig.startAnimation !== 'none') {
            this.triggerStartAnimation(stageConfig);
        }

        // Splash screens in main game
        this.objects.filter(o => o.className === 'TSplashScreen').forEach(splash => {
            setTimeout(() => {
                this.handleEvent(splash.id, 'onFinish');
                if (splash.autoHide) {
                    splash.visible = false;
                    this.options.onRender?.();
                }
            }, splash.duration || 3000);
        });

        this.options.onRender?.();
    }

    private finishSplash() {
        if (!this.isSplashActive) return;
        if (this.splashTimerId) { clearTimeout(this.splashTimerId); this.splashTimerId = null; }
        this.isSplashActive = false;
        if (this.stageController) this.stageController.goToMainStage();
        else this.legacyStageSwitch();
    }

    private initStageController(): void {
        this.stageController = this.objects.find(o => o.className === 'TStageController') as TStageController | null;

        if (!this.stageController) {
            logger.info('No TStageController found in project. Creating virtual controller for navigation support.');
            this.stageController = new TStageController('VirtualStageController', 0, 0);
            (this.stageController as any).isTransient = true; // Mark as non-serializable if possible
            this.objects.push(this.stageController);
        }

        if (this.stageController && this.project.stages) {
            this.stageController.setStages(this.project.stages);
            this.stageController.setOnStageChangeCallback((oldId, newId) => this.handleStageChange(oldId, newId));
        }
    }

    public switchToStage(stageId: string): void {
        const currentId = this.stage ? this.stage.id : '';
        if (currentId !== stageId) {
            this.handleStageChange(currentId, stageId);
        }
    }

    private handleStageChange(_oldStageId: string, newStageId: string): void {
        // 1. BEFORE Stage Change: Trigger onLeave on the OLD stage
        // We use the current this.stage as it still represents the old stage
        if (this.stage && this.taskExecutor) {
            const onLeaveTask = (this.stage.events || this.stage.Tasks)?.onLeave;
            if (onLeaveTask) {
                logger.info(`Triggering onLeave for stage: ${this.stage.id} (Task: ${onLeaveTask})`);
                try {
                    this.taskExecutor.execute(onLeaveTask, { sender: this.stage }, this.contextVars, this.stage);
                } catch (e) {
                    logger.error(`Error executing onLeave for stage ${this.stage.id}:`, e);
                }
            }
        }

        this.stage = this.project.stages?.find((s: any) => s.id === newStageId);
        if (!this.stage) return;

        const merged = this.stageManager.getMergedStageData(newStageId);
        this.objects = merged.objects;

        if (this.taskExecutor) {
            this.taskExecutor.setFlowCharts(merged.flowCharts);
            this.taskExecutor.setTasks(merged.tasks);
            this.taskExecutor.setActions(merged.actions);
        }

        logger.info(`--- STAGE CHANGE: ${newStageId} ---`);
        logger.debug(`Global Vars BEFORE reactive clear:`, this.reactiveRuntime.getContext());

        // IMPORTANT: Update ActionExecutor with new objects!
        if (this.options.makeReactive) {
            this.reactiveRuntime.clear(false); // DO NOT CLEAR VARIABLES! Keep the data state.
            this.clearAllTimers();
            AnimationManager.getInstance().clear();

            logger.debug(`Global Vars AFTER reactive clear:`, this.reactiveRuntime.getContext());

            // Register ALL objects including global variables.
            // Global variables persist via clear(false) + cachedGlobalObjects.
            // The context resolution in ReactiveRuntime.getContext() handles
            // the priority (variable VALUE over component proxy) correctly.
            this.objects.forEach(obj => this.reactiveRuntime.registerObject(obj.name, obj, true));
            this.reactiveRuntime.setVariable('isSplashActive', false);

            // Re-register global render listener after clear — FILTERED!
            // Same filtering as in constructor to prevent redundant renders for sprite positions.
            if (this.options.onRender) {
                const SPRITE_PROPS = new Set(['x', 'y', 'velocityX', 'velocityY', 'errorX', 'errorY']);
                let renderScheduled = false;
                this.reactiveRuntime.getWatcher().addGlobalListener(
                    (obj: any, prop: string) => {
                        if (SPRITE_PROPS.has(prop) && obj?.className === 'TSprite') return;
                        // RAF-Debounce: Egal wie viele Properties sich ändern,
                        // nur EIN render() pro Animation-Frame.
                        if (!renderScheduled) {
                            renderScheduled = true;
                            requestAnimationFrame(() => {
                                renderScheduled = false;
                                this.options.onRender!();
                            });
                        }
                    }
                );
            }

            this.objects = this.reactiveRuntime.getObjects();
            this.initializeReactiveBindings();

            logger.debug(`Global Vars AFTER initializeReactiveBindings:`, this.reactiveRuntime.getContext());
        }

        // IMPORTANT: Update ActionExecutor with new objects (Proxies if reactive)
        if (this.actionExecutor) {
            this.actionExecutor.setObjects(this.objects);
        }

        this.variableManager.stageVariables = {};
        this.variableManager.initializeStageVariables(this.stage);
        this.syncVariableComponents();

        this.actionExecutor.setObjects(this.objects);
        this.initStageController();
        
        // WICHTIG: TStageController mitteilen, auf welcher Stage wir WIRKLICH sind! 
        // (Für den Fall dass der Wechsel nicht durch ihn selbst, sondern durch eine navigate_stage Action passierte)
        if (this.stageController && this.stage) {
            this.stageController.setCurrentStageId(this.stage.id);
        }

        this.start();

        // 2. AFTER Stage Change: Trigger onEnter and onRuntimeStart on the NEW stage
        if (this.stage && this.taskExecutor) {
            const onEnterTask = (this.stage.events || this.stage.Tasks)?.onEnter;
            if (onEnterTask) {
                logger.debug(`Triggering onEnter for stage: ${this.stage.id} (Task: ${onEnterTask})`);
                const enterLogId = DebugLogService.getInstance().log('Event', `Triggered: ${this.stage.name || this.stage.id}.onEnter`, {
                    objectName: this.stage.name || this.stage.id,
                    eventName: 'onEnter'
                });
                try {
                    this.taskExecutor.execute(onEnterTask, { sender: this.stage }, this.contextVars, this.stage, 0, enterLogId);
                } catch (e) {
                    logger.error(`Error executing onEnter for stage ${this.stage.id}:`, e);
                }
            }

            const onRuntimeStartTask = (this.stage.events || this.stage.Tasks)?.onRuntimeStart;
            if (onRuntimeStartTask) {
                logger.debug(`Triggering onRuntimeStart for stage: ${this.stage.id} (Task: ${onRuntimeStartTask})`);
                const startLogId = DebugLogService.getInstance().log('Event', `Triggered: ${this.stage.name || this.stage.id}.onRuntimeStart`, {
                    objectName: this.stage.name || this.stage.id,
                    eventName: 'onRuntimeStart'
                });
                try {
                    this.taskExecutor.execute(onRuntimeStartTask, { sender: this.stage }, this.contextVars, this.stage, 0, startLogId);
                } catch (e) {
                    logger.error(`Error executing onRuntimeStart for stage ${this.stage.id}:`, e);
                }
            }
        }

        if (this.options.onStageSwitch) this.options.onStageSwitch(newStageId);
    }

    private legacyStageSwitch(): void {
        const mainStage = this.project.stages?.find((s: any) => s.type === 'main');
        if (mainStage) this.handleStageChange('splash', mainStage.id);
        else {
            this.objects = hydrateObjects(this.project.objects || []);
            this.start();
        }
    }

    private initMultiplayer() {
        const mp = this.options.multiplayerManager || (window as any).multiplayerManager;
        if (!mp?.on) return;

        mp.on((msg: any) => {
            this.objects.filter(o => o.className === 'THandshake').forEach(hs => {
                if (msg.type === 'room_joined') {
                    hs._setRoomInfo(msg.roomCode, msg.playerNumber, msg.playerNumber === 1);
                    hs._setStatus('waiting');
                    hs._fireEvent('onRoomJoined', msg);
                } else if (msg.type === 'game_start') {
                    hs._setStatus('playing');
                    hs._fireEvent('onGameStart', msg);
                } else if (msg.type === 'room_created') {
                    hs._setRoomInfo(msg.roomCode, 1, true);
                    hs._setStatus('waiting');
                    hs._fireEvent('onRoomCreated', msg);
                }
            });

            this.objects.filter(o => o.className === 'THeartbeat').forEach(hb => {
                if (msg.type === 'pong') hb._handlePong(msg.serverTime);
                else if (msg.type === 'player_timeout') hb._setConnectionLost();
            });
        });
    }

    private triggerStartAnimation(stageConfig: any) {
        const animationType = stageConfig.startAnimation || 'fade-in';
        const duration = stageConfig.startAnimationDuration || 1000;
        const easing = stageConfig.startAnimationEasing || 'easeOut';
        const am = AnimationManager.getInstance();

        // Bühnen-Dimensionen aus Grid ermitteln
        const grid = stageConfig.grid || stageConfig;
        // Objekt-Positionen sind in Grid-Zellen (nicht Pixeln!) → Bühnenmaße auch in Grid-Zellen
        const stageWidth = grid.cols || 64;
        const stageHeight = grid.rows || 40;
        const outsideMargin = 10; // Grid-Zellen knapp außerhalb der Bühne

        // Legacy-Animationen (fade-in, slide-up)
        if (animationType === 'fade-in') {
            this.objects.forEach(obj => {
                if (obj.visible !== false) {
                    const originalOpacity = obj.opacity !== undefined ? obj.opacity : 1;
                    obj.opacity = 0;
                    am.animate(obj, { opacity: originalOpacity }, duration, easing);
                }
            });
            return;
        }

        if (animationType === 'slide-up') {
            this.objects.forEach(obj => {
                if (obj.visible !== false) {
                    const originalY = obj.y;
                    obj.y += 100;
                    am.addTween(obj, 'y', originalY, duration, easing);
                }
            });
            return;
        }

        // TStage Fly-Patterns: Objekte von Startposition zu Zielposition animieren
        const simplePatterns = ['UpLeft', 'UpMiddle', 'UpRight', 'Left', 'Right', 'BottomLeft', 'BottomMiddle', 'BottomRight'];

        this.objects.forEach((obj, index) => {
            if (obj.visible === false) return;

            const targetX = obj.x;
            const targetY = obj.y;
            const start = this.getPatternStartPosition(animationType, targetX, targetY, index, stageWidth, stageHeight, outsideMargin, simplePatterns);

            if (!start) return; // Unbekanntes Pattern → keine Animation

            // Objekt zur Startposition setzen
            obj.x = start.x;
            obj.y = start.y;

            // Zum Ziel animieren
            am.addTween(obj, 'x', targetX, duration, easing);
            am.addTween(obj, 'y', targetY, duration, easing);
        });
    }

    /**
     * Berechnet die Startposition eines Objekts basierend auf dem Fly-In-Pattern.
     * Spiegelt die Logik aus TStage.getPatternStartPosition().
     */
    private getPatternStartPosition(
        pattern: string, targetX: number, targetY: number, index: number,
        stageWidth: number, stageHeight: number, outsideMargin: number,
        simplePatterns: string[]
    ): { x: number; y: number } | null {
        switch (pattern) {
            case 'UpLeft':
                return { x: -outsideMargin, y: -outsideMargin };
            case 'UpMiddle':
                return { x: stageWidth / 2, y: -outsideMargin };
            case 'UpRight':
                return { x: stageWidth + outsideMargin, y: -outsideMargin };
            case 'Left':
                return { x: -outsideMargin, y: targetY };
            case 'Right':
                return { x: stageWidth + outsideMargin, y: targetY };
            case 'BottomLeft':
                return { x: -outsideMargin, y: stageHeight + outsideMargin };
            case 'BottomMiddle':
                return { x: stageWidth / 2, y: stageHeight + outsideMargin };
            case 'BottomRight':
                return { x: stageWidth + outsideMargin, y: stageHeight + outsideMargin };
            case 'ChaosIn': {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.max(stageWidth, stageHeight) + outsideMargin;
                return {
                    x: stageWidth / 2 + Math.cos(angle) * distance,
                    y: stageHeight / 2 + Math.sin(angle) * distance
                };
            }
            case 'ChaosOut':
                return { x: stageWidth / 2, y: stageHeight / 2 };
            case 'Matrix':
                return { x: targetX, y: -outsideMargin - (index * 20) };
            case 'Random': {
                const randomPattern = simplePatterns[Math.floor(Math.random() * simplePatterns.length)];
                return this.getPatternStartPosition(randomPattern, targetX, targetY, index, stageWidth, stageHeight, outsideMargin, simplePatterns);
            }
            default:
                return null;
        }
    }

    public handleEvent(objectId: string, eventName: string, data: any = {}) {
        // console.info(`[DIAGNOSTIC] handleEvent entry: objId=${objectId}, event=${eventName}`);
        const obj = this.objects.find(o => o.id === objectId);
        if (!obj) {
            // console.warn(`[DIAGNOSTIC] Object not found: ${objectId}`);
            return;
        }

        const hasOnEventMap = obj.onEvent && obj.onEvent[eventName];
        const hasTaskMap = (obj.events && obj.events[eventName]) || ((obj as any).Tasks && (obj as any).Tasks[eventName]);

        // console.info(`[DIAGNOSTIC] Object found: ${obj.name}. hasOnEventMap=${!!hasOnEventMap}, hasTaskMap=${!!hasTaskMap}`);

        let eventLogId: string | undefined = undefined;

        if (hasOnEventMap || hasTaskMap) {
            // Log to DebugLogService only if there's an actual mapping 
            eventLogId = DebugLogService.getInstance().log('Event', `Triggered: ${obj.name}.${eventName}`, {
                objectName: obj.name,
                eventName: eventName,
                data: data
            });
            DebugLogService.getInstance().pushContext(eventLogId);
        }

        try {
            // SPECIAL HANDLING: TEmojiPicker state sync (Global & Local)
            // The view (Stage) triggers onSelect with the emoji as data.
            // We must update the runtime object's state BEFORE executing ANY actions or tasks.
            if (obj.className === 'TEmojiPicker' && eventName === 'onSelect' && typeof data === 'string') {
                logger.debug(`Syncing selectedEmoji for ${obj.name}: ${data}`);
                obj.selectedEmoji = data;
            }

            if (obj.onEvent) {
                const actions = obj.onEvent[eventName];
                if (actions) {
                    // Actions can be a single object or an array
                    const actionList = Array.isArray(actions) ? actions : [actions];
                    for (const action of actionList) {
                        this.actionExecutor.execute(action, {}, this.contextVars, data, eventLogId);
                    }
                }
            }

            if (this.taskExecutor && hasTaskMap) {
                // Priority 1: Explicit mapping (string), Priority 2: Convention (ObjectName.EventName)
                const taskName = (typeof hasTaskMap === 'string') ? hasTaskMap : `${obj.name}.${eventName}`;
                // Ensure eventData is available in vars even when 'data' is not an object (e.g., a string like an emoji)
                const eventVars = typeof data === 'object' && data !== null
                    ? { ...data, eventData: data, sender: obj }
                    : { eventData: data, sender: obj };
                this.taskExecutor.execute(taskName, eventVars, this.contextVars, obj, 0, eventLogId);
            }
        } finally {
            // Auto-Sleep: GameLoop aufwecken, falls Event zu Aktivität geführt hat
            // (z.B. PhysikAktivieren setzt spritesMoving=true, Countdown startet Animationen)
            GameLoopManager.getInstance().wakeUp();

            if (eventLogId) {
                DebugLogService.getInstance().popContext();
            }
        }
    }

    public updateRemoteState(objectIdOrName: string, state: any) {
        const obj = this.objects.find(o => o.id === objectIdOrName || o.name === objectIdOrName);
        if (obj) {
            Object.assign(obj, state);
            if (this.options.onRender) this.options.onRender();
        }
    }

    public triggerRemoteEvent(objectId: string, eventName: string, params: any) {
        const obj = this.objects.find(o => o.id === objectId);
        if (obj) this.handleEvent(objectId, eventName, params);
    }

    public executeRemoteAction(action: any) {
        this.actionExecutor.execute(action, {
            vars: this.contextVars,
            contextVars: this.contextVars
        });
    }

    public executeRemoteTask(taskName: string, params: any = {}, mode?: string) {
        if (!this.taskExecutor) return;
        this.taskExecutor.execute(taskName, params, this.contextVars, mode === 'sequential');
    }

    public getContext(): Record<string, any> {
        const context: Record<string, any> = {
            project: this.project
        };

        // 1. Add variables (Data) first as baseline
        Object.assign(context, this.contextVars);

        // 2. Add all objects (Proxies/Components) - they overwrite variables with same name
        // This is crucial because TVariable components carry the "real" UI value.
        this.objects.forEach(obj => {
            if (obj.name) {
                context[obj.name] = obj;
            }
            if (obj.id) {
                context[obj.id] = obj;
            }
        });

        return context;
    }

    public getObjects(): any[] {
        const results: any[] = [];
        const process = (objs: any[], parentX = 0, parentY = 0, parentZ = 0) => {
            objs.forEach(obj => {
                const resolveCoord = (val: any) => {
                    if (val === undefined || val === null) return val;
                    if (typeof val === 'string' && val.includes('${')) {
                        try {
                            const evaluated = this.reactiveRuntime.evaluate(val);
                            const n = Number(evaluated);
                            return isNaN(n) ? evaluated : n;
                        } catch (e) {
                            return val;
                        }
                    }
                    if (typeof val === 'string') {
                        const n = Number(val);
                        return isNaN(n) ? val : n;
                    }
                    return typeof val === 'number' ? val : 0;
                };

                const rx = resolveCoord(obj.x);
                const ry = resolveCoord(obj.y);
                const absoluteX = parentX + rx;
                const absoluteY = parentY + ry;

                if (obj.name?.includes('Button') || (obj.name && obj.name.includes('Emoji'))) {
                    console.log(`[GameRuntime:Layout] ${obj.name}: x=${obj.x} (resolved=${rx}), parentX=${parentX} -> absoluteX=${absoluteX}`);
                }
                const absoluteZ = parentZ + resolveCoord(obj.zIndex);

                // 1. Basis-Kopie der eigenen Properties
                const copy: any = { ...obj };

                // 2. Erfassen aller Eigenschaften aus der Prototyp-Kette (Getter)
                // Dies ist notwendig, da der Spread-Operator Getter ignoriert.
                let proto = Object.getPrototypeOf(obj);
                while (proto && proto !== Object.prototype) {
                    const descriptors = Object.getOwnPropertyDescriptors(proto);
                    for (const key in descriptors) {
                        const descriptor = descriptors[key];
                        // Wenn es ein Getter ist und noch nicht in der Kopie (Override-Schutz)
                        if (descriptor.get && !(key in copy)) {
                            try {
                                copy[key] = obj[key];
                            } catch (e) {
                                // Ignoriere Fehler bei Gettern, die Kontext benötigen
                            }
                        }
                    }
                    proto = Object.getPrototypeOf(proto);
                }

                // 3. Absolute Koordinaten setzen
                copy.x = absoluteX;
                copy.y = absoluteY;
                copy.width = resolveCoord(obj.width);
                copy.height = resolveCoord(obj.height);
                copy.zIndex = absoluteZ;

                results.push(copy);

                // GHOST FIX: Don't recurse into children for components that manage their own internal rendering
                const shouldRecurse = !obj.isInternalContainer;

                if (shouldRecurse && obj.children && obj.children.length > 0) {
                    const gridConfig = (this as any).stage?.grid || this.project.stage?.grid || { cellSize: 20 };
                    const cellSize = gridConfig.cellSize || 20;
                    const isDialog = obj.className === 'TDialogRoot' || obj.className === 'TDialog';
                    const childOffsetY = isDialog ? (30 / cellSize) : 0;
                    process(obj.children, absoluteX, absoluteY + childOffsetY, absoluteZ + 1);
                }
            });
        };
        process(this.objects);
        return results;
    }

    public createPhantom(original: any): any {
        return {
            ...original,
            id: 'phantom_' + Math.random().toString(36).substr(2, 9),
            isPhantom: true,
            opacity: (original.opacity || 1) * 0.5
        };
    }

    public removeObject(id: string): void {
        this.objects = this.objects.filter(o => o.id !== id);
        if (this.options.onRender) this.options.onRender();
    }

    private init() {
        if (this.options.makeReactive) {
            this.objects.forEach(obj => {
                const mp = this.options.multiplayerManager || (window as any).multiplayerManager;
                if (obj.className === 'THandshake' && mp) {
                    obj._setRoomInfo(mp.roomCode, mp.playerNumber, mp.isHost);
                    obj._setStatus(mp.roomCode ? 'playing' : 'idle');
                }
            });
        }
    }

    public startTimer(prop: string, varDef: any, duration: number) {
        if (this.varTimers.has(prop)) clearInterval(this.varTimers.get(prop));

        let timeLeft = duration;
        const interval = setInterval(() => {
            timeLeft--;
            this.contextVars[prop] = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(interval);
                this.varTimers.delete(prop);
                if (this.taskExecutor && varDef.onTimerEnd) {
                    const eventLogId = DebugLogService.getInstance().log('Event', `Triggered: ${prop}.onTimerEnd`, {
                        objectName: prop,
                        eventName: 'onTimerEnd'
                    });
                    this.taskExecutor.execute(varDef.onTimerEnd, {}, this.contextVars, undefined, 0, eventLogId);
                }
            }
        }, 1000);
        this.varTimers.set(prop, interval);
    }

    public clearAllTimers() {
        this.varTimers.forEach(t => clearInterval(t));
        this.varTimers.clear();
    }

    public handleVariableAction(name: string, action: string, ...params: any[]) {
        const varDef = this.getVarDef(name);
        if (!varDef) return;

        switch (action) {
            case 'set': this.contextVars[name] = params[0]; break;
            case 'reset': this.contextVars[name] = varDef.defaultValue; break;
            case 'start': if (varDef.type === 'timer') this.startTimer(name, varDef, params[0] || varDef.duration || 10); break;
            case 'stop': if (varDef.type === 'timer' && this.varTimers.has(name)) { clearInterval(this.varTimers.get(name)); this.varTimers.delete(name); } break;
            case 'add': if (varDef.type === 'list' || varDef.type === 'object_list') { const list = Array.isArray(this.contextVars[name]) ? [...this.contextVars[name]] : []; list.push(params[0]); this.contextVars[name] = list; } break;
            case 'remove': if (varDef.type === 'list' || varDef.type === 'object_list') { const list = Array.isArray(this.contextVars[name]) ? [...this.contextVars[name]] : []; const idx = list.indexOf(params[0]); if (idx > -1) { list.splice(idx, 1); this.contextVars[name] = list; } } break;
            case 'clear': if (varDef.type === 'list' || varDef.type === 'object_list') this.contextVars[name] = []; break;
            case 'roll': if (varDef.type === 'random' || varDef.isRandom) { const min = Number(varDef.min) || 0; const max = Number(varDef.max) || 100; this.contextVars[name] = min + Math.random() * (max - min); } break;
        }
    }

    private getVarDef(name: string): any {
        let varDef = this.stage?.variables?.find((v: any) => v.name === name);
        if (!varDef && this.project.variables) {
            varDef = this.project.variables.find((v: any) => v.name === name);
        }
        return varDef;
    }

    /**
     * Traverses all objects and registers reactive bindings for properties containing ${...}
     */
    private initializeReactiveBindings(): void {
        const process = (objs: any[]) => {
            objs.forEach(obj => {
                this.bindObjectProperties(obj);
                if (obj.children && obj.children.length > 0) {
                    process(obj.children);
                }
            });
        };

        process(this.objects);

        // BRIDGE: If a component is a variable, its property changes (value, items)
        // must be directed to the VariableManager to fire events (onTriggerEnter, etc.)
        // because actions often target the component directly (TestVar.value = ...)
        // bypassing the contextVars proxy.
        const variableComponents = this.objects.filter(obj => obj.isVariable || obj.className?.includes('Variable'));

        variableComponents.forEach(obj => {
            // Watch 'value'
            this.reactiveRuntime.getWatcher().watch(obj, 'value', (newValue, oldValue) => {
                const varDef = this.getVarDef(obj.name);
                if (varDef) {
                    this.variableManager.processVariableEvents(obj.name, newValue, oldValue, varDef);
                }
            });

            // Watch 'items' for TListVariable
            this.reactiveRuntime.getWatcher().watch(obj, 'items', (newValue, oldValue) => {
                const varDef = this.getVarDef(obj.name);
                if (varDef) {
                    this.variableManager.processVariableEvents(obj.name, newValue, oldValue, varDef);
                }
            });

            // INITIAL SYNC: Map initial component values back to VariableManager
            // This ensures contextVars correctly reflect stage-specific variable values from the start.
            // FIX: DO NOT overwrite global variables that have been preserved across stages!
            const isGlobalVar = obj.name && (obj.name in this.variableManager.projectVariables);

            if (!isGlobalVar) {
                if (obj.value !== undefined) {
                    this.contextVars[obj.name] = obj.value;
                } else if (Array.isArray((obj as any).items)) {
                    this.contextVars[obj.name] = (obj as any).items;
                }
            }
        });
    }

    private bindObjectProperties(obj: any): void {
        const skipProps = ['id', 'name', 'className', 'parentId', 'constructor', 'Tasks'];

        const bindProps = (target: any, pathPrefix: string = '') => {
            if (!target || typeof target !== 'object') return;

            Object.keys(target).forEach(key => {
                if (skipProps.includes(key)) return;

                const val = target[key];
                const propPath = pathPrefix ? `${pathPrefix}.${key}` : key;

                if (typeof val === 'string' && val.includes('${')) {
                    logger.debug(`Creating reactive binding: ${obj.name}.${propPath} ← ${val}`);
                    this.reactiveRuntime.bindComponent(obj, propPath, val);
                } else if (val && typeof val === 'object' && !Array.isArray(val) && (key === 'style' || key === 'events' || key === 'Tasks')) {
                    // Recursive binding for nested objects like style or events
                    bindProps(val, propPath);
                }
            });
        };

        bindProps(obj);
    }

    private syncVariableComponents() {
        if (!this.objects) return;
        this.objects.forEach(obj => {
            if ((obj as any).isVariable && obj.name) {
                const runtimeValue = this.variableManager.contextVars[obj.name];
                if (runtimeValue !== undefined) {
                    if (obj.items !== undefined && Array.isArray(runtimeValue)) {
                        obj.items = runtimeValue;
                    } else {
                        (obj as any).value = runtimeValue;
                    }
                }
            }
        });
    }

    // ─────────────────────────────────────────────
    // Object Pool: spawn / destroy
    // ─────────────────────────────────────────────

    /**
     * Spawnt eine Pool-Instanz aus einem TSpriteTemplate.
     * Delegiert an SpritePool.acquire().
     */
    public spawnObject(templateId: string, x?: number, y?: number): any {
        // Template-Objekt finden (für Velocity-Defaults)
        const template = this.objects.find(o => o.id === templateId) as TSpriteTemplate | undefined;
        if (!template) {
            logger.warn(`spawnObject: Template "${templateId}" nicht gefunden`);
            return null;
        }

        // Pool-basiertes Spawning
        if (this.spritePool.hasPool(templateId)) {
            const spawnX = x ?? template.x;
            const spawnY = y ?? template.y;
            const instance = this.spritePool.acquire(templateId, spawnX, spawnY, template);
            return instance;
        }

        logger.warn(`spawnObject: Kein Pool für Template "${templateId}" – kein Spawning möglich`);
        return null;
    }

    /**
     * Gibt eine Pool-Instanz zurück (macht sie unsichtbar).
     * Delegiert an SpritePool.release().
     */
    public destroyObject(instanceId: string): void {
        // Versuche nach ID
        if (this.spritePool.release(instanceId)) {
            return;
        }

        // Versuche nach Name (für %Self%-Auflösung)
        if (this.spritePool.releaseByName(instanceId)) {
            return;
        }

        logger.warn(`destroyObject: Instanz "${instanceId}" nicht im Pool gefunden`);
    }
}
