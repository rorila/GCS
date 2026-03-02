import { Logger } from '../../../utils/Logger';
import { IInspectorHandler, PropertyChangeEvent } from '../types';
import { GameProject } from '../../../model/types';
import { ReactiveRuntime } from '../../../runtime/ReactiveRuntime';

export class FlowNodeHandler implements IInspectorHandler {
    private static logger = Logger.get('FlowNodeHandler', 'Task_Management');

    canHandle(obj: any): boolean {
        // Check for FlowTask or objects with specific FlowNode characteristics
        if (obj?.constructor?.name === 'FlowTask' ||
            obj?.constructor?.name === 'FlowAction' ||
            obj?.constructor?.name === 'FlowDataAction' ||
            obj?.isFlowNode === true) return true;

        // Check for raw data objects that might be tasks or actions in the editor
        const nodeType = (typeof obj.getType === 'function') ? obj.getType() : null;
        if (nodeType === 'task' || nodeType === 'action' || nodeType === 'data_action') return true;

        return false;
    }

    getInspectorTemplate(obj: any): string | null {
        const type = (typeof obj?.getType === 'function') ? obj.getType() : null;

        if (type === 'data_action') return './inspector_data_action.json';
        if (type === 'task') return './inspector_task.json';
        if (type === 'action') return './inspector_action.json';

        return './inspector_flow.json';
    }

    handlePropertyChange(event: PropertyChangeEvent, project: GameProject, _runtime: ReactiveRuntime): boolean {
        const { propertyName, newValue, oldValue, object } = event;

        if (propertyName === 'name' || propertyName === 'Name') {
            FlowNodeHandler.logger.info(`Renaming detected: "${oldValue}" -> "${newValue}"`);

            // Determine subtype (Task vs Action)
            const type = (typeof object.getType === 'function') ? object.getType() : 'Task';

            if (type === 'task' || type === 'action' || type === 'data_action') {
                // Return true to signal that this is a naming change handled by specialized logic.
                // The central EditorCommandManager will perform the actual project-wide refactoring.
                // WE REMOVED the immediate object.Name update here, because it pollutes the shared
                // data reference, making it impossible for the RefactoringService to find the 
                // node by its "oldName" if it has already been updated to "newValue".
                return true;
            }
        }

        // For other properties, we also want to trigger a visual refresh of the node
        // if it's a FlowAction or similar that has visual detail mapping.
        if (typeof object.setShowDetails === 'function') {
            // Re-render the node on canvas to reflect changes (e.g. new stage target)
            object.setShowDetails(object.showDetails || true, project);
        }

        // Return false to allow default property assignment for other properties
        return false;
    }
}
