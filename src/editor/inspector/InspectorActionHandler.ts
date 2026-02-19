import { ReactiveRuntime } from '../../runtime/ReactiveRuntime';
import { GameProject } from '../../model/types';
import { InspectorHost } from './InspectorHost';
import { TaskEditor } from '../TaskEditor';
import { RefactoringManager } from '../RefactoringManager';

/**
 * InspectorActionHandler - Handles complex button-driven actions in the Inspector.
 * This class captures the "Action/Command" logic for specialized Inspector buttons.
 */
export class InspectorActionHandler {
    constructor(
        _runtime: ReactiveRuntime,
        private project: GameProject,
        _host: InspectorHost
    ) { }

    /**
     * Dispatches button actions to specialized methods
     */
    public async handleAction(buttonDef: any, selectedObject: any): Promise<void> {
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
}
