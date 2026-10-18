// CMS-Testkontext im RunTab: startet das aktuelle Editorprojekt (inklusive
// ungespeicherter Änderungen) in einer isolierten CMS-Testumgebung mit
// synthetischem Testkind und zurücksetzbarem Karteikasten. Das Testspielfeld
// ersetzt die RunStage-Fläche vollständig — die Direkt-Runtime ist für
// CMS-Projekte ohnehin nicht bespielbar. Alle fachlichen Prüfungen laufen über
// die üblichen CMS-Adapter des Servers; echte CMS-Daten werden nie angefasst
// (scripts/cms/cms-editor-test.cjs).
import { attachCmsSpeechHost } from '../../adapters/CmsSpeechHost';

const API = '/api/cms/editor-test';
const BRIDGE_ROUTES = new Set([API + '/play', API + '/party']);

export function projectUsesCms(project: any): boolean {
    return !!project?.stages?.some((stage: any) => stage.variables?.some((v: any) => v.name === 'CMS_LAUNCH'));
}

async function post(route: string, body: object) {
    try {
        const response = await fetch(API + route, { method: 'POST', credentials: 'omit',
            headers: { 'Content-Type': 'application/json', 'X-GCS-Editor-Test': '1' }, body: JSON.stringify(body) });
        return await response.json();
    } catch {
        return { ok: false, message: 'CMS-Server nicht erreichbar (läuft er auf Port 8081?).' };
    }
}

let active: { overlay: HTMLElement; teardown: () => Promise<void> } | null = null;

export async function closeEditorCmsTest(): Promise<void> {
    const current = active; active = null;
    if (current) { await current.teardown(); current.overlay.remove(); }
}

export function openEditorCmsTest(getProject: () => any): void {
    void closeEditorCmsTest();
    const host = document.getElementById('view-content');
    if (!host) return;

    const players = [['test-a', 'Testkind A'], ['test-b', 'Testkind B'], ['test-c', 'Testkind C']]
        .map(([value, name]) => `<option value="${value}">${name}</option>`).join('');
    const overlay = document.createElement('div');
    overlay.id = 'cms-test-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:600;display:flex;flex-direction:column;background:#0e1f26';
    overlay.innerHTML = `<div id="ct-bar" style="display:flex;align-items:center;gap:8px;padding:6px 10px;
            background:#122a32;border-bottom:1px solid #2a8a7e;color:#edf7f4;font:13px Segoe UI;flex-shrink:0">
        <b style="color:#ffd166">🧪 CMS-Testkontext</b>
        <select id="ct-player">${players}</select>
        <select id="ct-deck"><option value="math">Kleines Einmaleins</option><option value="self">Selbsteinschätzung</option><option value="empty">Leer</option></select>
        <button id="ct-start">▶ Test starten</button>
        <button id="ct-reset">↺ Neu starten</button>
        <span id="ct-status" style="color:#ffd166;margin-left:auto"></span>
        <button id="ct-close" title="Testkontext schließen">✕</button>
    </div>
    <div id="ct-frame" style="flex:1;position:relative;overflow:hidden;background:#08151b"></div>`;
    host.appendChild(overlay);

    const status = overlay.querySelector('#ct-status') as HTMLSpanElement;
    const holder = overlay.querySelector('#ct-frame') as HTMLDivElement;
    const frame = document.createElement('iframe');
    frame.sandbox.add('allow-scripts'); frame.sandbox.add('allow-same-origin');
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
    let launchKey = '', speech: { dispose: () => void } | null = null;
    let bridgeListener: ((event: MessageEvent) => void) | null = null;

    // Bridge-Weiterleitung: gleicher Vertrag wie CmsGameHost — das Spiel selbst
    // erfährt nichts vom Testkontext, nur die Transportziele sind getrennt.
    const attachBridge = () => {
        bridgeListener = async (event: MessageEvent) => {
            const data = event.data;
            if (event.source !== frame.contentWindow || !['null', location.origin].includes(event.origin)
                || data?.type !== 'gcs-cms-bridge' || typeof data.id !== 'string') return;
            if (!BRIDGE_ROUTES.has(data.route) || data.body?.launchKey !== launchKey) {
                console.warn('[CMS-TEST] Bridge-Anfrage abgelehnt:', data.route, 'launchKey passt:', data.body?.launchKey === launchKey);
                return;
            }
            try {
                const response = await fetch(data.route, { method: 'POST', credentials: 'omit',
                    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data.body) });
                const result = await response.json();
                if (!result?.ok) console.warn('[CMS-TEST] Server meldet:', response.status, result?.message, 'für', data.body?.action);
                else if (data.body?.action && data.body.action !== 'heartbeat') console.info('[CMS-TEST]', data.body.action, '→ ok');
                frame.contentWindow?.postMessage({ type: 'gcs-cms-result', id: data.id, status: response.status, data: result }, '*');
            } catch (e) {
                console.error('[CMS-TEST] Bridge-Transport fehlgeschlagen:', e);
                // Status 502 statt 0: new Response() akzeptiert nur 200–599,
                // mit 0 würde der Promise im Spiel ewig hängen bleiben.
                frame.contentWindow?.postMessage({ type: 'gcs-cms-result', id: data.id, status: 502, data: { ok: false, message: 'Testkontext nicht erreichbar.' } }, '*');
            }
        };
        window.addEventListener('message', bridgeListener);
    };

    const teardown = async () => {
        if (bridgeListener) { window.removeEventListener('message', bridgeListener); bridgeListener = null; }
        speech?.dispose(); speech = null; frame.remove();
        if (launchKey) { await post('/close', { launchKey }); launchKey = ''; }
    };
    active = { overlay, teardown };

    const start = async () => {
        await teardown();
        status.textContent = 'Erzeuge Testsitzung…';
        const result = await post('/start', { project: JSON.parse(JSON.stringify(getProject())),
            player: (overlay.querySelector('#ct-player') as HTMLSelectElement).value,
            deck: (overlay.querySelector('#ct-deck') as HTMLSelectElement).value });
        if (!result?.ok) { status.textContent = result?.message || 'Testkontext nicht verfügbar — läuft der CMS-Server?'; return; }
        launchKey = result.launchKey;
        attachBridge();
        speech = attachCmsSpeechHost(frame, () => launchKey, API);
        frame.onload = () => { status.textContent = `Läuft als ${result.player} · ${result.cards} Testkarten`; };
        frame.src = result.page;
        holder.appendChild(frame);
        status.textContent = 'Spiel wird geladen…';
    };

    overlay.querySelector('#ct-start')!.addEventListener('click', () => void start());
    overlay.querySelector('#ct-reset')!.addEventListener('click', () => void start());
    overlay.querySelector('#ct-close')!.addEventListener('click', () => void closeEditorCmsTest());
    status.textContent = 'Testspieler und Stapel wählen, dann starten';
}
