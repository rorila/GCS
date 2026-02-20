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

        // 3. Variablen in den Kontext einfügen (für Auflösung von ${varName} im Inspector)
        const context: Record<string, any> = {
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

            // Neue Hilfsfunktion für Variablen-Felder
            availableVariableFields: allVars.reduce((acc, v: any) => {
                const prefix = v.uiScope === 'global' ? 'global' : 'stage';
                const token = `\${${prefix}.${v.name}}`;

                // Felder basierend auf dem Typ/Modell ermitteln
                let fields: string[] = [];
                const type = v.type as string;
                const className = v.className as string;

                // Check multiple ways a variable might be identified as complex
                if (type === 'object' || type === 'object_list' || type === 'json' || type === 'any' ||
                    className === 'TObjectVariable' || className === 'TVariable') {

                    const model = (v.objectModel || '').toLowerCase();
                    if (model === 'user' || model === 'users') {
                        fields = ['id', 'name', 'role', 'authCode', 'avatar', 'status'];
                    } else if (model === 'project' || model === 'projects') {
                        fields = ['id', 'name', 'description', 'version'];
                    } else if (model === 'stage' || model === 'stages') {
                        fields = ['id', 'name', 'type'];
                    } else if (model === 'variable' || model === 'variables') {
                        fields = ['id', 'name', 'type', 'value'];
                    } else if (model.includes('resource')) {
                        fields = ['id', 'name', 'role', 'authCode', 'status'];
                    } else {
                        // Generische Felder für Objekte
                        fields = ['id', 'name', 'text', 'value'];
                    }
                }

                if (fields.length > 0) {
                    console.log(`[InspectorContextBuilder] Registering fields for ${token} (Model: ${v.objectModel}):`, fields);
                    acc[token] = fields;
                }
                return acc;
            }, {} as Record<string, string[]>),

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
            ],

            // Liste aller Sichtbaren Objekte (für Eigenschafts-Vergleich)
            availableObjects: allObjects.map(obj => obj.name || obj.id),

            // Häufige Eigenschaften von Komponenten
            availableObjectProperties: [
                'text',
                'value',
                'caption',
                'width',
                'height',
                'top',
                'left',
                'visible',
                'checked',
                'progress',
                'enabled',
                'src'
            ]
        };

        // Variablen-Werte hinzufügen (für Live-Preview im Inspector)
        allVars.forEach(v => {
            // Wir nutzen defaultValue oder den aktuellen Wert (falls vorhanden)
            // Im Editor-Kontext ist defaultValue oft sicherer für die Anzeige
            const value = (v as any).value !== undefined && (v as any).value !== null ? (v as any).value : v.defaultValue;

            // Zugriff via Name: ${varName}
            context[v.name] = value;

            // Zugriff via Scope-Präfix: ${global.varName} oder ${stage.varName}
            if (v.uiScope) {
                if (!context[v.uiScope]) context[v.uiScope] = {};
                context[v.uiScope][v.name] = value;
            }
        });

        return context;
    }
}
