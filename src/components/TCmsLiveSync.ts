import { TPropertyDef, IRuntimeComponent } from './TComponent';
import { TWindow } from './TWindow';
import { Logger } from '../utils/Logger';
import { ComponentRegistry } from '../utils/ComponentRegistry';

const logger = Logger.get('TCmsLiveSync');

/** Reaktive Proxys/Fremdobjekte in einfache JSON-Daten ueberfuehren. */
function jsonClone(value: any): any {
    try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
}

export class TCmsLiveSync extends TWindow implements IRuntimeComponent {
    public className: string = 'TCmsLiveSync';
    public launchKey: string = '';
    public partyId: string = '';
    public endpointPath: string = '/api/cms/party/live';
    public enabled: boolean | string = false;
    public status: 'idle' | 'connected' | 'disconnected' = 'idle';
    public lastError: string = '';
    public youAreHost: boolean = false;
    public memberCount: number = 0;
    public partyStatus: string = '';
    public lastSeq: number = 0;
    public inputSeq: number = 0;
    public stateTick: number = 0;
    public seatIndex: number = -1;
    public memberIds: any[] = [];
    public live: any = null;
    public remoteInput: any = null;
    public actions: any[] = [];

    private eventCallback: ((eventName: string, data?: any) => void) | null = null;
    private inflight: Promise<any> | null = null;
    private socket: WebSocket | null = null;
    private socketReady: Promise<boolean> | null = null;
    private socketFailed = false;
    private socketFailedAt = 0;
    private pending = new Map<string, { resolve: (value: any) => void; timer: any }>();

    constructor(name: string, x: number = 0, y: number = 0) {
        super(name, x, y, 5, 2);
        this.isService = true;
        this.isHiddenInRun = true;
        this.style.backgroundColor = '#00838f';
        this.style.borderColor = '#005662';
        this.style.borderWidth = 2;
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'launchKey', label: 'Launch-Key', type: 'string', group: 'Live-Sync' },
            { name: 'partyId', label: 'Partie-ID', type: 'string', group: 'Live-Sync' },
            { name: 'enabled', label: 'Aktiviert', type: 'boolean', group: 'Live-Sync' },
            { name: 'endpointPath', label: 'Live-Endpunkt', type: 'string', group: 'Live-Sync' },
            { name: 'status', label: 'Status', type: 'string', readonly: true, group: 'Live-Sync' },
            { name: 'lastSeq', label: 'Letzte Aktions-Seq', type: 'number', readonly: true, group: 'Live-Sync' },
            { name: 'inputSeq', label: 'Eingabe-Seq', type: 'number', readonly: true, group: 'Live-Sync' },
            { name: 'stateTick', label: 'State-Tick', type: 'number', readonly: true, group: 'Live-Sync' },
            { name: 'seatIndex', label: 'Eigener Sitzplatz', type: 'number', readonly: true, group: 'Live-Sync' },
            { name: 'lastError', label: 'Letzter Fehler', type: 'string', readonly: true, group: 'Live-Sync' }
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onConnected',
            'onDisconnected',
            'onLive',
            'onError'
        ];
    }

    public initRuntime(callbacks: { handleEvent: any }): void {
        this.eventCallback = (eventName: string, data?: any) => callbacks.handleEvent(this.id, eventName, data);
        // Sandbox-Push: Upload-IFrames duerfen keinen eigenen WebSocket oeffnen
        // (connect-src 'none'); der Eltern-Frame haelt die Verbindung und leitet
        // live-update-Pushes als CustomEvent 'gcs-cms-live' weiter.
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('gcs-cms-live', event => {
                if (this.enabled !== true || !this.launchKey || !this.partyId) return;
                this.applyResponse(200, (event as CustomEvent).detail);
            });
        }
    }

    public async sendInput(direction: any, paddleY?: any, paddleVY?: any, since?: any): Promise<any> {
        this.inputSeq += 1;
        return this.request({
            input: {
                seq: this.inputSeq,
                dir: Number(direction) || 0,
                y: paddleY === undefined ? undefined : Number(paddleY),
                vy: paddleVY === undefined ? undefined : Number(paddleVY)
            },
            since: Number(since ?? this.lastSeq) || 0
        });
    }

    public async sendState(
        ballX: any,
        ballY: any,
        ballVX: any,
        ballVY: any,
        leftY: any,
        leftVY: any,
        rightY: any,
        rightVY: any,
        scoreLeft: any,
        scoreRight: any,
        phase: any,
        targetScore: any,
        lastProcessedInputSeq?: any,
        since?: any
    ): Promise<any> {
        this.stateTick += 1;
        return this.request({
            state: {
                tick: this.stateTick,
                ballX: Number(ballX) || 0,
                ballY: Number(ballY) || 0,
                ballVX: Number(ballVX) || 0,
                ballVY: Number(ballVY) || 0,
                leftY: Number(leftY) || 0,
                leftVY: Number(leftVY) || 0,
                rightY: Number(rightY) || 0,
                rightVY: Number(rightVY) || 0,
                scoreLeft: Number(scoreLeft) || 0,
                scoreRight: Number(scoreRight) || 0,
                phase: String(phase || 'wait'),
                targetScore: Math.max(1, Number(targetScore) || 0),
                lastInputSeq: Number(lastProcessedInputSeq) || 0
            },
            since: Number(since ?? this.lastSeq) || 0
        });
    }

    /**
     * Generischer Spielstand fuer rundenbasierte Spiele (z.B. MADN): Der Host
     * publiziert ein kompaktes JSON-Telegramm (Figurenpositionen, aktiver
     * Spieler, Wuerfel ...), der Server validiert Groesse/Tiefe und verteilt
     * es unveraendert an alle Partie-Mitglieder.
     */
    public async sendGameState(data: any, phase?: any, since?: any): Promise<any> {
        this.stateTick += 1;
        return this.request({
            state: {
                tick: this.stateTick,
                phase: String(phase || 'play'),
                data: jsonClone(data)
            },
            since: Number(since ?? this.lastSeq) || 0
        });
    }

    /**
     * Zug-Absicht eines Gastes (z.B. Wuerfeln oder Figurwahl): kleines
     * JSON-Telegramm im Input-Kanal; der Host validiert es fachlich
     * (Zugberechtigung, Gueltigkeit) und wendet es autoritativ an.
     */
    public async sendIntent(data: any, since?: any): Promise<any> {
        this.inputSeq += 1;
        return this.request({
            input: { seq: this.inputSeq, dir: 0, data: jsonClone(data) },
            since: Number(since ?? this.lastSeq) || 0
        });
    }

    public async poll(since?: any): Promise<any> {
        return this.request({ since: Number(since ?? this.lastSeq) || 0 });
    }

    public applyBall(sprite: any): void {
        const state = this.live;
        if (!state || !sprite) return;
        sprite.velocityX = Number(state.ballVX) || 0;
        sprite.velocityY = Number(state.ballVY) || 0;
        if (typeof sprite.smoothSync === 'function') {
            sprite.smoothSync(Number(state.ballX) || 0, Number(state.ballY) || 0);
        }
    }

    public applyPaddle(sprite: any, side: any): void {
        const state = this.live;
        if (!state || !sprite) return;
        const key = String(side) === 'right' ? 'right' : 'left';
        sprite.velocityY = Number(state[key + 'VY']) || 0;
        if (typeof sprite.smoothSync === 'function') {
            sprite.smoothSync(sprite.x, Number(state[key + 'Y']) || 0);
        }
    }

    public applyRemoteInput(sprite: any, speed?: any): void {
        if (!sprite) return;
        const input = this.remoteInput;
        const velocity = Math.abs(Number(speed)) || 0.5;
        sprite.velocityY = input && !input.expired ? (Number(input.dir) || 0) * velocity : 0;
    }

    /**
     * Gegner-Paddle nachfuehren: Der fernbediente Spieler meldet seine eigene
     * autoritative Position (y) und Geschwindigkeit (vy) im Input-Kanal.
     * Position wird sanft interpoliert, vy treibt das Dead-Reckoning zwischen
     * den Meldungen. Ohne y-Meldung faellt die Logik auf dir-Simulation zurueck.
     */
    public syncRemotePaddle(sprite: any, speed?: any): void {
        if (!sprite) return;
        const input = this.remoteInput;
        if (input && Number.isFinite(Number(input.y))) {
            sprite.velocityY = Number(input.vy) || 0;
            if (typeof sprite.smoothSync === 'function') {
                sprite.smoothSync(sprite.x, Number(input.y));
            }
            return;
        }
        this.applyRemoteInput(sprite, speed);
    }

    public onRuntimeStop(): void {
        this.disconnect();
    }

    private disconnect(): void {
        for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.resolve({ ok: false, status: 503, message: 'Live-Verbindung geschlossen.' }); }
        this.pending.clear();
        try { this.socket?.close(); } catch { /* ignorieren */ }
        this.socket = null;
        this.socketReady = null;
    }

    private connectSocket(): Promise<boolean> {
        if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve(true);
        if (this.socketFailed && Date.now() - this.socketFailedAt < 3000) return Promise.resolve(false);
        if (this.socketFailed) { this.socketFailed = false; this.socketReady = null; }
        if (!this.socketReady) {
            this.socketReady = new Promise<boolean>(resolve => {
                try {
                    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
                    const ws = new WebSocket(`${protocol}://${location.host}${this.endpointPath}?launchKey=${encodeURIComponent(this.launchKey)}`);
                    const timer = setTimeout(() => { try { ws.close(); } catch { /* ignorieren */ } resolve(false); }, 4000);
                    ws.onopen = () => { clearTimeout(timer); this.socket = ws; resolve(true); };
                    ws.onmessage = event => {
                        try {
                            const message = JSON.parse(event.data);
                            if (message.type === 'live-result') {
                                const pending = this.pending.get(message.id);
                                if (pending) { this.pending.delete(message.id); clearTimeout(pending.timer); pending.resolve(this.applyResponse(message.status || 200, message.data)); }
                            } else if (message.type === 'live-update') {
                                this.applyResponse(200, message.data);
                            }
                        } catch { /* ungültige Nachricht ignorieren */ }
                    };
                    ws.onclose = () => {
                        if (this.socket === ws) { this.socket = null; this.socketReady = null; }
                        for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.resolve({ ok: false, status: 503, message: 'Live-Verbindung geschlossen.' }); }
                        this.pending.clear();
                        if (this.status === 'connected') { this.status = 'disconnected'; this.emit('onDisconnected', { message: 'Live-Verbindung geschlossen.' }); }
                    };
                    ws.onerror = () => { clearTimeout(timer); resolve(false); };
                } catch { resolve(false); }
            });
            this.socketReady.then(ok => { if (!ok) { this.socketFailed = true; this.socketFailedAt = Date.now(); this.socketReady = null; } });
        }
        return this.socketReady;
    }

    private socketRequest(body: Record<string, any>): Promise<any> {
        return new Promise(resolve => {
            const id = `live-${++this.inputSeqInternal}-${Date.now()}`;
            const timer = setTimeout(() => { this.pending.delete(id); resolve({ ok: false, status: 504, message: 'Live-Synchronisation antwortet nicht.' }); }, 4000);
            this.pending.set(id, { resolve, timer });
            try { this.socket?.send(JSON.stringify({ type: 'live', id, body })); }
            catch { this.pending.delete(id); clearTimeout(timer); resolve({ ok: false, status: 503, message: 'Live-Verbindung fehlgeschlagen.' }); }
        });
    }

    private inputSeqInternal = 0;

    private async request(extra: Record<string, any>): Promise<any> {
        if (this.inflight) return { ok: false, status: 409, message: 'Live-Synchronisation läuft bereits.' };
        if (this.enabled !== true || !this.launchKey || !this.partyId) {
            return this.fail('Live-Synchronisation ist nicht aktiv.');
        }

        this.inflight = (async () => {
            try {
                if (await this.connectSocket()) {
                    return await this.socketRequest({ state: extra.state, input: extra.input, since: extra.since });
                }
                const response = await fetch('/api/cms/party', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ launchKey: this.launchKey, op: 'live', partyId: this.partyId, ...extra })
                });
                const data = await response.json().catch(() => ({ ok: false, message: 'Ungültige Live-Antwort.' }));
                return this.applyResponse(response.status, data);
            } catch (error: any) {
                logger.warn('[TCmsLiveSync] Anfrage fehlgeschlagen:', error);
                return this.fail('Live-Synchronisation nicht erreichbar.', 503);
            } finally {
                this.inflight = null;
            }
        })();

        return this.inflight;
    }

    private applyResponse(statusCode: number, data: any): any {
        if (data?.ok) {
            const wasConnected = this.status === 'connected';
            this.status = 'connected';
            this.lastError = '';
            this.youAreHost = !!data.youAreHost;
            this.memberCount = Number(data.memberCount) || 0;
            this.partyStatus = String(data.status || '');
            this.lastSeq = Number(data.lastSeq ?? this.lastSeq) || this.lastSeq;
            this.live = data.live ?? null;
            this.remoteInput = data.remoteInput ?? null;
            this.actions = Array.isArray(data.actions) ? data.actions : [];
            this.seatIndex = Number(data.seatIndex ?? -1);
            this.memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
            if (!wasConnected) this.emit('onConnected', data);
            this.emit('onLive', data);
            return data;
        }

        this.status = 'disconnected';
        this.lastError = String(data?.message || `Live-Synchronisation fehlgeschlagen (${statusCode}).`);
        this.emit('onError', { status: statusCode, message: this.lastError });
        this.emit('onDisconnected', { status: statusCode, message: this.lastError });
        return { ok: false, status: statusCode, message: this.lastError };
    }

    private fail(message: string, statusCode: number = 409): any {
        const wasConnected = this.status === 'connected';
        this.status = 'disconnected';
        this.lastError = message;
        this.emit('onError', { status: statusCode, message });
        if (wasConnected) this.emit('onDisconnected', { status: statusCode, message });
        return { ok: false, status: statusCode, message };
    }

    private emit(eventName: string, data?: any): void {
        if (this.eventCallback) this.eventCallback(eventName, data);
    }
}

ComponentRegistry.register('TCmsLiveSync', (objData: any) => new TCmsLiveSync(objData.name, objData.x, objData.y));
