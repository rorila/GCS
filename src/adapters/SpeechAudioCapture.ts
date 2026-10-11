export function encodeSpeechWav(samples: Float32Array, sampleRate: number): Uint8Array {
    const count = Math.floor(samples.length * 16000 / sampleRate);
    const pad = 6400; // ~400 ms Stille vor/hinter der Sprache hilft dem Decoder-Anlauf
    const total = count + pad * 2;
    const bytes = new Uint8Array(44 + total * 2), view = new DataView(bytes.buffer);
    const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); };
    text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, total * 2, true);
    for (let i = 0; i < count; i++) {
        const start = Math.floor(i * sampleRate / 16000), end = Math.min(samples.length, Math.max(start + 1, Math.floor((i + 1) * sampleRate / 16000)));
        let sum = 0;
        for (let j = start; j < end; j++) sum += samples[j];
        const value = Math.max(-1, Math.min(1, sum / (end - start)));
        view.setInt16(44 + (pad + i) * 2, value * (value < 0 ? 32768 : 32767), true);
    }
    return bytes;
}

export interface SpeechInputLevel {
    rms: number;
    peakRms: number;
    audioMs: number;
    speechDetected: boolean;
}

export class SpeechAudioCapture {
    private context?: AudioContext;
    private stream?: MediaStream;
    private finish?: () => void;
    private generation = 0;
    public async prepare(): Promise<void> {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Mikrofon benötigt HTTPS und einen unterstützten Browser.');
        this.context ||= new AudioContext();
        await this.context.resume();
        const generation = this.generation;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        stream.getTracks().forEach(track => track.stop());
        if (generation !== this.generation) throw new Error('Aufnahme abgebrochen.');
    }
    public async capture(maxDurationMs: number, silenceMs: number, signal: AbortSignal, onLevel?: (level: SpeechInputLevel) => void): Promise<Uint8Array | null> {
        if (signal.aborted || !this.context) throw new Error('Mikrofon nicht bereit.');
        const context = this.context;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        if (signal.aborted) { stream.getTracks().forEach(track => track.stop()); throw new Error('Aufnahme abgebrochen.'); }
        this.stream = stream;
        try { await context.resume(); }
        catch (error) { stream.getTracks().forEach(track => track.stop()); this.stream = undefined; throw error; }
        if (signal.aborted) { stream.getTracks().forEach(track => track.stop()); throw new Error('Aufnahme abgebrochen.'); }
        try { return await new Promise<Uint8Array | null>((resolve, reject) => {
            const source = context.createMediaStreamSource(stream), processor = context.createScriptProcessor(2048, 1, 1), mute = context.createGain();
            mute.gain.value = 0;
            const chunks: Float32Array[] = [];
            let length = 0, voicedMs = 0, lastVoice = 0, peakRms = 0, done = false;
            const finish = () => {
                if (done) return;
                done = true;
                window.clearTimeout(timer);
                signal.removeEventListener('abort', finish);
                source.disconnect(); processor.disconnect(); mute.disconnect(); processor.onaudioprocess = null;
                stream.getTracks().forEach(track => track.stop()); this.stream = undefined; this.finish = undefined;
                if (signal.aborted) { reject(new Error('Aufnahme abgebrochen.')); return; }
                if (voicedMs < 150) { resolve(null); return; }
                const samples = new Float32Array(length);
                let offset = 0;
                for (const chunk of chunks) { samples.set(chunk, offset); offset += chunk.length; }
                resolve(encodeSpeechWav(samples, context.sampleRate));
            };
            const timer = window.setTimeout(finish, maxDurationMs);
            this.finish = finish;
            signal.addEventListener('abort', finish, { once: true });
            processor.onaudioprocess = event => {
                const chunk = new Float32Array(event.inputBuffer.getChannelData(0));
                if (length + chunk.length > context.sampleRate * 15) { finish(); return; }
                chunks.push(chunk); length += chunk.length;
                const rms = Math.sqrt(chunk.reduce((sum, value) => sum + value * value, 0) / chunk.length);
                const now = length / context.sampleRate * 1000;
                if (rms > 0.015) { voicedMs += chunk.length / context.sampleRate * 1000; lastVoice = now; }
                peakRms = Math.max(peakRms, rms);
                onLevel?.({ rms, peakRms, audioMs: now, speechDetected: voicedMs >= 150 });
                if (voicedMs >= 150 && now - lastVoice >= silenceMs) finish();
            };
            source.connect(processor); processor.connect(mute); mute.connect(context.destination);
        }); } finally { stream.getTracks().forEach(track => track.stop()); if (this.stream === stream) this.stream = undefined; }
    }
    public stop(): void { this.finish?.(); }
    public dispose(): void {
        this.generation++;
        this.stream?.getTracks().forEach(track => track.stop());
        this.finish?.();
        void this.context?.close().catch(() => {});
        this.context = undefined;
    }
}
