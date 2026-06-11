import type { IViewHost } from '../EditorViewManager';
import { mediatorService } from '../../services/MediatorService';
import { NotificationToast } from '../ui/NotificationToast';
import { ConfirmDialog } from '../ui/ConfirmDialog';

/**
 * ManagementViewManager - Rendert die Management-Ansicht des Editors.
 *
 * Extrahiert aus EditorViewManager für bessere Wartbarkeit.
 * Enthält:
 * - renderManagementView()
 * - renderStickyNotesView()
 * - renderImportView()
 * - updateImportStatus()
 * - handleManagerRowClick()
 * - escapeHtml()
 */
export class ManagementViewManager {
    private host: IViewHost;

    constructor(host: IViewHost) {
        this.host = host;
    }

    // ═══════════════════════════════════════════════════════════
    // MANAGEMENT VIEW
    // ═══════════════════════════════════════════════════════════

    public renderManagementView(panel: HTMLElement) {
        panel.innerHTML = '';

        // 1. Sidebar
        const sidebar = document.createElement('div');
        sidebar.className = 'management-sidebar';

        const managers = [
            { id: 'VisualObjects', label: 'Visuelle Objekte', emoji: '🖼️' },
            { id: 'Tasks', label: 'Tasks', emoji: '⚡' },
            { id: 'Actions', label: 'Aktionen', emoji: '🎬' },
            { id: 'Variables', label: 'Variablen', emoji: '📊' },
            { id: 'FlowCharts', label: 'Ablaufdiagramme', emoji: '🗺️' },
            { id: 'Stages', label: 'Stages', emoji: '🎬' },
            { id: 'StickyNotes', label: 'Notizen', emoji: '📝' },
            { id: 'Import', label: 'Import', emoji: '📥' }
        ];

        managers.forEach(m => {
            const btn = document.createElement('button');
            btn.className = `management-sidebar-btn ${this.host.selectedManager === m.id ? 'active' : ''}`;
            btn.innerHTML = `${m.emoji} ${m.label}`;
            btn.onclick = () => {
                this.host.selectedManager = m.id;
                this.renderManagementView(panel);
            };
            sidebar.appendChild(btn);
        });

        panel.appendChild(sidebar);

        // 2. Content Area
        const content = document.createElement('div');
        content.className = 'management-content';

        if (this.host.selectedManager === 'Import') {
            this.renderImportView(content);
        } else if (this.host.selectedManager === 'StickyNotes') {
            this.renderStickyNotesView(content);
        } else {
            const stage = this.host.getActiveStage()
                || this.host.project.stages?.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint')
                || this.host.project.stages?.[0];
            if (stage) {
                const managerList = mediatorService.getManagersForStage(stage.id, this.host.useStageIsolatedView);
                const activeManager = managerList.find(m => m.name === this.host.selectedManager);

                if (activeManager) {
                    const headerRow = document.createElement('div');
                    headerRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;';

                    const title = document.createElement('h2');
                    title.textContent = managers.find(m => m.id === this.host.selectedManager)?.label || '';
                    title.style.margin = '0';
                    headerRow.appendChild(title);

                    const sourceSelect = document.createElement('select');
                    sourceSelect.style.cssText = `background: #2d2d2d; border: 1px solid #3a3a3a; color: #fff; padding: 4px; border-radius: 4px; outline: none; cursor: pointer;`;

                    const optStage = document.createElement('option');
                    optStage.value = 'stage';
                    optStage.textContent = `Stage: ${stage.name || stage.id}`;
                    optStage.selected = this.host.useStageIsolatedView;

                    const optAll = document.createElement('option');
                    optAll.value = 'project';
                    optAll.textContent = 'Gesamtes Projekt';
                    optAll.selected = !this.host.useStageIsolatedView;

                    sourceSelect.appendChild(optStage);
                    sourceSelect.appendChild(optAll);

                    sourceSelect.onchange = () => {
                        this.host.useStageIsolatedView = sourceSelect.value === 'stage';
                        this.renderManagementView(panel);
                    };

                    headerRow.appendChild(sourceSelect);
                    content.appendChild(headerRow);

                    const listContainer = document.createElement('div');
                    listContainer.style.flex = '1';
                    listContainer.style.position = 'relative';
                    listContainer.style.overflowY = 'auto';
                    content.appendChild(listContainer);

                    const listWrap = document.createElement('div');
                    listWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding-right:8px;padding-bottom:16px;';
                    listContainer.appendChild(listWrap);

                    const color = activeManager.style?.backgroundColor || '#89b4fa';
                    const dataList = activeManager.data || [];

                    if (dataList.length === 0) {
                        const empty = document.createElement('div');
                        empty.textContent = 'Keine Einträge gefunden.';
                        empty.style.cssText = 'color:#888; font-style:italic; padding: 16px; background: #2a2a3e; border-radius: 6px;';
                        listWrap.appendChild(empty);
                    }

                    dataList.forEach((row: any) => {
                        const item = document.createElement('div');
                        item.style.cssText = `
                            background: #2a2a3e; border-left: 4px solid ${color}; 
                            padding: 10px 14px; border-radius: 4px; cursor: pointer; transition: background 0.2s, transform 0.1s;
                        `;
                        item.onmouseenter = () => { item.style.background = '#3a3a4e'; item.style.transform = 'translateY(-1px)'; };
                        item.onmouseleave = () => { item.style.background = '#2a2a3e'; item.style.transform = 'translateY(0)'; };

                        const primaryCol = activeManager.columns?.[0];
                        const primaryText = primaryCol ? row[primaryCol.property] : (row.name || row.id || 'Unbenannt');

                        let html = `<div style="font-weight:bold;font-size:13px;color:#fff;margin-bottom:4px;">${this.escapeHtml(String(primaryText))}</div>`;

                        let locationText = '';
                        if (row.uiScope === 'global') locationText = 'Globale Ebene (Blueprint)';
                        else if (row.uiScope === 'stage') locationText = `Stage: ${stage.name || stage.id}`;
                        else if (row.uiScope && row.uiScope.toString().startsWith('stage:')) locationText = `Stage: ${row.uiScope.substring(6).trim()}`;
                        else if (row.uiScope === 'local') locationText = 'Lokal (im Task/Action)';
                        else if (row.uiScope === 'library') locationText = 'System-Bibliothek';

                        if (locationText) {
                            html += `<div style="font-size:11px;color:#99aab5;margin-bottom:6px;">📍 ${this.escapeHtml(locationText)}</div>`;
                        }

                        if (activeManager.columns && activeManager.columns.length > 1) {
                            const details = activeManager.columns.slice(1).map((col: any) => {
                                let val = row[col.property];
                                if (val === undefined || val === null) val = '';
                                return `<span style="color:#aaa;">${col.label}:</span> <span style="color:#ccc;">${this.escapeHtml(String(val))}</span>`;
                            }).join(' &nbsp;|&nbsp; ');

                            if (details) {
                                html += `<div style="font-size:11px;">${details}</div>`;
                            }
                        }

                        item.innerHTML = html;
                        item.onclick = () => this.handleManagerRowClickPublic(this.host.selectedManager, row);
                        listWrap.appendChild(item);
                    });
                }
            }
        }

        panel.appendChild(content);
    }

    // ═══════════════════════════════════════════════════════════
    // STICKY NOTES VIEW
    // ═══════════════════════════════════════════════════════════

    /**
     * Rendert die Notizen-Ansicht: Stage- und Flow-Notizen, gruppiert nach Farben.
     */
    private renderStickyNotesView(parent: HTMLElement): void {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;gap:16px;padding:16px;height:100%;box-sizing:border-box;overflow-y:auto;';

        const title = document.createElement('h2');
        title.textContent = '📝 Projekt Notizen-Übersicht';
        title.style.cssText = 'margin:0;color:#fff;font-size:16px;';
        wrapper.appendChild(title);

        const hint = document.createElement('div');
        hint.textContent = 'Klicken Sie auf eine Notiz, um direkt in den jeweiligen Editor und zur Ansicht zu springen.';
        hint.style.cssText = 'font-size:12px;color:#888;margin-bottom:8px;';
        wrapper.appendChild(hint);

        const stageNotes: any[] = [];
        const flowNotes: any[] = [];

        const extractFlowNotes = (elements: any[], stageId: string, stageName: string, contextKey: string) => {
            if (!elements) return;
            elements.forEach(el => {
                if (el.type === 'comment') {
                    const data = (el as any).data || {};
                    flowNotes.push({
                        id: el.id,
                        title: data.name || 'Ohne Titel',
                        text: data.details || '',
                        color: data.noteColor || 'yellow',
                        stageId: stageId,
                        stageName: stageName,
                        contextKey: contextKey
                    });
                }
            });
        };

        const bpStage = this.host.project.stages?.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint');
        const bpId = bpStage ? bpStage.id : (this.host.project.stages?.[0]?.id || 'stage_blueprint');
        const bpName = bpStage ? bpStage.name : 'Globale Ebene';

        if (this.host.project.flowCharts?.global?.elements) {
            extractFlowNotes(this.host.project.flowCharts.global.elements, bpId, bpName, 'global');
        } else if ((this.host.project as any).flow?.elements) {
            extractFlowNotes((this.host.project as any).flow.elements, bpId, bpName, 'global');
        }

        if (this.host.project.tasks) {
            this.host.project.tasks.forEach((t: any) => {
                if (t.standaloneNodes) extractFlowNotes(t.standaloneNodes, bpId, bpName, t.name);
            });
        }

        this.host.project.stages?.forEach(stage => {
            stage.objects?.forEach(obj => {
                if (obj.className === 'TStickyNote') {
                    stageNotes.push({
                        id: obj.id,
                        title: obj.title || obj.name || 'Ohne Titel',
                        text: obj.text || '',
                        color: obj.noteColor || 'yellow',
                        stageId: stage.id,
                        stageName: stage.name
                    });
                }
            });

            if (stage.tasks) {
                stage.tasks.forEach((t: any) => {
                    if (t.standaloneNodes) {
                        extractFlowNotes(t.standaloneNodes, stage.id, stage.name, t.name);
                    }
                });
            }

            if (stage.flowCharts) {
                Object.keys(stage.flowCharts).forEach(contextKey => {
                    const flow = stage.flowCharts![contextKey];
                    extractFlowNotes(flow.elements || [], stage.id, stage.name, contextKey);
                });
            }
        });

        const colorMap: Record<string, { label: string, hex: string }> = {
            'yellow': { label: 'Information (Gelb)', hex: '#fff9c4' },
            'green': { label: 'Erfolg/Positiv (Grün)', hex: '#c8e6c9' },
            'blue': { label: 'Struktur/Neutral (Blau)', hex: '#bbdefb' },
            'red': { label: 'Achtung/Todo (Rot)', hex: '#ffcdd2' }
        };

        const renderGroup = (titleText: string, notes: any[], isFlow: boolean) => {
            if (notes.length === 0) return;
            const groupWrap = document.createElement('div');
            groupWrap.style.cssText = 'margin-bottom: 24px;';

            const groupTitle = document.createElement('h3');
            groupTitle.textContent = titleText;
            groupTitle.style.cssText = 'margin: 0 0 12px 0; color: #89b4fa; font-size: 14px; border-bottom: 1px solid #444; padding-bottom: 4px;';
            groupWrap.appendChild(groupTitle);

            const byColor: Record<string, any[]> = {};
            notes.forEach(n => {
                const c = n.color || 'yellow';
                if (!byColor[c]) byColor[c] = [];
                byColor[c].push(n);
            });

            Object.keys(colorMap).forEach(colorKey => {
                const cNotes = byColor[colorKey];
                if (!cNotes || cNotes.length === 0) return;

                const colTitle = document.createElement('h4');
                colTitle.textContent = colorMap[colorKey].label;
                colTitle.style.cssText = `margin: 12px 0 8px 0; color: ${colorMap[colorKey].hex}; font-size: 13px;`;
                groupWrap.appendChild(colTitle);

                const list = document.createElement('div');
                list.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding-left:8px;';

                cNotes.forEach(n => {
                    const item = document.createElement('div');
                    item.style.cssText = `
                        background: #2a2a3e; border-left: 4px solid ${colorMap[colorKey].hex}; 
                        padding: 10px 14px; border-radius: 4px; cursor: pointer; transition: background 0.2s, transform 0.1s;
                    `;
                    item.onmouseenter = () => { item.style.background = '#3a3a4e'; item.style.transform = 'translateY(-1px)'; };
                    item.onmouseleave = () => { item.style.background = '#2a2a3e'; item.style.transform = 'translateY(0)'; };

                    const subtitle = isFlow
                        ? `Stage: ${n.stageName} | Diagramm: ${n.contextKey}`
                        : `Stage: ${n.stageName}`;

                    item.innerHTML = `
                        <div style="font-weight:bold;font-size:13px;color:#fff;margin-bottom:4px;">${this.escapeHtml(n.title)}</div>
                        <div style="font-size:11px;color:#aaa;margin-bottom:6px;">${this.escapeHtml(subtitle)}</div>
                        <div class="sticky-note-text" style="font-size:12px;color:#ccc;white-space:pre-wrap;line-height:1.4;">${n.text}</div>
                    `;
                    item.querySelectorAll('.sticky-note-text a').forEach((a: Element) => {
                        (a as HTMLElement).style.cssText = 'color:#4fc3f7;';
                        (a as HTMLElement).onclick = (e) => {
                            e.stopPropagation();
                            const tmp = document.createElement('a');
                            tmp.href = (a as HTMLAnchorElement).href;
                            tmp.target = '_blank';
                            tmp.rel = 'noopener noreferrer';
                            tmp.style.display = 'none';
                            document.body.appendChild(tmp);
                            tmp.click();
                            document.body.removeChild(tmp);
                        };
                    });

                    item.onclick = () => {
                        this.host.switchStage(n.stageId);
                        if (isFlow) {
                            this.host.switchView('flow');
                            setTimeout(() => {
                                if (this.host.flowEditor) {
                                    this.host.flowEditor.show();
                                    this.host.flowEditor.switchActionFlow(n.contextKey, true, false);
                                    setTimeout(() => {
                                        this.host.flowEditor?.selectNodeById(n.id);
                                    }, 100);
                                }
                            }, 50);
                        } else {
                            this.host.switchView('stage');
                            setTimeout(() => {
                                this.host.selectObject(n.id, true);
                            }, 50);
                        }
                    };

                    list.appendChild(item);
                });
                groupWrap.appendChild(list);
            });

            wrapper.appendChild(groupWrap);
        };

        if (stageNotes.length === 0 && flowNotes.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'Keine Notizen im Projekt gefunden.';
            empty.style.cssText = 'color:#888; font-style:italic; padding: 16px; background: #2a2a3e; border-radius: 6px;';
            wrapper.appendChild(empty);
        } else {
            renderGroup('📌 Notizen im Visual Editor', stageNotes, false);
            renderGroup('🗺️ Notizen in Flow-Diagrammen', flowNotes, true);
        }

        parent.appendChild(wrapper);
    }

    // ═══════════════════════════════════════════════════════════
    // IMPORT VIEW
    // ═══════════════════════════════════════════════════════════

    /**
     * Rendert die Import-Ansicht: Textarea + Validierung + Laden/Kopieren-Buttons
     */
    private renderImportView(parent: HTMLElement): void {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;gap:16px;padding:16px;height:100%;box-sizing:border-box;';

        const title = document.createElement('h2');
        title.textContent = '📥 Projekt importieren';
        title.style.cssText = 'margin:0;color:#fff;font-size:16px;';
        wrapper.appendChild(title);

        const hint = document.createElement('div');
        hint.textContent = 'Füge ein Projekt-JSON per Ctrl+V in das Textfeld ein, um es zu laden.';
        hint.style.cssText = 'font-size:12px;color:#888;margin-bottom:4px;';
        wrapper.appendChild(hint);

        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Projekt-JSON hier einfügen (Ctrl+V)...\n\n{\n  "name": "MeinProjekt",\n  "stages": [...]\n}';
        textarea.style.cssText = 'flex:1;min-height:200px;background:#1a1a2e;color:#e0e0e0;border:1px solid #444;border-radius:8px;padding:12px;font-family:Consolas,Monaco,monospace;font-size:12px;resize:none;outline:none;transition:border-color 0.2s;';
        textarea.onfocus = () => { textarea.style.borderColor = '#89b4fa'; };
        textarea.onblur = () => { textarea.style.borderColor = '#444'; };
        wrapper.appendChild(textarea);

        const statusBar = document.createElement('div');
        statusBar.style.cssText = 'padding:10px 14px;border-radius:6px;font-size:12px;transition:all 0.2s;';
        this.updateImportStatus(statusBar, 'waiting');
        wrapper.appendChild(statusBar);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:10px;';

        const loadBtn = document.createElement('button');
        loadBtn.textContent = '📥 Projekt laden';
        loadBtn.disabled = true;
        loadBtn.style.cssText = 'flex:1;padding:10px 16px;background:#1e3a5f;color:#4fc3f7;border:1px solid #2a5a8f;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;transition:all 0.2s;opacity:0.5;';
        btnRow.appendChild(loadBtn);

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Aktuelles Projekt kopieren';
        copyBtn.style.cssText = 'flex:1;padding:10px 16px;background:#2a2a3e;color:#ccc;border:1px solid #444;border-radius:6px;cursor:pointer;font-size:13px;transition:all 0.2s;';
        copyBtn.onmouseenter = () => { copyBtn.style.borderColor = '#89b4fa'; copyBtn.style.background = '#3a3a4e'; };
        copyBtn.onmouseleave = () => { copyBtn.style.borderColor = '#444'; copyBtn.style.background = '#2a2a3e'; };
        copyBtn.onclick = async () => {
            try {
                const projectJson = JSON.stringify(this.host.project, null, 2);
                await navigator.clipboard.writeText(projectJson);
                const origText = copyBtn.textContent;
                copyBtn.textContent = '✅ Kopiert!';
                copyBtn.style.borderColor = '#a6e3a1';
                setTimeout(() => {
                    copyBtn.textContent = origText;
                    copyBtn.style.borderColor = '#444';
                }, 2000);
            } catch (e) {
                NotificationToast.show('Fehler beim Kopieren: ' + e);
            }
        };
        btnRow.appendChild(copyBtn);

        wrapper.appendChild(btnRow);
        parent.appendChild(wrapper);

        let parsedProject: any = null;
        let validationTimer: number | undefined;

        textarea.oninput = () => {
            clearTimeout(validationTimer);
            validationTimer = window.setTimeout(() => {
                const text = textarea.value.trim();
                if (!text) {
                    this.updateImportStatus(statusBar, 'waiting');
                    loadBtn.disabled = true;
                    loadBtn.style.opacity = '0.5';
                    parsedProject = null;
                    return;
                }

                try {
                    const parsed = JSON.parse(text);

                    if (!parsed.stages || !Array.isArray(parsed.stages)) {
                        this.updateImportStatus(statusBar, 'error', 'Kein gültiges GCS-Projekt: "stages" Array fehlt.');
                        loadBtn.disabled = true;
                        loadBtn.style.opacity = '0.5';
                        parsedProject = null;
                        return;
                    }

                    const name = parsed.name || 'Unbenannt';
                    const stageCount = parsed.stages.length;
                    let componentCount = 0;
                    let taskCount = 0;
                    parsed.stages.forEach((s: any) => {
                        componentCount += (s.objects || []).length;
                        taskCount += (s.tasks || s.Tasks || []).length;
                    });

                    parsedProject = parsed;
                    this.updateImportStatus(statusBar, 'valid',
                        `Gültiges Projekt: "${name}" (${stageCount} Stage${stageCount !== 1 ? 's' : ''}, ${componentCount} Komponenten, ${taskCount} Tasks)`
                    );
                    loadBtn.disabled = false;
                    loadBtn.style.opacity = '1';

                } catch (e: any) {
                    this.updateImportStatus(statusBar, 'error', `JSON-Syntaxfehler: ${e.message}`);
                    loadBtn.disabled = true;
                    loadBtn.style.opacity = '0.5';
                    parsedProject = null;
                }
            }, 300);
        };

        loadBtn.onclick = async () => {
            if (!parsedProject) return;
            const name = parsedProject.name || 'Unbenannt';
            if (!await ConfirmDialog.show(`Achtung: Das aktuelle Projekt wird durch "${name}" ersetzt.\n\nFortfahren?`)) return;

            try {
                (this.host as any).loadProject(parsedProject);
                textarea.value = '';
                this.updateImportStatus(statusBar, 'loaded', `Projekt "${name}" erfolgreich geladen!`);
                loadBtn.disabled = true;
                loadBtn.style.opacity = '0.5';
                parsedProject = null;
            } catch (e: any) {
                this.updateImportStatus(statusBar, 'error', `Fehler beim Laden: ${e.message}`);
            }
        };
    }

    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════

    /**
     * Aktualisiert die Statusanzeige im Import-Tab.
     */
    private updateImportStatus(el: HTMLElement, status: 'waiting' | 'valid' | 'error' | 'loaded', message?: string): void {
        switch (status) {
            case 'waiting':
                el.style.background = 'rgba(255,255,255,0.03)';
                el.style.border = '1px solid #333';
                el.style.color = '#666';
                el.innerHTML = '⏳ Warte auf Eingabe...';
                break;
            case 'valid':
                el.style.background = 'rgba(166,227,161,0.1)';
                el.style.border = '1px solid rgba(166,227,161,0.4)';
                el.style.color = '#a6e3a1';
                el.innerHTML = `✅ ${message}`;
                break;
            case 'error':
                el.style.background = 'rgba(243,139,168,0.1)';
                el.style.border = '1px solid rgba(243,139,168,0.4)';
                el.style.color = '#f38ba8';
                el.innerHTML = `❌ ${message}`;
                break;
            case 'loaded':
                el.style.background = 'rgba(137,180,250,0.1)';
                el.style.border = '1px solid rgba(137,180,250,0.4)';
                el.style.color = '#89b4fa';
                el.innerHTML = `🎉 ${message}`;
                break;
        }
    }

    public handleManagerRowClickPublic(managerId: string, row: any) {
        const h = this.host;

        if (managerId === 'Tasks' || managerId === 'FlowCharts') {
            h.switchView('flow');
            if (h.flowEditor && row.name) {
                h.flowEditor.switchActionFlow(row.name);
            }
        } else if (managerId === 'VisualObjects') {
            h.selectObject(row.id, true);
            h.switchView('stage');
        } else if (managerId === 'Actions' || managerId === 'Variables') {
            h.selectObject(row.id || row.name, true);
        } else if (managerId === 'Stages') {
            if (row.id && (h as any).switchStage) {
                (h as any).switchStage(row.id);
            }
        }
    }

    private escapeHtml(str: string): string {
        const div = document.createElement('div');
        div.innerText = str;
        return div.innerHTML;
    }
}
