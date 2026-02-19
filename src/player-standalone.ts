import { GameRuntime } from './runtime/GameRuntime';
import { network, ServerMessage } from './multiplayer';
import { ExpressionParser } from './runtime/ExpressionParser';
import { gunzipSync } from 'fflate';
// HeadlessRuntime and HeadlessServer are Node.js-only (use express)
// They should NOT be imported in the browser bundle

// Register for runtime access
const globalScope = typeof window !== 'undefined' ? window : global;
(globalScope as any).ExpressionParser = ExpressionParser;
(globalScope as any).GameRuntime = GameRuntime;


/**
 * Decompress gzip-compressed project data (Base64 encoded)
 */
function decompressProject(data: string): any {
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
        console.error('[UniversalPlayer] Failed to decompress project:', e);
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
class UniversalPlayer {
    private runtime: GameRuntime | null = null;
    private stage: HTMLElement;
    private techClasses = ['TGameLoop', 'TInputController', 'TGameState', 'TTimer', 'TRemoteGameManager', 'TGameServer', 'THandshake', 'THeartbeat', 'TStageController'];
    private currentProject: any = null;
    private isStarted: boolean = false;
    private animationTickerId: number | null = null;

    // Drag & Drop State
    private dragTarget: any = null;
    private dragPhantom: any = null;
    private isDragging: boolean = false;
    private dragOffset: { x: number, y: number } = { x: 0, y: 0 };

    constructor() {
        this.stage = document.getElementById('stage')!;
        this.init();
    }

    private async init() {
        // 1. Setup Scaling
        window.addEventListener('resize', () => this.setupScaling());

        // 2. Connect to Network (Platform always uses network if available)
        try {
            await network.connect();
            console.log('[UniversalPlayer] Connected to game server');
        } catch (e) {
            console.warn('[UniversalPlayer] Server not reachable, falling back to offline mode');
        }

        // 3. Listen for network events (Project handshakes, Room codes)
        network.on((msg: ServerMessage) => this.handleNetworkMessage(msg));

        // 3b. Setup local input capture for multiplayer
        (window as any).__multiplayerInputCallback = (key: string, action: 'down' | 'up') => {
            if (network.roomCode) {
                network.sendInput(key, action);
            }
        };

        // 3c. Setup Drag & Drop listeners
        window.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // 4. Determine initial project
        const params = new URLSearchParams(window.location.search);
        const roomCode = params.get('room');
        const gameFile = params.get('game');
        const hostMode = params.get('host') === 'true';

        if (roomCode) {
            // Join existing room - project will arrive via 'project_data'
            console.log(`[UniversalPlayer] Joining room: ${roomCode}`);
            network.joinRoom(roomCode);
            this.showOverlay('Beitritt zum Raum...', roomCode);
        } else if (gameFile && hostMode) {
            // Load game and create a multiplayer room
            console.log(`[UniversalPlayer] Hosting multiplayer game: ${gameFile}`);
            const baseUrl = network.getHttpUrl();
            await this.loadProjectFromUrl(`${baseUrl}/platform/games/${gameFile}`);
            // Create room after project is loaded (will trigger room_created message)
            network.createRoom(gameFile);
            this.showOverlay('Raum wird erstellt...', '');
        } else if (gameFile) {
            // Load specific game file from platform (single player)
            console.log(`[UniversalPlayer] Loading game: ${gameFile}`);
            const baseUrl = network.getHttpUrl();
            await this.loadProjectFromUrl(`${baseUrl}/platform/games/${gameFile}`);
        } else if ((window as any).PROJECT_DATA) {
            // Use compressed embedded project (gzip + Base64)
            console.log('[UniversalPlayer] Loading compressed embedded project');
            const project = decompressProject((window as any).PROJECT_DATA);
            if (project) {
                this.startProject(project);
            } else {
                console.error('[UniversalPlayer] Failed to decompress project data');
            }
        } else if ((window as any).PROJECT) {
            // Use embedded project (Standalone HTML Export - plain JSON)
            console.log('[UniversalPlayer] Loading embedded project');
            this.startProject((window as any).PROJECT);
        } else {
            // Default: Show Platform UI
            console.log('[UniversalPlayer] No game selected, loading platform UI...');
            const baseUrl = network.getHttpUrl();
            await this.loadProjectFromUrl(`${baseUrl}/platform/project.json`);
        }
    }

    private handleNetworkMessage(msg: any) {
        switch (msg.type) {
            case 'project_data':
                console.log('[UniversalPlayer] Received project JSON from server');
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
                    console.log(`[UniversalPlayer] Game Start received, triggering onGameStart`);
                    this.runtime.handleEvent('global', 'onGameStart');
                }
                break;

            case 'remote_state':
                if (this.runtime) {
                    console.log(`[NET] Received state for ${msg.objectId}:`, msg.state || msg);
                    // Pass the full state object from the new protocol
                    this.runtime.updateRemoteState(msg.objectId, msg.state || msg);
                }
                break;

            case 'remote_event':
                if (this.runtime) {
                    console.log(`[UniversalPlayer] Received remote_event: ${msg.objectId}.${msg.eventName}`);
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
                    console.log(`[UniversalPlayer] Received remote_action from P${msg.player}:`, msg.action);
                    this.runtime.executeRemoteAction(msg.action);
                }
                break;

            case 'remote_task':
                if (this.runtime) {
                    console.log(`[UniversalPlayer] Received remote_task: ${msg.taskName} (mode: ${msg.mode})`);
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
                    console.log('[UniversalPlayer] Decompressing project from URL');
                    project = decompressProject(data.data);
                    if (!project) {
                        console.error('[UniversalPlayer] Failed to decompress project');
                        return;
                    }
                }

                this.startProject(project);
            } else {
                console.error(`[UniversalPlayer] Failed to load project from ${url}`);
                if (url !== './multiplayer/lobby.json') {
                    await this.loadProjectFromUrl('./multiplayer/lobby.json');
                }
            }
        } catch (e) {
            console.error('[UniversalPlayer] Error fetching project:', e);
        }
    }

    public startProject(project: any) {
        if (this.isStarted && this.currentProject === project) return;
        this.isStarted = true;

        // 1. Stop previous runtime if any
        if (this.runtime) {
            this.runtime.stop();
            this.stopAnimationTicker();
            this.stage.innerHTML = '';
        }

        this.currentProject = project;

        // 2. Initialize new Runtime
        this.runtime = new GameRuntime(project, undefined, {
            onRender: () => this.render(),
            multiplayerManager: network,
            onNavigate: (target: string) => this.handleNavigation(target),
            onStageSwitch: (stageId: string) => {
                console.log(`[UniversalPlayer] Stage switched to: ${stageId}`);
                this.setupScaling(); // Re-scaling for new stage dimensions
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
        console.log(`[UniversalPlayer] Project "${project.meta?.name}" started`);

        // If we are in a room, signal that we are ready
        if (network.roomCode) {
            console.log(`[UniversalPlayer] Signalling ready to server as Player ${network.playerNumber}`);
            network.ready();

            // If Master (P1), also ensure project is synced
            if (network.playerNumber === 1) {
                network.syncProject(project);
            }
        }
    }

    private handleNavigation(target: string) {
        console.log(`[UniversalPlayer] Navigating to: ${target}`);
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
                console.log(`[UniversalPlayer] Hosting game: ${gameFile}`);
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
            console.warn(`[UniversalPlayer] Cannot navigate to stage '${stageId}': no active runtime.`);
            return;
        }

        // Prüfe ob Stage existiert
        const stageExists = this.currentProject.stages?.some((s: any) => s.id === stageId);
        if (!stageExists) {
            console.warn(`[UniversalPlayer] Stage '${stageId}' not found in project.stages.`);
            return;
        }

        // Versuche TStageController zu nutzen
        const objects = this.runtime.getObjects();
        const stageController = objects.find((o: any) =>
            o.className === 'TStageController' || o.constructor?.name === 'TStageController'
        );

        if (stageController && typeof (stageController as any).goToStage === 'function') {
            console.log(`[UniversalPlayer] Stage navigation via TStageController → ${stageId}`);
            (stageController as any).goToStage(stageId);
        } else {
            // Fallback: Direkter Runtime-Aufruf
            console.log(`[UniversalPlayer] Stage navigation via direct runtime call → ${stageId}`);
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
            console.warn('[UniversalPlayer] No active stage or grid found for scaling');
            return;
        }

        const grid = activeStage.grid;
        const stageWidth = grid.cols * grid.cellSize;
        const stageHeight = grid.rows * grid.cellSize;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        const margin = 20;
        const scale = Math.min((windowWidth - margin) / stageWidth, (windowHeight - margin) / stageHeight, 1.0);

        this.stage.style.width = `${stageWidth}px`;
        this.stage.style.height = `${stageHeight}px`;
        this.stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
        this.stage.style.left = '50%';
        this.stage.style.top = '50%';
        this.stage.style.position = 'absolute';

        // Set background color from grid
        const bg = grid.backgroundColor || '#000';
        const bgImg = activeStage.backgroundImage;

        if (bgImg) {
            const url = bgImg.startsWith('http') || bgImg.startsWith('/') || bgImg.startsWith('data:')
                ? bgImg
                : `./images/${bgImg}`;
            this.stage.style.background = `url("${url}") center center / ${activeStage.objectFit || 'cover'} no-repeat, ${bg}`;
        } else {
            this.stage.style.background = bg;
        }
    }

    private startAnimationTicker() {
        if (this.animationTickerId) return;
        const tick = () => {
            if (!this.isStarted) return;

            // 1. Advance animations via AnimationManager
            const am = (window as any).AnimationManager || this.getAnimationManager();
            if (am) am.getInstance().update();

            // 2. Continuous render if animating to ensure fluidity
            // If we have a TGameLoop it might also trigger onRender, but doing it here 
            // ensures it works even for start-animations before GameLoop is fully busy.
            this.render();

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

    // Helper to get AnimationManager from bundle if needed
    private getAnimationManager(): any {
        // In the standalone bundle, AnimationManager should be included.
        // We can try to get it from the runtime context or global window.
        try {
            const { AnimationManager } = require('./runtime/AnimationManager');
            return AnimationManager;
        } catch (e) {
            return (window as any).AnimationManager;
        }
    }

    private render() {
        if (!this.runtime) return;
        const objects = this.runtime.getObjects();

        const activeStage = (this.runtime as any).stage || (this.currentProject.stage || this.currentProject.stages?.[0]);
        const grid = activeStage?.grid;
        if (!grid) return;

        const cellSize = grid.cellSize;
        const stageWidth = grid.cols * cellSize;
        const stageHeight = grid.rows * cellSize;

        // Calculate dock positions for aligned objects
        const dockArea = { left: 0, top: 0, right: stageWidth, bottom: stageHeight };
        const dockPositions = new Map<string, { left: number, top: number, width: number, height: number }>();

        // First pass: TOP, BOTTOM, LEFT, RIGHT
        objects.forEach((obj: any) => {
            const align = obj.align || 'NONE';
            if (align === 'NONE' || align === 'CLIENT') return;

            const objId = obj.id;
            if (!objId) return;

            const objHeight = (obj.height || 0) * cellSize;
            const objWidth = (obj.width || 0) * cellSize;
            const availableWidth = dockArea.right - dockArea.left;
            const availableHeight = dockArea.bottom - dockArea.top;

            if (align === 'TOP') {
                dockPositions.set(objId, { left: dockArea.left, top: dockArea.top, width: availableWidth, height: objHeight });
                dockArea.top += objHeight;
            } else if (align === 'BOTTOM') {
                dockPositions.set(objId, { left: dockArea.left, top: dockArea.bottom - objHeight, width: availableWidth, height: objHeight });
                dockArea.bottom -= objHeight;
            } else if (align === 'LEFT') {
                dockPositions.set(objId, { left: dockArea.left, top: dockArea.top, width: objWidth, height: availableHeight });
                dockArea.left += objWidth;
            } else if (align === 'RIGHT') {
                dockPositions.set(objId, { left: dockArea.right - objWidth, top: dockArea.top, width: objWidth, height: availableHeight });
                dockArea.right -= objWidth;
            }
        });

        // Second pass: CLIENT fills remaining area
        objects.forEach((obj: any) => {
            const align = obj.align || 'NONE';
            if (align !== 'CLIENT') return;

            const objId = obj.id;
            if (!objId) return;

            dockPositions.set(objId, {
                left: dockArea.left,
                top: dockArea.top,
                width: dockArea.right - dockArea.left,
                height: dockArea.bottom - dockArea.top
            });
        });

        // Clean up DOM - remove elements that are no longer in runtime
        const currentIds = new Set(objects.map((o: any) => o.id));
        const rendered = Array.from(this.stage.querySelectorAll('.game-object')) as HTMLElement[];
        rendered.forEach(el => {
            if (!currentIds.has(el.id)) el.remove();
        });

        // Update/Create elements
        objects.forEach((obj: any) => {
            if (this.techClasses.includes(obj.className)) return;

            const isVisible = obj.style?.visible !== false && obj.visible !== false;
            let el = document.getElementById(obj.id);

            if (!isVisible) {
                if (el) el.remove();
                return;
            }

            if (!el) {
                el = document.createElement('div');
                el.id = obj.id;
                el.className = 'game-object';
                this.stage.appendChild(el);
            }

            // Sync Basic Styles - use dock positions if available
            const dockPos = dockPositions.get(obj.id);
            if (dockPos) {
                // For docked objects, x and y serve as relative grid-offsets to their dock position
                // This allows animating docked objects (e.g. stage entry)
                const offsetX = (obj.x || 0) * cellSize;
                const offsetY = (obj.y || 0) * cellSize;
                el.style.left = `${dockPos.left + offsetX}px`;
                el.style.top = `${dockPos.top + offsetY}px`;
                el.style.width = `${dockPos.width}px`;
                el.style.height = `${dockPos.height}px`;
            } else {
                el.style.left = `${(obj.x || 0) * cellSize}px`;
                el.style.top = `${(obj.y || 0) * cellSize}px`;
                el.style.width = `${(obj.width || 0) * cellSize}px`;
                el.style.height = `${(obj.height || 0) * cellSize}px`;
            }
            el.style.zIndex = String(obj.zIndex || 0);

            // Opacity support for animations
            if (obj.style && obj.style.opacity !== undefined) {
                el.style.opacity = String(obj.style.opacity);
            } else {
                el.style.opacity = '1';
            }

            if (obj.style) {
                el.style.backgroundColor = obj.style.backgroundColor || 'transparent';
                el.style.color = obj.style.color || 'inherit';
                el.style.fontSize = (obj.style.fontSize || 16) + 'px';
                el.style.textAlign = obj.style.textAlign || 'left';
                el.style.border = `${obj.style.borderWidth || 0}px solid ${obj.style.borderColor || 'transparent'}`;
                el.style.borderRadius = (obj.style.borderRadius || 0) + 'px';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = obj.style.textAlign === 'center' ? 'center' : 'flex-start';
                el.style.padding = obj.style.textAlign === 'center' ? '0' : '0 10px';
            }

            this.renderComponentContent(el, obj);
        });
    }

    private renderComponentContent(el: HTMLElement, obj: any) {
        const type = obj.className;
        switch (type) {
            case 'TImage': {
                el.innerHTML = '';
                const img = document.createElement('img');
                const src = obj.src || obj.backgroundImage || '';
                if (src) {
                    img.src = src.startsWith('http') || src.startsWith('/') || src.startsWith('data:')
                        ? src
                        : `./images/${src}`;
                }
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = obj.objectFit || 'contain';
                img.style.opacity = String(obj.imageOpacity ?? 1);
                img.style.display = src ? 'block' : 'none';
                el.appendChild(img);
                break;
            }
            case 'TSprite': {
                el.style.backgroundColor = obj.spriteColor || el.style.backgroundColor;
                if (obj.shape === 'circle') el.style.borderRadius = '50%';

                // Sprite background image
                const bgImg = obj.backgroundImage;
                if (bgImg) {
                    const url = bgImg.startsWith('http') || bgImg.startsWith('/') || bgImg.startsWith('data:')
                        ? bgImg
                        : `./images/${bgImg}`;
                    el.style.backgroundImage = `url("${url}")`;
                    el.style.backgroundSize = obj.objectFit || 'cover';
                    el.style.backgroundPosition = 'center';
                    el.style.backgroundRepeat = 'no-repeat';
                } else {
                    el.style.backgroundImage = 'none';
                }
                break;
            }
            case 'TButton':
                el.innerText = obj.caption || obj.name;
                el.style.cursor = 'pointer';

                // Handle optional icon
                if (obj.icon) {
                    const iconUrl = obj.icon.startsWith('http') || obj.icon.startsWith('/') || obj.icon.startsWith('data:')
                        ? obj.icon
                        : `./images/${obj.icon}`;
                    el.style.display = 'flex';
                    el.style.gap = '8px';
                    el.style.alignItems = 'center';
                    el.style.justifyContent = 'center';
                    el.innerHTML = `<img src="${iconUrl}" style="height: 1.2em; width: auto;"> <span>${obj.caption || obj.name}</span>`;
                }

                if (!el.onclick) {
                    el.onclick = () => this.runtime?.handleEvent(obj.id, 'onClick');
                }
                break;
            case 'TLabel':
            case 'TNumberLabel':
            case 'TGameHeader':
                const labelText = (obj.text !== undefined && obj.text !== null) ? String(obj.text) :
                    (obj.value !== undefined && obj.value !== null) ? String(obj.value) :
                        (obj.title || obj.caption || '');
                el.innerText = labelText;
                break;
            case 'TEdit':
                if (!el.querySelector('input')) {
                    el.innerHTML = '';
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.style.width = '100%';
                    input.style.height = '100%';
                    input.style.border = 'none';
                    input.style.background = 'transparent';
                    input.style.padding = '0 10px';
                    input.style.color = 'inherit';
                    input.style.fontSize = 'inherit';
                    input.style.textAlign = 'center';
                    input.style.outline = 'none';
                    input.oninput = () => { obj.text = input.value; };
                    el.appendChild(input);
                }
                const ti = el.querySelector('input')!;
                const editValue = (obj.text !== undefined && obj.text !== null) ? String(obj.text) : '';
                if (ti.value !== editValue) {
                    ti.value = editValue;
                }
                break;
            case 'TVideo':
            case 'TSplashScreen': {
                const videoSrc = obj.videoSource || '';
                if (!videoSrc) {
                    el.innerHTML = '<div style="color: #444; font-size: 10px; text-align: center;">No Video Source</div>';
                    break;
                }

                let video = el.querySelector('video') as HTMLVideoElement;
                if (!video) {
                    el.innerHTML = '';
                    video = document.createElement('video');
                    video.style.width = '100%';
                    video.style.height = '100%';
                    video.playsInline = true;
                    el.appendChild(video);
                }

                // Sync source
                const fullSrc = videoSrc.startsWith('http') || videoSrc.startsWith('/') || videoSrc.startsWith('data:')
                    ? videoSrc
                    : `./images/${videoSrc}`;

                if (video.src !== new URL(fullSrc, window.location.href).href) {
                    video.src = fullSrc;
                    if (obj.autoplay) video.play().catch(() => { });
                }

                // Sync properties
                video.style.objectFit = obj.objectFit || 'contain';
                video.style.opacity = String(obj.imageOpacity ?? 1);
                video.loop = !!obj.loop;
                video.muted = !!obj.muted;
                if (obj.playbackRate) video.playbackRate = obj.playbackRate;

                // Sync Playback State from model
                if (obj.isPlaying && video.paused) {
                    video.play().catch(e => console.warn('[Player] Video play failed:', e));
                } else if (!obj.isPlaying && !video.paused) {
                    video.pause();
                }

                break;
            }
            case 'TGameCard': {
                el.innerHTML = '';
                el.style.flexDirection = 'column';
                el.style.padding = '15px';
                el.style.gap = '10px';
                el.style.borderRadius = '12px';
                el.style.background = 'rgba(255, 255, 255, 0.05)';
                el.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                el.style.backdropFilter = 'blur(10px)';

                // Host Info Row
                const hostRow = document.createElement('div');
                hostRow.style.display = 'flex';
                hostRow.style.alignItems = 'center';
                hostRow.style.gap = '10px';
                hostRow.style.width = '100%';

                const avatar = document.createElement('div');
                avatar.style.width = '40px';
                avatar.style.height = '40px';
                avatar.style.borderRadius = '50%';
                avatar.style.background = '#4fc3f7';
                avatar.style.display = 'flex';
                avatar.style.alignItems = 'center';
                avatar.style.justifyContent = 'center';
                avatar.style.fontSize = '20px';
                avatar.innerText = obj.hostAvatar || '👤';
                hostRow.appendChild(avatar);

                const nameAndGame = document.createElement('div');
                nameAndGame.style.flex = '1';

                const hostNameEl = document.createElement('div');
                hostNameEl.style.fontSize = '14px';
                hostNameEl.style.color = '#94a3b8';
                hostNameEl.innerText = obj.hostName || 'Anonym';
                nameAndGame.appendChild(hostNameEl);

                const gameTitleEl = document.createElement('div');
                gameTitleEl.style.fontSize = '18px';
                gameTitleEl.style.fontWeight = 'bold';
                gameTitleEl.innerText = obj.gameName || 'Unbekanntes Spiel';
                nameAndGame.appendChild(gameTitleEl);

                hostRow.appendChild(nameAndGame);
                el.appendChild(hostRow);

                // Join Button
                const joinBtn = document.createElement('div');
                joinBtn.style.width = '100%';
                joinBtn.style.padding = '8px';
                joinBtn.style.textAlign = 'center';
                joinBtn.style.background = '#10b981';
                joinBtn.style.color = 'white';
                joinBtn.style.borderRadius = '6px';
                joinBtn.style.cursor = 'pointer';
                joinBtn.style.fontWeight = 'bold';
                joinBtn.innerText = 'Beitreten';
                joinBtn.onclick = () => {
                    if (obj.roomCode) {
                        this.handleNavigation(`room:${obj.roomCode}`);
                    }
                };
                el.appendChild(joinBtn);
                break;
            }
            case 'TShape': {
                el.innerHTML = '';
                el.style.backgroundColor = obj.fillColor || 'transparent';
                el.style.border = `${obj.strokeWidth || 0}px solid ${obj.strokeColor || 'transparent'}`;
                el.style.opacity = String(obj.opacity ?? 1);

                if (obj.shapeType === 'circle') {
                    el.style.borderRadius = '50%';
                } else if (obj.shapeType === 'rect' || obj.shapeType === 'square') {
                    el.style.borderRadius = '0';
                } else if (obj.shapeType === 'ellipse') {
                    el.style.borderRadius = '50% / 50%';
                } else if (obj.shapeType === 'triangle') {
                    el.style.backgroundColor = 'transparent';
                    el.style.border = 'none';
                    el.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
                    el.style.background = obj.fillColor || 'white';
                } else if (obj.shapeType === 'arrow') {
                    el.style.backgroundColor = 'transparent';
                    el.style.border = 'none';
                    el.style.clipPath = 'polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)';
                    el.style.background = obj.fillColor || 'white';
                }
                break;
            }
        }
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

    private handleMouseDown(e: MouseEvent) {
        if (!this.runtime) return;

        // Find game object under mouse
        const el = (e.target as HTMLElement).closest('.game-object');
        if (!el) return;

        const obj = this.runtime.getObjects().find(o => o.id === el.id);
        if (!obj || !obj.draggable) return;

        console.log(`[Player] Start dragging: ${obj.name} (mode: ${obj.dragMode})`);

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

    private handleMouseMove(e: MouseEvent) {
        if (!this.isDragging || !this.dragTarget || !this.runtime) return;

        const coords = this.screenToGrid(e.clientX, e.clientY);
        this.dragTarget.x = coords.x - this.dragOffset.x;
        this.dragTarget.y = coords.y - this.dragOffset.y;

        // Force render for smooth movement
        this.render();
    }

    private handleMouseUp(e: MouseEvent) {
        if (!this.isDragging || !this.runtime) return;

        const originalTarget = this.dragPhantom ? this.dragTarget._original : this.dragTarget;

        // Find drop target (must be droppable and not the dragged object itself)
        const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
        let dropTargetObj: any = null;

        for (const el of elementsAtPoint) {
            const gameObjEl = (el as HTMLElement).closest('.game-object');
            if (gameObjEl && gameObjEl.id !== this.dragTarget.id) {
                const found = this.runtime.getObjects().find(o => o.id === gameObjEl.id);
                if (found && found.droppable) {
                    dropTargetObj = found;
                    break;
                }
            }
        }

        if (dropTargetObj) {
            console.log(`[Player] Dropped ${originalTarget.name} on ${dropTargetObj.name}`);
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
        const rect = this.stage.getBoundingClientRect();

        // Calculate relative position within the stage
        const relativeX = clientX - rect.left;
        const relativeY = clientY - rect.top;

        // Account for scaling
        const style = window.getComputedStyle(this.stage);
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
    document.addEventListener('DOMContentLoaded', () => {
        (window as any).player = new UniversalPlayer();
    });
}

// For embedded projects (Standalone Export)
(window as any).startStandalone = (project: any) => {
    console.log('[UniversalPlayer] Standalone trigger received');
    const player = (window as any).player;

    // If project is null, check for PROJECT_DATA (compressed)
    if (project === null && (window as any).PROJECT_DATA) {
        console.log('[UniversalPlayer] Decompressing PROJECT_DATA');
        project = decompressProject((window as any).PROJECT_DATA);
    }

    if (player && typeof player.startProject === 'function' && project) {
        player.startProject(project);
    } else if (project) {
        // Fallback: If player not yet ready, set global PROJECT for init()
        (window as any).PROJECT = project;
    } else {
        console.error('[UniversalPlayer] No project data available');
    }
};
