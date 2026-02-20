
import { IInspectorHandler, PropertyChangeEvent } from '../types';
import { GameProject } from '../../../model/types';
import { ReactiveRuntime } from '../../../runtime/ReactiveRuntime';

export class FlowConditionHandler implements IInspectorHandler {

    canHandle(obj: any): boolean {
        const isCondition = obj && (
            obj.constructor?.name === 'FlowCondition' ||
            (typeof obj.getType === 'function' && obj.getType() === 'Condition')
        );
        if (isCondition) console.log('[FlowConditionHandler] Identified Condition node!');
        return !!isCondition;
    }

    getInspectorTemplate(_obj: any): string | null {
        console.log('[FlowConditionHandler] Loading ./inspector_condition.json');
        return './inspector_condition.json';
    }

    handlePropertyChange(event: PropertyChangeEvent, _project: GameProject, _runtime: ReactiveRuntime): boolean {
        const { propertyName, object } = event;

        // If a type or value changes, we might need to refresh the whole property list 
        // to show/hide conditional fields.
        if (propertyName.includes('Type') || propertyName.includes('Value') || propertyName === 'Operator') {
            // Let the InspectorHost know it should refresh the UI definitions
            // This is usually done by returning false and letting the host call update()
            // but we can also trigger a visual update on the node itself.
            if (typeof object.updateText === 'function') {
                object.updateText();
            }
        }

        // Return false to allow default property assignment
        return false;
    }
}
