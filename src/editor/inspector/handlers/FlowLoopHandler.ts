import { IInspectorHandler, PropertyChangeEvent } from '../types';
import { GameProject } from '../../../model/types';
import { ReactiveRuntime } from '../../../runtime/ReactiveRuntime';

export class FlowLoopHandler implements IInspectorHandler {
    canHandle(obj: any): boolean {
        const type = typeof obj?.getType === 'function' ? obj.getType() : null;
        const name = obj?.constructor?.name;
        return obj && (name === 'FlowLoop' || ['for', 'while', 'repeat'].includes(type));
    }

    getInspectorTemplate(): string | null {
        // null erzwingt die Nutzung von generateUIFromProperties (FlowLoop.getInspectorProperties)
        return null;
    }

    handlePropertyChange(_event: PropertyChangeEvent, _project: GameProject, _runtime: ReactiveRuntime): boolean {
        return false;
    }
}
