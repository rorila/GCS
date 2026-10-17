import type { ISpeechRecognitionAdapter, SpeechOptions } from '../ports/ISpeechRecognitionAdapter';
import { sendCmsFrameMessage, onCmsFrameMessage } from './CmsFrameTransport';

export class BrowserSpeechRecognitionAdapter implements ISpeechRecognitionAdapter {
    private clientId = '';
    private launchKey = '';
    private pending?: { id: string; reject: (error: Error) => void; cleanup: () => void };

    private send(operation: string, extra: Record<string, unknown> = {}): void {
        sendCmsFrameMessage({ type: 'gcs-speech', clientId: this.clientId, launchKey: this.launchKey, operation, ...extra });
    }
    private request(operation: string, launchKey: string, options?: SpeechOptions): Promise<any> {
        this.cancel();
        this.launchKey = launchKey;
        if (!/^[a-f0-9]{48}$/.test(launchKey)) return Promise.reject(new Error('Für Spracheingabe das Spiel über das CMS starten.'));
        if (typeof window === 'undefined' || window.parent === window) return Promise.reject(new Error('Spracheingabe benötigt den CMS-Spielhost.'));
        this.clientId ||= crypto.randomUUID();
        const id = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            const listener = (data: any) => {
                if (data?.type !== 'gcs-speech-result' || data.id !== id || data.clientId !== this.clientId) return;
                cleanup();
                if (data.ok) resolve({ text: typeof data.text === 'string' ? data.text : '' });
                else reject(new Error(typeof data.message === 'string' ? data.message : 'Spracherkennung fehlgeschlagen.'));
            };
            const cleanup = () => { window.clearTimeout(timer); unsubscribe(); if (this.pending?.id === id) this.pending = undefined; };
            const timer = window.setTimeout(() => { this.send('cancel'); cleanup(); reject(new Error('Spracherkennung antwortet nicht.')); }, operation === 'prepare' ? 90000 : 45000);
            this.pending = { id, reject, cleanup };
            const unsubscribe = onCmsFrameMessage(listener);
            this.send(operation, { id, options });
        });
    }
    public async prepare(launchKey: string): Promise<void> { await this.request('prepare', launchKey); }
    public listen(launchKey: string, options: SpeechOptions): Promise<{ text: string }> { return this.request('listen', launchKey, options); }
    public stop(): void { if (this.pending) this.send('stop'); }
    public cancel(): void {
        if (!this.pending) return;
        const pending = this.pending;
        this.send('cancel');
        pending.cleanup();
        pending.reject(new Error('Aufnahme abgebrochen.'));
    }
}
