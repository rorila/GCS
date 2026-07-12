/**
 * SchemaMigrator — Einmalige Schema-Normalisierung beim Projekt-Laden.
 * 
 * Migriert Legacy-Alias-Feldnamen auf kanonische Namen in allen Action-Definitionen.
 * Wird in `EditorDataManager.loadProject()` aufgerufen, BEVOR `setProject()` ausgelöst wird.
 * 
 * Migration ist idempotent: Ein zweiter Aufruf ändert nichts.
 * 
 * @since Phase 1 / SYNC_REFACTOR_PLAN §6
 */

import { Logger } from '../utils/Logger';

const logger = Logger.get('SchemaMigrator');

/**
 * Generiert eine UUID v4 ( Fallback für ältere Umgebungen ohne crypto.randomUUID )
 */
function generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Alias-Mapping: Legacy-Feldname → kanonischer Feldname.
 * 
 * Belege aus FlowAction.ts:
 *   actionType  → type         (Zeile 253-254)
 *   propertyChanges → changes  (Zeile 270-280)
 *   variable    → variableName (Zeile 322-323)
 *   methodName  → method       (Zeile 372-373)
 *   expression  → formula      (Zeile 530-548)
 */
const ALIAS_MAP: Record<string, string> = {
    actionType:      'type',
    propertyChanges: 'changes',
    variable:        'variableName',
    methodName:      'method',
    expression:      'formula'
};

/** Aktuelle Schema-Version nach Migration */
const TARGET_SCHEMA_VERSION = '4.0.0';

export class SchemaMigrator {

    /**
     * Migriert ein Projekt auf Schema v4.0.0.
     * 
     * - Normalisiert alle 5 Alias-Felder in Action-Definitionen
     * - Setzt `project.schemaVersion` auf '4.0.0'
     * - Ist idempotent: wiederholter Aufruf ändert nichts
     * 
     * @param project Das rohe Projekt-Objekt (vor setProject)
     * @returns Die Anzahl migrierter Felder (0 wenn bereits migriert)
     */
    public static migrateToV4(project: any): number {
        if (!project) return 0;

        // Bereits migriert? → Skip
        if (project.schemaVersion === TARGET_SCHEMA_VERSION) {
            logger.debug('Schema ist bereits v4.0.0 — keine Migration nötig.');
            return 0;
        }

        let migratedCount = 0;

        // Root-Actions normalisieren
        if (Array.isArray(project.actions)) {
            for (const action of project.actions) {
                migratedCount += this.normalizeAction(action);
            }
        }

        // Stage-Actions normalisieren
        if (Array.isArray(project.stages)) {
            for (const stage of project.stages) {
                if (Array.isArray(stage.actions)) {
                    for (const action of stage.actions) {
                        migratedCount += this.normalizeAction(action);
                    }
                }

                // FlowChart-Elemente normalisieren (node.data enthält oft Alias-Felder)
                if (stage.flowCharts) {
                    for (const chartKey of Object.keys(stage.flowCharts)) {
                        const chart = stage.flowCharts[chartKey];
                        if (Array.isArray(chart?.elements)) {
                            for (const el of chart.elements) {
                                if (el.data) {
                                    migratedCount += this.normalizeAction(el.data);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Root-FlowCharts normalisieren
        if (project.flowCharts) {
            for (const chartKey of Object.keys(project.flowCharts)) {
                const chart = project.flowCharts[chartKey];
                if (Array.isArray(chart?.elements)) {
                    for (const el of chart.elements) {
                        if (el.data) {
                            migratedCount += this.normalizeAction(el.data);
                        }
                    }
                }
            }
        }

        // Phase 1: IDs für Tasks und Actions zuweisen (falls fehlend)
        const idCount = this.assignMissingIds(project);
        if (idCount > 0) {
            logger.info(`[Migration] Phase 1: ${idCount} fehlende IDs zugewiesen.`);
        }

        // Schema-Version setzen
        project.schemaVersion = TARGET_SCHEMA_VERSION;

        if (migratedCount > 0) {
            logger.info(`[Migration] Schema v4.0.0: ${migratedCount} Alias-Felder normalisiert.`);
        } else {
            logger.debug('[Migration] Schema v4.0.0 gesetzt (keine Alias-Felder gefunden).');
        }

        return migratedCount;
    }

    /**
     * Normalisiert Alias-Felder in einer einzelnen Action-Definition.
     * 
     * Regel: Wenn sowohl Alias als auch kanonisches Feld existieren,
     * gewinnt das kanonische Feld und der Alias wird gelöscht.
     * 
     * @returns Anzahl migrierter Felder
     */
    private static normalizeAction(action: any): number {
        if (!action || typeof action !== 'object') return 0;

        let count = 0;

        for (const [alias, canonical] of Object.entries(ALIAS_MAP)) {
            if (action[alias] !== undefined) {
                if (action[canonical] === undefined) {
                    // Alias vorhanden, kanonisch fehlt → Wert übertragen
                    action[canonical] = action[alias];
                }
                // In jedem Fall: Alias-Feld entfernen
                delete action[alias];
                count++;
            }
        }

        return count;
    }

    /**
     * Phase 1 (ID-Migration): Weist fehlende IDs für Tasks und Actions zu.
     * 
     * Durchläuft alle Tasks und Actions im Projekt (Root und Stages) und
     * generiert stabile IDs für Elemente ohne `id` Feld.
     * 
     * @param project Das Projekt-Objekt
     * @returns Anzahl zugewiesener IDs
     */
    public static assignMissingIds(project: any): number {
        if (!project) return 0;

        let idCount = 0;

        // Hilfsfunktion für Actions
        const ensureActionId = (action: any): void => {
            if (action && typeof action === 'object' && !action.id) {
                action.id = generateId();
                idCount++;
            }
        };

        // Hilfsfunktion für Tasks
        const ensureTaskId = (task: any): void => {
            if (task && typeof task === 'object' && !task.id) {
                task.id = generateId();
                idCount++;
            }
        };

        // Root-Actions
        if (Array.isArray(project.actions)) {
            for (const action of project.actions) {
                ensureActionId(action);
            }
        }

        // Root-Tasks
        if (Array.isArray(project.tasks)) {
            for (const task of project.tasks) {
                ensureTaskId(task);
            }
        }

        // Stage-Actions und Stage-Tasks
        if (Array.isArray(project.stages)) {
            for (const stage of project.stages) {
                if (Array.isArray(stage.actions)) {
                    for (const action of stage.actions) {
                        ensureActionId(action);
                    }
                }
                if (Array.isArray(stage.tasks)) {
                    for (const task of stage.tasks) {
                        ensureTaskId(task);
                    }
                }
            }
        }

        return idCount;
    }

    /**
     * Stellt sicher, dass project.userStories im UserStoryContainer-Format vorliegt.
     * Migriert alte Array-Formate und initialisiert fehlende Pflichtfelder.
     */
    public static ensureUserStories(project: any): number {
        if (!project) return 0;
        let migratedCount = 0;

        if (!project.userStories) {
            project.userStories = { userStories: [] };
            migratedCount++;
        } else if (Array.isArray(project.userStories)) {
            project.userStories = { userStories: project.userStories };
            migratedCount++;
        }

        if (!project.userStories.userStories || !Array.isArray(project.userStories.userStories)) {
            project.userStories.userStories = [];
            migratedCount++;
        }

        for (const us of project.userStories.userStories) {
            if (us && typeof us === 'object') {
                if (!us.id) { us.id = `us_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; migratedCount++; }
                if (us.projectId === undefined) { us.projectId = project.meta?.id || project.meta?.name || ''; migratedCount++; }
                if (us.title === undefined) { us.title = '(kein Titel)'; migratedCount++; }
                if (us.description === undefined) { us.description = ''; migratedCount++; }
                if (!Array.isArray(us.acceptanceCriteria)) { us.acceptanceCriteria = []; migratedCount++; }
                if (!Array.isArray(us.relatedComponents)) { us.relatedComponents = []; migratedCount++; }
                if (!Array.isArray(us.relatedVariables)) { us.relatedVariables = []; migratedCount++; }
                if (!Array.isArray(us.relatedStages)) { us.relatedStages = []; migratedCount++; }
                if (!Array.isArray(us.interactions)) { us.interactions = []; migratedCount++; }
                if (!us.priority) { us.priority = 'medium'; migratedCount++; }
                if (!us.status) { us.status = 'idea'; migratedCount++; }
                if (!Array.isArray(us.plannedActions)) { us.plannedActions = []; migratedCount++; }
                if (us.agentControllerScript !== undefined && typeof us.agentControllerScript !== 'string') { us.agentControllerScript = ''; migratedCount++; }
                if (!us.createdAt) { us.createdAt = new Date().toISOString(); migratedCount++; }
                if (!us.updatedAt) { us.updatedAt = new Date().toISOString(); migratedCount++; }
            }
        }

        if (migratedCount > 0) {
            logger.info(`[Migration] UserStories: ${migratedCount} Felder normalisiert.`);
        }

        return migratedCount;
    }

    /**
     * Gibt die aktuelle Ziel-Schema-Version zurück.
     */
    public static getTargetVersion(): string {
        return TARGET_SCHEMA_VERSION;
    }

    /**
     * Phase 2: Füllt fehlende Default-Werte in Action-Definitionen auf,
     * basierend auf den ActionRegistry-Metadaten.
     * 
     * Dies ersetzt den wasMissing-Block im InspectorSectionRenderer,
     * der bisher zur Render-Zeit Defaults in die SSoT geschrieben hat.
     * 
     * @param project Das Projekt-Objekt
     * @param registryLookup Funktion die für einen ActionType die Parameter-Defaults liefert
     * @returns Anzahl aufgefüllter Felder
     */
    public static applyRegistryDefaults(
        project: any,
        registryLookup: (type: string) => Array<{ name: string; defaultValue?: any }> | null
    ): number {
        if (!project) return 0;

        let filledCount = 0;

        const fillAction = (action: any): void => {
            if (!action || typeof action !== 'object' || !action.type) return;
            const params = registryLookup(action.type);
            if (!params) return;

            for (const param of params) {
                if (param.defaultValue !== undefined && action[param.name] === undefined) {
                    action[param.name] = param.defaultValue;
                    filledCount++;
                }
            }
        };

        // Root-Actions
        if (Array.isArray(project.actions)) {
            for (const action of project.actions) {
                fillAction(action);
            }
        }

        // Stage-Actions
        if (Array.isArray(project.stages)) {
            for (const stage of project.stages) {
                if (Array.isArray(stage.actions)) {
                    for (const action of stage.actions) {
                        fillAction(action);
                    }
                }
            }
        }

        if (filledCount > 0) {
            logger.info(`[Migration] Registry-Defaults: ${filledCount} fehlende Felder aufgefüllt.`);
        }

        return filledCount;
    }

    /**
     * Phase 3: Initialisiert Defaults für eine einzelne (neue) Action.
     * Wird beim Erstellen einer Action via UI oder beim Typ-Wechsel aufgerufen.
     * @param action Das Action-Objekt
     * @param registryLookup Funktion die für einen ActionType die Parameter-Defaults liefert
     */
    public static initializeActionDefaults(
        action: any,
        registryLookup: (type: string) => Array<{ name: string; defaultValue?: any }> | null
    ): void {
        if (!action || typeof action !== 'object' || !action.type) return;
        const params = registryLookup(action.type);
        if (!params) return;

        for (const param of params) {
            if (param.defaultValue !== undefined && action[param.name] === undefined) {
                action[param.name] = param.defaultValue;
            }
        }
    }
}
