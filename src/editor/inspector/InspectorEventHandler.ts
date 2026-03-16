
import { ReactiveRuntime } from '../../runtime/ReactiveRuntime';
import { GameProject } from '../../model/types';
import { InspectorRegistry } from './InspectorRegistry';
import { PropertyChangeEvent } from './types';
import { PropertyHelper } from '../../runtime/PropertyHelper';
import { Logger } from '../../utils/Logger';
import { snapshotManager } from '../services/SnapshotManager';

export class InspectorEventHandler {
    private static logger = Logger.get('InspectorEventHandler', 'Inspector_Update');

    constructor(
        private runtime: ReactiveRuntime,
        private project: GameProject
    ) { }

    public setProject(project: GameProject): void {
        this.project = project;
    }

    /**
     * Handles a change from an inspector input/control
     * @param controlName The 'name' property of the HTML control (e.g. "NameInput")
     * @param newValue The new value from the control
     * @param selectedObject The object being edited
     * @param inspectorDef The original JSON definition for this property (optional)
     */
    public handleControlChange(controlName: string, newValue: any, selectedObject: any, inspectorDef?: any): PropertyChangeEvent | null {
        if (!selectedObject) return null;

        // 1. Resolve property path
        let propertyPath = '';

        // NEW: Prioritize explicit 'property' from JSON definition
        if (inspectorDef?.property) {
            propertyPath = inspectorDef.property;
            if (propertyPath === 'none') {
                return null; // Suppress property update for action-only controls
            }
            InspectorEventHandler.logger.debug(`Using explicit property path: ${propertyPath}`);
        } else {
            // LEGACY FALLBACK: Resolve from control name
            propertyPath = controlName;
            InspectorEventHandler.logger.warn(`Legacy property resolution for control "${controlName}". Please use "property" attribute in template.`);

            // Strip specific suffixes used for differentiation
            if (propertyPath.includes('_')) {
                // Handle event_ prefix specifically
                if (propertyPath.startsWith('event_')) {
                    const parts = propertyPath.split('_');
                    const eventName = parts[1].replace('Select', '').replace('Input', '');
                    propertyPath = `events.${eventName}`;
                } else if (propertyPath.startsWith('usecase_')) {
                    // Specific fix for usecase checkboxes: redirect to 'none' to avoid corrupting selected object
                    return null;
                } else {
                    // Default split behavior: take first part + suffix
                    const parts = propertyPath.split('_');
                    const suffix = (propertyPath.endsWith('Input') ? 'Input' : (propertyPath.endsWith('Select') ? 'Select' : ''));
                    propertyPath = parts[0] + suffix;
                }
            }

            if (propertyPath.endsWith('Input')) {
                propertyPath = propertyPath.slice(0, -5);
            } else if (propertyPath.endsWith('Select')) {
                propertyPath = propertyPath.slice(0, -6);
            } else if (propertyPath.endsWith('Label')) {
                propertyPath = propertyPath.slice(0, -5);
            }

            // --- Specialized mappings ---
            if (propertyPath === 'ActionType') propertyPath = 'type';
            if (propertyPath === 'Aktions-Typ') propertyPath = 'type';
        }

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

        InspectorEventHandler.logger.info(`[INSPECTOR-TRACE] Property change: ${propertyPath} = ${newValue} (was ${oldValue})`);

        // 3.5 Snapshot VOR der Änderung nehmen (Undo-Support)
        snapshotManager.pushSnapshot(this.project, `${propertyPath}: ${oldValue} → ${newValue}`);

        // 4. Delegate to specialized handler if available
        const handler = InspectorRegistry.getHandler(selectedObject);
        let wasHandled = false;

        if (handler) {
            InspectorEventHandler.logger.debug(`[INSPECTOR-TRACE] Delegating to specialized handler: ${handler.constructor.name}`);
            wasHandled = handler.handlePropertyChange(event, this.project, this.runtime);
            InspectorEventHandler.logger.debug(`[INSPECTOR-TRACE] Handler wasHandled=${wasHandled}`);
        }

        // 5. Default behavior if not handled by specialized logic
        if (!wasHandled) {
            InspectorEventHandler.logger.debug(`[INSPECTOR-TRACE] Using default property update logic...`);
            if (oldValue !== newValue) {
                // NEW: Use autoConvert to handle JSON, numbers, booleans from UI inputs
                const convertedValue = PropertyHelper.autoConvert(newValue);
                PropertyHelper.setPropertyValue(selectedObject, propertyPath, convertedValue);

                // ARC-FIX: Ensure original JSON object is also updated for persistence!
                // Priority 1: Direct reference (__rawSource)
                // Priority 2: Lookup via ID/Name (getOriginalObject)
                let originalObj = (selectedObject as any).__rawSource;
                if (!originalObj) {
                    const objectIdentifier = selectedObject?.id || selectedObject?.name;
                    if (objectIdentifier) {
                        originalObj = this.getOriginalObject(objectIdentifier);
                    }
                }

                if (originalObj && originalObj !== selectedObject) {
                    PropertyHelper.setPropertyValue(originalObj, propertyPath, convertedValue);
                    InspectorEventHandler.logger.debug(`Synchronized update with original project JSON object.`);
                }

                InspectorEventHandler.logger.debug(`Applied update to ${propertyPath}:`, convertedValue);
            }
        }

        return event;
    }

    private getOriginalObject(objId: string): any {
        if (!objId || !this.project) return null;

        const matchIdOrName = (item: any) => item.id === objId || item.name === objId;

        let original: any = this.project.stages?.find(matchIdOrName);
        if (original) return original;

        original = this.project.variables?.find(matchIdOrName);
        if (original) return original;

        original = this.project.objects?.find(matchIdOrName);
        if (original) return original;

        if (this.project.stages) {
            for (const stage of this.project.stages) {
                original = stage.variables?.find(matchIdOrName);
                if (original) return original;

                original = stage.objects?.find(matchIdOrName);
                if (original) return original;

                original = stage.tasks?.find(matchIdOrName);
                if (original) return original;

                original = stage.actions?.find(matchIdOrName);
                if (original) return original;
            }
        }

        original = this.project.tasks?.find(matchIdOrName);
        if (original) return original;

        original = this.project.actions?.find(matchIdOrName);
        if (original) return original;

        return null;
    }
}
