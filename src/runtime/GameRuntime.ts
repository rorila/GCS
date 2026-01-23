import { ReactiveRuntime } from './ReactiveRuntime';
import { ActionExecutor } from './ActionExecutor';
import { TaskExecutor } from './TaskExecutor';
import { AnimationManager } from './AnimationManager';
import { GameLoopManager } from './GameLoopManager';

import { hydrateObjects } from '../utils/Serialization';
import { TStageController } from '../components/TStageController';


export interface RuntimeOptions {
    multiplayerManager?: any;
    onNavigate?: (target: string, params?: any) => void;
    initialGlobalVars?: Record<string, any>;
    makeReactive?: boolean;
    onRender?: () => void;
    startStageId?: string;
    onStageSwitch?: (stageId: string) => void; // New callback for background sync
}

export class GameRuntime {
    private reactiveRuntime: ReactiveRuntime;
    private actionExecutor: ActionExecutor;
    private taskExecutor: TaskExecutor;

    // Phase 3: Variable Scopes
    private projectVariables: Record<string, any> = {}; // Global persistence
    private stageVariables: Record<string, any> = {};   // Local ephemeral
    private contextVars: Record<string, any>;           // Proxy for access

    private objects: any[];
    private isSplashActive: boolean = false;
    private splashTimerId: any = null;
    public stage: any = null; // Public property for external access (e.g. Standalone Player)
    private stageController: TStageController | null = null;

    constructor(
        private project: any,
        objects?: any[],
        private options: RuntimeOptions = {}
    ) {
        // Initialize Project Variables (Global)
        this.projectVariables = { ...options.initialGlobalVars };
        if (project.variables) {
            project.variables.forEach((v: any) => {
                const isGlobal = !v.scope || v.scope === 'global';
                if (isGlobal) {
                    // Set default if not provided in initial options
                    if (this.projectVariables[v.name] === undefined) {
                        this.projectVariables[v.name] = v.defaultValue;
                    }
                } else if (v.scope === 'local') {
                    // This is a "Global-Local" variable: defined in project but value is local to each stage
                    if (this.stageVariables[v.name] === undefined) {
                        this.stageVariables[v.name] = v.defaultValue;
                    }
                }
            });
        }

        // Initialize Proxy for unified access
        this.contextVars = this.createVariableContext();

        this.reactiveRuntime = new ReactiveRuntime();

        // Determine if we start with a specific stage or legacy objects
        const hasStages = project.stages && project.stages.length > 0;

        let activeStage = null;

        if (options.startStageId && hasStages) {
            activeStage = project.stages.find((s: any) => s.id === options.startStageId);
            console.log(`[GameRuntime] Context-Aware Start. Requested stage: ${activeStage?.name || options.startStageId}`);
        } else {
            console.log(`[GameRuntime] Default Start. Searching for Splash.`);
            if (hasStages) {
                const splashStage = project.stages.find((s: any) => s.type === 'splash');
                if (splashStage) {
                    activeStage = splashStage;
                    console.log(`[GameRuntime] Found Splash: ${activeStage.name}`);
                } else {
                    activeStage = project.stages.find((s: any) => s.id === project.activeStageId) || project.stages[0];
                    console.log(`[GameRuntime] No Splash. Using: ${activeStage?.name}`);
                }
            }
        }

        if (objects) {
            // Sandbox/Override mode
            this.objects = objects;
            // Minimal initialization for sandbox
            this.actionExecutor = new ActionExecutor(this.objects, options.multiplayerManager, options.onNavigate);
            this.taskExecutor = new TaskExecutor(project, project.actions || [], this.actionExecutor, project.flowCharts, options.multiplayerManager, project.tasks);
        } else if (activeStage) {
            this.stage = activeStage;
            this.isSplashActive = activeStage.type === 'splash';

            // 1. Resolve Inheritance Chain (Recursive)
            const stageChain = this.resolveInheritanceChain(activeStage.id);
            console.log(`[GameRuntime] Resolved inheritance chain: ${stageChain.map(s => s.name).join(' -> ')}`);

            // 2. Aggregate Objects, Tasks, Actions, and FlowCharts across the chain
            let mergedObjects: any[] = [];
            let mergedTasks: any[] = [];
            let mergedActions: any[] = [];
            let mergedFlowCharts: any = { ...(project.flowCharts || {}) };

            const objectIdSet = new Set<string>();

            // Process chain from Ancestor to Child (Overriding)
            stageChain.forEach(stage => {
                // Objects
                const stageObjects = hydrateObjects(stage.objects || []);
                stageObjects.forEach(obj => {
                    // ID-based collision: Child replaces Parent
                    mergedObjects = mergedObjects.filter(o => o.id !== obj.id);
                    mergedObjects.push(obj);
                    objectIdSet.add(obj.id);
                });

                // Tasks
                if (stage.tasks) {
                    stage.tasks.forEach((t: any) => {
                        mergedTasks = mergedTasks.filter((existing: any) => existing.name !== t.name);
                        mergedTasks.push(t);
                    });
                }

                // Actions
                if (stage.actions) {
                    stage.actions.forEach((a: any) => {
                        mergedActions = mergedActions.filter((existing: any) => existing.name !== a.name);
                        mergedActions.push(a);
                    });
                }

                // FlowCharts
                if (stage.flowCharts) {
                    Object.assign(mergedFlowCharts, stage.flowCharts);
                }

                // Variables (Local to Stage)
                if (stage.variables) {
                    stage.variables.forEach((v: any) => {
                        // Only set if not already set (Chain precedence: Tail overrides Head)
                        // Actually, chain loop is Head -> Tail? Let's check resolveInheritanceChain.
                        // Usually it's Child -> ... -> Template.
                        // If so, first stage in loop is active stage.
                        // Let's check.
                        this.stageVariables[v.name] = v.defaultValue;
                    });
                }
            });

            // 3. Special Inheritance: Global System Services from 'Main' (baseline for all sub-stages)
            if (activeStage.type !== 'splash' && activeStage.type !== 'main') {
                const mainStage = project.stages.find((s: any) => s.type === 'main');
                if (mainStage && mainStage.objects) {
                    const globalObjects = hydrateObjects(mainStage.objects);
                    const systemClasses = [
                        'TGameLoop', 'TStageController', 'TGameState',
                        'THandshake', 'THeartbeat', 'TGameServer',
                        'TInputController', 'TDebugLog'
                    ];

                    globalObjects.forEach(gObj => {
                        const isSystem = systemClasses.includes(gObj.className);
                        if (isSystem && !objectIdSet.has(gObj.id)) {
                            // Only inherit if no local object with the same name exists
                            const nameCollision = mergedObjects.find(l => l.name === gObj.name);
                            if (!nameCollision) {
                                mergedObjects.push(gObj);
                            }
                        }
                    });
                }
            }

            this.objects = mergedObjects;

            // 4. Initialize Reactive Runtime
            if (options.makeReactive) {
                this.objects.forEach(obj => {
                    this.reactiveRuntime.registerObject(obj.name, obj, true);
                });
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
                this.objects = this.reactiveRuntime.getObjects();
            }

            // 5. Setup Executors
            this.actionExecutor = new ActionExecutor(
                this.objects,
                options.multiplayerManager || (window as any).multiplayerManager,
                options.onNavigate
            );

            const mp = options.multiplayerManager || (window as any).multiplayerManager;

            // Final Logic: Global project base + aggregated stage logic
            const finalTasks = [...(project.tasks || []), ...mergedTasks];
            const finalActions = [...(project.actions || []), ...mergedActions];

            this.taskExecutor = new TaskExecutor(
                project,
                finalActions,
                this.actionExecutor,
                mergedFlowCharts,
                mp,
                finalTasks
            );
        } else {
            // Legacy-Fallback (Splash -> Main)
            const hasLegacySplash = project.splashObjects && project.splashObjects.length > 0;
            if (hasLegacySplash) {
                this.isSplashActive = true;
                this.objects = hydrateObjects(project.splashObjects || []);
            } else {
                this.objects = hydrateObjects(project.objects || []);
            }
            this.actionExecutor = new ActionExecutor(this.objects, options.multiplayerManager, options.onNavigate);
            this.taskExecutor = new TaskExecutor(project, project.actions || [], this.actionExecutor, project.flowCharts, options.multiplayerManager, project.tasks);
        }

        // Wiring for remote task execution
        if (options.multiplayerManager) {
            options.multiplayerManager.onRemoteTask = (msg: any) => {
                this.executeRemoteTask(msg.taskName, msg.params);
            };
        }

        this.init();
        this.initStageController();

        if (activeStage && options.onStageSwitch) {
            options.onStageSwitch(activeStage.id);
        }
    }

    public stop() {
        if (this.splashTimerId) {
            clearTimeout(this.splashTimerId);
            this.splashTimerId = null;
        }

        // 1. Stop Game Loop
        const gameLoop = this.objects.find(o => o.className === 'TGameLoop');
        if (gameLoop && typeof gameLoop.stop === 'function') {
            gameLoop.stop();
        }
        // CRITICAL: Also stop the singleton manager
        GameLoopManager.getInstance().stop();

        // 2. Stop Input Controllers
        const inputControllers = this.objects.filter(o => o.className === 'TInputController');
        inputControllers.forEach(ic => {
            if (typeof ic.stop === 'function') ic.stop();
        });

        // 3. Stop Timers
        const timers = this.objects.filter(o => o.className === 'TTimer');
        timers.forEach(timer => {
            if (typeof timer.stop === 'function') timer.stop();
        });

        // 4. Stop GameServers
        const servers = this.objects.filter(o => o.className === 'TGameServer');
        servers.forEach(server => {
            if (typeof server.stop === 'function') server.stop();
        });

        // 5. Clear Animation Manager
        AnimationManager.getInstance().clear();
    }

    public start() {
        if (this.options.onRender) this.options.onRender();

        // 1. Trigger onStart for all current active objects
        this.objects.forEach(obj => {
            this.handleEvent(obj.id, 'onStart');
        });

        // 2. Handle Splash Sequencing
        if (this.isSplashActive) {
            if (this.project.splashAutoHide) {
                const duration = (this.stage as any)?.duration || this.project.splashDuration || 3000;
                console.log(`[GameRuntime] Splash active. Auto-hiding in ${duration}ms`);
                this.splashTimerId = setTimeout(() => {
                    this.finishSplash();
                }, duration);
            }
            return;
        }

        // 3. Normal Game Start
        this.initMainGame();
    }

    private initMainGame() {
        // a) Trigger Animation
        let stageConfig = this.stage || this.project.stage || this.project.grid;

        if (stageConfig && stageConfig.startAnimation && stageConfig.startAnimation !== 'none') {
            this.triggerStartAnimation(stageConfig);
        }

        // b) Input Controllers
        const inputControllers = this.objects.filter(o => o.className === 'TInputController');
        inputControllers.forEach(ic => {
            if (typeof ic.init === 'function') {
                ic.init(this.objects, (id: string, ev: string, data: any) => this.handleEvent(id, ev, data));
            }
            if (typeof ic.start === 'function') ic.start();
        });

        // c) Game Loop - Use GameLoopManager Singleton
        const gridConfig = (this.stage && this.stage.grid) || this.project.stage?.grid || this.project.grid;
        GameLoopManager.getInstance().init(
            this.objects,
            gridConfig,
            this.options.onRender || (() => { }),
            (id: string, ev: string, data: any) => this.handleEvent(id, ev, data)
        );
        GameLoopManager.getInstance().start();

        // d) Timers
        const timers = this.objects.filter(o => o.className === 'TTimer');
        timers.forEach(timer => {
            if ('onEvent' in timer) timer.onEvent = (ev: string) => this.handleEvent(timer.id, ev);
            if (typeof timer.start === 'function') timer.start(() => this.handleEvent(timer.id, 'onTimer'));
        });

        // e) Specialized Labels
        const numberLabels = this.objects.filter(o => o.className === 'TNumberLabel');
        numberLabels.forEach(nl => {
            if ('onEvent' in nl) nl.onEvent = (ev: string) => this.handleEvent(nl.id, ev);
        });

        // f) Splash (Legacy support for standalone splash objects in main game)
        const splashScreens = this.objects.filter(o => o.className === 'TSplashScreen');
        splashScreens.forEach(splash => {
            const duration = splash.duration || 3000;
            setTimeout(() => {
                this.handleEvent(splash.id, 'onFinish');
                if (splash.autoHide) {
                    splash.visible = false;
                    if (this.options.onRender) this.options.onRender();
                }
            }, duration);
        });

        // g) Multiplayer
        this.initMultiplayer();

        if (this.options.onRender) this.options.onRender();
    }

    private finishSplash() {
        if (!this.isSplashActive) return;
        if (this.splashTimerId) {
            clearTimeout(this.splashTimerId);
            this.splashTimerId = null;
        }

        console.log("[GameRuntime] Splash finished. Using TStageController to switch to Main.");
        this.isSplashActive = false;

        // Nutze TStageController für den Stage-Wechsel
        if (this.stageController) {
            this.stageController.goToMainStage();
        } else {
            // Fallback: Manueller Wechsel wenn kein StageController vorhanden
            console.warn("[GameRuntime] No StageController found, using legacy stage switch");
            this.legacyStageSwitch();
        }
    }

    /**
     * Initialisiert den TStageController und registriert den Stage-Wechsel Callback
     */
    private initStageController(): void {
        this.stageController = this.objects.find(
            o => o.className === 'TStageController'
        ) as TStageController | null;

        if (this.stageController && this.project.stages) {
            this.stageController.setStages(this.project.stages);
            this.stageController.setOnStageChangeCallback(
                (oldId, newId) => this.handleStageChange(oldId, newId)
            );
            console.log(`[GameRuntime] StageController initialized with ${this.project.stages.length} stages`);
        }
    }

    /**
     * Wird vom TStageController aufgerufen wenn die Stage wechselt
     */
    private handleStageChange(oldStageId: string, newStageId: string): void {
        console.log(`[GameRuntime] Stage change: ${oldStageId} → ${newStageId}`);

        // CRITICAL: Update stage reference SYNCHRONOUSLY before async operations
        // This prevents race conditions where initMainGame uses stale stage config
        if (this.project.stages) {
            this.stage = this.project.stages.find((s: any) => s.id === newStageId);
        }

        // FIX: Use direct access to project.stages instead of dynamic import
        // The dynamic import of ProjectRegistry doesn't work in bundled HTML exports
        const targetStage = this.project.stages?.find((s: any) => s.id === newStageId);
        if (!targetStage) {
            console.error(`[GameRuntime] Stage not found: ${newStageId}`);
            return;
        }

        // 2. Hydrierung: Neue Objekte der Stage + Globale Services
        // Get objects directly from the target stage
        let combinedObjects = [...(targetStage.objects || [])];

        // Add global system objects from Main stage (if switching to non-main stage)
        if (targetStage.type !== 'main') {
            const mainStage = this.project.stages?.find((s: any) => s.type === 'main');
            if (mainStage && mainStage.objects) {
                const systemClasses = [
                    'TGameLoop', 'TStageController', 'TGameState',
                    'THandshake', 'THeartbeat', 'TGameServer',
                    'TInputController', 'TDebugLog'
                ];
                const existingIds = new Set(combinedObjects.map((o: any) => o.id));
                mainStage.objects.forEach((gObj: any) => {
                    if (systemClasses.includes(gObj.className) && !existingIds.has(gObj.id)) {
                        combinedObjects.push(gObj);
                    }
                });
            }
        }

        console.log(`[GameRuntime] Loading ${combinedObjects.length} objects for stage ${newStageId}`);
        this.objects = hydrateObjects(combinedObjects);

        // 4. Stage-spezifische FlowCharts, Tasks und Actions im TaskExecutor aktualisieren
        const stageFlowCharts = (this.stage as any)?.flowCharts || {};
        const stageTasks = (this.stage as any)?.tasks || [];
        const stageActions = (this.stage as any)?.actions || [];

        // Merge with global collections, stage-specific flows/tasks/actions win
        const mergedFlowCharts = {
            ...(this.project.flowCharts || {}),
            ...stageFlowCharts
        };
        const mergedTasks = [
            ...(this.project.tasks || []),
            ...stageTasks
        ];
        const mergedActions = [
            ...(this.project.actions || []),
            ...stageActions
        ];

        this.taskExecutor.setFlowCharts(mergedFlowCharts);
        this.taskExecutor.setTasks(mergedTasks);
        this.taskExecutor.setActions(mergedActions);

        console.log(`[GameRuntime] TaskExecutor updated with ${Object.keys(mergedFlowCharts).length} flowCharts, ${mergedTasks.length} tasks and ${mergedActions.length} actions`);

        // 5. Reactive Runtime aktualisieren
        if (this.options.makeReactive) {
            this.reactiveRuntime.clear(); // CRITICAL: Clear old objects and bindings
            AnimationManager.getInstance().clear(); // CRITICAL: Clear animations from previous stage
            this.objects.forEach(obj => this.reactiveRuntime.registerObject(obj.name, obj, true));
            this.reactiveRuntime.setVariable('isSplashActive', false);
            this.objects = this.reactiveRuntime.getObjects();
        }

        // Phase 3: Reset Local Variables for new Stage
        this.stageVariables = {};
        // Initialize defaults for local variables
        if (this.stage?.variables) {
            this.stage.variables.forEach((v: any) => {
                this.stageVariables[v.name] = v.defaultValue;
            });
        }
        console.log(`[GameRuntime] Local variables reset for stage ${newStageId}`);

        // 6. Executors aktualisieren
        this.actionExecutor.setObjects(this.objects);

        // 7. StageController neu initialisieren (weil er jetzt Teil der neuen Objekte ist)
        this.initStageController();

        // 8. GameLoop und andere Komponenten starten
        this.start();

        // 9. Host benachrichtigen (für UI-Update)
        if (this.options.onStageSwitch) {
            console.log(`[GameRuntime] Notifying host of stage switch to: ${newStageId}`);
            this.options.onStageSwitch(newStageId);
        }
    }

    /**
     * Legacy Stage-Wechsel (Fallback wenn kein TStageController vorhanden)
     */
    private legacyStageSwitch(): void {
        if (this.project.stages) {
            const mainStage = this.project.stages.find((s: any) => s.type === 'main');
            if (mainStage) {
                this.handleStageChange('splash', mainStage.id);
            }
        } else {
            this.objects = hydrateObjects(this.project.objects || []);
            this.start();
        }
    }



    private initMultiplayer() {
        const mp = this.options.multiplayerManager || (window as any).multiplayerManager;
        if (!mp) return;

        if (typeof mp.on === 'function') {
            mp.on((msg: any) => {
                const handshakes = this.objects.filter(o => o.className === 'THandshake');
                handshakes.forEach(hs => {
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

                const heartbeats = this.objects.filter(o => o.className === 'THeartbeat');
                heartbeats.forEach(hb => {
                    if (msg.type === 'pong') hb._handlePong(msg.serverTime);
                    else if (msg.type === 'player_timeout') hb._setConnectionLost();
                });
            });
        }

        // Callbacks
        this.objects.filter(o => o.className === 'THandshake').forEach(hs => {
            hs.onEvent = (ev: string, data?: any) => {
                if (ev === '_createRoom') mp.createRoom();
                else if (ev === '_joinRoom') mp.joinRoom(data?.code);
                else if (ev === '_ready') mp.ready();
                else this.handleEvent(hs.id, ev, data);
            };
        });

        this.objects.filter(o => o.className === 'THeartbeat').forEach(hb => {
            hb.onEvent = (ev: string, data?: any) => {
                if (ev === '_start') hb._startTimer(() => mp.send({ type: 'ping', timestamp: Date.now() }));
                else if (ev === '_stop') hb._stopTimer();
                else this.handleEvent(hb.id, ev, data);
            };
        });

        this.objects.filter(o => o.className === 'TGameServer').forEach(server => {
            if (typeof server.start === 'function') {
                server.start((ev: string, data?: any) => this.handleEvent(server.id, ev, data));
            }
        });

        // Restore state
        if (mp.roomCode) {
            this.objects.filter(o => o.className === 'THandshake').forEach(hs => {
                hs._setRoomInfo(mp.roomCode, mp.playerNumber, mp.playerNumber === 1);
                hs._setStatus('waiting');
                if (mp.playerNumber === 1) hs._fireEvent('onRoomCreated', { roomCode: mp.roomCode });
                else hs._fireEvent('onRoomJoined', { roomCode: mp.roomCode, playerNumber: mp.playerNumber });
            });
        }
    }

    private triggerStartAnimation(stageConfig: any) {
        const invisibleClasses = ['TGameLoop', 'TInputController', 'TTimer', 'TGameState', 'THandshake', 'THeartbeat', 'TGameServer', 'TStage'];
        const visualObjects = this.objects.filter(o => !invisibleClasses.includes(o.className));

        visualObjects.forEach((obj, index) => {
            if (typeof obj.moveTo === 'function') {
                const targetX = obj.x, targetY = obj.y;
                const duration = stageConfig.startAnimationDuration || 1000;
                const easing = stageConfig.startAnimationEasing || 'easeOut';
                const start = this.getPatternStartPosition(stageConfig.startAnimation, targetX, targetY, index, stageConfig);

                obj.x = start.x; obj.y = start.y;
                if (!obj.style) obj.style = {};
                obj.style.opacity = 0;
                obj.moveTo(targetX, targetY, duration, easing);
                AnimationManager.getInstance().addTween(obj, 'style.opacity', 1, duration, easing);
            }
        });
    }

    public async handleEvent(objectId: string, eventName: string, data: any = {}) {
        // 1. Find object
        const obj = this.objects.find(o => o.id === objectId || o.name === objectId);
        if (!obj) {
            // console.warn(`[GameRuntime] Object not found: ${objectId}`);
            return;
        }

        // 2. Check for event handler in Tasks object (primary location for editor-defined events)
        const taskName = obj.Tasks?.[eventName] || obj[eventName] || obj.properties?.[eventName];

        if (taskName && typeof taskName === 'string') {
            console.log(`[GameRuntime] Handling ${eventName} on ${obj.name} -> Task: ${taskName}`, data);

            // Prepare local vars if needed (usually empty for event start)
            const vars = {};

            // Execute Task
            await this.taskExecutor.execute(taskName, vars, this.contextVars, obj, 0, undefined, data);

            // Reactivity sync (optional, handled by ReactiveRuntime usually)
        }
    }

    public updateRemoteState(objectIdOrName: string, state: any) {
        const target = this.objects.find(o => o.id === objectIdOrName || o.name === objectIdOrName);
        if (!target) return;

        if (state.x !== undefined || state.y !== undefined) {
            if (typeof target.smoothSync === 'function') target.smoothSync(state.x ?? target.x, state.y ?? target.y);
            else { if (state.x !== undefined) target.x = state.x; if (state.y !== undefined) target.y = state.y; }
        }
        if (state.vx !== undefined) target.velocityX = state.vx;
        if (state.vy !== undefined) target.velocityY = state.vy;
        if (state.text !== undefined) target.text = state.text;
        if (state.value !== undefined) target.value = state.value;
        if (state.spritesMoving !== undefined) target.spritesMoving = state.spritesMoving;

        this.handleEvent(target.id, 'onSyncState', { ...state, syncedObject: target.name });
    }



    /**
     * Multiplayer: Triggers an event on a specific object from a remote peer
     */
    public async triggerRemoteEvent(objectId: string, eventName: string, params: any) {
        console.log(`[Runtime] Remote Event: ${objectId}.${eventName}`, params);
        await this.handleEvent(objectId, eventName, params);
    }

    /**
     * Multiplayer: Executes an action from a remote peer
     */
    public async executeRemoteAction(action: any) {
        console.log(`[Runtime] Remote Action:`, action);
        await this.actionExecutor.execute(action, {}, this.contextVars);
    }

    /**
     * Multiplayer: Executes a task from a remote peer
     */
    public async executeRemoteTask(taskName: string, params: any = {}, mode?: string) {
        console.log(`[GameRuntime] Executing remote task: ${taskName} (mode: ${mode})`);
        const vars: Record<string, any> = {};
        // Use contextVars Proxy to get current state
        if (this.project.variables) {
            this.project.variables.forEach((v: any) => vars[v.name] = this.contextVars[v.name]);
        }
        Object.assign(vars, this.stageVariables, params || {}); // Include local vars too? Or just global?

        // Execute task with remote flag set to true
        this.taskExecutor.execute(taskName, vars, this.contextVars, null, 0, undefined, params, true);
    }

    /**
     * Returns all runtime objects as a flattened list with absolute coordinates for rendering.
     * Also accumulates z-index to ensure children of high-z parents (like Splash) are rendered on top.
     */
    public getObjects(): any[] {
        const all: any[] = [];
        const process = (objs: any[], parentX = 0, parentY = 0, parentZ = 0) => {
            objs.forEach(obj => {
                // Calculate effective Z-Index (relative to parent)
                // Ensure type safety for zIndex accumulation
                const currentZ = (typeof obj.zIndex === 'number') ? obj.zIndex : 0;
                const effectiveZ = parentZ + currentZ;

                // Return a copy with absolute coordinates for the renderer
                // CRITICAL: Proxy objects don't spread getter properties correctly,
                // so we must explicitly copy image-related properties
                const renderObj = {
                    ...obj,
                    x: (obj.x || 0) + parentX,
                    y: (obj.y || 0) + parentY,
                    zIndex: effectiveZ,
                    // Explicitly copy image properties that may be lost on Proxy spread
                    backgroundImage: obj.backgroundImage,
                    src: obj.src,
                    objectFit: obj.objectFit,
                    imageOpacity: obj.imageOpacity
                };
                all.push(renderObj);
                if (obj.children && obj.children.length > 0) {
                    process(obj.children, renderObj.x, renderObj.y, effectiveZ);
                }
            });
        };
        process(this.objects);
        return all;
    }

    /**
     * Creates a temporary shallow clone of an object.
     * Used for 'copy' drag mode.
     */
    public createPhantom(original: any): any {
        const phantom = {
            ...original,
            id: `phantom_${Date.now()}`,
            name: `${original.name}_phantom`,
            _isPhantom: true,
            _original: original,
            draggable: false // Phantoms themselves aren't draggable
        };
        // Hydrate children if any? (Minimal for now)
        this.objects.push(phantom);
        return phantom;
    }

    /**
     * Removes an object from the runtime.
     */
    public removeObject(id: string): void {
        this.objects = this.objects.filter(o => o.id !== id);
    }

    private resolveInheritanceChain(stageId: string, visited: Set<string> = new Set()): any[] {
        if (visited.has(stageId)) {
            console.error(`[GameRuntime] Circular inheritance detected for stage: ${stageId}`);
            return [];
        }
        visited.add(stageId);

        const stage = this.project.stages?.find((s: any) => s.id === stageId);
        if (!stage) return [];

        const chain = [stage];
        if (stage.inheritsFrom) {
            chain.unshift(...this.resolveInheritanceChain(stage.inheritsFrom, visited));
        }
        return chain;
    }

    private init() {
        if (!this.options.makeReactive) {
            this.objects.forEach(obj => this.reactiveRuntime.registerObject(obj.name, obj, false));
        }
        if (this.project.variables) {
            this.project.variables.forEach((v: any) => {
                // Ensure ReactiveRuntime knows about globals
                const val = this.projectVariables[v.name];
                this.reactiveRuntime.registerVariable(v.name, val);
            });
        }
        // Also register local variables if we are in a stage
        if (this.stage && this.stage.variables) {
            this.stage.variables.forEach((v: any) => {
                this.stageVariables[v.name] = v.defaultValue;
                this.reactiveRuntime.registerVariable(v.name, v.defaultValue);
            });
        }
        this.setupBindings();

        // Phase 3: Register Stage Proxies for Cross-Stage Access (e.g. "Level1.score")
        if (this.project.stages) {
            this.project.stages.forEach((stage: any) => {
                if (stage.name) {
                    // Register the stage name as a global object in ReactiveRuntime
                    this.reactiveRuntime.registerObject(stage.name, this.createStageProxy(stage), false);
                }
            });
        }
    }

    /**
     * Phase 3: Creates a Proxy for a Stage to allow read-only access to its public variables.
     * Usage: ${StageName.VarName}
     */
    private createStageProxy(stage: any): any {
        return new Proxy({}, {
            get: (_target, prop: string) => {
                // 1. Find the variable definition in the target stage
                const variableDef = stage.variables?.find((v: any) => v.name === prop);

                // 2. Check existence and visibility (Public Access only)
                if (!variableDef) return undefined;
                if (!variableDef.isPublic) {
                    console.warn(`[Scope] Access denied: Variable '${prop}' in stage '${stage.name}' is private.`);
                    return undefined;
                }

                // 3. Resolve Value
                // If this stage is currently active, return the live value
                if (this.stage && this.stage.id === stage.id) {
                    return this.stageVariables[prop];
                }

                // If stage is inactive, return default value (Local variables are ephemeral)
                // TODO: Future enhancement - "Persistent" local variables?
                return variableDef.defaultValue;
            },
            set: () => {
                console.warn(`[Scope] Cannot set properties on Stage Proxy '${stage.name}'. Cross-stage writes are forbidden.`);
                return false; // Read-only
            }
        });
    }

    /**
     * Phase 3: Creates a Proxy handles variable scoping (Local > Global).
     */
    /**
     * Phase 3: Creates a Proxy handles variable scoping (Local > Global).
     * Includes Reactive Event Logic (Thresholds, Triggers, Changed).
     */
    private createVariableContext(): Record<string, any> {
        return new Proxy({}, {
            get: (_target, prop: string) => {
                // 1. Check Local (Stage)
                if (prop in this.stageVariables) {
                    return this.stageVariables[prop];
                }
                // 2. Check Global (Project)
                if (prop in this.projectVariables) {
                    return this.projectVariables[prop];
                }
                return undefined;
            },
            set: (_target, prop: string, value: any) => {
                const oldValue = this.stageVariables[prop] !== undefined
                    ? this.stageVariables[prop]
                    : this.projectVariables[prop];

                // 1. Update Value (Scoping Rules)
                if (prop in this.stageVariables) {
                    this.stageVariables[prop] = value;
                } else if (prop in this.projectVariables) {
                    this.projectVariables[prop] = value;
                } else {
                    // Implicit -> Local
                    this.stageVariables[prop] = value;
                }

                // 2. Sync with ReactiveRuntime for UI bindings
                this.reactiveRuntime.setVariable(prop, value);

                // 3. Reactive Events (only if TaskExecutor is ready)
                if (this.taskExecutor) {
                    // Find Variable Definition to get Event Config
                    let varDef: any = this.stage?.variables?.find((v: any) => v.name === prop);
                    if (!varDef && this.project.variables) {
                        varDef = this.project.variables.find((v: any) => v.name === prop);
                    }

                    if (varDef) {
                        // a) onValueChanged
                        if (oldValue !== value && varDef.onValueChanged) {
                            console.log(`[Reactive] ${prop} changed -> executing ${varDef.onValueChanged}`);
                            this.taskExecutor.execute(varDef.onValueChanged, {}, this.contextVars);
                        }

                        // b) onValueEmpty (String="" or Number=null/undefined. 0 is NOT empty)
                        if ((value === "" || value === null || value === undefined) && varDef.onValueEmpty) {
                            console.log(`[Reactive] ${prop} is empty -> executing ${varDef.onValueEmpty}`);
                            this.taskExecutor.execute(varDef.onValueEmpty, {}, this.contextVars);
                        }

                        // c) Thresholds (Numbers)
                        if (typeof value === 'number' && typeof oldValue === 'number' && typeof varDef.threshold === 'number') {
                            const t = varDef.threshold;
                            // Reached (Crossing from below)
                            if (oldValue < t && value >= t && varDef.onThresholdReached) {
                                console.log(`[Reactive] ${prop} reached threshold ${t} -> executing ${varDef.onThresholdReached}`);
                                this.taskExecutor.execute(varDef.onThresholdReached, {}, this.contextVars);
                            }
                            // Left (Crossing from above or equal)
                            if (oldValue >= t && value < t && varDef.onThresholdLeft) {
                                console.log(`[Reactive] ${prop} left threshold ${t} -> executing ${varDef.onThresholdLeft}`);
                                this.taskExecutor.execute(varDef.onThresholdLeft, {}, this.contextVars);
                            }
                            // Exceeded (Strictly greater)
                            if (oldValue <= t && value > t && varDef.onThresholdExceeded) {
                                console.log(`[Reactive] ${prop} exceeded threshold ${t} -> executing ${varDef.onThresholdExceeded}`);
                                this.taskExecutor.execute(varDef.onThresholdExceeded, {}, this.contextVars);
                            }
                        }

                        // d) Trigger Values
                        if (varDef.triggerValue !== undefined && varDef.triggerValue !== "" && varDef.triggerValue !== null) {
                            // Loose equality to allow string/number match (e.g. "10" == 10 from JSON input)
                            const isTrigger = value == varDef.triggerValue;
                            const wasTrigger = oldValue == varDef.triggerValue;

                            if (isTrigger && !wasTrigger && varDef.onTriggerEnter) {
                                console.log(`[Reactive] ${prop} entered trigger ${varDef.triggerValue} -> executing ${varDef.onTriggerEnter}`);
                                this.taskExecutor.execute(varDef.onTriggerEnter, {}, this.contextVars);
                            }
                            if (!isTrigger && wasTrigger && varDef.onTriggerExit) {
                                console.log(`[Reactive] ${prop} exited trigger ${varDef.triggerValue} -> executing ${varDef.onTriggerExit}`);
                                this.taskExecutor.execute(varDef.onTriggerExit, {}, this.contextVars);
                            }
                        }
                    }
                }

                return true;
            },
            ownKeys: () => {
                const keys = new Set([
                    ...Object.keys(this.projectVariables),
                    ...Object.keys(this.stageVariables)
                ]);
                return Array.from(keys);
            },
            has: (_target, prop: string) => {
                return (prop in this.stageVariables) || (prop in this.projectVariables);
            },
            getOwnPropertyDescriptor: (_target, prop: string) => {
                const val = this.stageVariables[prop] !== undefined ? this.stageVariables[prop] : this.projectVariables[prop];
                if (val !== undefined) {
                    return { configurable: true, enumerable: true, value: val };
                }
                return undefined;
            }
        });
    }

    private setupBindings() {
        this.objects.forEach(obj => {
            Object.keys(obj).forEach(prop => {
                if (typeof obj[prop] === 'string' && obj[prop].includes('${')) this.reactiveRuntime.bind(obj, prop, obj[prop]);
                if (prop === 'style' && typeof obj[prop] === 'object' && obj[prop] !== null) {
                    Object.keys(obj[prop]).forEach(sp => {
                        if (typeof obj[prop][sp] === 'string' && obj[prop][sp].includes('${')) this.reactiveRuntime.bind(obj[prop], sp, obj[prop][sp]);
                    });
                }
            });
        });
    }


    private getPatternStartPosition(pattern: string, targetX: number, targetY: number, index: number, stage: any): { x: number; y: number } {
        const cols = stage.grid?.cols || stage.cols || 32, rows = stage.grid?.rows || stage.rows || 24, margin = 10;
        switch (pattern) {
            case 'UpLeft': return { x: -margin, y: -margin };
            case 'UpMiddle': return { x: cols / 2, y: -margin };
            case 'UpRight': return { x: cols + margin, y: -margin };
            case 'Left': return { x: -margin, y: targetY };
            case 'Right': return { x: cols + margin, y: targetY };
            case 'BottomLeft': return { x: -margin, y: rows + margin };
            case 'BottomMiddle': return { x: cols / 2, y: rows + margin };
            case 'BottomRight': return { x: cols + margin, y: rows + margin };
            case 'ChaosIn': { const a = Math.random() * Math.PI * 2, d = Math.max(cols, rows) + margin; return { x: cols / 2 + Math.cos(a) * d, y: rows / 2 + Math.sin(a) * d }; }
            case 'ChaosOut': return { x: cols / 2, y: rows / 2 };
            case 'Matrix': return { x: targetX, y: -margin - (index * 2) };
            default: return { x: targetX, y: targetY };
        }
    }
}
