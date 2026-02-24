import { GameProject, StageType } from '../../model/types';
import { MenuBar, MenuItem } from '../MenuBar';
import { ViewType } from '../EditorViewManager';
import { changeRecorder } from '../../services/ChangeRecorder';
import { playbackEngine } from '../../services/PlaybackEngine';
import { dataService } from '../../services/DataService';

export interface EditorMenuHost {
    project: GameProject;
    menuBar: MenuBar | null;
    playbackControls: any;
    inspector: any;

    saveProject(): void;
    triggerLoad(): void;
    exportHTML(): void;
    exportHTMLCompressed(): void;
    exportJSON(): void;
    exportJSONCompressed(): void;
    createStage(type: StageType): void;
    deleteCurrentStage(): void;
    createStageFromTemplate(): void;
    saveStageAsTemplate(): void;
    switchStage(stageId: string): void;
    switchView(view: ViewType): void;
    selectObject(id: string | null): void;
    getActiveStage(): any;
    loadFromServer(): void;
    startMultiplayer(): void;
}

export class EditorMenuManager {
    private host: EditorMenuHost;

    constructor(host: EditorMenuHost) {
        this.host = host;
    }

    public async initMenuBar() {
        try {
            const menuBarContainer = document.getElementById('menu-bar');
            if (!menuBarContainer) {
                console.warn('[EditorMenuManager] menu-bar container not found');
                return;
            }

            const menuBar = new MenuBar('menu-bar');
            await menuBar.loadFromJSON('./editor/menu_bar.json');

            this.host.menuBar = menuBar;
            this.updateStagesMenu();

            menuBar.onAction = (action: string) => {
                this.handleMenuAction(action);
            };

            console.log('[EditorMenuManager] MenuBar initialized');
        } catch (e) {
            console.error('[EditorMenuManager] Failed to initialize MenuBar:', e);
        }
    }

    public handleMenuAction(action: string) {
        switch (action) {
            case 'save': this.host.saveProject(); break;
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
            case 'new-stage': this.host.createStage('standard'); break;
            case 'new-splash': this.host.createStage('splash'); break;
            case 'delete-stage': this.host.deleteCurrentStage(); break;
            case 'new-from-template': this.host.createStageFromTemplate(); break;
            case 'save-as-template': this.host.saveStageAsTemplate(); break;
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
                console.warn('[EditorMenuManager] Unknown menu action:', action);
        }
    }

    public updateStagesMenu(): void {
        if (!this.host.menuBar || !this.host.project.stages) return;

        // Base items for stage management
        const baseItems: MenuItem[] = [
            { id: 'new-stage', label: 'Neue Stage', action: 'new-stage', icon: '📄' },
            { id: 'new-splash', label: 'Neuer Splashscreen', action: 'new-splash', icon: '🚀' },
            { id: 'delete-stage', label: 'Stage löschen', action: 'delete-stage', icon: '🗑️' }
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
}
