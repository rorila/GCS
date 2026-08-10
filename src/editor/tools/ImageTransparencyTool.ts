/**
 * ImageTransparencyTool
 *
 * Macht den Hintergrund eines einzelnen Bilds transparent.
 * Verwendet denselben YCbCr-Chroma-Key wie das VideoToSpriteSheetTool.
 *
 * Features:
 * - Bild laden (Datei-Input)
 * - Hintergrundfarbe per Farbwähler oder Pipette auswählen
 * - Toleranz-Einstellung
 * - Live-Vorschau (Original vs. verarbeitet) mit Schachbrett-Hintergrund
 * - Download als PNG
 * - Optionaler Upload ins game-server/public/images
 */

import { removeBackgroundFromImageData } from './ImageUtils';
import { PromptDialog } from '../ui/PromptDialog';

interface ImageTransparencySettings {
    backgroundColors: string[];
    tolerance: number;
}

export interface ImageTransparencyResult {
    fileName: string;
    url: string;
    imageBase64: string;
}

export class ImageTransparencyTool {
    private parent: HTMLElement;
    private uploadUrl: string;
    private container: HTMLElement;
    private settings: ImageTransparencySettings = {
        backgroundColors: ['#00FF00'],
        tolerance: 30
    };

    private originalCanvas: HTMLCanvasElement | null = null;
    private previewCanvas: HTMLCanvasElement | null = null;
    private colorListEl: HTMLElement | null = null;
    private toleranceInput: HTMLInputElement | null = null;
    private logEl: HTMLElement | null = null;
    private fileName: string = 'transparent';
    private pasteHandler: ((e: ClipboardEvent) => void) | null = null;

    public onExport: ((result: ImageTransparencyResult) => void) | null = null;
    public onError: ((msg: string) => void) | null = null;

    constructor(parent: HTMLElement, uploadUrl = 'http://localhost:8080/api/upload/spritesheet') {
        this.parent = parent;
        this.uploadUrl = uploadUrl;
        this.container = document.createElement('div');
    }

    public open(): void {
        this.render();
        this.parent.appendChild(this.container);
        this.attachPasteListener();
    }

    public close(): void {
        this.detachPasteListener();
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }

    private attachPasteListener(): void {
        if (this.pasteHandler) return;
        this.pasteHandler = (e) => this.handlePaste(e);
        document.addEventListener('paste', this.pasteHandler);
    }

    private detachPasteListener(): void {
        if (this.pasteHandler) {
            document.removeEventListener('paste', this.pasteHandler);
            this.pasteHandler = null;
        }
    }

    private handlePaste(e: ClipboardEvent): void {
        if (!this.container.parentNode) return;

        const data = e.clipboardData;
        if (!data) return;

        // 1. Dateien bevorzugen (Bilder)
        for (const file of data.files) {
            if (file.type.startsWith('image/')) {
                e.preventDefault();
                this.loadImageFromFile(file);
                return;
            }
        }

        // 2. Fallback: items durchsuchen
        const items = data.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) this.loadImageFromFile(file);
                return;
            }
        }
    }

    private log(msg: string): void {
        if (this.logEl) this.logEl.textContent = msg;
    }

    private render(): void {
        this.container.className = 'gcs-it-overlay';
        this.container.style.cssText = this.getOverlayStyles();

        const dialog = document.createElement('div');
        dialog.style.cssText = this.getDialogStyles();

        const title = document.createElement('h2');
        title.textContent = 'Bild-Hintergrund entfernen';
        title.style.cssText = 'margin:0 0 12px 0;font-size:18px;color:#e0d4f5;';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'position:absolute;top:8px;right:8px;background:transparent;border:none;color:#e0d4f5;font-size:22px;cursor:pointer;';
        closeBtn.onclick = () => this.close();

        const fileRow = this.renderFileRow();
        const controls = this.renderControls();
        const previewRow = this.renderPreviewRow();
        const actions = this.renderActions();

        this.logEl = document.createElement('div');
        this.logEl.style.cssText = 'font-size:12px;color:#aaa;min-height:18px;';

        dialog.appendChild(closeBtn);
        dialog.appendChild(title);
        dialog.appendChild(fileRow);
        dialog.appendChild(controls);
        dialog.appendChild(previewRow);
        dialog.appendChild(actions);
        dialog.appendChild(this.logEl);

        this.container.appendChild(dialog);
    }

    private renderFileRow(): HTMLElement {
        const col = document.createElement('div');
        col.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:12px;';

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;align-items:center;';

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.cssText = 'color:#e0d4f5;';
        input.onchange = () => this.loadFile(input);

        row.appendChild(input);

        const hint = document.createElement('div');
        hint.textContent = 'Tipp: Bild auch per Strg+V aus der Zwischenablage einfügen.';
        hint.style.cssText = 'font-size:11px;color:#888;';

        col.appendChild(row);
        col.appendChild(hint);
        return col;
    }

    private renderControls(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = 'display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px;';

        const colorWrap = document.createElement('div');
        colorWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Hintergrundfarben:';
        colorLabel.style.cssText = 'color:#e0d4f5;font-size:12px;';

        this.colorListEl = document.createElement('div');
        this.colorListEl.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-height:28px;';
        this.renderColorList();

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;align-items:center;';

        const pickBtn = document.createElement('button');
        pickBtn.textContent = 'Aus Bild';
        pickBtn.style.cssText = this.getBtnStyles();
        pickBtn.onclick = () => this.pickColorFromImage();

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Alle löschen';
        clearBtn.style.cssText = this.getBtnStyles();
        clearBtn.onclick = () => this.clearColors();

        btnRow.appendChild(pickBtn);
        btnRow.appendChild(clearBtn);

        colorWrap.appendChild(colorLabel);
        colorWrap.appendChild(this.colorListEl);
        colorWrap.appendChild(btnRow);

        const tolWrap = document.createElement('div');
        tolWrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
        const tolLabel = document.createElement('label');
        tolLabel.textContent = 'Toleranz (0-100):';
        tolLabel.style.cssText = 'color:#e0d4f5;font-size:12px;';

        this.toleranceInput = document.createElement('input');
        this.toleranceInput.type = 'number';
        this.toleranceInput.min = '0';
        this.toleranceInput.max = '100';
        this.toleranceInput.value = String(this.settings.tolerance);
        this.toleranceInput.style.cssText = 'width:80px;padding:4px;background:#2a2a3e;color:#e0d4f5;border:1px solid #444;border-radius:4px;';
        this.toleranceInput.onchange = () => {
            const v = parseFloat(this.toleranceInput!.value);
            this.settings.tolerance = isNaN(v) ? this.settings.tolerance : v;
            this.updatePreview();
        };

        tolWrap.appendChild(tolLabel);
        tolWrap.appendChild(this.toleranceInput);

        section.appendChild(colorWrap);
        section.appendChild(tolWrap);
        return section;
    }

    private renderPreviewRow(): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:12px;justify-content:center;align-items:center;margin-bottom:12px;';

        this.originalCanvas = this.createPreviewCanvas();
        this.previewCanvas = this.createPreviewCanvas();

        const originalWrap = this.wrapCanvas(this.originalCanvas, 'Original');
        const previewWrap = this.wrapCanvas(this.previewCanvas, 'Ergebnis');

        row.appendChild(originalWrap);
        row.appendChild(previewWrap);
        return row;
    }

    private createPreviewCanvas(): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        canvas.style.maxWidth = '45%';
        canvas.style.maxHeight = '450px';
        canvas.style.width = 'auto';
        canvas.style.height = 'auto';
        canvas.style.borderRadius = '4px';
        canvas.style.cssText += this.getCheckerboardStyles();
        return canvas;
    }

    private wrapCanvas(canvas: HTMLCanvasElement, label: string): HTMLElement {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;';
        const lbl = document.createElement('div');
        lbl.textContent = label;
        lbl.style.cssText = 'color:#e0d4f5;font-size:12px;';
        wrap.appendChild(canvas);
        wrap.appendChild(lbl);
        return wrap;
    }

    private renderActions(): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;';

        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = '💾 Herunterladen';
        downloadBtn.style.cssText = this.getBtnStyles();
        downloadBtn.onclick = () => this.download();

        const uploadBtn = document.createElement('button');
        uploadBtn.textContent = '☁️ In Projekt speichern';
        uploadBtn.style.cssText = this.getBtnStyles(true);
        uploadBtn.onclick = () => this.uploadAndSave();

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Beenden';
        closeBtn.style.cssText = this.getBtnStyles();
        closeBtn.onclick = () => this.close();

        row.appendChild(downloadBtn);
        row.appendChild(uploadBtn);
        row.appendChild(closeBtn);
        return row;
    }

    private getOverlayStyles(): string {
        return 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;justify-content:center;align-items:center;';
    }

    private getDialogStyles(): string {
        return 'position:relative;background:#11111b;border:1px solid #444;border-radius:8px;padding:16px;width:90%;max-width:1100px;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;gap:12px;';
    }

    private getBtnStyles(primary = false): string {
        const base = 'padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;border:none;';
        return primary
            ? `${base}background:#4da6ff;color:#fff;`
            : `${base}background:#3a3a4f;color:#e0d4f5;`;
    }

    private getCheckerboardStyles(): string {
        return 'background-image:linear-gradient(45deg,#555 25%,transparent 25%),linear-gradient(-45deg,#555 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#555 75%),linear-gradient(-45deg,transparent 75%,#555 75%);background-size:12px 12px;background-position:0 0,0 6px,6px -6px,-6px 0;background-color:#888;';
    }

    private loadFile(input: HTMLInputElement): void {
        const file = input.files?.[0];
        if (file) this.loadImageFromFile(file);
    }

    private loadImageFromFile(file: File): void {
        this.fileName = file.name.replace(/\.[^/.]+$/, '');
        this.log('Bild wird geladen...');

        const img = new Image();
        img.onload = () => {
            this.drawImageToCanvas(img);
            this.updatePreview();
            this.log(`Bild geladen: ${img.width}x${img.height}px`);
        };
        img.onerror = () => this.log('Bild konnte nicht geladen werden.');
        img.src = URL.createObjectURL(file);
    }

    private drawImageToCanvas(img: HTMLImageElement): void {
        if (!this.originalCanvas || !this.previewCanvas) return;

        // Intern Originalgröße behalten, um Qualität zu wahren.
        // Anzeigeseitig skaliert CSS automatisch proportional (max-width/height).
        this.originalCanvas.width = img.width;
        this.originalCanvas.height = img.height;
        this.previewCanvas.width = img.width;
        this.previewCanvas.height = img.height;

        const ctx = this.originalCanvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
    }

    private updatePreview(): void {
        if (!this.originalCanvas || !this.previewCanvas) return;

        const ctx = this.originalCanvas.getContext('2d');
        const outCtx = this.previewCanvas.getContext('2d');
        if (!ctx || !outCtx) return;

        const imageData = ctx.getImageData(0, 0, this.originalCanvas.width, this.originalCanvas.height);
        const processed = removeBackgroundFromImageData(imageData, this.settings.backgroundColors, this.settings.tolerance);

        outCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        outCtx.putImageData(processed, 0, 0);

        this.log(`Vorschau aktualisiert. ${this.countTransparent(processed)}`);
    }

    private countTransparent(imageData: ImageData): string {
        let transparent = 0;
        for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] === 0) transparent++;
        }
        const total = imageData.data.length / 4;
        return `${((transparent / total) * 100).toFixed(1)}% transparent`;
    }

    private pickColorFromImage(): void {
        if (!this.originalCanvas) return;

        const canvas = this.originalCanvas;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;cursor:crosshair;display:flex;justify-content:center;align-items:center;';
        document.body.appendChild(overlay);

        const panel = document.createElement('div');
        panel.style.cssText = 'position:absolute;top:16px;left:50%;transform:translateX(-50%);background:#11111b;border:1px solid #444;border-radius:6px;padding:8px 12px;color:#e0d4f5;font-size:12px;display:flex;gap:10px;align-items:center;';
        panel.textContent = 'Klicke auf den Hintergrund, um Farben hinzuzufügen.';
        const doneBtn = document.createElement('button');
        doneBtn.textContent = 'Fertig';
        doneBtn.style.cssText = this.getBtnStyles(true);
        doneBtn.onclick = (ev) => {
            ev.stopPropagation();
            overlay.remove();
        };
        panel.appendChild(doneBtn);
        overlay.appendChild(panel);

        overlay.onclick = (e) => {
            if (e.target !== overlay) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.min(Math.floor((e.clientX - rect.left) * scaleX), canvas.width - 1);
            const y = Math.min(Math.floor((e.clientY - rect.top) * scaleY), canvas.height - 1);

            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');

            if (this.settings.backgroundColors.includes(hex)) {
                this.log(`Farbe ${hex} bereits in Liste.`);
                return;
            }

            this.settings.backgroundColors.push(hex);
            this.renderColorList();
            this.updatePreview();
            this.log(`Farbe hinzugefügt: ${hex} bei (${x},${y})`);
        };

        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', keyHandler);
            }
        };
        document.addEventListener('keydown', keyHandler);
    }

    private getResultBase64(): string {
        if (!this.previewCanvas) return '';
        return this.previewCanvas.toDataURL('image/png');
    }

    private download(): void {
        const dataUrl = this.getResultBase64();
        if (!dataUrl) {
            this.log('Kein Bild vorhanden.');
            return;
        }

        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${this.fileName}_transparent.png`;
        a.click();
    }

    private async uploadAndSave(): Promise<void> {
        const imageBase64 = this.getResultBase64();
        if (!imageBase64) {
            this.log('Kein Bild vorhanden.');
            return;
        }

        const defaultName = `${this.fileName}_transparent_${Date.now()}.png`;
        const inputName = await PromptDialog.show('Name für das Bild:', defaultName);
        if (!inputName || !inputName.trim()) {
            this.log('Speichern abgebrochen.');
            return;
        }

        const safeName = inputName.trim().replace(/\.png$/i, '') + '.png';
        const baseName = safeName.endsWith('.png') ? safeName : safeName + '.png';

        this.log('Lade transparentes Bild hoch...');
        try {
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

            const url = data.url || `/images/${data.fileName}`;
            if (this.onExport) {
                this.onExport({ fileName: data.fileName, url, imageBase64 });
            }
        } catch (e: any) {
            this.log(`Fehler: ${e.message}`);
            if (this.onError) this.onError(e.message);
        }
    }

    private renderColorList(): void {
        if (!this.colorListEl) return;
        this.colorListEl.innerHTML = '';

        if (this.settings.backgroundColors.length === 0) {
            const empty = document.createElement('span');
            empty.textContent = 'Keine Farbe ausgewählt';
            empty.style.cssText = 'color:#888;font-size:12px;';
            this.colorListEl.appendChild(empty);
            return;
        }

        this.settings.backgroundColors.forEach((color, index) => {
            const chip = document.createElement('div');
            chip.style.cssText = 'display:flex;align-items:center;gap:4px;background:#2a2a3e;border:1px solid #444;border-radius:4px;padding:2px 6px;';

            const swatch = document.createElement('div');
            swatch.style.cssText = `width:16px;height:16px;border-radius:3px;background:${color};border:1px solid #666;`;
            swatch.title = color;

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '×';
            removeBtn.title = 'Farbe entfernen';
            removeBtn.style.cssText = 'background:transparent;border:none;color:#e0d4f5;font-size:14px;cursor:pointer;padding:0 2px;line-height:1;';
            removeBtn.onclick = (ev) => {
                ev.stopPropagation();
                this.settings.backgroundColors.splice(index, 1);
                this.renderColorList();
                this.updatePreview();
            };

            chip.appendChild(swatch);
            chip.appendChild(removeBtn);
            this.colorListEl!.appendChild(chip);
        });
    }

    private clearColors(): void {
        this.settings.backgroundColors = [];
        this.renderColorList();
        this.updatePreview();
        this.log('Alle Hintergrundfarben gelöscht.');
    }
}
