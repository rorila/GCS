import { Editor } from '../Editor';
import { GameRuntime } from '../../runtime/GameRuntime';
import { network } from '../../multiplayer';
import { AnimationManager } from '../../runtime/AnimationManager';
import { TGameLoop } from '../../components/TGameLoop';
import { TInputController } from '../../components/TInputController';
import { TTimer } from '../../components/TTimer';
import { TGameServer } from '../../components/TGameServer';
import { TWindow } from '../../components/TWindow';

export class EditorRunManager {
    public runtime: GameRuntime | null = null;
    public runtimeObjects: TWindow[] | null = null;
    public activeGameLoop: TGameLoop | null = null;
    public activeInputControllers: TInputController[] = [];
    public activeTimers: TTimer[] = [];
    public activeGameServers: TGameServer[] = [];
    private animationTickerId: number | null = null;

    constructor(private editor: Editor) { }

    public setRunMode(running: boolean) {
        this.editor.stage.runMode = running;
        this.editor.stage.updateBorder();

        if (running) {
            this.editor.selectObject(null);
            console.log("[RunManager] Starting Game Mode...");

            const mpManager = (this.editor as any)._isMultiplayer ? network : undefined;
            const activeStage = this.editor.getActiveStage();
            let startStageId: string | undefined;

            if (activeStage && activeStage.type !== 'main' && activeStage.type !== 'splash') {
                startStageId = activeStage.id;
            }

            (this.editor as any).syncStageObjectsToProject();

            this.runtime = new GameRuntime(this.editor.project, undefined, {
                onNavigate: () => this.editor.switchView('run'),
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

            if (this.editor.stage) {
                this.editor.stage.onEvent = (objectId: string, eventName: string) => {
                    if (this.runtime) this.runtime.handleEvent(objectId, eventName);
                };
            }

            if (!this.activeGameLoop) {
                this.startAnimationTicker();
            }

            this.initRuntimeComponents();

            if (this.runtime) this.runtime.start();
            this.editor.render();
        } else {
            this.stopRuntime();
            this.editor.render();
        }
    }

    private handleStageSwitch(stageId: string) {
        const targetStage = this.editor.project.stages?.find((s: any) => s.id === stageId);
        if (targetStage) {
            if (this.editor.stage) {
                this.editor.stage.grid = {
                    cols: targetStage.grid?.cols || 32,
                    rows: targetStage.grid?.rows || 24,
                    cellSize: targetStage.grid?.cellSize || 20,
                    snapToGrid: targetStage.grid?.snapToGrid ?? true,
                    visible: (this.editor.stage?.runMode) ? (targetStage.grid?.visible ?? false) : (targetStage.grid?.visible ?? true),
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
        if (this.runtime) {
            this.runtime.stop();
            this.runtime = null;
        }

        if (this.editor.stage) this.editor.stage.onEvent = null;

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

        if (this.editor.debugLog) {
            this.editor.debugLog.dispose();
            this.editor.debugLog = null;
        }
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
