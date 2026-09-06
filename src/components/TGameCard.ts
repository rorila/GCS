import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

/**
 * TGameCard - A card component for displaying a game in the lobby.
 * Shows game name, waiting room count, and Single/Multi buttons.
 */
export class TGameCard extends TWindow {
    // Game info
    public gameName: string = 'Game';
    public gameFile: string = '';  // e.g., "pong.json"
    public waitingCount: number = 0;  // Number of waiting rooms
    public hostName: string = '';
    public hostAvatar: string = '';
    public roomCode: string = '';

    constructor(name: string, x: number = 0, y: number = 0) {
        super(name, x, y, 6, 5);  // Default size: 6x5 grid units

        // Card styling
        this.style.backgroundColor = '#2a2a2a';
        this.style.borderColor = '#4fc3f7';
        this.style.borderWidth = 2;
        this.style.color = '#ffffff';
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'gameName', label: 'Game Name', type: 'string', group: 'Game' },
            { name: 'gameFile', label: 'Game File', type: 'string', group: 'Game' },
            { name: 'waitingCount', label: 'Waiting Rooms', type: 'number', group: 'Game' },
            { name: 'hostName', label: 'Host Name', type: 'string', group: 'Game' },
            { name: 'hostAvatar', label: 'Host Avatar', type: 'string', group: 'Game' },
            { name: 'roomCode', label: 'Room Code', type: 'string', group: 'Game' }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            gameName: this.gameName,
            gameFile: this.gameFile,
            waitingCount: this.waitingCount,
            hostName: this.hostName,
            hostAvatar: this.hostAvatar,
            roomCode: this.roomCode,
            Tasks: (this as any).Tasks
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TGameCard', (objData: any) => new TGameCard(objData.name, objData.x, objData.y));
