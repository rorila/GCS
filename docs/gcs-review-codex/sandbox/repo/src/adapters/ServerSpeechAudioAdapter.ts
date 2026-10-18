import { ISpeechAudioAdapter } from '../ports/ISpeechAudioAdapter';

export class ServerSpeechAudioAdapter implements ISpeechAudioAdapter {
    async prepare(endpoint: string, text: string, voice: string, signal: AbortSignal): Promise<string> {
        const base = new URL(endpoint.replace(/\/$/, '') + '/', window.location.href);
        if (!['http:', 'https:'].includes(base.protocol)) throw new Error('HTTP(S)-Serveradresse erforderlich.');
        const response = await fetch(new URL('synthesize', base), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice }), signal
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Sprachserver: HTTP ${response.status}`);
        const audio = new URL(result.audioUrl, base);
        if (audio.origin !== base.origin || !['http:', 'https:'].includes(audio.protocol)) {
            throw new Error('Ungültige Audio-Adresse vom Sprachserver.');
        }
        return audio.href;
    }
    createAudio(): HTMLAudioElement { return new Audio(); }
}
