/**
 * ImageListEditorDialog - Modaler Dialog zur Konfiguration von TImageList-Komponenten.
 * 
 * Layout (nach Mockup):
 * ┌────────────────────────────────────────────────────────┐
 * │ 🎞️ ImageList Editor - {Name}                      ✕  │
 * ├──────────────────────────┬─────────────────────────────┤
 * │ Quellbild (Sprite Sheet) │ Raster-Konfiguration        │
 * │                          │  Spalten(H): [4]  Zeilen: [3]│
 * │  [Sprite-Sheet mit       │  Einzelbilder: 12           │
 * │   Raster-Overlay und     │  Aktuelles Bild: [◀ 5 ▶]   │
 * │   Frame-Selektion]       │                             │
 * │                          │ Vorschau Einzelbild          │
 * │  640×480 | Frame 160×160 │  ┌─────────────┐           │
 * │                          │  │  (Frame #5)  │           │
 * │                          │  └─────────────┘           │
 * │                          │  Bild #5 von 12             │
 * ├──────────────────────────┴─────────────────────────────┤
 * │                        [Abbrechen]  [Übernehmen]       │
 * └────────────────────────────────────────────────────────┘
 * 
 * @since v3.30.0
 */
import { Logger } from '../../utils/Logger';

const logger = Logger.get('ImageListEditorDialog');

export interface ImageListEditorData {
    src: string;
    imageCountHorizontal: number;
    imageCountVertical: number;
    currentImageNumber: number;
}

export interface ImageListEditorResult {
    imageCountHorizontal: number;
    imageCountVertical: number;
    currentImageNumber: number;
    src: string;
}

export class ImageListEditorDialog {

    /**
     * Öffnet den ImageList-Editor-Dialog.
     * @returns Das Ergebnis oder null bei Abbruch.
     */
    public static async show(data: ImageListEditorData, componentName: string): Promise<ImageListEditorResult | null> {
        return new Promise((resolve) => {
            const dialog = new ImageListEditorDialog(data, componentName, resolve);
            dialog.open();
        });
    }

    // ── State ──────────────────────────────────────
    private overlay!: HTMLDivElement;
    private dialogEl!: HTMLDivElement;
    private sheetPreviewCanvas!: HTMLCanvasElement;
    private framePreviewCanvas!: HTMLCanvasElement;
    private sheetImage: HTMLImageElement | null = null;
    private imageLoaded: boolean = false;

    // Editierbare Kopie der Daten
    private hCount: number;
    private vCount: number;
    private currentFrame: number;
    private currentSrc: string;

    // DOM-Referenzen für schnelles Update
    private hInput!: HTMLInputElement;
    private vInput!: HTMLInputElement;
    private frameInput!: HTMLInputElement;
    private totalLabel!: HTMLSpanElement;
    private frameSizeLabel!: HTMLDivElement;
    private frameNumberLabel!: HTMLDivElement;

    private constructor(
        data: ImageListEditorData,
        private componentName: string,
        private resolve: (value: ImageListEditorResult | null) => void
    ) {
        this.hCount = data.imageCountHorizontal || 1;
        this.vCount = data.imageCountVertical || 1;
        this.currentFrame = data.currentImageNumber || 0;
        this.currentSrc = data.src || '';
    }

    // ═══════════════════════════════════════════════
    // DIALOG LIFECYCLE
    // ═══════════════════════════════════════════════

    private open(): void {
        // ── Overlay ──
        this.overlay = document.createElement('div');
        Object.assign(this.overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: '90000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
        });
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.close(null); };

        // ── Dialog Container ──
        this.dialogEl = document.createElement('div');
        Object.assign(this.dialogEl.style, {
            backgroundColor: '#1e1e2e', borderRadius: '12px', padding: '0',
            width: '820px', maxWidth: '92vw', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid #333',
            overflow: 'hidden',
        });

        this.dialogEl.appendChild(this.buildHeader());
        this.dialogEl.appendChild(this.buildBody());
        this.dialogEl.appendChild(this.buildFooter());

        this.overlay.appendChild(this.dialogEl);
        document.body.appendChild(this.overlay);

        // Keyboard
        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { this.close(null); document.removeEventListener('keydown', keyHandler); }
        };
        document.addEventListener('keydown', keyHandler);

        // Bild laden
        this.loadImage();
    }

    private close(result: ImageListEditorResult | null): void {
        if (this.overlay.parentElement) {
            this.overlay.parentElement.removeChild(this.overlay);
        }
        this.resolve(result);
    }

    // ═══════════════════════════════════════════════
    // HEADER
    // ═══════════════════════════════════════════════

    private buildHeader(): HTMLElement {
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', backgroundColor: '#2a2a3e', borderBottom: '1px solid #333',
        });

        const title = document.createElement('span');
        title.textContent = `🎞️ ImageList Editor — ${this.componentName}`;
        Object.assign(title.style, { color: '#fff', fontSize: '16px', fontWeight: 'bold' });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            background: 'none', border: 'none', color: '#888', fontSize: '20px',
            cursor: 'pointer', padding: '4px 8px', borderRadius: '4px',
        });
        closeBtn.onmouseover = () => closeBtn.style.color = '#fff';
        closeBtn.onmouseout = () => closeBtn.style.color = '#888';
        closeBtn.onclick = () => this.close(null);

        header.appendChild(title);
        header.appendChild(closeBtn);
        return header;
    }

    // ═══════════════════════════════════════════════
    // BODY (Linkes + Rechtes Panel)
    // ═══════════════════════════════════════════════

    private buildBody(): HTMLElement {
        const body = document.createElement('div');
        Object.assign(body.style, {
            display: 'flex', flex: '1', overflow: 'hidden', minHeight: '400px',
        });

        body.appendChild(this.buildLeftPanel());
        body.appendChild(this.buildRightPanel());

        return body;
    }

    // ── Linkes Panel: Sprite-Sheet Vorschau ──
    private buildLeftPanel(): HTMLElement {
        const panel = document.createElement('div');
        Object.assign(panel.style, {
            flex: '3', display: 'flex', flexDirection: 'column',
            padding: '16px', borderRight: '1px solid #333', overflow: 'auto',
        });

        // Label
        const label = document.createElement('div');
        label.textContent = 'Quellbild (Sprite Sheet)';
        Object.assign(label.style, {
            color: '#89b4fa', fontSize: '12px', fontWeight: '700',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px',
        });
        panel.appendChild(label);

        // Bild-Auswahl-Zeile
        const srcRow = document.createElement('div');
        Object.assign(srcRow.style, {
            display: 'flex', gap: '6px', marginBottom: '10px', alignItems: 'center',
        });
        const srcInput = document.createElement('input');
        srcInput.type = 'text';
        srcInput.value = this.currentSrc;
        srcInput.placeholder = 'Bildpfad oder Data-URL...';
        Object.assign(srcInput.style, {
            flex: '1', padding: '6px 8px', backgroundColor: '#2a2a3e', color: '#ccc',
            border: '1px solid #444', borderRadius: '4px', fontSize: '12px',
        });
        srcInput.onchange = () => {
            this.currentSrc = srcInput.value;
            this.loadImage();
        };

        const browseBtn = document.createElement('button');
        browseBtn.textContent = '🖼️';
        browseBtn.title = 'Bild auswählen';
        Object.assign(browseBtn.style, {
            padding: '6px 10px', backgroundColor: '#2a2a3e', color: '#fff',
            border: '1px solid #555', borderRadius: '4px', cursor: 'pointer',
            fontSize: '14px', flexShrink: '0', transition: 'all 0.15s',
        });
        browseBtn.onmouseenter = () => { browseBtn.style.borderColor = '#89b4fa'; };
        browseBtn.onmouseleave = () => { browseBtn.style.borderColor = '#555'; };
        browseBtn.onclick = async () => {
            try {
                const { MediaPickerDialog } = await import('./MediaPickerDialog');
                const result = await MediaPickerDialog.show({ mode: 'image', currentValue: this.currentSrc });
                if (result) {
                    this.currentSrc = result;
                    srcInput.value = result;
                    this.loadImage();
                }
            } catch (e) {
                logger.warn('MediaPickerDialog nicht verfügbar:', e);
            }
        };
        srcRow.appendChild(srcInput);
        srcRow.appendChild(browseBtn);
        panel.appendChild(srcRow);

        // Canvas für Sprite-Sheet + Raster-Overlay
        this.sheetPreviewCanvas = document.createElement('canvas');
        Object.assign(this.sheetPreviewCanvas.style, {
            width: '100%', maxHeight: '320px', objectFit: 'contain',
            backgroundColor: '#12121e', borderRadius: '6px',
            border: '1px solid #333', cursor: 'pointer',
        });
        this.sheetPreviewCanvas.onclick = (e) => this.handleSheetClick(e);
        panel.appendChild(this.sheetPreviewCanvas);

        // Info-Zeile unter dem Canvas
        this.frameSizeLabel = document.createElement('div');
        this.frameSizeLabel.textContent = 'Kein Bild geladen';
        Object.assign(this.frameSizeLabel.style, {
            color: '#666', fontSize: '11px', marginTop: '8px', textAlign: 'center',
        });
        panel.appendChild(this.frameSizeLabel);

        return panel;
    }

    // ── Rechtes Panel: Konfiguration + Vorschau ──
    private buildRightPanel(): HTMLElement {
        const panel = document.createElement('div');
        Object.assign(panel.style, {
            flex: '2', display: 'flex', flexDirection: 'column',
            padding: '16px', gap: '16px', overflow: 'auto',
        });

        panel.appendChild(this.buildGridConfig());
        panel.appendChild(this.buildFramePreview());

        return panel;
    }

    // ── Raster-Konfiguration ──
    private buildGridConfig(): HTMLElement {
        const section = this.createSection('Raster-Konfiguration');

        // H / V Inputs (nebeneinander)
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', gap: '10px', marginBottom: '8px' });

        // Spalten (H)
        const hGroup = this.createInputGroup('Spalten (H)');
        this.hInput = this.createNumberInput(this.hCount, 1, 100);
        this.hInput.onchange = () => { this.hCount = Math.max(1, parseInt(this.hInput.value) || 1); this.updateAll(); };
        hGroup.appendChild(this.hInput);
        row.appendChild(hGroup);

        // Zeilen (V)
        const vGroup = this.createInputGroup('Zeilen (V)');
        this.vInput = this.createNumberInput(this.vCount, 1, 100);
        this.vInput.onchange = () => { this.vCount = Math.max(1, parseInt(this.vInput.value) || 1); this.updateAll(); };
        vGroup.appendChild(this.vInput);
        row.appendChild(vGroup);

        section.appendChild(row);

        // Gesamtanzahl (read-only)
        const totalRow = document.createElement('div');
        Object.assign(totalRow.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 10px', backgroundColor: '#252535', borderRadius: '4px',
            marginBottom: '10px',
        });
        const totalLabel = document.createElement('span');
        totalLabel.textContent = 'Einzelbilder gesamt:';
        Object.assign(totalLabel.style, { color: '#999', fontSize: '12px' });
        this.totalLabel = document.createElement('span');
        this.totalLabel.textContent = String(this.hCount * this.vCount);
        Object.assign(this.totalLabel.style, { color: '#89b4fa', fontSize: '14px', fontWeight: 'bold' });
        totalRow.appendChild(totalLabel);
        totalRow.appendChild(this.totalLabel);
        section.appendChild(totalRow);

        // Aktuelles Bild: ◀ [Input] ▶
        const frameRow = document.createElement('div');
        Object.assign(frameRow.style, {
            display: 'flex', alignItems: 'center', gap: '6px',
        });
        const frameLabel = document.createElement('span');
        frameLabel.textContent = 'Aktuelles Bild:';
        Object.assign(frameLabel.style, { color: '#ccc', fontSize: '12px', flexShrink: '0' });

        const prevBtn = this.createNavButton('◀', () => {
            if (this.currentFrame > 0) { this.currentFrame--; this.updateAll(); }
        });
        this.frameInput = this.createNumberInput(this.currentFrame, 0, this.hCount * this.vCount - 1);
        this.frameInput.style.width = '60px';
        this.frameInput.style.textAlign = 'center';
        this.frameInput.onchange = () => {
            const max = this.hCount * this.vCount - 1;
            this.currentFrame = Math.max(0, Math.min(max, parseInt(this.frameInput.value) || 0));
            this.updateAll();
        };
        const nextBtn = this.createNavButton('▶', () => {
            const max = this.hCount * this.vCount - 1;
            if (this.currentFrame < max) { this.currentFrame++; this.updateAll(); }
        });

        frameRow.appendChild(frameLabel);
        frameRow.appendChild(prevBtn);
        frameRow.appendChild(this.frameInput);
        frameRow.appendChild(nextBtn);
        section.appendChild(frameRow);

        return section;
    }

    // ── Vorschau Einzelbild ──
    private buildFramePreview(): HTMLElement {
        const section = this.createSection('Vorschau Einzelbild');

        // Canvas für Frame-Vorschau (Schachbrett-Hintergrund)
        this.framePreviewCanvas = document.createElement('canvas');
        this.framePreviewCanvas.width = 200;
        this.framePreviewCanvas.height = 200;
        Object.assign(this.framePreviewCanvas.style, {
            width: '100%', maxWidth: '200px', aspectRatio: '1',
            borderRadius: '6px', border: '1px solid #333',
            margin: '0 auto', display: 'block',
        });
        section.appendChild(this.framePreviewCanvas);

        // Label
        this.frameNumberLabel = document.createElement('div');
        this.frameNumberLabel.textContent = `Bild #${this.currentFrame} von ${this.hCount * this.vCount}`;
        Object.assign(this.frameNumberLabel.style, {
            color: '#999', fontSize: '12px', textAlign: 'center', marginTop: '8px',
        });
        section.appendChild(this.frameNumberLabel);

        return section;
    }

    // ═══════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════

    private buildFooter(): HTMLElement {
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
            padding: '12px 20px', backgroundColor: '#2a2a3e', borderTop: '1px solid #333',
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Abbrechen';
        Object.assign(cancelBtn.style, {
            padding: '8px 20px', backgroundColor: '#444', color: '#ccc',
            border: '1px solid #555', borderRadius: '6px', cursor: 'pointer',
            fontSize: '13px', transition: 'all 0.15s',
        });
        cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#555';
        cancelBtn.onmouseout = () => cancelBtn.style.backgroundColor = '#444';
        cancelBtn.onclick = () => this.close(null);

        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Übernehmen';
        Object.assign(applyBtn.style, {
            padding: '8px 20px', backgroundColor: '#1e3a5f', color: '#89b4fa',
            border: '1px solid #2a5a8f', borderRadius: '6px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold', transition: 'all 0.15s',
        });
        applyBtn.onmouseover = () => applyBtn.style.backgroundColor = '#2a5a8f';
        applyBtn.onmouseout = () => applyBtn.style.backgroundColor = '#1e3a5f';
        applyBtn.onclick = () => {
            this.close({
                imageCountHorizontal: this.hCount,
                imageCountVertical: this.vCount,
                currentImageNumber: this.currentFrame,
                src: this.currentSrc,
            });
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(applyBtn);
        return footer;
    }

    // ═══════════════════════════════════════════════
    // BILD-LADEN & RENDERING
    // ═══════════════════════════════════════════════

    private loadImage(): void {
        if (!this.currentSrc) {
            this.imageLoaded = false;
            this.sheetImage = null;
            this.renderSheetPreview();
            this.renderFramePreview();
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.sheetImage = img;
            this.imageLoaded = true;
            logger.info(`Bild geladen: ${img.naturalWidth}×${img.naturalHeight}`);
            this.updateAll();
        };
        img.onerror = () => {
            logger.warn('Bild konnte nicht geladen werden:', this.currentSrc);
            this.imageLoaded = false;
            this.sheetImage = null;
            this.frameSizeLabel.textContent = '⚠️ Bild konnte nicht geladen werden';
            this.frameSizeLabel.style.color = '#f38ba8';
        };

        // URL normalisieren
        let src = this.currentSrc;
        if (!src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) {
            src = `./images/${src}`;
        }
        if (src.startsWith('/images/')) src = '.' + src;
        img.src = src;
    }

    private updateAll(): void {
        // Clamp currentFrame
        const max = Math.max(1, this.hCount * this.vCount) - 1;
        if (this.currentFrame > max) this.currentFrame = max;
        if (this.currentFrame < 0) this.currentFrame = 0;

        // Update Inputs
        this.hInput.value = String(this.hCount);
        this.vInput.value = String(this.vCount);
        this.frameInput.value = String(this.currentFrame);
        this.frameInput.max = String(max);
        this.totalLabel.textContent = String(this.hCount * this.vCount);
        this.frameNumberLabel.textContent = `Bild #${this.currentFrame} von ${this.hCount * this.vCount}`;

        // Update Info-Label
        if (this.sheetImage && this.imageLoaded) {
            const fw = Math.floor(this.sheetImage.naturalWidth / this.hCount);
            const fh = Math.floor(this.sheetImage.naturalHeight / this.vCount);
            this.frameSizeLabel.textContent = `Bildgröße: ${this.sheetImage.naturalWidth}×${this.sheetImage.naturalHeight}  |  Einzelbild: ${fw}×${fh}`;
            this.frameSizeLabel.style.color = '#a6e3a1';
        }

        this.renderSheetPreview();
        this.renderFramePreview();
    }

    // ── Sprite-Sheet Vorschau mit Raster-Overlay ──
    private renderSheetPreview(): void {
        const canvas = this.sheetPreviewCanvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (!this.sheetImage || !this.imageLoaded) {
            canvas.width = 400;
            canvas.height = 200;
            ctx.fillStyle = '#12121e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#555';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Kein Bild geladen — bitte Quellbild auswählen', canvas.width / 2, canvas.height / 2);
            return;
        }

        const img = this.sheetImage;
        const maxW = 480;
        const maxH = 320;
        const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
        const drawW = Math.floor(img.naturalWidth * scale);
        const drawH = Math.floor(img.naturalHeight * scale);

        canvas.width = drawW;
        canvas.height = drawH;

        // Schachbrett-Hintergrund (für Transparenz)
        this.drawCheckerboard(ctx, drawW, drawH);

        // Bild zeichnen
        ctx.drawImage(img, 0, 0, drawW, drawH);

        // Raster-Overlay
        const cellW = drawW / this.hCount;
        const cellH = drawH / this.vCount;

        ctx.strokeStyle = 'rgba(137, 180, 250, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        // Vertikale Linien
        for (let i = 1; i < this.hCount; i++) {
            const x = Math.floor(i * cellW) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, drawH);
            ctx.stroke();
        }

        // Horizontale Linien
        for (let i = 1; i < this.vCount; i++) {
            const y = Math.floor(i * cellH) + 0.5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(drawW, y);
            ctx.stroke();
        }

        ctx.setLineDash([]);

        // Aktiver Frame hervorheben
        const col = this.currentFrame % this.hCount;
        const row = Math.floor(this.currentFrame / this.hCount);
        const fx = col * cellW;
        const fy = row * cellH;

        ctx.strokeStyle = '#89b4fa';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(fx + 1, fy + 1, cellW - 2, cellH - 2);

        // Frame-Nummer im aktiven Frame
        ctx.fillStyle = 'rgba(30, 30, 46, 0.75)';
        const badgeW = 28;
        const badgeH = 18;
        ctx.fillRect(fx + 3, fy + 3, badgeW, badgeH);
        ctx.fillStyle = '#89b4fa';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`#${this.currentFrame}`, fx + 3 + badgeW / 2, fy + 3 + badgeH / 2);
    }

    // ── Einzelbild-Vorschau ──
    private renderFramePreview(): void {
        const canvas = this.framePreviewCanvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const size = 200;
        canvas.width = size;
        canvas.height = size;

        // Schachbrett-Hintergrund
        this.drawCheckerboard(ctx, size, size);

        if (!this.sheetImage || !this.imageLoaded) {
            ctx.fillStyle = '#555';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('—', size / 2, size / 2);
            return;
        }

        const img = this.sheetImage;
        const srcW = img.naturalWidth / this.hCount;
        const srcH = img.naturalHeight / this.vCount;
        const col = this.currentFrame % this.hCount;
        const row = Math.floor(this.currentFrame / this.hCount);
        const srcX = col * srcW;
        const srcY = row * srcH;

        // Frame skaliert in den Vorschau-Canvas zeichnen (zentriert)
        const fitScale = Math.min(size / srcW, size / srcH, 1);
        const drawW = srcW * fitScale;
        const drawH = srcH * fitScale;
        const offsetX = (size - drawW) / 2;
        const offsetY = (size - drawH) / 2;

        ctx.drawImage(img, srcX, srcY, srcW, srcH, offsetX, offsetY, drawW, drawH);
    }

    // ── Klick auf Sprite-Sheet → Frame selektieren ──
    private handleSheetClick(e: MouseEvent): void {
        if (!this.sheetImage || !this.imageLoaded) return;

        const rect = this.sheetPreviewCanvas.getBoundingClientRect();
        const scaleX = this.sheetPreviewCanvas.width / rect.width;
        const scaleY = this.sheetPreviewCanvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        const cellW = this.sheetPreviewCanvas.width / this.hCount;
        const cellH = this.sheetPreviewCanvas.height / this.vCount;

        const col = Math.floor(clickX / cellW);
        const row = Math.floor(clickY / cellH);
        const frameIndex = row * this.hCount + col;

        const max = this.hCount * this.vCount - 1;
        if (frameIndex >= 0 && frameIndex <= max) {
            this.currentFrame = frameIndex;
            this.updateAll();
        }
    }

    // ═══════════════════════════════════════════════
    // HELPER
    // ═══════════════════════════════════════════════

    private drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        const tileSize = 10;
        for (let y = 0; y < h; y += tileSize) {
            for (let x = 0; x < w; x += tileSize) {
                const isLight = ((x / tileSize) + (y / tileSize)) % 2 === 0;
                ctx.fillStyle = isLight ? '#2a2a3e' : '#1e1e2e';
                ctx.fillRect(x, y, tileSize, tileSize);
            }
        }
    }

    private createSection(title: string): HTMLElement {
        const section = document.createElement('div');
        const header = document.createElement('div');
        header.textContent = title;
        Object.assign(header.style, {
            color: '#89b4fa', fontSize: '12px', fontWeight: '700',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            marginBottom: '10px', paddingBottom: '6px',
            borderBottom: '1px solid rgba(137, 180, 250, 0.2)',
        });
        section.appendChild(header);
        return section;
    }

    private createInputGroup(label: string): HTMLElement {
        const group = document.createElement('div');
        Object.assign(group.style, { flex: '1', display: 'flex', flexDirection: 'column', gap: '4px' });
        const lbl = document.createElement('label');
        lbl.textContent = label;
        Object.assign(lbl.style, { color: '#999', fontSize: '11px' });
        group.appendChild(lbl);
        return group;
    }

    private createNumberInput(value: number, min: number, max: number): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = String(value);
        input.min = String(min);
        input.max = String(max);
        Object.assign(input.style, {
            padding: '6px 8px', backgroundColor: '#2a2a3e', color: '#fff',
            border: '1px solid #444', borderRadius: '4px', fontSize: '13px',
            width: '100%', boxSizing: 'border-box',
        });
        return input;
    }

    private createNavButton(text: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            width: '32px', height: '32px', backgroundColor: '#2a2a3e', color: '#89b4fa',
            border: '1px solid #444', borderRadius: '4px', cursor: 'pointer',
            fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: '0', transition: 'all 0.15s',
        });
        btn.onmouseover = () => { btn.style.backgroundColor = '#3a3a5e'; btn.style.borderColor = '#89b4fa'; };
        btn.onmouseout = () => { btn.style.backgroundColor = '#2a2a3e'; btn.style.borderColor = '#444'; };
        btn.onclick = onClick;
        return btn;
    }
}
