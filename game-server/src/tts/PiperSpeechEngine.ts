import { spawn } from 'child_process';
import { SpeechEngine, SpeechError } from './SpeechCache';

/** Piper läuft als privater, dauerhaft geladener HTTP-Dienst. FFmpeg komprimiert WAV. */
export class PiperSpeechEngine implements SpeechEngine {
    private baseVersion: string;
    constructor(public version: string, private url: string,
        private voices: Record<string, string>, private ffmpeg = 'ffmpeg', private synthesisPath = '/') {
        this.baseVersion = version;
        this.version += ':' + JSON.stringify(Object.entries(voices).sort());
    }
    cacheVersion(voice: string): string { return this.baseVersion + ':' + this.voices[voice]; }
    legacyVersions(voice: string): string[] {
        return voice === 'default' && this.voices[voice] === 'de_DE-thorsten-medium'
            ? [this.baseVersion + ':\u005b\u005b"default","de_DE-thorsten-medium"\u005d\u005d'] : [];
    }

    async synthesize(text: string, voice: string): Promise<Buffer> {
        const model = this.voices[voice];
        if (!model) throw new SpeechError('Unbekannte Stimmen-ID.', 400);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30_000);
        let wav: Buffer;
        try {
            // Piper otherwise silently substitutes its default voice for an absent model.
            const inventory = await fetch(this.url.replace(/\/$/, '') + '/voices', { signal: controller.signal });
            if (!inventory.ok || !Object.prototype.hasOwnProperty.call(await inventory.json(), model)) {
                throw new SpeechError('Gewählte Stimme ist nicht installiert.', 503);
            }
            const response = await fetch(this.url.replace(/\/$/, '') + this.synthesisPath, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice: model, length_scale: 1 }), signal: controller.signal
            });
            if (!response.ok || !response.body) throw new SpeechError('Piper konnte keine Sprache erzeugen.');
            const chunks: Buffer[] = [];
            let bytes = 0;
            for await (const chunk of response.body as any) {
                bytes += chunk.length;
                if (bytes > 16 * 1024 ** 2) { controller.abort(); throw new SpeechError('Piper-Audio zu groß.'); }
                chunks.push(Buffer.from(chunk));
            }
            wav = Buffer.concat(chunks);
            if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
                throw new SpeechError('Ungültiges Audio von Piper.');
            }
        } catch (error) {
            if (error instanceof SpeechError) throw error;
            throw new SpeechError('Piper nicht erreichbar oder Zeitlimit überschritten.');
        } finally { clearTimeout(timer); }
        return new Promise((resolve, reject) => {
            const process = spawn(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
                '-f', 'mp3', '-ac', '1', '-b:a', '48k', 'pipe:1'], { windowsHide: true });
            const chunks: Buffer[] = [];
            let bytes = 0;
            const timeout = setTimeout(() => { process.kill(); reject(new SpeechError('Audiokompression zu langsam.')); }, 15_000);
            process.stdout.on('data', (chunk: Buffer) => {
                bytes += chunk.length;
                if (bytes > 4 * 1024 ** 2) { process.kill(); reject(new SpeechError('Komprimiertes Audio zu groß.')); }
                else chunks.push(chunk);
            });
            process.stderr.resume();
            process.stdin.on('error', () => {});
            process.on('error', () => { clearTimeout(timeout); reject(new SpeechError('FFmpeg fehlt oder kann nicht gestartet werden.')); });
            process.on('close', code => {
                clearTimeout(timeout);
                if (code === 0 && bytes) resolve(Buffer.concat(chunks));
                else reject(new SpeechError('Audiokompression fehlgeschlagen.'));
            });
            process.stdin.end(wav);
        });
    }
}
