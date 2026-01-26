import { ReactiveRuntime } from './ReactiveRuntime';
import { ActionExecutor } from './ActionExecutor';
import { TaskExecutor } from './TaskExecutor';
import { AnimationManager } from './AnimationManager';
import { GameLoopManager } from './GameLoopManager';
import { RuntimeVariableManager, IVariableHost } from './RuntimeVariableManager';
import { RuntimeStageManager } from './RuntimeStageManager';

import { hydrateObjects } from '../utils/Serialization';
import { TStageController } from '../components/TStageController';

export interface RuntimeOptions {
    multiplayerManager?: any;
    onNavigate?: (target: string, params?: any) => void;
    initialGlobalVars?: Record<string, any>;
    makeReactive?: boolean;
    onRender?: () => void;
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
    private isSplashActive: boolean = false;
    private splashTimerId: any = null;
    public stage: any = null;
    private stageController: TStageController | null = null;
    private varTimers: Map<string, any> = new Map();

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

                // Register global render listener
                if (options.onRender) {
                    this.reactiveRuntime.getWatcher().addGlobalListener(() => options.onRender!());
                }

                this.objects = this.reactiveRuntime.getObjects();
                this.initializeReactiveBindings();
            }

            this.actionExecutor = new ActionExecutor(this.objects, options.multiplayerManager, options.onNavigate);
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

    public stop() {
        if (this.splashTimerId) { clearTimeout(this.splashTimerId); this.splashTimerId = null; }
        this.objects.forEach(obj => obj.onRuntimeStop?.());
        GameLoopManager.getInstance().stop();
        AnimationManager.getInstance().clear();
    }

    public start() {
        if (this.options.onRender) this.options.onRender();
        this.objects.forEach(obj => this.handleEvent(obj.id, 'onStart'));

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
        let stageConfig = this.stage || this.project.stage || this.project.grid;
        if (stageConfig?.startAnimation && stageConfig.startAnimation !== 'none') {
            this.triggerStartAnimation(stageConfig);
        }

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

        this.initMultiplayer();

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
        if (this.stageController && this.project.stages) {
            this.stageController.setStages(this.project.stages);
            this.stageController.setOnStageChangeCallback((oldId, newId) => this.handleStageChange(oldId, newId));
        }
    }

    private handleStageChange(_oldStageId: string, newStageId: string): void {
        this.stage = this.project.stages?.find((s: any) => s.id === newStageId);
        if (!this.stage) return;

        const merged = this.stageManager.getMergedStageData(newStageId);
        this.objects = merged.objects;

        if (this.taskExecutor) {
            this.taskExecutor.setFlowCharts(merged.flowCharts);
            this.taskExecutor.setTasks(merged.tasks);
            this.taskExecutor.setActions(merged.actions);
        }

        if (this.options.makeReactive) {
            this.reactiveRuntime.clear();
            this.clearAllTimers();
            AnimationManager.getInstance().clear();
            this.objects.forEach(obj => this.reactiveRuntime.registerObject(obj.name, obj, true));
            this.reactiveRuntime.setVariable('isSplashActive', false);

            // Re-register global render listener after clear
            if (this.options.onRender) {
                this.reactiveRuntime.getWatcher().addGlobalListener(() => this.options.onRender!());
            }

            this.objects = this.reactiveRuntime.getObjects();
            this.initializeReactiveBindings();
        }

        this.variableManager.stageVariables = {};
        if (this.stage.variables) {
            this.stage.variables.forEach((v: any) => {
                this.variableManager.stageVariables[v.name] = v.defaultValue;
            });
        }

        this.actionExecutor.setObjects(this.objects);
        this.initStageController();
        this.start();
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
        let animationType = stageConfig.startAnimation || 'fade-in';
        let duration = stageConfig.startAnimationDuration || 1000;

        this.objects.forEach(obj => {
            if (obj.visible !== false) {
                if (animationType === 'fade-in') {
                    const originalOpacity = obj.opacity !== undefined ? obj.opacity : 1;
                    obj.opacity = 0;
                    AnimationManager.getInstance().animate(obj, { opacity: originalOpacity }, duration);
                } else if (animationType === 'slide-up') {
                    const originalY = obj.y;
                    obj.y += 100;
                    AnimationManager.getInstance().animate(obj, { y: originalY }, duration);
                }
            }
        });
    }

    public handleEvent(objectId: string, eventName: string, data: any = {}) {
        const obj = this.objects.find(o => o.id === objectId);
        if (!obj) return;

        if (obj.onEvent) {
            const actions = obj.onEvent[eventName];
            if (actions) {
                this.actionExecutor.execute(actions, {
                    vars: this.contextVars,
                    contextVars: this.contextVars,
                    eventData: data
                });
            }
        }

        if (this.taskExecutor) {
            const taskName = `${obj.name}.${eventName}`;
            this.taskExecutor.execute(taskName, { ...data, sender: obj }, this.contextVars);
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

        // Add all objects to context
        this.objects.forEach(obj => {
            context[obj.name] = obj;
            context[obj.id] = obj;
        });

        // Add variables
        Object.assign(context, this.contextVars);

        return context;
    }

    public getObjects(): any[] {
        const results: any[] = [];
        const process = (objs: any[], parentX = 0, parentY = 0, parentZ = 0) => {
            objs.forEach(obj => {
                if (obj.visible === false) return;
                const absoluteX = parentX + (obj.x || 0);
                const absoluteY = parentY + (obj.y || 0);
                const absoluteZ = parentZ + (obj.zIndex || 0);
                results.push({ ...obj, x: absoluteX, y: absoluteY, zIndex: absoluteZ });
                if (obj.children && obj.children.length > 0) {
                    process(obj.children, absoluteX, absoluteY, absoluteZ);
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
                    this.taskExecutor.execute(varDef.onTimerEnd, {}, this.contextVars);
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
        console.log(`[GameRuntime] Initializing reactive bindings for ${this.objects.length} objects.`);

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
                    console.log(`[GameRuntime] Binding reaktiv: ${obj.name}.${propPath} ← ${val}`);
                    this.reactiveRuntime.bindComponent(obj, propPath, val);
                } else if (val && typeof val === 'object' && !Array.isArray(val) && (key === 'style' || key === 'Tasks')) {
                    // Recursive binding for nested objects like style
                    bindProps(val, propPath);
                }
            });
        };

        bindProps(obj);
    }
}
