
import { IInspectorHandler, PropertyChangeEvent } from '../types';
import { GameProject } from '../../../model/types';
import { ReactiveRuntime } from '../../../runtime/ReactiveRuntime';
import { Logger } from '../../../utils/Logger';

const logger = Logger.get('VariableHandler');

export class VariableHandler implements IInspectorHandler {

    canHandle(obj: any): boolean {
        // Check for TVariable components or objects with isVariable flag
        return obj?.isVariable === true || obj?.className?.includes('Variable') || obj?.constructor?.name?.includes('Variable');
    }

    getInspectorTemplate(_obj: any): string | null {
        return './inspector_variable.json';
    }

    getEventsTemplate(_obj: any): string | null {
        return './inspector_variable_events.json';
    }

    handlePropertyChange(event: PropertyChangeEvent, _project: GameProject, _runtime: ReactiveRuntime): boolean {
        const { propertyName, newValue, oldValue, object } = event;

        // Special handling for 'value' changes in variables
        if (propertyName === 'value') {
            logger.info(`[VariableHandler] Value change for variable "${object.name}": ${oldValue} -> ${newValue}`);
            // Logic for triggering onValueChanged events could go here if needed
            // (Currently handled via Proxy/PropertyWatcher in ReactiveRuntime)
        }

        // Special handling for 'type' changes (Morphing)
        if (propertyName === 'type') {
            logger.info(`[VariableHandler] Type change for "${object.name}": ${oldValue} -> ${newValue}`);
            // Morphing logic is currently handled in Editor.ts, but we could migrate it here
        }

        // Return false to let the Inspector apply the property change normally
        return false;
    }
}
