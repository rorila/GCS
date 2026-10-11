import { SpeechAudioCapture, type SpeechInputLevel } from './SpeechAudioCapture';
import { attachCmsTtsHost } from './CmsTtsHost';

export function validSpeechMessage(event: MessageEvent, frameWindow: Window | null, origin: string, key: string | undefined): boolean {
    const data = event.data;
    return !!frameWindow && !!key && /^[a-f0-9]{48}$/.test(key) && event.source === frameWindow && ['null', origin].includes(event.origin)
        && data?.type === 'gcs-speech' && data.launchKey === key && typeof data.clientId === 'string' && /^[a-f0-9-]{36}$/.test(data.clientId)
        && ['prepare', 'listen', 'stop', 'cancel'].includes(data.operation)
        && (['stop', 'cancel'].includes(data.operation) || (typeof data.id === 'string' && /^[a-f0-9-]{36}$/.test(data.id)));
}

export function attachCmsSpeechHost(frame: HTMLIFrameElement, getKey: () => string | undefined, apiBase = '/api/cms'): { cancel: () => void; dispose: () => void } {
    const capture = new SpeechAudioCapture();
    const tts = attachCmsTtsHost(frame, getKey, apiBase);
    let granted = '', pending: { key: string; clientId: string; id: string; controller: AbortController } | undefined;
    const panel = document.createElement('section'), label = document.createElement('span'), allow = document.createElement('button'), stop = document.createElement('button');
    panel.setAttribute('aria-label', 'Mikrofonfreigabe'); label.setAttribute('aria-live', 'polite');
    panel.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:12000;background:#173d4e;color:white;padding:12px;font:18px system-ui;border:2px solid #58bdb2';
    allow.textContent = 'Mikrofon für dieses Spiel freigeben'; stop.textContent = 'Mikrofon ausschalten';
    for (const button of [allow, stop]) button.style.cssText = 'font:18px system-ui;padding:10px;margin-left:12px';
    const meterRow = document.createElement('div'), meter = document.createElement('meter'), signalLabel = document.createElement('span');
    meter.min = 0; meter.max = 100; meter.value = 0;
    meter.setAttribute('aria-label', 'Mikrofon-Eingangspegel');
    meter.style.cssText = 'width:180px;height:24px;vertical-align:middle;margin-right:10px';
    meterRow.style.cssText = 'margin-top:8px;font-size:15px';
    panel.style.maxWidth = 'calc(100vw - 52px)';
    let inputLevel: SpeechInputLevel | undefined;
    const resetMeter = (text = 'Mikrofon aus · keine Aufnahme') => {
        inputLevel = undefined; meter.value = 0; signalLabel.textContent = text;
    };
    const showLevel = (level: SpeechInputLevel) => {
        inputLevel = level;
        // Logarithmisch: auch leise Eingaben sind sichtbar. Kein Lautstaerkeregler.
        meter.value = Math.max(0, Math.min(100, (20 * Math.log10(Math.max(level.rms, 0.000001)) + 60) / 60 * 100));
        signalLabel.textContent = level.rms > 0.001
            ? 'Ton kommt an · ' + (level.audioMs / 1000).toFixed(1) + ' s aufgenommen'
            : 'Aufnahme läuft · aktuell sehr leise / kein Ton';
    };
    const finishMeter = () => {
        meter.value = 0;
        signalLabel.textContent = !inputLevel ? 'Keine Audiodaten angekommen.'
            : inputLevel.speechDetected ? 'Aufnahme beendet · Ton angekommen · ' + (inputLevel.audioMs / 1000).toFixed(1) + ' s'
            : inputLevel.peakRms > 0.001 ? 'Ton angekommen, aber für die Erkennung zu leise oder zu kurz.'
            : 'Aufnahme beendet · kein hörbarer Eingangspegel.';
    };
    resetMeter(); meterRow.append(meter, signalLabel);
    panel.append(label, allow, stop, meterRow); panel.hidden = true; document.body.append(panel);
    const respond = (operation: NonNullable<typeof pending>, result: Record<string, unknown>) => {
        if (getKey() === operation.key) frame.contentWindow?.postMessage({ type: 'gcs-speech-result', id: operation.id, clientId: operation.clientId, ...result }, '*');
    };
    const cancel = () => {
        const current = pending;
        pending = undefined; granted = ''; panel.hidden = true; resetMeter();
        current?.controller.abort(); capture.dispose(); tts.setRecording(false); tts.cancel();
        if (current) respond(current, { ok: false, message: 'Mikrofon ausgeschaltet.' });
    };
    stop.onclick = cancel;
    const onMessage = async (event: MessageEvent) => {
        const key = getKey();
        if (!validSpeechMessage(event, frame.contentWindow, location.origin, key)) return;
        const data = event.data;
        if (data.operation === 'cancel' || data.operation === 'stop') {
            if (pending && pending.clientId === data.clientId) {
                if (data.operation === 'stop') capture.stop();
                else { pending.controller.abort(); pending = undefined; capture.stop(); tts.setRecording(false); resetMeter(); label.textContent = 'Mikrofon bereit, keine Aufnahme.'; }
            }
            return;
        }
        const operation = { key: key!, clientId: data.clientId as string, id: data.id as string, controller: new AbortController() };
        if (pending) { respond(operation, { ok: false, message: 'Eine Aufnahme läuft bereits.' }); return; }
        pending = operation;
        tts.setRecording(data.operation === 'listen');
        const { signal } = operation.controller;
        let outcome = ''; 
        const timeout = window.setTimeout(() => operation.controller.abort(), data.operation === 'prepare' ? 85000 : 40000);
        try {
            if (data.operation === 'prepare') {
                const response = await fetch(apiBase + '/speech/status', { method: 'POST', headers: { 'X-GCS-Launch': key! }, signal, credentials: 'omit' });
                const result = await response.json();
                if (!response.ok || !result.ok) throw new Error(result.message || 'Spracherkennung nicht verfügbar.');
                if (signal.aborted) return;
                panel.hidden = false; label.textContent = 'Die Antwort wird an den eigenen Spracherkennungsdienst gesendet. ';
                allow.hidden = false;
                await new Promise<void>((resolve, reject) => {
                    const aborted = () => reject(new Error('Mikrofonfreigabe abgebrochen.'));
                    signal.addEventListener('abort', aborted, { once: true });
                    allow.onclick = event => {
                        if (!event.isTrusted) return;
                        allow.disabled = true;
                        void capture.prepare().then(resolve, reject).finally(() => { allow.disabled = false; signal.removeEventListener('abort', aborted); });
                    };
                });
                if (signal.aborted || pending !== operation) return;
                granted = key!; allow.hidden = true; resetMeter('Mikrofon freigegeben · wartet auf die Aufnahme im Spiel'); label.textContent = 'Mikrofon bereit, keine Aufnahme.';
                respond(operation, { ok: true });
            } else {
                if (granted !== key) throw new Error('Mikrofon zuerst im Spielhost freigeben.');
                const options = data.options || {};
                if (options.language !== 'de-DE' && options.language !== 'de') throw new Error('Diese Erkennung unterstützt Deutsch.');
                const duration = Number(options.maxDurationMs), silence = Number(options.silenceMs);
                if (!Number.isFinite(duration) || duration < 2000 || duration > 15000 || !Number.isFinite(silence) || silence < 600 || silence > 3000) throw new Error('Ungültige Aufnahmegrenzen.');
                const prompt = typeof options.prompt === 'string' ? options.prompt.trim() : '';
                if (prompt.length > 240) throw new Error('Der Erkennungshinweis ist zu lang.');
                const access = await fetch(apiBase + '/speech/status', { method: 'POST', headers: { 'X-GCS-Launch': key! }, signal, credentials: 'omit' });
                if (!access.ok) throw new Error('Keine aktive Spracheingabe-Berechtigung.');
                if (signal.aborted || pending !== operation) return;
                panel.hidden = false; label.textContent = 'Mikrofon nimmt auf – bitte antworten.';
                resetMeter('Aufnahme startet · wartet auf Audiodaten');
                const wav = await capture.capture(duration, silence, signal, level => {
                    if (!signal.aborted && pending === operation) showLevel(level);
                });
                if (pending === operation) finishMeter();
                if (signal.aborted || pending !== operation) return;
                label.textContent = wav ? 'Antwort wird erkannt; Mikrofon ist aus.' : 'Keine Sprache erkannt.';
                if (!wav) { outcome = 'Keine Sprache erkannt. Noch einmal sprechen oder Tastatur wählen.'; respond(operation, { ok: true, text: '' }); }
                else {
                    const headers: Record<string, string> = { 'Content-Type': 'audio/wav', 'X-GCS-Launch': key!, 'X-Speech-Language': options.language };
                    if (prompt) headers['X-Speech-Prompt'] = encodeURIComponent(prompt);
                    const response = await fetch(apiBase + '/speech', { method: 'POST', headers, body: new Blob([wav as BlobPart], { type: 'audio/wav' }), credentials: 'omit', signal });
                    const result = await response.json();
                    if (!response.ok || !result.ok) throw new Error(result.message || 'Spracherkennung fehlgeschlagen.');
                    if (!signal.aborted && pending === operation) {
                        outcome = result.text ? 'Erkannt: ' + result.text : 'Keine Antwort erkannt.';
                        respond(operation, { ok: true, text: result.text });
                    }
                }
            }
        } catch (error) {
            if (pending === operation) {
                finishMeter();
                outcome = signal.aborted ? 'Spracherkennung abgebrochen oder Zeitlimit erreicht.' : error instanceof Error ? error.message : 'Spracherkennung fehlgeschlagen.';
                respond(operation, { ok: false, message: outcome });
            }
        } finally {
            window.clearTimeout(timeout);
            if (pending === operation) { pending = undefined; tts.setRecording(false); label.textContent = outcome || (granted ? 'Mikrofon bereit, keine Aufnahme.' : 'Keine Aufnahme. Spracheingabe erneut starten oder Tastatur wählen.'); allow.hidden = true; }
        }
    };
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener('message', onMessage); window.addEventListener('pagehide', cancel);
    document.addEventListener('visibilitychange', hidden); frame.addEventListener('load', cancel);
    return { cancel, dispose: () => {
        cancel(); tts.dispose(); panel.remove(); window.removeEventListener('message', onMessage); window.removeEventListener('pagehide', cancel);
        document.removeEventListener('visibilitychange', hidden); frame.removeEventListener('load', cancel);
    } };
}
