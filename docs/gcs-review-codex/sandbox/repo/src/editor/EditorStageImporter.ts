import { GameProject, StageDefinition } from '../model/types';
import { projectStore } from '../services/ProjectStore';
import { mediatorService } from '../services/MediatorService';
import { NotificationToast } from './ui/NotificationToast';
import type { Editor } from './Editor';

export class EditorStageImporter {
    private editor: Editor;

    constructor(editor: Editor) {
        this.editor = editor;
    }

    /**
     * Stage-Import: Öffnet File-Picker, zeigt Stage-Auswahl-Dialog,
     * importiert die gewählte Stage inkl. aller Abhängigkeiten.
     */
    public importStageFromFile(): void {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (re) => {
                try {
                    const sourceProject: GameProject = JSON.parse(re.target?.result as string);
                    if (!sourceProject.stages || sourceProject.stages.length === 0) {
                        NotificationToast.show('Das gewählte Projekt enthält keine Stages.', 'warning');
                        return;
                    }

                    // Nur importierbare Stages (kein Blueprint)
                    const importableStages = sourceProject.stages.filter(s => s.type !== 'blueprint');
                    if (importableStages.length === 0) {
                        NotificationToast.show('Das Projekt enthält nur eine Blueprint-Stage, die nicht importiert werden kann.', 'warning');
                        return;
                    }

                    // Bei nur einer Stage: direkt importieren
                    if (importableStages.length === 1) {
                        const imported = this.editor.stageManager.importStageFromProject(sourceProject, importableStages[0].id);
                        if (imported) {
                            this.editor.updateStagesMenu();
                            this.editor.updateStageLabel();
                            this.editor.autoSaveToLocalStorage();
                            projectStore.setProject(this.editor.project); // SSoT
                            mediatorService.notifyDataChanged(this.editor.project, 'stage-import');
                            NotificationToast.show(`Stage "${imported.stage.name}" erfolgreich importiert!`, 'success');
                        }
                        return;
                    }

                    // Mehrere Stages: Auswahl-Dialog
                    this.showStageSelectionDialog(sourceProject, importableStages);
                } catch (err) {
                    NotificationToast.show('Fehler beim Lesen der Projektdatei: ' + (err as Error).message, 'error');
                }
            };
            reader.readAsText(file);
        };
        fileInput.click();
    }

    private showStageSelectionDialog(sourceProject: GameProject, stages: StageDefinition[]): void {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:20000;display:flex;align-items:center;justify-content:center;';

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background:#252526; border:1px solid #555; border-radius:8px;
            box-shadow:0 8px 32px rgba(0,0,0,0.6); min-width:380px; max-width:500px;
            color:#ccc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 20px 12px;border-bottom:1px solid #444;font-size:15px;font-weight:600;color:#fff;';
        header.textContent = `📥 Stage importieren — ${sourceProject.meta?.name || 'Externes Projekt'}`;
        dialog.appendChild(header);

        const infoContainer = document.createElement('div');
        infoContainer.style.cssText = 'padding:8px 20px;font-size:12px;color:#888;display:flex;justify-content:space-between;align-items:center;';

        const infoText = document.createElement('span');
        infoText.textContent = `${stages.length} importierbare Stage(s) gefunden. Wähle eine oder mehrere:`;
        infoContainer.appendChild(infoText);

        const selectAllLabel = document.createElement('label');
        selectAllLabel.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;color:#ccc;';
        const selectAllCb = document.createElement('input');
        selectAllCb.type = 'checkbox';
        selectAllCb.checked = false; // By default none are selected
        selectAllCb.style.cssText = 'width:14px;height:14px;accent-color:#4fc3f7;cursor:pointer;';
        const selectAllText = document.createElement('span');
        selectAllText.textContent = 'Alle auswählen';
        selectAllLabel.appendChild(selectAllCb);
        selectAllLabel.appendChild(selectAllText);

        selectAllCb.onchange = (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            checkboxes.forEach(c => c.cb.checked = checked);
            selectAllText.textContent = checked ? 'Keine auswählen' : 'Alle auswählen';
        };
        infoContainer.appendChild(selectAllLabel);

        dialog.appendChild(infoContainer);

        const list = document.createElement('div');
        list.style.cssText = 'padding:8px 20px;max-height:300px;overflow-y:auto;';

        const checkboxes: { id: string, name: string, cb: HTMLInputElement }[] = [];
        for (const stage of stages) {
            const objCount = (stage.objects || []).length;
            const taskCount = (stage.tasks || []).length;
            const actionCount = (stage.actions || []).length;

            const row = document.createElement('label');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 4px;cursor:pointer;border-radius:4px;transition:background 0.15s;';
            row.onmouseenter = () => row.style.background = '#333';
            row.onmouseleave = () => row.style.background = 'transparent';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = false; // Default: unchecked
            cb.style.cssText = 'width:16px;height:16px;accent-color:#4fc3f7;cursor:pointer;';
            row.appendChild(cb);

            const label = document.createElement('span');
            label.style.cssText = 'flex:1;font-size:13px;';
            label.textContent = `🎭 ${stage.name}`;
            row.appendChild(label);

            const details = document.createElement('span');
            details.style.cssText = 'font-size:11px;color:#888;';
            details.textContent = `${objCount} Obj · ${taskCount} Tasks · ${actionCount} Actions`;
            row.appendChild(details);

            list.appendChild(row);
            checkboxes.push({ id: stage.id, name: stage.name, cb });
        }
        dialog.appendChild(list);

        const footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 20px;border-top:1px solid #444;display:flex;gap:8px;justify-content:flex-end;';

        const btnImport = document.createElement('button');
        btnImport.textContent = 'Importieren';
        btnImport.style.cssText = 'padding:6px 14px;border:none;background:#094771;color:#fff;border-radius:4px;cursor:pointer;font-size:13px;';
        btnImport.onmouseenter = () => btnImport.style.background = '#0b5d99';
        btnImport.onmouseleave = () => btnImport.style.background = '#094771';

        const btnCancel = document.createElement('button');
        btnCancel.textContent = 'Abbrechen';
        btnCancel.style.cssText = 'padding:6px 14px;border:1px solid #555;background:#333;color:#ccc;border-radius:4px;cursor:pointer;font-size:13px;';
        btnCancel.onmouseenter = () => btnCancel.style.background = '#444';
        btnCancel.onmouseleave = () => btnCancel.style.background = '#333';

        footer.appendChild(btnImport);
        footer.appendChild(btnCancel);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
        btnCancel.onclick = close;

        const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { close(); window.removeEventListener('keydown', onKey); } };
        window.addEventListener('keydown', onKey);

        btnImport.onclick = () => {
            const selected = checkboxes.filter(c => c.cb.checked);
            if (selected.length === 0) { NotificationToast.show('Keine Stage ausgewählt.', 'warning'); return; }

            const importedNames: string[] = [];
            const importedStages: StageDefinition[] = [];
            const stageIdMap = new Map<string, string>();

            for (const sel of selected) {
                const result = this.editor.stageManager.importStageFromProject(sourceProject, sel.id);
                if (result) {
                    importedNames.push(result.stage.name);
                    importedStages.push(result.stage);
                    stageIdMap.set(result.oldStageId, result.newStageId);
                }
            }

            // navigate_stage-Actions in allen importierten Stages auf neue IDs remappen
            if (stageIdMap.size > 0 && importedStages.length > 1) {
                this.editor.stageManager.remapStageReferences(importedStages, stageIdMap);
            }

            close();
            window.removeEventListener('keydown', onKey);
            this.editor.updateStagesMenu();
            this.editor.updateStageLabel();
            this.editor.autoSaveToLocalStorage();
            projectStore.setProject(this.editor.project); // SSoT immer synchronisieren -> fixed Run-Mode Electron issue
            mediatorService.notifyDataChanged(this.editor.project, 'stage-import');
            NotificationToast.show(`${importedNames.length} Stage(s) importiert: ${importedNames.join(', ')}`, 'success');
        };
    }
}
