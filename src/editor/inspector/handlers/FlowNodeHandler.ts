import { Logger } from '../../../utils/Logger';
import { IInspectorHandler, PropertyChangeEvent } from '../types';
import { GameProject } from '../../../model/types';
import { ReactiveRuntime } from '../../../runtime/ReactiveRuntime';
import { PropertyHelper } from '../../../runtime/PropertyHelper';

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
            const type = (typeof object.getType === 'function') ? object.getType() : 'Task';
            if (type === 'task' || type === 'action' || type === 'data_action') {
                return true;
            }
        }

        // =====================================================================
        // DEFINITIVER FIX: Für ALLE nicht-Name Properties
        //
        // PROBLEM (wiederkehrend): Die Standard-Logik in InspectorEventHandler
        // nutzt getOriginalObject(flowAction.id) um die Projekt-Definition zu
        // finden. Aber FlowActions haben eine UUID als .id (z.B. "el_abc123"),
        // die NIEMALS in project.actions oder stage.actions vorkommt.
        // → getOriginalObject gibt NULL zurück → Änderung geht verloren.
        //
        // FIX: Wir finden die Action-/Task-Definition hier DIREKT per NAME
        // (object.Name) und schreiben die Änderung sofort in die JSON-Daten.
        // =====================================================================

        const type = (typeof object.getType === 'function') ? object.getType() : null;
        const nodeName = object.Name || object.name;
        const convertedValue = PropertyHelper.autoConvert(newValue);

        if (type === 'action' || type === 'data_action') {
            // 1. Finde die Action-Definition im Projekt-JSON per Name
            const actionDef = this.findActionDefinition(nodeName, project);

            if (actionDef) {
                // 2. Schreibe den Wert DIREKT in die Projekt-JSON-Definition
                PropertyHelper.setPropertyValue(actionDef, propertyName, convertedValue);
                FlowNodeHandler.logger.info(
                    `[PERSIST] Action "${nodeName}".${propertyName} = ${JSON.stringify(convertedValue)} ← direkt in project.actions geschrieben`
                );
            } else {
                FlowNodeHandler.logger.warn(
                    `[PERSIST] Action "${nodeName}" nicht in project.actions gefunden! Schreibe auf FlowAction-Instanz (NICHT persistent)`
                );
            }

            // 3. Auch auf dem FlowAction-Objekt setzen (für Live-Preview)
            PropertyHelper.setPropertyValue(object, propertyName, convertedValue);

        } else if (type === 'task') {
            // Task-Definition im Projekt-JSON per Name finden
            const taskDef = this.findTaskDefinition(nodeName, project);

            if (taskDef) {
                PropertyHelper.setPropertyValue(taskDef, propertyName, convertedValue);
                FlowNodeHandler.logger.info(
                    `[PERSIST] Task "${nodeName}".${propertyName} = ${JSON.stringify(convertedValue)} ← direkt in project.tasks geschrieben`
                );
            } else {
                FlowNodeHandler.logger.warn(
                    `[PERSIST] Task "${nodeName}" nicht in project.tasks gefunden!`
                );
            }

            PropertyHelper.setPropertyValue(object, propertyName, convertedValue);

        } else {
            // Fallback für unbekannte Node-Typen
            PropertyHelper.setPropertyValue(object, propertyName, convertedValue);
        }

        // 4. Visuellen Refresh der Flow-Node auslösen
        if (typeof object.setShowDetails === 'function') {
            object.setShowDetails(object.showDetails || true, project);
        }

        // TRUE zurückgeben → die Standard-Logik in InspectorEventHandler wird ÜBERSPRUNGEN.
        // Das ist der entscheidende Punkt: Wir überlassen die Persistenz NICHT mehr dem
        // InspectorEventHandler, weil dessen getOriginalObject() für FlowNodes NICHT FUNKTIONIERT.
        return true;
    }

    /**
     * Sucht die Action-Definition im Projekt-JSON per Name.
     * Durchsucht: Blueprint-Stage → alle Stages → Root-Actions.
     */
    private findActionDefinition(name: string, project: GameProject): any | null {
        if (!name || !project) return null;

        // 1. Blueprint-Stage (primäre Quelle für globale Actions)
        const blueprint = project.stages?.find(s => s.type === 'blueprint');
        if (blueprint?.actions) {
            const action = blueprint.actions.find(a => a.name === name);
            if (action) return action;
        }

        // 2. Alle Stages durchsuchen
        if (project.stages) {
            for (const stage of project.stages) {
                if (stage.type === 'blueprint') continue;
                if (stage.actions) {
                    const action = stage.actions.find(a => a.name === name);
                    if (action) return action;
                }
            }
        }

        // 3. Root-Level Actions (Legacy)
        if (project.actions) {
            const action = project.actions.find(a => a.name === name);
            if (action) return action;
        }

        return null;
    }

    /**
     * Sucht die Task-Definition im Projekt-JSON per Name.
     */
    private findTaskDefinition(name: string, project: GameProject): any | null {
        if (!name || !project) return null;

        const blueprint = project.stages?.find(s => s.type === 'blueprint');
        if (blueprint?.tasks) {
            const task = blueprint.tasks.find(t => t.name === name);
            if (task) return task;
        }

        if (project.stages) {
            for (const stage of project.stages) {
                if (stage.type === 'blueprint') continue;
                if (stage.tasks) {
                    const task = stage.tasks.find(t => t.name === name);
                    if (task) return task;
                }
            }
        }

        if (project.tasks) {
            const task = project.tasks.find(t => t.name === name);
            if (task) return task;
        }

        return null;
    }
}
