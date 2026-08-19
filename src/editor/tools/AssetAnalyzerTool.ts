/**
 * AssetAnalyzerTool - Dialog im Werkzeuge-Menue, der alle Projektbilder auf
 * ein sinnvolles Verhaeltnis zwischen Quell-Auflösung und Anzeigegroesse prueft.
 *
 * Reine Diagnose: es werden keine Dateien und keine Projektdaten veraendert.
 */
import { Logger } from '../../utils/Logger';
import {
    AssetAnalyzer,
    AssetAnalysis,
    AssetRating,
    AssetReport,
    SCALE_TARGET_MAX,
    SCALE_TARGET_MIN
} from './AssetAnalyzer';
import { downscaleFrameAlphaWeighted } from './ImageUtils';

const logger = Logger.get('AssetAnalyzerTool');

export const ASSET_ANALYZER_TOOL_VERSION = '1.0.0';

const RATING_META: Record<AssetRating, { label: string; color: string; icon: string }> = {
    ok: { label: 'OK', color: '#7fd1a0', icon: '✅' },
    lowres: { label: 'Zu klein', color: '#4da6ff', icon: 'ℹ️' },
    oversized: { label: 'Zu gross', color: '#ff9f43', icon: '⚠️' },
    critical: { label: 'Deutlich zu gross', color: '#ff6b6b', icon: '⛔' },
    unused: { label: 'Ohne Verwender', color: '#a0a0a0', icon: '❔' },
    unknown: { label: 'Nicht ladbar', color: '#a0a0a0', icon: '❔' }
};

export class AssetAnalyzerTool {
    private parent: HTMLElement;
    private project: any;
    private container: HTMLElement;
    private contentEl: HTMLElement | null = null;
    private summaryEl: HTMLElement | null = null;
    private report: AssetReport | null = null;

    constructor(parent: HTMLElement, project: any) {
        this.parent = parent;
        this.project = project;
        this.container = document.createElement('div');
    }

    public open(): void {
        this.render();
        this.parent.appendChild(this.container);
        void this.runAnalysis();
    }

    public close(): void {
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }

    private render(): void {
        this.container.className = 'gcs-asset-analyzer-overlay';
        this.container.style.cssText =
            'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);' +
            'z-index:10000;display:flex;justify-content:center;align-items:center;';
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) this.close();
        });

        const dialog = document.createElement('div');
        dialog.style.cssText =
            'width:min(1100px,96vw);height:min(90vh,760px);background:#252536;border-radius:8px;' +
            'box-shadow:0 8px 32px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden;';

        const header = document.createElement('div');
        header.style.cssText =
            'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;' +
            'background:#1e1e2e;border-bottom:1px solid #333;';

        const title = document.createElement('h2');
        title.style.cssText = 'margin:0;font-size:16px;color:#e0e0e0;';
        title.innerHTML = `🔍 Bild-Analyse <span style="font-size:11px;color:#7fd1a0;font-weight:normal;">v${ASSET_ANALYZER_TOOL_VERSION}</span>`;

        const headerRight = document.createElement('div');
        headerRight.style.cssText = 'display:flex;align-items:center;gap:8px;';

        const reloadBtn = document.createElement('button');
        reloadBtn.textContent = '↻ Neu analysieren';
        reloadBtn.style.cssText = this.btnStyles();
        reloadBtn.onclick = () => void this.runAnalysis();

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background:transparent;border:none;color:#aaa;font-size:16px;cursor:pointer;';
        closeBtn.onclick = () => this.close();

        headerRight.appendChild(reloadBtn);
        headerRight.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(headerRight);

        this.summaryEl = document.createElement('div');
        this.summaryEl.style.cssText =
            'padding:10px 16px;background:#1e1e2e;border-bottom:1px solid #333;font-size:12px;color:#c0c0d0;';

        this.contentEl = document.createElement('div');
        this.contentEl.style.cssText = 'flex:1;overflow-y:auto;padding:16px;';

        dialog.appendChild(header);
        dialog.appendChild(this.summaryEl);
        dialog.appendChild(this.contentEl);
        this.container.appendChild(dialog);

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.close();
                window.removeEventListener('keydown', onKey);
            }
        };
        window.addEventListener('keydown', onKey);
    }

    private async runAnalysis(): Promise<void> {
        if (!this.contentEl || !this.summaryEl) return;
        this.summaryEl.textContent = 'Analysiere Bilder…';
        this.contentEl.innerHTML = '<div style="color:#888;font-size:12px;padding:20px;text-align:center;">Bilder werden geladen und gemessen…</div>';

        try {
            this.report = await AssetAnalyzer.analyze(this.project);
            this.renderSummary(this.report);
            this.renderTable(this.report);
        } catch (e) {
            logger.error('Analyse fehlgeschlagen:', e);
            this.summaryEl.textContent = 'Analyse fehlgeschlagen.';
            this.contentEl.innerHTML = `<div style="color:#ff6b6b;font-size:12px;padding:20px;">${String(e)}</div>`;
        }
    }

    private renderSummary(report: AssetReport): void {
        if (!this.summaryEl) return;

        const counts: Record<string, number> = {};
        for (const a of report.assets) counts[a.rating] = (counts[a.rating] || 0) + 1;

        const chips = (Object.keys(RATING_META) as AssetRating[])
            .filter(r => counts[r])
            .map(r => {
                const meta = RATING_META[r];
                return `<span style="color:${meta.color};margin-right:14px;">${meta.icon} ${meta.label}: <b>${counts[r]}</b></span>`;
            })
            .join('');

        const saving = report.totalSavingBytes > 0
            ? `<span style="color:#ff9f43;">Einsparpotenzial: <b>${AssetAnalyzer.formatBytes(report.totalSavingBytes)}</b></span>`
            : '<span style="color:#7fd1a0;">Kein Einsparpotenzial — alle Bilder passen.</span>';

        this.summaryEl.innerHTML =
            `<div style="margin-bottom:6px;">` +
            `<b>${report.assets.length}</b> Bilder · Speicher dekodiert: <b>${AssetAnalyzer.formatBytes(report.totalDecodedBytes)}</b> · ${saving}` +
            `</div><div>${chips}</div>` +
            `<div style="margin-top:6px;color:#888;">Zielbereich: Frame-Groesse zwischen ${SCALE_TARGET_MIN}x und ${SCALE_TARGET_MAX}x der Anzeigegroesse. Speicher = Breite × Höhe × 4 Byte (unabhängig von der Dateigröße).</div>`;
    }

    private renderTable(report: AssetReport): void {
        if (!this.contentEl) return;
        this.contentEl.innerHTML = '';

        if (report.assets.length === 0) {
            this.contentEl.innerHTML = '<div style="color:#888;font-size:12px;padding:20px;">Keine Bilder im Projekt gefunden.</div>';
            return;
        }

        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;color:#d0d0e0;';

        const headers = ['', 'Datei', 'Auflösung', 'Raster', 'Frame', 'Anzeige', 'Faktor', 'Speicher', 'Empfehlung', ''];
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        for (const h of headers) {
            const th = document.createElement('th');
            th.textContent = h;
            th.style.cssText =
                'text-align:left;padding:6px 8px;border-bottom:1px solid #444;color:#8a8aa0;' +
                'font-weight:600;position:sticky;top:0;background:#252536;';
            headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const asset of report.assets) {
            tbody.appendChild(this.buildRow(asset));
            const details = this.buildDetailsRow(asset);
            if (details) tbody.appendChild(details);
        }
        table.appendChild(tbody);
        this.contentEl.appendChild(table);

        if (report.unreferenced.length > 0) {
            this.contentEl.appendChild(this.buildUnreferencedSection(report.unreferenced));
        }
    }

    private buildRow(asset: AssetAnalysis): HTMLElement {
        const meta = RATING_META[asset.rating];
        const row = document.createElement('tr');
        row.style.cssText = 'border-bottom:1px solid #33334a;';

        const cell = (html: string, extra = ''): HTMLElement => {
            const td = document.createElement('td');
            td.style.cssText = `padding:6px 8px;vertical-align:top;${extra}`;
            td.innerHTML = html;
            return td;
        };

        const fileName = asset.rawUrl.split('/').pop() || asset.rawUrl;

        row.appendChild(cell(`<span title="${meta.label}">${meta.icon}</span>`, 'width:24px;'));
        row.appendChild(cell(
            `<div style="color:#e0e0f0;">${this.escape(decodeURIComponent(fileName))}</div>` +
            `<div style="color:#666;font-size:10px;">${this.escape(asset.rawUrl)}</div>`
        ));
        row.appendChild(cell(asset.loaded ? `${asset.width} × ${asset.height}` : `<span style="color:#888;">—</span>`));
        row.appendChild(cell(asset.frameCount > 1 ? `${asset.columns} × ${asset.rows}` : `<span style="color:#666;">—</span>`));
        row.appendChild(cell(asset.loaded ? `${Math.round(asset.frameWidth)} × ${Math.round(asset.frameHeight)}` : '—'));
        row.appendChild(cell(
            asset.maxDisplayWidthPx > 0
                ? `${Math.round(asset.maxDisplayWidthPx)} × ${Math.round(asset.maxDisplayHeightPx)}`
                : '<span style="color:#888;">—</span>'
        ));
        row.appendChild(cell(
            asset.scaleFactor > 0
                ? `<b style="color:${meta.color};">${asset.scaleFactor.toFixed(2)}×</b>`
                : '<span style="color:#888;">—</span>'
        ));
        row.appendChild(cell(AssetAnalyzer.formatBytes(asset.decodedBytes)));
        row.appendChild(cell(
            asset.savingBytes > 0
                ? `<div style="color:#ff9f43;">${asset.recommendedWidth} × ${asset.recommendedHeight}</div>` +
                  `<div style="color:#7fd1a0;font-size:10px;">−${AssetAnalyzer.formatBytes(asset.savingBytes)}</div>`
                : '<span style="color:#7fd1a0;">passt</span>'
        ));

        const actionTd = document.createElement('td');
        actionTd.style.cssText = 'padding:6px 8px;vertical-align:top;';
        if ((asset.rating === 'oversized' || asset.rating === 'critical') && asset.loaded) {
            const optBtn = document.createElement('button');
            optBtn.textContent = 'Optimieren';
            optBtn.style.cssText = this.btnStyles() + ' background:#ff9f43;color:#1a0f00;font-weight:600;';
            optBtn.onclick = () => void this.optimize(asset, optBtn);
            actionTd.appendChild(optBtn);
        }
        row.appendChild(actionTd);

        return row;
    }

    private buildDetailsRow(asset: AssetAnalysis): HTMLElement | null {
        const hasHints = asset.hints.length > 0;
        const hasConsumers = asset.consumers.length > 0;
        if (!hasHints && !hasConsumers) return null;

        const row = document.createElement('tr');
        row.style.cssText = 'border-bottom:1px solid #33334a;';
        const td = document.createElement('td');
        td.colSpan = 9;
        td.style.cssText = 'padding:0 8px 8px 32px;';

        let html = '';
        if (hasHints) {
            html += asset.hints
                .map(h => `<div style="color:#ff9f43;font-size:11px;">• ${this.escape(h)}</div>`)
                .join('');
        }
        if (hasConsumers) {
            const list = asset.consumers
                .map(c => {
                    const size = c.displayWidthPx > 0 ? `${Math.round(c.displayWidthPx)}×${Math.round(c.displayHeightPx)}px` : 'ohne Groesse';
                    const pool = c.instances > 1 ? ` ×${c.instances}` : '';
                    const shadow = c.shadowed ? ' <span style="color:#ff6b6b;">(überdeckt)</span>' : '';
                    return `<span style="color:#8a8aa0;">${this.escape(c.stageName)} › </span>` +
                        `<span style="color:#c0c0d0;">${this.escape(c.objectName)}</span>` +
                        `<span style="color:#666;"> (${this.escape(c.className)}, ${c.via}, ${size}${pool})</span>${shadow}`;
                })
                .join('<br>');
            html += `<div style="margin-top:4px;font-size:11px;line-height:1.6;">${list}</div>`;
        }

        td.innerHTML = html;
        row.appendChild(td);
        return row;
    }

    private buildUnreferencedSection(unreferenced: string[]): HTMLElement {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin-top:20px;background:#1e1e2e;border-radius:6px;padding:12px;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:12px;color:#8a8aa0;font-weight:600;margin-bottom:6px;';
        title.textContent = `📁 ${unreferenced.length} Bilder in public/images werden von diesem Projekt nicht verwendet`;
        wrap.appendChild(title);

        const note = document.createElement('div');
        note.style.cssText = 'font-size:11px;color:#666;margin-bottom:8px;';
        note.textContent = 'Andere Projekte können sie nutzen — vor dem Löschen prüfen. Beim Standalone-Export werden nur verwendete Bilder eingebettet.';
        wrap.appendChild(note);

        const list = document.createElement('div');
        list.style.cssText = 'font-size:11px;color:#a0a0b8;max-height:160px;overflow-y:auto;line-height:1.7;';
        list.innerHTML = unreferenced.map(f => this.escape(f)).join('<br>');
        wrap.appendChild(list);

        return wrap;
    }

    private async optimize(asset: AssetAnalysis, button: HTMLButtonElement): Promise<void> {
        button.disabled = true;
        button.textContent = 'Lade…';

        try {
            const img = await this.loadImage(asset.resolvedUrl);
            const srcCanvas = document.createElement('canvas');
            srcCanvas.width = img.naturalWidth;
            srcCanvas.height = img.naturalHeight;
            const srcCtx = srcCanvas.getContext('2d');
            if (!srcCtx) throw new Error('Canvas 2D Context nicht verfuegbar');
            srcCtx.drawImage(img, 0, 0);

            const dstCanvas = document.createElement('canvas');
            dstCanvas.width = asset.recommendedWidth;
            dstCanvas.height = asset.recommendedHeight;
            const dstCtx = dstCanvas.getContext('2d');
            if (!dstCtx) throw new Error('Canvas 2D Context nicht verfuegbar');

            const srcFrameW = img.naturalWidth / asset.columns;
            const srcFrameH = img.naturalHeight / asset.rows;
            const dstFrameW = dstCanvas.width / asset.columns;
            const dstFrameH = dstCanvas.height / asset.rows;

            for (let r = 0; r < asset.rows; r++) {
                for (let c = 0; c < asset.columns; c++) {
                    const sx = c * srcFrameW;
                    const sy = r * srcFrameH;
                    const srcData = srcCtx.getImageData(sx, sy, srcFrameW, srcFrameH);
                    const scaled = downscaleFrameAlphaWeighted(srcData, dstFrameW, dstFrameH);
                    dstCtx.putImageData(scaled, c * dstFrameW, r * dstFrameH);
                }
            }

            const dataUrl = dstCanvas.toDataURL('image/png');
            const originalName = decodeURIComponent(asset.rawUrl.split('/').pop() || 'image.png');
            const dot = originalName.lastIndexOf('.');
            const baseName = dot > 0 ? originalName.substring(0, dot) : originalName;
            const outName = `${baseName}_opt.png`;

            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = outName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => document.body.removeChild(a), 2000);

            button.textContent = 'Gespeichert';
            logger.info(`[AssetAnalyzerTool] Optimiertes Bild gespeichert: ${outName}`);
        } catch (e) {
            logger.error('Optimierung fehlgeschlagen:', e);
            button.textContent = 'Fehler';
            alert(`Optimierung fehlgeschlagen: ${String(e)}`);
            button.disabled = false;
        }
    }

    private loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Bild konnte nicht geladen werden: ${url}`));
            img.src = url;
        });
    }

    private btnStyles(): string {
        return 'padding:5px 10px;border-radius:4px;cursor:pointer;font-size:11px;border:none;background:#3a3a4f;color:#e0d4f5;';
    }

    private escape(s: string): string {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}
