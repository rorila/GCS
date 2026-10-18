import { TPanel } from '../components/TPanel';
import { TButton } from '../components/TButton';
import { TLabel } from '../components/TLabel';
import { TEdit } from '../components/TEdit';
import { network } from './NetworkManager';
import { ServerMessage } from './Protocol';
import { Logger } from '../utils/Logger';

const logger = Logger.get('MultiplayerLobby');

/**
 * MultiplayerLobby - Reusable lobby overlay using project components
 * 
 * Works for any game - just call show() before starting multiplayer mode.
 * Uses TPanel, TButton, TLabel, TEdit from the component library.
 */
export class MultiplayerLobby {
    private container: HTMLElement | null = null;
    private onGameStart: ((playerNumber: 1 | 2, seed: number) => void) | null = null;

    // UI Components
    private panel: TPanel;
    private titleLabel: TLabel;
    private statusLabel: TLabel;
    private createButton: TButton;
    private roomCodeEdit: TEdit;
    private joinButton: TButton;
    private roomCodeLabel: TLabel;
    private readyButton: TButton;

    constructor() {
        // Create components with grid-based positioning
        this.panel = new TPanel('LobbyPanel', 8, 6, 16, 12);
        this.panel.style.backgroundColor = 'rgba(26, 26, 46, 0.95)';
        this.panel.style.borderColor = '#4fc3f7';
        this.panel.style.borderWidth = 2;

        this.titleLabel = new TLabel('TitleLabel', 9, 7, '🎮 Multiplayer');
        this.titleLabel.style.color = '#ffffff';
        this.titleLabel.style.backgroundColor = 'transparent';
        this.titleLabel.style.fontSize = 24;

        this.statusLabel = new TLabel('StatusLabel', 9, 9, 'Connecting to server...');
        this.statusLabel.style.color = '#888888';
        this.statusLabel.style.backgroundColor = 'transparent';
        this.statusLabel.style.fontSize = 14;

        this.createButton = new TButton('CreateButton', 9, 11, 14, 2);
        this.createButton.caption = 'Create Room';
        this.createButton.style.backgroundColor = '#4fc3f7';
        this.createButton.style.color = '#000000';

        this.roomCodeEdit = new TEdit('RoomCodeEdit', 9, 14, 8, 2);
        this.roomCodeEdit.placeholder = 'CODE';
        this.roomCodeEdit.maxLength = 6;
        this.roomCodeEdit.style.backgroundColor = '#ffffff';

        this.joinButton = new TButton('JoinButton', 18, 14, 5, 2);
        this.joinButton.caption = 'Join';
        this.joinButton.style.backgroundColor = '#ff8a65';
        this.joinButton.style.color = '#000000';

        this.roomCodeLabel = new TLabel('RoomCodeLabel', 9, 11, '');
        this.roomCodeLabel.style.color = '#4fc3f7';
        this.roomCodeLabel.style.backgroundColor = 'transparent';
        this.roomCodeLabel.style.fontSize = 28;

        this.readyButton = new TButton('ReadyButton', 9, 14, 14, 2);
        this.readyButton.caption = 'Ready!';
        this.readyButton.style.backgroundColor = '#66bb6a';
        this.readyButton.style.color = '#ffffff';

        // Setup network event handler
        network.on(this.handleServerMessage.bind(this));
    }

    /**
     * Show the lobby overlay
     */
    async show(container: HTMLElement, onGameStart: (playerNumber: 1 | 2, seed: number) => void): Promise<void> {
        this.container = container;
        this.onGameStart = onGameStart;

        // Connect to server
        this.statusLabel.text = 'Connecting to server...';
        try {
            await network.connect();
            this.statusLabel.text = 'Connected! Create or join a room.';
        } catch (error) {
            this.statusLabel.text = 'Failed to connect to server';
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
        switch (msg.type) {
            case 'room_created':
                this.roomCodeLabel.text = `Room: ${msg.roomCode}`;
                this.statusLabel.text = 'Waiting for opponent...';
                this.render();
                break;

            case 'room_joined':
                this.roomCodeLabel.text = `Room: ${msg.roomCode}`;
                this.statusLabel.text = 'Joined! Click Ready when ready.';
                this.render();
                break;

            case 'player_joined':
                this.statusLabel.text = 'Opponent joined! Click Ready when ready.';
                this.render();
                break;

            case 'player_left':
                this.statusLabel.text = 'Opponent left. Waiting for new player...';
                this.render();
                break;

            case 'game_start':
                this.statusLabel.text = 'Game starting!';
                setTimeout(() => {
                    this.hide();
                    if (this.onGameStart) {
                        this.onGameStart(msg.yourPlayer, msg.seed);
                    }
                }, 500);
                break;

            case 'error':
                this.statusLabel.text = `Error: ${msg.message}`;
                this.render();
                break;
        }
    }

    /**
     * Render the lobby UI
     */
    private render(): void {
        if (!this.container) return;

        // Remove existing overlay
        this.hide();

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
            width: 320px;
            padding: 24px;
            background: ${this.panel.style.backgroundColor};
            border: ${this.panel.style.borderWidth}px solid ${this.panel.style.borderColor};
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        `;

        // Title
        const titleEl = document.createElement('div');
        titleEl.textContent = this.titleLabel.text;
        titleEl.style.cssText = `
            font-size: ${this.titleLabel.style.fontSize}px;
            color: ${this.titleLabel.style.color};
            text-align: center;
            font-weight: bold;
        `;
        panelEl.appendChild(titleEl);

        // Status
        const statusEl = document.createElement('div');
        statusEl.textContent = this.statusLabel.text;
        statusEl.style.cssText = `
            font-size: ${this.statusLabel.style.fontSize}px;
            color: ${this.statusLabel.style.color};
            text-align: center;
        `;
        panelEl.appendChild(statusEl);

        // Show different UI based on state
        if (network.state === 'connected') {
            // Create Room Button
            const createBtn = this.createButtonElement(this.createButton, () => {
                network.createRoom();
            });
            panelEl.appendChild(createBtn);

            // Divider
            const divider = document.createElement('div');
            divider.textContent = '— or —';
            divider.style.cssText = 'text-align: center; color: #666; font-size: 12px;';
            panelEl.appendChild(divider);

            // Join Row
            const joinRow = document.createElement('div');
            joinRow.style.cssText = 'display: flex; gap: 8px;';

            const codeInput = document.createElement('input');
            codeInput.type = 'text';
            codeInput.placeholder = this.roomCodeEdit.placeholder;
            codeInput.maxLength = this.roomCodeEdit.maxLength;
            codeInput.style.cssText = `
                flex: 1;
                padding: 12px;
                font-size: 16px;
                text-transform: uppercase;
                border: 1px solid #ccc;
                border-radius: 4px;
                text-align: center;
            `;
            codeInput.oninput = () => {
                this.roomCodeEdit.text = codeInput.value.toUpperCase();
            };
            joinRow.appendChild(codeInput);

            const joinBtn = this.createButtonElement(this.joinButton, () => {
                if (this.roomCodeEdit.text.length > 0) {
                    network.joinRoom(this.roomCodeEdit.text);
                }
            });
            joinBtn.style.flex = '0 0 auto';
            joinRow.appendChild(joinBtn);

            panelEl.appendChild(joinRow);

        } else if (network.state === 'in_room') {
            // Room Code Display
            const codeEl = document.createElement('div');
            codeEl.textContent = this.roomCodeLabel.text;
            codeEl.style.cssText = `
                font-size: ${this.roomCodeLabel.style.fontSize}px;
                color: ${this.roomCodeLabel.style.color};
                text-align: center;
                font-weight: bold;
                font-family: monospace;
            `;
            panelEl.appendChild(codeEl);

            // Ready Button
            const readyBtn = this.createButtonElement(this.readyButton, () => {
                network.ready();
                this.statusLabel.text = 'Waiting for opponent to be ready...';
                this.render();
            });
            panelEl.appendChild(readyBtn);
        }

        overlay.appendChild(panelEl);
        this.container.appendChild(overlay);
    }

    /**
     * Create a button element from TButton
     */
    private createButtonElement(btn: TButton, onClick: () => void): HTMLElement {
        const el = document.createElement('button');
        el.textContent = btn.caption;
        el.style.cssText = `
            padding: 12px 24px;
            font-size: 16px;
            font-weight: bold;
            color: ${btn.style.color};
            background: ${btn.style.backgroundColor};
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: opacity 0.2s;
        `;
        el.onmouseover = () => el.style.opacity = '0.9';
        el.onmouseout = () => el.style.opacity = '1';
        el.onclick = onClick;
        return el;
    }
}

// Singleton instance
export const lobby = new MultiplayerLobby();
