
import { IInspectorHandler, PropertyChangeEvent } from '../types';
import { GameProject } from '../../../model/types';
import { ReactiveRuntime } from '../../../runtime/ReactiveRuntime';

export class GameObjectHandler implements IInspectorHandler {

    canHandle(obj: any): boolean {
        // Handle typical game objects (has style, name, etc. and is not a flow node or variable)
        return obj && typeof obj === 'object' && 'name' in obj && 'style' in obj &&
            !obj.isVariable && !obj.isFlowNode;
    }

    handlePropertyChange(event: PropertyChangeEvent, _project: GameProject, _runtime: ReactiveRuntime): boolean {
        const { propertyName: _propertyName, newValue: _newValue, oldValue: _oldValue, object: _object } = event;

        // Custom logic for game objects could go here (e.g. updating physics if a dimension changes)

        // Return false to let the Inspector apply the change normally
        return false;
    }
}
