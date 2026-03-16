import { Logger } from '../../../utils/Logger';
import { IInspectorHandler, PropertyChangeEvent } from '../types';
import { GameProject } from '../../../model/types';
import { ReactiveRuntime } from '../../../runtime/ReactiveRuntime';
import { PropertyHelper } from '../../../runtime/PropertyHelper';
import { projectRegistry } from '../../../services/ProjectRegistry';
import { RefactoringManager } from '../../RefactoringManager';

import { SyncValidator } from '../../services/SyncValidator';

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

            // Handle renaming via RefactoringManager to ensure SSOT consistency
            if (oldValue && newValue !== oldValue) {
                const currentProject = projectRegistry.getProject(); // Get the active project
                if (currentProject) {
                    const nodeType = type?.toLowerCase();

                    if (nodeType === 'task') {
                        FlowNodeHandler.logger.info(`Triggere Task-Refactoring: ${oldValue} -> ${newValue}`);
                        RefactoringManager.renameTask(currentProject, oldValue, newValue);
                        // KEIN notifyDataChanged hier! RefactoringManager feuert TASK_RENAMED,
                        // was den FlowEditor gezielt aktualisiert (renameContext).
                        // notifyDataChanged würde einen destruktiven Canvas-Rebuild triggern.
                    } else if (['action', 'dataaction', 'data_action'].includes(nodeType)) {
                        FlowNodeHandler.logger.info(`Triggere Action-Refactoring: ${oldValue} -> ${newValue}`);
                        RefactoringManager.renameAction(currentProject, oldValue, newValue);
                        // KEIN notifyDataChanged hier! Die visuelle Aktualisierung erfolgt
                        // über PropertyHelper.setPropertyValue weiter unten.
                    }
                } else {
                    FlowNodeHandler.logger.error("Refactoring fehlgeschlagen: Kein aktives Projekt gefunden.");
                }
            }
            // The original logic for name changes just returned true.
            // We still need to update the object's name for immediate display.
            PropertyHelper.setPropertyValue(object, propertyName, newValue);
            return true; // Indicate that the change was handled
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
        const nodeId = object.id;
        const convertedValue = PropertyHelper.autoConvert(newValue);

        FlowNodeHandler.logger.info(`[FLOW-CHANGE-TRACE] Node="${nodeName}", ID="${nodeId}", Type="${type}", Prop="${propertyName}", Value="${convertedValue}"`);

        if (type === 'action' || type === 'data_action' || type === 'http') {
            FlowNodeHandler.logger.debug(`[FLOW-CHANGE-TRACE] Searching Action Definition for "${nodeName}" (ID: ${nodeId})...`);
            let actionDef = this.findActionDefinition(nodeName, project);

            if (!actionDef && nodeId) {
                FlowNodeHandler.logger.debug(`[FLOW-CHANGE-TRACE] Not found in index, searching in FlowCharts for ID "${nodeId}"...`);
                actionDef = this.findActionInFlowCharts(nodeId, nodeName, project);
            }

            if (actionDef) {
                FlowNodeHandler.logger.info(`[FLOW-CHANGE-TRACE] FOUND Action Definition for "${nodeName}". Original Object Type: ${(actionDef as any).type}`);
                PropertyHelper.setPropertyValue(actionDef, propertyName, convertedValue);

                // Extra Log für Typsynchronität
                if (propertyName === 'type') {
                    FlowNodeHandler.logger.info(`[FLOW-CHANGE-TRACE] CRITICAL: Changed type from ${(actionDef as any).type} to ${convertedValue}`);
                }
            } else {
                FlowNodeHandler.logger.error(`[FLOW-CHANGE-TRACE] Action Definition NOT FOUND for "${nodeName}" (ID: ${nodeId})! Persistenz wird fehlschlagen.`);
            }

            PropertyHelper.setPropertyValue(object, propertyName, convertedValue);

        } else if (type === 'task') {
            FlowNodeHandler.logger.debug(`[FLOW-CHANGE-TRACE] Searching Task Definition for "${nodeName}"...`);
            const taskDef = this.findTaskDefinition(nodeName, project);

            if (taskDef) {
                FlowNodeHandler.logger.info(`[FLOW-CHANGE-TRACE] FOUND Task Definition for "${nodeName}".`);
                PropertyHelper.setPropertyValue(taskDef, propertyName, convertedValue);
            } else {
                FlowNodeHandler.logger.error(`[FLOW-CHANGE-TRACE] Task Definition NOT FOUND for "${nodeName}"!`);
            }

            PropertyHelper.setPropertyValue(object, propertyName, convertedValue);

        } else {
            FlowNodeHandler.logger.debug(`[FLOW-CHANGE-TRACE] Generic update for type "${type}".`);
            PropertyHelper.setPropertyValue(object, propertyName, convertedValue);
        }

        if (typeof object.setShowDetails === 'function') {
            FlowNodeHandler.logger.debug(`[FLOW-CHANGE-TRACE] Refreshing node view...`);
            object.setShowDetails(object.showDetails || true, project);
        }

        // Spot-Validierung: Prüfe ob die Änderung korrekt persistiert wurde
        SyncValidator.validateSinglePropertySync(object, propertyName, project);

        return true;
    }

    /**
     * Sucht die Action-Definition im Projekt-JSON.
     * Nutzt primär die ProjectRegistry als Index für Performance und Robustheit.
     */
    private findActionDefinition(name: string, _project: GameProject): any | null {
        if (!name) return null;

        FlowNodeHandler.logger.info(`[FLOW-LOOKUP] Searching Original Action: "${name}"`);

        // SSoT-Lookup via ProjectRegistry: Findet die ECHTE Instanz im Projekt-Modell
        const originalAction = projectRegistry.findOriginalAction(name);

        if (originalAction) {
            FlowNodeHandler.logger.info(`[FLOW-LOOKUP] SSoT MATCH FOUND: ${originalAction.name}`);
            return originalAction;
        }

        FlowNodeHandler.logger.warn(`[FLOW-LOOKUP] FAILED to find original action "${name}" in SSoT.`);
        return null;
    }

    /**
     * Sucht die Task-Definition im Projekt-JSON.
     */
    private findTaskDefinition(name: string, _project: GameProject): any | null {
        if (!name) return null;

        FlowNodeHandler.logger.info(`[FLOW-LOOKUP] Searching Original Task: "${name}"`);

        // SSoT-Lookup via ProjectRegistry: Findet die ECHTE Instanz im Projekt-Modell
        const originalTask = projectRegistry.findOriginalTask(name);

        if (originalTask) {
            FlowNodeHandler.logger.info(`[FLOW-LOOKUP] SSoT MATCH FOUND (Task): ${originalTask.name}`);
            return originalTask;
        }

        FlowNodeHandler.logger.warn(`[FLOW-LOOKUP] FAILED to find task "${name}" in SSoT.`);
        return null;
    }

    /**
     * Sucht eine Action-Definition innerhalb aller FlowCharts im Projekt.
     * Dies ist wichtig für "unlinked" / lokale Actions in Diagrammen.
     */
    private findActionInFlowCharts(id: string, name: string, project: GameProject): any | null {
        if (!project) return null;

        const targetId = String(id).trim();
        const targetName = String(name).trim().toLowerCase();

        const match = (el: any) => {
            if (!el) return false;

            // 1. ID Match (höchste Priorität)
            const elId = String(el.id).trim();
            if (elId === targetId) return true;

            // 2. Broad-Field Name Match (orientiert an ActionRefactoringService)
            const check = (val: any) => val && String(val).trim().toLowerCase() === targetName;

            return check(el.data?.actionName) ||
                check(el.data?.name) ||
                check(el.name) ||
                check(el.properties?.name) ||
                check(el.properties?.text);
        };

        const searchInChartElements = (elements: any[]): any | null => {
            if (!elements || !Array.isArray(elements)) return null;
            const el = elements.find(e => match(e));
            if (el) return el.data || el;
            return null;
        };

        const searchInChartsMap = (charts: any): any | null => {
            if (!charts) return null;
            for (const contextName in charts) {
                const chart = charts[contextName];
                if (chart && chart.elements) {
                    const res = searchInChartElements(chart.elements);
                    if (res) return res;
                }
            }
            return null;
        };

        const searchInTaskList = (tasks: any[]): any | null => {
            if (!tasks || !Array.isArray(tasks)) return null;
            for (const task of tasks) {
                if (task.flowChart && task.flowChart.elements) {
                    const res = searchInChartElements(task.flowChart.elements);
                    if (res) return res;
                }
            }
            return null;
        };

        // 1. Root Flow
        if ((project as any).flow?.elements) {
            const found = searchInChartElements((project as any).flow.elements);
            if (found) return found;
        }

        // 2. Root FlowCharts (Map structure)
        let found = searchInChartsMap(project.flowCharts);
        if (found) return found;

        // 3. Root Tasks
        found = searchInTaskList(project.tasks || (project as any).Tasks);
        if (found) return found;

        // 4. Stage-spezifische Suche
        if (project.stages) {
            for (const stage of project.stages) {
                found = searchInChartsMap(stage.flowCharts);
                if (found) return found;

                found = searchInTaskList(stage.tasks || (stage as any).Tasks);
                if (found) return found;
            }
        }

        return null;
    }
}
