import { DebugLogService, LogSource } from '../../services/DebugLogService';
import { TDebugLog } from '../../components/TDebugLog';
import { GameExporter } from '../../export/GameExporter';
import { GameProject } from '../../model/types';
import { attachCmsSpeechHost } from '../../adapters/CmsSpeechHost';

const API = '/api/cms/editor-test';
export function cmsPlayerLimits(project: GameProject): { min: number; max: number } {
    const spec = (project.meta as any)?.multiplayer || (project as any).multiplayer || {};
    return { min: Math.max(2, Number(spec.minPlayers) || 2), max: Math.min(4, Number(spec.maxPlayers) || 2) };
}
async function post(route: string, body: object): Promise<any> {
    const response = await fetch(API + route, { method: 'POST', credentials: 'omit',
        headers: { 'Content-Type': 'application/json', 'X-GCS-Editor-Test': '1' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Testpartie konnte nicht gestartet werden.');
    return data;
}

/** Editor-only host for a shared, isolated CMS party using the normal CMS adapters. */
export function openCmsMultiplayerTest(getProject: () => GameProject, existingViewer?: TDebugLog): void {
    const viewer = existingViewer || new TDebugLog(), logs = DebugLogService.getInstance();
    const wasRecording = logs.isEnabled(), key = 'gcs-mp-preview-' + crypto.randomUUID();
    viewer.setProject(getProject()); viewer.setFilters('', ''); viewer.setRecordingActive(true); viewer.showRuntimeLogs();
    const layer = document.createElement('section'); layer.id = 'gcs-multiplayer-test';
    layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-label', 'Multiplayer testen');
    layer.style.cssText = 'position:fixed;inset:0;z-index:20000;background:#12212c;color:white;padding:12px;padding-right:462px;display:flex;flex-direction:column;gap:10px;font:15px system-ui';
    const bar = document.createElement('div'); bar.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:8px';
    const close = document.createElement('button'); close.textContent = 'Test schließen';
    const count = document.createElement('select'); count.setAttribute('aria-label', 'Spieleranzahl');
    const label = document.createElement('label'); label.textContent = 'Spieleranzahl '; label.append(count);
    const limits = cmsPlayerLimits(getProject());
    for (let i = limits.min; i <= limits.max; i++) { const option = new Option(String(i), String(i)); count.add(option); }
    count.value = String(Math.max(2, limits.min));
    const start = document.createElement('button'); start.textContent = 'Test starten';
    const restart = document.createElement('button'); restart.textContent = 'Änderungen übernehmen und neu starten'; restart.disabled = true;
    const showLogs = document.createElement('button'); showLogs.textContent = 'Debuglogs anzeigen'; showLogs.onclick = () => viewer.showRuntimeLogs();
    const recording = document.createElement('button'); recording.textContent = 'Aufzeichnung stoppen'; recording.onclick = () => viewer.setRecordingActive(!logs.isEnabled());
    const status = document.createElement('span'); status.setAttribute('role', 'status');
    status.textContent = 'Feste Testspieler · aktueller Editorstand · isolierte CMS-Testpartie';
    const panes = document.createElement('div'); panes.style.cssText = 'display:grid;gap:10px;flex:1;min-height:0;overflow:auto';
    bar.append(close, label, start, restart, showLogs, recording, status); layer.append(bar, panes); document.body.append(layer);
    type Player = { launchKey: string; frame: HTMLIFrameElement; source: LogSource; ready?: boolean; liveReady?: boolean; socket?: WebSocket; speech?: ReturnType<typeof attachCmsSpeechHost>; pending: Map<string, (value: any) => void> };
    let players: Player[] = [], run = 0, epoch = 0, disposed = false;
    const updateStatus = () => { if (players.length && players.every(player => player.ready && player.liveReady && player.socket?.readyState === WebSocket.OPEN)) status.textContent = players.length+' Testspieler · Test läuft'; };
    const drain = () => players.forEach(player => {
        try { for (const entry of (player.frame.contentWindow as any)?.__gcsDrainDebugLogs?.() || []) logs.importEntry(entry, player.source); } catch { /* sandbox streams entries by postMessage */ }
    });
    const setRecording = (player: Player) => player.frame.contentWindow?.postMessage({ type: 'debug_recording', instanceId: player.source.instanceId, enabled: logs.isEnabled() }, '*');
    const unsubscribe = logs.subscribeRecording(enabled => { recording.textContent = enabled ? 'Aufzeichnung stoppen' : 'Aufzeichnung starten'; players.forEach(setRecording); });
    const teardown = async () => {
        drain(); const previous = players; players = [];
        previous.forEach(player => { player.socket?.close(); for (const resolve of player.pending.values()) resolve({status:503,data:{ok:false,message:'Test geschlossen.'}}); player.pending.clear(); player.speech?.dispose(); player.frame.remove(); });
        panes.replaceChildren();
        if (previous[0]) try { await post('/close', {launchKey:previous[0].launchKey}); } catch { /* server also expires abandoned contexts */ }
    };
    const onMessage = async (event: MessageEvent) => {
        const player = players.find(player => player.frame.contentWindow === event.source);
        if (!player || !['null', location.origin].includes(event.origin)) return;
        const data = event.data;
        if (data?.type === 'gcs_player_ready' && data.editorTest === key && data.instanceId === player.source.instanceId) { player.ready = true; updateStatus(); return; }
        if (data?.type === 'debug_logs') {
            if (data.editorTest !== key || data.instanceId !== player.source.instanceId || !Array.isArray(data.entries)) return;
            data.entries.slice(0,100).forEach((entry: any) => logs.importEntry(entry, player.source)); setRecording(player); return;
        }
        if (data?.type !== 'gcs-cms-bridge' || typeof data.id !== 'string' || data.id.length > 80 || ![API+'/play',API+'/party'].includes(data.route) || data.body?.launchKey !== player.launchKey || JSON.stringify(data.body).length > 8192) return;
        let result;
        try {
            if (data.route === API+'/party' && data.body.op === 'live') {
                result = await new Promise<any>(resolve => {
                    if (player.socket?.readyState !== WebSocket.OPEN) { resolve({status:503,data:{ok:false,message:'Live-Verbindung noch nicht bereit.'}}); return; }
                    const timer = window.setTimeout(() => { player.pending.delete(data.id); resolve({status:504,data:{ok:false,message:'Live-Sync antwortet nicht.'}}); },5000);
                    player.pending.set(data.id, value => { window.clearTimeout(timer); resolve(value); });
                    player.socket.send(JSON.stringify({type:'live',id:data.id,body:{state:data.body.state,input:data.body.input,since:data.body.since}}));
                });
            } else {
                const response = await fetch(data.route,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(data.body)});
                result = {status:response.status,data:await response.json()};
            }
        } catch { result = {status:503,data:{ok:false,message:'Testserver nicht erreichbar.'}}; }
        if (players.includes(player)) {
            if (data.route === API+'/party' && data.body.op === 'live') {
                player.liveReady = result.data?.ok === true;
                if (!player.liveReady) status.textContent = player.source.label + ': ' + (result.data?.message || 'Live-Synchronisation fehlgeschlagen.');
                else updateStatus();
            }
            player.frame.contentWindow?.postMessage({type:'gcs-cms-result',id:data.id,...result},'*');
        }
    };
    window.addEventListener('message',onMessage);
    close.onclick = () => {
        if (disposed) return; disposed = true; epoch++; drain();
        window.removeEventListener('message',onMessage); unsubscribe(); viewer.setRecordingActive(wasRecording); layer.remove(); void teardown();
    };
    const launch = async () => {
        const generation = ++epoch; start.disabled = restart.disabled = count.disabled = true;
        status.textContent = 'Erzeuge gemeinsame Testpartie …';
        try {
            await teardown();
            if (disposed || generation !== epoch) return;
            const snapshot = new GameExporter().getCleanProject(getProject());
            const result = await post('/multiplayer/start',{project:snapshot,players:Number(count.value)});
            if (disposed || generation !== epoch) { await post('/close',{launchKey:result.players[0].launchKey}); return; }
            run++;
            panes.style.gridTemplateColumns = result.players.length > 2 ? 'repeat(2,minmax(0,1fr))' : 'repeat('+result.players.length+',minmax(0,1fr))';
            panes.style.gridTemplateRows = result.players.length > 2 ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)';
            for (const item of result.players) {
                const pane = document.createElement('div'); pane.style.cssText = 'display:flex;flex-direction:column;min-height:0;min-width:0';
                const title = document.createElement('strong'); title.textContent = item.name + (item.player === 1 ? ' · Gastgeber' : '');
                const frame = document.createElement('iframe'); frame.title = item.name; frame.sandbox.add('allow-scripts','allow-same-origin');
                frame.style.cssText = 'width:100%;flex:1;min-height:0;border:1px solid #527080;background:#08151b';
                const player: Player = {launchKey:item.launchKey,frame,pending:new Map(),source:{player:item.player,label:item.name,instanceId:key.slice(-8)+'-test-'+run+'-p'+item.player}};
                players.push(player);
                player.speech = attachCmsSpeechHost(frame,()=>player.launchKey,API);
                const ws = player.socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${API}/party/live?launchKey=${item.launchKey}`);
                ws.onopen = updateStatus;
                ws.onclose = () => { if (players.includes(player)) status.textContent = 'Verbindung zu ' + item.name + ' unterbrochen. Test neu starten.'; };
                ws.onmessage = event => {
                    if (!players.includes(player)) return;
                    try { const message = JSON.parse(event.data);
                        if (message.type === 'live-result') { const resolve = player.pending.get(message.id); player.pending.delete(message.id); resolve?.({status:message.status,data:message.data}); }
                        else if (message.type === 'live-update') frame.contentWindow?.postMessage({type:'gcs-cms-live',data:message.data},'*');
                    } catch { /* malformed packet */ }
                };
                ws.onerror = () => { if (players.includes(player)) status.textContent = 'Live-Verbindung fehlgeschlagen. CMS-Server mit dem aktuellen v2-Stand neu starten.'; };
                frame.onload = () => { if (!players.includes(player)) return; setRecording(player); updateStatus(); };
                const url = new URL(item.page,location.href); url.search = new URLSearchParams({editorTest:key,instanceId:player.source.instanceId}).toString(); frame.src = url.href;
                pane.append(title,frame); panes.append(pane);
            }
            status.textContent = 'Spieleransichten werden geladen …';
        } catch (error) { status.textContent = error instanceof Error ? error.message : 'CMS-Testserver nicht erreichbar.'; }
        finally { if (!disposed && generation === epoch) { start.disabled = count.disabled = false; restart.disabled = players.length === 0; } }
    };
    start.onclick = restart.onclick = () => void launch();
    if (limits.min > limits.max) { start.disabled = true; status.textContent = 'Dieses Spiel unterstützt keine Spieleranzahl im lokalen Testbereich (2–4).'; }
}
