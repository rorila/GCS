import { projectActionRegistry } from '../../services/registry/ActionRegistry';
import { projectVariableRegistry } from '../../services/registry/VariableRegistry';
import { ReactiveRuntime } from '../../runtime/ReactiveRuntime';
import { GameProject } from '../../model/types';
import { InspectorHost } from './InspectorHost';
import { RefactoringManager } from '../RefactoringManager';

import { PropertyHelper } from '../../runtime/PropertyHelper';
import { UseCaseManager } from '../../utils/UseCaseManager';
import { mediatorService, MediatorEvents } from '../../services/MediatorService';
import { Logger } from '../../utils/Logger';
import { VariablePickerDialog } from './VariablePickerDialog';
import { NotificationToast } from '../ui/NotificationToast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { MediaPickerDialog } from './MediaPickerDialog';
import { ImageListEditorDialog } from './ImageListEditorDialog';
import { projectStore } from '../../services/ProjectStore';

const logger = Logger.get('InspectorActionHandler');


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
                await this.handleDelete(selectedObject);
                break;
            case 'browseImage':
                await this.handleBrowseImage(buttonDef, selectedObject);
                break;
            case 'browseAudio':
                await this.handleBrowseAudio(buttonDef, selectedObject);
                break;
            case 'browseVideo':
                await this.handleBrowseVideo(buttonDef, selectedObject);
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
            case 'changeActionType':
                this.handleChangeActionType(selectedObject, value);
                break;
            case 'openImageListEditor':
                await this.handleOpenImageListEditor(selectedObject);
                break;
            case 'openStringMapEditor':
                await this.handleOpenStringMapEditor(selectedObject);
                break;
            case 'openRichTextEditor':
                await this.handleOpenRichTextEditor(selectedObject);
                break;
            default:
                InspectorActionHandler.logger.warn(`Unknown action: ${action}`);
        }
    }

    private handleChangeActionType(selectedObject: any, newType: string): void {
        const oldType = selectedObject.type || 'property';
        const name = selectedObject.Name || selectedObject.name || selectedObject.data?.name;
        InspectorActionHandler.logger.info(`[FLOW-TRACE] handleChangeActionType: Node="${name}", OldType="${oldType}", NewType="${newType}"`);

        // 1. Update logic if it's a FlowNode
        if (selectedObject.id && typeof selectedObject.setShowDetails === 'function') {
            InspectorActionHandler.logger.debug(`[FLOW-TRACE] Forcing visual refresh for node "${name}"`);
            // Force visual refresh of the node
            selectedObject.setShowDetails(true, this.project);
        }

        // 2. Notify system about data change (this will trigger saves and refreshes)
        InspectorActionHandler.logger.debug(`[FLOW-TRACE] Notifying DATA_CHANGED for "${name}"`);
        mediatorService.notifyDataChanged(this.project, 'inspector');

        // 3. Re-render inspector to show new parameters for the new type
        InspectorActionHandler.logger.debug(`[FLOW-TRACE] Updating Inspector Host for "${name}"`);
        this.host.update(selectedObject);
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

    private async handleDelete(obj: any): Promise<void> {
        const name = obj.name || obj.id;

        // If host has a deletion handler (usually Editor.ts), let IT handle the confirmation
        if (this.host.onObjectDelete) {
            this.host.onObjectDelete(obj);
            return;
        }

        // Standard prompt if no special handler exists
        if (!await ConfirmDialog.show(`Möchtest du das Objekt "${name}" wirklich löschen?`)) return;
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
        mediatorService.notifyDataChanged({
            property: 'deletion',
            value: null,
            oldValue: obj,
            object: obj
        }, 'inspector');
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
        InspectorActionHandler.logger.info('Opening image picker for:', propName);

        const chosen = await MediaPickerDialog.show({
            mode: 'image',
            currentValue: obj[propName] || ''
        });
        if (chosen !== null) {
            projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: propName, value: chosen });
            if (propName === 'src' && 'backgroundImage' in obj) {
                projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: 'backgroundImage', value: chosen });
            }
            this.host.update(obj);
        }
    }

    private async handleBrowseAudio(buttonDef: any, obj: any): Promise<void> {
        const propName = buttonDef.property || buttonDef.actionData?.property;
        InspectorActionHandler.logger.info('Opening audio picker for:', propName);

        const chosen = await MediaPickerDialog.show({
            mode: 'audio',
            currentValue: obj[propName] || ''
        });
        if (chosen !== null) {
            projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: propName, value: chosen });
            this.host.update(obj);
        }
    }

    private async handleBrowseVideo(buttonDef: any, obj: any): Promise<void> {
        const propName = buttonDef.property || buttonDef.actionData?.property;
        InspectorActionHandler.logger.info('Opening video picker for:', propName);

        const chosen = await MediaPickerDialog.show({
            mode: 'video',
            currentValue: obj[propName] || ''
        });
        if (chosen !== null) {
            projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: propName, value: chosen });
            this.host.update(obj);
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
        InspectorActionHandler.logger.debug('Opening variable picker for:', propName, index !== undefined ? `at index ${index}` : '');

        // Repeater-Felder ermitteln (falls im DataList-Kontext)
        let repeaterFields: string[] = [];
        try {
            const editor = (window as any).editor;
            if (editor && editor.findParentContainer) {
                let currentParent = editor.findParentContainer(obj.id);
                while (currentParent) {
                    if (currentParent.className === 'TDataList' || currentParent.type === 'DataList') {
                        const dsName = currentParent.dataSource;
                        if (dsName) {
                            const action = projectActionRegistry.getActions('all', false).find(a => (a as any).resultVariable === dsName || a.name === dsName);
                            if (action && (action as any).selectFields) {
                                const fieldsStr = (action as any).selectFields;
                                repeaterFields = fieldsStr === '*' ? ['*'] : fieldsStr.split(',').map((f: string) => f.trim()).filter((f: string) => f);
                            }
                            break;
                        }
                    }
                    currentParent = editor.findParentContainer(currentParent.id);
                }
            }
        } catch (e) { logger.error('Fehler beim Auflösen der Repeater-Bindings:', e); }

        // Dialog anzeigen
        const chosen = await VariablePickerDialog.show({
            objectId: obj.id || obj.name,
            repeaterFields
        });

        if (!chosen || !chosen.trim()) return;

        const varNameInput = chosen.trim();

        // Wert setzen (row.* oder normale Variable)
        const isRepeater = varNameInput.startsWith('row.');
        const variables = projectVariableRegistry.getVariables({
            taskName: (obj as any).taskName,
            actionId: (obj as any).id || (obj as any).name
        });

        // Validierung (nur für nicht-Repeater)
        if (!isRepeater && !varNameInput.includes('.')) {
            const baseVarName = varNameInput.split('.')[0];
            const baseVar = variables.find(v => v.name === baseVarName);
            if (!baseVar) {
                NotificationToast.show(`Basis-Variable "${baseVarName}" wurde nicht gefunden.`);
                return;
            }
        }

        // Wert in das Objekt schreiben
        let newValue: any;
        const propType = buttonDef.propertyType; // newly added!

        if (index !== undefined && propName === 'params') {
            const params = PropertyHelper.getPropertyValue(obj, 'params') || [];
            newValue = propType === 'variable' ? varNameInput : `\${${varNameInput}}`;
            const newParams = Array.isArray(params) ? [...params] : [];
            newParams[index] = newValue;
            projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: 'params', value: newParams });
        } else {
            if (propType === 'variable') {
                newValue = varNameInput;
            } else {
                newValue = `\${${varNameInput}}`;
            }
            projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: propName, value: newValue });
        }

        // FIX: Sync original action/task definition in project JSON for persistence.
        // FlowAction nodes are proxies – the serializer reads from the original definition
        // in stage.actions[]. Use the same lookup as FlowNodeHandler.handlePropertyChange.
        const nodeName = obj.Name || obj.name;
        const nodeType = obj.type || obj.nodeType;
        const isFlowNode = obj.isFlowNode === true || typeof obj.setShowDetails === 'function';

        if (isFlowNode && nodeName) {
            // Find the REAL action/task definition via SSoT registries (same as FlowNodeHandler)
            if (nodeType === 'action' || nodeType === 'data_action' || nodeType === 'http' || nodeType === 'move_to' ||
                projectActionRegistry.findOriginalAction(nodeName)) {
                const actionDef = projectActionRegistry.findOriginalAction(nodeName);
                if (actionDef) {
                    if (index !== undefined && propName === 'params') {
                        PropertyHelper.setPropertyValue(actionDef, 'params', PropertyHelper.getPropertyValue(obj, 'params'));
                    } else {
                        PropertyHelper.setPropertyValue(actionDef, propName, newValue);
                    }
                    logger.info(`[pickVariable] Synced original action "${nodeName}".${propName} = ${newValue}`);
                } else {
                    logger.warn(`[pickVariable] Original action "${nodeName}" NOT FOUND in SSoT registry!`);
                }
            }
        } else {
            // Non-FlowNode: try __rawSource or project-level lookup
            const objId = obj?.id || obj?.name;
            const originalObj = (obj as any).__rawSource || this.findOriginalAction(objId);
            if (originalObj && originalObj !== obj) {
                if (index !== undefined && propName === 'params') {
                    projectStore.dispatch({ type: 'SET_PROPERTY', target: originalObj, path: 'params', value: PropertyHelper.getPropertyValue(obj, 'params') });
                } else {
                    projectStore.dispatch({ type: 'SET_PROPERTY', target: originalObj, path: propName, value: newValue });
                }
                logger.info(`[pickVariable] Synced original object "${objId}".${propName} = ${newValue}`);
            }
        }

        // Notify data change for auto-save
        mediatorService.notifyDataChanged({ property: propName, value: newValue, object: obj }, 'inspector');

        this.host.update(obj);
    }


    /**
     * Finds the original object/action/variable definition in the project JSON data.
     */
    private findOriginalAction(objId: string): any {
        if (!objId || !this.project) return null;
        const match = (item: any) => item.id === objId || item.name === objId;

        // Global level
        let original: any = this.project.actions?.find(match);
        if (original) return original;
        original = this.project.variables?.find(match);
        if (original) return original;
        original = (this.project as any).objects?.find(match);
        if (original) return original;
        original = this.project.tasks?.find(match);
        if (original) return original;

        // Stage level
        if (this.project.stages) {
            for (const stage of this.project.stages) {
                original = stage.actions?.find(match);
                if (original) return original;
                original = stage.variables?.find(match);
                if (original) return original;
                original = stage.objects?.find(match);
                if (original) return original;
                original = stage.tasks?.find(match);
                if (original) return original;
            }
        }
        return null;
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
            projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: propName, value: newValue });
            this.host.update(obj);
        }
    }

    private handleMapEvent(def: any, obj: any, value: string): void {
        const eventName = def.property ? def.property.replace('events.', '') : (def.name || '').substring(6).replace('Select', '').replace('Input', '');
        InspectorActionHandler.logger.info(`Mapping event ${eventName} to task: ${value}`);

        const oldVal = obj.events ? obj.events[eventName] : undefined;

        if (oldVal !== value) {
            projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: `events.${eventName}`, value });
            this.host.update(obj);
        }
    }

    private async handleOpenStringMapEditor(obj: any): Promise<void> {
        InspectorActionHandler.logger.info('Opening StringMap Editor for:', obj.name);

        const { StringMapEditorDialog } = await import('./StringMapEditorDialog');
        const result = await StringMapEditorDialog.show(
            obj.entries || {},
            obj.name || 'StringMap'
        );

        if (result !== null) {
            projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: 'entries', value: result });
            this.host.update(obj);
        }
    }

    private async handleOpenImageListEditor(obj: any): Promise<void> {
        InspectorActionHandler.logger.info('Opening ImageList Editor for:', obj.name);

        const result = await ImageListEditorDialog.show({
            src: obj.backgroundImage || obj.src || '',
            imageCountHorizontal: obj.imageCountHorizontal || 1,
            imageCountVertical: obj.imageCountVertical || 1,
            currentImageNumber: obj.currentImageNumber || 0,
        }, obj.name || 'ImageList');

        if (result) {
            projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: 'imageCountHorizontal', value: result.imageCountHorizontal });
            projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: 'imageCountVertical', value: result.imageCountVertical });
            projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: 'currentImageNumber', value: result.currentImageNumber });
            if (result.src !== (obj.backgroundImage || obj.src || '')) {
                projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: 'src', value: result.src });
                projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: 'backgroundImage', value: result.src });
            }
            this.host.update(obj);
        }
    }

    private async handleOpenRichTextEditor(obj: any): Promise<void> {
        InspectorActionHandler.logger.info('Opening RichText Editor for:', obj.name);
        // Dynamisch importieren
        const { RichTextEditorDialog } = await import('./RichTextEditorDialog');
        
        // Entweder htmlContent oder leeres Grundgerüst
        const currentHtml = obj.htmlContent || '';
        
        const result = await RichTextEditorDialog.show(currentHtml);
        
        if (result !== null) {
            projectStore.dispatch({ type: 'SET_PROPERTY', target: obj, path: 'htmlContent', value: result });
            this.host.update(obj);
        }
    }
}
