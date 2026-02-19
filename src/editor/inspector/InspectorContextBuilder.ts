import { ProjectRegistry } from '../../services/ProjectRegistry';
import { actionRegistry } from '../../runtime/ActionRegistry';

/**
 * InspectorContextBuilder - Erzeugt den Datenkontext für Inspector-Templates.
 * 
 * Diese Klasse stellt "magische" Variablen bereit (z.B. availableDataStores),
 * die in JSON-Templates via ${variable} genutzt werden können.
 */
export class InspectorContextBuilder {

    /**
     * Erzeugt das vollständige Kontext-Objekt für ein bestimmtes Ziel-Objekt.
     */
    public static build(selectedObject: any): any {
        const registry = ProjectRegistry.getInstance();
        const activeStageId = registry.getActiveStageId();

        // 1. Variablen abrufen (Global + Active Stage)
        const allVars = registry.getVariables();

        // 2. DataStores finden
        const allObjects = registry.getObjects();
        const dataStores = allObjects.filter(obj =>
            obj.className === 'TDataStore' || (obj as any).constructor?.name === 'TDataStore'
        );

        return {
            selectedObject,
            activeStageId,

            // Magic Functions
            getAllActionTypes: () => actionRegistry.getAllMetadata().map(m => ({ value: m.type, label: m.label })),

            // Liste der DataStore Namen (priorisiert) für Dropdowns
            availableDataStores: dataStores.map(ds => ds.name || ds.id),

            // Liste der Variablen: Anzeige Name, Wert ist Token
            availableVariablesAsTokens: allVars.map(v => {
                const prefix = v.uiScope === 'global' ? 'global' : 'stage';
                const token = `\${${prefix}.${v.name}}`;
                return {
                    text: v.name,
                    value: token
                };
            }),

            // Liste der Variablen mit Scope-Emoji für Dropdowns
            availableVariablesWithScope: allVars.map(v => ({
                text: `${v.uiEmoji || ''} ${v.name}`,
                value: v.id
            })),

            // Standard-Felder für Data-Queries (angepasst an db.json / UserData)
            availableResourceProperties: [
                'id',
                'name',
                'role',
                'authCode',
                'avatar',
                'managedRooms',
                'status'
            ],

            // Verfügbare Datenmodelle (für object/object_list Variablen)
            availableModels: [
                'User',
                'Task',
                'Project',
                'Stage',
                'Variable',
                'Action',
                'Resource',
                'Hierarchy'
            ]
        };
    }
}
