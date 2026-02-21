
import { IInspectorHandler, PropertyChangeEvent } from '../types';
import { GameProject } from '../../../model/types';
import { ReactiveRuntime } from '../../../runtime/ReactiveRuntime';

export class StageHandler implements IInspectorHandler {

    canHandle(obj: any): boolean {
        // Stages have an id, type and objects array but no className (usually)
        // In the editor, when a stage is passed to the inspector, it's the StageDefinition
        return obj && typeof obj === 'object' && obj.id && obj.type && Array.isArray(obj.objects) && !obj.className;
    }

    getInspectorTemplate(_obj: any): string | null {
        return './inspector_stage.json';
    }

    getEventsTemplate(_obj: any): string | null {
        return './inspector_stage_events.json';
    }

    handlePropertyChange(event: PropertyChangeEvent, _project: GameProject, _runtime: ReactiveRuntime): boolean {
        const { propertyName, newValue, object } = event;

        console.log(`[StageHandler] Property change for stage "${object.name || object.id}": ${propertyName} = ${newValue}`);

        // Handle event changes specially if they are prefixed with 'events.'
        // (The Template Loader might pass them as 'events.onEnter' etc.)
        if (propertyName.startsWith('on')) {
            if (!object.events) object.events = {};
            object.events[propertyName] = newValue;

            // Sync to legacy Tasks object if needed (GameRuntime uses both)
            if (!object.Tasks) object.Tasks = {};
            object.Tasks[propertyName] = newValue;

            return true;
        }

        return false;
    }
}
