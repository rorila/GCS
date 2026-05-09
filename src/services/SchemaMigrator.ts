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
import { GameProject } from '../model/types';

const logger = Logger.get('SchemaMigrator');

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
