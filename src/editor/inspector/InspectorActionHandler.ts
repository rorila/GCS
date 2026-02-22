import { ReactiveRuntime } from '../../runtime/ReactiveRuntime';
import { GameProject } from '../../model/types';
import { InspectorHost } from './InspectorHost';
import { TaskEditor } from '../TaskEditor';
import { RefactoringManager } from '../RefactoringManager';
import { projectRegistry } from '../../services/ProjectRegistry';
import { PropertyHelper } from '../../runtime/PropertyHelper';
import { mediatorService } from '../../services/MediatorService';

/**
 * InspectorActionHandler - Handles complex button-driven actions in the Inspector.
 * This class captures the "Action/Command" logic for specialized Inspector buttons.
 */
export class InspectorActionHandler {
    constructor(
        _runtime: ReactiveRuntime,
        private project: GameProject,
        private host: InspectorHost
    ) { }

    /**
     * Dispatches button actions to specialized methods
     */
    public async handleAction(buttonDef: any, selectedObject: any, value?: any): Promise<void> {
        const action = buttonDef.action;
        console.log(`[InspectorActionHandler] Executing action: ${action}`);

        switch (action) {
            case 'save':
                this.handleSave();
                break;
            case 'delete':
                this.handleDelete(selectedObject);
                break;
            case 'browseImage':
                await this.handleBrowseImage(buttonDef, selectedObject);
                break;
            case 'openTaskEditor':
                this.handleOpenTaskEditor(buttonDef, selectedObject);
                break;
            case 'pickVariable':
                await this.handlePickVariable(buttonDef, selectedObject);
                break;
            case 'appendField':
                this.handleAppendField(buttonDef, selectedObject, value);
                break;
            case 'map_event':
                this.handleMapEvent(buttonDef, selectedObject, value);
                break;
            default:
                console.warn(`[InspectorActionHandler] Unknown action: ${action}`);
        }
    }

    private handleSave(): void {
        console.log('[InspectorActionHandler] Save triggered');
        // Usually handled via auto-save, but can be forced here
    }

    private handleDelete(obj: any): void {
        const name = obj.name || obj.id;
        if (!confirm(`Möchtest du das Objekt "${name}" wirklich löschen?`)) return;

        console.log('[InspectorActionHandler] Deleting object:', name);

        // Identify object type for correct refactoring/deletion
        if (obj.className === 'TTask' || obj.actions !== undefined) {
            RefactoringManager.deleteTask(this.project, name);
        } else if (obj.className === 'TAction') {
            RefactoringManager.deleteAction(this.project, name);
        } else {
            this.handleGenericDelete(obj);
        }
    }

    private handleGenericDelete(obj: any): void {
        const name = obj.name || obj.id;
        // Generic logic: Remove from stage children
        const stage = this.project.stages?.find(s => s.id === this.project.activeStageId);
        if (stage && stage.objects) {
            stage.objects = stage.objects.filter(o => o.name !== name && o.id !== name);
        }

        // Also remove from global objects if present
        if (this.project.objects) {
            this.project.objects = this.project.objects.filter(o => o.name !== name && o.id !== name);
        }

        console.log('[InspectorActionHandler] Generic delete finished for:', name);
    }

    private async handleBrowseImage(buttonDef: any, obj: any): Promise<void> {
        const propName = buttonDef.actionData?.property;
        console.log('[InspectorActionHandler] Opening image browser for:', propName);

        // Simple prompt for now, will integrate with DialogManager in next phase
        const newPath = prompt('Bildpfad eingeben:', obj[propName] || '');
        if (newPath !== null) {
            obj[propName] = newPath;
            if (propName === 'src' && 'backgroundImage' in obj) {
                obj.backgroundImage = newPath;
            }
        }
    }

    private handleOpenTaskEditor(buttonDef: any, obj: any): void {
        const eventKey = buttonDef.eventKey;
        let taskName = '';

        if (eventKey && obj.events) {
            taskName = obj.events[eventKey] || '';
        } else if (buttonDef.taskName) {
            taskName = buttonDef.taskName;
        }

        console.log('[InspectorActionHandler] Opening task editor for task:', taskName);

        if (this.project) {
            new TaskEditor(this.project, taskName, () => {
                console.log('[InspectorActionHandler] Task saved');
            });
        }
    }

    private async handlePickVariable(buttonDef: any, obj: any): Promise<void> {
        const propName = buttonDef.actionData?.property;
        const index = buttonDef.actionData?.index;
        console.log('[InspectorActionHandler] Opening variable picker for:', propName, index !== undefined ? `at index ${index}` : '');

        // Get variables from Registry (matches ContextBuilder logic)
        const variables = projectRegistry.getVariables({
            taskName: (obj as any).taskName,
            actionId: (obj as any).id || (obj as any).name
        });

        if (variables.length === 0) {
            alert('Keine Variablen verfügbar.');
            return;
        }

        // Variablennamen mit Modell-Info aufbereiten
        const varList = variables.map(v => {
            let info = v.name;
            if (v.objectModel) info += ` (Modell: ${v.objectModel})`;
            return `• ${info}`;
        }).join('\n');

        const chosen = prompt(`Variable wählen (aus verfügbaren):\n\n${varList}\n\n(Tipp: Nutze ".property" für Objekt-Felder, z.B. currentUser.name)`, '');

        if (chosen && chosen.trim()) {
            const varNameInput = chosen.trim();
            // Basis-Name für Validierung extrahieren (alles vor dem ersten Punkt)
            const baseVarName = varNameInput.split('.')[0];
            const baseVar = variables.find(v => v.name === baseVarName);

            if (baseVar) {
                let currentVal: any;
                let newValue: any;
                const varToInsert = varNameInput;

                if (index !== undefined && propName === 'params') {
                    // Update specific parameter in array (e.g. for call_method)
                    const params = PropertyHelper.getPropertyValue(obj, 'params') || [];
                    currentVal = (Array.isArray(params) ? params[index] : '') || '';
                    newValue = (currentVal ? currentVal + ' ' : '') + `\${${varToInsert}}`;

                    const newParams = Array.isArray(params) ? [...params] : [];
                    newParams[index] = newValue;
                    PropertyHelper.setPropertyValue(obj, 'params', newParams);
                    this.notifyChange(obj, 'params', newParams, params);
                } else {
                    // Standard property update
                    currentVal = PropertyHelper.getPropertyValue(obj, propName) || '';
                    newValue = (currentVal ? currentVal + ' ' : '') + `\${${varToInsert}}`;

                    PropertyHelper.setPropertyValue(obj, propName, newValue);
                    this.notifyChange(obj, propName, newValue, currentVal);
                }

                // Refresh host
                this.host.update(obj);
            } else {
                alert(`Basis-Variable "${baseVarName}" wurde nicht gefunden.`);
            }
        }
    }

    private handleAppendField(_buttonDef: any, obj: any, value: string): void {
        if (!value) return;

        const propName = 'selectFields';
        const currentVal = String(PropertyHelper.getPropertyValue(obj, propName) || '').trim();
        let newValue = currentVal;

        if (value === '*') {
            newValue = '*';
        } else if (currentVal === '*' || !currentVal) {
            newValue = value;
        } else {
            const fields = currentVal.split(',').map(s => s.trim()).filter(s => s);
            if (!fields.includes(value)) {
                fields.push(value);
                newValue = fields.join(', ');
            }
        }

        if (newValue !== currentVal) {
            PropertyHelper.setPropertyValue(obj, propName, newValue);
            this.notifyChange(obj, propName, newValue, currentVal);
            this.host.update(obj);
        }
    }

    private handleMapEvent(def: any, obj: any, value: string): void {
        const controlName = def.name || '';
        if (!controlName.startsWith('event_')) return;

        const eventName = controlName.substring(6).replace('Select', '').replace('Input', '');
        console.log(`[InspectorActionHandler] Mapping event ${eventName} to task: ${value}`);

        if (!obj.events) obj.events = {};
        const oldVal = obj.events[eventName];
        obj.events[eventName] = value;

        if (oldVal !== value) {
            this.notifyChange(obj, `events.${eventName}`, value, oldVal);
            this.host.update(obj);
        }
    }

    private notifyChange(obj: any, prop: string, val: any, old: any) {
        mediatorService.notifyDataChanged({
            property: prop,
            value: val,
            oldValue: old,
            object: obj
        }, 'inspector');
    }
}
