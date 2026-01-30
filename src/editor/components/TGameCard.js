import { TWindow } from './TWindow';
/**
 * TGameCard - A card component for displaying a game in the lobby.
 * Shows game name, waiting room count, and Single/Multi buttons.
 */
export class TGameCard extends TWindow {
    constructor(name, x = 0, y = 0) {
        super(name, x, y, 6, 5); // Default size: 6x5 grid units
        // Game info
        this.gameName = 'Game';
        this.gameFile = ''; // e.g., "pong.json"
        this.waitingCount = 0; // Number of waiting rooms
        this.hostName = '';
        this.hostAvatar = '';
        this.roomCode = '';
        // Card styling
        this.style.backgroundColor = '#2a2a2a';
        this.style.borderColor = '#4fc3f7';
        this.style.borderWidth = 2;
        this.style.color = '#ffffff';
    }
    getInspectorProperties() {
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
    toJSON() {
        return {
            ...super.toJSON(),
            gameName: this.gameName,
            gameFile: this.gameFile,
            waitingCount: this.waitingCount,
            hostName: this.hostName,
            hostAvatar: this.hostAvatar,
            roomCode: this.roomCode,
            Tasks: this.Tasks
        };
    }
}
