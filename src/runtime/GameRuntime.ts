import { ReactiveRuntime } from './ReactiveRuntime';
import { ActionExecutor } from './ActionExecutor';
import { TaskExecutor } from './TaskExecutor';
import { AnimationManager } from './AnimationManager';

import { hydrateObjects } from '../utils/Serialization';
import { DebugLogService } from '../services/DebugLogService';


export interface RuntimeOptions {
    multiplayerManager?: any;
    onNavigate?: (target: string, params?: any) => void;
    initialGlobalVars?: Record<string, any>;
    makeReactive?: boolean;
    onRender?: () => void;
}

export class GameRuntime {
    private reactiveRuntime: ReactiveRuntime;
    private actionExecutor: ActionExecutor;
    private taskExecutor: TaskExecutor;
    private globalVars: Record<string, any>;
    private objects: any[];

    constructor(
        private project: any,
        objects?: any[],
        private options: RuntimeOptions = {}
    ) {
        this.globalVars = { ...options.initialGlobalVars };
        this.reactiveRuntime = new ReactiveRuntime();

        // Hydrate objects if not provided
        this.objects = objects || hydrateObjects(project.objects);

        // Initialize reactive objects if requested
        if (options.makeReactive) {
            this.objects.forEach(obj => {
                this.reactiveRuntime.registerObject(obj.name, obj, true);
            });

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
        this.taskExecutor = new TaskExecutor(
            project,
            project.actions || [],
            this.actionExecutor,
            project.flowCharts,  // Pass flowCharts dictionary
            mp  // For triggerMode handling
        );

        // Wiring for remote task execution (triggerMode)
        if (mp) {
            mp.onRemoteTask = (msg: any) => {
                this.executeRemoteTask(msg.taskName, msg.params, msg.mode);
            };
        }

        this.init();
    }


    public start() {

        // 1. Initial render (if a renderer is attached or manually)
        // For now, let the player handle the first render if needed, 
        // or we can add a render callback to options.

        // 2. Trigger onStart for all objects
        this.objects.forEach(obj => {
            this.handleEvent(obj.id, 'onStart');
        });

        // 2a. Trigger Stage Start Animation if configured
        const stageConfig = this.project.stage || this.project.grid;
        if (stageConfig && stageConfig.startAnimation && stageConfig.startAnimation !== 'none') {
            console.log(`[GameRuntime] Triggering start animation: ${stageConfig.startAnimation} `);

            // Animate all visual objects (not the Stage itself, and not invisible components)
            const invisibleClasses = ['TGameLoop', 'TInputController', 'TTimer', 'TGameState', 'THandshake', 'THeartbeat', 'TGameServer', 'TStage'];
            const visualObjects = this.objects.filter(o => !invisibleClasses.includes(o.className));
            console.log(`[GameRuntime] Found ${visualObjects.length} visual objects to animate.`);

            visualObjects.forEach((obj, index) => {
                if (typeof obj.moveTo === 'function') {
                    const targetX = obj.x;
                    const targetY = obj.y;
                    const duration = stageConfig.startAnimationDuration || 1000;
                    const easing = stageConfig.startAnimationEasing || 'easeOut';

                    const start = this.getPatternStartPosition(
                        stageConfig.startAnimation,
                        targetX,
                        targetY,
                        index,
                        stageConfig
                    );

                    console.log(`[GameRuntime] Animating ${obj.name || obj.id}: from(${start.x}, ${start.y}) to(${targetX}, ${targetY}) with opacity 0 -> 1`);

                    // Set to start position and hide
                    obj.x = start.x;
                    obj.y = start.y;
                    if (!obj.style) obj.style = {};
                    obj.style.opacity = 0;

                    // Animate position
                    obj.moveTo(targetX, targetY, duration, easing);

                    // Animate opacity (AnimationManager supports nested paths)
                    const am = AnimationManager.getInstance();
                    am.addTween(obj, 'style.opacity', 1, duration, easing);
                } else {
                    console.warn(`[GameRuntime] Object ${obj.name || obj.id} has no moveTo method!`);
                }
            });
        }

        // 3. Start Input Controllers
        const inputControllers = this.objects.filter(o => o.className === 'TInputController');
        inputControllers.forEach(ic => {
            // console.log(`[GameRuntime] Starting InputController: ${ ic.name } `);
            if (typeof ic.init === 'function') {
                ic.init(
                    this.objects,
                    (id: string, event: string, data: any) => this.handleEvent(id, event, data)
                );
            }
            if (typeof ic.start === 'function') ic.start();
        });

        // 4. Start Game Loop if found
        const gameLoop = this.objects.find(o => o.className === 'TGameLoop');
        if (gameLoop && typeof gameLoop.start === 'function') {
            // console.log(`[GameRuntime] Starting GameLoop: ${ gameLoop.name } `);
            if (typeof gameLoop.init === 'function') {
                gameLoop.init(
                    this.objects,
                    this.project.stage.grid,
                    this.options.onRender || (() => { }),
                    (id: string, event: string, data: any) => this.handleEvent(id, event, data)
                );
            }
            gameLoop.start();
        }

        // 5. Start Timers
        const timers = this.objects.filter(o => o.className === 'TTimer');
        timers.forEach(timer => {
            // Register onEvent callback for maxInterval event
            if ('onEvent' in timer) {
                timer.onEvent = (eventName: string) => {
                    this.handleEvent(timer.id, eventName);
                };
            }
            // console.log(`[GameRuntime] Starting Timer: ${ timer.name } `);
            if (typeof timer.start === 'function') {
                timer.start(() => {
                    this.handleEvent(timer.id, 'onTimer');
                });
            }
        });

        // 6. Start NumberLabels (Set event callback)
        const numberLabels = this.objects.filter(o => o.className === 'TNumberLabel');
        numberLabels.forEach(nl => {
            if ('onEvent' in nl) {
                nl.onEvent = (eventName: string) => {
                    this.handleEvent(nl.id, eventName);
                };
            }
        });

        // 7. Start Multiplayer Components (Handshake, Heartbeat, GameServer)
        const mp = this.options.multiplayerManager || (window as any).multiplayerManager;

        if (mp && typeof mp.on === 'function') {
            mp.on((msg: any) => {
                // THandshake dispatch
                const handshakes = this.objects.filter(o => o.className === 'THandshake');
                handshakes.forEach(hs => {
                    if (msg.type === 'room_joined') {
                        hs._setRoomInfo(msg.roomCode, msg.playerNumber, msg.playerNumber === 1);
                        hs._setStatus('waiting');
                        hs._fireEvent('onRoomJoined', msg);
                    } else if (msg.type === 'player_joined') {
                        hs._fireEvent('onPeerJoined', msg);
                    } else if (msg.type === 'game_start') {
                        hs._setStatus('playing');
                        hs._fireEvent('onGameStart', msg);
                    } else if (msg.type === 'room_created') {
                        hs._setRoomInfo(msg.roomCode, 1, true);
                        hs._setStatus('waiting');
                        hs._fireEvent('onRoomCreated', msg);
                    } else if (msg.type === 'player_left') {
                        hs._setStatus('waiting');
                        hs._fireEvent('onPeerLeft', msg);
                    }
                });

                // THeartbeat dispatch
                const heartbeats = this.objects.filter(o => o.className === 'THeartbeat');
                heartbeats.forEach(hb => {
                    if (msg.type === 'pong') {
                        hb._handlePong(msg.serverTime);
                    } else if (msg.type === 'player_timeout') {
                        hb._setConnectionLost();
                    }
                });
            });
        }

        // THandshake callbacks
        const handshakes = this.objects.filter(o => o.className === 'THandshake');
        handshakes.forEach(hs => {
            hs.onEvent = (eventName: string, data?: any) => {
                if (!mp) return;
                if (eventName === '_createRoom') mp.createRoom();
                else if (eventName === '_joinRoom') mp.joinRoom(data?.code);
                else if (eventName === '_ready') mp.ready();
                else this.handleEvent(hs.id, eventName, data);
            };
        });

        // THeartbeat callbacks
        const heartbeats = this.objects.filter(o => o.className === 'THeartbeat');
        heartbeats.forEach(hb => {
            hb.onEvent = (eventName: string, data?: any) => {
                if (!mp) return;
                if (eventName === '_start') {
                    hb._startTimer(() => mp.send({ type: 'ping', timestamp: Date.now() }));
                } else if (eventName === '_stop') {
                    hb._stopTimer();
                } else if (eventName === '_forcePing') {
                    mp.send({ type: 'ping', timestamp: Date.now() });
                } else this.handleEvent(hb.id, eventName, data);
            };
        });

        // TGameServer (Ensure event callback is set)
        const servers = this.objects.filter(o => o.className === 'TGameServer');
        servers.forEach(server => {
            if (typeof server.start === 'function') {
                server.start((eventName: string, data?: any) => {
                    this.handleEvent(server.id, eventName, data);
                });
            }
        });

        // 8. Handle existing state (for Player 2 who joins and then starts the project)
        // IMPORTANT: Must be AFTER onEvent handlers are set!
        if (mp && mp.roomCode) {
            const handshakes = this.objects.filter(o => o.className === 'THandshake');
            handshakes.forEach(hs => {
                console.log(`[GameRuntime] Restoring existing room state for ${hs.name}: ${mp.roomCode} `);
                hs._setRoomInfo(mp.roomCode, mp.playerNumber, mp.playerNumber === 1);
                hs._setStatus('waiting');
                // Trigger the joined event so the toast appears
                if (mp.playerNumber === 1) {
                    hs._fireEvent('onRoomCreated', { roomCode: mp.roomCode });
                } else {
                    hs._fireEvent('onRoomJoined', { roomCode: mp.roomCode, playerNumber: mp.playerNumber });
                }
            });
        }
    }

    public stop() {
        // 1. Stop Game Loop
        const gameLoop = this.objects.find(o => o.className === 'TGameLoop');
        if (gameLoop && typeof gameLoop.stop === 'function') {
            gameLoop.stop();
        }

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
    }

    public updateRemoteState(objectIdOrName: string, state: any) {
        const target = this.objects.find(o => o.id === objectIdOrName || o.name === objectIdOrName);
        if (!target) return;

        // console.log(`[Runtime] RECV remote_state for ${ target.name }(id: ${ target.id }) from P${ state.player || '?' }: `, state);

        // Apply state changes
        if (state.x !== undefined || state.y !== undefined) {
            if (typeof target.smoothSync === 'function') {
                target.smoothSync(state.x ?? target.x, state.y ?? target.y);
            } else {
                if (state.x !== undefined) target.x = state.x;
                if (state.y !== undefined) target.y = state.y;
            }
        }

        if (state.vx !== undefined) target.velocityX = state.vx;
        if (state.vy !== undefined) target.velocityY = state.vy;
        if (state.text !== undefined) target.text = state.text;
        if (state.value !== undefined) target.value = state.value;

        // Apply spritesMoving from remote GameState
        if (state.spritesMoving !== undefined) {
            target.spritesMoving = state.spritesMoving;
        }

        // Trigger onSyncState if defined
        this.handleEvent(target.id, 'onSyncState', {
            targetX: state.x,
            targetY: state.y,
            targetVX: state.vx,
            targetVY: state.vy,
            targetText: state.text,
            targetValue: state.value,
            syncedObject: target.name
        });
    }

    /**
     * Trigger an event on a remote object (called when receiving a remote_event message)
     */
    public triggerRemoteEvent(objectIdOrName: string, eventName: string, params?: any) {
        const target = this.objects.find(o => o.id === objectIdOrName || o.name === objectIdOrName);
        if (!target) {
            console.warn(`[Runtime] triggerRemoteEvent: Object not found: ${objectIdOrName} `);
            return;
        }

        console.log(`[Runtime] Triggering remote event: ${target.name}.${eventName} `);

        // Set a flag to prevent the task from sending another remote event (loop prevention)
        this.globalVars['isRemoteTriggered'] = 1;
        this.handleEvent(target.id, eventName, params || {});
        this.globalVars['isRemoteTriggered'] = 0;
    }

    /**
     * Execute an action received from another player
     */
    public executeRemoteAction(action: any) {
        const vars: Record<string, any> = {};
        if (this.project.variables) {
            this.project.variables.forEach((v: any) => {
                vars[v.name] = this.reactiveRuntime.getVariable(v.name);
            });
        }
        Object.assign(vars, this.globalVars);

        // Note: With triggerMode on Task-level, remote actions execute normally
        this.actionExecutor.execute(action, vars, this.globalVars, null, undefined);
    }

    /**
     * Executes a task received via network (triggerMode logic)
     */
    public executeRemoteTask(taskName: string, params?: any, mode?: 'broadcast' | 'sync') {
        console.log(`[Runtime] Executing remote task: ${taskName} (mode: ${mode})`);

        const vars: Record<string, any> = {};
        if (this.project.variables) {
            this.project.variables.forEach((v: any) => {
                vars[v.name] = this.reactiveRuntime.getVariable(v.name);
            });
        }
        Object.assign(vars, this.globalVars, params || {});

        // isRemoteExecution = true to prevent recursive triggers in TaskExecutor
        // Args: taskName, vars, globalVars, contextObj, depth, parentId, params, isRemoteExecution
        this.taskExecutor.execute(taskName, vars, this.globalVars, null, 0, undefined, params, true);
    }

    private init() {
        if (!this.options.makeReactive) {
            this.objects.forEach(obj => {
                this.reactiveRuntime.registerObject(obj.name, obj, false);
            });
        }

        if (this.project.variables) {
            this.project.variables.forEach((v: any) => {
                const initialValue = this.globalVars[v.name] !== undefined
                    ? this.globalVars[v.name]
                    : v.defaultValue;
                this.reactiveRuntime.registerVariable(v.name, initialValue);
            });
        }

        this.setupBindings();
    }

    private setupBindings() {
        this.objects.forEach(obj => {
            Object.keys(obj).forEach(prop => {
                const value = obj[prop];
                if (typeof value === 'string' && value.includes('${')) {
                    this.reactiveRuntime.bind(obj, prop, value);
                }

                if (prop === 'style' && typeof value === 'object' && value !== null) {
                    Object.keys(value).forEach(styleProp => {
                        const styleValue = value[styleProp];
                        if (typeof styleValue === 'string' && styleValue.includes('${')) {
                            this.reactiveRuntime.bind(value, styleProp, styleValue);
                        }
                    });
                }
            });
        });
    }

    handleEvent(objectId: string, eventName: string, data: any = {}) {

        let targets: any[] = [];
        if (objectId === 'global') {
            // Find all objects that have a task for this event
            targets = this.objects.filter(o => o.Tasks && o.Tasks[eventName]);
        } else {
            // Search by id first, then fallback to name for backwards compatibility
            const obj = this.objects.find(o => o.id === objectId || o.name === objectId);
            if (obj) {
                // console.log(`[GameRuntime] Found target object: ${obj.name} (id: ${obj.id}), Tasks:`, obj.Tasks);
                targets.push(obj);
            } else {
                console.warn(`[GameRuntime] No object found for objectId="${objectId}". Available objects:`, this.objects.map(o => ({ id: o.id, name: o.name })));
            }
        }



        // Original Task handling
        const taskTargets = targets.filter(o => o.Tasks && o.Tasks[eventName]);
        if (taskTargets.length === 0) {
            // Debug: log if we couldn't find targets for important events
            if (eventName === 'onBoundaryHit') {
                console.warn(`[GameRuntime] No targets found for ${eventName} on ${objectId}`);
            }
            return;
        }

        taskTargets.forEach(obj => {
            const taskName = obj.Tasks[eventName];
            if (!taskName) return;

            const vars: Record<string, any> = {};
            if (this.project.variables) {
                this.project.variables.forEach((v: any) => {
                    vars[v.name] = this.reactiveRuntime.getVariable(v.name);
                });
            }
            Object.assign(vars, this.globalVars);

            if (this.options.multiplayerManager) {
                const pNum = this.options.multiplayerManager.playerNumber;
                const inRoom = !!this.options.multiplayerManager.roomCode;

                if (inRoom) {
                    // Strictly use assigned player number if in a room
                    vars['isPlayer1'] = (pNum === 1) ? 1 : 0;
                    vars['isPlayer2'] = (pNum === 2) ? 1 : 0;
                } else {
                    // Outside room (standalone/lobby), default to P1
                    vars['isPlayer1'] = 1;
                    vars['isPlayer2'] = 0;
                }
            } else {
                vars['isPlayer1'] = 1;
                vars['isPlayer2'] = 0;
            }

            if (data) {
                Object.assign(vars, data);
            }

            // Debug: console.log(`[GameRuntime] Handling event "${eventName}" on ${obj.name}`);
            const eventLogId = DebugLogService.getInstance().log('Event', `${obj.name}.${eventName}`, {
                objectName: obj.name,
                eventName: eventName,
                data: data
            });

            this.taskExecutor.execute(taskName, vars, this.globalVars, obj, 0, eventLogId);

            // Sync back to reactive
            Object.keys(this.globalVars).forEach(name => {
                if (this.reactiveRuntime.getVariable(name) !== this.globalVars[name]) {
                    this.reactiveRuntime.setVariable(name, this.globalVars[name]);
                }
            });
        });
    }



    setVariable(name: string, value: any) {
        this.globalVars[name] = value;
        this.reactiveRuntime.setVariable(name, value);
    }

    getVariable(name: string): any {
        return this.globalVars[name] !== undefined
            ? this.globalVars[name]
            : this.reactiveRuntime.getVariable(name);
    }

    getObjects(): any[] {
        return this.objects;
    }

    getGlobalState(): Record<string, any> {
        return { ...this.globalVars };
    }

    /**
     * Berechnet die Startposition für ein Objekt basierend auf dem Fly-In Muster.
     */
    private getPatternStartPosition(
        pattern: string,
        targetX: number,
        targetY: number,
        index: number,
        stage: any
    ): { x: number; y: number } {
        // Use Grid units (not pixels) for everything!
        const cols = stage.grid?.cols || stage.cols || 32;
        const rows = stage.grid?.rows || stage.rows || 24;
        const outsideMargin = 10; // 10 grid cells outside for visible effect

        switch (pattern) {
            case 'UpLeft':
                return { x: -outsideMargin, y: -outsideMargin };
            case 'UpMiddle':
                return { x: cols / 2, y: -outsideMargin };
            case 'UpRight':
                return { x: cols + outsideMargin, y: -outsideMargin };
            case 'Left':
                return { x: -outsideMargin, y: targetY };
            case 'Right':
                return { x: cols + outsideMargin, y: targetY };
            case 'BottomLeft':
                return { x: -outsideMargin, y: rows + outsideMargin };
            case 'BottomMiddle':
                return { x: cols / 2, y: rows + outsideMargin };
            case 'BottomRight':
                return { x: cols + outsideMargin, y: rows + outsideMargin };
            case 'ChaosIn': {
                // Random position far outside the grid
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.max(cols, rows) + outsideMargin;
                return {
                    x: cols / 2 + Math.cos(angle) * distance,
                    y: rows / 2 + Math.sin(angle) * distance
                };
            }
            case 'ChaosOut':
                // All start in the middle of the grid
                return { x: cols / 2, y: rows / 2 };
            case 'Matrix':
                // Objects come from top, staggered by index
                return { x: targetX, y: -outsideMargin - (index * 2) };
            case 'Random': {
                // Pick a simple pattern
                const simplePatterns = ['UpLeft', 'UpMiddle', 'UpRight', 'Left', 'Right', 'BottomLeft', 'BottomMiddle', 'BottomRight'];
                const randomPattern = simplePatterns[Math.floor(Math.random() * simplePatterns.length)];
                return this.getPatternStartPosition(randomPattern, targetX, targetY, index, stage);
            }
            default:
                return { x: targetX, y: targetY }; // Fallback to target instead of (0,0)
        }
    }
}
