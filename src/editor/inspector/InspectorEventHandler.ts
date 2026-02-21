
import { ReactiveRuntime } from '../../runtime/ReactiveRuntime';
import { GameProject } from '../../model/types';
import { InspectorRegistry } from './InspectorRegistry';
import { PropertyChangeEvent } from './types';
import { PropertyHelper } from '../../runtime/PropertyHelper';

export class InspectorEventHandler {
    constructor(
        private runtime: ReactiveRuntime,
        private project: GameProject
    ) { }

    /**
     * Handles a change from an inspector input/control
     * @param controlName The 'name' property of the HTML control (e.g. "NameInput")
     * @param newValue The new value from the control
     * @param selectedObject The object being edited
     * @param inspectorDef The original JSON definition for this property (optional)
     */
    public handleControlChange(controlName: string, newValue: any, selectedObject: any, inspectorDef?: any): PropertyChangeEvent | null {
        if (!selectedObject) return null;

        // 1. Resolve property path from control name (e.g. "NameInput" -> "Name", "ActionTypeSelect" -> "type")
        let propertyPath = controlName;

        // NEW: Strip specific suffixes used for differentiation (e.g. "LeftOperandValue_VarInput" -> "LeftOperandValueInput")
        if (propertyPath.includes('_')) {
            const parts = propertyPath.split('_');
            const suffix = (propertyPath.endsWith('Input') ? 'Input' : (propertyPath.endsWith('Select') ? 'Select' : ''));
            propertyPath = parts[0] + suffix;
        }

        if (propertyPath.endsWith('Input')) {
            propertyPath = propertyPath.slice(0, -5);
        } else if (propertyPath.endsWith('Select')) {
            propertyPath = propertyPath.slice(0, -6);
        } else if (propertyPath.endsWith('Label')) {
            propertyPath = propertyPath.slice(0, -5);
        }

        // --- NEW: Specialized mappings ---
        if (propertyPath === 'ActionType') propertyPath = 'actionType';
        if (propertyPath === 'Aktions-Typ') propertyPath = 'actionType';

        // 2. Capture old value safely
        const oldValue = PropertyHelper.getPropertyValue(selectedObject, propertyPath);

        // 3. Create event object
        const event: PropertyChangeEvent = {
            object: selectedObject,
            propertyName: propertyPath,
            newValue,
            oldValue,
            config: inspectorDef
        };

        console.log(`[InspectorEventHandler] Property change: ${propertyPath} = ${newValue} (was ${oldValue})`);

        // 4. Delegate to specialized handler if available
        const handler = InspectorRegistry.getHandler(selectedObject);
        let wasHandled = false;

        if (handler) {
            wasHandled = handler.handlePropertyChange(event, this.project, this.runtime);
        }

        // 5. Default behavior if not handled by specialized logic
        if (!wasHandled) {
            if (oldValue !== newValue) {
                // NEW: Use autoConvert to handle JSON, numbers, booleans from UI inputs
                const convertedValue = PropertyHelper.autoConvert(newValue);
                PropertyHelper.setPropertyValue(selectedObject, propertyPath, convertedValue);
                console.log(`[InspectorEventHandler] Applied update to ${propertyPath}:`, convertedValue);
            }
        }

        return event;
    }
}
