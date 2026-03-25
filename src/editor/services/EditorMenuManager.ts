import { GameProject, StageType } from '../../model/types';
import { MenuBar, MenuItem } from '../MenuBar';
import { ViewType } from '../EditorViewManager';
import { changeRecorder } from '../../services/ChangeRecorder';
import { playbackEngine } from '../../services/PlaybackEngine';
import { dataService } from '../../services/DataService';
import { Logger } from '../../utils/Logger';

export interface EditorMenuHost {
    project: GameProject;
    menuBar: MenuBar | null;
    playbackControls: any;
    inspector: any;

    newProject(): void;
    saveProject(): void;
    saveProjectToFile(overwriteConfirmed?: boolean): Promise<{ success: boolean; message: string }>;
    saveProjectAs(): Promise<{ success: boolean; message: string }>;
    triggerLoad(): void;
    exportHTML(): void;
    exportHTMLCompressed(): void;
    exportJSON(): void;
    exportJSONCompressed(): void;
    createStage(type: StageType): void;
    deleteCurrentStage(): void;
    createStageFromTemplate(): void;
    saveStageAsTemplate(): void;
    importStageFromFile(): void;
    switchStage(stageId: string): void;
    switchView(view: ViewType): void;
    selectObject(id: string | null): void;
    getActiveStage(): any;
    loadFromServer(): void;
    startMultiplayer(): void;
}

export class EditorMenuManager {
    private static logger = Logger.get('EditorMenuManager', 'Inspector_Update');
    private host: EditorMenuHost;

    constructor(host: EditorMenuHost) {
        this.host = host;
    }

    public async initMenuBar() {
        try {
            const menuBarContainer = document.getElementById('menu-bar');
            if (!menuBarContainer) {
                EditorMenuManager.logger.warn('menu-bar container not found');
                return;
            }

            const menuBar = new MenuBar('menu-bar');
            await menuBar.loadFromJSON('./editor/menu_bar.json');

            this.host.menuBar = menuBar;
            this.updateStagesMenu();

            // Stage-Label initial setzen (initMenuBar ist async, daher wird
            // updateStageLabel() beim ersten setProject() übersprungen weil menuBar noch null ist)
            const activeStage = this.host.getActiveStage();
            if (activeStage) {
                menuBar.setStageLabel(activeStage.name || this.host.project.activeStageId || '–');
            }

            menuBar.onAction = (action: string) => {
                this.handleMenuAction(action);
            };

            EditorMenuManager.logger.info('MenuBar initialized');
        } catch (e) {
            EditorMenuManager.logger.error('Failed to initialize MenuBar:', e);
        }
    }

    public handleMenuAction(action: string) {
        switch (action) {
            case 'new-project': this.host.newProject(); break;
            case 'save': this.host.saveProjectToFile(); break;
            case 'save-as': this.host.saveProjectAs(); break;
            case 'save-dev': this.host.saveProject(); break;
            case 'load': this.host.triggerLoad(); break;
            case 'export-html': this.host.exportHTML(); break;
            case 'export-html-gzip': this.host.exportHTMLCompressed(); break;
            case 'export-json': this.host.exportJSON(); break;
            case 'export-json-gzip': this.host.exportJSONCompressed(); break;
            case 'export-exe': alert('Exe-Export ist für eine zukünftige Version geplant.'); break;
            case 'multiplayer':
                const lobby = document.getElementById('multiplayer-lobby');
                if (lobby) lobby.style.display = 'flex';
                break;
            case 'new-stage':
                this.host.createStage('standard');
                this.host.selectObject(null);
                if (this.host.inspector) {
                    const ns = this.host.getActiveStage();
                    if (ns) this.host.inspector.update(ns);
                }
                break;
            case 'new-splash':
                this.host.createStage('splash');
                this.host.selectObject(null);
                if (this.host.inspector) {
                    const ss = this.host.getActiveStage();
                    if (ss) this.host.inspector.update(ss);
                }
                break;
            case 'delete-stage':
                this.host.deleteCurrentStage();
                this.host.selectObject(null);
                if (this.host.inspector) {
                    const ds = this.host.getActiveStage();
                    if (ds) this.host.inspector.update(ds);
                }
                break;
            case 'new-from-template': this.host.createStageFromTemplate(); break;
            case 'save-as-template': this.host.saveStageAsTemplate(); break;
            case 'import-stage': this.host.importStageFromFile(); break;
            case 'manage-stages': this.showStageManagerDialog(); break;
            case 'stage-duplicate':
                if ((this.host as any).stageManager) (this.host as any).stageManager.duplicateStage();
                break;
            case 'stage-move-up':
                if ((this.host as any).stageManager && this.host.project.activeStageId) 
                    (this.host as any).stageManager.moveStage(this.host.project.activeStageId, 'up');
                break;
            case 'stage-move-down':
                if ((this.host as any).stageManager && this.host.project.activeStageId) 
                    (this.host as any).stageManager.moveStage(this.host.project.activeStageId, 'down');
                break;
            case 'show-excluded': this.showExcludedBlueprintDialog(); break;
            case 'stage-settings':
                this.host.selectObject(null);
                if (this.host.inspector) {
                    const activeStage = this.host.getActiveStage();
                    if (activeStage) this.host.inspector.update(activeStage);
                }
                break;
            case 'force-reload': this.host.loadFromServer(); break;
            case 'seed-data':
                if (confirm('Achtung: Dies überschreibt lokale Test-Daten (gcs_db_data.json) mit den Server-Daten. Fortfahren?')) {
                    Promise.all([
                        dataService.seedFromUrl('users.json', '/api/dev/data/users.json'),
                        dataService.seedFromUrl('db.json', '/api/dev/data/db.json')
                    ]).then(() => {
                        alert('Daten erfolgreich geladen. Die Seite wird neu geladen.');
                        window.location.reload();
                    }).catch(err => {
                        alert('Fehler beim Seeden: ' + err.message);
                    });
                }
                break;
            default:
                const normalizedAction = action.replace(/\s+/g, '');
                if (normalizedAction.startsWith('switch-stage-')) {
                    const stageId = normalizedAction.replace('switch-stage-', '');
                    this.host.switchStage(stageId);
                } else {
                    this.handleRecordingAction(action);
                }
        }
    }

    public handleRecordingAction(action: string): void {
        switch (action) {
            case 'record-start':
                const name = prompt('Name für das Recording:', `Tutorial_${new Date().toLocaleTimeString()}`);
                if (name) changeRecorder.startRecording(name);
                break;
            case 'record-stop':
                const recording = changeRecorder.stopRecording();
                if (recording) {
                    alert(`Recording "${recording.name}" gestoppt. ${recording.actions.length} Aktionen aufgezeichnet.`);
                    playbackEngine.load(recording);
                    this.host.playbackControls?.show();
                }
                break;
            case 'playback-show':
                this.host.playbackControls?.show();
                break;
            case 'recording-export':
                const currentRec = (playbackEngine as any).currentRecording;
                if (currentRec) {
                    const json = JSON.stringify(currentRec, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${currentRec.name}.gcsrec`;
                    a.click();
                    URL.revokeObjectURL(url);
                } else {
                    alert('Kein Recording zum Exportieren vorhanden.');
                }
                break;
            case 'recording-import':
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.gcsrec, .json';
                input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (re) => {
                            try {
                                const rec = JSON.parse(re.target?.result as string);
                                playbackEngine.load(rec);
                                this.host.playbackControls?.show();
                                alert(`Recording "${rec.name}" erfolgreich importiert.`);
                            } catch (err) {
                                alert('Fehler beim Importieren des Recordings.');
                            }
                        };
                        reader.readAsText(file);
                    }
                };
                input.click();
                break;
            default:
                EditorMenuManager.logger.warn('Unknown menu action:', action);
        }
    }

    public updateStagesMenu(): void {
        if (!this.host.menuBar || !this.host.project.stages) return;

        // Base items for stage management
        const baseItems: MenuItem[] = [
            { id: 'manage-stages', label: '📋 Stages verwalten...', action: 'manage-stages' },
            { id: 'new-stage', label: 'Neue Stage', action: 'new-stage', icon: '📄' },
            { id: 'new-splash', label: 'Neuer Splashscreen', action: 'new-splash', icon: '🚀' },
            { id: 'delete-stage', label: 'Stage löschen', action: 'delete-stage', icon: '🗑️' },
            { id: 'show-excluded', label: 'Ausgeblendete Objekte einblenden', action: 'show-excluded', icon: '👁️' },
            { id: 'import-stage', label: 'Stage importieren', action: 'import-stage', icon: '📥' }
        ];

        // Dynamic stage list
        const stageItems: MenuItem[] = this.host.project.stages.map(s => ({
            id: s.id,
            label: s.type === 'blueprint' ? `🏗️ ${s.name} (Blueprint)` : `🎭 ${s.name}`,
            action: `switch-stage-${s.id}`,
            active: s.id === this.host.project.activeStageId
        }));

        this.host.menuBar.updateMenu('stages', [...baseItems, ...stageItems]);
    }

    /**
     * Zeigt einen Dark-Theme Modal-Dialog mit Checkboxen für alle ausgeblendeten
     * Blueprint-Objekte der aktuellen Stage.
     */
    private showExcludedBlueprintDialog(): void {
        const activeStage = this.host.getActiveStage();
        if (!activeStage || !activeStage.excludedBlueprintIds || activeStage.excludedBlueprintIds.length === 0) {
            alert('Keine ausgeblendeten Objekte auf dieser Stage.');
            return;
        }

        const blueprintStage = this.host.project.stages?.find((s: any) => s.type === 'blueprint');
        if (!blueprintStage) return;

        const allBpObjs = [...(blueprintStage.objects || [])];

        // Overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:20000;display:flex;align-items:center;justify-content:center;';

        // Dialog
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background:#252526; border:1px solid #555; border-radius:8px;
            box-shadow:0 8px 32px rgba(0,0,0,0.6); min-width:340px; max-width:480px;
            color:#ccc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 20px 12px;border-bottom:1px solid #444;font-size:15px;font-weight:600;color:#fff;';
        header.textContent = `👁️ Ausgeblendete Objekte — ${activeStage.name}`;
        dialog.appendChild(header);

        // Checkbox-Liste
        const list = document.createElement('div');
        list.style.cssText = 'padding:12px 20px;max-height:300px;overflow-y:auto;';

        const checkboxes: { id: string, cb: HTMLInputElement }[] = [];
        for (const excludedId of activeStage.excludedBlueprintIds) {
            const obj = allBpObjs.find((o: any) => o.id === excludedId);
            const name = obj?.name || obj?.caption || excludedId;
            const className = obj?.className || '';
            const icon = className === 'TPanel' ? '🖼️' : className === 'TLabel' ? '🏷️' : className === 'TButton' ? '🔘' : className === 'TImage' ? '🖼️' : '📦';

            const row = document.createElement('label');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 4px;cursor:pointer;border-radius:4px;transition:background 0.15s;';
            row.onmouseenter = () => row.style.background = '#333';
            row.onmouseleave = () => row.style.background = 'transparent';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.style.cssText = 'width:16px;height:16px;accent-color:#4fc3f7;cursor:pointer;';
            row.appendChild(cb);

            const iconEl = document.createElement('span');
            iconEl.textContent = icon;
            iconEl.style.fontSize = '16px';
            row.appendChild(iconEl);

            const label = document.createElement('span');
            label.textContent = name;
            label.style.cssText = 'flex:1;font-size:13px;';
            row.appendChild(label);

            const typeEl = document.createElement('span');
            typeEl.textContent = className.replace('T', '');
            typeEl.style.cssText = 'font-size:11px;color:#888;';
            row.appendChild(typeEl);

            list.appendChild(row);
            checkboxes.push({ id: excludedId, cb });
        }
        dialog.appendChild(list);

        // Footer mit Buttons
        const footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 20px;border-top:1px solid #444;display:flex;gap:8px;justify-content:flex-end;';

        const btnAll = document.createElement('button');
        btnAll.textContent = 'Alle einblenden';
        btnAll.style.cssText = 'padding:6px 14px;border:1px solid #555;background:#333;color:#4fc3f7;border-radius:4px;cursor:pointer;font-size:13px;';
        btnAll.onmouseenter = () => btnAll.style.background = '#444';
        btnAll.onmouseleave = () => btnAll.style.background = '#333';

        const btnApply = document.createElement('button');
        btnApply.textContent = 'Markierte einblenden';
        btnApply.style.cssText = 'padding:6px 14px;border:none;background:#094771;color:#fff;border-radius:4px;cursor:pointer;font-size:13px;';
        btnApply.onmouseenter = () => btnApply.style.background = '#0b5d99';
        btnApply.onmouseleave = () => btnApply.style.background = '#094771';

        const btnCancel = document.createElement('button');
        btnCancel.textContent = 'Abbrechen';
        btnCancel.style.cssText = 'padding:6px 14px;border:1px solid #555;background:#333;color:#ccc;border-radius:4px;cursor:pointer;font-size:13px;';
        btnCancel.onmouseenter = () => btnCancel.style.background = '#444';
        btnCancel.onmouseleave = () => btnCancel.style.background = '#333';

        footer.appendChild(btnAll);
        footer.appendChild(btnApply);
        footer.appendChild(btnCancel);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Event-Handler
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        btnCancel.onclick = close;

        btnAll.onclick = () => {
            activeStage.excludedBlueprintIds = [];
            close();
            if ((this.host as any).render) (this.host as any).render();
        };

        btnApply.onclick = () => {
            const toRestore = checkboxes.filter(c => c.cb.checked).map(c => c.id);
            if (toRestore.length === 0) { close(); return; }
            activeStage.excludedBlueprintIds = activeStage.excludedBlueprintIds!.filter(
                (id: string) => !toRestore.includes(id)
            );
            close();
            if ((this.host as any).render) (this.host as any).render();
        };

        // ESC schließt den Dialog
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); window.removeEventListener('keydown', onKey); } };
        window.addEventListener('keydown', onKey);
    }

    /**
     * Zeigt einen Dark-Theme Modal-Dialog zur Verwaltung (Sortierung, Duplikation) 
     * aller Stages im Projekt.
     */
    private showStageManagerDialog(): void {
        const project = this.host.project;
        if (!project || !project.stages) return;

        // Overlay erstellen
        const overlay = document.createElement('div');
        overlay.id = 'stage-manager-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:20000;display:flex;align-items:center;justify-content:center;';

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background:#252526; border:1px solid #555; border-radius:8px;
            box-shadow:0 8px 32px rgba(0,0,0,0.6); width:500px; max-width:90%;
            color:#ccc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            display:flex; flex-direction:column; max-height:80vh;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 20px 12px;border-bottom:1px solid #444;font-size:15px;font-weight:600;color:#fff;display:flex;justify-content:space-between;align-items:center;';
        header.innerHTML = '<span>📋 Stages verwalten</span>';
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✖';
        closeBtn.style.cssText = 'background:transparent;border:none;color:#aaa;cursor:pointer;font-size:16px;';
        closeBtn.onmouseenter = () => closeBtn.style.color = '#fff';
        closeBtn.onmouseleave = () => closeBtn.style.color = '#aaa';
        closeBtn.onclick = () => close();
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        // List Container
        const listContainer = document.createElement('div');
        listContainer.style.cssText = 'padding:10px; overflow-y:auto; flex:1;';
        dialog.appendChild(listContainer);

        // Render Funktion für die Liste (Aufruf bei Start und nach Änderungen)
        const renderList = () => {
            listContainer.innerHTML = '';
            project.stages!.forEach((stage, index) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;padding:8px 12px;background:#1e1e1e;border:1px solid #333;margin-bottom:6px;border-radius:4px;';
                if (stage.id === project.activeStageId) {
                    row.style.borderLeft = '3px solid #4fc3f7';
                }

                // Stage Info
                const infoCol = document.createElement('div');
                infoCol.style.cssText = 'flex:1;display:flex;flex-direction:column;';
                
                const nameLabel = document.createElement('span');
                nameLabel.style.cssText = 'font-weight:600;color:#e0e0e0;font-size:13px;';
                nameLabel.textContent = stage.name;
                infoCol.appendChild(nameLabel);

                const typeLabel = document.createElement('span');
                typeLabel.style.cssText = 'font-size:11px;color:#888;margin-top:2px;';
                typeLabel.textContent = `ID: ${stage.id} • Typ: ${stage.type}`;
                infoCol.appendChild(typeLabel);
                
                row.appendChild(infoCol);

                // Controls
                const controlsCol = document.createElement('div');
                controlsCol.style.cssText = 'display:flex;gap:4px;';

                const btnStyle = 'background:#333;border:1px solid #444;color:#ccc;cursor:pointer;padding:4px 8px;border-radius:3px;font-size:12px;transition:background 0.2s;';

                const createBtn = (icon: string, title: string, onClick: () => void, disabled = false) => {
                    const btn = document.createElement('button');
                    btn.innerHTML = icon;
                    btn.title = title;
                    btn.style.cssText = btnStyle;
                    if (disabled) {
                        btn.style.opacity = '0.3';
                        btn.style.cursor = 'default';
                    } else {
                        btn.onmouseenter = () => btn.style.background = '#444';
                        btn.onmouseleave = () => btn.style.background = '#333';
                        btn.onclick = onClick;
                    }
                    return btn;
                };

                // Up
                controlsCol.appendChild(createBtn('⬆️', 'Nach oben verschieben', () => {
                    const sm = (this.host as any).stageManager;
                    if (sm) { sm.moveStage(stage.id, 'up'); renderList(); }
                }, index === 0));

                // Down
                controlsCol.appendChild(createBtn('⬇️', 'Nach unten verschieben', () => {
                    const sm = (this.host as any).stageManager;
                    if (sm) { sm.moveStage(stage.id, 'down'); renderList(); }
                }, index === project.stages!.length - 1));

                // Clone
                controlsCol.appendChild(createBtn('📄+', 'Duplizieren', () => {
                    const sm = (this.host as any).stageManager;
                    if (sm) { 
                        // duplicateStage() triggert onRefresh -> Editor baut alles neu.
                        // Für ein flüssiges Erlebnis rendern wir den Dialog einfach neu nach kurzem Delay.
                        sm.duplicateStage(stage.id); 
                        setTimeout(renderList, 50);
                    }
                }));

                // Delete
                controlsCol.appendChild(createBtn('🗑️', 'Löschen', () => {
                    if (confirm(`Möchtest du Stage "${stage.name}" wirklich löschen?`)) {
                        const sm = (this.host as any).stageManager;
                        if (project.stages!.length <= 1) {
                            alert('Das Projekt muss mindestens eine Stage enthalten.');
                            return;
                        }
                        // Wenn es die aktive Stage ist: vor dem Löschen wechseln
                        if (project.activeStageId === stage.id) {
                            const fallback = project.stages!.find(s => s.id !== stage.id);
                            if (fallback) sm.switchStage(fallback.id);
                        }
                        const idx = project.stages!.findIndex(s => s.id === stage.id);
                        if (idx !== -1) {
                            project.stages!.splice(idx, 1);
                            if (sm.onRefresh) sm.onRefresh();
                            renderList();
                        }
                    }
                }));

                row.appendChild(controlsCol);
                listContainer.appendChild(row);
            });
        };

        renderList();

        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 20px;border-top:1px solid #444;display:flex;justify-content:flex-end;';
        
        const btnDone = document.createElement('button');
        btnDone.textContent = 'Fertig';
        btnDone.style.cssText = 'padding:6px 16px;border:none;background:#094771;color:#fff;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;';
        btnDone.onmouseenter = () => btnDone.style.background = '#0b5d99';
        btnDone.onmouseleave = () => btnDone.style.background = '#094771';
        footer.appendChild(btnDone);
        dialog.appendChild(footer);

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const close = () => {
            overlay.remove();
            window.removeEventListener('keydown', onKey);
            // Editor MenuBar Updates nach Schließen sicherstellen
            this.updateStagesMenu();
        };

        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        btnDone.onclick = close;

        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        window.addEventListener('keydown', onKey);
    }
}
