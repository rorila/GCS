import { TrainingPanel } from './TrainingPanel';
import type { IViewHost } from '../EditorViewManager';
import { KnowledgeBase } from '../../ai/rag/KnowledgeBase';
import type { KnowledgeChunk } from '../../ai/rag/KnowledgeChunk';
import { NotificationToast } from '../ui/NotificationToast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PromptDialog } from '../ui/PromptDialog';
import { Logger } from '../../utils/Logger';

/**
 * KnowledgeBaseViewManager
 *
 * Verwaltungs-Tab für die RAG-Wissensbasis (kb.json):
 * - Feature-Liste mit Umbenennen / Kopieren / Löschen / Vorschau
 * - Statistik (Chunks, Größe, Embeddings)
 * - "KB neu aufbauen" (Store leeren → Docs neu chunken → speichern)
 */
export class KnowledgeBaseViewManager {
    private static readonly LOGGER = Logger.get('KnowledgeBaseViewManager');
    private previewChunkId: string | null = null;
    private trainingPanel?: TrainingPanel;
    public disposeTraining() { this.trainingPanel?.dispose(); }

    // host wird fuer zukuenftige Erweiterungen (z.B. Navigation) vorgehalten
    constructor(_host: IViewHost) {
        void _host;
    }

    // ═══════════════════════════════════════════════════════════
    // VIEW ENTRY
    // ═══════════════════════════════════════════════════════════

    public async renderKnowledgeBaseView(panel: HTMLElement) {
        this.disposeTraining();
        panel.innerHTML = `
            <div style="padding: 20px 20px 40px 20px; background-color: #1a1a2e; min-height: 100%; box-sizing: border-box; color: #e0e0e0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
                    <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: bold;">🧠 Wissensbasis</h2>
                    <button id="kb-rebuild-btn" style="padding: 8px 16px; background: #1565c0; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;">🔄 KB neu aufbauen</button>
                </div>
                <div id="kb-training"></div><div id="kb-stats"></div>
                <div id="kb-feature-list"></div>
                <div id="kb-preview"></div>
            </div>
        `;

        document.getElementById('kb-rebuild-btn')?.addEventListener('click', () => this.rebuildKnowledgeBase());

        const kb = KnowledgeBase.getInstance();
        this.trainingPanel = new TrainingPanel(panel.querySelector<HTMLElement>('#kb-training')!);
        await kb.loadFromUrl();
        this.renderStats();
        this.renderFeatureList();
    }

    // ═══════════════════════════════════════════════════════════
    // STATS
    // ═══════════════════════════════════════════════════════════

    private renderStats() {
        const el = document.getElementById('kb-stats');
        if (!el) return;
        const chunks = KnowledgeBase.getInstance().getAllChunks();
        const totalChars = chunks.reduce((sum, c) => sum + (c.content?.length ?? 0) + (c.oneShotExample?.length ?? 0), 0);
        const withEmbedding = chunks.filter(c => !!c.embedding).length;
        const byType = new Map<string, number>();
        for (const c of chunks) byType.set(c.chunkType, (byType.get(c.chunkType) ?? 0) + 1);
        const typeBadges = Array.from(byType.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([t, n]) => `<span style="background:#1a2a4a; border:1px solid #3a3a6a; border-radius:4px; padding:2px 8px; font-size:11px; color:#c0c8e0;">${t}: ${n}</span>`)
            .join(' ');

        el.innerHTML = `
            <div style="background:#12122a; border:1px solid #2a2a5a; border-radius:8px; padding:14px; margin-bottom:16px;">
                <div style="display:flex; gap:24px; flex-wrap:wrap; font-size:13px; color:#c0c8e0;">
                    <div>📦 <strong>${chunks.length}</strong> Chunks</div>
                    <div>📏 <strong>${(totalChars / 1024).toFixed(1)} KB</strong> Inhalt</div>
                    <div>🧮 <strong>${withEmbedding}/${chunks.length}</strong> Embeddings</div>
                </div>
                <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">${typeBadges}</div>
            </div>`;
    }

    // ═══════════════════════════════════════════════════════════
    // FEATURE LIST
    // ═══════════════════════════════════════════════════════════

    private renderFeatureList() {
        const el = document.getElementById('kb-feature-list');
        if (!el) return;
        const features = KnowledgeBase.getInstance().getAllChunks().filter(c => c.chunkType === 'feature');

        if (features.length === 0) {
            el.innerHTML = `<div style="color:#9090c0; font-size:13px; padding:12px;">Keine Features in der Wissensbasis.</div>`;
            return;
        }

        const rows = features.map(f => {
            const size = (f.content?.length ?? 0) + (f.oneShotExample?.length ?? 0);
            const ops = this.countOps(f);
            const name = f.title?.replace(/^Feature:\s*/, '') || f.id;
            return `
                <div style="display:flex; align-items:center; gap:10px; background:#12122a; border:1px solid #2a2a5a; border-radius:6px; padding:10px 14px; margin-bottom:8px;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:bold; font-size:14px; color:#e0e0ff;">${this.escape(name)}</div>
                        <div style="color:#9090c0; font-size:11px; margin-top:2px;">
                            ${f.id} · ${(size / 1024).toFixed(1)} KB · ${ops} Ops ${f.embedding ? '· 🧮 Embedding' : '· ⚠️ kein Embedding'}
                        </div>
                    </div>
                    <button class="kb-btn" data-action="preview" data-id="${f.id}" title="Vorschau" style="${this.btnStyle('#455a64')}">👁️</button>
                    <button class="kb-btn" data-action="rename" data-id="${f.id}" title="Umbenennen" style="${this.btnStyle('#1565c0')}">✏️</button>
                    <button class="kb-btn" data-action="duplicate" data-id="${f.id}" title="Kopieren" style="${this.btnStyle('#6a1b9a')}">📋</button>
                    <button class="kb-btn" data-action="delete" data-id="${f.id}" title="Löschen" style="${this.btnStyle('#b71c1c')}">🗑️</button>
                </div>`;
        }).join('');

        el.innerHTML = `<div style="color:#a0c0ff; font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Features (${features.length})</div>${rows}`;

        el.querySelectorAll('.kb-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = (btn as HTMLElement).dataset.action!;
                const id = (btn as HTMLElement).dataset.id!;
                this.handleAction(action, id);
            });
        });
    }

    private countOps(chunk: KnowledgeChunk): number {
        try {
            const ops = JSON.parse(chunk.oneShotExample || '[]');
            return Array.isArray(ops) ? ops.length : 0;
        } catch {
            return 0;
        }
    }

    private btnStyle(color: string): string {
        return `padding:5px 10px; background:${color}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:13px;`;
    }

    private escape(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ═══════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════

    private async handleAction(action: string, chunkId: string) {
        const kb = KnowledgeBase.getInstance();
        const featureId = chunkId.replace(/^feature-/, '');
        const chunk = kb.getAllChunks().find(c => c.id === chunkId);
        const name = chunk?.title?.replace(/^Feature:\s*/, '') || featureId;

        switch (action) {
            case 'preview':
                this.togglePreview(chunk);
                break;

            case 'rename': {
                const newName = await PromptDialog.show(`Neuer Name für "${name}":`, name, 'Feature umbenennen');
                if (!newName || newName.trim() === '' || newName.trim() === name) return;
                const newId = await kb.renameFeature(featureId, newName.trim());
                if (newId) {
                    NotificationToast.show(`Feature umbenannt zu "${newName.trim()}".`, 'success');
                } else {
                    NotificationToast.show('Umbenennen fehlgeschlagen (Name bereits vergeben oder ungültig).', 'error');
                }
                this.renderStats();
                this.renderFeatureList();
                break;
            }

            case 'duplicate': {
                const newName = await PromptDialog.show(`Kopie von "${name}" speichern als:`, `${name} (Kopie)`, 'Feature kopieren');
                if (!newName || newName.trim() === '') return;
                const newId = await kb.duplicateFeature(featureId, newName.trim());
                if (newId) {
                    NotificationToast.show(`Feature als "${newName.trim()}" kopiert.`, 'success');
                } else {
                    NotificationToast.show('Kopieren fehlgeschlagen (Name bereits vergeben oder ungültig).', 'error');
                }
                this.renderStats();
                this.renderFeatureList();
                break;
            }

            case 'delete': {
                const ok = await ConfirmDialog.show(`Feature "${name}" wirklich aus der Wissensbasis löschen?`, 'Feature löschen', 'Löschen');
                if (!ok) return;
                await kb.removeFeatureChunk(featureId);
                if (this.previewChunkId === chunkId) {
                    this.previewChunkId = null;
                    const pv = document.getElementById('kb-preview');
                    if (pv) pv.innerHTML = '';
                }
                NotificationToast.show(`Feature "${name}" gelöscht.`, 'success');
                this.renderStats();
                this.renderFeatureList();
                break;
            }
        }
    }

    private togglePreview(chunk: KnowledgeChunk | undefined) {
        const pv = document.getElementById('kb-preview');
        if (!pv) return;
        if (!chunk || this.previewChunkId === chunk.id) {
            this.previewChunkId = null;
            pv.innerHTML = '';
            return;
        }
        this.previewChunkId = chunk.id;
        const content = (chunk.content || '').slice(0, 4000);
        const truncated = (chunk.content || '').length > 4000;
        pv.innerHTML = `
            <div style="background:#0a0a1a; border:1px solid #4a3a7a; border-radius:8px; padding:14px; margin-top:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="color:#c080ff; font-size:11px; font-weight:bold; text-transform:uppercase;">Vorschau: ${this.escape(chunk.title || chunk.id)}</span>
                    <button id="kb-preview-close" style="padding:3px 10px; background:#3a3a5a; color:#e0e0e0; border:none; border-radius:4px; cursor:pointer; font-size:12px;">✕</button>
                </div>
                <pre style="color:#d0d0ff; font-size:11px; white-space:pre-wrap; margin:0; line-height:1.5; max-height:400px; overflow-y:auto;">${this.escape(content)}${truncated ? '\n\n… (gekürzt)' : ''}</pre>
            </div>`;
        document.getElementById('kb-preview-close')?.addEventListener('click', () => {
            this.previewChunkId = null;
            pv.innerHTML = '';
        });
        pv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ═══════════════════════════════════════════════════════════
    // REBUILD
    // ═══════════════════════════════════════════════════════════

    private async rebuildKnowledgeBase() {
        const ok = await ConfirmDialog.show(
            'Wissensbasis komplett neu aufbauen?\n\nAlle Dokument-Chunks werden aus den Referenz-Dokumenten neu erzeugt. Feature-Chunks bleiben erhalten. Embeddings müssen danach neu generiert werden.',
            'KB neu aufbauen',
            'Neu aufbauen'
        );
        if (!ok) return;

        const btn = document.getElementById('kb-rebuild-btn') as HTMLButtonElement | null;
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Baue auf…'; }

        try {
            const kb = KnowledgeBase.getInstance();
            const success = await kb.rebuild();
            if (success) {
                NotificationToast.show('Wissensbasis wurde neu aufgebaut.', 'success');
            } else {
                NotificationToast.show('Neuaufbau teilweise fehlgeschlagen – siehe Log.', 'warning');
            }
        } catch (err) {
            KnowledgeBaseViewManager.LOGGER.error('KB-Rebuild fehlgeschlagen:', err);
            NotificationToast.show('Neuaufbau fehlgeschlagen.', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '🔄 KB neu aufbauen'; }
            this.previewChunkId = null;
            const pv = document.getElementById('kb-preview');
            if (pv) pv.innerHTML = '';
            this.renderStats();
            this.renderFeatureList();
        }
    }
}
