import { Logger } from '../../utils/Logger';

export interface EditorKeyboardHost {
    handleRewind(): void;
    handleForward(): void;
    saveProject(): void;
    deleteCurrentStage(): void;
}

export class EditorKeyboardManager {
    private static logger = Logger.get('EditorKeyboardManager', 'Inspector_Update');
    private host: EditorKeyboardHost;

    constructor(host: EditorKeyboardHost) {
        this.host = host;
    }

    public initKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            // Undo: Ctrl+Z
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.host.handleRewind();
            }
            // Redo: Ctrl+Y or Ctrl+Shift+Z
            if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                this.host.handleForward();
            }
            // Save: Ctrl+S
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.host.saveProject();
            }
        });
        EditorKeyboardManager.logger.info('Keyboard shortcuts initialized');
    }
}
