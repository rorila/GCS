import { IViewHost } from '../EditorViewTypes';
import { GameExporter } from '../../export/GameExporter';
import { projectStore } from '../../services/ProjectStore';
import { Logger } from '../../utils/Logger';

const logger = Logger.get('RunViewManager');

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
        iframe.src = './player.html';
        
        // WICHTIG: tabindex für Fokus-Fang
        iframe.tabIndex = 0;
        
        container.appendChild(iframe);
        this.activeIframe = iframe;
        
        // Projekt-Daten vorbereiten
        this.injectProjectIntoIframe(iframe);
    }

    /**
     * Injiziert das aktuelle Projekt in den IFrame
     */
    private injectProjectIntoIframe(iframe: HTMLIFrameElement): void {
        const exporter = new GameExporter();
        
        // ── WICHTIGER FIX: Verwende projectStore statt this.host.project,
        // da this.host.project oft eine veraltete Referenz ist (Unidirectional Data Flow!)
        const latestProject = projectStore.getProject() || this.host.project;
        
        // LOGGE URSPRUNG!
        const origStage = latestProject.stages?.find((s: any) => s.id === latestProject.activeStageId) || latestProject.stages?.[0];
        logger.debug(`ORIGINAL project store. Objects: ${origStage?.objects?.length}`, origStage?.objects);

        const cleanProjectData = exporter.getCleanProject(latestProject);

        // DEBUG: Prüfen ob das Gamepad HIER überhaupt vorhanden ist!
        const mainStage = cleanProjectData.stages?.find((s: any) => s.id === cleanProjectData.activeStageId) || cleanProjectData.stages?.[0];
        const hasGamepad = mainStage?.objects?.some((o: any) => o.className === 'TVirtualGamepad');
        logger.debug(`Sende CLEAN Projekt an IFrame. Objekte: ${mainStage?.objects?.length}, Beinhaltet Gamepad? ${hasGamepad}`);
        if (!hasGamepad) {
            logger.warn(`ALARM! Das Gamepad fehlt schon BEVOR es an den IFrame gesendet wird! CLEAN Objects:`, mainStage?.objects);
        }

        // Synchrone Datenübergabe
        (iframe as any)._injectedProject = cleanProjectData;

        const messageHandler = (e: MessageEvent) => {
            if (e.data && e.data.type === 'IFRAME_READY') {
                iframe.contentWindow?.postMessage({ type: 'START_RUN', project: cleanProjectData }, '*');
                window.removeEventListener('message', messageHandler);
            }
        };
        window.addEventListener('message', messageHandler);
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
