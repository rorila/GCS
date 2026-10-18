import { IViewHost } from '../EditorViewTypes';
import { projectStore } from '../../services/ProjectStore';

/**
 * RunViewManager - Verwaltet die Run/Spiel-Ansicht im Editor.
 * 
 * Zuständig für:
 * - Setup der IFrame-Spielumgebung
 * - Projekt-Export für Runtime
 * - Kommunikation mit Runtime (postMessage)
 */
export class RunViewManager {
    private host: IViewHost;
    private activeIframe: HTMLIFrameElement | null = null;

    constructor(host: IViewHost) {
        this.host = host;
    }

    /**
     * Rendert die Run-Ansicht mit IFrame
     */
    public renderRunView(container: HTMLElement): void {
        container.innerHTML = '';
        
        const iframe = document.createElement('iframe');
        iframe.id = 'game-runtime-iframe';
        iframe.style.cssText = 'width: 100%; height: 100%; border: none; background: #000;';

        // Run-Tab lädt dieselbe Datei wie Autosave: projects/<Spielname>.json
        const project = projectStore.getProject() || this.host.project;
        const gameName = (project?.meta?.name || 'project').replace(/[^a-zA-Z0-9_-]/g, '_');
        iframe.src = `./player.html?game=${encodeURIComponent(gameName)}`;

        // WICHTIG: tabindex für Fokus-Fang
        iframe.tabIndex = 0;

        container.appendChild(iframe);
        this.activeIframe = iframe;
    }

    /**
     * Stoppt den Run-Mode und räumt auf
     */
    public stopRunMode(): void {
        if (this.activeIframe) {
            // IFrame entfernen um Memory Leaks zu vermeiden
            this.activeIframe.remove();
            this.activeIframe = null;
        }
    }

    /**
     * Sendet eine Nachricht an das aktive Runtime-IFrame
     */
    public sendToRuntime(message: any): void {
        if (this.activeIframe?.contentWindow) {
            this.activeIframe.contentWindow.postMessage(message, '*');
        }
    }

    /**
     * Prüft ob Run-Mode aktiv ist
     */
    public isRunning(): boolean {
        return this.activeIframe !== null && this.host.isRunning();
    }
}
