import { Logger } from '../../utils/Logger';
import type { GameRuntime } from '../GameRuntime';
import { AnimationManager } from '../AnimationManager';
import { GameLoopManager } from '../GameLoopManager';
import { DebugLogService } from '../../services/DebugLogService';
import { hydrateObjects } from '../../utils/Serialization';
import { TStageController } from '../../components/TStageController';
import { themeRegistry } from '../ThemeRegistry';
const logger = Logger.get('RuntimeStageService', 'Runtime_Execution');

export class RuntimeStageService {
    public applyActiveThemeStageStyle(runtime: GameRuntime): void {
            const stage = runtime.stage;
            if (!stage) return;
            const themeStage = themeRegistry.getStageStyle();
            if (!stage.grid) stage.grid = {} as any;
            if (!stage.grid.backgroundColor && !(stage as any).backgroundColor) {
                stage.grid.backgroundColor = themeStage.backgroundColor;
            }
            if (!(stage.grid as any).gridColor) {
                (stage.grid as any).gridColor = themeStage.gridColor;
            }
        }

    public initStageController(runtime: GameRuntime): void {
            runtime.stageController = runtime.objects.find(o => o.className === 'TStageController') as TStageController | null;
    
            if (!runtime.stageController) {
                logger.info('No TStageController found in project. Creating virtual controller for navigation support.');
                runtime.stageController = new TStageController('VirtualStageController', 0, 0);
                (runtime.stageController as any).isTransient = true; // Mark as non-serializable if possible
                runtime.objects.push(runtime.stageController);
            }
    
            if (runtime.stageController && runtime.project.stages) {
                runtime.stageController.setStages(runtime.project.stages);
                runtime.stageController.setOnStageChangeCallback((oldId, newId, _objects, reset) => runtime.handleStageChange(oldId, newId, reset));
            }
        }

    public switchToStage(runtime: GameRuntime, stageId: string): void {
            const currentId = runtime.stage ? runtime.stage.id : '';
            if (currentId !== stageId) {
                runtime.handleStageChange(currentId, stageId);
            }
        }

    public triggerStageStartEvents(runtime: GameRuntime) {
            if (!runtime.stage || !runtime.taskExecutor) return;
    
            // Blueprint Events als globalen Fallback holen
            const blueprintStage = runtime.project?.stages?.find((s: any) => s.type === 'blueprint');
            const globalEvents = blueprintStage ? (blueprintStage.events || blueprintStage.Tasks) : null;
            const localEvents = runtime.stage.events || runtime.stage.Tasks;
    
            const onEnterTask = localEvents?.onEnter || globalEvents?.onEnter;
            if (onEnterTask) {
                logger.warn(`🚀🚀🚀 ON_ENTER WIRD AUSGEFÜHRT! Stage: ${runtime.stage.name || runtime.stage.id}, Task: ${onEnterTask}`);
                logger.warn(`🚀🚀🚀 Triggering onEnter for stage: ${runtime.stage.id} (Task: ${onEnterTask})`);
                const enterLogId = DebugLogService.getInstance().log('Event', `Triggered: ${runtime.stage.name || runtime.stage.id}.onEnter`, {
                    objectName: runtime.stage.name || runtime.stage.id,
                    eventName: 'onEnter'
                });
                DebugLogService.getInstance().log('System', `🚀 EXECUTING onEnter TASK: ${onEnterTask}`, { objectName: runtime.stage.name || runtime.stage.id });
                
                try {
                    runtime.taskExecutor.execute(onEnterTask, { sender: runtime.stage }, runtime.contextVars, runtime.stage, 0, enterLogId);
                } catch (e) {
                    logger.error(`Error executing onEnter for stage ${runtime.stage.id}:`, e);
                }
            }
    
            const onRuntimeStartTask = localEvents?.onRuntimeStart || globalEvents?.onRuntimeStart;
            if (onRuntimeStartTask) {
                logger.debug(`Triggering onRuntimeStart for stage: ${runtime.stage.id} (Task: ${onRuntimeStartTask})`);
                const startLogId = DebugLogService.getInstance().log('Event', `Triggered: ${runtime.stage.name || runtime.stage.id}.onRuntimeStart`, {
                    objectName: runtime.stage.name || runtime.stage.id,
                    eventName: 'onRuntimeStart'
                });
                try {
                    runtime.taskExecutor.execute(onRuntimeStartTask, { sender: runtime.stage }, runtime.contextVars, runtime.stage, 0, startLogId);
                } catch (e) {
                    logger.error(`Error executing onRuntimeStart for stage ${runtime.stage.id}:`, e);
                }
            }
            // KEIN weiterer triggerStartAnimation()-Aufruf hier!
            // runtime.start() → initMainGame() löst die Animation bereits aus.
            // Ein doppelter Aufruf verdoppelt den Off-Screen-Offset und
            // die Objekte landen weit außerhalb der Bühne (siehe DEVELOPER_GUIDELINES:
            // "DO NOT duplicate animation triggers in initialization routines").
        }

    public legacyStageSwitch(runtime: GameRuntime): void {
            const mainStage = runtime.project.stages?.find((s: any) => s.type === 'main');
            if (mainStage) runtime.handleStageChange('splash', mainStage.id);
            else {
                runtime.objects = hydrateObjects(runtime.project.objects || []);
                runtime.start();
            }
        }

    public finishSplash(runtime: GameRuntime) {
            if (!runtime.isSplashActive) return;
            if (runtime.splashTimerId) { clearTimeout(runtime.splashTimerId); runtime.splashTimerId = null; }
            runtime.isSplashActive = false;
            if (runtime.stageController) runtime.stageController.goToMainStage();
            else this.legacyStageSwitch(runtime);
        }

    public updateRuntimeData(runtime: GameRuntime, project: any) {
            runtime.project = project;
    
            // 1. Sync TaskExecutor (Flows, Actions, Tasks)
            if (runtime.taskExecutor) {
                logger.info('Updating runtime data (FlowCharts, Actions, Tasks)');
                const stageId = runtime.stage?.id || runtime.project.activeStageId;
                const merged = runtime.stageManager.getMergedStageData(stageId);
    
                runtime.taskExecutor.setFlowCharts(merged.flowCharts);
                runtime.taskExecutor.setActions(merged.actions);
                runtime.taskExecutor.setTasks(merged.tasks || []);
    
                // 2. LIVE SYNC: Update Object Styles & Design Properties
                // We iterate over the current runtime objects and find their counterparts in the new project data.
                // This allows changing color/size/position in the Inspector while the game is running.
                runtime.objects.forEach(obj => {
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
                if (runtime.options.onRender) runtime.options.onRender();
            }
        }

    public handleStageChange(runtime: GameRuntime, _oldStageId: string, newStageId: string, reset: boolean = false): void {
            // 1. BEFORE Stage Change: Cleanup current stage state
    
            // 1.1 Trigger onLeave on the OLD stage
            if (runtime.stage && runtime.taskExecutor) {
                const onLeaveTask = (runtime.stage.events || runtime.stage.Tasks)?.onLeave;
                if (onLeaveTask) {
                    try {
                        runtime.taskExecutor.execute(onLeaveTask, { sender: runtime.stage }, runtime.contextVars, runtime.stage);
                    } catch (e) {
                        logger.error(`Error executing onLeave for stage ${runtime.stage.id}:`, e);
                    }
                }
            }
    
            // 1.2 STOP ALL current objects BEFORE they are replaced
            // This ensures TTimer, TInputController etc. can clean up their intervals and listeners.
            runtime.objects.forEach(obj => {
                try {
                    if (typeof obj.onRuntimeStop === 'function') obj.onRuntimeStop();
                } catch (e) {
                    logger.error(`Error during onRuntimeStop for object ${obj.id}:`, e);
                }
            });
    
            // 1.3 Clear shared runtime state
            runtime.clearAllTimers(); // Variable timers
            AnimationManager.getInstance().clear();
    
            // 1.3b GameLoopManager explizit stoppen (cancelAnimationFrame)
            GameLoopManager.getInstance().stop();
    
            // 1.4 Reset: Stage-Cache leeren, damit Objekte neu hydratisiert werden
            if (reset) {
                runtime.stageManager.clearCache();
                runtime.spritePool.destroy();
                logger.info(`[handleStageChange] Reset angefordert: Stage-Cache geleert fuer Stage ${newStageId}`);
            }
    
            // 2. SWITCH to new stage data
            runtime.stage = runtime.project.stages?.find((s: any) => s.id === newStageId);
            if (!runtime.stage) return;
    
            // Aktuelles Verhalten: Merged objects verwenden
            const merged = runtime.stageManager.getMergedStageData(newStageId);
            runtime.objects = merged.objects;
    
            if (runtime.taskExecutor) {
                const merged = runtime.stageManager.getMergedStageData(newStageId);
                runtime.taskExecutor.setFlowCharts(merged.flowCharts);
                runtime.taskExecutor.setTasks(merged.tasks);
                runtime.taskExecutor.setActions(merged.actions);
            }
    
            const gridConfig = (runtime.stage && runtime.stage.grid) || runtime.project.stage?.grid || runtime.project.grid;
            const runtimeCallbacks = {
                handleEvent: (id: string, ev: string, data?: any) => runtime.handleEvent(id, ev, data),
                render: runtime.options.onRender || (() => { }),
                gridConfig,
                objects: runtime.objects,
                contextVars: runtime.contextVars,
                addObject: (obj: any) => {
                    runtime.objects.push(obj);
                    if (runtime.reactiveRuntime && obj.name) {
                        runtime.reactiveRuntime.registerObject(obj.name, obj, true);
                    }
                },
                removeObject: (id: string) => {
                    const idx = runtime.objects.findIndex((o: any) => o.id === id);
                    if (idx >= 0) runtime.objects.splice(idx, 1);
                }
            };
    
            runtime.objects.forEach(obj => {
                obj.initRuntime?.(runtimeCallbacks);
            });
    
    
            // 3. RE-INITIALIZE runtime state for new stage
            if (runtime.options.makeReactive) {
                runtime.reactiveRuntime.clear(false); // DO NOT CLEAR VARIABLES! Keep the data state.
    
                // Register ALL objects including global variables.
                // First PASS: Register variables and systemic data objects FIRST
                runtime.objects.forEach(obj => {
                    if ((obj as any).isVariable || obj.className === 'TStringMap' || obj.className?.includes('Variable') || obj.className === 'TTheme') {
                        runtime.reactiveRuntime.registerObject(obj.name, obj, true);
                    }
                });
    
                // Second PASS: Register UI components now that globals are safe
                runtime.objects.forEach(obj => {
                    const isData = (obj as any).isVariable || obj.className === 'TStringMap' || obj.className?.includes('Variable') || obj.className === 'TTheme';
                    if (!isData) {
                        runtime.reactiveRuntime.registerObject(obj.name, obj, true);
                    }
                });
                if (runtime.stage) {
                    runtime.stage = runtime.reactiveRuntime.registerObject(runtime.stage.name || 'main', runtime.stage, true);
                }
                runtime.reactiveRuntime.setVariable('isSplashActive', false);
    
                runtime.objects = runtime.reactiveRuntime.getObjects();
    
                // FIXED ORDER: Initialize stage variables BEFORE reactive bindings 
                // so contextVars is populated with stage variables for interpolation binding.
                runtime.variableManager.stageVariables = {};
                runtime.variableManager.initializeStageVariables(runtime.stage);
                runtime.variableManager.importVariablesFromObjects(runtime.objects);
    
                runtime.reactiveService.initializeReactiveBindings(runtime);
            }
    
            // 3.5 OBJECT POOL für Stage-Reset neu aufbauen
            if (reset) {
                runtime.objectService.initSpritePools(runtime);
            }
    
            // 4. SYNC and START
            if (runtime.actionExecutor) {
                runtime.actionExecutor.setObjects(runtime.objects);
            }
    
            runtime.reactiveService.syncVariableComponents(runtime);
            this.initStageController(runtime);
            
            if (runtime.stageController && runtime.stage) {
                runtime.stageController.setCurrentStageId(runtime.stage.id);
            }
    
            // Stage-Wechsel: direkt initMainGame() aufrufen (start() wuerde wegen isMainGameStarted abbrechen)
            runtime.objects.forEach(obj => runtime.handleEvent(obj.id, 'onStart'));
    
            // InputHandler neu initialisieren: alte Keyboard-Listener entfernen, neue registrieren
            runtime.inputHandler.init();
        }
}
