import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { ComponentRegistry } from '../utils/ComponentRegistry';
import { GameLoopManager } from '../runtime/GameLoopManager';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TOverlay', 'Runtime_Execution');

/**
 * TOverlay – Bettenet ein anderes Projekt als modale Overlay-Karte ein.
 *
 * show() erzeugt einen Abdunkel-Backdrop ueber der Stage und einen iframe
 * (./player.html?game=<overlayProject>&params=...) INNERHALB der Komponenten-
 * Box. Das Overlay laeuft in einer eigenen Runtime und sieht nur die
 * uebergebenen params. Das Overlay-Projekt schliesst sich ueber die Action
 * 'close_overlay' (postMessage an das Elternfenster); das Ergebnis wird als
 * onOverlayResult-Event an den Flow gemeldet.
 *
 * Events:
 *   onOverlayResult – data: Felder des result-Objekts
 *   onOverlayClosed – Overlay wurde geschlossen (auch ohne Ergebnis)
 */
export class TOverlay extends TWindow {
    public className = 'TOverlay';

    /** Projektname der Overlay-Datei (ohne .json), z.B. "Kopfrechnen". */
    public overlayProject = '';

    /** Uebergabedaten an das Overlay als JSON-Objekt oder -String. */
    public params: any = '';

    /** true = GameLoop des Hauptspiels pausiert, solange das Overlay offen ist. */
    public pauseGame = true;

    /** Abdunkelung hinter der Karte (0 = aus, 1 = schwarz). */
    public dimOpacity = 0.5;

    /** true = X-Button in der Kartenecke schliesst das Overlay. */
    public closable = true;

    /** true = Escape-Taste schliesst das Overlay. */
    public closeOnEscape = true;

    /** Laufzeit-Status: Overlay ist geoeffnet. */
    public isOpen = false;

    private _handleEvent?: (objectId: string, eventName: string, data?: unknown) => void;
    private _render?: () => void;
    private _iframe?: HTMLIFrameElement;
    private _backdrop?: HTMLElement;
    private _closeBtn?: HTMLElement;
    private _prevZIndex = '';
    private _prevZIndexProp = 0;
    private _onMessage?: (e: MessageEvent) => void;
    private _onEscapeKey?: (e: KeyboardEvent) => void;

    constructor(name: string, x: number, y: number, width = 16, height = 18) {
        super(name, x, y, width, height);
        this.style.backgroundColor = '#ffffff';
        this.style.borderColor = '#334155';
        this.style.borderWidth = 2;
        this.style.borderRadius = 12;
        this.zIndex = 100;
        this.visible = false;
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties().filter(p => !['text', 'caption'].includes(p.name)),
            { name: 'overlayProject', label: 'Overlay-Projekt', type: 'string', group: 'OVERLAY', hint: 'Projektname ohne .json, z.B. "Kopfrechnen". Wird ueber player.html geladen.' },
            { name: 'params', label: 'Übergabedaten (JSON)', type: 'json', group: 'OVERLAY', hint: 'z.B. {"aufgaben": 10} — steht im Overlay als ${…}-Variablen bereit.' },
            { name: 'pauseGame', label: 'Spiel pausieren', type: 'boolean', group: 'OVERLAY', hint: 'GameLoop friert ein, solange das Overlay offen ist.' },
            { name: 'dimOpacity', label: 'Abdunkelung (0–1)', type: 'number', min: 0, max: 1, step: 0.05, group: 'OVERLAY' },
            { name: 'closable', label: 'X-Button anzeigen', type: 'boolean', group: 'OVERLAY', hint: 'Schliessen-Knopf oben rechts auf der Karte. Aus = nur das Overlay-Spiel (close_overlay) oder der Host kann schliessen.' },
            { name: 'closeOnEscape', label: 'Escape schliesst', type: 'boolean', group: 'OVERLAY', hint: 'Escape-Taste beendet das Overlay (ohne Ergebnis).' },
            { name: 'isOpen', label: 'Geöffnet', type: 'boolean', readonly: true, serializable: false, group: 'STATUS' }
        ];
    }

    public initRuntime(callbacks: { handleEvent?: (objectId: string, eventName: string, data?: unknown) => void; render?: () => void }): void {
        this._handleEvent = callbacks.handleEvent;
        this._render = callbacks.render;
    }

    public onRuntimeStop(): void {
        this._teardown(false);
        this._handleEvent = undefined;
        this._render = undefined;
    }

    /** Oeffnet das Overlay (per Flow: call_method OverlayName.show()). */
    public show(paramsOverride?: any): void {
        if (this.isOpen || typeof document === 'undefined') return;
        const project = String(this.overlayProject || '').trim();
        if (!project) {
            logger.warn(`TOverlay "${this.name}": kein overlayProject gesetzt.`);
            return;
        }
        const el = this._findElement();
        if (!el) {
            logger.warn(`TOverlay "${this.name}": DOM-Element nicht gefunden.`);
            return;
        }

        const params = { ...this._parseParams(this.params), ...this._parseParams(paramsOverride) };
        const query = `game=${encodeURIComponent(project)}&overlay=1`
            + (Object.keys(params).length ? `&params=${encodeURIComponent(JSON.stringify(params))}` : '');

        const host = el.parentElement;
        if (host) {
            const backdrop = document.createElement('div');
            const dim = Math.min(1, Math.max(0, Number(this.dimOpacity) || 0));
            backdrop.style.cssText = `position:absolute;inset:0;background:rgba(0,0,0,${dim});z-index:9998;`;
            host.appendChild(backdrop);
            this._backdrop = backdrop;
        }

        this._prevZIndex = el.style.zIndex;
        this._prevZIndexProp = this.zIndex;
        this.zIndex = 9999;
        el.style.zIndex = '9999';
        el.style.overflow = 'hidden';

        // WICHTIG: Karte erst sichtbar machen, BEVOR der iframe lädt —
        // sonst misst player.html im iframe seine Skalierung in einem
        // 0×0-Layout (display:none) und rendert unsichtbar.
        this.visible = true;
        el.style.display = 'flex';

        const iframe = document.createElement('iframe');
        iframe.title = `Overlay ${project}`;
        iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#ffffff;';
        iframe.src = `./player.html?${query}`;
        // Tastatur-Fokus ins Overlay: erst nach 'load' existiert das innere
        // Dokument — dann bekommen Tastatur-Events (TInputController) den
        // richtigen Adressaten, ohne dass ins Overlay geklickt werden muss.
        const focusIframe = () => {
            try {
                iframe.focus();
                iframe.contentWindow?.focus();
            } catch { /* cross-origin oder noch nicht geladen */ }
        };
        iframe.addEventListener('load', () => {
            focusIframe();
            // Escape-Listener ins iframe-Dokument: dort hat der Fokus den
            // Tastaturstrom — ein Host-Listener allein wuerde Escape nie sehen.
            if (this.closeOnEscape && this._onEscapeKey) {
                try {
                    iframe.contentDocument?.addEventListener('keydown', this._onEscapeKey);
                } catch { /* cross-origin */ }
            }
        });
        el.appendChild(iframe);
        this._iframe = iframe;
        focusIframe();

        // X-Button (Host-DOM, ueber dem iframe) — immer erreichbar,
        // unabhaengig davon, was das Overlay-Projekt macht.
        if (this.closable) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = '✕';
            btn.title = 'Overlay schliessen';
            btn.style.cssText = 'position:absolute;top:6px;right:6px;width:34px;height:34px;'
                + 'border-radius:50%;border:2px solid #b91c1c;background:#ef4444;color:#fff;'
                + 'font-size:17px;font-weight:bold;line-height:1;cursor:pointer;z-index:3;'
                + 'box-shadow:0 1px 4px rgba(0,0,0,.35);';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });
            el.appendChild(btn);
            this._closeBtn = btn;
        }

        // Escape: im Host-Dokument (falls der iframe den Fokus verliert,
        // z.B. Klick auf den Backdrop) UND im iframe-Dokument (nach load).
        if (this.closeOnEscape) {
            this._onEscapeKey = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.close();
                }
            };
            document.addEventListener('keydown', this._onEscapeKey);
        }

        this._onMessage = (e: MessageEvent) => {
            if (e.source !== iframe.contentWindow) return;
            const data: any = e.data;
            if (data && data.type === 'gcs-overlay-close') {
                this.close(data.result);
            }
        };
        window.addEventListener('message', this._onMessage);

        if (this.pauseGame) GameLoopManager.getInstance().pause();
        this.isOpen = true;
        this._render?.();
        logger.info(`TOverlay "${this.name}": Overlay "${project}" geöffnet.`);
    }

    /** Schliesst das Overlay und meldet das Ergebnis an den Flow. */
    public close(result?: any): void {
        if (!this.isOpen) return;
        this._teardown();
        this.isOpen = false;
        this.visible = false;
        this._handleEvent?.(this.id, 'onOverlayClosed', {});
        const data = (result && typeof result === 'object') ? result : (result !== undefined ? { value: result } : {});
        this._handleEvent?.(this.id, 'onOverlayResult', data);
        this._render?.();
        logger.info(`TOverlay "${this.name}": Overlay geschlossen.`);
    }

    /**
     * Sucht das DOM-Element dieser Komponente. Im Editor-Run-View bleibt die
     * Design-Stage (#stage-wrapper, display:none) im Dokument — ein globaler
     * querySelector wuerde sonst das unsichtbare Design-Element treffen.
     * Das Laufzeit-Element liegt in beiden Kontexten unter #run-stage.
     */
    private _findElement(): HTMLElement | null {
        if (typeof document === 'undefined') return null;
        const scope = document.getElementById('run-stage');
        const sel = `[data-id="${this.id}"]`;
        return (scope?.querySelector(sel) as HTMLElement | null)
            ?? (document.querySelector(sel) as HTMLElement | null)
            ?? (document.querySelector(`[data-id="${this.name}"]`) as HTMLElement | null);
    }

    private _teardown(resumeLoop = true): void {
        if (this._onMessage) {
            window.removeEventListener('message', this._onMessage);
            this._onMessage = undefined;
        }
        if (this._onEscapeKey) {
            document.removeEventListener('keydown', this._onEscapeKey);
            if (this._iframe) {
                try {
                    this._iframe.contentDocument?.removeEventListener('keydown', this._onEscapeKey);
                } catch { /* cross-origin oder bereits weg */ }
            }
            this._onEscapeKey = undefined;
        }
        if (this._iframe) {
            this._iframe.src = 'about:blank';
            this._iframe.remove();
            this._iframe = undefined;
        }
        this._closeBtn?.remove();
        this._closeBtn = undefined;
        // Fokus ans Elterndokument zurückgeben, damit Tastatur-Steuerung
        // des Hauptspiels ohne erneuten Klick sofort wieder greift.
        try {
            (document.activeElement as HTMLElement | null)?.blur?.();
            window.focus();
        } catch { /* nicht kritisch */ }
        this._backdrop?.remove();
        this._backdrop = undefined;
        const el = this._findElement();
        if (el) el.style.zIndex = this._prevZIndex;
        this.zIndex = this._prevZIndexProp;
        if (resumeLoop && this.pauseGame) GameLoopManager.getInstance().resume();
    }

    private _parseParams(value: any): Record<string, any> {
        if (!value) return {};
        if (typeof value === 'object') return value;
        try { return JSON.parse(String(value)); } catch { return {}; }
    }

    public getEvents(): string[] {
        return [...super.getEvents(), 'onOverlayResult', 'onOverlayClosed'];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            overlayProject: this.overlayProject,
            params: this.params,
            pauseGame: this.pauseGame,
            dimOpacity: this.dimOpacity
        };
    }
}

// --- Auto-Registration ---
ComponentRegistry.register('TOverlay', (data: any) => new TOverlay(data.name, data.x, data.y, data.width, data.height));
