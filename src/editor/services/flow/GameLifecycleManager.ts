import { GameProject } from '../../../model/types';
import { analyzeGameLifecycle, GameLifecycleModel } from '../../../model/GameLifecycleAnalysis';
import { NotificationToast } from '../../ui/NotificationToast';
import { Logger } from '../../../utils/Logger';

const logger = Logger.get('FlowEditor', 'GameLifecycleManager');

export interface GameLifecycleHost {
    project: GameProject | null;
    canvas: HTMLElement;
    clearFlowCanvas(): void;
    switchActionFlow(context: string): void;
}

let mermaidLoader: Promise<any> | null = null;
const loadMermaid = (): Promise<any> => {
    if (!mermaidLoader) {
        mermaidLoader = import('mermaid').then(m => {
            m.default.initialize({
                startOnLoad: false,
                theme: 'dark',
                securityLevel: 'loose',
                flowchart: {
                    useMaxWidth: false,
                    htmlLabels: true,
                    curve: 'basis',
                    nodeSpacing: 25,
                    rankSpacing: 45,
                    padding: 8
                }
            });
            return m.default;
        });
    }
    return mermaidLoader;
};

let renderIdCounter = 0;

export class GameLifecycleManager {
    private host: GameLifecycleHost;
    public currentModel: GameLifecycleModel | null = null;

    constructor(host: GameLifecycleHost) {
        this.host = host;
    }

    public async generateGameLifecycle(): Promise<void> {
        this.host.clearFlowCanvas();
        this.removeOverview();

        const canvas = this.host.canvas;
        if (!canvas) return;

        // Container für den Spielablauf erzeugen
        const container = document.createElement('div');
        container.className = 'gcs-game-lifecycle-view';
        container.style.cssText =
            'position:absolute;inset:0;padding:24px;overflow:auto;background:#141820;color:#e8e8e8;font-family:Segoe UI,sans-serif;box-sizing:border-box;display:flex;flex-direction:column;gap:16px;';

        const project = this.host.project;
        if (!project) {
            container.innerHTML = '<div style="color:#aaa;padding:20px">Kein Projekt geladen.</div>';
            canvas.appendChild(container);
            return;
        }

        const model = analyzeGameLifecycle(project);
        this.currentModel = model;

        // Header mit Titel und Statistiken
        const header = document.createElement('div');
        header.style.cssText =
            'display:flex;justify-content:space-between;align-items:center;background:#1e2430;padding:12px 18px;border-radius:8px;border:1px solid #2d3748;';

        const titleBox = document.createElement('div');
        titleBox.innerHTML = `
            <div style="font-size:16px;font-weight:bold;color:#63b3ed;display:flex;align-items:center;gap:8px">
                <span>🎮</span> Spielablauf & Konzept-Übersicht (Lifecycle)
            </div>
            <div style="font-size:12px;color:#a0aec0;margin-top:4px">
                ${model.totalPhases} Phasen/Stages • ${model.totalTasks} Tasks • ${model.totalTransitions} Stage-Wechsel (Klick auf einen Task öffnet den Flow)
            </div>
        `;
        header.appendChild(titleBox);

        // Buttons
        const btnBar = document.createElement('div');
        btnBar.style.cssText = 'display:flex;gap:8px;align-items:center;';

        const copyBtn = document.createElement('button');
        copyBtn.innerText = '📋 Mermaid kopieren';
        copyBtn.title = 'Mermaid-Code in Zwischenablage kopieren';
        copyBtn.style.cssText = 'padding:6px 12px;background:#2b6cb0;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(model.mermaidCode).then(() => {
                NotificationToast.show('Mermaid-Code in Zwischenablage kopiert.', 'success');
            }).catch(() => {
                NotificationToast.show('Kopieren fehlgeschlagen.', 'error');
            });
        };
        btnBar.appendChild(copyBtn);

        let fitToWidth = false;
        const zoomBtn = document.createElement('button');
        zoomBtn.innerText = '🔍 Einpassen';
        zoomBtn.title = 'Zwischen "an Breite einpassen" und Originalgröße umschalten';
        zoomBtn.style.cssText = 'padding:6px 12px;background:#4a5568;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        btnBar.appendChild(zoomBtn);

        const refreshBtn = document.createElement('button');
        refreshBtn.innerText = '🔄 Aktualisieren';
        refreshBtn.title = 'Spielablauf neu berechnen';
        refreshBtn.style.cssText = 'padding:6px 12px;background:#4a5568;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        refreshBtn.onclick = () => {
            this.generateGameLifecycle();
        };
        btnBar.appendChild(refreshBtn);

        header.appendChild(btnBar);
        container.appendChild(header);

        // Diagramm-Anzeige
        const diagramWrapper = document.createElement('div');
        diagramWrapper.style.cssText =
            'flex:1;background:#1a202c;border:1px solid #2d3748;border-radius:8px;padding:24px;overflow:auto;display:flex;justify-content:center;align-items:flex-start;min-height:400px;';
        diagramWrapper.innerHTML = '<div style="color:#718096;padding:40px">Rendere Diagramm …</div>';
        container.appendChild(diagramWrapper);

        // Quelltext-Akkordeon
        const details = document.createElement('details');
        details.style.cssText = 'background:#1a202c;border:1px solid #2d3748;border-radius:6px;padding:8px 14px;';
        const summary = document.createElement('summary');
        summary.innerText = 'Mermaid-Quelltext anzeigen';
        summary.style.cssText = 'cursor:pointer;color:#a0aec0;font-size:12px;font-weight:600;';
        const pre = document.createElement('pre');
        pre.style.cssText = 'margin:10px 0 0;padding:10px;background:#141820;color:#9cdcfe;border-radius:4px;font-size:11px;overflow:auto;white-space:pre-wrap;';
        pre.textContent = model.mermaidCode;
        details.appendChild(summary);
        details.appendChild(pre);
        container.appendChild(details);

        canvas.appendChild(container);

        // Mermaid rendern
        try {
            const mermaid = await loadMermaid();
            const renderId = `lifecycle_${++renderIdCounter}`;
            const { svg } = await mermaid.render(renderId, model.mermaidCode);
            diagramWrapper.innerHTML = svg;

            // Klick-Handler einbinden
            this.bindInteractiveLinks(diagramWrapper, model);

            zoomBtn.onclick = () => {
                fitToWidth = !fitToWidth;
                zoomBtn.innerText = fitToWidth ? '🔍 100 %' : '🔍 Einpassen';
                this.applyZoom(diagramWrapper, fitToWidth);
            };
        } catch (err) {
            logger.error('Mermaid-Render fehlgeschlagen', err);
            diagramWrapper.innerHTML = `
                <div style="color:#fc8181;padding:20px;font-family:monospace">
                    <strong>Diagramm konnte nicht gerendert werden:</strong><br/>
                    ${String(err)}
                </div>
            `;
        }
    }

    private bindInteractiveLinks(root: HTMLElement, model: GameLifecycleModel): void {
        // Mermaid vergibt Knoten-IDs der Form "<renderId>-flowchart-<NodeId>-<n>" bzw. "flowchart-<NodeId>-<n>"
        root.querySelectorAll('g.node').forEach(elem => {
            const match = /flowchart-(.+)-\d+$/.exec(elem.id || '');
            if (!match) return;
            const link = model.nodeLinks[match[1]];
            if (!link) return;

            const el = elem as HTMLElement;
            el.style.cursor = 'pointer';
            const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            titleEl.textContent = link.kind === 'task'
                ? `Zum Task-Flow "${link.ref}" springen`
                : `Zum Feature "${link.ref}" springen`;
            el.appendChild(titleEl);

            el.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this.removeOverview();
                if (link.kind === 'task') {
                    NotificationToast.show(`Öffne Task: ${link.ref}`, 'info');
                    this.host.switchActionFlow(link.ref);
                } else {
                    NotificationToast.show(`Öffne Feature: ${link.ref}`, 'info');
                    this.host.switchActionFlow(`feature:${link.ref}`);
                }
            });
            el.addEventListener('mouseenter', () => { el.style.filter = 'brightness(1.4)'; });
            el.addEventListener('mouseleave', () => { el.style.filter = ''; });
        });
    }

    /** Entfernt alle Spielablauf-Container aus dem Canvas. */
    public removeOverview(): void {
        this.host.canvas?.querySelectorAll('.gcs-game-lifecycle-view').forEach(el => el.remove());
    }

    /** Schaltet zwischen "an Breite einpassen" und Originalgröße (100 %) um. */
    private applyZoom(wrapper: HTMLElement, fit: boolean): void {
        const svg = wrapper.querySelector('svg') as SVGSVGElement | null;
        if (!svg) return;
        if (fit) {
            svg.style.maxWidth = '100%';
            svg.style.width = '100%';
            svg.style.height = 'auto';
        } else {
            svg.style.maxWidth = 'none';
            svg.style.width = '';
            svg.style.height = '';
        }
    }
}
