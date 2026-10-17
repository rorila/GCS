import { learningPaneProject } from '../model/LearningShell';
import type { GameProject } from '../model/types';
import type { StageSignal, StageSignalResult } from '../model/StageInterface';

/** Self-contained bootstrap, serialized into the two isolated player documents. */
function paneBootstrap(token: string): void {
    // Blob panes have an opaque origin; randomUUID may be absent there.
    // getRandomValues remains available and provides the same random UUID v4.
    if (!crypto.randomUUID) Object.defineProperty(crypto, 'randomUUID', { value: () => {
        const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } });
    const scope = window as any, subscribers = new Set<(data: any) => void>();
    let port: MessagePort;
    const requests = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; timer: number }>();
    scope.__gcsFrameTransport = { send: (data: any) => port.postMessage({ type: 'cms-message', data }), subscribe: (listener: (data: any) => void) => { subscribers.add(listener); return () => subscribers.delete(listener); } };
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const route = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        if (!route.startsWith('/api/cms/')) return fetchOriginal(input, init);
        const id = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            const timer = window.setTimeout(() => { requests.delete(id); reject(Error('Spielhost antwortet nicht.')); }, 12000);
            requests.set(id, { resolve: result => resolve(new Response(JSON.stringify(result.data), { status: result.status, headers: { 'Content-Type': 'application/json' } })), reject, timer });
            try { port.postMessage({ type: 'fetch', id, route, body: JSON.parse(String(init?.body || '{}')) }); }
            catch (error) { clearTimeout(timer); requests.delete(id); reject(error); }
        });
    };
    const connect = async (event: MessageEvent) => {
        if (event.source !== parent || event.data?.type !== 'gcs-shell-connect' || event.data.token !== token || !event.ports[0]) return;
        window.removeEventListener('message', connect);
        port = event.ports[0];
        port.onmessage = async message => {
            const data = message.data;
            if (data?.type === 'input') {
                const result = await scope.player.runtime.receiveStageEvent(data.signal);
                port.postMessage({ type: 'result', id: data.id, result });
            } else if (data?.type === 'fetch-result') {
                const request = requests.get(data.id);
                if (request) { requests.delete(data.id); clearTimeout(request.timer); request.resolve(data); }
            } else if (data?.type === 'cms-result') subscribers.forEach(listener => listener(data.data));
            else if (data?.type === 'stop') {
                scope.player?.runtime?.stop();
                requests.forEach(request => { clearTimeout(request.timer); request.reject(Error('Spielbereich beendet.')); });
                requests.clear(); port.close();
            }
        };
        try {
            await scope.player.startProject(event.data.project);
            scope.player.runtime.onStageOutput((output: any) => port.postMessage({ type: 'output', output }));
            port.postMessage({ type: 'ready' });
        } catch (error) { port.postMessage({ type: 'error', message: String(error) }); }
    };
    window.addEventListener('message', connect);
}

interface Pane {
    frame: HTMLIFrameElement;
    port: MessagePort;
    ready: Promise<void>;
    requests: Map<string, { resolve: (result: StageSignalResult) => void; reject: (error: Error) => void; timer: number }>;
}

/** Two real player windows keep cell coordinates, physics and input isolation intact. */
export class LearningShellPlayer {
    private panes: Partial<Record<'task' | 'world', Pane>> = {};
    private urls: string[] = [];
    private disposed = false;
    private pendingEvent = '';
    private lastDelivery?: { role: 'task' | 'world'; signal: StageSignal };
    private status!: HTMLElement;
    private retry!: HTMLButtonElement;
    private root!: HTMLElement;
    private taskPane!: HTMLElement;
    private worldPane!: HTMLElement;
    private launchKey = '';
    private cmsReply?: (event: MessageEvent) => void;

    constructor(private container: HTMLElement, private runtimeUrl: string) {}

    mount(project: GameProject): void {
        const shell = project.learningShell!;
        for (const scope of [project, ...(project.stages || [])]) for (const variable of scope.variables || []) if (variable.name === 'CMS_LAUNCH') this.launchKey = String(variable.value || '');
        this.root = document.createElement('section'); this.root.id = 'learning-shell'; this.root.dataset.active = 'task';
        if ((window as any).__gcsCmsLiveBridge) this.root.dataset.cms = 'true';
        this.root.innerHTML = `<style>
            #learning-shell{height:100%;display:flex;flex-direction:column;background:#0d202b;color:#edf6f4;font:16px Segoe UI,sans-serif}
            #learning-shell header{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:10px 16px;background:#153744;min-height:40px}
            #learning-shell[data-cms=true] header{padding-top:76px}
            #learning-shell button{padding:12px 18px;font:inherit;border:1px solid #72b9be;border-radius:9px;color:#fff;background:#246d88;cursor:pointer}
            #learning-shell .shell-panes{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;padding:8px}
            #learning-shell .shell-pane{min-width:0;min-height:0;border:1px solid #4f7881;border-radius:12px;overflow:hidden;position:relative;background:#edf4f3}
            #learning-shell iframe{display:block;border:0;width:100%;height:100%}
            #learning-shell .shell-menu{margin:auto;text-align:center;padding:24px;max-width:620px;line-height:1.6}
            #learning-shell .shell-tabs{display:none}#learning-shell[data-mode=free] .shell-panes{grid-template-columns:1fr}
            @media(max-width:760px){#learning-shell .shell-tabs{display:flex;gap:8px}#learning-shell .shell-panes{display:block;position:relative}
            #learning-shell .shell-pane{position:absolute;inset:8px}#learning-shell[data-active=task] .shell-world,#learning-shell[data-active=world] .shell-task{visibility:hidden;pointer-events:none}}
        </style>`;
        const header = document.createElement('header'), title = document.createElement('strong'); title.textContent = shell.title;
        this.status = document.createElement('span'); this.status.setAttribute('role', 'status'); this.status.textContent = 'Modus wählen';
        header.append(title, this.status);
        const tabs = document.createElement('nav'); tabs.className = 'shell-tabs'; tabs.setAttribute('aria-label', 'Spielbereiche');
        for (const [role, text] of [['task', 'Aufgaben'], ['world', 'Spielwelt']] as const) {
            const button = document.createElement('button'); button.textContent = text; button.onclick = () => { this.root.dataset.active = role; }; tabs.append(button);
        }
        header.append(tabs);
        this.retry = document.createElement('button'); this.retry.textContent = 'Event erneut zustellen'; this.retry.hidden = true;
        this.retry.onclick = () => { if (this.lastDelivery) void this.deliver(this.lastDelivery.role, this.lastDelivery.signal); }; header.append(this.retry);
        const menu = document.createElement('div'); menu.className = 'shell-menu';
        const heading = document.createElement('h1'); heading.textContent = shell.title;
        const note = document.createElement('p'); note.textContent = 'Eine Spielwelt, zwei Einstiege: frei ausprobieren oder Bauteile mit Aufgaben aus deinem Karteikasten verdienen.';
        menu.append(heading, note);
        for (const [learning, text] of [[true, 'Lernen & Spielen'], [false, 'Frei spielen']] as const) {
            const button = document.createElement('button'); button.textContent = text; button.style.margin = '8px';
            button.onclick = () => { menu.remove(); void this.start(project, learning); }; menu.append(button);
        }
        this.root.append(header, menu); this.container.replaceChildren(this.root);
    }

    private async start(project: GameProject, learning: boolean): Promise<void> {
        this.root.dataset.mode = learning ? 'learning' : 'free';
        if (!learning) this.root.dataset.active = 'world';
        const panes = document.createElement('div'); panes.className = 'shell-panes'; this.root.append(panes);
        this.taskPane = document.createElement('section'); this.taskPane.className = 'shell-pane shell-task';
        this.worldPane = document.createElement('section'); this.worldPane.className = 'shell-pane shell-world';
        if (learning) panes.append(this.taskPane); panes.append(this.worldPane);
        this.status.textContent = 'Spielbereiche werden geladen …';
        this.cmsReply = event => {
            if (event.source === window.parent && event.origin === new URL(document.baseURI).origin && ['gcs-tts-result', 'gcs-speech-result'].includes(event.data?.type)) this.panes.task?.port.postMessage({ type: 'cms-result', data: event.data });
        };
        window.addEventListener('message', this.cmsReply);
        try {
            if (learning) this.panes.task = this.createPane(learningPaneProject(project, 'task', true), 'task', this.taskPane);
            this.panes.world = this.createPane(learningPaneProject(project, 'world', learning), 'world', this.worldPane);
            await Promise.all(Object.values(this.panes).map(pane => pane.ready));
            if (!this.disposed) this.status.textContent = learning ? 'Aufgabe lösen → ein Bauteil einbauen' : 'Freies Spielen · alle Bauteile verfügbar';
        } catch (error) { this.status.textContent = 'Spielbereich konnte nicht geladen werden: ' + String(error); }
    }

    private createPane(project: any, role: 'task' | 'world', container: HTMLElement): Pane {
        const frame = document.createElement('iframe'), channel = new MessageChannel(), token = crypto.randomUUID();
        frame.title = role === 'task' ? 'Aufgabenbereich' : 'Spielwelt'; frame.setAttribute('sandbox', 'allow-scripts');
        frame.allow = 'autoplay';
        const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const html = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${esc(document.baseURI)}"><style>html,body{margin:0;overflow:hidden;background:#edf4f3}#run-stage{position:absolute}</style><main id="run-stage"></main><script>window.WAIT_FOR_PROJECT=true;window.__gcsCmsHost=true;(${paneBootstrap.toString()})(${JSON.stringify(token)});</script><script src="${esc(this.runtimeUrl)}"></script></html>`;
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })); this.urls.push(url);
        let resolveReady!: () => void, rejectReady!: (error: Error) => void;
        const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
        const timer = window.setTimeout(() => rejectReady(Error(role + ': Ladezeit überschritten.')), 15000);
        const pane: Pane = { frame, port: channel.port1, ready, requests: new Map() };
        channel.port1.onmessage = async event => {
            const data = event.data;
            if (this.disposed) return;
            if (data?.type === 'ready') { clearTimeout(timer); resolveReady(); }
            else if (data?.type === 'error') { clearTimeout(timer); rejectReady(Error(String(data.message))); }
            else if (data?.type === 'result') { const request = pane.requests.get(data.id); if (request) { clearTimeout(request.timer); pane.requests.delete(data.id); request.resolve(data.result); } }
            else if (data?.type === 'output') this.output(role, data.output);
            else if (data?.type === 'fetch') {
                let status = 403, result: any = { ok: false, message: 'Spielanfrage nicht zugelassen.' };
                if (role === 'task' && data.route === '/api/cms/play' && this.launchKey && data.body?.launchKey === this.launchKey && JSON.stringify(data.body).length <= 4096) {
                    try { const response = await fetch('/api/cms/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data.body) }); status = response.status; result = await response.json(); }
                    catch { status = 503; result = { ok: false, message: 'CMS nicht erreichbar.' }; }
                }
                if (!this.disposed) pane.port.postMessage({ type: 'fetch-result', id: data.id, status, data: result });
            } else if (data?.type === 'cms-message' && role === 'task' && data.data?.launchKey === this.launchKey && ['gcs-tts', 'gcs-speech'].includes(data.data?.type) && JSON.stringify(data.data).length <= 8192) {
                window.parent.postMessage(data.data, new URL(document.baseURI).origin);
            }
        };
        frame.onload = () => frame.contentWindow?.postMessage({ type: 'gcs-shell-connect', token, project }, '*', [channel.port2]);
        frame.src = url; container.append(frame); return pane;
    }

    private output(role: 'task' | 'world', event: any): void {
        if (!event || event.direction !== 'output' || typeof event.eventId !== 'string') return;
        if (role === 'task' && event.name === 'LernEvent' && ['AntwortRichtig', 'AntwortFalsch', 'AntwortNichtVerstanden', 'RundeBeendet'].includes(event.payload?.type)) {
            const learning = event.payload;
            if (learning.type === 'AntwortRichtig') { this.pendingEvent = learning.eventId; this.root.dataset.active = 'world'; }
            this.status.textContent = 'Aufgabenbereich → ' + learning.type;
            void this.deliver('world', { name: learning.type, eventId: learning.eventId, payload: learning });
        } else if (role === 'world' && ['SpielweltBereit', 'ZielErreicht'].includes(event.name) && event.correlationId === this.pendingEvent && this.pendingEvent) {
            this.status.textContent = event.name === 'ZielErreicht' ? 'Ziel erreicht · gut gemacht!' : 'Spielwelt bereit · nächste Aufgabe';
            this.root.dataset.active = 'task';
            void this.deliver('task', { name: event.name === 'ZielErreicht' ? 'LernrundeBeenden' : 'SpielweltBereit', eventId: event.eventId, correlationId: this.pendingEvent, payload: event.payload });
        }
    }

    private async deliver(role: 'task' | 'world', signal: StageSignal): Promise<void> {
        const pane = this.panes[role]; if (!pane || this.disposed) return;
        this.lastDelivery = { role, signal };
        try {
            await pane.ready;
            const result = await new Promise<StageSignalResult>((resolve, reject) => {
                const id = crypto.randomUUID(), timer = window.setTimeout(() => { pane.requests.delete(id); reject(Error('Stage antwortet nicht.')); }, 12000);
                pane.requests.set(id, { resolve, reject, timer }); pane.port.postMessage({ type: 'input', id, signal });
            });
            if (!result.ok) throw Error(result.message || result.code);
            this.retry.hidden = true;
        } catch (error) { this.retry.hidden = false; this.status.textContent = 'Event wartet auf Zustellung: ' + String(error); }
    }

    dispose(): void {
        this.disposed = true;
        if (this.cmsReply) window.removeEventListener('message', this.cmsReply);
        for (const pane of Object.values(this.panes)) { pane.port.postMessage({ type: 'stop' }); pane.port.close(); pane.requests.forEach(request => { clearTimeout(request.timer); request.reject(Error('Spielhülle beendet.')); }); pane.frame.remove(); }
        this.urls.forEach(url => URL.revokeObjectURL(url)); this.root?.remove();
    }
}
