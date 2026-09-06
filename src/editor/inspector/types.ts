
import { ReactiveRuntime } from '../../runtime/ReactiveRuntime';
import { GameProject } from '../../model/types';

// ─────────────────────────────────────────────
// Re-Exports aus dem Model-Layer (CleanCode Phase 2, Slice 2.1)
// Diese Typen leben jetzt in src/model/InspectorTypes.ts,
// werden aber hier re-exportiert für Abwärtskompatibilität.
// ─────────────────────────────────────────────
export type { TPropertyDef, InspectorSection, IInspectable } from '../../model/InspectorTypes';
export { isInspectable } from '../../model/InspectorTypes';

/**
 * Interface for a property change event
 */
export interface PropertyChangeEvent {
    object: any;
    propertyName: string;
    newValue: any;
    oldValue: any;
    config?: any; // Original inspector UI object (from JSON)
}

/**
 * Interface for specialized Inspector handlers
 */
export interface IInspectorHandler {
    /**
     * Checks if this handler can handle the given object
     */
    canHandle(obj: any): boolean;

    /**
     * Handles a property change delegation
     * @returns boolean true if the change was handled, false otherwise
     */
    handlePropertyChange(event: PropertyChangeEvent, project: GameProject, runtime: ReactiveRuntime): boolean;

    /**
     * Optional: Returns specialized inspector properties for this component
     */
    getInspectorProperties?(obj: any): any[];

    /**
     * Optional: Returns a custom template file path for this component
     */
    getInspectorTemplate?(obj: any): string | null;

    /**
     * Optional: Returns a custom events template file path for this component
     */
    getEventsTemplate?(obj: any): string | null;
}

