import { actionRegistry } from '../../runtime/ActionRegistry';
import { projectObjectRegistry } from '../../services/registry/ObjectRegistry';
import { projectVariableRegistry } from '../../services/registry/VariableRegistry';
import { coreStore } from '../../services/registry/CoreStore';
import { dataService } from '../../services/DataService';
import { UseCaseManager, USE_CASES } from '../../utils/UseCaseManager';

/**
 * InspectorContextBuilder - Erzeugt den Datenkontext für Inspector-Templates.
 * 
 * Diese Klasse stellt "magische" Variablen bereit (z.B. availableDataStores),
 * die in JSON-Templates via ${variable} genutzt werden können.
 */
export class InspectorContextBuilder {

    public static build(selectedObject: any): any {
        try {
            const activeStageId = coreStore.getActiveStageId();

            // 1. Variablen abrufen (Global + Active Stage)
            const allVars = projectVariableRegistry.getVariables();

            // 2. DataStores finden
            const allObjects = projectObjectRegistry.getObjects();
            const dataStores = allObjects.filter(obj =>
                obj.className === 'TDataStore' || (obj as any).constructor?.name === 'TDataStore'
            );

        // 3. Variablen in den Kontext einfügen (für Auflösung von ${varName} im Inspector)
        const context: Record<string, any> = {
            selectedObject,
            activeStageId,
            activeStage: coreStore.getActiveStage(),

            // Magic Functions
            getAllActionTypes: () => actionRegistry.getVisibleActionTypes(coreStore.getActiveStage() ? { stages: [coreStore.getActiveStage()], objects: projectObjectRegistry.getObjects() } as any : { objects: projectObjectRegistry.getObjects() } as any),

            // Liste der DataStore Namen (priorisiert) für Dropdowns
            availableDataStores: dataStores.map(ds => ds.name || ds.id),

            // Neue kombinierte Liste der Variablen inkl. Untereigenschaften für Dropdowns
            availableVariablesAsTokens: allVars.reduce((acc: any[], v: any) => {
                const prefix = v.uiScope === 'global' ? 'global' : 'stage';
                const baseToken = `\${${prefix}.${v.name}}`;

                // 1. Basis-Variable hinzufügen
                acc.push({
                    text: v.name,
                    value: baseToken
                });

                // 2. Felder ermitteln (Derselbe Check wie unten bei availableVariableFields)
                let fields: string[] = [];
                const type = v.type as string;
                const className = v.className as string;

                if (type === 'object' || type === 'object_list' || type === 'json' || type === 'any' ||
                    className === 'TObjectVariable' || className === 'TVariable') {

                    const model = (v.objectModel || '').toLowerCase();
                    if (model) {
                        fields = dataService.getModelFieldsSync('db.json', model);
                    }

                    if (fields.length === 0) {
                        fields = ['id', 'name', 'text', 'value'];
                    }
                }

                // 3. Felder als Token hinzufügen (mit Einrückung für visuelle Hierarchie)
                fields.forEach(field => {
                    acc.push({
                        text: `  ${v.name}.${field}`,
                        value: `\${${prefix}.${v.name}.${field}}`
                    });
                });

                return acc;
            }, (() => {
                const initialAcc: any[] = [];
                // Füge Task Parameter als Basis-Tokens hinzu
                const activeStage = coreStore.getActiveStage();
                if (activeStage && activeStage.tasks) {
                    activeStage.tasks.forEach((t: any) => {
                        if (t.params && Array.isArray(t.params)) {
                            t.params.forEach((p: any) => {
                                initialAcc.push({
                                    text: `📎 ${p.name} (Task: ${t.name})`,
                                    value: `\${${p.name}}`
                                });
                            });
                        }
                    });
                }
                return initialAcc;
            })()),

            // Liste der Variablen mit Scope-Emoji für Dropdowns (für Ziel-Variablen)
            availableVariablesWithScope: (() => {
                const vars = allVars.map(v => ({
                    text: `${v.uiEmoji || ''} ${v.name}`,
                    value: v.id
                }));
                
                // Füge Task Parameter aus der aktuellen Stage hinzu
                const activeStage = coreStore.getActiveStage();
                if (activeStage && activeStage.tasks) {
                    activeStage.tasks.forEach((t: any) => {
                        if (t.params && Array.isArray(t.params)) {
                            t.params.forEach((p: any) => {
                                // Vermeide Duplikate
                                if (!vars.find(v => v.text.includes(p.name))) {
                                    vars.push({
                                        text: `📎 ${p.name} (${t.name})`,
                                        value: p.name
                                    });
                                }
                            });
                        }
                    });
                }
                return vars;
            })(),

            // Beibehalten der Struktur für andere Komponenten, die nur die Feldliste benötigen
            availableVariableFields: allVars.reduce((acc, v: any) => {
                const prefix = v.uiScope === 'global' ? 'global' : 'stage';
                const token = `\${${prefix}.${v.name}}`;

                let fields: string[] = [];
                const type = v.type as string;
                const className = v.className as string;

                if (type === 'object' || type === 'object_list' || type === 'json' || type === 'any' ||
                    className === 'TObjectVariable' || className === 'TVariable') {

                    const model = (v.objectModel || '').toLowerCase();
                    if (model) {
                        fields = dataService.getModelFieldsSync('db.json', model);
                    }

                    if (fields.length === 0) {
                        fields = ['id', 'name', 'text', 'value'];
                    }
                }

                if (fields.length > 0) {
                    acc[token] = fields;
                }
                return acc;
            }, {} as Record<string, string[]>),

            // Standard-Felder für Data-Queries (Dynamisch basierend auf dem gewählten DataStore)
            availableResourceProperties: (() => {
                const baseFields = (() => {
                    const dsName = selectedObject?.dataStore;
                    if (!dsName) return ['id', 'name', 'text', 'value'];

                    // Finde den DataStore in der Stage
                    const dsObj = allObjects.find(o => o.name === dsName || o.id === dsName);
                    const collection = (dsObj as any)?.defaultCollection || '';

                    if (collection) {
                        return dataService.getModelFieldsSync('db.json', collection);
                    }

                    return ['id', 'name', 'text', 'value'];
                })();

                return ['*', 'count(*)', ...baseFields];
            })(),

            // Verfügbare Datenmodelle (für object/object_list Variablen)
            // Kontext-aware: Singular für 'object', Plural für 'object_list'
            // Dynamisch ermittelt aus dem LocalStore/db.json
            availableModels: (() => {
                // Versuche den Pfad aus dem ersten DataStore zu lesen, sonst Fallback auf db.json
                const storagePath = (dataStores[0] as any)?.storagePath || 'db.json';
                const pluralModels = dataService.getModelsSync(storagePath);

                if (selectedObject.type === 'object_list') {
                    // Plural-Modelle direkt zurückgeben
                    return pluralModels;
                } else {
                    // Singular-Modelle ableiten (Primitiv: 's' am Ende entfernen)
                    return pluralModels.map(m => m.endsWith('s') ? m.slice(0, -1) : m);
                }
            })(),

            // Liste aller Sichtbaren Objekte (für Eigenschafts-Vergleich)
            availableObjects: allObjects.map(obj => obj.name || obj.id),

            // Häufige Eigenschaften von Komponenten
            availableObjectProperties: [
                'text', 'value', 'caption', 'width', 'height', 'top', 'left', 'visible', 'checked', 'progress', 'enabled', 'src'
            ],

            // Liste der verfügbaren Tasks direkt aus dem CoreStore extrahieren (umgeht isolierte Cache-Module)
            availableTasks: (() => {
                const project = coreStore.project;
                if (!project) return [];
                
                const allTasks: any[] = [];
                if (project.tasks) {
                    project.tasks.forEach(t => allTasks.push({ ...t, uiScope: 'global' }));
                }
                if (project.stages) {
                    project.stages.forEach(stage => {
                        if (stage.type === 'blueprint' && stage.tasks) {
                            stage.tasks.forEach(t => {
                                if (!allTasks.find(existing => existing.name === t.name)) {
                                    allTasks.push({ ...t, uiScope: 'global' });
                                }
                            });
                        } else if (stage.tasks) {
                            stage.tasks.forEach(t => allTasks.push({ ...t, uiScope: 'stage' }));
                        }
                    });
                }
                
                const mappedTasks = allTasks.map(t => ({
                    value: t.name,
                    label: `${t.uiEmoji || (t.uiScope === 'global' ? '🌎' : '🎭')} ${t.name}`
                }));
                mappedTasks.unshift({ value: '', label: '- Task auswählen... -' });
                return mappedTasks;
            })(),

            // UseCase Diagnostic System
            UseCaseManager: UseCaseManager,
            Config: {
                USE_CASES: USE_CASES
            },
            
            _debugProjectIsNull: coreStore.project === null || coreStore.project === undefined
        };

        // Variablen-Werte hinzufügen (für Live-Preview im Inspector)
        allVars.forEach(v => {
            const value = (v as any).value !== undefined && (v as any).value !== null ? (v as any).value : v.defaultValue;
            context[v.name] = value;
            if (v.uiScope) {
                if (!context[v.uiScope]) context[v.uiScope] = {};
                context[v.uiScope][v.name] = value;
            }
        });

        return context;
        } catch (error: any) {
            console.error('[CRITICAL] InspectorContextBuilder.build threw an error:', error);
            return { 
                availableTasks: [{ value: '', label: `ERROR: ${error?.message || error}` }], 
                availableDataStores: [], 
                availableObjectProperties: [] 
            };
        }
    }
}
