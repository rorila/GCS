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
    private globalVars: Record<string, any>;
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
        this.globalVars = { ...options.initialGlobalVars };
        this.reactiveRuntime = new ReactiveRuntime();

        // Determine if we start with a specific stage or legacy objects
        const hasStages = project.stages && project.stages.length > 0;

        let activeStage = null;

        if (options.startStageId && hasStages) {
            // Context-Aware Start: Specific Stage requested
            activeStage = project.stages.find((s: any) => s.id === options.startStageId);
        } else {
            // Default Start (Full Game): Always try to start with Splash, then Main
            if (hasStages) {
                const splashStage = project.stages.find((s: any) => s.type === 'splash');
                if (splashStage) {
                    activeStage = splashStage;
                } else {
                    // No splash? Use Main or whatever is active
                    activeStage = project.stages.find((s: any) => s.id === project.activeStageId) || project.stages[0];
                }
            }
        }

        if (objects) {
            // Sandbox/Override mode
            this.objects = objects;
        } else if (activeStage) {
            this.stage = activeStage; // Set public property

            // New multi-stage system

            // If explicit start stage provided (and it's a sub-stage), we skip splash logic
            // UNLESS the start stage IS the splash stage.
            if (options.startStageId) {
                this.isSplashActive = activeStage.type === 'splash'; // Only true if we explicitly start IN splash
            } else {
                this.isSplashActive = activeStage.type === 'splash';
            }

            let loadedObjects = hydrateObjects(activeStage.objects || []);

            // INHERITANCE: If starting in a sub-stage, load 'main' stage objects (globals)
            // But only those that don't collide with local objects?
            // Requirement: "System-Komponenten... global sichtbar". 
            // So we treat 'main' as global provider.
            if (options.startStageId && activeStage.type !== 'splash' && activeStage.type !== 'main') {
                const mainStage = project.stages.find((s: any) => s.type === 'main');
                if (mainStage && mainStage.objects) {
                    const globalObjects = hydrateObjects(mainStage.objects);

                    // SYSTEM COMPONENTS ONLY: Only inherit non-visual system services
                    const systemClasses = [
                        'TGameLoop', 'TStageController', 'TGameState',
                        'THandshake', 'THeartbeat', 'TGameServer',
                        'TInputController', 'TDebugLog'
                    ];

                    const localIds = new Set(loadedObjects.map(o => o.id));

                    globalObjects.forEach(gObj => {
                        // Inherit if it's a system component AND doesn't exist locally
                        const isSystem = systemClasses.includes(gObj.className);
                        if (isSystem && !localIds.has(gObj.id)) {
                            // potential name check?
                            const nameCollision = loadedObjects.find(l => l.name === gObj.name);
                            if (!nameCollision) {
                                loadedObjects.push(gObj);
                            } else {
                                console.warn(`[GameRuntime] Global system object '${gObj.name}' skipped due to local name collision in stage '${activeStage.name}'`);
                            }
                        }
                    });
                    console.log(`[GameRuntime] Context-Aware Start: Loaded ${activeStage.name} + Global System Services from Main`);
                }
            }

            this.objects = loadedObjects;
        } else {
            // Legacy-Fallback (Splash -> Main)
            const hasLegacySplash = project.splashObjects && project.splashObjects.length > 0;
            if (hasLegacySplash) {
                this.isSplashActive = true;
                this.objects = hydrateObjects(project.splashObjects || []);
            } else {
                this.objects = hydrateObjects(project.objects || []);
            }
        }

        // Initialize reactive objects if requested
        if (options.makeReactive) {
            this.objects.forEach(obj => {
                this.reactiveRuntime.registerObject(obj.name, obj, true);
            });

            // Expose state
            this.reactiveRuntime.setVariable('isSplashActive', this.isSplashActive);

            // Expose multiplayer state as reactive variables
            const mp = options.multiplayerManager || (window as any).multiplayerManager;
            this.reactiveRuntime.setVariable('isMultiplayer', !!mp);
            if (mp) {
                this.reactiveRuntime.setVariable('playerNumber', mp.playerNumber || 1);
                this.reactiveRuntime.setVariable('isHost', mp.isHost !== undefined ? mp.isHost : (mp.playerNumber === 1));
            } else {
                this.reactiveRuntime.setVariable('playerNumber', 1);
                this.reactiveRuntime.setVariable('isHost', true);
            }

            // Update this.objects to be the proxies
            this.objects = this.reactiveRuntime.getObjects();
        }

        this.actionExecutor = new ActionExecutor(
            this.objects,
            options.multiplayerManager || (window as any).multiplayerManager,
            options.onNavigate
        );

        const mp = options.multiplayerManager || (window as any).multiplayerManager;

        // Initial Logic Merge: Combine Global and Stage-Local logic for TaskExecutor
        const stageTasks = (activeStage as any)?.tasks || [];
        const stageActions = (activeStage as any)?.actions || [];
        const stageFlowCharts = (activeStage as any)?.flowCharts || {};

        const mergedTasks = [...(project.tasks || []), ...stageTasks];
        const mergedActions = [...(project.actions || []), ...stageActions];
        const mergedFlowCharts = { ...(project.flowCharts || {}), ...stageFlowCharts };

        this.taskExecutor = new TaskExecutor(
            project,
            mergedActions,
            this.actionExecutor,
            mergedFlowCharts,
            mp,
            mergedTasks
        );

        // Wiring for remote task execution
        if (mp) {
            mp.onRemoteTask = (msg: any) => {
                this.executeRemoteTask(msg.taskName, msg.params);
            };
        }

        this.init();

        // Initialisiere TStageController für zentrale Stage-Verwaltung
        this.initStageController();

        // Notify host of initial stage (for background sync)
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
                const duration = this.project.splashDuration || 3000;
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

        // 1. ProjectRegistry aktualisieren (Context setzen)
        import('../services/ProjectRegistry').then(({ projectRegistry }) => {
            projectRegistry.setActiveStageId(newStageId);

            // 2. Hydrierung: Neue Objekte der Stage + Globale Services
            const combinedObjects = projectRegistry.getObjects();
            this.objects = hydrateObjects(combinedObjects);

            // 3. Stage-Referenz aktualisieren
            if (this.project.stages) {
                this.stage = this.project.stages.find((s: any) => s.id === newStageId);
            }

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
        });
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

    public handleEvent(objectId: string, eventName: string, data: any = {}) {
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
            this.taskExecutor.execute(taskName, vars, this.globalVars, obj, 0, undefined, data);

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
    public triggerRemoteEvent(objectId: string, eventName: string, params: any) {
        console.log(`[Runtime] Remote Event: ${objectId}.${eventName}`, params);
        this.handleEvent(objectId, eventName, params);
    }

    /**
     * Multiplayer: Executes an action from a remote peer
     */
    public executeRemoteAction(action: any) {
        console.log(`[Runtime] Remote Action:`, action);
        this.actionExecutor.execute(action, {}, this.globalVars);
    }

    /**
     * Multiplayer: Executes a task from a remote peer
     */
    public executeRemoteTask(taskName: string, params: any = {}, mode?: string) {
        console.log(`[Runtime] Remote Task: ${taskName}`, params, mode);
        const vars: Record<string, any> = {};
        if (this.project.variables) {
            this.project.variables.forEach((v: any) => vars[v.name] = this.reactiveRuntime.getVariable(v.name));
        }
        Object.assign(vars, this.globalVars, params || {});

        // Execute task with remote flag set to true
        this.taskExecutor.execute(taskName, vars, this.globalVars, null, 0, undefined, params, true);
    }

    /**
     * Returns all runtime objects
     */
    public getObjects(): any[] {
        return this.objects;
    }

    private init() {
        if (!this.options.makeReactive) {
            this.objects.forEach(obj => this.reactiveRuntime.registerObject(obj.name, obj, false));
        }
        if (this.project.variables) {
            this.project.variables.forEach((v: any) => {
                const val = this.globalVars[v.name] !== undefined ? this.globalVars[v.name] : v.defaultValue;
                this.reactiveRuntime.registerVariable(v.name, val);
            });
        }
        this.setupBindings();
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
