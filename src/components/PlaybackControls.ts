import { playbackEngine } from '../services/PlaybackEngine';

/**
 * PlaybackControls - UI Fenster zur Steuerung von Recording-Playbacks
 */
export class PlaybackControls {
    private container: HTMLElement;
    private playBtn: HTMLButtonElement | null = null;
    private timeline: HTMLInputElement | null = null;
    private timeLabel: HTMLElement | null = null;
    private speedSelect: HTMLSelectElement | null = null;
    private element: HTMLElement | null = null;

    constructor(parent: HTMLElement) {
        this.container = parent;
        this.init();
        this.setupEventListeners();
    }

    private init(): void {
        this.element = document.createElement('div');
        this.element.id = 'playback-controls-window';
        this.element.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 450px;
            background: rgba(30, 30, 30, 0.95);
            border: 1px solid #444;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            z-index: 11000;
            display: none;
            flex-direction: column;
            overflow: hidden;
            font-family: sans-serif;
        `;

        this.element.innerHTML = `
            <div style="background: #333; padding: 5px 10px; font-size: 12px; color: #ccc; border-bottom: 1px solid #444; display: flex; justify-content: space-between;">
                <span>🎬 Recording Playback</span>
                <button id="playback-close" style="background: transparent; border: none; color: #888; cursor: pointer;">✕</button>
            </div>
            <div style="padding: 10px; display: flex; flex-direction: column; gap: 8px; color: white;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button id="playback-play" style="padding: 4px 12px; cursor: pointer; background: #0078d4; color: white; border: none; border-radius: 4px; font-size: 13px;">▶ Play</button>
                    <button id="playback-stop" style="padding: 4px 12px; cursor: pointer; background: #444; color: white; border: 1px solid #666; border-radius: 4px; font-size: 13px;">⏹ Stop</button>
                    <span id="playback-time" style="font-family: monospace; font-size: 12px; min-width: 90px;">00:00 / 00:00</span>
                    <div style="flex-grow: 1"></div>
                    <select id="playback-speed" style="background: #333; color: white; border: 1px solid #555; padding: 2px; font-size: 12px;">
                        <option value="0.5">0.5x</option>
                        <option value="1.0" selected>1.0x</option>
                        <option value="2.0">2.0x</option>
                        <option value="4.0">4.0x</option>
                    </select>
                </div>
                <input type="range" id="playback-timeline" min="0" max="100" value="0" style="width: 100%; cursor: pointer;">
            </div>
        `;

        this.container.appendChild(this.element);

        this.playBtn = this.element.querySelector('#playback-play');
        this.timeline = this.element.querySelector('#playback-timeline');
        this.timeLabel = this.element.querySelector('#playback-time');
        this.speedSelect = this.element.querySelector('#playback-speed');

        const closeBtn = this.element.querySelector('#playback-close');
        if (closeBtn) (closeBtn as HTMLElement).onclick = () => this.hide();

        const stopBtn = this.element.querySelector('#playback-stop');
        if (stopBtn) (stopBtn as HTMLElement).onclick = () => playbackEngine.stop();
    }

    public show(): void {
        if (this.element) this.element.style.display = 'flex';
    }

    public hide(): void {
        if (this.element) this.element.style.display = 'none';
        playbackEngine.stop();
    }

    private setupEventListeners(): void {
        if (this.playBtn) {
            this.playBtn.onclick = () => {
                if (playbackEngine.getIsPlaying()) {
                    playbackEngine.pause();
                } else {
                    playbackEngine.play();
                }
            };
        }

        if (this.timeline) {
            this.timeline.oninput = () => {
                const time = (parseFloat(this.timeline!.value) / 100) * playbackEngine.getDuration();
                playbackEngine.seek(time);
            };
        }

        if (this.speedSelect) {
            this.speedSelect.onchange = () => {
                playbackEngine.setSpeed(parseFloat(this.speedSelect!.value));
            };
        }

        // Listen to engine updates
        playbackEngine.onStateChange = (state) => {
            if (this.playBtn) {
                this.playBtn.innerText = state === 'playing' ? '⏸ Pause' : '▶ Play';
                this.playBtn.style.background = state === 'playing' ? '#d83b01' : '#0078d4';
            }
        };

        playbackEngine.onTimeUpdate = (current, duration) => {
            if (this.timeline && duration > 0) {
                this.timeline.value = ((current / duration) * 100).toString();
            }
            if (this.timeLabel) {
                this.timeLabel.innerText = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
            }
        };
    }

    private formatTime(ms: number): string {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}
