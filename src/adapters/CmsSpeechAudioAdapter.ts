import type { ISpeechAudioAdapter } from '../ports/ISpeechAudioAdapter';
import { ServerSpeechAudioAdapter } from './ServerSpeechAudioAdapter';
import { sendCmsFrameMessage, onCmsFrameMessage } from './CmsFrameTransport';

/** Vertrauenswürdiger CMS-Host übernimmt HTTP; Sandbox bleibt ohne Netzwerkrechte. */
export class CmsSpeechAudioAdapter implements ISpeechAudioAdapter {
    private fallback = new ServerSpeechAudioAdapter();
    private urls = new Set<string>();
    async prepare(endpoint: string, text: string, voice: string, signal: AbortSignal, launchKey = ''): Promise<string> {
        if (!launchKey) return this.fallback.prepare(endpoint, text, voice, signal);
        if (!/^[a-f0-9]{48}$/.test(launchKey) || window.parent === window) throw new Error('Sprachausgabe benötigt den CMS-Spielhost.');
        const id = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            const cleanup = () => { unsubscribe(); signal.removeEventListener('abort', abort); };
            const abort = () => {
                sendCmsFrameMessage({ type: 'gcs-tts', operation: 'cancel', id, launchKey });
                cleanup(); reject(new Error('Sprachausgabe abgebrochen.'));
            };
            const listener = (data: any) => {
                if (data?.type !== 'gcs-tts-result' || data.id !== id) return;
                cleanup();
                if (!data.ok || typeof data.audio !== 'string' || data.audio.length > 6_000_000) { reject(new Error(data.message || 'Sprachausgabe nicht verfügbar.')); return; }
                try {
                    const bytes = Uint8Array.from(atob(data.audio), character => character.charCodeAt(0));
                    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
                    this.urls.add(url); resolve(url);
                } catch { reject(new Error('Ungültige Sprachdatei.')); }
            };
            const unsubscribe = onCmsFrameMessage(listener);
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted) { abort(); return; }
            sendCmsFrameMessage({ type: 'gcs-tts', operation: 'prepare', id, launchKey, text, voice });
        });
    }
    releaseAudio(url: string): void { if (this.urls.delete(url)) URL.revokeObjectURL(url); }
    createAudio(): HTMLAudioElement { return new Audio(); }
}
