/**
 * VideoToSpriteSheetUI
 *
 * UI-Styles, Formular-Hilfsfunktionen und Overlays (Manueller Zuschnitt, Farbauswahl)
 * für das VideoToSpriteSheetTool.
 */

import { CropRect, ToolSettings } from './VideoToSpriteSheetTypes';

export class VideoToSpriteSheetUI {
    public static getOverlayStyles(): string {
        return 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;justify-content:center;align-items:center;';
    }

    public static getDialogStyles(): string {
        return 'width:min(920px,95vw);height:min(90vh,800px);background:#252536;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden;';
    }

    public static getHeaderStyles(): string {
        return 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#1e1e2e;border-bottom:1px solid #333;';
    }

    public static getCloseBtnStyles(): string {
        return 'background:transparent;border:none;color:#aaa;font-size:16px;cursor:pointer;';
    }

    public static getContentStyles(): string {
        return 'flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;';
    }

    public static getSectionStyles(): string {
        return 'background:#1e1e2e;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px;';
    }

    /** Schachbrett-Hintergrund, damit Transparenz sichtbar wird. */
    public static getCheckerboardStyles(): string {
        return 'background-image:linear-gradient(45deg,#555 25%,transparent 25%),linear-gradient(-45deg,#555 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#555 75%),linear-gradient(-45deg,transparent 75%,#555 75%);background-size:12px 12px;background-position:0 0,0 6px,6px -6px,-6px 0;background-color:#888;';
    }

    public static getBtnStyles(primary = false): string {
        const base = 'padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;border:none;';
        return primary
            ? `${base}background:#4da6ff;color:#fff;`
            : `${base}background:#3a3a4f;color:#e0d4f5;`;
    }

    public static renderVideoSection(
        onLoadFile: (file: File) => void,
        onLoadUrl: (url: string) => void,
        onPlayerCreated: (player: HTMLVideoElement) => void
    ): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = VideoToSpriteSheetUI.getSectionStyles();

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'video/mp4,video/webm';
        fileInput.style.cssText = 'display:none;';
        fileInput.onchange = () => {
            if (fileInput.files && fileInput.files[0]) {
                onLoadFile(fileInput.files[0]);
            }
        };

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Video laden';
        loadBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles(true);
        loadBtn.onclick = () => fileInput.click();

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.placeholder = 'oder Pfad/URL (./videos/clip.webm)';
        urlInput.style.cssText = 'flex:1;min-width:180px;font-size:12px;padding:4px;background:#2a2a3e;color:#e0d4f5;border:1px solid #444;border-radius:4px;';
        urlInput.onchange = () => onLoadUrl(urlInput.value.trim());

        const player = document.createElement('video');
        player.style.cssText = 'width:100%;max-height:320px;background:#000;border-radius:4px;';
        player.controls = true;
        player.muted = true;

        onPlayerCreated(player);

        row.appendChild(fileInput);
        row.appendChild(loadBtn);
        row.appendChild(urlInput);
        section.appendChild(row);
        section.appendChild(player);

        return section;
    }

    public static renderSettingsSection(
        settings: ToolSettings,
        settingInputs: Partial<Record<keyof ToolSettings, HTMLInputElement>>,
        onSettingChange: (key: keyof ToolSettings, value: any) => void,
        onPickColor: (input: HTMLInputElement) => void,
        onOpenManualCrop: (onApplied: () => void) => void
    ): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = VideoToSpriteSheetUI.getSectionStyles();

        const makeNumber = (label: string, key: keyof ToolSettings, step: number, min?: number, max?: number) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.style.cssText = 'min-width:120px;font-size:12px;color:#e0d4f5;';
            const input = document.createElement('input');
            input.type = 'number';
            input.value = String(settings[key]);
            input.step = String(step);
            if (min !== undefined) input.min = String(min);
            if (max !== undefined) input.max = String(max);
            input.style.cssText = 'width:80px;padding:4px;background:#2a2a3e;color:#e0d4f5;border:1px solid #444;border-radius:4px;';
            settingInputs[key] = input;
            input.onchange = () => {
                const v = parseFloat(input.value);
                onSettingChange(key, isNaN(v) ? settings[key] : v);
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
            input.value = String(settings[key]);
            input.style.cssText = 'width:50px;height:24px;border:none;background:transparent;';
            input.oninput = () => {
                onSettingChange(key, input.value);
            };
            const pickBtn = document.createElement('button');
            pickBtn.textContent = 'Aus Video';
            pickBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();
            pickBtn.onclick = () => onPickColor(input);
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
            cb.checked = !!settings[key];
            cb.onchange = () => {
                onSettingChange(key, cb.checked);
            };
            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.style.cssText = 'font-size:12px;color:#e0d4f5;';
            wrap.appendChild(cb);
            wrap.appendChild(lbl);
            return wrap;
        };

        const renderCropModeRow = () => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

            const modeRow = document.createElement('div');
            modeRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
            const lbl = document.createElement('label');
            lbl.textContent = 'Zuschnitt';
            lbl.style.cssText = 'min-width:120px;font-size:12px;color:#e0d4f5;';
            const select = document.createElement('select');
            select.style.cssText = 'padding:4px;background:#2a2a3e;color:#e0d4f5;border:1px solid #444;border-radius:4px;';
            const options: Array<[ToolSettings['cropMode'], string]> = [
                ['none', 'Kein'],
                ['auto', 'Automatisch'],
                ['manual', 'Manuell']
            ];
            options.forEach(([value, text]) => {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = text;
                if (settings.cropMode === value) opt.selected = true;
                select.appendChild(opt);
            });
            modeRow.appendChild(lbl);
            modeRow.appendChild(select);

            const manualRow = document.createElement('div');
            manualRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-left:128px;';

            const setBtn = document.createElement('button');
            setBtn.textContent = 'Rahmen im Video festlegen…';
            setBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();
            setBtn.onclick = () => onOpenManualCrop(() => updateRectInfo());

            const rectInfo = document.createElement('span');
            rectInfo.style.cssText = 'font-size:12px;color:#aaa;';

            const discardBtn = document.createElement('button');
            discardBtn.textContent = 'Verwerfen';
            discardBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();
            discardBtn.onclick = () => {
                settings.manualCropRect = null;
                updateRectInfo();
            };

            const updateRectInfo = () => {
                const r = settings.manualCropRect;
                rectInfo.textContent = r ? `Rahmen: ${r.w}x${r.h}px bei (${r.x},${r.y})` : 'Kein Rahmen festgelegt.';
                discardBtn.style.display = r ? '' : 'none';
            };
            updateRectInfo();

            manualRow.appendChild(setBtn);
            manualRow.appendChild(rectInfo);
            manualRow.appendChild(discardBtn);

            const updateManualRowVisibility = () => {
                manualRow.style.display = settings.cropMode === 'manual' ? '' : 'none';
            };
            updateManualRowVisibility();

            select.onchange = () => {
                onSettingChange('cropMode', select.value as ToolSettings['cropMode']);
                updateManualRowVisibility();
            };

            wrap.appendChild(modeRow);
            wrap.appendChild(manualRow);
            return wrap;
        };

        section.appendChild(makeNumber('Frame-Abstand (s)', 'interval', 0.05, 0.05));
        section.appendChild(makeNumber('Start (s)', 'start', 0.1, 0));
        section.appendChild(makeNumber('Ende (s)', 'end', 0.1, 0));
        section.appendChild(makeNumber('Sprite-Breite', 'spriteWidth', 1, 1));
        section.appendChild(makeNumber('Sprite-Höhe', 'spriteHeight', 1, 1));
        section.appendChild(makeNumber('Spalten', 'columns', 1, 1));
        section.appendChild(makeCheckbox('Spalten automatisch', 'autoColumns'));
        section.appendChild(makeNumber('Max. Frame-Kante (px, 0=aus)', 'maxFrameSize', 16, 0));
        section.appendChild(makeCheckbox('Hintergrund entfernen', 'removeBackground'));
        section.appendChild(makeColor('Hintergrundfarbe', 'backgroundColor'));
        section.appendChild(makeNumber('Toleranz (0-100)', 'tolerance', 1, 0, 100));
        section.appendChild(renderCropModeRow());
        section.appendChild(makeNumber('Zuschnitt-Rand (px)', 'cropPadding', 1, 0));
        section.appendChild(makeCheckbox('Loop Vorschau', 'loop'));

        return section;
    }

    public static renderFrameActions(
        onExtract: () => void,
        onSelectAll: () => void,
        onSelectNone: () => void
    ): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

        const extractBtn = document.createElement('button');
        extractBtn.textContent = 'Frames extrahieren';
        extractBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles(true);
        extractBtn.onclick = () => onExtract();

        const allBtn = document.createElement('button');
        allBtn.textContent = 'Alle auswählen';
        allBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();
        allBtn.onclick = () => onSelectAll();

        const noneBtn = document.createElement('button');
        noneBtn.textContent = 'Keine auswählen';
        noneBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();
        noneBtn.onclick = () => onSelectNone();

        row.appendChild(extractBtn);
        row.appendChild(allBtn);
        row.appendChild(noneBtn);

        return row;
    }

    public static renderSheetSection(
        settings: ToolSettings,
        onBuild: () => void,
        onPlay: () => void,
        onStop: () => void,
        onSave: () => void,
        onDownloadJson: () => void,
        onAnimCanvasCreated: (canvas: HTMLCanvasElement) => void
    ): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = VideoToSpriteSheetUI.getSectionStyles();

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

        const buildBtn = document.createElement('button');
        buildBtn.textContent = 'SpriteSheet erstellen';
        buildBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles(true);
        buildBtn.onclick = () => onBuild();

        const previewAnimBtn = document.createElement('button');
        previewAnimBtn.textContent = 'Animation abspielen';
        previewAnimBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();
        previewAnimBtn.onclick = () => onPlay();

        const stopAnimBtn = document.createElement('button');
        stopAnimBtn.textContent = 'Stop';
        stopAnimBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();
        stopAnimBtn.onclick = () => onStop();

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'In Projekt speichern';
        saveBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles(true);
        saveBtn.onclick = () => onSave();

        const jsonBtn = document.createElement('button');
        jsonBtn.textContent = 'JSON herunterladen';
        jsonBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();
        jsonBtn.onclick = () => onDownloadJson();

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
        speedInput.value = String(settings.fps);
        speedInput.style.cssText = 'width:60px;padding:4px;background:#2a2a3e;color:#e0d4f5;border:1px solid #444;border-radius:4px;';
        speedInput.onchange = () => {
            const v = parseInt(speedInput.value, 10);
            settings.fps = isNaN(v) ? settings.fps : Math.max(1, Math.min(60, v));
            speedInput.value = String(settings.fps);
        };

        const slowBtn = document.createElement('button');
        slowBtn.textContent = '0.5x';
        slowBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();
        slowBtn.onclick = () => { settings.fps = Math.max(1, Math.floor(settings.fps / 2)); speedInput.value = String(settings.fps); };

        const fastBtn = document.createElement('button');
        fastBtn.textContent = '2x';
        fastBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();
        fastBtn.onclick = () => { settings.fps = Math.min(60, Math.max(1, settings.fps * 2)); speedInput.value = String(settings.fps); };

        speedRow.appendChild(speedLabel);
        speedRow.appendChild(speedInput);
        speedRow.appendChild(slowBtn);
        speedRow.appendChild(fastBtn);

        const animCanvas = document.createElement('canvas');
        animCanvas.width = settings.spriteWidth;
        animCanvas.height = settings.spriteHeight;
        animCanvas.style.cssText = `align-self:center;width:auto;height:auto;max-width:100%;max-height:320px;border-radius:4px;margin-top:8px;${VideoToSpriteSheetUI.getCheckerboardStyles()}`;
        onAnimCanvasCreated(animCanvas);

        section.appendChild(row);
        section.appendChild(speedRow);
        section.appendChild(animCanvas);

        return section;
    }

    /**
     * Overlay zum Auswählen einer Hintergrundfarbe per Eyedropper-Klick im Video.
     */
    public static pickColorFromVideo(
        video: HTMLVideoElement | null,
        input: HTMLInputElement,
        onColorSelected: (hex: string, x: number, y: number) => void,
        onLog: (msg: string) => void
    ): void {
        if (!video || !video.videoWidth || !video.videoHeight) {
            onLog('Bitte zuerst Video laden.');
            return;
        }
        video.pause();

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.style.cssText = 'max-width:90vw;max-height:80vh;cursor:crosshair;';
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:20000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;';

        const info = document.createElement('div');
        info.textContent = 'Klicke auf die Hintergrundfarbe im Video';
        info.style.cssText = 'color:#fff;font-size:14px;';

        const close = document.createElement('button');
        close.textContent = 'Schließen';
        close.style.cssText = VideoToSpriteSheetUI.getBtnStyles();
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
            input.value = hex;
            onColorSelected(hex, x, y);
            overlay.remove();
        };
    }

    /**
     * Overlay zum manuellen Festlegen eines Zuschnitt-Rahmens direkt am Video.
     */
    public static openManualCropOverlay(
        video: HTMLVideoElement | null,
        videoWidth: number,
        videoHeight: number,
        settings: ToolSettings,
        onApplied: () => void,
        onLog: (msg: string) => void
    ): void {
        if (!video || !videoWidth || !videoHeight) {
            onLog('Bitte zuerst ein Video laden.');
            window.alert('Bitte zuerst ein Video laden, bevor ein manueller Rahmen festgelegt werden kann.');
            return;
        }

        const imgW = videoWidth;
        const imgH = videoHeight;

        const originalParent = video.parentElement;
        const originalNextSibling = video.nextSibling;
        const originalStyleCssText = video.style.cssText;

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:20000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;';

        const info = document.createElement('div');
        info.textContent = 'Zur passenden Stelle spulen, dann "Rahmen zeichnen" aktivieren und Rahmen aufziehen.';
        info.style.cssText = 'color:#fff;font-size:14px;text-align:center;max-width:80vw;';

        const videoWrap = document.createElement('div');
        videoWrap.style.cssText = 'position:relative;display:inline-block;';

        video.style.cssText = 'max-width:90vw;max-height:70vh;background:#000;border-radius:4px;display:block;';
        videoWrap.appendChild(video);

        const drawLayer = document.createElement('div');
        drawLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
        videoWrap.appendChild(drawLayer);

        const selectionBox = document.createElement('div');
        selectionBox.style.cssText = 'position:absolute;border:2px dashed #4da6ff;background:rgba(77,166,255,0.15);display:none;pointer-events:none;';
        videoWrap.appendChild(selectionBox);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;';

        const drawToggleBtn = document.createElement('button');
        drawToggleBtn.textContent = 'Rahmen zeichnen';
        drawToggleBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();

        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Übernehmen';
        applyBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles(true);
        applyBtn.disabled = true;

        const discardBtn = document.createElement('button');
        discardBtn.textContent = 'Verwerfen';
        discardBtn.style.cssText = VideoToSpriteSheetUI.getBtnStyles();

        btnRow.appendChild(drawToggleBtn);
        btnRow.appendChild(applyBtn);
        btnRow.appendChild(discardBtn);

        overlay.appendChild(info);
        overlay.appendChild(videoWrap);
        overlay.appendChild(btnRow);
        document.body.appendChild(overlay);

        let drawMode = false;
        let dragging = false;
        let startX = 0, startY = 0;
        let rect: CropRect | null = null;

        const toImageCoords = (e: MouseEvent): { x: number; y: number } => {
            const r = video.getBoundingClientRect();
            const scaleX = imgW / r.width;
            const scaleY = imgH / r.height;
            const x = Math.max(0, Math.min(imgW, Math.round((e.clientX - r.left) * scaleX)));
            const y = Math.max(0, Math.min(imgH, Math.round((e.clientY - r.top) * scaleY)));
            return { x, y };
        };

        const updateSelectionBox = () => {
            if (!rect || rect.w < 1 || rect.h < 1) {
                selectionBox.style.display = 'none';
                applyBtn.disabled = true;
                return;
            }
            const r = video.getBoundingClientRect();
            const scaleX = r.width / imgW;
            const scaleY = r.height / imgH;
            selectionBox.style.display = 'block';
            selectionBox.style.left = `${rect.x * scaleX}px`;
            selectionBox.style.top = `${rect.y * scaleY}px`;
            selectionBox.style.width = `${rect.w * scaleX}px`;
            selectionBox.style.height = `${rect.h * scaleY}px`;
            applyBtn.disabled = false;
        };

        const setDrawMode = (active: boolean) => {
            drawMode = active;
            drawLayer.style.pointerEvents = active ? 'auto' : 'none';
            drawLayer.style.cursor = active ? 'crosshair' : 'default';
            drawToggleBtn.textContent = active ? 'Video steuern' : 'Rahmen zeichnen';
            if (active) video.pause();
            info.textContent = active
                ? 'Rahmen bei gedrückter Maustaste aufziehen.'
                : 'Zur passenden Stelle spulen, dann "Rahmen zeichnen" aktivieren und Rahmen aufziehen.';
        };
        drawToggleBtn.onclick = () => setDrawMode(!drawMode);

        const onMouseMove = (e: MouseEvent) => {
            if (!dragging) return;
            const p = toImageCoords(e);
            const x = Math.min(startX, p.x);
            const y = Math.min(startY, p.y);
            rect = { x, y, w: Math.abs(p.x - startX), h: Math.abs(p.y - startY) };
            updateSelectionBox();
        };
        const onMouseUp = () => { dragging = false; };

        drawLayer.onmousedown = (e) => {
            if (!drawMode) return;
            dragging = true;
            const p = toImageCoords(e);
            startX = p.x;
            startY = p.y;
            rect = { x: startX, y: startY, w: 0, h: 0 };
            updateSelectionBox();
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        const restoreVideo = () => {
            video.style.cssText = originalStyleCssText;
            if (originalParent) {
                originalParent.insertBefore(video, originalNextSibling);
            }
        };

        const closeOverlay = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            restoreVideo();
            overlay.remove();
        };
        discardBtn.onclick = closeOverlay;

        applyBtn.onclick = () => {
            if (!rect || rect.w < 1 || rect.h < 1) return;
            settings.manualCropRect = { ...rect };
            closeOverlay();
            onApplied();
        };
    }
}
