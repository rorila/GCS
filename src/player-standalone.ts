import { GameRuntime } from './runtime/GameRuntime';
import { network, ServerMessage } from './multiplayer';
import { ExpressionParser } from './runtime/ExpressionParser';
import { gunzipSync } from 'fflate';
import { StageRenderer, StageHost } from './editor/services/StageRenderer';
import { GridConfig, GameProject, StageDefinition, ComponentData } from './model/types';
import { GameLoopManager } from './runtime/GameLoopManager';
import { AnimationManager } from './runtime/AnimationManager';
import { Logger } from './utils/Logger';

const logger = Logger.get('UniversalPlayer', 'Runtime_Execution');
// HeadlessRuntime and HeadlessServer are Node.js-only (use express)
// They should NOT be imported in the browser bundle

// Register for runtime access
const globalScope = typeof window !== 'undefined' ? window : global;
(globalScope as any).ExpressionParser = ExpressionParser;
(globalScope as any).GameRuntime = GameRuntime;


/**
 * Decompress gzip-compressed project data (Base64 encoded)
 */
function decompressProject(data: string): GameProject | null {
    try {
        // Decode Base64 to binary
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        // Decompress with fflate
        const decompressed = gunzipSync(bytes);
        // Decode UTF-8 to string
        const json = new TextDecoder().decode(decompressed);
        return JSON.parse(json);
    } catch (e) {
        logger.error('[UniversalPlayer] Failed to decompress project:', e);
        return null;
    }
}

/**
 * UniversalPlayer - Drives the game on the platform.
 * Supports:
 * - Direct project execution (embedded PROJECT)
 * - Remote project loading (?game=xxx.json)
 * - Multiplayer rooms (?room=XXXX)
 * - Dynamic Lobby (if no game/room selected)
 */
class UniversalPlayer implements StageHost {
    private runtime: GameRuntime | null = null;
    public element: HTMLElement; // From StageHost
    private techClasses = ['TGameLoop', 'TInputController', 'TGameState', 'TTimer', 'TRemoteGameManager', 'TGameServer', 'THandshake', 'THeartbeat', 'TStageController'];
    private currentProject: GameProject | null = null;
    private isStarted: boolean = false;
    private animationTickerId: number | null = null;
    private renderer: StageRenderer;

    // --- StageHost Implementation ---
    public runMode: boolean = true;
    public isBlueprint: boolean = false;
    public selectedIds: Set<string> = new Set();
    public lastRenderedObjects: ComponentData[] = [];
    public onEvent: ((id: string, eventName: string, data?: unknown) => void) | null = null;

    public get grid(): GridConfig {
        const activeStage = this.runtime ? (this.runtime as any).stage : (this.currentProject?.stage || this.currentProject?.stages?.[0]);
        if (!activeStage?.grid) {
            logger.warn(`%c[UniversalPlayer:Grid] Fallback to 20px because grid is missing in ${activeStage?.name || 'unknown stage'}`, 'color: red');
            return {
                cols: 64,
                rows: 40,
                cellSize: 20,
                snapToGrid: true,
                visible: true,
                backgroundColor: '#ffffff'
            };
        }
        return activeStage.grid;
    }
    // --------------------------------
    public updategrid() {
        this.setupScaling();
    }
    // --------------------------------

    // Drag & Drop State
    private dragTarget: ComponentData | null = null;
    private dragPhantom: ComponentData | null = null;
    private isDragging: boolean = false;
    private dragOffset: { x: number, y: number } = { x: 0, y: 0 };

    constructor() {
        this.element = document.getElementById('run-stage')!;
        this.renderer = new StageRenderer(this);
        this.onEvent = (id, ev, data) => {
            if (this.runtime) this.runtime.handleEvent(id, ev, data);
        };
        this.init();
    }

    private async init() {
        // 1. Setup Scaling
        window.addEventListener('resize', () => this.setupScaling());

        // 2. Connect to Network (Platform always uses network if available)
        try {
            await network.connect();
            logger.info('[UniversalPlayer] Connected to game server');
        } catch (e) {
            logger.warn('[UniversalPlayer] Server not reachable, falling back to offline mode');
        }

        // 3. Listen for network events (Project handshakes, Room codes)
        network.on((msg: ServerMessage) => this.handleNetworkMessage(msg));

        // 3b. Setup local input capture for multiplayer
        (window as any).__multiplayerInputCallback = (key: string, action: 'down' | 'up') => {
            if (network.roomCode) {
                network.sendInput(key, action);
            }
        };

        // 3c. Setup Drag & Drop listeners (Pointer Events: vereint Maus + Touch + Stift)
        window.addEventListener('pointerdown', (e) => this.handleMouseDown(e));
        window.addEventListener('pointermove', (e) => this.handleMouseMove(e));
        window.addEventListener('pointerup', (e) => this.handleMouseUp(e));

        // 4. Determine initial project
        const params = new URLSearchParams(window.location.search);
        const roomCode = params.get('room');
        const gameFile = params.get('game');
        const hostMode = params.get('host') === 'true';

        if (roomCode) {
            // Join existing room - project will arrive via 'project_data'
            logger.info(`[UniversalPlayer] Joining room: ${roomCode}`);
            network.joinRoom(roomCode);
            this.showOverlay('Beitritt zum Raum...', roomCode);
        } else if (gameFile && hostMode) {
            // Load game and create a multiplayer room
            logger.info(`[UniversalPlayer] Hosting multiplayer game: ${gameFile}`);
            const baseUrl = network.getHttpUrl();
            await this.loadProjectFromUrl(`${baseUrl}/platform/games/${gameFile}`);
            // Create room after project is loaded (will trigger room_created message)
            network.createRoom(gameFile);
            this.showOverlay('Raum wird erstellt...', '');
        } else if (gameFile) {
            // Load specific game file from platform (single player)
            logger.info(`[UniversalPlayer] Loading game: ${gameFile}`);
            const baseUrl = network.getHttpUrl();
            await this.loadProjectFromUrl(`${baseUrl}/platform/games/${gameFile}`);
        } else if ((window as any).PROJECT_DATA) {
            // Use compressed embedded project (gzip + Base64)
            logger.info('[UniversalPlayer] Loading compressed embedded project');
            const project = decompressProject((window as any).PROJECT_DATA);
            if (project) {
                this.startProject(project);
            } else {
                logger.error('[UniversalPlayer] Failed to decompress project data');
            }
        } else if ((window as any).PROJECT) {
            // Use embedded project (Standalone HTML Export - plain JSON)
            logger.info('[UniversalPlayer] Loading embedded project');
            this.startProject((window as any).PROJECT);
        } else if ((window as any).WAIT_FOR_PROJECT) {
            // IFrame Runner explicitly waiting for postMessage
            logger.info('[UniversalPlayer] Waiting for PROJECT via postMessage, skipping fallback fetch...');
        } else {
            // Default: Show Platform UI
            logger.info('[UniversalPlayer] No game selected, loading platform UI...');
            const baseUrl = network.getHttpUrl();
            await this.loadProjectFromUrl(`${baseUrl}/projects/project.json`);
        }
    }

    private handleNetworkMessage(msg: ServerMessage) {
        switch (msg.type) {
            case 'project_data':
                logger.info('[UniversalPlayer] Received project JSON from server');
                this.startProject(msg.project);
                break;

            case 'room_created':
                this.showOverlay('Raum erstellt', msg.roomCode);
                // If we are Master and just started a project, sync it to server
                if (this.currentProject) {
                    network.syncProject(this.currentProject);
                }
                // Signal ready as Master
                network.ready();
                break;

            case 'room_joined':
                this.showOverlay('Raum beigetreten', msg.roomCode);
                break;

            case 'game_start':
                this.hideOverlay();
                if (this.runtime) {
                    logger.info(`[UniversalPlayer] Game Start received, triggering onGameStart`);
                    this.runtime.handleEvent('global', 'onGameStart');
                }
                break;

            case 'remote_state':
                if (this.runtime) {
                    logger.info(`[NET] Received state for ${msg.objectId}:`, msg.state || msg);
                    // Pass the full state object from the new protocol
                    this.runtime.updateRemoteState(msg.objectId, msg.state || msg);
                }
                break;

            case 'remote_event':
                if (this.runtime) {
                    logger.info(`[UniversalPlayer] Received remote_event: ${msg.objectId}.${msg.eventName}`);
                    this.runtime.triggerRemoteEvent(msg.objectId, msg.eventName, msg.params);
                }
                break;

            case 'remote_input':
                if (this.runtime) {
                    const controllers = this.runtime.getObjects().filter(o => o.className === 'TInputController');
                    controllers.forEach(ic => {
                        if (msg.action === 'down') ic.simulateKeyPress(msg.key);
                        else ic.simulateKeyRelease(msg.key);
                    });
                }
                break;

            case 'remote_action':
                if (this.runtime) {
                    logger.info(`[UniversalPlayer] Received remote_action from P${msg.player}:`, msg.action);
                    this.runtime.executeRemoteAction(msg.action);
                }
                break;

            case 'remote_task':
                if (this.runtime) {
                    logger.info(`[UniversalPlayer] Received remote_task: ${msg.taskName} (mode: ${msg.mode})`);
                    this.runtime.executeRemoteTask(msg.taskName, msg.params, msg.mode);
                }
                break;
        }
    }

    private async loadProjectFromUrl(url: string) {
        try {
            const resp = await fetch(url);
            if (resp.ok) {
                const data = await resp.json();

                // Check if it's a compressed project
                let project = data;
                if (data._compressed === true && data.data) {
                    logger.info('[UniversalPlayer] Decompressing project from URL');
                    project = decompressProject(data.data);
                    if (!project) {
                        logger.error('[UniversalPlayer] Failed to decompress project');
                        return;
                    }
                }

                this.startProject(project);
            } else {
                logger.error(`[UniversalPlayer] Failed to load project from ${url}`);
                if (url !== './multiplayer/lobby.json') {
                    await this.loadProjectFromUrl('./multiplayer/lobby.json');
                }
            }
        } catch (e) {
            logger.error('[UniversalPlayer] Error fetching project:', e);
        }
    }

    public startProject(project: GameProject) {
        if (this.isStarted && this.currentProject === project) return;
        this.isStarted = true;

        // 1. Stop previous runtime if any
        if (this.runtime) {
            this.runtime.stop();
            this.stopAnimationTicker();
            this.element.innerHTML = '';
        }

        this.currentProject = project;

        // 2. Initialize new Runtime
        this.runtime = new GameRuntime(project, undefined, {
            onRender: () => this.render(),
            onComponentUpdate: (obj: any) => {
                if (this.renderer && typeof this.renderer.updateSingleObject === 'function') {
                    this.renderer.updateSingleObject(obj);
                }
            },
            onSpriteRender: (sprites: ComponentData[]) => this.renderSpritesOnly(sprites),
            makeReactive: true,
            multiplayerManager: network,
            onNavigate: (target: string) => this.handleNavigation(target),
            onStageSwitch: (_stageId: string) => {
                this.setupScaling();
                this.render();
            }
        });

        // 3. Update Visuals
        this.setupScaling();
        this.render();

        // 4. Start Game (if runtime was successfully created)
        if (this.runtime) {
            this.runtime.start();
            this.startAnimationTicker();
        }
        logger.info(`[UniversalPlayer] Project "${project.meta?.name}" started`);

        // If we are in a room, signal that we are ready
        if (network.roomCode) {
            logger.info(`[UniversalPlayer] Signalling ready to server as Player ${network.playerNumber}`);
            network.ready();

            // If Master (P1), also ensure project is synced
            if (network.playerNumber === 1) {
                network.syncProject(project);
            }
        }
    }

    private handleNavigation(target: string) {
        logger.info(`[UniversalPlayer] Navigating to: ${target}`);
        if (target.startsWith('stage:')) {
            // Stage-Navigation: Interner Stage-Wechsel
            const stageId = target.substring(6);
            this.handleStageNavigation(stageId);
        } else if (target.startsWith('game:')) {
            const gameFile = target.replace('game:', '');
            const baseUrl = network.getHttpUrl();
            this.loadProjectFromUrl(`${baseUrl}/platform/games/${gameFile}`);
        } else if (target.startsWith('host:')) {
            const gameFile = target.replace('host:', '');
            const baseUrl = network.getHttpUrl();
            this.loadProjectFromUrl(`${baseUrl}/platform/games/${gameFile}`).then(() => {
                logger.info(`[UniversalPlayer] Hosting game: ${gameFile}`);
                network.createRoom(gameFile);
            });
        } else if (target === 'lobby') {
            this.loadProjectFromUrl('./multiplayer/lobby.json');
        } else if (target.startsWith('room:')) {
            const code = target.replace('room:', '');
            network.joinRoom(code);
            this.showOverlay('Beitritt zum Raum...', code);
        }
    }

    /**
     * Robuste Stage-Navigation für Standalone/Server-Umfeld.
     * Nutzt TStageController wenn vorhanden, sonst direkten Runtime-Aufruf.
     */
    private handleStageNavigation(stageId: string) {
        if (!this.runtime || !this.currentProject) {
            logger.warn(`[UniversalPlayer] Cannot navigate to stage '${stageId}': no active runtime.`);
            return;
        }

        // Prüfe ob Stage existiert
        const stageExists = this.currentProject.stages?.some((s: StageDefinition) => s.id === stageId);
        if (!stageExists) {
            logger.warn(`[UniversalPlayer] Stage '${stageId}' not found in project.stages.`);
            return;
        }

        // Versuche TStageController zu nutzen
        const objects = this.runtime.getObjects();
        const stageController = objects.find((o: any) =>
            o.className === 'TStageController' || o.constructor?.name === 'TStageController'
        );

        if (stageController && typeof (stageController as any).goToStage === 'function') {
            logger.info(`[UniversalPlayer] Stage navigation via TStageController → ${stageId}`);
            (stageController as any).goToStage(stageId);
        } else {
            // Fallback: Direkter Runtime-Aufruf
            logger.info(`[UniversalPlayer] Stage navigation via direct runtime call → ${stageId}`);
            (this.runtime as any).handleStageChange(
                (this.runtime as any).stage?.id || '',
                stageId
            );
        }
    }

    private setupScaling() {
        if (!this.currentProject) return;

        // Use active stage grid from runtime if available, else fallback to project default
        const activeStage = this.runtime ? (this.runtime as any).stage : (this.currentProject.stage || this.currentProject.stages?.[0]);
        if (!activeStage || !activeStage.grid) {
            logger.warn('%c[UniversalPlayer:Layout] No active stage or grid found for scaling', 'color: orange');
            return;
        }

        const grid = activeStage.grid;
        const cellSize = grid.cellSize || 32;
        const stageWidth = grid.cols * cellSize;
        const stageHeight = grid.rows * cellSize;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        const margin = 20;
        const scale = Math.min((windowWidth - margin) / stageWidth, (windowHeight - margin) / stageHeight, 1.0);

        logger.info(`%c[UniversalPlayer:Layout] Scaling Stage "${activeStage.name || activeStage.id}": cellSize=${cellSize}, size=${stageWidth}x${stageHeight}, scale=${scale.toFixed(3)}`, 'color: #00ff00; font-weight: bold');

        this.element.style.width = `${stageWidth}px`;
        this.element.style.height = `${stageHeight}px`;
        this.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
        this.element.style.left = '50%';
        this.element.style.top = '50%';
        this.element.style.position = 'absolute';

        this.updateBackground();
    }

    private updateBackground() {
        if (!this.currentProject) return;

        const activeStage = this.runtime ? (this.runtime as any).stage : (this.currentProject.stage || this.currentProject.stages?.[0]);
        if (!activeStage || !activeStage.grid) {
            logger.warn('[UniversalPlayer] updateBackground ABORTED: No activeStage grid found!');
            return;
        }

        const grid = activeStage.grid;
        const context = this.runtime ? this.runtime.getContext() : {};
        const bgExpression = grid.backgroundColor || '#2e2e2e';
        const bg = ExpressionParser.interpolate(bgExpression, context);
        
        logger.info('===== BACKGROUND DEBUG =====');
        logger.info(`1. bgExpression: ${bgExpression}`);
        logger.info(`2. ctx.MainThemes: ${context && context['MainThemes'] ? 'FOUND' : 'MISSING'}`);
        logger.info(`3. Interpolate Result (bg): ${bg}`);
        
        logger.info(`[BACKGROUND-TRACE] Stage bg calculated: ${bg} from ${bgExpression}`);

        const bgImg = activeStage.backgroundImage;

        if (bgImg && bgImg !== 'none') {
            let url = bgImg.startsWith('http') || bgImg.startsWith('/') || bgImg.startsWith('.') || bgImg.startsWith('data:')
                ? bgImg
                : `./images/${bgImg}`;
            if (url.startsWith('/images/')) url = '.' + url;
            this.element.style.backgroundImage = `url("${url}")`;
            this.element.style.backgroundPosition = 'center center';
            this.element.style.backgroundSize = activeStage.objectFit || 'cover';
            this.element.style.backgroundRepeat = 'no-repeat';
            this.element.style.backgroundColor = bg;
        } else {
            this.element.style.backgroundImage = 'none';
            this.element.style.backgroundColor = bg;
        }
        
        logger.info(`5. Target element bg-color after set: ${this.element.style.backgroundColor}`);
        logger.info('============================');
    }

    private startAnimationTicker() {
        if (this.animationTickerId) return;
        const tick = () => {
            if (!this.isStarted) return;

            // Wenn der GameLoopManager bereits läuft, macht ER das Physik-Update
            // und Rendering. Der AnimationTicker wäre dann nur doppelt.
            const glm = GameLoopManager.getInstance();
            if (glm.isRunning()) {
                // GameLoopManager aktiv → nichts tun, nur Loop am Leben halten
                this.animationTickerId = requestAnimationFrame(tick);
                return;
            }

            // Fallback: Kein GameLoopManager → AnimationManager manuell updaten
            AnimationManager.getInstance().update();

            // Nur rendern wenn Animationen aktiv sind
            if (AnimationManager.getInstance().hasActiveTweens()) {
                this.render();
            }

            this.animationTickerId = requestAnimationFrame(tick);
        };
        this.animationTickerId = requestAnimationFrame(tick);
    }

    private stopAnimationTicker() {
        if (this.animationTickerId) {
            cancelAnimationFrame(this.animationTickerId);
            this.animationTickerId = null;
        }
    }


    /**
     * Full Render: Komplettes DOM-Rebuild aller Objekte.
     * Wird bei Stage-Switch, neuen Objekten und Property-Änderungen aufgerufen.
     */
    private render() {
        if (!this.runtime) return;
        const objects = this.runtime.getObjects().filter(obj => !this.techClasses.includes(obj.className));
        logger.info(`[UniversalPlayer] Render ${objects.length} objects. Includes TVirtualGamepad? ${objects.some(o => o.className === 'TVirtualGamepad')}`);
        if (objects.some(o => o.className === 'TVirtualGamepad')) {
            logger.info('[UniversalPlayer] Found TVirtualGamepad:', objects.find(o => o.className === 'TVirtualGamepad'));
        }
        this.renderer.renderObjects(objects);
        this.updateBackground();
    }

    /**
     * FAST PATH: Nur Sprite-Positionen im DOM aktualisieren.
     * Wird 60×/sec vom GameLoopManager aufgerufen (via onSpriteRender).
     * Delegiert direkt an den StageRenderer, damit GPU-Compositing (translate3d) genutzt wird.
     */
    private renderSpritesOnly(sprites: ComponentData[]): void {
        this.renderer.updateSpritePositions(sprites);
    }

    private showOverlay(text: string, subtext?: string) {
        let overlay = document.getElementById('player-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'player-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85); color: white; z-index: 20000;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                font-family: sans-serif; backdrop-filter: blur(5px);
            `;
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = `
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">${text}</div>
            ${subtext ? `<div style="font-size: 48px; color: #4fc3f7; letter-spacing: 5px;">${subtext}</div>` : ''}
            <div style="margin-top: 40px; color: #888; font-size: 14px;">Warten auf Gegenspieler...</div>
        `;
        overlay.style.display = 'flex';
    }

    private hideOverlay() {
        const overlay = document.getElementById('player-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    // ─────────────────────────────────────────────
    // Drag & Drop Handling
    // ─────────────────────────────────────────────

    private handleMouseDown(e: MouseEvent | PointerEvent) {
        if (!this.runtime) return;

        // Find game object under pointer/mouse
        const el = (e.target as HTMLElement).closest('.game-object');
        if (!el) return;

        const obj = this.runtime.getObjects().find(o => o.id === el.id);
        if (!obj || !obj.draggable) return;

        // Pointer Capture: Drag funktioniert auch wenn Finger das Element verlässt
        if ('setPointerCapture' in (e.target as Element) && 'pointerId' in e) {
            (e.target as Element).setPointerCapture((e as PointerEvent).pointerId);
        }

        logger.info(`[Player] Start dragging: ${obj.name} (mode: ${obj.dragMode})`);

        this.isDragging = true;

        const gridCoords = this.screenToGrid(e.clientX, e.clientY);
        this.dragOffset = {
            x: gridCoords.x - obj.x,
            y: gridCoords.y - obj.y
        };

        if (obj.dragMode === 'copy') {
            // Create a phantom clone in the runtime
            this.dragPhantom = this.runtime.createPhantom(obj);
            this.dragTarget = this.dragPhantom;
        } else {
            this.dragTarget = obj;
        }

        this.runtime.handleEvent(obj.id, 'onDragStart', { x: gridCoords.x, y: gridCoords.y });
    }

    private handleMouseMove(e: MouseEvent | PointerEvent) {
        if (!this.isDragging || !this.dragTarget || !this.runtime) return;

        const coords = this.screenToGrid(e.clientX, e.clientY);
        this.dragTarget.x = coords.x - this.dragOffset.x;
        this.dragTarget.y = coords.y - this.dragOffset.y;

        // Force render for smooth movement
        this.render();
    }

    private handleMouseUp(e: MouseEvent | PointerEvent) {
        if (!this.isDragging || !this.runtime) return;

        const originalTarget = this.dragPhantom ? (this.dragTarget as any)?._original : this.dragTarget;

        // Find drop target (must be droppable and not the dragged object itself)
        const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
        let dropTargetObj: ComponentData | null = null;

        for (const el of elementsAtPoint) {
            const gameObjEl = (el as HTMLElement).closest('.game-object');
            if (gameObjEl && this.dragTarget && gameObjEl.id !== this.dragTarget.id) {
                const found = this.runtime.getObjects().find(o => o.id === gameObjEl.id);
                if (found && found.droppable) {
                    dropTargetObj = found;
                    break;
                }
            }
        }

        if (dropTargetObj) {
            logger.info(`[Player] Dropped ${originalTarget.name} on ${dropTargetObj.name}`);
            this.runtime.handleEvent(dropTargetObj.id, 'onDrop', {
                draggedId: originalTarget.id,
                draggedName: originalTarget.name,
                draggedObj: originalTarget
            });
        }

        // Cleanup
        if (this.dragPhantom) {
            this.runtime.removeObject(this.dragPhantom.id);
        }

        this.isDragging = false;
        this.dragTarget = null;
        this.dragPhantom = null;

        this.render();
    }

    private screenToGrid(clientX: number, clientY: number): { x: number, y: number } {
        const rect = this.element.getBoundingClientRect();

        // Calculate relative position within the stage
        const relativeX = clientX - rect.left;
        const relativeY = clientY - rect.top;

        // Account for scaling
        const style = window.getComputedStyle(this.element);
        const matrix = new DOMMatrix(style.transform);
        const scale = matrix.a;

        // Let's try to get the real cellSize from the active stage
        const activeStage = (this.runtime as any)?.stage || (this.currentProject?.stage || this.currentProject?.stages?.[0]);
        const cellSize = activeStage?.grid?.cellSize || 32;

        return {
            x: (relativeX / scale) / cellSize,
            y: (relativeY / scale) / cellSize
        };
    }
}

// Start
if (typeof document !== 'undefined') {
    const initPlayer = () => {
        if (!(window as any).player) {
            (window as any).player = new UniversalPlayer();
        }
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPlayer);
    } else {
        // Fallback für dynamisch geladenes Skript mit Cache-Busting
        initPlayer();
    }
}

// For embedded projects (Standalone Export)
(window as any).startStandalone = (project: GameProject | null) => {
    logger.info('[UniversalPlayer] Standalone trigger received');
    const player = (window as any).player;

    // If project is null, check for PROJECT_DATA (compressed)
    if (project === null && (window as any).PROJECT_DATA) {
        logger.info('[UniversalPlayer] Decompressing PROJECT_DATA');
        project = decompressProject((window as any).PROJECT_DATA);
    }

    if (player && typeof player.startProject === 'function' && project) {
        player.startProject(project);
    } else if (project) {
        // Fallback: If player not yet ready, set global PROJECT for init()
        (window as any).PROJECT = project;
    } else {
        logger.error('[UniversalPlayer] No project data available');
    }
};
