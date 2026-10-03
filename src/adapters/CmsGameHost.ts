import { DebugLogService } from '../services/DebugLogService';

/** Bridges the existing CMS SpielURL contract to the editor/player browser host. */
export function attachCmsGameHost(getRuntime: () => any): () => void {
    // The CMS server page already includes its original host.
    if (document.querySelector('script[src="/cms-shell.js"]')) return () => {};
    let layer: HTMLElement | undefined;
    let frame: HTMLIFrameElement | undefined;
    let request: AbortController | undefined;
    let partyActionButton: HTMLButtonElement | undefined;
    let disposed = false;
    let host = false;
    let liveSocket: WebSocket | undefined;
    let liveOpening: Promise<WebSocket> | undefined;
    const livePending = new Map<string, {resolve: (value: any) => void; reject: (reason: any) => void; timer: number}>();
    const liveFail = (reason: any) => { for (const pending of livePending.values()) { window.clearTimeout(pending.timer); pending.reject(reason); } livePending.clear(); };
    const liveConnect = (key: string): Promise<WebSocket> => {
        if (liveSocket?.readyState === WebSocket.OPEN) return Promise.resolve(liveSocket);
        if (liveOpening) return liveOpening;
        liveOpening = new Promise<WebSocket>((resolve, reject) => {
            const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/cms/party/live?launchKey=${key}`);
            const timer = window.setTimeout(() => { ws.close(); reject(new Error('Zeitüberschreitung')); }, 5000);
            ws.onopen = () => { window.clearTimeout(timer); liveSocket = ws; resolve(ws); };
            ws.onmessage = event => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'live-result') {
                        const pending = livePending.get(message.id);
                        if (pending) { livePending.delete(message.id); window.clearTimeout(pending.timer); pending.resolve(message); }
                    } else if ((message.type === 'live-update' || (message.type === 'live-result' && message.data)) && launchKey() === key) {
                        frame?.contentWindow?.postMessage({type:'gcs-cms-live',data:message.data},'*');
                    }
                } catch { /* Ungueltige Live-Nachricht ignorieren. */ }
            };
            ws.onclose = () => { if (liveSocket === ws) liveSocket = undefined; liveOpening = undefined; liveFail(new Error('Live-Verbindung geschlossen')); };
            ws.onerror = () => { window.clearTimeout(timer); reject(new Error('Live-Verbindung fehlgeschlagen')); };
        });
        return liveOpening;
    };
    const livePost = async (key: string, id: string, body: any) => {
        try { await liveConnect(key); } catch { return {status: 503, data: {ok: false, message: 'Live-Sync nicht erreichbar.'}}; }
        return await new Promise<{status: number; data: any}>(resolve => {
            const timer = window.setTimeout(() => { livePending.delete(id); resolve({status: 504, data: {ok: false, message: 'Live-Sync antwortet nicht.'}}); }, 5000);
            livePending.set(id, {resolve: (message: any) => resolve({status: message.status || 200, data: message.data}), reject: () => resolve({status: 503, data: {ok: false, message: 'Live-Sync nicht erreichbar.'}}), timer});
            liveSocket?.send(JSON.stringify({type: 'live', id, body: {state: body.state, input: body.input, since: body.since}}));
        });
    };
    const objects = () => getRuntime()?.getObjects() || [];
    const value = (name: string) => objects().find((o: any) => o.name === name)?.value;
    const launchKey = () => frame?.getAttribute('src')?.match(/^\/play\/([a-f0-9]{48})$/)?.[1];
    const onMessage = async (event: MessageEvent) => {
        if (!frame || event.source !== frame.contentWindow || !['null', location.origin].includes(event.origin)) return;
        const data = event.data, key = launchKey();
        if (!key || data?.type !== 'gcs-cms-bridge' || typeof data.id !== 'string' || data.id.length > 80 || !['/api/cms/party', '/api/cms/play'].includes(data.route) || data.body?.launchKey !== key || JSON.stringify(data.body).length > 4096) return;
        if (data.route === '/api/cms/party' && !['list','state','action','begin','end','join','leave','create','live'].includes(data.body.op)) return;
        if (data.route === '/api/cms/play' && !['heartbeat','end','progress','pause','resume','status'].includes(data.body.action)) return;
        let status: number, result: any;
        if (data.body.op === 'live') { const live = await livePost(key, data.id, data.body); status = live.status; result = live.data; }
        else {
            try { const response = await fetch(data.route, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data.body),credentials:'omit'}); status = response.status; result = await response.json(); }
            catch { status = 503; result = {ok:false,message:'Spielserver nicht erreichbar.'}; }
        }
        if (launchKey() === key) frame?.contentWindow?.postMessage({type:'gcs-cms-result',id:data.id,status,data:result}, '*');
    };
    window.addEventListener('message', onMessage);
    const log = (message: string) => DebugLogService.getInstance().log('System', message, {objectName: 'SpielURL'});
    const close = () => {
        request?.abort();
        liveSocket?.close();
        liveSocket = undefined;
        liveFail(new Error('Spiel geschlossen'));
        if (frame) frame.src = 'about:blank';
        layer?.remove();
        layer = undefined;
        frame = undefined;
        partyActionButton = undefined;
    };
    const clearParty = () => { const party = objects().find((o: any) => o.name === 'CMSMpPartyId'); if (party) party.value = ''; };
    const statusPanel = document.createElement('section');
    statusPanel.setAttribute('aria-label', 'Server- und Spielstatus');
    statusPanel.setAttribute('aria-live', 'polite');
    statusPanel.style.cssText = 'position:fixed;right:12px;top:64px;z-index:11000;min-width:240px;max-width:360px;padding:10px 12px;border-radius:10px;background:#102d3a;color:white;font:15px system-ui;box-shadow:0 4px 16px #0008';
    statusPanel.hidden = true;
    const serverLine = document.createElement('div'), gameLine = document.createElement('div'), partyLine = document.createElement('div');
    statusPanel.append(serverLine, gameLine, partyLine);
    document.body.append(statusPanel);
    const setLine = (element: HTMLElement, text: string, tone: 'ok' | 'info' | 'warn' | 'error' = 'info') => {
        element.textContent = text;
        element.hidden = !text;
        element.style.color = {ok: '#9be7c4', info: '#d8f3ff', warn: '#ffd37a', error: '#ff9f9f'}[tone];
        statusPanel.hidden = ![serverLine, gameLine, partyLine].some(line => !line.hidden);
    };
    const names = (value: any) => Array.isArray(value) ? value.filter(Boolean) : [];
    const namesText = (items: any[]) => items.length > 1 ? items.join(', ') : String(items[0] || '');
    const gameText = (status: string, remaining: any) => {
        const labels: Record<string, string> = {active: 'aktiv', paused: 'pausiert', disconnected: 'getrennt', ended: 'beendet'};
        const rest = Number.isFinite(Number(remaining)) ? ` · noch ${Number(remaining)} Min.` : '';
        return 'Spiel: ' + (labels[status] || status || 'unbekannt') + rest;
    };
    const refreshStatus = async () => {
        if (!objects().some((o: any) => o.name === 'CMSServerPruefung')) { statusPanel.hidden = true; return; }
        try {
            const response = await fetch('/api/cms/contexts', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'omit'});
            setLine(serverLine, response.ok ? 'Server: verbunden' : 'Server: nicht erreichbar', response.ok ? 'ok' : 'error');
        } catch { setLine(serverLine, 'Server: nicht erreichbar', 'error'); }
        const key = launchKey();
        if (!key) { setLine(gameLine, ''); return; }
        try {
            const response = await fetch('/api/cms/play', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchKey:key,action:'status'}),credentials:'omit'});
            const data = await response.json();
            if (data.ok) setLine(gameLine, gameText(data.status, data.remainingMinutes), data.status === 'active' ? 'ok' : data.status === 'paused' || data.status === 'disconnected' ? 'warn' : 'error');
            else setLine(gameLine, 'Spiel: ' + (data.message || 'Status unbekannt'), 'warn');
        } catch { setLine(gameLine, 'Spiel: Status nicht erreichbar', 'warn'); }
    };
    const timer = window.setInterval(async () => {
        const objects = getRuntime()?.getObjects() || [];
        if (!objects.some((o: any) => o.name === 'CMSServerPruefung')) return;
        const launch = objects.find((o: any) => o.name === 'SpielURL');
        if (!launch?.value) return;
        const url = String(launch.value);
        host = getRuntime()?.stage?.id === 'stage_multiplayer_lobby';
        launch.value = '';
        close();
        layer = document.createElement('section');
        layer.setAttribute('aria-label', 'CMS-Spiel');
        layer.style.cssText = 'position:fixed;inset:0;background:#08151b;color:white;z-index:10000';
        const back = document.createElement('button');
        back.textContent = '⬅ Spiel schließen';
        back.style.cssText = 'height:52px;font-size:20px;cursor:pointer';
        const status = document.createElement('p');
        status.textContent = 'Spiel wird geladen …';
        back.onclick = () => { close(); clearParty(); log('Spiel geschlossen – Partie kann fortgesetzt werden'); };
        const notice = document.createElement('div');
        notice.style.cssText = 'position:absolute;top:65px;left:15%;right:15%;padding:24px;background:#173d4e;color:white;border:2px solid #58bdb2;border-radius:12px;text-align:center;font:20px system-ui;z-index:2';
        notice.textContent = 'Warte auf die Antwort der eingeladenen Person …';
        notice.hidden = !(value('CMSMpPartyId') && host);
        const partyAction = document.createElement('button');
        partyActionButton = partyAction;
        partyAction.hidden = true;
        partyAction.style.cssText = 'position:absolute;right:12px;top:0;height:52px;font-size:20px;cursor:pointer;z-index:3';
        partyAction.onclick = async () => {
            const key = launchKey(), partyId = value('CMSMpPartyId');
            if (!key || !partyId) { close(); clearParty(); return; }
            try {
                const response = await fetch('/api/cms/party', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchKey:key,partyId,op:host?'end':'leave'})});
                const data = await response.json();
                if (data.ok) { close(); clearParty(); }
                else { status.textContent = data.message || 'Partie konnte nicht beendet werden.'; notice.hidden = false; }
            } catch { status.textContent = 'Server nicht erreichbar.'; notice.hidden = false; }
        };
        layer.append(back, partyAction, status, notice);
        document.body.append(layer);
        if (!/^\/play\/[a-f0-9]{48}$/.test(url)) {
            status.textContent = 'Der Server hat keinen gültigen Spiellink geliefert.';
            log(status.textContent);
            return;
        }
        const controller = new AbortController();
        request = controller;
        const timeout = window.setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(url, {signal: controller.signal, cache: 'no-store'});
            if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
                throw new Error('Spiel konnte nicht geladen werden (HTTP ' + response.status + '). Bitte erneut anmelden und die Freigabe prüfen.');
            }
            await response.body?.cancel();
            if (disposed || request !== controller || !layer) return;
            frame = document.createElement('iframe');
            frame.title = 'Ausgewähltes Spiel';
            frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            frame.style.cssText = 'display:block;width:100%;height:calc(100% - 52px);border:0';
            frame.src = url;
            status.remove();
            layer.append(frame);
            log('Freigegebenes Spiel im Player geöffnet');
        } catch (error) {
            if (disposed || request !== controller || !layer) return;
            status.textContent = controller.signal.aborted
                ? 'Der Spielserver antwortet nicht rechtzeitig. Bitte erneut versuchen.'
                : error instanceof Error ? error.message : 'Spielserver nicht erreichbar.';
            log(status.textContent);
        } finally { window.clearTimeout(timeout); }
    }, 100);
    const invitation = document.createElement('section');
    invitation.setAttribute('role', 'dialog'); invitation.setAttribute('aria-modal', 'true'); invitation.setAttribute('aria-label', 'Spieleinladung');
    invitation.hidden = true;
    invitation.style.cssText = 'position:fixed;inset:0;background:#08151bd9;color:white;z-index:10001;font:20px system-ui';
    const card = document.createElement('div');
    card.style.cssText = 'max-width:560px;margin:15vh auto;padding:32px;background:#173d4e;border:2px solid #58bdb2;border-radius:14px;text-align:center';
    const inviteText = document.createElement('p'), accept = document.createElement('button'), decline = document.createElement('button');
    accept.textContent = 'Annehmen & spielen'; decline.textContent = 'Ablehnen';
    for (const button of [accept, decline]) button.style.cssText = 'padding:12px;margin:8px;font:18px system-ui;cursor:pointer';
    card.append(inviteText, accept, decline); invitation.append(card); document.body.append(invitation);
    let pending = '', responding = false, loading = false;
    const respond = async (choice: boolean) => {
        if (!pending || responding) return;
        responding = true;
        try {
            const response = await fetch('/api/cms/mp/respond', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:value('Token'),invitationId:pending,accept:choice})});
            const data = await response.json();
            if (data.ok) {
                invitation.hidden = true; pending = '';
                if (choice) {
                    const party = objects().find((o: any) => o.name === 'CMSMpPartyId'), launch = objects().find((o: any) => o.name === 'SpielURL');
                    if (party) party.value = data.partyId;
                    if (launch) launch.value = data.launch;
                }
            } else inviteText.textContent = data.message || 'Einladung nicht mehr gültig.';
        } catch { inviteText.textContent = 'Server nicht erreichbar.'; }
        finally { responding = false; }
    };
    accept.onclick = () => respond(true); decline.onclick = () => respond(false);
    const inboxTimer = window.setInterval(async () => {
        const token = value('Token');
        if (!token || loading || responding || !objects().some((o: any) => o.name === 'CMSServerPruefung')) return;
        loading = true;
        try {
            const response = await fetch('/api/cms/mp/invitations', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
            const data = await response.json(), item = data.items?.find((i: any) => i.status === 'pending' && Number(i.expiresAt) > Date.now());
            if (item) { pending = item.id; inviteText.textContent = `${item.host} lädt dich ein, ${item.game} im Raum ${item.room} zu spielen.`; invitation.hidden = false; }
            else { pending = ''; invitation.hidden = true; }
        } catch {}
        finally { loading = false; }
    }, 3000);
    const partyTimer = window.setInterval(async () => {
        const key = launchKey(), partyId = value('CMSMpPartyId'), notice = layer?.querySelector('div') as HTMLElement | undefined;
        if (!key || !partyId) { setLine(partyLine, ''); return; }
        try {
            const response = await fetch('/api/cms/party', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchKey:key,partyId,op:'state',since:0})});
            const data = await response.json();
            if (!data.ok) { setLine(partyLine, 'Partie: ' + (data.message || 'Status unbekannt'), 'warn'); return; }
            host = data.youAreHost;
            const departed = names(data.departedNames), disconnected = names(data.disconnectedNames);
            const messages: string[] = [];
            if (data.status === 'ended' || data.ended) messages.push('Die Partie wurde beendet.');
            if (departed.length) messages.push(namesText(departed) + (departed.length > 1 ? ' haben die Partie verlassen.' : ' hat die Partie verlassen.'));
            if (disconnected.length) messages.push(namesText(disconnected) + (disconnected.length > 1 ? ' sind vorübergehend getrennt.' : ' ist vorübergehend getrennt.'));
            if (data.invitationStatus === 'declined') messages.push(data.inviteeName + ' hat die Einladung abgelehnt.');
            if (data.invitationStatus === 'expired') messages.push(data.inviteeName + ' hat nicht rechtzeitig geantwortet.');
            const summary = data.status === 'ended' ? 'beendet' : data.memberCount + ' aktiv' + (departed.length ? ' · ' + departed.length + ' verlassen' : '') + (disconnected.length ? ' · ' + disconnected.length + ' getrennt' : '');
            setLine(partyLine, 'Partie: ' + summary, data.status === 'ended' || departed.length ? 'error' : disconnected.length ? 'warn' : 'ok');
            if (partyActionButton) { partyActionButton.hidden = data.status === 'ended'; partyActionButton.textContent = host ? 'Partie beenden' : 'Partie verlassen'; }
            if (notice) {
                if (messages.length) { notice.textContent = messages.join(' '); notice.hidden = false; }
                else if (host && data.status === 'open') { notice.textContent = 'Warte auf die Antwort von ' + data.inviteeName + ' …'; notice.hidden = false; }
                else notice.hidden = true;
            }
        } catch { setLine(partyLine, 'Partie: Status nicht erreichbar', 'warn'); }
    }, 3000);
    const statusTimer = window.setInterval(refreshStatus, 5000);
    refreshStatus();
    return () => { disposed = true; window.clearInterval(timer); window.clearInterval(inboxTimer); window.clearInterval(partyTimer); window.clearInterval(statusTimer); window.removeEventListener('message', onMessage); invitation.remove(); statusPanel.remove(); close(); };
}
