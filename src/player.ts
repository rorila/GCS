import { Stage } from './editor/Stage';
import { TWindow } from './components/TWindow';
import { hydrateObjects } from './utils/Serialization';
import { GameProject } from './model/types';
import { TGameLoop } from './components/TGameLoop';
import { TInputController } from './components/TInputController';
import { GameRuntime } from './runtime/GameRuntime';
import { TDebugLog } from './components/TDebugLog';
import { Logger } from './utils/Logger';

const logger = Logger.get('Player');

// Base Player Entry Point (used in Editor Preview)
export class Player {
    private stage: Stage;
    private project: GameProject | null = null;
    private objects: TWindow[] = [];
    private gameLoop: TGameLoop | null = null;
    private inputControllers: TInputController[] = [];
    private runtime: GameRuntime | null = null;
    private debugLog: TDebugLog | null = null;

    constructor() {
        this.stage = new Stage('stage', {
            cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: false, backgroundColor: '#ffffff'
        });

        this.stage.runMode = true;
        this.stage.onEvent = (id, evt) => this.handleEvent(id, evt);

        // Initialize Debug Logger
        this.debugLog = new TDebugLog();

        this.loadGame();
    }

    private async loadGame() {
        try {
            const response = await fetch('./game.json');
            if (!response.ok) {
                this.showError(`Failed to load game.json (Status: ${response.status})`);
                return;
            }
            const data = await response.json();

            this.project = data;
            if (this.project) {
                if (this.debugLog) this.debugLog.setProject(this.project);
                logger.info("Game Loaded:", this.project.meta.name);
                this.showStatus(`Loaded: ${this.project.meta.name}`);

                if (this.project.stage && this.project.stage.grid) {
                    this.stage.grid = { ...this.project.stage.grid, visible: false };
                    this.stage.updategrid();
                }

                // 1. Hydrate Objects
                this.objects = hydrateObjects(this.project.objects);

                // 2. Initialize Unified GameRuntime
                this.runtime = new GameRuntime(this.project, this.objects, {
                    onRender: () => this.stage.renderObjects(this.objects)
                });

                // 3. Start Runtime (triggers startAnimation, etc.)
                this.runtime.start();

                logger.info("Objects hydrated:", this.objects.length);
                this.showStatus(`Running: ${this.project.meta.name}`);

                // 4. Find and initialize GameLoop and InputController
                this.gameLoop = this.objects.find(
                    obj => (obj as any).className === 'TGameLoop'
                ) as TGameLoop | undefined ?? null;

                this.inputControllers = this.objects.filter(
                    obj => (obj as any).className === 'TInputController'
                ) as TInputController[];

                // Start InputControllers via Single-Global-Handler Pattern
                // (TInputController hängt keine eigenen window-Listener mehr,
                //  stattdessen delegiert ein globaler Handler an die aktiven ICs)
                this.inputControllers.forEach(ic => {
                    ic.init(this.objects, (id, event, data) => this.handleEvent(id, event, data));
                    ic.isActive = true;
                });

                if (this.inputControllers.length > 0) {
                    const ics = this.inputControllers;
                    window.addEventListener('keydown', (e) => ics.forEach(ic => ic.handleKeyDownEvent(e)));
                    window.addEventListener('keyup', (e) => ics.forEach(ic => ic.handleKeyUpEvent(e)));
                }

                // Initialize GameLoop (Konfigurations-Container)
                // Der GameLoopManager (Singleton) übernimmt den eigentlichen Loop.
                if (this.gameLoop) {
                    this.gameLoop.initRuntime({
                        objects: this.objects,
                        gridConfig: this.project.stage.grid,
                        render: () => this.stage.renderObjects(this.objects),
                        handleEvent: (id: string, eventName: string, data?: any) => this.handleGameLoopEvent(id, eventName, data)
                    });
                }

                // Initial render
                this.stage.renderObjects(this.objects);
            }

        } catch (e) {
            logger.error("Error starting game:", e);
            this.showError(`Error: ${e}`);
        }
    }

    private showStatus(msg: string) {
        let el = document.getElementById('status-msg');
        if (!el) {
            el = document.createElement('div');
            el.id = 'status-msg';
            el.style.position = 'absolute';
            el.style.top = '10px';
            el.style.left = '10px';
            el.style.color = 'lime';
            el.style.background = 'rgba(0,0,0,0.7)';
            el.style.padding = '5px';
            el.style.zIndex = '1000';
            document.body.appendChild(el);
        }
        el.innerText = msg;
    }

    private showError(msg: string) {
        let el = document.getElementById('status-msg') || document.createElement('div');
        el.id = 'status-msg';
        el.innerText = msg;
        el.style.color = 'red';
        if (!el.parentElement) document.body.appendChild(el);
    }

    private handleGameLoopEvent(id: string, eventName: string, data?: any) {
        if (!this.runtime) return;
        this.runtime.handleEvent(id, eventName, data);
        this.stage.renderObjects(this.objects);
    }

    private handleEvent(id: string, eventName: string, data?: any) {
        if (!this.runtime) return;
        this.runtime.handleEvent(id, eventName, data);
        this.stage.renderObjects(this.objects);
    }
}

// Start Player
new Player();
