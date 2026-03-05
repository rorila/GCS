import { ReactiveRuntime } from '../../runtime/ReactiveRuntime';
import { GameProject } from '../../model/types';
import { InspectorHost } from './InspectorHost';
import { RefactoringManager } from '../RefactoringManager';
import { projectRegistry } from '../../services/ProjectRegistry';
import { PropertyHelper } from '../../runtime/PropertyHelper';
import { UseCaseManager } from '../../utils/UseCaseManager';
import { mediatorService, MediatorEvents } from '../../services/MediatorService';
import { Logger } from '../../utils/Logger';

/**
 * InspectorActionHandler - Handles complex button-driven actions in the Inspector.
 * This class captures the "Action/Command" logic for specialized Inspector buttons.
 */
export class InspectorActionHandler {
    private static logger = Logger.get('InspectorActionHandler', 'Inspector_Update');

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
        InspectorActionHandler.logger.debug(`Executing action: ${action}`);

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
            case 'toggle_usecase':
                this.handleToggleUseCase(buttonDef, value);
                break;
            default:
                InspectorActionHandler.logger.warn(`Unknown action: ${action}`);
        }
    }

    private handleToggleUseCase(def: any, value: any): void {
        const useCaseId = def.useCaseId;
        const active = value === true || value === 'true';
        InspectorActionHandler.logger.info(`Toggling usecase ${useCaseId} to ${active}`);
        UseCaseManager.getInstance().setUseCaseActive(useCaseId, active);
        this.host.update(); // Refresh UI to show updated checkbox state
    }

    private handleSave(): void {
        InspectorActionHandler.logger.info('Save triggered');
        // Usually handled via auto-save, but can be forced here
    }

    private handleDelete(obj: any): void {
        const name = obj.name || obj.id;

        // If host has a deletion handler (usually Editor.ts), let IT handle the confirmation
        if (this.host.onObjectDelete) {
            this.host.onObjectDelete(obj);
            return;
        }

        // Standard prompt if no special handler exists
        if (!confirm(`Möchtest du das Objekt "${name}" wirklich löschen?`)) return;
        InspectorActionHandler.logger.info('Deleting object:', name);

        // Fallback: Identify object type for correct refactoring/deletion
        if (obj.className === 'TTask' || obj.actions !== undefined) {
            RefactoringManager.deleteTask(this.project, name);
        } else if (obj.className === 'TAction') {
            RefactoringManager.deleteAction(this.project, name);
        } else if (obj.className === 'TVariable' || obj.isVariable) {
            RefactoringManager.deleteVariable(this.project, obj.id || obj.name);
        } else {
            this.handleGenericDelete(obj);
        }

        // Notify Mediator explicitly if no host handler was present
        this.notifyChange(obj, 'deletion', null, obj);
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

        InspectorActionHandler.logger.info('Generic delete finished for:', name);
    }

    private async handleBrowseImage(buttonDef: any, obj: any): Promise<void> {
        const propName = buttonDef.property || buttonDef.actionData?.property;
        InspectorActionHandler.logger.info('Opening image browser for:', propName);

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

        InspectorActionHandler.logger.info('Switching flow context to task:', taskName);

        if (this.project && taskName) {
            mediatorService.notify(MediatorEvents.SWITCH_FLOW_CONTEXT, { taskName });
        }
    }

    private async handlePickVariable(buttonDef: any, obj: any): Promise<void> {
        const propName = buttonDef.property || buttonDef.actionData?.property;
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
        const varList = Object.values(variables).map(v => {
            let info = v.name;
            if (v.objectModel) info += ` (Modell: ${v.objectModel})`;
            return `• ${info}`;
        }).join('\n');

        // --- NEU: TDataList (Row-Binding) Prüfung ---
        let repeaterList = '';
        try {
            // Finde parent object (z.B. DataList) im ObjectStore
            const editor = (window as any).editor;
            if (editor && editor.findParentContainer) {
                let currentParent = editor.findParentContainer(obj.id);
                // Walk up checking for DataList
                while (currentParent) {
                    if (currentParent.className === 'TDataList' || currentParent.type === 'DataList') {
                        const dsName = currentParent.dataSource;
                        if (dsName) {
                            // Finde TDataAction mit diesem Namen
                            const action = projectRegistry.getActions('all', false).find(a => (a as any).resultVariable === dsName || a.name === dsName);
                            if (action && (action as any).selectFields) {
                                const fieldsStr = (action as any).selectFields;
                                const fields = fieldsStr === '*' ? ['* (Alle Felder)'] : fieldsStr.split(',').map((f: string) => f.trim()).filter((f: string) => f);
                                repeaterList = fields.map((f: string) => `• row.${f}`).join('\n');
                            }
                            break; // Stop climbing if we hit a DataList
                        }
                    }
                    currentParent = editor.findParentContainer(currentParent.id);
                }
            }
        } catch (e) { console.error('Fehler beim Auflösen der Repeater-Bindings:', e); }

        const promptText = `Variable wählen (aus verfügbaren):\n\n${varList}\n` +
            (repeaterList ? `\n--- Verfügbare Repeater Daten ({row.*}) ---\n${repeaterList}\n` : '') +
            `\n(Tipp: Nutze ".property" für Objekt-Felder, z.B. currentUser.name)`;

        const chosen = prompt(promptText, '');

        if (chosen && chosen.trim()) {
            const varNameInput = chosen.trim();

            // SONDERRFALL: {row.*} Binding (DataList / Repeater Pattern)
            if (varNameInput.startsWith('row.')) {
                let currentVal: any;
                let newValue: any;
                const varToInsert = varNameInput;

                if (index !== undefined && propName === 'params') {
                    const params = PropertyHelper.getPropertyValue(obj, 'params') || [];
                    currentVal = (Array.isArray(params) ? params[index] : '') || '';
                    newValue = (currentVal ? currentVal + ' ' : '') + `\${${varToInsert}}`;

                    const newParams = Array.isArray(params) ? [...params] : [];
                    newParams[index] = newValue;
                    PropertyHelper.setPropertyValue(obj, 'params', newParams);
                    this.notifyChange(obj, 'params', newParams, params);
                } else {
                    currentVal = PropertyHelper.getPropertyValue(obj, propName) || '';
                    newValue = (currentVal ? currentVal + ' ' : '') + `\${${varToInsert}}`;
                    PropertyHelper.setPropertyValue(obj, propName, newValue);
                    this.notifyChange(obj, propName, newValue, currentVal);
                }
                this.host.update(obj);
                return;
            }

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
        const eventName = def.property ? def.property.replace('events.', '') : (def.name || '').substring(6).replace('Select', '').replace('Input', '');
        InspectorActionHandler.logger.info(`Mapping event ${eventName} to task: ${value}`);

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
