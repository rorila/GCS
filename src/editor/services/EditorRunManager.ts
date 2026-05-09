import { Editor } from '../Editor';
import { Stage } from '../Stage';
import { GameRuntime } from '../../runtime/GameRuntime';
import { network } from '../../multiplayer';
import { AnimationManager } from '../../runtime/AnimationManager';
import { TGameLoop } from '../../components/TGameLoop';
import { TInputController } from '../../components/TInputController';
import { TTimer } from '../../components/TTimer';
import { TGameServer } from '../../components/TGameServer';
import { GameLoopManager } from '../../runtime/GameLoopManager';
import { TWindow } from '../../components/TWindow';
import { mediatorService } from '../../services/MediatorService';
import { DebugLogService } from '../../services/DebugLogService';
import { Logger } from '../../utils/Logger';
import { safeDeepCopy } from '../../utils/DeepCopy';
import { NotificationToast } from '../ui/NotificationToast';

const logger = Logger.get('Editor', 'RunManager');

export class EditorRunManager {
    public runtime: GameRuntime | null = null;
    public runtimeObjects: TWindow[] | null = null;
    public activeGameLoop: TGameLoop | null = null;
    public activeInputControllers: TInputController[] = [];
    public activeTimers: TTimer[] = [];
    public activeGameServers: TGameServer[] = [];
    private animationTickerId: number | null = null;
    public runStage: any | null = null;
    public isGameStarted: boolean = false;
    public isGamePaused: boolean = false;


    constructor(private editor: Editor) {
        // Listen for data changes to update runtime
        mediatorService.on('DATA_CHANGED', (payload: any) => {
            if (this.runtime && payload && payload.originator !== 'Runtime') {
                // Nur aktualisieren, wenn Änderung NICHT von der Runtime selbst kam (z.B. Variable gesetzt)
                // Um Endlos-Schleifen zu vermeiden.
                // Änderungen im Editor (FlowEditor, Inspector) sollen in die Runtime fließen.
                // WICHTIG: DeepCopy um double-hydration beim Live-Sync zu verhindern!
                this.runtime.updateRuntimeData(safeDeepCopy(this.editor.project));
            }
        });
    }

    public setRunMode(running: boolean) {
        if (running) {
            // ...
        }

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
            logger.info(`%c══════════════════════════════════════════════════`, 'color: #00ff00');
            logger.info(`%c[RUN-DIAG] Starting Game Mode...`, 'color: #00ff00; font-weight: bold');
            logger.info(`%c[RUN-DIAG] location.protocol=${window.location.protocol} origin=${window.location.origin} href=${window.location.href}`, 'color: #00ff00');
            logger.info(`%c══════════════════════════════════════════════════`, 'color: #00ff00');

            const mpManager = (this.editor as any)._isMultiplayer ? network : undefined;
            const activeStage = this.editor.getActiveStage();
            let startStageId: string | undefined;

            if (activeStage && activeStage.type !== 'main' && activeStage.type !== 'splash') {
                startStageId = activeStage.id;
            }

            // Create Run-Mode stage instance
            if (!this.runStage) {
                // Ensure the run-stage container exists in the DOM (may be missing after HMR)
                let runStageEl = document.getElementById('run-stage');
                if (!runStageEl) {
                    runStageEl = document.createElement('div');
                    runStageEl.id = 'run-stage';
                    runStageEl.style.display = 'none';
                    const viewContent = document.getElementById('view-content');
                    if (viewContent) {
                        viewContent.appendChild(runStageEl);
                    } else {
                        document.body.appendChild(runStageEl);
                    }
                    logger.warn('run-stage element was missing, created dynamically');
                }
                this.runStage = new Stage('run-stage', activeStage?.grid || this.editor.project.stage.grid);
                this.runStage.runMode = true;
                // HINWEIS: runStage.runtime wird NACH der GameRuntime-Erstellung gesetzt (unten)!
                // An dieser Stelle wäre this.runtime noch null.

                // Register event callbacks for the new run stage!
                if ((this.editor as any).interactionManager) {
                    (this.editor as any).interactionManager.initCallbacks(this.runStage);
                }
            }

            (this.editor as any).syncStageObjectsToProject();
            if ((this.editor as any).flowEditor) {
                (this.editor as any).flowEditor.syncAllTasksFromFlow(this.editor.project);
            }

            // No step 3 logs

            const projectClone = safeDeepCopy(this.editor.project);
            this.runtime = new GameRuntime(projectClone, undefined, {
                onNavigate: (target: string, _params?: any) => {
                    // target format: "stage:stageId" or just "stageId"
                    let stageId = target;
                    if (target.startsWith('stage:')) {
                        stageId = target.substring(6);
                    }

                    if (stageId && this.editor.project.stages?.some(s => s.id === stageId)) {
                        logger.info(`[RunManager] Navigating to stage: ${stageId}`);

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
                onComponentUpdate: (obj: any) => {
                    const activeStage = this.runStage || this.editor.stage;
                    if (activeStage && activeStage.renderer && typeof activeStage.renderer.updateSingleObject === 'function') {
                        activeStage.renderer.updateSingleObject(obj);
                    }
                },
                onSpriteRender: (sprites: any[]) => this.renderSpritesOnly(sprites),
                startStageId: startStageId,
                onStageSwitch: (stageId: string) => this.handleStageSwitch(stageId)
            });

            if (this.runtime) {
                this.runtimeObjects = this.runtime.getObjects();
                this.activeGameLoop = (this.runtimeObjects.find((o: any) => o.className === 'TGameLoop') as TGameLoop) || null;
                // KRITISCH: runtime-Referenz auf runStage NACH der GameRuntime-
                // Erstellung setzen, nicht davor! Früher war this.runtime hier noch null.
                // ctx.host.runtime in ComplexComponentRenderer braucht diese Referenz
                // um getRawObject() korrekt aufzurufen.
                if (this.runStage) {
                    this.runStage.runtime = this.runtime;
                }
            }

            // Event handler already set above

            this.stopAnimationTicker();
            this.initRuntimeComponents();

            this.isGameStarted = false;
            this.createOrShowStartButton();
            
            this.editor.render();
        } else {
            this.removeStartButton();
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

        // InputControllers
        this.activeInputControllers = this.runtimeObjects.filter(obj => (obj as any).className === 'TInputController') as any[];
    }

    private stopRuntime() {
        if (this.runtime) {
            this.runtime.stop();
            this.runtime = null;
        }

        if (this.activeGameLoop && typeof (this.activeGameLoop as any).stop === 'function') {
            (this.activeGameLoop as any).stop();
        }

        // TInputController wird nativ via GameRuntime.stop() -> onRuntimeStop() beendet.

        this.activeInputControllers.forEach(ic => (ic as any).stop?.());
        this.activeTimers.forEach(timer => (timer as any).stop?.());
        this.activeGameServers.forEach(server => (server as any).stop?.());

        this.activeGameLoop = null;
        this.activeInputControllers = [];
        this.activeTimers = [];
        this.activeGameServers = [];
        this.runtimeObjects = null;
        this.stopAnimationTicker();
        (window as any).__inputControllerCallback = null;
        (window as any).__inputControllerObjects = null;
        (window as any).__multiplayerInputCallback = null;
    }

    private handleRuntimeEvent(id: string, eventName: string, data?: any) {
        if (!this.isGameStarted) return; // Events erst nach START GAME verarbeiten
        logger.info(`[RunManager] handleRuntimeEvent: id=${id}, event=${eventName}, hasRuntime=${!!this.runtime}`);
        if (this.runtime) {
            this.runtime.handleEvent(id, eventName, data);
            // KEIN explizites editor.render() hier!
            // Property-Änderungen (Score, Labels, etc.) triggern den
            // RAF-debounced GlobalListener in GameRuntime, der automatisch
            // maximal 1x pro Frame rendert. Explizites render() hier
            // würde zu doppelten Renders führen.
        }
    }


    /**
     * FAST PATH: Nur Sprite-Positionen im DOM aktualisieren.
     * Wird 60×/sec vom GameLoopManager aufgerufen (via onSpriteRender).
     * Empfängt die aktuellen Sprite-Objekte DIREKT vom GameLoopManager
     * (nicht die stale Deep-Copy aus runtimeObjects).
     */
    private renderSpritesOnly(sprites: any[]): void {
        if (!this.runStage || sprites.length === 0) return;
        
        this.runStage.updateSpritePositions(sprites);
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

    private createOrShowStartButton() {
        const footer = document.getElementById('toolbox-footer');
        if (!footer) return;

        let btn = document.getElementById('run-start-game-btn');
        let restartBtn = document.getElementById('run-restart-game-btn');

        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'run-start-game-btn';
            btn.style.cssText = `
                display: block;
                width: calc(100% - 24px);
                margin: 12px 12px 6px 12px;
                background: #4caf50;
                color: #fff;
                border: none;
                padding: 12px;
                cursor: pointer;
                font-family: 'Segoe UI', sans-serif;
                font-size: 14px;
                font-weight: bold;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                transition: all 0.2s;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 1px;
            `;
            
            btn.onmouseover = () => { if (!this.isGameStarted) btn!.style.transform = 'translateY(-2px)'; };
            btn.onmouseout = () => { if (!this.isGameStarted) btn!.style.transform = 'translateY(0)'; };

            btn.onclick = () => {
                if (!this.isGameStarted) {
                    DebugLogService.getInstance().clear();
                    // Erster Klick: Spiel starten
                    this.isGameStarted = true;
                    this.isGamePaused = false;
                    btn!.innerHTML = '⏸ PAUSE';
                    btn!.style.background = '#ff9800';
                    btn!.style.cursor = 'pointer';

                    // Restart-Button einblenden
                    const rb = document.getElementById('run-restart-game-btn');
                    if (rb) rb.style.display = 'block';

                    if (this.runtime) {
                        try {
                            this.runtime.start();
                        } catch(e) {

                            logger.error(`[RUN-FATAL] Crash during runtime start:`, e);
                            NotificationToast.show("Fatal error during Run-Mode start! Check Console for details.");
                        }
                    }
                } else if (!this.isGamePaused) {
                    // Spiel läuft → Pause
                    this.isGamePaused = true;
                    btn!.innerHTML = '▶ WEITER';
                    btn!.style.background = '#2196f3';

                    // GameLoop pausieren
                    GameLoopManager.getInstance().pause();

                    // Timer pausieren
                    this.activeTimers.forEach(timer => {
                        if (timer && typeof timer.stop === 'function') timer.stop();
                    });
                } else {
                    // Spiel pausiert → Fortsetzen
                    this.isGamePaused = false;
                    btn!.innerHTML = '⏸ PAUSE';
                    btn!.style.background = '#ff9800';

                    // GameLoop fortsetzen
                    GameLoopManager.getInstance().resume();

                    // Timer fortsetzen
                    this.activeTimers.forEach(timer => {
                        if (timer && typeof timer.start === 'function') {
                            timer.start(() => this.handleRuntimeEvent(timer.id, 'onTimer'));
                        }
                    });
                }
            };
            
            // Insert before Debug Log button if it exists, otherwise append
            footer.insertBefore(btn, footer.firstChild);
        } else {
            btn.style.display = 'block';
        }

        // Restart-Button
        if (!restartBtn) {
            restartBtn = document.createElement('button');
            restartBtn.id = 'run-restart-game-btn';
            restartBtn.style.cssText = `
                display: none;
                width: calc(100% - 24px);
                margin: 0 12px 12px 12px;
                background: #e91e63;
                color: #fff;
                border: none;
                padding: 8px;
                cursor: pointer;
                font-family: 'Segoe UI', sans-serif;
                font-size: 12px;
                font-weight: bold;
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                transition: all 0.2s;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 1px;
            `;
            restartBtn.innerHTML = '🔄 NEU STARTEN';
            restartBtn.onmouseover = () => { restartBtn!.style.transform = 'translateY(-1px)'; };
            restartBtn.onmouseout = () => { restartBtn!.style.transform = 'translateY(0)'; };

            restartBtn.onclick = () => {
                DebugLogService.getInstance().clear();
                // Run-Mode komplett neu starten
                this.setRunMode(false);
                setTimeout(() => this.setRunMode(true), 50);
            };

            // Direkt nach dem Start-Button einfügen
            if (btn.nextSibling) {
                footer.insertBefore(restartBtn, btn.nextSibling);
            } else {
                footer.appendChild(restartBtn);
            }
        }
        
        // Reset state
        this.isGamePaused = false;
        restartBtn.style.display = 'none';
        btn.innerHTML = '▶ START GAME';
        btn.style.background = '#4caf50';
        btn.style.cursor = 'pointer';
        btn.style.opacity = '1';
    }

    private removeStartButton() {
        const btn = document.getElementById('run-start-game-btn');
        if (btn) btn.style.display = 'none';
        const restartBtn = document.getElementById('run-restart-game-btn');
        if (restartBtn) restartBtn.style.display = 'none';
    }
}

