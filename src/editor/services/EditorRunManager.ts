import { Editor } from '../Editor';
import { Stage } from '../Stage';
import { GameRuntime } from '../../runtime/GameRuntime';
import { network } from '../../multiplayer';
import { AnimationManager } from '../../runtime/AnimationManager';
import { TGameLoop } from '../../components/TGameLoop';
import { TInputController } from '../../components/TInputController';
import { TTimer } from '../../components/TTimer';
import { TGameServer } from '../../components/TGameServer';
import { TWindow } from '../../components/TWindow';
import { mediatorService } from '../../services/MediatorService';
import { DebugLogService } from '../../services/DebugLogService';
import { Logger } from '../../utils/Logger';

const logger = Logger.get('RunManager', 'Runtime_Execution');

export class EditorRunManager {
    public runtime: GameRuntime | null = null;
    public runtimeObjects: TWindow[] | null = null;
    public activeGameLoop: TGameLoop | null = null;
    public activeInputControllers: TInputController[] = [];
    public activeTimers: TTimer[] = [];
    public activeGameServers: TGameServer[] = [];
    private animationTickerId: number | null = null;
    public runStage: any | null = null;

    constructor(private editor: Editor) {
        // Listen for data changes to update runtime
        mediatorService.on('DATA_CHANGED', (payload: any) => {
            if (this.runtime && payload && payload.originator !== 'Runtime') {
                // Nur aktualisieren, wenn Änderung NICHT von der Runtime selbst kam (z.B. Variable gesetzt)
                // Um Endlos-Schleifen zu vermeiden.
                // Änderungen im Editor (FlowEditor, Inspector) sollen in die Runtime fließen.
                this.runtime.updateRuntimeData(this.editor.project);
            }
        });
    }

    public setRunMode(running: boolean) {
        if (this.editor.stage.runMode === running) {
            return;
        }

        this.editor.stage.runMode = running;
        this.editor.stage.updateBorder();

        // EARLY event handler assignment to prevent "missing handler" errors during first render
        // Note: Stage events are now permanently routed to the runtime via EditorInteractionManager 
        // when runMode is true. No need to reassign or nullify them here.

        if (running) {
            this.editor.selectObject(null);
            logger.info("Starting Game Mode...");
            DebugLogService.getInstance().setEnabled(true);

            const mpManager = (this.editor as any)._isMultiplayer ? network : undefined;
            const activeStage = this.editor.getActiveStage();
            let startStageId: string | undefined;

            if (activeStage && activeStage.type !== 'main' && activeStage.type !== 'splash') {
                startStageId = activeStage.id;
            }

            // Create Run-Mode stage instance
            if (!this.runStage) {
                this.runStage = new Stage('run-stage', activeStage?.grid || this.editor.project.stage.grid);
                this.runStage.runMode = true;

                // Register event callbacks for the new run stage!
                if ((this.editor as any).interactionManager) {
                    (this.editor as any).interactionManager.initCallbacks(this.runStage);
                }
            }

            (this.editor as any).syncStageObjectsToProject();
            if ((this.editor as any).flowEditor) {
                (this.editor as any).flowEditor.syncAllTasksFromFlow(this.editor.project);
            }

            this.runtime = new GameRuntime(this.editor.project, undefined, {
                onNavigate: (target: string, _params?: any) => {
                    // target format: "stage:stageId" or just "stageId"
                    let stageId = target;
                    if (target.startsWith('stage:')) {
                        stageId = target.substring(6);
                    }

                    if (stageId && this.editor.project.stages?.some(s => s.id === stageId)) {
                        console.log(`[RunManager] Navigating to stage: ${stageId}`);

                        // 1. Tell the RUNTIME to switch stage (preserves global variables)
                        if (this.runtime) {
                            const currentStageId = (this.runtime as any).stage?.id || '';
                            logger.info(`Runtime stage switch: ${currentStageId} → ${stageId}`);
                            (this.runtime as any).handleStageChange(currentStageId, stageId);

                            // Update runtime objects and components after stage change
                            this.runtimeObjects = this.runtime.getObjects();
                            this.initRuntimeComponents();
                        }

                        // 2. Update grid/visual properties for the new stage
                        //    DO NOT call switchStage() — it asynchronously exits run mode,
                        //    destroying the runtime context and losing all global variables.
                        this.handleStageSwitch(stageId);

                        // 3. Start the new stage and render with the runtime's full objects
                        if (this.runtime) this.runtime.start();
                        this.editor.render();
                    }
                    // DO NOT call switchView('run') here — we are already in run mode.
                },
                makeReactive: true,
                multiplayerManager: mpManager,
                onRender: () => this.editor.render(),
                startStageId: startStageId,
                onStageSwitch: (stageId: string) => this.handleStageSwitch(stageId)
            });

            if (this.runtime) {
                this.runtimeObjects = this.runtime.getObjects();
                this.activeGameLoop = (this.runtimeObjects.find((o: any) => o.className === 'TGameLoop') as TGameLoop) || null;
            }

            // Event handler already set above

            if (!this.activeGameLoop) {
                this.startAnimationTicker();
            }

            this.initRuntimeComponents();

            if (this.runtime) this.runtime.start();
            this.editor.render();
        } else {
            this.stopRuntime();
            if (this.runStage) {
                this.runStage.element.remove();
                this.runStage = null;
            }
            this.editor.render();
        }
    }

    private handleStageSwitch(stageId: string) {
        const targetStage = this.editor.project.stages?.find((s: any) => s.id === stageId);
        if (targetStage) {
            if (this.runStage) {
                this.runStage.grid = {
                    cols: targetStage.grid?.cols || 64,
                    rows: targetStage.grid?.rows || 40,
                    cellSize: targetStage.grid?.cellSize || 20,
                    snapToGrid: targetStage.grid?.snapToGrid ?? true,
                    visible: targetStage.grid?.visible ?? false,
                    backgroundColor: targetStage.grid?.backgroundColor || '#1e1e1e'
                };
            }

            if (this.runtime) {
                this.runtimeObjects = this.runtime.getObjects();
                this.activeGameLoop = (this.runtimeObjects.find((o: any) => o.className === 'TGameLoop') as any) || null;
                if (this.activeGameLoop) this.stopAnimationTicker();
                this.editor.render();
            }
        }
    }

    private initRuntimeComponents() {
        if (!this.runtimeObjects) return;

        // Timers
        this.activeTimers = this.runtimeObjects.filter(obj => (obj as any).className === 'TTimer') as any[];
        this.activeTimers.forEach(timer => {
            if (timer && 'onEvent' in timer) {
                (timer as any).onEvent = (eventName: string) => {
                    this.handleRuntimeEvent(timer.id, eventName);
                };
            }
            if (timer && typeof timer.start === 'function') {
                timer.start(() => this.handleRuntimeEvent(timer.id, 'onTimer'));
            }
        });

        // NumberLabels
        const numberLabels = this.runtimeObjects.filter(obj => (obj as any).className === 'TNumberLabel');
        numberLabels.forEach(nl => {
            if (nl && 'onEvent' in nl) {
                (nl as any).onEvent = (eventName: string) => this.handleRuntimeEvent(nl.id, eventName);
            }
        });

        // GameServers
        this.activeGameServers = this.runtimeObjects.filter(obj => (obj as any).className === 'TGameServer') as any[];
        this.activeGameServers.forEach(server => {
            if (server && typeof server.start === 'function') {
                server.start((eventName: string, data: any) => {
                    if (this.runtime) this.runtime.handleEvent(server.id, eventName, data);
                    this.editor.render();
                });
            }
        });
    }

    private stopRuntime() {
        DebugLogService.getInstance().setEnabled(false);
        if (this.runtime) {
            this.runtime.stop();
            this.runtime = null;
        }

        if (this.activeGameLoop && typeof (this.activeGameLoop as any).stop === 'function') {
            (this.activeGameLoop as any).stop();
        }

        this.activeInputControllers.forEach(ic => (ic as any).stop?.());
        this.activeTimers.forEach(timer => (timer as any).stop?.());
        this.activeGameServers.forEach(server => (server as any).stop?.());

        this.activeGameLoop = null;
        this.activeInputControllers = [];
        this.activeTimers = [];
        this.activeGameServers = [];
        this.runtimeObjects = null;
        this.stopAnimationTicker();
    }

    private handleRuntimeEvent(id: string, eventName: string, data?: any) {
        if (this.runtime) {
            this.runtime.handleEvent(id, eventName, data);
            this.editor.render();
        }
    }

    public startAnimationTicker() {
        if (this.animationTickerId) return;
        const tick = () => {
            if (!this.editor.stage || !this.editor.stage.runMode) {
                this.stopAnimationTicker();
                return;
            }

            if (this.activeGameLoop) {
                this.stopAnimationTicker();
                return;
            }

            AnimationManager.getInstance().update();
            const hasTweens = AnimationManager.getInstance().hasActiveTweens();
            if (hasTweens || !(this as any).firstRunRenderDone) {
                this.editor.render();
                if (!hasTweens) (this as any).firstRunRenderDone = true;
            }
            this.animationTickerId = requestAnimationFrame(tick);
        };
        this.animationTickerId = requestAnimationFrame(tick);
    }

    public stopAnimationTicker() {
        if (this.animationTickerId) {
            cancelAnimationFrame(this.animationTickerId);
            this.animationTickerId = null;
        }
    }
}
