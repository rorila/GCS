import { ReactiveRuntime } from './ReactiveRuntime';
import { ActionExecutor } from './ActionExecutor';
import { TaskExecutor } from './TaskExecutor';
import { AnimationManager } from './AnimationManager';
import { GameLoopManager } from './GameLoopManager';
import { RuntimeVariableManager, IVariableHost } from './RuntimeVariableManager';
import { RuntimeStageManager } from './RuntimeStageManager';
import { DebugLogService } from '../services/DebugLogService';
import { hydrateObjects } from '../utils/Serialization';
import { GameRuntimeInput } from './core/GameRuntimeInput';
import { GameRuntimeMultiplayer } from './core/GameRuntimeMultiplayer';
import { TStageController } from '../components/TStageController';
import { DESIGN_VALUES } from '../components/TComponent';
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
    onComponentUpdate?: (obj: any, prop?: string) => void;
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
    
    private inputHandler: GameRuntimeInput;
    public multiplayerHandler: GameRuntimeMultiplayer;

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

        this.inputHandler = new GameRuntimeInput(
            () => this.objects,
            (id, ev, data) => this.handleEvent(id, ev, data)
        );

        this.multiplayerHandler = new GameRuntimeMultiplayer(
            options,
            () => this.objects,
            (id, ev, data) => this.handleEvent(id, ev, data),
            () => this.actionExecutor,
            () => this.taskExecutor,
            () => this.contextVars,
            () => { if (this.options.onRender) this.options.onRender(); }
        );

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
            const templates = this.objects.filter(obj =>
                obj.className === 'TSpriteTemplate' || obj.constructor?.name === 'TSpriteTemplate'
            ) as TSpriteTemplate[];

            templates.forEach(template => {
                this.spritePool.init(template, this.objects);
            });

            if (options.makeReactive) {
                this.objects.forEach(obj => this.reactiveRuntime.registerObject(obj.name, obj, true));
                if (this.stage) {
                    this.stage = this.reactiveRuntime.registerObject(this.stage.name || 'main', this.stage, true);
                }
                
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

                if (options.onRender) {
                    const SPRITE_PROPS = new Set([
                        'x', 'y', 'velocityX', 'velocityY', 'errorX', 'errorY', 'visible',
                        '_prevVelocityX', '_prevVelocityY', '_prevX', '_prevY'
                    ]);
                    let renderScheduled = false;
                    this.reactiveRuntime.getWatcher().addGlobalListener(
                        (obj: any, prop: string) => {
                            if (SPRITE_PROPS.has(prop) && obj?.className === 'TSprite') return;

                            if (prop && prop.startsWith('_')) return;

                            // Prüfen, ob es sich um eine Variable, ein Array oder ein Objekt ohne eindeutige ID handelt
                            const isVariableLike = obj?.isVariable || obj?.className?.includes('Variable') || !obj?.id || Array.isArray(obj);

                            if (isVariableLike && options.onComponentUpdate) {
                                if (!(this as any)._softRenderScheduled) {
                                    (this as any)._softRenderScheduled = true;
                                    requestAnimationFrame(() => {
                                        (this as any)._softRenderScheduled = false;
                                        const objs = this.objects || [];
                                        for (let i = 0; i < objs.length; i++) {
                                            const o = objs[i];
                                            if (o && o.id && !o.isVariable && !o.isService) {
                                                options.onComponentUpdate!(o, prop);
                                            }
                                        }
                                    });
                                }
                                return; // Voll-Render zwingend umgehen!
                            }

                            const isDialog = obj?.className === 'TDialogRoot' || obj?.className === 'TDialog' || obj?.className === 'TSidePanel' || obj?.constructor?.name === 'TDialogRoot';

                            // Targeted Rendering: Update nur eine einzelne Objektstruktur im DOM (für echte UI-Komponenten)
                            // AUSNAHME 1: Dialoge erfordern einen Full-Render, da ihre Sichtbarkeit (Slide-In/Out)
                            // sich auf alle untergeordneten Kinder auswirkt (Layout/Translate Rekursion).
                            // AUSNAHME 2: Positions-Properties (x/y) erfordern einen Full-Render wenn das Objekt
                            // Kinder hat, da Kinder-Positionen rekursiv vom Parent abhängen.
                            // Ohne Full-Render bleiben Kinder an der initialen Off-Screen-Position
                            // der Stage-Animation stehen (updateSingleObject aktualisiert keine Positionen).
                            const needsFullRender = isDialog;

                            if (obj && obj.id && options.onComponentUpdate && !needsFullRender) {
                                options.onComponentUpdate(obj, prop);
                                return;
                            }

                            // Fallback (sollte nun bei Variablen nicht mehr greifen)
                            if (!renderScheduled) {
                                renderScheduled = true;
                                console.warn(`💥 [Voll-Render Ausgelöst durch:] Objekt: ${obj?.name || obj?.id || 'Global Var/Array'}, Klasse: ${obj?.className || '-'}, Eigenschaft: ${prop}`);
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

        this.inputHandler.dispose();

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
        this.inputHandler.init();

        if (this.isSplashActive) {
            if (this.project.splashAutoHide) {
                const duration = (this.stage as any)?.duration || this.project.splashDuration || 3000;
                this.splashTimerId = setTimeout(() => this.finishSplash(), duration);
            }
            return;
        }
        this.initMainGame();
    }

    private initMainGame() {

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

        const animType = this.stage?.startAnimation || 'fade-in';
        if (animType !== 'none') {
            this.triggerStartAnimation(this.stage);
        }

        this.multiplayerHandler.init();

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
            // First PASS: Register variables and systemic data objects FIRST
            this.objects.forEach(obj => {
                if ((obj as any).isVariable || obj.className === 'TStringMap' || obj.className?.includes('Variable') || obj.className === 'TTheme') {
                    this.reactiveRuntime.registerObject(obj.name, obj, true);
                }
            });

            // Second PASS: Register UI components now that globals are safe
            this.objects.forEach(obj => {
                const isData = (obj as any).isVariable || obj.className === 'TStringMap' || obj.className?.includes('Variable') || obj.className === 'TTheme';
                if (!isData) {
                    this.reactiveRuntime.registerObject(obj.name, obj, true);
                }
            });
            if (this.stage) {
                this.stage = this.reactiveRuntime.registerObject(this.stage.name || 'main', this.stage, true);
            }
            this.reactiveRuntime.setVariable('isSplashActive', false);

            // Keine zusätzlichen redundanten GlobalListeners einhängen.
            // Der existierende Listener (aus dem Konstruktor) wird dank clear(false) 
            // fortgesetzt und nutzt die intelligente Fast-Path / isDialog Weiche.

            this.objects = this.reactiveRuntime.getObjects();

            // FIXED ORDER: Initialize stage variables BEFORE reactive bindings 
            // so contextVars is populated with stage variables for interpolation binding.
            this.variableManager.stageVariables = {};
            this.variableManager.initializeStageVariables(this.stage);

            this.initializeReactiveBindings();

            logger.debug(`Global Vars AFTER initializeReactiveBindings:`, this.reactiveRuntime.getContext());
        }

        // IMPORTANT: Update ActionExecutor with new objects (Proxies if reactive)
        if (this.actionExecutor) {
            this.actionExecutor.setObjects(this.objects);
        }

        this.syncVariableComponents();

        this.actionExecutor.setObjects(this.objects);
        this.initStageController();
        
        // WICHTIG: TStageController mitteilen, auf welcher Stage wir WIRKLICH sind! 
        // (Für den Fall dass der Wechsel nicht durch ihn selbst, sondern durch eine navigate_stage Action passierte)
        if (this.stageController && this.stage) {
            this.stageController.setCurrentStageId(this.stage.id);
        }

        const glm = GameLoopManager.getInstance();
        const gridConfig = (this.stage && this.stage.grid) || this.project.stage?.grid || this.project.grid;
        glm.init(
            this.objects,
            gridConfig,
            this.options.onRender || (() => { }),
            (id: string, ev: string, data?: any) => this.handleEvent(id, ev, data),
            this.options.onSpriteRender
        );

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
        // KEIN weiterer triggerStartAnimation()-Aufruf hier!
        // this.start() → initMainGame() löst die Animation bereits aus.
        // Ein doppelter Aufruf verdoppelt den Off-Screen-Offset und
        // die Objekte landen weit außerhalb der Bühne (siehe DEVELOPER_GUIDELINES:
        // "DO NOT duplicate animation triggers in initialization routines").

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

        // KOORDINATEN-DRIFT-FIX + ANIMATIONS-FILTER:
        // 1. Kinder von Container-Komponenten (TGroupPanel, TPanel, TDialogRoot) haben relative
        //    x/y-Koordinaten. Der StageRenderer addiert die Parent-Position rekursiv. Würden wir
        //    Kinder UND Parent gleichzeitig positionsbasiert animieren, entsteht ein doppelter Offset.
        // 2. Das registrierte Stage-Objekt (kein className, x/y=undefined) darf nicht animiert werden.
        // 3. Unsichtbare Service-/Daten-Objekte (TStringMap, TVariable, isHiddenInRun) werden
        //    übersprungen, da sie keine visuelle DOM-Darstellung haben.
        // 4. Opacity-Animationen (fade-in) sind hiervon ausgenommen, da DOM-Elemente flach
        //    im Stage-Container liegen (kein CSS-Cascading der Opacity).

        // ═══ ANIMATIONS-FILTER: Objekte bestimmen, die NICHT animiert werden sollen ═══
        // - Kinder (parentId) – sie reiten auf dem Parent mit (DRIFT-FIX)
        // - Stage-Proxy (kein className) – das registrierte Stage-Objekt hat keine Geometrie
        // - Versteckte Service-Objekte (isHiddenInRun) – TStringMap, TVariable etc.
        // - Datenkomponenten (isVariable/isService) – diese haben keine visuelle Darstellung
        const shouldAnimate = (obj: any): boolean => {
            if (obj.visible === false) return false;
            if (obj.parentId) return false; // DRIFT-FIX: Kinder überspringen
            if (!obj.className) return false; // Stage-Proxy hat kein className
            if (obj.isHiddenInRun) return false; // Unsichtbare Services/Variablen
            if (obj.isVariable || obj.isService) return false; // Datenkomponenten
            if (obj.x === undefined || obj.y === undefined) return false; // Ohne Geometrie
            return true;
        };

        if (animationType === 'fade-in') {
            // Opacity: Alle sichtbaren Objekte animieren (auch Kinder), da die DOM-Elemente
            // nicht verschachtelt sind und CSS-Opacity nicht kaskadiert.
            this.objects.forEach(obj => {
                if (obj.visible !== false && obj.className) {
                    if (obj.style) {
                        const originalOpacity = obj.style.opacity !== undefined ? obj.style.opacity : 1;
                        obj.style.opacity = 0;
                        am.addTween(obj, 'style.opacity', Number(originalOpacity) || 1, duration, easing);
                    } else {
                        const originalOpacity = obj.opacity !== undefined ? obj.opacity : 1;
                        obj.opacity = 0;
                        am.addTween(obj, 'opacity', Number(originalOpacity) || 1, duration, easing);
                    }
                }
            });
            return;
        }

        if (animationType === 'slide-up') {
            const cellSize = grid.cellSize || 20;
            const shiftCells = 100 / cellSize; // "100 Pixel" in Grid-Zellen konvertieren!
            this.objects.forEach(obj => {
                if (shouldAnimate(obj)) {
                    const originalY = obj.y;
                    obj.y += shiftCells;
                    am.addTween(obj, 'y', originalY, duration, easing);
                }
            });
            return;
        }

        // TStage Fly-Patterns: Objekte von Startposition zu Zielposition animieren
        const simplePatterns = ['UpLeft', 'UpMiddle', 'UpRight', 'Left', 'Right', 'BottomLeft', 'BottomMiddle', 'BottomRight'];

        this.objects.forEach((obj, index) => {
            if (!shouldAnimate(obj)) return;

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
        // Intercept System Navigation Events (e.g. from TRichText links)
        if (eventName === '__SYSTEM_NAVIGATE__' && data?.target && this.options.onNavigate) {
            this.options.onNavigate(data.target);
            return;
        }

        // logger.info(`[DIAGNOSTIC] handleEvent entry: objId=${objectId}, event=${eventName}`);
        const obj = this.objects.find(o => o.id === objectId);
        if (!obj) {
            // logger.warn(`[DIAGNOSTIC] Object not found: ${objectId}`);
            return;
        }

        const hasOnEventMap = obj.onEvent && obj.onEvent[eventName];
        const hasTaskMap = (obj.events && obj.events[eventName]) || ((obj as any).Tasks && (obj as any).Tasks[eventName]);

        // logger.info(`[DIAGNOSTIC] Object found: ${obj.name}. hasOnEventMap=${!!hasOnEventMap}, hasTaskMap=${!!hasTaskMap}`);

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
                const eventVars: Record<string, any> = typeof data === 'object' && data !== null
                    ? { ...data, eventData: data, sender: obj }
                    : { eventData: data, sender: obj };
                // Komponentenobjekte injizieren, damit Property-Conditions (z.B. Button_36.visible)
                // vom TaskConditionEvaluator aufgelöst werden können.
                this.objects.forEach(o => { if (o.name && !(o.name in eventVars)) eventVars[o.name] = o; });
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
        this.multiplayerHandler.updateRemoteState(objectIdOrName, state);
    }

    public triggerRemoteEvent(objectId: string, eventName: string, params: any) {
        this.multiplayerHandler.triggerRemoteEvent(objectId, eventName, params);
    }

    public executeRemoteAction(action: any) {
        this.multiplayerHandler.executeRemoteAction(action);
    }

    public executeRemoteTask(taskName: string, params: any = {}, mode?: string) {
        this.multiplayerHandler.executeRemoteTask(taskName, params, mode);
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

    /**
     * Gibt das echte reaktive Master-Objekt aus this.objects zurück (keine Kopie!).
     * Verwende diese Methode immer dann, wenn du Properties wie visible, x, y etc.
     * direkt mutieren willst (z.B. beim Dialog-Schließen per X-Button).
     * NIEMALS getObjects() für Mutationen verwenden – das liefert Spread-Kopien!
     */
    public getRawObject(id: string): any | undefined {
        return this.objects.find(o => o.id === id);
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
                    logger.debug(`[Layout] ${obj.name}: x=${obj.x} (resolved=${rx}), parentX=${parentX} -> absoluteX=${absoluteX}`);
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

                // 3. Absolute Koordinaten weglassen, da der StageRenderer das Layout rekursiv verwaltet
                copy.x = rx;
                copy.y = ry;
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
        const topLevelObjects = this.objects.filter(o => !o.parentId);
        process(topLevelObjects);

        // ═══ FIX: Flache parentId-Kinder einsammeln ═══
        // Objekte, die per parentId auf einen Container verweisen, aber NICHT im
        // children-Array des Containers stehen (z.B. TGroupPanel-Kinder aus flachen
        // JSON-Definitionen), werden von der Rekursion oben nicht erreicht.
        // Diese "verwaisten Kinder" müssen nachträglich mit korrekter
        // Parent-Offset-Berechnung in die Ergebnisliste aufgenommen werden.
        const processedIds = new Set(results.map(r => r.id || r.name));
        const orphanedChildren = this.objects.filter(o => o.parentId && !processedIds.has(o.id || o.name));
        
        if (orphanedChildren.length > 0) {
            logger.info(`[getObjects] ${orphanedChildren.length} flache parentId-Kinder gefunden, die nicht über children-Rekursion erreicht wurden.`);
            for (const orphan of orphanedChildren) {
                // Parent-Offset aus den bereits verarbeiteten Ergebnissen holen
                const parentResult = results.find(r => (r.id || r.name) === orphan.parentId);
                // Falls Parent schon absolut aufgelöst wurde, nutzen wir dessen x/y aus results
                // Die results enthalten relative x/y, also müssen wir die Parent-Kette
                // manuell auflösen (analog zum StageRenderer)
                const resolveCoord = (val: any) => {
                    if (val === undefined || val === null) return 0;
                    if (typeof val === 'string' && val.includes('${')) {
                        try {
                            const evaluated = this.reactiveRuntime.evaluate(val);
                            const n = Number(evaluated);
                            return isNaN(n) ? 0 : n;
                        } catch (e) { return 0; }
                    }
                    return typeof val === 'number' ? val : (Number(val) || 0);
                };

                const copy: any = { ...orphan };
                let proto = Object.getPrototypeOf(orphan);
                while (proto && proto !== Object.prototype) {
                    const descriptors = Object.getOwnPropertyDescriptors(proto);
                    for (const key in descriptors) {
                        if (descriptors[key].get && !(key in copy)) {
                            try { copy[key] = orphan[key]; } catch (e) { /* ignore */ }
                        }
                    }
                    proto = Object.getPrototypeOf(proto);
                }

                copy.x = resolveCoord(orphan.x);
                copy.y = resolveCoord(orphan.y);
                copy.width = resolveCoord(orphan.width);
                copy.height = resolveCoord(orphan.height);
                copy.zIndex = resolveCoord(orphan.zIndex) + (parentResult ? (parentResult.zIndex || 0) + 1 : 0);

                results.push(copy);
            }
        }

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
        
        // Stage-Objekt selbst binden, da der Hintergrund z.B. in this.stage.grid gespeichert ist
        if (this.stage) {
            this.bindObjectProperties(this.stage);
        }

        // SYNC POINT: Give ReactiveRuntime access to ALL global variables
        // so it can evaluate expressions like ${MainTheme.ButtonBackground} 
        // that are defined project-wide but not explicitly placed on a Stage as objects.
        if (this.variableManager && this.variableManager.contextVars) {
            Object.entries(this.variableManager.contextVars).forEach(([key, val]) => {
                this.reactiveRuntime.registerVariable(key, val);
            });
        }

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
            const isGlobalVar = obj.scope === 'global' || (obj.name && (obj.name in this.variableManager.projectVariables));

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

                // PRESERVE DESIGN VALUES: Fallback to the original expression if it was overwritten during runtime
                const designVal = obj[DESIGN_VALUES]?.[propPath];
                if (designVal && typeof designVal === 'string' && designVal.includes('${')) {
                    logger.debug(`Restoring and binding reactive expression: ${obj.name}.${propPath} ← ${designVal}`);
                    this.reactiveRuntime.bindComponent(obj, propPath, designVal);
                } else if (typeof val === 'string' && val.includes('${')) {
                    logger.debug(`Creating reactive binding: ${obj.name}.${propPath} ← ${val}`);
                    this.reactiveRuntime.bindComponent(obj, propPath, val);
                } else if (val && typeof val === 'object' && !Array.isArray(val) && (key === 'style' || key === 'events' || key === 'Tasks' || key === 'grid')) {
                    // Recursive binding for nested objects like style, grid or events
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
                if (obj.name === 'StringMap_BluePrintStage') {
                    logger.debug(`[SYNC-TRACE] StringMap_BluePrintStage sync! runtimeValue:`, runtimeValue);
                    if (runtimeValue && typeof runtimeValue === 'object') {
                        logger.debug(`[SYNC-TRACE] runtimeValue keys:`, Object.keys(runtimeValue));
                    }
                }
                if (runtimeValue !== undefined) {
                    if (obj.items !== undefined && Array.isArray(runtimeValue)) {
                        obj.items = runtimeValue;
                    } else {
                        // SCHUTZVORRICHTUNG: Verhindere Zerstörung des Dictionaries durch einen leeren Proxy!
                        if (obj.className === 'TStringMap' && typeof runtimeValue === 'object' && Object.keys(runtimeValue).length === 0) {
                            if ((obj as any).value && Object.keys((obj as any).value).length > 0) {
                                return; // Erhalte den internen gesunden State der Komponente
                            }
                        }
                        (obj as any).value = runtimeValue;
                        if (obj.name === 'StringMap_BluePrintStage') {
                            logger.debug(`[SYNC-TRACE] After assignment to obj.value. obj.entries keys =`, Object.keys((obj as any).entries || {}));
                        }
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
