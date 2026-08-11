import { Logger } from '../../utils/Logger';

const logger = Logger.get('AudioSequenceTool');

export const AUDIO_SEQUENCE_TOOL_VERSION = '1.0.1';

interface AudioToolState {
    start: number;
    end: number;
    gain: number;
    lowpass: number;
    highpass: number;
    pan: number;
    loop: boolean;
}

export class AudioSequenceTool {
    private parent: HTMLElement;
    private container: HTMLElement;
    private audioContext: AudioContext | null = null;
    private sourceBuffer: AudioBuffer | null = null;
    private filteredBuffer: AudioBuffer | null = null;
    private currentSource: AudioBufferSourceNode | null = null;
    private playStartTime: number = 0;
    private playStartOffset: number = 0;
    private playheadRaf: number | null = null;

    private state: AudioToolState = {
        start: 0,
        end: 0,
        gain: 1,
        lowpass: 0,
        highpass: 0,
        pan: 0,
        loop: false
    };

    private canvas: HTMLCanvasElement | null = null;
    private canvasCtx: CanvasRenderingContext2D | null = null;
    private fileInput: HTMLInputElement | null = null;
    private startInput: { wrap: HTMLElement; input: HTMLInputElement } | null = null;
    private endInput: { wrap: HTMLElement; input: HTMLInputElement } | null = null;
    private gainInput: { wrap: HTMLElement; input: HTMLInputElement } | null = null;
    private lowpassInput: { wrap: HTMLElement; input: HTMLInputElement } | null = null;
    private highpassInput: { wrap: HTMLElement; input: HTMLInputElement } | null = null;
    private panInput: { wrap: HTMLElement; input: HTMLInputElement } | null = null;
    private logEl: HTMLElement | null = null;

    constructor(parent: HTMLElement) {
        this.parent = parent;
        this.container = document.createElement('div');
    }

    public open(): void {
        this.render();
        this.parent.appendChild(this.container);
    }

    public close(): void {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close().catch(() => {});
            this.audioContext = null;
        }
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }

    private log(msg: string, isError = false): void {
        if (this.logEl) {
            this.logEl.style.color = isError ? '#ff6b6b' : '#ff9f43';
            this.logEl.textContent = msg;
        }
        if (isError) {
            logger.error(msg);
        } else {
            logger.info(msg);
        }
    }

    private render(): void {
        this.container.className = 'gcs-audio-overlay';
        this.container.style.cssText = this.getOverlayStyles();

        const dialog = document.createElement('div');
        dialog.style.cssText = this.getDialogStyles();

        const header = document.createElement('div');
        header.style.cssText = this.getHeaderStyles();
        const title = document.createElement('h2');
        title.style.cssText = 'margin:0;font-size:16px;color:#e0e0e0;';
        title.innerHTML = `🎵 Audio Sequenzen <span style="font-size:11px;color:#7fd1a0;font-weight:normal;">v${AUDIO_SEQUENCE_TOOL_VERSION}</span>`;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = this.getCloseBtnStyles();
        closeBtn.onclick = () => this.close();

        header.appendChild(title);
        header.appendChild(closeBtn);

        const content = document.createElement('div');
        content.style.cssText = this.getContentStyles();

        content.appendChild(this.renderLoadSection());
        content.appendChild(this.renderWaveformSection());
        content.appendChild(this.renderControlsSection());
        content.appendChild(this.renderActionSection());

        this.logEl = document.createElement('div');
        this.logEl.style.cssText = 'margin-top:8px;font-size:11px;color:#ff9f43;min-height:20px;';
        content.appendChild(this.logEl);

        dialog.appendChild(header);
        dialog.appendChild(content);
        this.container.appendChild(dialog);
    }

    private renderLoadSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = this.getSectionStyles();

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';

        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'audio/*';
        this.fileInput.style.cssText = 'display:none;';
        this.fileInput.onchange = () => this.handleFileSelect();

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Audio laden';
        loadBtn.style.cssText = this.getBtnStyles(true);
        loadBtn.onclick = () => this.fileInput?.click();

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.placeholder = 'oder URL/Pfad (./audio/sound.mp3)';
        urlInput.style.cssText = 'flex:1;min-width:180px;font-size:12px;padding:4px;background:#2a2a3e;color:#e0e0e0;border:1px solid #444;border-radius:4px;';
        urlInput.onchange = () => this.handleUrlLoad(urlInput.value.trim());

        row.appendChild(this.fileInput);
        row.appendChild(loadBtn);
        row.appendChild(urlInput);
        section.appendChild(row);

        return section;
    }

    private renderWaveformSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = this.getSectionStyles();

        this.canvas = document.createElement('canvas');
        this.canvas.width = 800;
        this.canvas.height = 160;
        this.canvas.style.cssText = 'width:100%;height:160px;background:#1a1a2e;border-radius:4px;';
        this.canvasCtx = this.canvas.getContext('2d');

        section.appendChild(this.canvas);
        return section;
    }

    private renderControlsSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = this.getSectionStyles();

        this.startInput = this.makeNumberInput('Start (s)', 0, 0.01, 0, undefined);
        this.endInput = this.makeNumberInput('Ende (s)', 0, 0.01, 0, undefined);
        this.gainInput = this.makeNumberInput('Lautstärke', 1, 0.05, 0, 2);
        this.lowpassInput = this.makeNumberInput('Lowpass (Hz, 0=aus)', 0, 100, 0, 20000);
        this.highpassInput = this.makeNumberInput('Highpass (Hz, 0=aus)', 0, 100, 0, 20000);
        this.panInput = this.makeNumberInput('Pan (-1..1)', 0, 0.1, -1, 1);

        const loopWrap = document.createElement('div');
        loopWrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:4px;';
        const loopCb = document.createElement('input');
        loopCb.type = 'checkbox';
        loopCb.checked = this.state.loop;
        loopCb.onchange = () => { this.state.loop = loopCb.checked; };
        const loopLbl = document.createElement('label');
        loopLbl.textContent = 'Loop';
        loopLbl.style.cssText = 'font-size:12px;color:#e0d4f5;';
        loopWrap.appendChild(loopCb);
        loopWrap.appendChild(loopLbl);

        section.appendChild(this.startInput.wrap);
        section.appendChild(this.endInput.wrap);
        section.appendChild(this.gainInput.wrap);
        section.appendChild(this.lowpassInput.wrap);
        section.appendChild(this.highpassInput.wrap);
        section.appendChild(this.panInput.wrap);
        section.appendChild(loopWrap);

        return section;
    }

    private makeNumberInput(label: string, value: number, step: number, min: number, max?: number): { wrap: HTMLElement; input: HTMLInputElement } {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;';

        const lbl = document.createElement('label');
        lbl.textContent = label;
        lbl.style.cssText = 'min-width:140px;font-size:12px;color:#e0d4f5;';

        const input = document.createElement('input');
        input.type = 'number';
        input.value = String(value);
        input.step = String(step);
        input.min = String(min);
        if (max !== undefined) input.max = String(max);
        input.style.cssText = 'width:100px;padding:4px;background:#2a2a3e;color:#e0e0e0;border:1px solid #444;border-radius:4px;';

        wrap.appendChild(lbl);
        wrap.appendChild(input);
        return { wrap, input };
    }

    private renderActionSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = this.getSectionStyles() + 'display:flex;gap:8px;flex-wrap:wrap;';

        const playBtn = document.createElement('button');
        playBtn.textContent = '▶ Play';
        playBtn.style.cssText = this.getBtnStyles(true);
        playBtn.onclick = () => this.play();

        const stopBtn = document.createElement('button');
        stopBtn.textContent = '■ Stop';
        stopBtn.style.cssText = this.getBtnStyles();
        stopBtn.onclick = () => this.stop();

        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Filter anwenden';
        applyBtn.style.cssText = this.getBtnStyles();
        applyBtn.onclick = () => this.applyFilters();

        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'WAV exportieren';
        exportBtn.style.cssText = this.getBtnStyles(true);
        exportBtn.onclick = () => this.exportWav();

        section.appendChild(playBtn);
        section.appendChild(stopBtn);
        section.appendChild(applyBtn);
        section.appendChild(exportBtn);

        return section;
    }

    private async handleFileSelect(): Promise<void> {
        if (!this.fileInput || !this.fileInput.files || this.fileInput.files.length === 0) return;
        const file = this.fileInput.files[0];
        const arrayBuffer = await file.arrayBuffer();
        await this.loadAudio(arrayBuffer, file.name);
    }

    private async handleUrlLoad(url: string): Promise<void> {
        if (!url) return;
        try {
            const res = await fetch(url);
            const arrayBuffer = await res.arrayBuffer();
            await this.loadAudio(arrayBuffer, url);
        } catch (e: any) {
            this.log(`Laden fehlgeschlagen: ${e.message}`, true);
        }
    }

    private async loadAudio(arrayBuffer: ArrayBuffer, name: string): Promise<void> {
        this.stop();
        this.audioContext = new AudioContext();
        try {
            this.sourceBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.filteredBuffer = this.sourceBuffer;
            this.state.start = 0;
            this.state.end = this.sourceBuffer.duration;

            this.startInput!.input.value = '0';
            this.endInput!.input.value = this.sourceBuffer.duration.toFixed(2);

            this.log(`Geladen: ${name} — ${this.sourceBuffer.duration.toFixed(2)}s, ${this.sourceBuffer.sampleRate}Hz`);
            this.drawWaveform();
        } catch (e: any) {
            this.log(`Dekodierung fehlgeschlagen: ${e.message}`, true);
        }
    }

    private readInputs(): void {
        const start = parseFloat(this.startInput!.input.value);
        const end = parseFloat(this.endInput!.input.value);
        const gain = parseFloat(this.gainInput!.input.value);
        const lowpass = parseFloat(this.lowpassInput!.input.value);
        const highpass = parseFloat(this.highpassInput!.input.value);
        const pan = parseFloat(this.panInput!.input.value);

        this.state.start = isNaN(start) ? 0 : Math.max(0, start);
        this.state.end = isNaN(end) ? (this.sourceBuffer?.duration || 0) : end;
        this.state.gain = isNaN(gain) ? 1 : Math.max(0, Math.min(2, gain));
        this.state.lowpass = isNaN(lowpass) ? 0 : lowpass;
        this.state.highpass = isNaN(highpass) ? 0 : highpass;
        this.state.pan = isNaN(pan) ? 0 : Math.max(-1, Math.min(1, pan));
    }

    private async applyFilters(): Promise<void> {
        if (!this.sourceBuffer) {
            this.log('Bitte zuerst Audio laden.', true);
            return;
        }
        this.readInputs();
        this.log('Filter werden angewendet...');
        this.filteredBuffer = await this.renderAudioBuffer(this.sourceBuffer, this.state);
        this.drawWaveform();
        this.log('Filter angewendet.');
    }

    private async renderAudioBuffer(buffer: AudioBuffer, state: AudioToolState): Promise<AudioBuffer> {
        const sampleRate = buffer.sampleRate;
        const duration = Math.max(0.001, state.end - state.start);
        const length = Math.floor(duration * sampleRate);
        const offline = new OfflineAudioContext(buffer.numberOfChannels, length, sampleRate);

        const source = offline.createBufferSource();
        source.buffer = buffer;
        source.loop = false;

        const gain = offline.createGain();
        gain.gain.value = state.gain;

        let lastNode: AudioNode = source;

        if (state.lowpass > 0) {
            const filter = offline.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = state.lowpass;
            lastNode.connect(filter);
            lastNode = filter;
        }

        if (state.highpass > 0) {
            const filter = offline.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = state.highpass;
            lastNode.connect(filter);
            lastNode = filter;
        }

        if (buffer.numberOfChannels <= 2) {
            const panner = offline.createStereoPanner();
            panner.pan.value = state.pan;
            lastNode.connect(panner);
            lastNode = panner;
        }

        lastNode.connect(gain);
        gain.connect(offline.destination);

        source.start(0, state.start, duration);
        return offline.startRendering();
    }

    private async play(): Promise<void> {
        if (!this.sourceBuffer) {
            this.log('Bitte zuerst Audio laden.', true);
            return;
        }
        this.stop();
        if (!this.audioContext) {
            this.audioContext = new AudioContext();
        }

        try {
            this.readInputs();

            const duration = this.sourceBuffer.duration;
            const start = Math.max(0, Math.min(this.state.start, duration - 0.001));
            const end = Math.max(start + 0.001, Math.min(this.state.end, duration));
            const playDuration = end - start;

            this.log(`Play: start=${start.toFixed(2)}s, end=${end.toFixed(2)}s, state=${this.audioContext.state}`);

            if (this.audioContext.state !== 'running') {
                this.log('AudioContext aktivieren...');
                await this.audioContext.resume();
            }

            if (this.audioContext.state !== 'running') {
                this.log(`AudioContext nicht running: ${this.audioContext.state}`, true);
                return;
            }

            const source = this.audioContext.createBufferSource();
            source.buffer = this.sourceBuffer;
            source.loop = this.state.loop;

            const gain = this.audioContext.createGain();
            gain.gain.value = this.state.gain;

            let lastNode: AudioNode = source;

            if (this.state.lowpass > 0) {
                const filter = this.audioContext.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = this.state.lowpass;
                lastNode.connect(filter);
                lastNode = filter;
            }

            if (this.state.highpass > 0) {
                const filter = this.audioContext.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = this.state.highpass;
                lastNode.connect(filter);
                lastNode = filter;
            }

            if (this.sourceBuffer.numberOfChannels <= 2) {
                const panner = this.audioContext.createStereoPanner();
                panner.pan.value = this.state.pan;
                lastNode.connect(panner);
                lastNode = panner;
            }

            lastNode.connect(gain);
            gain.connect(this.audioContext.destination);

            const when = this.audioContext.currentTime + 0.05;
            source.start(when, start, playDuration);
            this.playStartTime = when;
            this.playStartOffset = start;

            source.onended = () => {
                this.currentSource = null;
                this.stopPlayhead();
                this.log('Wiedergabe beendet.');
            };

            this.currentSource = source;
            this.startPlayhead();
            this.log('Wiedergabe gestartet.');
        } catch (e: any) {
            this.log(`Play-Fehler: ${e.message}`, true);
        }
    }

    private stop(): void {
        if (this.currentSource) {
            try { this.currentSource.stop(); } catch (e) {}
            this.currentSource = null;
        }
        this.stopPlayhead();
    }

    private startPlayhead(): void {
        this.stopPlayhead();
        const tick = () => {
            if (!this.audioContext || !this.currentSource) return;
            const current = this.audioContext.currentTime - this.playStartTime + this.playStartOffset;
            this.drawWaveform(current);
            this.playheadRaf = requestAnimationFrame(tick);
        };
        this.playheadRaf = requestAnimationFrame(tick);
    }

    private stopPlayhead(): void {
        if (this.playheadRaf) {
            cancelAnimationFrame(this.playheadRaf);
            this.playheadRaf = null;
        }
        this.drawWaveform();
    }

    private exportWav(): void {
        if (!this.filteredBuffer) {
            this.log('Bitte zuerst Audio laden.', true);
            return;
        }

        const blob = this.bufferToWav(this.filteredBuffer);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audio_${Date.now()}.wav`;
        a.click();
        URL.revokeObjectURL(url);
        this.log('WAV exportiert.');
    }

    private bufferToWav(buffer: AudioBuffer): Blob {
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const outBuffer = new ArrayBuffer(length);
        const view = new DataView(outBuffer);
        const channels: Float32Array[] = [];
        let i: number;
        let sample: number;
        let pos = 0;

        for (i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        const writeString = (view: DataView, offset: number, string: string) => {
            for (let z = 0; z < string.length; z++) {
                view.setUint8(offset + z, string.charCodeAt(z));
            }
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + buffer.length * numOfChan * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numOfChan, true);
        view.setUint32(24, buffer.sampleRate, true);
        view.setUint32(28, buffer.sampleRate * 2 * numOfChan, true);
        view.setUint16(32, numOfChan * 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, buffer.length * numOfChan * 2, true);

        for (i = 0; i < buffer.length; i++) {
            for (let ch = 0; ch < numOfChan; ch++) {
                sample = Math.max(-1, Math.min(1, channels[ch][i]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(44 + pos, sample, true);
                pos += 2;
            }
        }

        return new Blob([outBuffer], { type: 'audio/wav' });
    }

    private drawWaveform(playheadTime?: number): void {
        if (!this.canvas || !this.canvasCtx || !this.filteredBuffer) return;

        const ctx = this.canvasCtx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const data = this.filteredBuffer.getChannelData(0);
        const step = Math.ceil(data.length / width);

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        ctx.lineWidth = 1;
        ctx.strokeStyle = '#4da6ff';
        ctx.beginPath();

        const halfH = height / 2;
        for (let x = 0; x < width; x++) {
            const startIdx = x * step;
            let min = 0;
            let max = 0;
            for (let i = 0; i < step && startIdx + i < data.length; i++) {
                const v = data[startIdx + i];
                if (v < min) min = v;
                if (v > max) max = v;
            }
            ctx.moveTo(x, halfH + min * halfH);
            ctx.lineTo(x, halfH + max * halfH);
        }
        ctx.stroke();

        // Playhead zeichnen
        if (this.sourceBuffer && playheadTime !== undefined) {
            const total = this.sourceBuffer.duration;
            const playheadX = (Math.max(0, Math.min(playheadTime, total)) / total) * width;
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(playheadX, 0);
            ctx.lineTo(playheadX, height);
            ctx.stroke();
        }

        // Trim-Bereich markieren
        if (this.sourceBuffer) {
            const total = this.sourceBuffer.duration;
            const startX = (this.state.start / total) * width;
            const endX = (this.state.end / total) * width;
            ctx.fillStyle = 'rgba(77, 166, 255, 0.15)';
            ctx.fillRect(startX, 0, endX - startX, height);
            ctx.strokeStyle = '#7fd1a0';
            ctx.beginPath();
            ctx.moveTo(startX, 0);
            ctx.lineTo(startX, height);
            ctx.moveTo(endX, 0);
            ctx.lineTo(endX, height);
            ctx.stroke();
        }
    }

    // ── Styles ──
    private getOverlayStyles(): string {
        return 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;justify-content:center;align-items:center;';
    }

    private getDialogStyles(): string {
        return 'width:min(900px,95vw);height:min(90vh,700px);background:#252536;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden;';
    }

    private getHeaderStyles(): string {
        return 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#1e1e2e;border-bottom:1px solid #333;';
    }

    private getCloseBtnStyles(): string {
        return 'background:transparent;border:none;color:#aaa;font-size:16px;cursor:pointer;';
    }

    private getContentStyles(): string {
        return 'flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;';
    }

    private getSectionStyles(): string {
        return 'background:#1e1e2e;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px;';
    }

    private getBtnStyles(primary = false): string {
        const base = 'padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;border:none;';
        return primary
            ? `${base}background:#4da6ff;color:#fff;`
            : `${base}background:#3a3a4f;color:#e0d4f5;`;
    }
}
