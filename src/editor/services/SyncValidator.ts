import { Logger } from '../../utils/Logger';
import { GameProject } from '../../model/types';

/**
 * Ergebnis einer einzelnen Validierungsregel.
 */
export interface ValidationResult {
    rule: string;
    severity: 'warn' | 'error';
    message: string;
    autoRepaired?: boolean;
}

/**
 * SyncValidator — Automatische Konsistenzprüfung nach Sync-Operationen.
 * 
 * Wird am Ende von `FlowSyncManager.syncToProject()` aufgerufen.
 * Prüft 6 Regeln und loggt Verletzungen. Optional mit Auto-Repair.
 * 
 * @since v3.14.0
 */
export class SyncValidator {
    public static logger = Logger.get('SyncValidator', 'Flow_Synchronization');

    /**
     * Vollständige Validierung des Projekts nach einem Sync.
     * @param project Das Projekt-Objekt (SSoT)
     * @param context Der aktuelle Flow-Kontext (Task-Name oder 'global')
     * @param autoRepair Wenn true, werden unkritische Probleme automatisch behoben
     */
    public static validate(project: GameProject, context: string, autoRepair: boolean = true): ValidationResult[] {
        if (!project) return [];

        const results: ValidationResult[] = [];

        results.push(...this.validateActionReferences(project, autoRepair));
        results.push(...this.validateTaskFlowCharts(project, autoRepair));
        results.push(...this.validateFlowChartConnections(project, context));
        results.push(...this.validatePropertySync(project, context));
        results.push(...this.validateDuplicates(project, autoRepair));
        results.push(...this.validateFlowChartLocation(project, autoRepair));

        return results;
    }

    /**
     * Spot-Validierung nach einer einzelnen Property-Änderung.
     * Prüft nur R4 (Property-Sync) für das geänderte Objekt.
     */
    public static validateSinglePropertySync(
        object: any,
        propertyName: string,
        project: GameProject
    ): ValidationResult[] {
        if (!object || !project) return [];
        const results: ValidationResult[] = [];

        const nodeName = object.Name || object.name;
        const nodeType = (typeof object.getType === 'function') ? object.getType()?.toLowerCase() : null;

        if (!nodeName || !nodeType) return results;

        if (nodeType === 'action' || nodeType === 'data_action') {
            const actionDef = this.findDefinition(project, 'action', nodeName);
            if (!actionDef) {
                results.push({
                    rule: 'R4',
                    severity: 'error',
                    message: `Action "${nodeName}": Keine Definition im Projekt gefunden nach Änderung von "${propertyName}".`
                });
            } else {
                // Prüfe ob der geänderte Wert auch in der Definition steht
                const nodeValue = object[propertyName] ?? object.data?.[propertyName];
                const defValue = (actionDef as any)[propertyName];
                if (nodeValue !== undefined && defValue !== undefined && nodeValue !== defValue) {
                    results.push({
                        rule: 'R4',
                        severity: 'error',
                        message: `Action "${nodeName}".${propertyName}: Flow-Node hat "${nodeValue}", Definition hat "${defValue}" — Desync!`
                    });
                }
            }
        } else if (nodeType === 'task') {
            const taskDef = this.findDefinition(project, 'task', nodeName);
            if (!taskDef) {
                results.push({
                    rule: 'R4',
                    severity: 'warn',
                    message: `Task "${nodeName}": Keine Definition im Projekt gefunden nach Änderung von "${propertyName}".`
                });
            }
        }

        // Logge Ergebnisse sofort
        results.forEach(v => {
            this.logger[v.severity](`[${v.rule}] ${v.message}`);
        });

        return results;
    }

    // =========================================================================
    // R1: Action-Referenz-Integrität
    // Jede Action in actionSequence muss eine Definition haben
    // =========================================================================
    private static validateActionReferences(project: GameProject, autoRepair: boolean): ValidationResult[] {
        const results: ValidationResult[] = [];
        const validActionNames = this.collectAllNames(project, 'action');

        const allTasks = this.collectAllItems(project, 'task');

        for (const task of allTasks) {
            if (!task.actionSequence || !Array.isArray(task.actionSequence)) continue;

            const orphaned: string[] = [];
            for (const item of task.actionSequence) {
                if (!item) continue;

                let actionName: string | null = null;
                if (typeof item === 'string') {
                    actionName = item;
                } else if (item.type === 'action' && item.name) {
                    actionName = item.name;
                }

                if (actionName && !validActionNames.has(actionName)) {
                    orphaned.push(actionName);
                }
            }

            if (orphaned.length > 0) {
                if (autoRepair) {
                    task.actionSequence = task.actionSequence.filter((item: any) => {
                        if (!item) return false;
                        const name = typeof item === 'string' ? item : (item.type === 'action' ? item.name : null);
                        return !name || validActionNames.has(name);
                    });
                    results.push({
                        rule: 'R1',
                        severity: 'warn',
                        message: `Task "${task.name}": ${orphaned.length} verwaiste Action-Referenz(en) entfernt: [${orphaned.join(', ')}]`,
                        autoRepaired: true
                    });
                } else {
                    results.push({
                        rule: 'R1',
                        severity: 'warn',
                        message: `Task "${task.name}": ${orphaned.length} verwaiste Action-Referenz(en): [${orphaned.join(', ')}]`
                    });
                }
            }
        }

        return results;
    }

    // =========================================================================
    // R2: Task-FlowChart-Konsistenz
    // Jeder FlowChart-Schlüssel muss eine Task-Definition haben
    // =========================================================================
    private static validateTaskFlowCharts(project: GameProject, autoRepair: boolean): ValidationResult[] {
        const results: ValidationResult[] = [];
        const validTaskNames = this.collectAllNames(project, 'task');
        const reservedKeys = new Set(['global', 'event-map', 'element-overview', '__legacy_flow__']);

        const checkCharts = (charts: Record<string, any> | undefined, location: string) => {
            if (!charts) return;
            for (const key of Object.keys(charts)) {
                if (reservedKeys.has(key)) continue;
                if (!validTaskNames.has(key)) {
                    if (autoRepair) {
                        delete charts[key];
                        results.push({
                            rule: 'R2',
                            severity: 'warn',
                            message: `${location}: FlowChart "${key}" ohne Task-Definition entfernt.`,
                            autoRepaired: true
                        });
                    } else {
                        results.push({
                            rule: 'R2',
                            severity: 'warn',
                            message: `${location}: FlowChart "${key}" hat keine zugehörige Task-Definition.`
                        });
                    }
                }
            }
        };

        checkCharts(project.flowCharts, 'Projekt-Root');
        if (project.stages) {
            for (const stage of project.stages) {
                checkCharts(stage.flowCharts, `Stage "${stage.name}"`);
            }
        }

        return results;
    }

    // =========================================================================
    // R3: Connection-Validität
    // Connections.startTargetId/endTargetId müssen auf existierende Nodes zeigen
    // =========================================================================
    private static validateFlowChartConnections(project: GameProject, context: string): ValidationResult[] {
        const results: ValidationResult[] = [];

        const checkChart = (chart: any, location: string) => {
            if (!chart?.elements || !chart?.connections) return;

            const nodeIds = new Set(chart.elements.map((e: any) => e.id));

            for (const conn of chart.connections) {
                if (conn.startTargetId && !nodeIds.has(conn.startTargetId)) {
                    results.push({
                        rule: 'R3',
                        severity: 'warn',
                        message: `${location}: Connection "${conn.id}" zeigt auf nicht-existierenden Start-Node "${conn.startTargetId}".`
                    });
                }
                if (conn.endTargetId && !nodeIds.has(conn.endTargetId)) {
                    results.push({
                        rule: 'R3',
                        severity: 'warn',
                        message: `${location}: Connection "${conn.id}" zeigt auf nicht-existierenden End-Node "${conn.endTargetId}".`
                    });
                }
            }
        };

        // Nur den aktuellen Kontext prüfen (Performance)
        if (context === 'global' && project.flowCharts?.global) {
            checkChart(project.flowCharts.global, 'Global-Flow');
        } else {
            // Suche den Chart zum aktuellen Kontext
            if (project.stages) {
                for (const stage of project.stages) {
                    if (stage.flowCharts?.[context]) {
                        checkChart(stage.flowCharts[context], `Flow "${context}"`);
                        break;
                    }
                }
            }
            if (project.flowCharts?.[context]) {
                checkChart(project.flowCharts[context], `Flow "${context}"`);
            }
        }

        return results;
    }

    // =========================================================================
    // R4: Property-Sync
    // Flow-Node type muss mit Definition übereinstimmen
    // =========================================================================
    private static validatePropertySync(project: GameProject, context: string): ValidationResult[] {
        const results: ValidationResult[] = [];

        const checkChart = (chart: any) => {
            if (!chart?.elements) return;

            for (const el of chart.elements) {
                const nodeType = (el.type || '').toLowerCase();
                if (nodeType !== 'action' && nodeType !== 'data_action') continue;

                const nodeName = el.data?.name || el.properties?.name;
                if (!nodeName) continue;

                // Nur verlinkte Actions prüfen (unlinked haben eigene Daten)
                if (!el.data?.isLinked) continue;

                const actionDef = this.findDefinition(project, 'action', nodeName) as any;
                if (!actionDef) {
                    // Keine Definition gefunden — das ist ein R1-Problem, nicht R4
                    continue;
                }

                // Typ-Vergleich
                const nodeActionType = el.data?.type || nodeType;
                const defType = actionDef.type || 'action';
                if (nodeActionType !== defType && nodeActionType !== 'action') {
                    results.push({
                        rule: 'R4',
                        severity: 'error',
                        message: `Action "${nodeName}": Flow-Node hat type="${nodeActionType}", Definition hat type="${defType}" — Typ-Desync!`
                    });
                }
            }
        };

        // Nur den aktuellen Kontext prüfen
        if (context === 'global' && project.flowCharts?.global) {
            checkChart(project.flowCharts.global);
        } else {
            if (project.stages) {
                for (const stage of project.stages) {
                    if (stage.flowCharts?.[context]) {
                        checkChart(stage.flowCharts[context]);
                        break;
                    }
                }
            }
            if (project.flowCharts?.[context]) {
                checkChart(project.flowCharts[context]);
            }
        }

        return results;
    }

    // =========================================================================
    // R5: Duplikat-Erkennung
    // Keine Task/Action darf in mehreren Stages doppelt existieren
    // =========================================================================
    private static validateDuplicates(project: GameProject, _autoRepair: boolean): ValidationResult[] {
        const results: ValidationResult[] = [];

        const checkDuplicates = (type: 'task' | 'action') => {
            const seen = new Map<string, string>(); // name → first location

            // Root-Level
            const rootItems = type === 'task' ? (project.tasks || []) : (project.actions || []);
            for (const item of rootItems) {
                const key = item.name.toLowerCase();
                if (seen.has(key)) {
                    results.push({
                        rule: 'R5',
                        severity: 'warn',
                        message: `${type === 'task' ? 'Task' : 'Action'} "${item.name}" existiert doppelt: in Root und in ${seen.get(key)}.`
                    });
                } else {
                    seen.set(key, 'Root');
                }
            }

            // Stages
            if (project.stages) {
                for (const stage of project.stages) {
                    const items = type === 'task' ? (stage.tasks || []) : (stage.actions || []);
                    for (const item of items) {
                        const key = item.name.toLowerCase();
                        if (seen.has(key)) {
                            results.push({
                                rule: 'R5',
                                severity: 'warn',
                                message: `${type === 'task' ? 'Task' : 'Action'} "${item.name}" existiert doppelt: in Stage "${stage.name}" und in ${seen.get(key)}.`
                            });
                        } else {
                            seen.set(key, `Stage "${stage.name}"`);
                        }
                    }
                }
            }
        };

        checkDuplicates('task');
        checkDuplicates('action');

        return results;
    }

    // =========================================================================
    // R6: FlowChart-Speicherort
    // FlowCharts für Tasks dürfen nicht gleichzeitig in Root und Stage stehen
    // =========================================================================
    private static validateFlowChartLocation(project: GameProject, autoRepair: boolean): ValidationResult[] {
        const results: ValidationResult[] = [];
        if (!project.flowCharts || !project.stages) return results;

        const rootChartKeys = new Set(Object.keys(project.flowCharts));

        for (const stage of project.stages) {
            if (!stage.flowCharts) continue;
            for (const key of Object.keys(stage.flowCharts)) {
                if (key === 'global') continue;
                if (rootChartKeys.has(key)) {
                    if (autoRepair) {
                        // Stage hat Vorrang — Root-Eintrag entfernen
                        delete project.flowCharts[key];
                        results.push({
                            rule: 'R6',
                            severity: 'warn',
                            message: `FlowChart "${key}" existierte in Root UND Stage "${stage.name}". Root-Eintrag entfernt (Stage hat Vorrang).`,
                            autoRepaired: true
                        });
                    } else {
                        results.push({
                            rule: 'R6',
                            severity: 'warn',
                            message: `FlowChart "${key}" existiert sowohl in Root als auch in Stage "${stage.name}" — Split-Brain!`
                        });
                    }
                }
            }
        }

        return results;
    }

    // =========================================================================
    // Hilfsfunktionen
    // =========================================================================

    /** Sammelt alle Namen eines Typs über das gesamte Projekt */
    private static collectAllNames(project: GameProject, type: 'task' | 'action'): Set<string> {
        const names = new Set<string>();

        const rootItems = type === 'task' ? (project.tasks || []) : (project.actions || []);
        for (const item of rootItems) {
            if (item.name) names.add(item.name);
        }

        if (project.stages) {
            for (const stage of project.stages) {
                const items = type === 'task' ? (stage.tasks || []) : (stage.actions || []);
                if (Array.isArray(items)) {
                    for (const item of items) {
                        if (item.name) names.add(item.name);
                    }
                }
            }
        }

        return names;
    }

    /** Sammelt alle Items eines Typs über das gesamte Projekt */
    private static collectAllItems(project: GameProject, type: 'task' | 'action'): any[] {
        const items: any[] = [];

        const rootItems = type === 'task' ? (project.tasks || []) : (project.actions || []);
        items.push(...rootItems);

        if (project.stages) {
            for (const stage of project.stages) {
                const stageItems = type === 'task' ? (stage.tasks || []) : (stage.actions || []);
                if (Array.isArray(stageItems)) {
                    items.push(...stageItems);
                }
            }
        }

        return items;
    }

    /** Findet eine Definition per Name */
    private static findDefinition(project: GameProject, type: 'task' | 'action', name: string): any | null {
        const rootItems = type === 'task' ? (project.tasks || []) : (project.actions || []);
        const found = rootItems.find((item: any) => item.name === name);
        if (found) return found;

        if (project.stages) {
            for (const stage of project.stages) {
                const items = type === 'task' ? (stage.tasks || []) : (stage.actions || []);
                if (Array.isArray(items)) {
                    const stageFound = items.find((item: any) => item.name === name);
                    if (stageFound) return stageFound;
                }
            }
        }

        return null;
    }
}
