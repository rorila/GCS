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
import {
    VIDEO_TO_SPRITESHEET_TOOL_VERSION,
    PERF,
    Frame,
    ToolSettings,
    ExportResult
} from './spritesheet/VideoToSpriteSheetTypes';
import { VideoToSpriteSheetCrop } from './spritesheet/VideoToSpriteSheetCrop';
import { VideoToSpriteSheetUI } from './spritesheet/VideoToSpriteSheetUI';

export { VIDEO_TO_SPRITESHEET_TOOL_VERSION, PERF };
export type { Frame, ToolSettings, ExportResult };

const logger = Logger.get('VideoToSpriteSheetTool');

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
        maxFrameSize: PERF.MAX_FRAME_EDGE,
        autoColumns: true,
        removeBackground: false,
        backgroundColor: '#00FF00',
        tolerance: 30,
        cropMode: 'none',
        cropPadding: 2,
        manualCropRect: null,
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
        if (this.logEl) {
            this.logEl.style.color = '#ff9f43';
            this.logEl.textContent = msg;
        }
        logger.info(msg);
    }

    private logSuccess(msg: string): void {
        if (this.logEl) {
            this.logEl.style.color = '#7fd1a0';
            this.logEl.textContent = msg;
        }
        logger.info(msg);
    }

    private render(): void {
        this.container.className = 'gcs-vts-overlay';
        this.container.style.cssText = VideoToSpriteSheetUI.getOverlayStyles();

        const dialog = document.createElement('div');
        dialog.className = 'gcs-vts-dialog';
        dialog.style.cssText = VideoToSpriteSheetUI.getDialogStyles();

        const header = document.createElement('div');
        header.style.cssText = VideoToSpriteSheetUI.getHeaderStyles();
        header.innerHTML = `<h2 style="margin:0;font-size:16px;color:#e0e0e0;">🎬 Video → SpriteSheet <span style="font-size:11px;color:#7fd1a0;font-weight:normal;">v${VIDEO_TO_SPRITESHEET_TOOL_VERSION}</span></h2>`;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = VideoToSpriteSheetUI.getCloseBtnStyles();
        closeBtn.onclick = () => this.close();
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        const content = document.createElement('div');
        content.className = 'gcs-vts-content';
        content.style.cssText = VideoToSpriteSheetUI.getContentStyles();

        this.videoInfoEl = document.createElement('div');
        this.videoInfoEl.style.cssText = 'font-size:12px;color:#aaa;margin-bottom:8px;';

        this.frameGridEl = document.createElement('div');
        this.frameGridEl.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;flex:0 0 auto;min-height:420px;max-height:520px;overflow-y:auto;padding:12px;background:#1e1e2e;border-radius:6px;border:1px solid #3a3a4f;';

        this.sheetPreviewEl = document.createElement('div');
        this.sheetPreviewEl.style.cssText = 'margin-top:12px;overflow:auto;flex:0 0 auto;min-height:320px;max-height:520px;background:#1e1e2e;border-radius:6px;padding:8px;';

        this.sheetInfoEl = document.createElement('div');
        this.sheetInfoEl.style.cssText = 'font-size:12px;color:#aaa;margin-top:8px;';

        const logBox = document.createElement('div');
        logBox.style.cssText = 'margin-top:8px;font-size:11px;color:#ff9f43;min-height:20px;';
        this.logEl = logBox;

        content.appendChild(VideoToSpriteSheetUI.renderVideoSection(
            (file) => this.loadVideo(file),
            (url) => this.loadVideoUrl(url),
            (player) => { this.video = player; }
        ));
        content.appendChild(this.videoInfoEl);
        content.appendChild(VideoToSpriteSheetUI.renderSettingsSection(
            this.settings,
            this.settingInputs,
            (key, val) => {
                (this.settings as any)[key] = val;
                this.refreshPreviewIfChromaKey(key);
            },
            (input) => VideoToSpriteSheetUI.pickColorFromVideo(
                this.video,
                input,
                (hex, x, y) => {
                    this.settings.backgroundColor = hex;
                    this.log(`Hintergrundfarbe aus Video: ${hex} bei (${x},${y})`);
                    this.refreshPreviewIfChromaKey('backgroundColor');
                },
                (msg) => this.log(msg)
            ),
            (onApplied) => VideoToSpriteSheetUI.openManualCropOverlay(
                this.video,
                this.videoWidth,
                this.videoHeight,
                this.settings,
                onApplied,
                (msg) => this.log(msg)
            )
        ));
        content.appendChild(VideoToSpriteSheetUI.renderFrameActions(
            () => this.extractFrames(),
            () => this.setAllSelected(true),
            () => this.setAllSelected(false)
        ));
        content.appendChild(this.frameGridEl);
        content.appendChild(VideoToSpriteSheetUI.renderSheetSection(
            this.settings,
            () => {
                this.buildSheet().catch(e => {
                    this.log(`Fehler beim Erstellen: ${e?.message || e}`);
                    logger.error('buildSheet fehlgeschlagen:', e);
                });
            },
            () => this.playAnimation(),
            () => this.stopAnimationPreview(),
            () => this.uploadAndSave(),
            () => this.downloadJSON(),
            (canvas) => { this.animPreviewCanvas = canvas; }
        ));
        content.appendChild(this.sheetPreviewEl);
        content.appendChild(this.sheetInfoEl);
        content.appendChild(logBox);

        dialog.appendChild(content);
        this.container.appendChild(dialog);
    }

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

            const THUMB_MAX = 128;
            const preview = this.processFrame(frame.imageData);
            let crop: { x: number; y: number; w: number; h: number };

            if (this.settings.cropMode === 'manual' && this.settings.manualCropRect) {
                const r = this.settings.manualCropRect;
                const x = Math.max(0, Math.min(r.x, preview.width - 1));
                const y = Math.max(0, Math.min(r.y, preview.height - 1));
                crop = {
                    x, y,
                    w: Math.max(1, Math.min(r.w, preview.width - x)),
                    h: Math.max(1, Math.min(r.h, preview.height - y))
                };
            } else if (this.settings.cropMode === 'auto') {
                const bbox = VideoToSpriteSheetCrop.computeBbox(preview);
                const pad = this.settings.cropPadding;
                const x = Math.max(0, bbox.x - pad);
                const y = Math.max(0, bbox.y - pad);
                crop = {
                    x, y,
                    w: Math.min(preview.width - x, bbox.w + pad * 2),
                    h: Math.min(preview.height - y, bbox.h + pad * 2)
                };
            } else {
                crop = { x: 0, y: 0, w: preview.width, h: preview.height };
            }

            const scale = Math.min(THUMB_MAX / crop.w, THUMB_MAX / crop.h);
            const thumbW = Math.max(1, Math.round(crop.w * scale));
            const thumbH = Math.max(1, Math.round(crop.h * scale));

            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = thumbW;
            thumbCanvas.height = thumbH;
            thumbCanvas.style.cssText = `width:auto;height:auto;max-width:${THUMB_MAX}px;max-height:${THUMB_MAX}px;border-radius:4px;${VideoToSpriteSheetUI.getCheckerboardStyles()}`;

            const tctx = thumbCanvas.getContext('2d');
            if (tctx) {
                const bmp = await createImageBitmap(preview, crop.x, crop.y, crop.w, crop.h);
                tctx.drawImage(bmp, 0, 0, crop.w, crop.h, 0, 0, thumbW, thumbH);
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
            leftBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();
            leftBtn.onclick = (e) => { e.stopPropagation(); this.moveFrame(i, -1); };

            const rightBtn = document.createElement('button');
            rightBtn.textContent = '→';
            rightBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();
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

    private processFrame(imageData: ImageData): ImageData {
        if (!this.settings.removeBackground) return imageData;
        return removeBackgroundFromImageData(imageData, this.settings.backgroundColor, this.settings.tolerance);
    }

    private applySettingValue(key: keyof ToolSettings, value: number): void {
        (this.settings as any)[key] = value;
        const input = this.settingInputs[key];
        if (input) input.value = String(value);
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

        if (this.settings.cropMode === 'manual' && this.settings.manualCropRect) {
            const r = this.settings.manualCropRect;
            cropW = Math.max(1, Math.min(r.w, this.videoWidth - Math.min(r.x, this.videoWidth - 1)));
            cropH = Math.max(1, Math.min(r.h, this.videoHeight - Math.min(r.y, this.videoHeight - 1)));
            const clampedX = Math.max(0, Math.min(r.x, this.videoWidth - cropW));
            const clampedY = Math.max(0, Math.min(r.y, this.videoHeight - cropH));
            cropRects = processed.map(() => ({ x: clampedX, y: clampedY }));

            this.applySettingValue('spriteWidth', cropW);
            this.applySettingValue('spriteHeight', cropH);

            this.log(`Manueller Zuschnitt: Rahmen ${cropW}x${cropH}px bei (${clampedX},${clampedY}) — für alle Frames identisch.`);
        } else if (this.settings.cropMode === 'auto') {
            const crop = VideoToSpriteSheetCrop.computeUniformCrop(processed, this.settings.cropPadding);
            cropW = crop.w;
            cropH = crop.h;
            cropRects = crop.rects;

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
        } else {
            this.applySettingValue('spriteWidth', cropW);
            this.applySettingValue('spriteHeight', cropH);
        }

        // Frame-Zelle limitieren
        const limitRes = VideoToSpriteSheetCrop.calculateLimitedFrameSize(cropW, cropH, this.settings.maxFrameSize);
        if (limitRes.cellW !== cropW || limitRes.cellH !== cropH) {
            this.applySettingValue('spriteWidth', limitRes.cellW);
            this.applySettingValue('spriteHeight', limitRes.cellH);
            if (limitRes.logMsg) this.log(limitRes.logMsg);
        }

        const cropped = processed.map((p, i) => VideoToSpriteSheetCrop.cropImageData(p, cropRects[i].x, cropRects[i].y, cropW, cropH));

        this.sheetColumns = VideoToSpriteSheetCrop.computeSheetColumns(
            cropped.length,
            this.settings.spriteWidth,
            this.settings.spriteHeight,
            this.settings.autoColumns,
            this.settings.columns,
            (msg) => this.log(msg)
        );
        if (this.settings.autoColumns && this.sheetColumns !== this.settings.columns) {
            this.applySettingValue('columns', this.sheetColumns);
        }
        this.sheetRows = Math.max(1, Math.ceil(cropped.length / this.sheetColumns));

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

        if (this.animPreviewCanvas) {
            this.animPreviewCanvas.width = this.settings.spriteWidth;
            this.animPreviewCanvas.height = this.settings.spriteHeight;
            this.drawPreviewFrame(0);
        }

        if (this.sheetPreviewEl) {
            this.sheetPreviewEl.innerHTML = '';

            const caption = document.createElement('div');
            caption.textContent = `SpriteSheet (alle Frames) — ${this.sheetColumns}x${this.sheetRows}, ${canvas.width}x${canvas.height}px`;
            caption.style.cssText = 'font-size:11px;color:#aaa;margin-bottom:6px;';
            this.sheetPreviewEl.appendChild(caption);

            const img = document.createElement('img');
            img.src = canvas.toDataURL('image/png');
            img.style.cssText = `display:block;width:auto;height:auto;max-width:100%;max-height:480px;image-rendering:pixelated;${VideoToSpriteSheetUI.getCheckerboardStyles()}`;
            this.sheetPreviewEl.appendChild(img);
        }

        this.reportSheetBudget(canvas, selected.length);
    }

    private reportSheetBudget(canvas: HTMLCanvasElement, frameCount: number): void {
        const pixels = canvas.width * canvas.height;
        const megaBytes = (pixels * 4) / (1024 * 1024);
        const overEdge = canvas.width > PERF.MAX_SHEET_EDGE || canvas.height > PERF.MAX_SHEET_EDGE;
        const overTexture = canvas.width > PERF.MAX_TEXTURE_EDGE || canvas.height > PERF.MAX_TEXTURE_EDGE;
        const overPixels = pixels > PERF.MAX_SHEET_PIXELS;

        const level = (overTexture || overPixels) ? 'bad' : (overEdge ? 'warn' : 'good');

        if (this.sheetInfoEl) {
            this.sheetInfoEl.textContent =
                `SpriteSheet: ${canvas.width}x${canvas.height}px | ${this.sheetColumns}x${this.sheetRows} | ` +
                `${frameCount} Frames | Zelle: ${this.settings.spriteWidth}x${this.settings.spriteHeight}px | ` +
                `Speicher: ca. ${megaBytes.toFixed(1)} MB`;
            this.sheetInfoEl.style.color =
                level === 'good' ? '#4caf50' : level === 'warn' ? '#ffb300' : '#ff5252';
        }

        if (overTexture) {
            this.log(
                `Sheet ${canvas.width}x${canvas.height}px überschreitet die Texturgrenze von ` +
                `${PERF.MAX_TEXTURE_EDGE}px — viele Geräte rendern dann ohne GPU. Bitte verkleinern.`
            );
        } else if (overPixels) {
            this.log(
                `Sheet belegt ca. ${megaBytes.toFixed(1)} MB Speicher (Budget: ` +
                `${((PERF.MAX_SHEET_PIXELS * 4) / (1024 * 1024)).toFixed(0)} MB). Auf schwacher Hardware ruckelt ` +
                `das Spiel, weil der Browser Bilder ständig neu dekodiert.`
            );
        } else if (overEdge) {
            this.log(`Sheet über ${PERF.MAX_SHEET_EDGE}px Kantenlänge — auf älteren Mobilgeräten problematisch.`);
        } else {
            this.logSuccess(
                `SpriteSheet erstellt: ${canvas.width}x${canvas.height}px, ${this.sheetColumns}x${this.sheetRows}, ` +
                `ca. ${megaBytes.toFixed(1)} MB.`
            );
        }

        if (frameCount > PERF.MAX_FRAMES) {
            this.log(
                `${frameCount} Frames sind mehr als empfohlen (${PERF.MAX_FRAMES}). ` +
                `Frame-Abstand erhöhen — z. B. ${(this.settings.interval * frameCount / PERF.MAX_FRAMES).toFixed(2)}s ` +
                `ergibt etwa ${PERF.MAX_FRAMES} Frames bei gleicher Laufzeit.`
            );
        }
    }

    private playAnimation(): void {
        this.stopAnimationPreview();
        if (!this.sheetCanvas || !this.animPreviewCanvas) return;

        const selected = this.frames.filter(f => f.selected);
        if (selected.length === 0) return;

        this.animPreviewCanvas.width = this.settings.spriteWidth;
        this.animPreviewCanvas.height = this.settings.spriteHeight;

        let index = 0;
        const step = () => {
            this.drawPreviewFrame(index);
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
        step();
    }

    private drawPreviewFrame(index: number): void {
        if (!this.sheetCanvas || !this.animPreviewCanvas) return;
        const ctx = this.animPreviewCanvas.getContext('2d');
        if (!ctx) return;
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

            this.logSuccess(
                `ImageList '${resultName}' erzeugt: ${selected.length} Frames, ` +
                `${this.sheetColumns}x${this.sheetRows} Raster, ` +
                `Framegröße ${this.settings.spriteWidth}x${this.settings.spriteHeight}px, ` +
                `Datei ${data.url}`
            );

            if (this.onExport) this.onExport(result);

            window.setTimeout(() => this.close(), 600);
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
