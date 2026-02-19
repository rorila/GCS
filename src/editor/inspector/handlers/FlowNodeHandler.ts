
import { IInspectorHandler, PropertyChangeEvent } from '../types';
import { GameProject } from '../../../model/types';
import { ReactiveRuntime } from '../../../runtime/ReactiveRuntime';
import { RefactoringManager } from '../../RefactoringManager';

export class FlowNodeHandler implements IInspectorHandler {

    canHandle(obj: any): boolean {
        // Check for FlowTask or objects with specific FlowNode characteristics
        if (obj?.constructor?.name === 'FlowTask' ||
            obj?.constructor?.name === 'FlowAction' ||
            obj?.constructor?.name === 'FlowDataAction' ||
            obj?.isFlowNode === true) return true;

        // Check for raw data objects that might be tasks or actions in the editor
        const getType = (typeof obj?.getType === 'function') ? obj.getType() : null;
        if (getType === 'Task' || getType === 'Action' || getType === 'DataAction') return true;

        return false;
    }

    getInspectorTemplate(obj: any): string | null {
        const type = (typeof obj?.getType === 'function') ? obj.getType() : null;

        if (type === 'DataAction') return './inspector_data_action.json';
        if (type === 'Task') return './inspector_task.json';
        if (type === 'Action') return './inspector_action.json';

        return './inspector_flow.json';
    }

    handlePropertyChange(event: PropertyChangeEvent, project: GameProject, _runtime: ReactiveRuntime): boolean {
        const { propertyName, newValue, oldValue, object } = event;

        if (propertyName === 'name' || propertyName === 'Name') {
            console.log(`[FlowNodeHandler] Renaming detected: "${oldValue}" -> "${newValue}"`);

            // Determine subtype (Task vs Action)
            const type = (typeof object.getType === 'function') ? object.getType() : 'Task';

            if (type === 'Task') {
                RefactoringManager.renameTask(project, oldValue, newValue);
                // Ensure local object is updated via its setter
                if (object.Name !== newValue) object.Name = newValue;
                return true;
            } else if (type === 'Action') {
                RefactoringManager.renameAction(project, oldValue, newValue);
                // Ensure local object is updated via its setter
                if (object.Name !== newValue) object.Name = newValue;
                return true;
            }
        }

        // Return false to allow default property assignment for other properties
        return false;
    }
}
