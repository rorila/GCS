import { ReactiveRuntime } from './ReactiveRuntime';
import { ActionExecutor } from './ActionExecutor';
import { TaskExecutor } from './TaskExecutor';
import { AnimationManager } from './AnimationManager';
import { GameLoopManager } from './GameLoopManager';
import { RuntimeVariableManager, IVariableHost } from './RuntimeVariableManager';
import { RuntimeStageManager } from './RuntimeStageManager';

import { GameRuntimeInput } from './core/GameRuntimeInput';
import { GameRuntimeMultiplayer } from './core/GameRuntimeMultiplayer';
import { TStageController } from '../components/TStageController';
import { SpritePool } from './SpritePool';
import { themeRegistry } from './ThemeRegistry';
import { Logger } from '../utils/Logger';

const logger = Logger.get('GameRuntime', 'Runtime_Execution');
import { RuntimeLifecycleService } from './services/RuntimeLifecycleService';
import { RuntimeStageService } from './services/RuntimeStageService';
import { RuntimeAnimationService } from './services/RuntimeAnimationService';
import { RuntimeEventService } from './services/RuntimeEventService';
import { RuntimeReactiveService } from './services/RuntimeReactiveService';
import { RuntimeTimerService } from './services/RuntimeTimerService';
import { RuntimeObjectService } from './services/RuntimeObjectService';

export interface RuntimeOptions {
    multiplayerManager?: any;
    onNavigate?: (target: string, params?: any) => void;
    initialGlobalVars?: Record<string, any>;
    makeReactive?: boolean;
    onRender?: () => void;
    onComponentUpdate?: (obj: any, prop?: string) => void;
    onSpriteRender?: (sprites: any[], dirtySprites?: any[]) => void;
    startStageId?: string;
    onStageSwitch?: (stageId: string) => void;
    onRestartGame?: () => void;
}

export class GameRuntime implements IVariableHost {
    public reactiveRuntime: ReactiveRuntime;
    public actionExecutor: ActionExecutor;
    public taskExecutor: TaskExecutor | null = null;

    public variableManager: RuntimeVariableManager;
    public stageManager: RuntimeStageManager;

    public objects: any[] = [];
    public objectNameCache: Record<string, any> = {};
    public objectNameCacheRef: any[] | null = null;
    public objectNameCacheCount: number = -1;
    public spritePool: SpritePool = new SpritePool();
    public isSplashActive: boolean = false;
    public splashTimerId: any = null;
    public isMainGameStarted: boolean = false;
    public stage: any = null;
    public stageController: TStageController | null = null;
    public varTimers: Map<string, any> = new Map();
    
    public inputHandler: GameRuntimeInput;
    public multiplayerHandler: GameRuntimeMultiplayer;

    public lifecycleService: RuntimeLifecycleService = new RuntimeLifecycleService();
    public stageService: RuntimeStageService = new RuntimeStageService();
    public animationService: RuntimeAnimationService = new RuntimeAnimationService();
    public eventService: RuntimeEventService = new RuntimeEventService();
    public reactiveService: RuntimeReactiveService = new RuntimeReactiveService();
    public timerService: RuntimeTimerService = new RuntimeTimerService();
    public objectService: RuntimeObjectService = new RuntimeObjectService();

    public get contextVars() { return this.variableManager.contextVars; }
    public get projectVariables() { return this.variableManager.projectVariables; }
    public get stageVariables() { return this.variableManager.stageVariables; }

    constructor(
        public project: any,
        objects?: any[],
        public options: RuntimeOptions = {}
    ) {
        // Projektspezifische Themes registrieren und aktives Theme setzen,
        // damit exportierte Spiele dieselben Styles verwenden wie im Editor.
        if (project && project.themes && project.themes.length > 0) {
            themeRegistry.loadProjectThemes(project.themes);
        }
        if (project && project.activeThemeId) {
            themeRegistry.setActiveTheme(project.activeThemeId);
        }

        // Optional: gespeicherte Spieler-Präferenz aus dem Standalone-Export wiederherstellen
        try {
            if (typeof localStorage !== 'undefined') {
                const savedTheme = localStorage.getItem('gcs-active-theme');
                if (savedTheme && savedTheme !== themeRegistry.getActiveThemeId()) {
                    themeRegistry.setActiveTheme(savedTheme);
                }
            }
        } catch (_e) {
            // localStorage ist in einigen Umgebungen nicht verfügbar
        }

        // Bei Theme-Wechsel während des Spiels Stage-Hintergrund aktualisieren und neu rendern
        themeRegistry.onChange = (themeId) => {
            logger.info(`[GameRuntime] Theme changed to ${themeId}; re-rendering.`);
            this.stageService.applyActiveThemeStageStyle(this);
            if (this.options.onRender) {
                this.options.onRender();
            }
        };

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

            // Sicherung: Ein normaler Spielstart soll niemals direkt auf die
            // Main-Stage springen, wenn eine Splash-Stage vorhanden ist.
            // Verhindert, dass eine gespeicherte activeStageId den Splash-Start
            // im exportierten Spiel überschreibt.
            if (activeStage && activeStage.type === 'main') {
                const splashStage = project.stages.find((s: any) => s.type === 'splash');
                if (splashStage) activeStage = splashStage;
            }
        } else if (hasStages) {
            activeStage = project.stages.find((s: any) => s.type === 'splash') ||
                project.stages.find((s: any) => s.id === project.activeStageId) ||
                project.stages[0];
        }

        if (objects) {
            this.objects = objects;
            this.actionExecutor = new ActionExecutor(this.objects, options.multiplayerManager, options.onNavigate, undefined, undefined, options.onRestartGame);
            this.taskExecutor = new TaskExecutor(project, project.actions || [], this.actionExecutor, project.flowCharts, options.multiplayerManager, project.tasks);
            this.actionExecutor.setTaskExecutor(this.taskExecutor);
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

            this.stageService.applyActiveThemeStageStyle(this);

            // NEW: Initialize stage variables for the first stage correctly!
            this.variableManager.initializeStageVariables(activeStage);
            
            // CRITICAL: Also import variables from the merged objects (Inherited from Blueprint etc.)
            // because they might be needed for SpritePool.init which follows immediately.
            this.variableManager.importVariablesFromObjects(this.objects);
            
            this.reactiveService.syncVariableComponents(this);

            // ─── OBJECT POOL: TSpriteTemplate → Pool-Instanzen erzeugen ───
            this.objectService.initSpritePools(this);

            logger.warn(`[REACTIVE-DEBUG] makeReactive=${!!options.makeReactive}, objects=${this.objects.length}, stage=${this.stage?.id}`);
                    this.reactiveService.configureReactiveWatcher(this);

            this.actionExecutor = new ActionExecutor(this.objects, options.multiplayerManager, options.onNavigate, this.spawnObject.bind(this), this.destroyObject.bind(this), options.onRestartGame);
            this.taskExecutor = new TaskExecutor(project, merged.actions, this.actionExecutor, merged.flowCharts, options.multiplayerManager, merged.tasks);
            this.actionExecutor.setTaskExecutor(this.taskExecutor);
        } else {
            this.objects = [];
            this.actionExecutor = new ActionExecutor(this.objects, options.multiplayerManager, options.onNavigate, undefined, undefined, options.onRestartGame);
            this.taskExecutor = new TaskExecutor(project, project.actions || [], this.actionExecutor, project.flowCharts, options.multiplayerManager, project.tasks);
            this.actionExecutor.setTaskExecutor(this.taskExecutor);
        }

        this.lifecycleService.init(this);
        this.stageService.initStageController(this);
        if (activeStage && options.onStageSwitch) options.onStageSwitch(activeStage.id);
    }
public updateRuntimeData(project: any) {
    return this.stageService.updateRuntimeData(this, project);
}
public stop() {
    this.lifecycleService.stop(this);
}
public start() {
    this.lifecycleService.start(this);
}

    public initMainGame() {

        const gridConfig = (this.stage && this.stage.grid) || this.project.stage?.grid || this.project.grid;
        const runtimeCallbacks = {
            handleEvent: (id: string, ev: string, data?: any) => this.handleEvent(id, ev, data),
            render: this.options.onRender || (() => { }),
            gridConfig,
            objects: this.objects,
            contextVars: this.contextVars,
            spawnObject: (templateId: string, x?: number, y?: number) => this.spawnObject(templateId, x, y),
            destroyObject: (instanceId: string) => this.destroyObject(instanceId),
            resetSpritePool: (template: any) => this.objectService.resetSpritePool(this, template),
            markSpriteDirty: (sprite: any) => GameLoopManager.getInstance().markSpriteDirty(sprite),
            // Feature C: TForEach-Callbacks für dynamisches Spawning/Destroying
            addObject: (obj: any) => {
                this.objects.push(obj);
                // Reactive Proxy registrieren, falls aktiv
                if (this.reactiveRuntime && obj.name) {
                    this.reactiveRuntime.registerObject(obj.name, obj, true);
                }
            },
            removeObject: (id: string) => {
                const idx = this.objects.findIndex((o: any) => o.id === id);
                if (idx >= 0) this.objects.splice(idx, 1);
            }
        };

        this.objects.forEach(obj => {
            obj.initRuntime?.(runtimeCallbacks);
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

        // Trigger onEnter and onRuntimeStart for the initially loaded stage
        // optionally delayed by animation duration
        const delayLogic = this.stage?.startLogicAfterAnimation;
        const duration = (animType !== 'none') ? (this.stage?.startAnimationDuration || 1000) : 0;

        const startLogic = () => {
            this.objects.forEach(obj => {
                obj.onRuntimeStart?.();
            });
            this.stageService.triggerStageStartEvents(this);
        };

        if (delayLogic && duration > 0) {
            setTimeout(startLogic, duration);
        } else {
            startLogic();
        }

        this.options.onRender?.();
    }
public switchToStage(stageId: string) {
    this.stageService.switchToStage(this, stageId);
}
    public handleStageChange(_oldStageId: string, newStageId: string, reset: boolean = false): void {
        this.stageService.handleStageChange(this, _oldStageId, newStageId, reset);
        if (!this.stage) return;
        this.initMainGame();
        if (this.options.onStageSwitch) this.options.onStageSwitch(newStageId);
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
            // ARCHITEKTUR-FIX (2026-04-26): Fade-In nutzt jetzt denselben shouldAnimate-Filter
            // wie alle positionsbasierten Animationen. Kinder (parentId) werden übersprungen.
            // Da DOM-Elemente flach im Stage-Container liegen, werden Kinder durch die
            // Opacity-Animation des Parents NICHT automatisch eingeblendet — deshalb setzen
            // wir ihre Opacity synchron auf 1, ohne Animation, um Jitter zu vermeiden.
            this.objects.forEach(obj => {
                if (!shouldAnimate(obj)) {
                    // Kinder und Nicht-Animierbare: Opacity sofort auf Zielwert setzen (kein Tween!)
                    // Damit sind sie beim ersten Render sichtbar, ohne eigenen Animations-Zyklus.
                    return;
                }
                if (obj.style) {
                    const originalOpacity = obj.style.opacity !== undefined ? obj.style.opacity : 1;
                    obj.style.opacity = 0;
                    am.addTween(obj, 'style.opacity', Number(originalOpacity) || 1, duration, easing);
                } else {
                    const originalOpacity = obj.opacity !== undefined ? obj.opacity : 1;
                    obj.opacity = 0;
                    am.addTween(obj, 'opacity', Number(originalOpacity) || 1, duration, easing);
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
            const start = this.animationService.getPatternStartPosition(animationType, targetX, targetY, index, stageWidth, stageHeight, outsideMargin, simplePatterns);

            if (!start) return; // Unbekanntes Pattern → keine Animation

            // Objekt zur Startposition setzen
            obj.x = start.x;
            obj.y = start.y;

            // Zum Ziel animieren
            am.addTween(obj, 'x', targetX, duration, easing);
            am.addTween(obj, 'y', targetY, duration, easing);
        });
    }

    public getObjectNameMap(): Record<string, any> {
        if (this.objectNameCacheRef !== this.objects || this.objectNameCacheCount !== this.objects.length) {
            const map: Record<string, any> = {};
            for (let i = 0, len = this.objects.length; i < len; i++) {
                const o = this.objects[i];
                if (o?.name) map[o.name] = o;
            }
            this.objectNameCache = map;
            this.objectNameCacheRef = this.objects;
            this.objectNameCacheCount = this.objects.length;
        }
        return this.objectNameCache;
    }
public handleEvent(objectId: string, eventName: string, data: any = {}) {
    return this.eventService.handleEvent(this, objectId, eventName, data);
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
public getContext() {
    return this.objectService.getContext(this);
}
public getRawObject(id: string) {
    return this.objectService.getRawObject(this, id);
}
public getObjects() {
    return this.objectService.getObjects(this);
}
public createPhantom(original: any) {
    return this.objectService.createPhantom(this, original);
}
public removeObject(id: string) {
    this.objectService.removeObject(this, id);
}
public startTimer(prop: string, varDef: any, duration: number) {
    return this.timerService.startTimer(this, prop, varDef, duration);
}
public clearAllTimers() {
    this.timerService.clearAllTimers(this);
}
public handleVariableAction(name: string, action: string, ...params: any[]) {
    return this.timerService.handleVariableAction(this, name, action, ...params);
}

    public getVarDef(name: string): any {
        let varDef = this.stage?.variables?.find((v: any) => v.name === name);
        if (!varDef && this.project.variables) {
            varDef = this.project.variables.find((v: any) => v.name === name);
        }
        return varDef;
    }
public spawnObject(templateId: string, x?: number, y?: number) {
    return this.objectService.spawnObject(this, templateId, x, y);
}
public destroyObject(instanceId: string) {
    this.objectService.destroyObject(this, instanceId);
}
}
