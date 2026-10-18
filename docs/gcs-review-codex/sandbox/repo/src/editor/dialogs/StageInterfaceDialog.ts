import type { GameProject, StageDefinition } from '../../model/types';
import { LEARNING_STAGE_INPUTS, StageInterfaceDefinition, validateStageInterface } from '../../model/StageInterface';
import { StageInterfaceService } from '../../runtime/StageInterfaceService';
import { projectStore } from '../../services/ProjectStore';

/** Editor for a stage's public contract; its test panel never runs gameplay tasks. */
export class StageInterfaceDialog {
    show(project: GameProject, selected: StageDefinition, onSave: () => void): void {
        document.getElementById('stage-interface-dialog')?.remove();
        const stage = project.stages?.find(item => item.id === selected.id);
        if (!stage) return;
        const draft: StageInterfaceDefinition = JSON.parse(JSON.stringify(stage.externalInterface || { version: 1, enabled: true, inputs: [], outputs: [] }));
        const taskNames = [...new Set([...(stage.tasks || []), ...(project.tasks || []), ...(project.stages || []).filter(s => s.type === 'blueprint').flatMap(s => s.tasks || [])].map(task => task.name))].sort();
        const overlay = document.createElement('div');
        overlay.id = 'stage-interface-dialog';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:21000;background:#07111bdd;display:grid;place-items:center;padding:24px;color:#e5edf5;font:15px Segoe UI,sans-serif';
        const panel = document.createElement('section');
        panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Externe Stage-Schnittstelle');
        panel.style.cssText = 'background:#142332;border:1px solid #476277;border-radius:14px;padding:24px;width:min(900px,95vw);max-height:88vh;overflow:auto';
        overlay.append(panel);
        const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', parent: HTMLElement = panel): HTMLElementTagNameMap[K] => {
            const node = document.createElement(tag); node.textContent = text; parent.append(node); return node;
        };
        const button = (text: string, parent: HTMLElement, run: () => void) => {
            const node = element('button', text, parent); node.type = 'button';
            node.style.cssText = 'padding:9px 12px;margin:5px 5px 5px 0;background:#25627d;color:white;border:1px solid #6094ac;border-radius:7px;cursor:pointer';
            node.onclick = run; return node;
        };
        element('h2', `Externe Schnittstelle · ${stage.name}`);
        element('p', 'Nur deklarierte Eingänge können Tasks starten. Nutzdaten stehen im Task unter stageEvent.payload; die Kennung unter stageEvent.eventId.');
        const enabledLabel = element('label', 'Schnittstelle aktivieren '), enabled = document.createElement('input');
        enabled.type = 'checkbox'; enabled.checked = draft.enabled; enabled.onchange = () => { draft.enabled = enabled.checked; }; enabledLabel.append(enabled);
        element('h3', 'Eingänge → Tasks');
        const inputList = element('div');
        const controlStyle = 'padding:8px;background:#0c1926;color:#edf5fc;border:1px solid #536d80;border-radius:5px;min-width:0;flex:1';
        const renderInputs = () => {
            inputList.replaceChildren();
            for (const [index, port] of draft.inputs.entries()) {
                const row = element('div', '', inputList); row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:7px 0';
                const name = element('input', '', row); name.value = port.name; name.placeholder = 'Eingangsname'; name.setAttribute('aria-label', 'Eingangsname'); name.style.cssText = controlStyle; name.oninput = () => { port.name = name.value.trim(); };
                const task = element('select', '', row); task.style.cssText = controlStyle; task.setAttribute('aria-label', `Task für ${port.name || 'neuen Eingang'}`);
                for (const value of ['', ...taskNames, ...(port.task && !taskNames.includes(port.task) ? [port.task] : [])]) {
                    const option = document.createElement('option'); option.value = value; option.textContent = value || 'Kein Task (Eingang bleibt ohne Reaktion)'; task.append(option);
                }
                task.value = port.task; task.onchange = () => { port.task = task.value; };
                button('Entfernen', row, () => { draft.inputs.splice(index, 1); renderInputs(); });
            }
        };
        renderInputs();
        button('Eingang hinzufügen', panel, () => { draft.inputs.push({ name: '', task: '' }); renderInputs(); });
        button('Lern-Events ergänzen', panel, () => {
            for (const name of LEARNING_STAGE_INPUTS) if (!draft.inputs.some(input => input.name === name)) draft.inputs.push({ name, task: '' });
            if (!draft.outputs.some(output => output.name === 'SpielweltBereit')) draft.outputs.push({ name: 'SpielweltBereit' });
            renderInputs(); renderOutputs();
        });
        element('h3', 'Ausgänge');
        const outputList = element('div');
        const renderOutputs = () => {
            outputList.replaceChildren();
            for (const [index, port] of draft.outputs.entries()) {
                const row = element('div', '', outputList); row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:7px 0';
                const name = element('input', '', row); name.value = port.name; name.placeholder = 'Ausgangsname'; name.setAttribute('aria-label', 'Ausgangsname'); name.style.cssText = controlStyle; name.oninput = () => { port.name = name.value.trim(); };
                button('Entfernen', row, () => { draft.outputs.splice(index, 1); renderOutputs(); });
            }
        };
        renderOutputs();
        button('Ausgang hinzufügen', panel, () => { draft.outputs.push({ name: '' }); renderOutputs(); });
        element('h3', 'Vertrag testen (ohne Spiellogik)');
        element('p', 'Prüft Eingänge, Task-Zuordnungen und Ausgänge im Entwurf. Das Spiel wird dabei nicht verändert.');
        const testRow = element('div'); testRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
        const eventName = element('input', '', testRow); eventName.placeholder = 'Eventname, z. B. AntwortRichtig'; eventName.setAttribute('aria-label', 'Test-Eventname'); eventName.style.cssText = controlStyle;
        const payload = element('textarea'); payload.value = '{"correctAnswers": 10}'; payload.setAttribute('aria-label', 'Test-Nutzdaten'); payload.style.cssText = `${controlStyle};display:block;width:95%;height:65px;margin:8px 0`;
        const log = element('pre'); log.style.cssText = 'background:#0a1722;padding:12px;white-space:pre-wrap;max-height:150px;overflow:auto';
        let serial = 0;
        const previewStage = { id: stage.id, externalInterface: draft };
        const service = new StageInterfaceService({ stage: () => previewStage, hasTask: name => taskNames.includes(name), runTask: async name => { log.textContent = `Zuordnung geprüft: Task „${name}“ würde ausgeführt.\n`; } });
        service.subscribe(event => { log.textContent = JSON.stringify(event, null, 2); });
        button('Eingang prüfen', testRow, () => {
            try {
                const data = JSON.parse(payload.value); log.textContent = '';
                void service.receive({ name: eventName.value.trim(), eventId: `editor-test-${++serial}`, payload: data }).then(result => { log.textContent += JSON.stringify(result, null, 2); });
            } catch (error) { log.textContent = String(error); }
        });
        button('Ausgang prüfen', testRow, () => { try { service.emit(eventName.value.trim(), JSON.parse(payload.value)); } catch (error) { log.textContent = String(error); } });
        const error = element('p'); error.style.color = '#ffb0a5'; error.setAttribute('role', 'alert');
        const footer = element('div');
        const previous = document.activeElement as HTMLElement | null;
        const close = () => { service.dispose(); overlay.remove(); document.removeEventListener('keydown', escape); previous?.focus(); };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
        button('Speichern', footer, () => {
            const errors = validateStageInterface(draft);
            for (const port of draft.inputs) if (port.task && !taskNames.includes(port.task)) errors.push(`Task „${port.task}“ existiert nicht.`);
            if (errors.length) { error.textContent = errors.join(' '); return; }
            const saved = projectStore.dispatch({ type: 'SET_PROPERTY', target: stage, path: 'externalInterface', value: JSON.parse(JSON.stringify(draft)) });
            if (!saved) { error.textContent = 'Speichern fehlgeschlagen. Bitte das Projekt erneut auswählen.'; return; }
            onSave(); close();
        });
        button('Abbrechen', footer, close);
        document.addEventListener('keydown', escape); document.body.append(overlay); enabled.focus();
    }
}
