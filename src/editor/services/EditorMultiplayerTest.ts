import { openCmsMultiplayerTest } from './EditorCmsMultiplayerTest';
import { DebugLogService, LogSource } from '../../services/DebugLogService';
import { TDebugLog } from '../../components/TDebugLog';
import { GameExporter } from '../../export/GameExporter';
import { GameProject } from '../../model/types';

/** Two independent players using a snapshot of the editor project. */
export function openMultiplayerTest(project: GameProject, existingViewer?: TDebugLog, getProject: () => GameProject = () => project): void {
    document.querySelector<HTMLButtonElement>('#gcs-multiplayer-test button')?.click();
    const snapshot = new GameExporter().getCleanProject(project);
    const objects = [...(snapshot.objects || []), ...(snapshot.stages || []).flatMap((stage: any) => stage.objects || [])];
    if (objects.some((object: any) => ['TCmsLiveSync', 'TServerParty'].includes(object.className))) {
        openCmsMultiplayerTest(getProject, existingViewer); return;
    }
    const key = 'gcs-mp-preview-' + crypto.randomUUID();
    const viewer = existingViewer || ((window as any).__multiplayerDebugViewer ||= new TDebugLog());
    const service = DebugLogService.getInstance();
    const wasRecording = service.isEnabled();
    viewer.setProject(project);
    viewer.setFilters('', '');
    viewer.setRecordingActive(true);
    viewer.showRuntimeLogs();
    let run = 0;
    let sources: LogSource[] = [];
    const layer = document.createElement('section');
    layer.id = 'gcs-multiplayer-test';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-label', 'Multiplayer testen');
    layer.style.cssText = 'position:fixed;inset:0;z-index:20000;background:#12212c;color:white;padding:12px;padding-right:462px;display:flex;flex-direction:column;gap:10px;font:16px sans-serif';
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:6px';
    const close = document.createElement('button');
    close.textContent = 'Test schließen';
    const restart = document.createElement('button');
    restart.textContent = 'Test neu starten';
    const logs = document.createElement('button');
    logs.textContent = 'Debuglogs anzeigen';
    logs.onclick = () => viewer.showRuntimeLogs();
    const recording = document.createElement('button');
    recording.textContent = 'Aufzeichnung stoppen';
    recording.onclick = () => viewer.setRecordingActive(!service.isEnabled());
    const status = document.createElement('span');
    status.style.marginLeft = '16px';
    const hint = document.createElement('p');
    hint.textContent = 'Zwei Spieler mit dem aktuellen Projektstand. Zum Bedienen in die jeweilige Ansicht klicken. Änderungen im Editor werden beim nächsten Öffnen übernommen.';
    const panes = document.createElement('div');
    panes.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1;min-height:0';
    const frames = [1, 2].map(number => {
        const pane = document.createElement('div');
        pane.style.cssText = 'display:flex;flex-direction:column;min-width:0';
        const label = document.createElement('strong'); label.textContent = 'Spieler ' + number;
        const frame = document.createElement('iframe'); frame.title = label.textContent;
        frame.style.cssText = 'width:100%;flex:1;border:1px solid #527080;background:#08151b';
        pane.append(label, frame); panes.append(pane); return frame;
    });
    const countLabel = document.createElement('label'); countLabel.textContent = 'Spieleranzahl ';
    const count = document.createElement('select'); count.setAttribute('aria-label', 'Spieleranzahl');
    count.add(new Option('2', '2')); count.disabled = true; count.title = 'Der allgemeine Game-Server-Raum unterstützt genau zwei Spieler.';
    countLabel.append(count);
    bar.append(close, countLabel, restart, logs, recording, status); layer.append(bar, hint, panes); document.body.append(layer);
    const drainPlayers = () => frames.forEach((frame, index) => {
        try {
            const entries = (frame.contentWindow as any)?.__gcsDrainDebugLogs?.() || [];
            if (sources[index]) entries.forEach((entry: any) => service.importEntry(entry, sources[index]));
        } catch { /* A navigating iframe may not expose its previous document. */ }
    });
    const unsubscribeRecording = service.subscribeRecording(enabled => {
        recording.textContent = enabled ? 'Aufzeichnung stoppen' : 'Aufzeichnung starten';
        frames.forEach((frame, index) => {
        frame.contentWindow?.postMessage({type:'debug_recording', instanceId:sources[index]?.instanceId, enabled}, location.origin);
        });
    });
    let timer: number | undefined;
    const dispose = () => { drainPlayers(); window.clearTimeout(timer); window.removeEventListener('message', onMessage); unsubscribeRecording(); sessionStorage.removeItem(key); frames.forEach(frame => frame.src = 'about:blank'); viewer.setRecordingActive(wasRecording); layer.remove(); };
    close.onclick = dispose;
    const url = (params: Record<string, string>) => { const u = new URL('player.html', location.href); u.search = new URLSearchParams({...params, editorTest: key}).toString(); return u.href; };
    const start = () => {
        window.clearTimeout(timer);
        drainPlayers();
        run++;
        sources = [1, 2].map(player => ({player, instanceId:key.slice(-8) + '-test-' + run + '-p' + player, label:'Spieler ' + player}));
        frames.forEach(frame => frame.src = 'about:blank');
        status.textContent = 'Verbinde mit dem Game-Server …';
        try { sessionStorage.setItem(key, JSON.stringify(snapshot)); frames[0].src = url({preview: key, instanceId:sources[0].instanceId}); }
        catch { status.textContent = 'Projekt konnte nicht für den Test gespeichert werden.'; return; }
        timer = window.setTimeout(() => { status.textContent = 'Kein Spielstart. Game-Server über npm start starten; bei CMS-Spielen den unten beschriebenen CMS-Test verwenden.'; }, 20000);
    };
    const onMessage = (event: MessageEvent) => {
        if (event.origin !== location.origin || event.data?.editorTest !== key || !frames.some(frame => frame.contentWindow === event.source)) return;
        const index = frames.findIndex(frame => frame.contentWindow === event.source);
        if (event.data.type === 'debug_logs') {
            if (event.data.instanceId !== sources[index]?.instanceId || !Array.isArray(event.data.entries)) return;
            frames[index].contentWindow?.postMessage({type:'debug_recording', instanceId:sources[index].instanceId, enabled:service.isEnabled()}, location.origin);
            event.data.entries.slice(0, 100).forEach((entry: any) => service.importEntry(entry, sources[index]));
            return;
        }
        if (event.data.type === 'room_created' && event.source === frames[0].contentWindow) {
            status.textContent = 'Raum ' + event.data.roomCode + ' · Spieler 2 tritt bei …';
            frames[1].src = url({room: event.data.roomCode, instanceId:sources[1].instanceId});
        } else if (event.data.type === 'game_start') { window.clearTimeout(timer); status.textContent = 'Beide Spieler verbunden · Test läuft'; }
        else if (event.data.type === 'error') { window.clearTimeout(timer); status.textContent = event.data.message; }
    };
    window.addEventListener('message', onMessage); restart.onclick = start;
    start();
}
