/** Eigener Kanal für Sprache; nutzt die bestehenden Launch- und Frame-Grenzen. */
export function attachCmsTtsHost(frame: HTMLIFrameElement, getKey: () => string | undefined, apiBase = '/api/cms') {
    const pending = new Map<string, AbortController>();
    const panel = document.createElement('details'), summary = document.createElement('summary');
    const select = document.createElement('select'), preview = document.createElement('button'), note = document.createElement('div');
    panel.hidden = true; panel.setAttribute('aria-label', 'Stimmenauswahl');
    panel.style.cssText = 'position:fixed;left:12px;top:64px;z-index:12000;max-width:calc(100vw - 48px);padding:10px 14px;background:#173d4e;color:white;border:2px solid #58bdb2;border-radius:10px;font:17px system-ui';
    summary.textContent = 'Stimme auswählen'; select.setAttribute('aria-label', 'Stimme'); preview.textContent = 'Hörprobe';
    for (const element of [select, preview]) element.style.cssText = 'font:inherit;padding:8px;margin:8px 8px 0 0';
    note.setAttribute('aria-live', 'polite'); note.style.cssText = 'max-width:320px;font-size:14px;margin-top:6px';
    panel.append(summary, select, preview, note); document.body.append(panel);
    let sample: HTMLAudioElement | undefined, sampleUrl = '', preferenceRequest: AbortController | undefined;
    let recording = false, previewing = false, disposed = false;
    const stopSample = () => {
        sample?.pause(); sample?.removeAttribute('src'); sample = undefined;
        if (sampleUrl) URL.revokeObjectURL(sampleUrl); sampleUrl = '';
    };
    const preferences = async (op: string, key: string, voice?: string) => {
        preferenceRequest?.abort(); const controller = new AbortController(); preferenceRequest = controller;
        const timer = window.setTimeout(() => controller.abort(), 45_000);
        try {
            const response = await fetch(apiBase + '/tts/preferences', { method: 'POST', credentials: 'omit', signal: controller.signal,
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ launchKey: key, op, voice }) });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.message || 'Stimme nicht verfügbar.');
            if (getKey() !== key || controller.signal.aborted) throw new Error('Spiel geschlossen.');
            return result;
        } finally { window.clearTimeout(timer); if (preferenceRequest === controller) preferenceRequest = undefined; }
    };
    const loadPreferences = async () => {
        const key = getKey(); panel.hidden = true; panel.open = false; stopSample();
        if (!key) return;
        try {
            const result = await preferences('state', key); select.replaceChildren();
            for (const voice of result.voices) { const option = document.createElement('option'); option.value = voice.id; option.textContent = voice.name; select.append(option); }
            select.value = result.voice; summary.textContent = 'Stimme: ' + select.selectedOptions[0]?.textContent;
            note.textContent = 'Wechsel gilt ab der nächsten Ansage.'; panel.hidden = false;
        } catch { /* Preview and inactive launches do not offer a player setting. */ }
    };
    select.onchange = async () => {
        const key = getKey(); if (!key) return; select.disabled = true; preview.disabled = true; stopSample();
        try {
            await preferences('set', key, select.value); summary.textContent = 'Stimme: ' + select.selectedOptions[0]?.textContent;
            note.textContent = 'Gespeichert · ab der nächsten Ansage.';
        } catch (error) { note.textContent = (error as Error).message; }
        finally { select.disabled = false; preview.disabled = recording; }
    };
    preview.onclick = async () => {
        const key = getKey(); if (!key || recording) return; previewing = true; preview.disabled = true; select.disabled = true; stopSample(); note.textContent = 'Hörprobe wird vorbereitet …';
        try {
            const result = await preferences('preview', key, select.value);
            const bytes = Uint8Array.from(atob(result.audio), char => char.charCodeAt(0));
            sampleUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })); sample = new Audio(sampleUrl);
            sample.onended = stopSample; await sample.play(); note.textContent = 'Hörprobe: ' + select.selectedOptions[0]?.textContent;
        } catch (error) { stopSample(); note.textContent = (error as Error).message; }
        finally { previewing = false; preview.disabled = recording; select.disabled = false; }
    };
    const cancel = () => {
        for (const controller of pending.values()) controller.abort(); pending.clear();
        preferenceRequest?.abort(); stopSample(); if (!getKey()) panel.hidden = true;
    };
    const setRecording = (active: boolean) => {
        recording = active;
        if (active) { stopSample(); if (previewing) preferenceRequest?.abort(); }
        preview.disabled = active || previewing || select.disabled;
    };
    const listener = async (event: MessageEvent) => {
        const data = event.data, key = getKey();
        if (!key || event.source !== frame.contentWindow || !['null', location.origin].includes(event.origin)
            || data?.type !== 'gcs-tts' || data.launchKey !== key || typeof data.id !== 'string'
            || !/^[a-f0-9-]{36}$/.test(data.id)) return;
        if (data.operation === 'cancel') { pending.get(data.id)?.abort(); return; }
        if (data.operation !== 'prepare' || typeof data.text !== 'string' || data.text.length > 500
            || typeof data.voice !== 'string' || data.voice.length > 80) return;
        const reply = (result: object) => {
            if (getKey() === key) frame.contentWindow?.postMessage({ type: 'gcs-tts-result', id: data.id, ...result }, '*');
        };
        if (pending.size >= 3 || pending.has(data.id)) { reply({ ok: false, message: 'Sprachausgabe beschäftigt.' }); return; }
        const controller = new AbortController();
        pending.set(data.id, controller);
        const timer = window.setTimeout(() => controller.abort(), 45_000);
        try {
            const response = await fetch(apiBase + '/tts', { method: 'POST', credentials: 'omit', signal: controller.signal,
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ launchKey: key, text: data.text, voice: data.voice }) });
            const result = await response.json();
            if (result.fallback && getKey() === key) note.textContent = 'Gewählte Stimme nicht verfügbar · Standardstimme wird verwendet.';
            if (!controller.signal.aborted) reply(result);
        } catch { if (getKey() === key) reply({ ok: false, message: 'Sprachausgabe nicht erreichbar oder abgebrochen.' }); }
        finally { window.clearTimeout(timer); pending.delete(data.id); }
    };
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener('message', listener); window.addEventListener('pagehide', cancel);
    // Speech-host load handlers also cancel requests; load settings after all handlers finished.
    const loaded = () => { cancel(); window.setTimeout(() => { if (!disposed) void loadPreferences(); }, 0); };
    document.addEventListener('visibilitychange', hidden); frame.addEventListener('load', loaded);
    return { cancel, setRecording, dispose() {
        disposed = true; cancel(); window.removeEventListener('message', listener); window.removeEventListener('pagehide', cancel);
        document.removeEventListener('visibilitychange', hidden); frame.removeEventListener('load', loaded); panel.remove();
    } };
}
