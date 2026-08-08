/**
 * VideoToSpriteSheetTool
 *
 * Wandelt ein Video in ein Sprite-Sheet um.
 * Bietet Frame-Extraktion, Chroma-Key, Auto-Crop, SpriteSheet-Vorschau,
 * Animations-Vorschau, Upload ins game-server/public/images und
 * Rückgabe von Bild + Metadaten.
 */

import { PromptDialog } from '../ui/PromptDialog';
import { removeBackgroundFromImageData } from './ImageUtils';
import { Logger } from '../../utils/Logger';

const logger = Logger.get('VideoToSpriteSheetTool');

interface Frame {
    id: number;
    time: number;
    imageData: ImageData;
    selected: boolean;
}

interface ToolSettings {
    interval: number;
    start: number;
    end: number | null;
    spriteWidth: number;
    spriteHeight: number;
    columns: number;
    removeBackground: boolean;
    backgroundColor: string;
    tolerance: number;
    autoCrop: boolean;
    cropPadding: number;
    fps: number;
    loop: boolean;
}

interface ExportResult {
    fileName: string;
    url: string;
    imageBlob: Blob;
    metadata: {
        name: string;
        image: string;
        frameWidth: number;
        frameHeight: number;
        frames: number;
        columns: number;
        rows: number;
        frameInterval: number;
    };
}

export class VideoToSpriteSheetTool {
    private parent: HTMLElement;
    private uploadUrl: string;

    private video: HTMLVideoElement | null = null;
    private videoSrc: string = '';
    private videoDuration: number = 0;
    private videoWidth: number = 0;
    private videoHeight: number = 0;

    private frames: Frame[] = [];

    private settings: ToolSettings = {
        interval: 0.5,
        start: 0,
        end: null,
        spriteWidth: 256,
        spriteHeight: 256,
        columns: 4,
        removeBackground: false,
        backgroundColor: '#00FF00',
        tolerance: 30,
        autoCrop: false,
        cropPadding: 2,
        fps: 12,
        loop: true
    };

    /** Referenzen auf die Zahlen-Eingabefelder, damit automatisch ermittelte Werte sichtbar werden. */
    private settingInputs: Partial<Record<keyof ToolSettings, HTMLInputElement>> = {};

    private sheetCanvas: HTMLCanvasElement | null = null;
    private sheetColumns: number = 0;
    private sheetRows: number = 0;
    private animationPreviewTimer: number | null = null;

    public onExport: ((result: ExportResult) => void) | null = null;
    public onError: ((msg: string) => void) | null = null;

    private container: HTMLElement;
    private logEl: HTMLElement | null = null;
    private videoInfoEl: HTMLElement | null = null;
    private frameGridEl: HTMLElement | null = null;
    private sheetPreviewEl: HTMLElement | null = null;
    private sheetInfoEl: HTMLElement | null = null;
    private animPreviewCanvas: HTMLCanvasElement | null = null;

    constructor(parent: HTMLElement, uploadUrl = 'http://localhost:8080/api/upload/spritesheet') {
        this.parent = parent;
        this.uploadUrl = uploadUrl;
        this.container = document.createElement('div');
    }

    public open(): void {
        this.render();
        this.parent.appendChild(this.container);
    }

    public close(): void {
        this.stopAnimationPreview();
        this.revokeVideoUrl();
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }

    private log(msg: string): void {
        if (this.logEl) this.logEl.textContent = msg;
    }

    private render(): void {
        this.container.className = 'gcs-vts-overlay';
        this.container.style.cssText = this.getOverlayStyles();

        const dialog = document.createElement('div');
        dialog.className = 'gcs-vts-dialog';
        dialog.style.cssText = this.getDialogStyles();

        const header = document.createElement('div');
        header.style.cssText = this.getHeaderStyles();
        header.innerHTML = '<h2 style="margin:0;font-size:16px;color:#e0e0e0;">🎬 Video → SpriteSheet</h2>';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = this.getCloseBtnStyles();
        closeBtn.onclick = () => this.close();
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        const content = document.createElement('div');
        content.className = 'gcs-vts-content';
        content.style.cssText = this.getContentStyles();

        this.videoInfoEl = document.createElement('div');
        this.videoInfoEl.style.cssText = 'font-size:12px;color:#aaa;margin-bottom:8px;';

        this.frameGridEl = document.createElement('div');
        this.frameGridEl.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;min-height:320px;max-height:380px;overflow-y:auto;padding:10px;background:#1e1e2e;border-radius:6px;border:1px solid #3a3a4f;';

        this.sheetPreviewEl = document.createElement('div');
        this.sheetPreviewEl.style.cssText = 'margin-top:12px;overflow:auto;max-height:220px;background:#1e1e2e;border-radius:6px;padding:8px;';

        this.sheetInfoEl = document.createElement('div');
        this.sheetInfoEl.style.cssText = 'font-size:12px;color:#aaa;margin-top:8px;';

        const logBox = document.createElement('div');
        logBox.style.cssText = 'margin-top:8px;font-size:11px;color:#ff9f43;min-height:20px;';
        this.logEl = logBox;

        content.appendChild(this.renderVideoSection());
        content.appendChild(this.videoInfoEl);
        content.appendChild(this.renderSettingsSection());
        content.appendChild(this.renderFrameActions());
        content.appendChild(this.frameGridEl);
        content.appendChild(this.renderSheetSection());
        content.appendChild(this.sheetPreviewEl);
        content.appendChild(this.sheetInfoEl);
        content.appendChild(logBox);

        dialog.appendChild(content);
        this.container.appendChild(dialog);
    }

    private getOverlayStyles(): string {
        return 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;justify-content:center;align-items:center;';
    }

    private getDialogStyles(): string {
        return 'width:min(920px,95vw);height:min(90vh,800px);background:#252536;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden;';
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

    /** Schachbrett-Hintergrund, damit Transparenz sichtbar wird. */
    private getCheckerboardStyles(): string {
        return 'background-image:linear-gradient(45deg,#555 25%,transparent 25%),linear-gradient(-45deg,#555 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#555 75%),linear-gradient(-45deg,transparent 75%,#555 75%);background-size:12px 12px;background-position:0 0,0 6px,6px -6px,-6px 0;background-color:#888;';
    }

    private getBtnStyles(primary = false): string {
        const base = 'padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;border:none;';
        return primary
            ? `${base}background:#4da6ff;color:#fff;`
            : `${base}background:#3a3a4f;color:#e0d4f5;`;
    }

    private renderVideoSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = this.getSectionStyles();

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'video/mp4,video/webm';
        fileInput.style.cssText = 'display:none;';
        fileInput.onchange = () => {
            if (fileInput.files && fileInput.files[0]) {
                this.loadVideo(fileInput.files[0]);
            }
        };

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Video laden';
        loadBtn.style.cssText = this.getBtnStyles(true);
        loadBtn.onclick = () => fileInput.click();

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.placeholder = 'oder Pfad/URL (./videos/clip.webm)';
        urlInput.style.cssText = 'flex:1;min-width:180px;font-size:12px;padding:4px;background:#2a2a3e;color:#e0d4f5;border:1px solid #444;border-radius:4px;';
        urlInput.onchange = () => this.loadVideoUrl(urlInput.value.trim());

        const player = document.createElement('video');
        player.style.cssText = 'width:100%;max-height:180px;background:#000;border-radius:4px;';
        player.controls = true;
        player.muted = true;

        this.video = player;

        row.appendChild(fileInput);
        row.appendChild(loadBtn);
        row.appendChild(urlInput);
        section.appendChild(row);
        section.appendChild(player);

        return section;
    }

    private renderSettingsSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = this.getSectionStyles();

        const makeNumber = (label: string, key: keyof ToolSettings, step: number, min?: number, max?: number) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.style.cssText = 'min-width:120px;font-size:12px;color:#e0d4f5;';
            const input = document.createElement('input');
            input.type = 'number';
            input.value = String(this.settings[key]);
            input.step = String(step);
            if (min !== undefined) input.min = String(min);
            if (max !== undefined) input.max = String(max);
            input.style.cssText = 'width:80px;padding:4px;background:#2a2a3e;color:#e0d4f5;border:1px solid #444;border-radius:4px;';
            this.settingInputs[key] = input;
            input.onchange = () => {
                const v = parseFloat(input.value);
                (this.settings as any)[key] = isNaN(v) ? this.settings[key] : v;
                this.refreshPreviewIfChromaKey(key);
            };
            wrap.appendChild(lbl);
            wrap.appendChild(input);
            return wrap;
        };

        const makeColor = (label: string, key: keyof ToolSettings) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.style.cssText = 'min-width:120px;font-size:12px;color:#e0d4f5;';
            const input = document.createElement('input');
            input.type = 'color';
            input.value = String(this.settings[key]);
            input.style.cssText = 'width:50px;height:24px;border:none;background:transparent;';
            input.oninput = () => {
                (this.settings as any)[key] = input.value;
                this.refreshPreviewIfChromaKey(key);
            };
            const pickBtn = document.createElement('button');
            pickBtn.textContent = 'Aus Video';
            pickBtn.style.cssText = this.getBtnStyles();
            pickBtn.onclick = () => this.pickColorFromVideo(input);
            wrap.appendChild(lbl);
            wrap.appendChild(input);
            wrap.appendChild(pickBtn);
            return wrap;
        };

        const makeCheckbox = (label: string, key: keyof ToolSettings) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!this.settings[key];
            cb.onchange = () => {
                (this.settings as any)[key] = cb.checked;
                this.refreshPreviewIfChromaKey(key);
            };
            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.style.cssText = 'font-size:12px;color:#e0d4f5;';
            wrap.appendChild(cb);
            wrap.appendChild(lbl);
            return wrap;
        };

        section.appendChild(makeNumber('Frame-Abstand (s)', 'interval', 0.05, 0.05));
        section.appendChild(makeNumber('Start (s)', 'start', 0.1, 0));
        section.appendChild(makeNumber('Ende (s)', 'end', 0.1, 0));
        section.appendChild(makeNumber('Sprite-Breite', 'spriteWidth', 1, 1));
        section.appendChild(makeNumber('Sprite-Höhe', 'spriteHeight', 1, 1));
        section.appendChild(makeNumber('Spalten', 'columns', 1, 1));
        section.appendChild(makeCheckbox('Hintergrund entfernen', 'removeBackground'));
        section.appendChild(makeColor('Hintergrundfarbe', 'backgroundColor'));
        section.appendChild(makeNumber('Toleranz (0-100)', 'tolerance', 1, 0, 100));
        section.appendChild(makeCheckbox('Automatisch zuschneiden', 'autoCrop'));
        section.appendChild(makeNumber('Zuschnitt-Rand (px)', 'cropPadding', 1, 0));
        section.appendChild(makeCheckbox('Loop Vorschau', 'loop'));

        return section;
    }

    private renderFrameActions(): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

        const extractBtn = document.createElement('button');
        extractBtn.textContent = 'Frames extrahieren';
        extractBtn.style.cssText = this.getBtnStyles(true);
        extractBtn.onclick = () => this.extractFrames();

        const allBtn = document.createElement('button');
        allBtn.textContent = 'Alle auswählen';
        allBtn.style.cssText = this.getBtnStyles();
        allBtn.onclick = () => this.setAllSelected(true);

        const noneBtn = document.createElement('button');
        noneBtn.textContent = 'Keine auswählen';
        noneBtn.style.cssText = this.getBtnStyles();
        noneBtn.onclick = () => this.setAllSelected(false);

        row.appendChild(extractBtn);
        row.appendChild(allBtn);
        row.appendChild(noneBtn);

        return row;
    }

    private renderSheetSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = this.getSectionStyles();

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

        const buildBtn = document.createElement('button');
        buildBtn.textContent = 'SpriteSheet erstellen';
        buildBtn.style.cssText = this.getBtnStyles(true);
        buildBtn.onclick = () => this.buildSheet();

        const previewAnimBtn = document.createElement('button');
        previewAnimBtn.textContent = 'Animation abspielen';
        previewAnimBtn.style.cssText = this.getBtnStyles();
        previewAnimBtn.onclick = () => this.playAnimation();

        const stopAnimBtn = document.createElement('button');
        stopAnimBtn.textContent = 'Stop';
        stopAnimBtn.style.cssText = this.getBtnStyles();
        stopAnimBtn.onclick = () => this.stopAnimationPreview();

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'In Projekt speichern';
        saveBtn.style.cssText = this.getBtnStyles(true);
        saveBtn.onclick = () => this.uploadAndSave();

        const jsonBtn = document.createElement('button');
        jsonBtn.textContent = 'JSON herunterladen';
        jsonBtn.style.cssText = this.getBtnStyles();
        jsonBtn.onclick = () => this.downloadJSON();

        row.appendChild(buildBtn);
        row.appendChild(previewAnimBtn);
        row.appendChild(stopAnimBtn);
        row.appendChild(saveBtn);
        row.appendChild(jsonBtn);

        const speedRow = document.createElement('div');
        speedRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;';

        const speedLabel = document.createElement('label');
        speedLabel.textContent = 'Vorschau-Geschwindigkeit (FPS):';
        speedLabel.style.cssText = 'font-size:12px;color:#e0d4f5;';

        const speedInput = document.createElement('input');
        speedInput.type = 'number';
        speedInput.min = '1';
        speedInput.max = '60';
        speedInput.step = '1';
        speedInput.value = String(this.settings.fps);
        speedInput.style.cssText = 'width:60px;padding:4px;background:#2a2a3e;color:#e0d4f5;border:1px solid #444;border-radius:4px;';
        speedInput.onchange = () => {
            const v = parseInt(speedInput.value, 10);
            this.settings.fps = isNaN(v) ? this.settings.fps : Math.max(1, Math.min(60, v));
            speedInput.value = String(this.settings.fps);
        };

        const slowBtn = document.createElement('button');
        slowBtn.textContent = '0.5x';
        slowBtn.style.cssText = this.getBtnStyles();
        slowBtn.onclick = () => { this.settings.fps = Math.max(1, Math.floor(this.settings.fps / 2)); speedInput.value = String(this.settings.fps); };

        const fastBtn = document.createElement('button');
        fastBtn.textContent = '2x';
        fastBtn.style.cssText = this.getBtnStyles();
        fastBtn.onclick = () => { this.settings.fps = Math.min(60, Math.max(1, this.settings.fps * 2)); speedInput.value = String(this.settings.fps); };

        speedRow.appendChild(speedLabel);
        speedRow.appendChild(speedInput);
        speedRow.appendChild(slowBtn);
        speedRow.appendChild(fastBtn);

        const animCanvas = document.createElement('canvas');
        animCanvas.width = this.settings.spriteWidth;
        animCanvas.height = this.settings.spriteHeight;
        animCanvas.style.cssText = `width:128px;height:128px;border-radius:4px;margin-top:8px;${this.getCheckerboardStyles()}`;
        this.animPreviewCanvas = animCanvas;

        section.appendChild(row);
        section.appendChild(speedRow);
        section.appendChild(animCanvas);

        return section;
    }

    /** Aktualisiert die Frame-Vorschau, wenn eine Chroma-Key-Einstellung geändert wurde. */
    private refreshPreviewIfChromaKey(key: keyof ToolSettings): void {
        if (key !== 'removeBackground' && key !== 'backgroundColor' && key !== 'tolerance') return;
        if (this.frames.length === 0) return;
        this.renderFrameGrid();
    }

    private revokeVideoUrl(): void {
        if (this.videoSrc.startsWith('blob:')) {
            URL.revokeObjectURL(this.videoSrc);
        }
        this.videoSrc = '';
    }

    private stopAnimationPreview(): void {
        if (this.animationPreviewTimer !== null) {
            window.clearTimeout(this.animationPreviewTimer);
            this.animationPreviewTimer = null;
        }
    }

    private setAllSelected(selected: boolean): void {
        this.frames.forEach(f => f.selected = selected);
        this.renderFrameGrid();
    }

    private loadVideo(file: File): void {
        this.revokeVideoUrl();
        this.videoSrc = URL.createObjectURL(file);
        this.initVideo(this.videoSrc, file.name);
    }

    private loadVideoUrl(url: string): void {
        if (!url) return;
        this.revokeVideoUrl();
        this.videoSrc = url;
        const parts = url.split('/');
        this.initVideo(this.videoSrc, parts[parts.length - 1] || url);
    }

    private initVideo(src: string, fileName: string): void {
        if (!this.video) return;
        this.video.src = src;
        this.video.load();
        this.video.onloadedmetadata = () => {
            this.videoDuration = this.video?.duration || 0;
            this.videoWidth = this.video?.videoWidth || 0;
            this.videoHeight = this.video?.videoHeight || 0;
            this.settings.start = 0;
            this.settings.end = this.videoDuration;
            this.log(`Geladen: ${fileName} | ${this.videoDuration.toFixed(2)}s | ${this.videoWidth}x${this.videoHeight}`);
            this.renderVideoInfo();
        };
        this.video.onerror = () => this.log('Fehler beim Laden des Videos.');
    }

    private renderVideoInfo(): void {
        if (!this.videoInfoEl) return;
        this.videoInfoEl.textContent = `Video: ${this.videoDuration.toFixed(2)}s | ${this.videoWidth}x${this.videoHeight}px | ${this.frames.length} Frames`;
    }

    private async extractFrames(): Promise<void> {
        if (!this.video || !this.videoDuration) {
            this.log('Kein Video geladen.');
            return;
        }

        const start = Math.max(0, Math.min(this.settings.start, this.videoDuration));
        const end = this.settings.end !== null
            ? Math.max(start, Math.min(this.settings.end, this.videoDuration))
            : this.videoDuration;
        const interval = Math.max(0.01, this.settings.interval);

        const estimated = Math.floor((end - start) / interval) + 1;
        if (estimated > 240) {
            if (!confirm(`Mit diesen Einstellungen werden ${estimated} Frames erzeugt. Fortfahren?`)) {
                return;
            }
        }

        this.frames = [];
        const canvas = document.createElement('canvas');
        canvas.width = this.videoWidth;
        canvas.height = this.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        let id = 0;
        for (let t = start; t <= end + 0.001; t += interval) {
            const clampedT = Math.min(t, end);
            this.video.currentTime = clampedT;
            await new Promise<void>((resolve, reject) => {
                if (!this.video) return resolve();
                this.video.onseeked = () => resolve();
                this.video.onerror = () => reject(new Error('Seek error'));
            });

            ctx.drawImage(this.video, 0, 0);
            const imageData = ctx.getImageData(0, 0, this.videoWidth, this.videoHeight);
            this.frames.push({ id: id++, time: clampedT, imageData, selected: true });

            if (id % 10 === 0) {
                this.log(`${id} Frames extrahiert...`);
            }
        }

        this.log(`${this.frames.length} Frames extrahiert.`);
        this.renderVideoInfo();
        this.renderFrameGrid();
    }

    private async renderFrameGrid(): Promise<void> {
        if (!this.frameGridEl) return;
        this.frameGridEl.innerHTML = '';

        for (let i = 0; i < this.frames.length; i++) {
            const frame = this.frames[i];
            const card = document.createElement('div');
            const updateCardStyle = (selected: boolean) => {
                card.style.cssText = `background:#252536;border-radius:4px;padding:6px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.2);border:2px solid ${selected ? '#4da6ff' : 'transparent'};`;
            };
            updateCardStyle(frame.selected);

            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = 64;
            thumbCanvas.height = 64;
            thumbCanvas.style.cssText = `border-radius:4px;${this.getCheckerboardStyles()}`;
            const tctx = thumbCanvas.getContext('2d');
            if (tctx) {
                const preview = this.processFrame(frame.imageData);
                const bmp = await createImageBitmap(preview);
                const scale = Math.min(64 / preview.width, 64 / preview.height);
                const dw = preview.width * scale;
                const dh = preview.height * scale;
                tctx.drawImage(bmp, 0, 0, preview.width, preview.height, (64 - dw) / 2, (64 - dh) / 2, dw, dh);
                bmp.close?.();
            }

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = frame.selected;
            cb.onclick = (e) => { e.stopPropagation(); };
            cb.onchange = () => { frame.selected = cb.checked; updateCardStyle(frame.selected); };

            const label = document.createElement('div');
            label.style.cssText = 'font-size:10px;color:#aaa;text-align:center;white-space:pre;';
            label.textContent = `Frame ${i + 1}\n${frame.time.toFixed(2)}s`;

            const controls = document.createElement('div');
            controls.style.cssText = 'display:flex;gap:4px;';

            const leftBtn = document.createElement('button');
            leftBtn.textContent = '←';
            leftBtn.style.cssText = this.getBtnStyles();
            leftBtn.onclick = (e) => { e.stopPropagation(); this.moveFrame(i, -1); };

            const rightBtn = document.createElement('button');
            rightBtn.textContent = '→';
            rightBtn.style.cssText = this.getBtnStyles();
            rightBtn.onclick = (e) => { e.stopPropagation(); this.moveFrame(i, 1); };

            controls.appendChild(leftBtn);
            controls.appendChild(rightBtn);

            card.onclick = () => { frame.selected = !frame.selected; cb.checked = frame.selected; updateCardStyle(frame.selected); };

            card.appendChild(thumbCanvas);
            card.appendChild(cb);
            card.appendChild(label);
            card.appendChild(controls);
            this.frameGridEl.appendChild(card);
        }
    }

    private moveFrame(index: number, delta: number): void {
        const newIndex = index + delta;
        if (newIndex < 0 || newIndex >= this.frames.length) return;
        const temp = this.frames[index];
        this.frames[index] = this.frames[newIndex];
        this.frames[newIndex] = temp;
        this.renderFrameGrid();
    }

    private pickColorFromVideo(input: HTMLInputElement): void {
        if (!this.video || !this.video.videoWidth || !this.video.videoHeight) {
            this.log('Bitte zuerst Video laden.');
            return;
        }
        this.video.pause();

        const canvas = document.createElement('canvas');
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        canvas.style.cssText = 'max-width:90vw;max-height:80vh;cursor:crosshair;';
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(this.video, 0, 0);

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:20000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;';

        const info = document.createElement('div');
        info.textContent = 'Klicke auf die Hintergrundfarbe im Video';
        info.style.cssText = 'color:#fff;font-size:14px;';

        const close = document.createElement('button');
        close.textContent = 'Schließen';
        close.style.cssText = this.getBtnStyles();
        close.onclick = () => overlay.remove();

        overlay.appendChild(info);
        overlay.appendChild(canvas);
        overlay.appendChild(close);
        document.body.appendChild(overlay);

        canvas.onclick = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.min(Math.floor((e.clientX - rect.left) * scaleX), canvas.width - 1);
            const y = Math.min(Math.floor((e.clientY - rect.top) * scaleY), canvas.height - 1);
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
            this.settings.backgroundColor = hex;
            input.value = hex;
            this.log(`Hintergrundfarbe aus Video: ${hex} bei (${x},${y})`);
            overlay.remove();
        };
    }

    /** Wendet die aktuellen Bildbearbeitungs-Einstellungen auf ein Frame an. */
    private processFrame(imageData: ImageData): ImageData {
        if (!this.settings.removeBackground) return imageData;
        return removeBackgroundFromImageData(imageData, this.settings.backgroundColor, this.settings.tolerance);
    }

    /** Ab diesem Alpha-Wert gilt ein Pixel als zum Objekt gehörend (filtert Anti-Aliasing-Ränder). */
    private static readonly BBOX_ALPHA_THRESHOLD = 16;

    /** Mindestanteil deckender Pixel, damit eine Zeile/Spalte als Objekt zählt (filtert Störpixel). */
    private static readonly BBOX_MIN_DENSITY = 0.005;

    /**
     * Bounding-Box der deckenden Pixel — rauschrobust.
     *
     * Ein einzelner übrig gebliebener Pixel (Kompressionsrauschen, Bildrand,
     * Wasserzeichen) würde eine naive Bounding-Box auf das ganze Bild aufziehen.
     * Deshalb werden Zeilen/Spalten nur berücksichtigt, wenn sie eine Mindestzahl
     * deckender Pixel enthalten.
     */
    private computeBbox(imageData: ImageData): { x: number; y: number; w: number; h: number } {
        const { width, height, data } = imageData;

        const rowCounts = new Uint32Array(height);
        const colCounts = new Uint32Array(width);
        let opaqueTotal = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (data[(y * width + x) * 4 + 3] > VideoToSpriteSheetTool.BBOX_ALPHA_THRESHOLD) {
                    rowCounts[y]++;
                    colCounts[x]++;
                    opaqueTotal++;
                }
            }
        }

        if (opaqueTotal === 0) return { x: 0, y: 0, w: width, h: height };

        const findRange = (counts: Uint32Array, minCount: number): { start: number; end: number } | null => {
            let start = -1, end = -1;
            for (let i = 0; i < counts.length; i++) {
                if (counts[i] >= minCount) {
                    if (start === -1) start = i;
                    end = i;
                }
            }
            return start === -1 ? null : { start, end };
        };

        const rowMin = Math.max(2, Math.ceil(width * VideoToSpriteSheetTool.BBOX_MIN_DENSITY));
        const colMin = Math.max(2, Math.ceil(height * VideoToSpriteSheetTool.BBOX_MIN_DENSITY));

        // Fällt das Objekt durch die Dichteprüfung (sehr kleines/dünnes Objekt),
        // fallen wir auf "mindestens ein Pixel" zurück.
        const rows = findRange(rowCounts, rowMin) ?? findRange(rowCounts, 1);
        const cols = findRange(colCounts, colMin) ?? findRange(colCounts, 1);

        if (!rows || !cols) return { x: 0, y: 0, w: width, h: height };

        return {
            x: cols.start,
            y: rows.start,
            w: cols.end - cols.start + 1,
            h: rows.end - rows.start + 1
        };
    }

    /**
     * Ermittelt eine für alle Frames einheitliche Zuschnittsgröße.
     *
     * Die Größe ergibt sich aus dem Frame, dessen Objekt am meisten Platz braucht
     * (Maximum der einzelnen Bounding-Box-Breiten bzw. -Höhen), nicht aus deren
     * Vereinigung. Dadurch fließt die Bewegung des Objekts durch das Bild nicht
     * in die Rahmengröße ein und es bleibt möglichst wenig Hintergrund übrig.
     *
     * Jeder Frame erhält denselben Rahmen, zentriert auf die Mitte seiner eigenen
     * Bounding-Box und in die Bildgrenzen zurückgeschoben.
     */
    private computeUniformCrop(frames: ImageData[], padding: number):
        { w: number; h: number; rects: { x: number; y: number }[] } {

        const imageW = frames[0].width;
        const imageH = frames[0].height;

        const bboxes = frames.map(f => this.computeBbox(f));

        const maxW = Math.max(...bboxes.map(b => b.w));
        const maxH = Math.max(...bboxes.map(b => b.h));

        const w = Math.min(imageW, Math.max(1, Math.ceil(maxW + padding * 2)));
        const h = Math.min(imageH, Math.max(1, Math.ceil(maxH + padding * 2)));

        const minBoxW = Math.min(...bboxes.map(b => b.w));
        const minBoxH = Math.min(...bboxes.map(b => b.h));
        logger.info(
            `Auto-Crop: Video ${imageW}x${imageH} | ` +
            `Bbox min ${minBoxW}x${minBoxH}, max ${maxW}x${maxH} | ` +
            `Rahmen ${w}x${h} (${((w / imageW) * 100).toFixed(0)}% x ${((h / imageH) * 100).toFixed(0)}% des Bildes)`
        );

        const rects = bboxes.map(b => {
            const centerX = b.x + b.w / 2;
            const centerY = b.y + b.h / 2;
            return {
                x: Math.max(0, Math.min(imageW - w, Math.round(centerX - w / 2))),
                y: Math.max(0, Math.min(imageH - h, Math.round(centerY - h / 2)))
            };
        });

        return { w, h, rects };
    }

    /** Übernimmt einen automatisch ermittelten Wert auch sichtbar ins Eingabefeld. */
    private applySettingValue(key: keyof ToolSettings, value: number): void {
        (this.settings as any)[key] = value;
        const input = this.settingInputs[key];
        if (input) input.value = String(value);
    }

    private cropImageData(imageData: ImageData, x: number, y: number, w: number, h: number): ImageData {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context missing');
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        const tctx = tempCanvas.getContext('2d');
        if (!tctx) throw new Error('Canvas context missing');
        tctx.putImageData(imageData, 0, 0);
        ctx.drawImage(tempCanvas, x, y, w, h, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h);
    }

    private async buildSheet(): Promise<void> {
        const selected = this.frames.filter(f => f.selected);
        if (selected.length === 0) {
            this.log('Keine Frames ausgewählt.');
            return;
        }

        this.log('Verarbeite Frames...');

        const processed: ImageData[] = [];
        for (const frame of selected) {
            processed.push(this.processFrame(frame.imageData));
        }

        if (this.settings.removeBackground && processed.length > 0) {
            const first = processed[0].data;
            let transparent = 0;
            for (let i = 3; i < first.length; i += 4) {
                if (first[i] === 0) transparent++;
            }
            const total = first.length / 4;
            this.log(`Chroma-Key (${this.settings.backgroundColor}, Toleranz ${this.settings.tolerance}): ${((transparent / total) * 100).toFixed(1)}% transparent im ersten Frame.`);
        }

        let cropW = this.videoWidth;
        let cropH = this.videoHeight;
        let cropRects = processed.map(() => ({ x: 0, y: 0 }));

        if (this.settings.autoCrop) {
            const crop = this.computeUniformCrop(processed, this.settings.cropPadding);
            cropW = crop.w;
            cropH = crop.h;
            cropRects = crop.rects;

            // Zellgröße automatisch aus dem Rahmen übernehmen: 1:1-Pixel, kein Verschnitt,
            // keine Verzerrung durch abweichende Seitenverhältnisse.
            this.applySettingValue('spriteWidth', cropW);
            this.applySettingValue('spriteHeight', cropH);

            const shrink = 1 - (cropW * cropH) / (this.videoWidth * this.videoHeight);
            if (shrink < 0.05) {
                this.log(
                    `Auto-Zuschnitt: Rahmen ${cropW}x${cropH}px — fast das ganze Bild (${this.videoWidth}x${this.videoHeight}). ` +
                    `Hintergrund wahrscheinlich nicht sauber entfernt: Toleranz erhöhen oder Farbe per "Aus Video" neu wählen.`
                );
            } else {
                this.log(
                    `Auto-Zuschnitt: Rahmen ${cropW}x${cropH}px statt ${this.videoWidth}x${this.videoHeight} ` +
                    `(${(shrink * 100).toFixed(0)}% weniger Fläche, Rand ${this.settings.cropPadding}px).`
                );
            }
        }

        const cropped = processed.map((p, i) => this.cropImageData(p, cropRects[i].x, cropRects[i].y, cropW, cropH));

        this.sheetColumns = this.settings.columns;
        this.sheetRows = Math.ceil(cropped.length / this.sheetColumns);

        const canvas = document.createElement('canvas');
        canvas.width = this.sheetColumns * this.settings.spriteWidth;
        canvas.height = this.sheetRows * this.settings.spriteHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.imageSmoothingEnabled = true;

        for (let i = 0; i < cropped.length; i++) {
            const col = i % this.sheetColumns;
            const row = Math.floor(i / this.sheetColumns);
            const dx = col * this.settings.spriteWidth;
            const dy = row * this.settings.spriteHeight;
            const bmp = await createImageBitmap(cropped[i]);

            const scale = Math.min(this.settings.spriteWidth / cropW, this.settings.spriteHeight / cropH);
            const dw = cropW * scale;
            const dh = cropH * scale;
            const x = dx + (this.settings.spriteWidth - dw) / 2;
            const y = dy + (this.settings.spriteHeight - dh) / 2;

            ctx.drawImage(bmp, 0, 0, cropW, cropH, x, y, dw, dh);
            bmp.close?.();
        }

        this.sheetCanvas = canvas;

        if (this.sheetPreviewEl) {
            this.sheetPreviewEl.innerHTML = '';
            const img = document.createElement('img');
            img.src = canvas.toDataURL('image/png');
            img.style.cssText = `max-width:100%;image-rendering:pixelated;${this.getCheckerboardStyles()}`;
            this.sheetPreviewEl.appendChild(img);
        }

        if (this.sheetInfoEl) {
            this.sheetInfoEl.textContent = `SpriteSheet: ${canvas.width}x${canvas.height}px | ` +
                `${this.sheetColumns}x${this.sheetRows} | ${selected.length} Frames | ` +
                `Zelle: ${this.settings.spriteWidth}x${this.settings.spriteHeight}px`;
        }

        this.log('SpriteSheet erstellt.');
    }

    private playAnimation(): void {
        this.stopAnimationPreview();
        if (!this.sheetCanvas || !this.animPreviewCanvas) return;

        const ctx = this.animPreviewCanvas.getContext('2d');
        if (!ctx) return;

        const selected = this.frames.filter(f => f.selected);
        if (selected.length === 0) return;

        this.animPreviewCanvas.width = this.settings.spriteWidth;
        this.animPreviewCanvas.height = this.settings.spriteHeight;

        let index = 0;
        const step = () => {
            const col = index % this.sheetColumns;
            const row = Math.floor(index / this.sheetColumns);
            ctx.clearRect(0, 0, this.settings.spriteWidth, this.settings.spriteHeight);
            ctx.drawImage(
                this.sheetCanvas as HTMLCanvasElement,
                col * this.settings.spriteWidth,
                row * this.settings.spriteHeight,
                this.settings.spriteWidth,
                this.settings.spriteHeight,
                0, 0,
                this.settings.spriteWidth,
                this.settings.spriteHeight
            );
            index++;
            if (index >= selected.length) {
                if (this.settings.loop) {
                    index = 0;
                } else {
                    this.stopAnimationPreview();
                    return;
                }
            }
            this.animationPreviewTimer = window.setTimeout(step, 1000 / this.settings.fps);
        };
        this.animationPreviewTimer = window.setTimeout(step, 1000 / this.settings.fps);
    }

    private async uploadAndSave(): Promise<void> {
        if (!this.sheetCanvas) {
            this.log('Bitte zuerst SpriteSheet erstellen.');
            return;
        }

        const defaultName = `spritesheet_${Date.now()}`;
        const inputName = await PromptDialog.show('Name für ImageList/Animation:', defaultName);
        if (!inputName || !inputName.trim()) {
            this.log('Speichern abgebrochen.');
            return;
        }
        const resultName = inputName.trim().replace(/\.png$/i, '');
        const baseName = `${resultName}.png`;
        const imageBase64 = this.sheetCanvas.toDataURL('image/png');

        try {
            this.log('Lade SpriteSheet hoch...');
            const res = await fetch(this.uploadUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: baseName, imageBase64 })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Upload fehlgeschlagen (${res.status})`);
            }

            const data = await res.json();
            this.log(`Gespeichert: ${data.fileName}`);

            const blob = await (await fetch(imageBase64)).blob();
            const selected = this.frames.filter(f => f.selected);

            const result: ExportResult = {
                fileName: data.fileName,
                url: data.url,
                imageBlob: blob,
                metadata: {
                    name: resultName,
                    image: data.url,
                    frameWidth: this.settings.spriteWidth,
                    frameHeight: this.settings.spriteHeight,
                    frames: selected.length,
                    columns: this.sheetColumns,
                    rows: this.sheetRows,
                    frameInterval: this.settings.interval
                }
            };

            if (this.onExport) this.onExport(result);
        } catch (e: any) {
            this.log(`Fehler: ${e.message}`);
            if (this.onError) this.onError(e.message);
        }
    }

    private downloadJSON(): void {
        if (!this.sheetCanvas) {
            this.log('Bitte zuerst SpriteSheet erstellen.');
            return;
        }
        const selected = this.frames.filter(f => f.selected);
        const meta = {
            name: `spritesheet_${Date.now()}`,
            image: 'spritesheet.png',
            frameWidth: this.settings.spriteWidth,
            frameHeight: this.settings.spriteHeight,
            frames: selected.length,
            columns: this.sheetColumns,
            rows: this.sheetRows,
            frameInterval: this.settings.interval
        };
        const blob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${meta.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
