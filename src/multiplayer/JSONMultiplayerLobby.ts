/**
 * JSONMultiplayerLobby - JSON-based Multiplayer Lobby renderer
 * 
 * Loads lobby configuration from JSON and renders state-based UI.
 * Replaces the hardcoded MultiplayerLobby.ts.
 */

import { network } from './NetworkManager';
import { ServerMessage } from './Protocol';
import { Logger } from '../utils/Logger';

const logger = Logger.get('JSONMultiplayerLobby');

interface LobbyConfig {
    meta: { name: string; version: string };
    panel: {
        width: number;
        padding: number;
        background: string;
        borderColor: string;
        borderWidth: number;
        borderRadius: number;
    };
    elements: {
        title: { text: string; fontSize: number; color: string; fontWeight: string };
        status: { fontSize: number; color: string };
        roomCode: { fontSize: number; color: string; fontWeight: string };
    };
    states: {
        connected: { elements: any[] };
        in_room: { elements: any[] };
    };
    messages: Record<string, string>;
}

export class JSONMultiplayerLobby {
    private container: HTMLElement | null = null;
    private config: LobbyConfig | null = null;
    private onGameStart: ((playerNumber: 1 | 2, seed: number) => void) | null = null;
    private actions = new Map<string, () => void>();

    // State
    private statusText: string = '';
    private roomCode: string = '';
    private roomCodeInputValue: string = '';
    private gameName: string = '';

    constructor() {
        // Setup network event handler
        network.on(this.handleServerMessage.bind(this));
    }

    /**
     * Load configuration from JSON
     */
    async loadFromJSON(json: LobbyConfig): Promise<void> {
        this.config = json;
        logger.info('[JSONMultiplayerLobby] Loaded:', json.meta.name, 'v' + json.meta.version);
    }

    /**
     * Register action handler
     */
    registerAction(name: string, handler: () => void): void {
        this.actions.set(name, handler);
    }

    /**
     * Show the lobby overlay
     * @param container - The HTML container element
     * @param gameName - The name of the game for room creation
     * @param onGameStart - Callback when game starts
     */
    async show(container: HTMLElement, gameName: string, onGameStart: (playerNumber: 1 | 2, seed: number) => void): Promise<void> {
        this.container = container;
        this.gameName = gameName;
        this.onGameStart = onGameStart;

        if (!this.config) {
            logger.error('[JSONMultiplayerLobby] No config loaded!');
            return;
        }

        // Connect to server
        this.statusText = this.config.messages.connecting;
        try {
            await network.connect();
            this.statusText = this.config.messages.connected;
        } catch (error) {
            this.statusText = this.config.messages.connectionFailed;
            logger.error('Connection failed:', error);
        }

        this.render();
    }

    /**
     * Hide the lobby overlay
     */
    hide(): void {
        if (this.container) {
            const overlay = this.container.querySelector('.multiplayer-lobby-overlay');
            if (overlay) {
                overlay.remove();
            }
        }
    }

    /**
     * Handle server messages
     */
    private handleServerMessage(msg: ServerMessage): void {
        if (!this.config) return;

        switch (msg.type) {
            case 'room_created':
                this.roomCode = msg.roomCode;
                this.statusText = this.config.messages.waitingForOpponent;
                this.render();
                break;

            case 'room_joined':
                this.roomCode = msg.roomCode;
                this.statusText = this.config.messages.joined;
                this.render();
                break;

            case 'player_joined':
                this.statusText = this.config.messages.opponentJoined;
                this.render();
                break;

            case 'player_left':
                this.statusText = this.config.messages.opponentLeft;
                this.render();
                break;

            case 'game_start':
                this.statusText = this.config.messages.starting;
                setTimeout(() => {
                    this.hide();
                    if (this.onGameStart) {
                        this.onGameStart(msg.yourPlayer, msg.seed);
                    }
                }, 500);
                break;

            case 'error':
                this.statusText = `Error: ${msg.message}`;
                this.render();
                break;
        }
    }

    /**
     * Render the lobby UI based on current state
     */
    private render(): void {
        if (!this.container || !this.config) return;

        // Remove existing overlay
        this.hide();

        const cfg = this.config;

        // Create overlay container
        const overlay = document.createElement('div');
        overlay.className = 'multiplayer-lobby-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            background: rgba(0, 0, 0, 0.7);
            z-index: 1000;
        `;

        // Create panel container
        const panelEl = document.createElement('div');
        panelEl.style.cssText = `
            width: ${cfg.panel.width}px;
            padding: ${cfg.panel.padding}px;
            background: ${cfg.panel.background};
            border: ${cfg.panel.borderWidth}px solid ${cfg.panel.borderColor};
            border-radius: ${cfg.panel.borderRadius}px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        `;

        // Title
        const titleEl = document.createElement('div');
        titleEl.textContent = cfg.elements.title.text;
        titleEl.style.cssText = `
            font-size: ${cfg.elements.title.fontSize}px;
            color: ${cfg.elements.title.color};
            text-align: center;
            font-weight: ${cfg.elements.title.fontWeight};
        `;
        panelEl.appendChild(titleEl);

        // Status
        const statusEl = document.createElement('div');
        statusEl.textContent = this.statusText;
        statusEl.style.cssText = `
            font-size: ${cfg.elements.status.fontSize}px;
            color: ${cfg.elements.status.color};
            text-align: center;
        `;
        panelEl.appendChild(statusEl);

        // Render state-specific elements
        const currentState = network.state === 'in_room' ? 'in_room' : 'connected';
        const stateConfig = cfg.states[currentState];

        if (stateConfig) {
            stateConfig.elements.forEach(el => {
                const rendered = this.renderElement(el);
                if (rendered) {
                    panelEl.appendChild(rendered);
                }
            });
        }

        overlay.appendChild(panelEl);
        this.container.appendChild(overlay);
    }

    /**
     * Render a single element based on its type
     */
    private renderElement(el: any): HTMLElement | null {
        switch (el.type) {
            case 'button':
                return this.renderButton(el);
            case 'divider':
                return this.renderDivider(el);
            case 'inputRow':
                return this.renderInputRow(el);
            case 'roomCodeDisplay':
                return this.renderRoomCodeDisplay();
            default:
                logger.warn('[JSONMultiplayerLobby] Unknown element type:', el.type);
                return null;
        }
    }

    /**
     * Render a button
     */
    private renderButton(el: any): HTMLElement {
        const btn = document.createElement('button');
        btn.textContent = el.label;
        btn.style.cssText = `
            padding: 12px 24px;
            font-size: 16px;
            font-weight: bold;
            color: ${el.textColor || '#000'};
            background: ${el.color};
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: opacity 0.2s;
        `;
        btn.onmouseover = () => btn.style.opacity = '0.9';
        btn.onmouseout = () => btn.style.opacity = '1';
        btn.onclick = () => this.executeAction(el.action);
        return btn;
    }

    /**
     * Render a divider
     */
    private renderDivider(el: any): HTMLElement {
        const div = document.createElement('div');
        div.textContent = el.text;
        div.style.cssText = 'text-align: center; color: #666; font-size: 12px;';
        return div;
    }

    /**
     * Render an input row (input + button)
     */
    private renderInputRow(el: any): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; gap: 8px;';

        el.elements.forEach((child: any) => {
            if (child.type === 'input') {
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = child.placeholder;
                input.maxLength = child.maxLength;
                input.value = this.roomCodeInputValue;
                input.style.cssText = `
                    flex: 1;
                    padding: 12px;
                    font-size: 16px;
                    text-transform: uppercase;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    text-align: center;
                `;
                input.oninput = () => {
                    this.roomCodeInputValue = input.value.toUpperCase();
                };
                row.appendChild(input);
            } else if (child.type === 'button') {
                const btn = this.renderButton(child);
                btn.style.flex = '0 0 auto';
                row.appendChild(btn);
            }
        });

        return row;
    }

    /**
     * Render room code display
     */
    private renderRoomCodeDisplay(): HTMLElement {
        if (!this.config) return document.createElement('div');

        const el = document.createElement('div');
        el.textContent = `Room: ${this.roomCode}`;
        el.style.cssText = `
            font-size: ${this.config.elements.roomCode.fontSize}px;
            color: ${this.config.elements.roomCode.color};
            text-align: center;
            font-weight: ${this.config.elements.roomCode.fontWeight};
            font-family: monospace;
        `;
        return el;
    }

    /**
     * Execute an action by name
     */
    private executeAction(actionName: string): void {
        switch (actionName) {
            case 'createRoom':
                network.createRoom(this.gameName);
                break;
            case 'joinRoom':
                if (this.roomCodeInputValue.length > 0) {
                    network.joinRoom(this.roomCodeInputValue);
                }
                break;
            case 'ready':
                network.ready();
                if (this.config) {
                    this.statusText = this.config.messages.waitingForReady;
                }
                this.render();
                break;
            default:
                // Try custom action handler
                const handler = this.actions.get(actionName);
                if (handler) {
                    handler();
                } else {
                    logger.warn('[JSONMultiplayerLobby] Unknown action:', actionName);
                }
        }
    }
}

// Singleton instance
export const jsonLobby = new JSONMultiplayerLobby();
