import { coreStore } from '../../services/registry/CoreStore';
import { projectObjectRegistry } from '../../services/registry/ObjectRegistry';
import { projectActionRegistry } from '../../services/registry/ActionRegistry';
import { projectVariableRegistry } from '../../services/registry/VariableRegistry';
import { serviceRegistry } from '../../services/ServiceRegistry';
import { themeRegistry } from '../../runtime/ThemeRegistry';
import { DialogDomainHelper } from '../dialogs/utils/DialogDomainHelper';
import { componentRegistry } from '../../services/ComponentRegistry';
import { Logger } from '../../utils/Logger';

const logger = Logger.get('DynamicOptionsRenderer');

export class DynamicOptionsRenderer {
    public static getOptionsFromSource(prop: any, actionObj?: any): any[] {
        if (Array.isArray(prop.options)) return prop.options;
        if (!prop.source) return [];

        if (prop.source === 'tasks') {
            const activeStage = coreStore.getActiveStage();
            const stageTasks = (activeStage && activeStage.tasks) ? activeStage.tasks : [];
            return [
                { value: '', label: '- Task auswählen... -' },
                ...stageTasks.map((t: any) => ({ value: t.name, label: t.name }))
            ];
        }
        if (prop.source === 'actions') {
            return projectActionRegistry.getActions('all').map(a => ({ value: a.name, label: a.name }));
        }
        if (prop.source === 'dataActions') {
            return projectActionRegistry.getActions('all').filter((a: any) => a.type === 'data_action' || a.type === 'http').map((a: any) => ({ value: a.name, label: a.name }));
        }
        if (prop.source === 'imageLists') {
            const imageLists = projectObjectRegistry.getObjects().filter((o: any) => o.className === 'TImageList');
            return [
                { value: '', label: '— Keine —' },
                ...imageLists.map((o: any) => ({ value: o.name, label: o.name }))
            ];
        }
        if (prop.source === 'animations') {
            const animations = projectObjectRegistry.getObjects().filter((o: any) => o.className === 'TAnimation');
            return [
                { value: '', label: '— Keine —' },
                ...animations.map((o: any) => ({ value: o.name, label: o.name }))
            ];
        }
        if (prop.source === 'variables') {
            return projectVariableRegistry.getVariables().map(v => ({ value: v.name, label: v.name }));
        }
        if (prop.source === 'object_lists') {
            return projectObjectRegistry.getObjects().filter(o => o.className === 'TObjectList').map(o => ({value:o.name,label:o.name}));
        }
        if (prop.source === 'objects') {
            return [
                { value: 'self', label: 'self (Selbstreferenz)' },
                ...projectObjectRegistry.getObjects().map(o => ({ value: o.name, label: o.name }))
            ];
        }
        if (prop.source === 'services') {
            return serviceRegistry.listServices().map(s => ({ value: s, label: s }));
        }
        if (prop.source === 'themes') {
            return themeRegistry.getAvailableThemes().map(t => ({ value: t.id, label: t.name }));
        }
        if (prop.source === 'theme_dialogs') {
            const dialogs = projectObjectRegistry.getObjects()
                .filter((o: any) => o.className === 'TThemeDialog' || o.type === 'ThemeDialog');
            return dialogs.length > 0
                ? dialogs.map((o: any) => ({ value: o.name, label: `${o.name} (Theme Dialog)` }))
                : [{ value: '', label: '— Kein Theme Dialog vorhanden —' }];
        }
        if (prop.source === 'objects_and_services') {
            const allObjects = projectObjectRegistry.getObjects();
            const minimalCtx = { dialogData: {}, project: { objects: allObjects }, enrichedProject: { variables: [] } } as any;
            const validObjects = allObjects.filter((o: any) => {
                try {
                    const methods = DialogDomainHelper.getMethodsForObject(minimalCtx, o.name);
                    return methods && methods.length > 0;
                } catch (_e) { return false; }
            });
            return [
                { value: 'self', label: 'self (Selbstreferenz)' },
                ...validObjects.map((o: any) => ({ value: o.name, label: o.name })),
                ...serviceRegistry.listServices().map((s: string) => ({ value: s, label: s + ' (Service)' }))
            ];
        }
        if (prop.source === 'objects_and_variables') {
            return [
                { value: 'self', label: 'self (Selbstreferenz)' },
                ...projectObjectRegistry.getObjects().map(o => ({ value: o.name, label: o.name })),
                ...projectVariableRegistry.getVariables().map(v => ({ value: v.name, label: v.name + ' (Variable)' }))
            ];
        }
        if (prop.source === 'events_of_target') {
            const targetName = prop._context?.target || actionObj?.target;
            if (targetName && targetName !== 'self') {
                const obj = projectObjectRegistry.getObjects().find(o => o.name === targetName);
                if (obj) {
                    try {
                        const events = componentRegistry.getEvents(obj);
                        if (events && events.length) return events.map((e: string) => ({ value: e, label: e }));
                    } catch (_e) { /* fallthrough to union */ }
                }
            }
            // Variable / self / unbekanntes Target -> Union aller bekannten Events
            const allEvents = new Set<string>();
            projectObjectRegistry.getObjects().forEach(o => {
                try { componentRegistry.getEvents(o).forEach((ev: string) => allEvents.add(ev)); }
                catch { /* skip */ }
            });
            return Array.from(allEvents).sort().map(e => ({ value: e, label: e }));
        }
        if (prop.source === 'methods_of_target') {
            const targetName = prop._context?.target || actionObj?.target;
            if (targetName) {
                try {
                    const allObjects = projectObjectRegistry.getObjects();
                    const minimalCtx = { dialogData: {}, project: { objects: allObjects }, enrichedProject: { variables: [] } } as any;
                    const methods = DialogDomainHelper.getMethodsForObject(minimalCtx, targetName);
                    return methods.map((m: string) => ({ value: m, label: m }));
                } catch (e) {
                    logger.warn('Could not load methods for', targetName, e);
                }
            }
            return [];
        }
        if (prop.source === 'stages') {
            return coreStore.getStages().map((s: any) => ({ value: s.id, label: s.name || s.id }));
        }
        if (prop.source === 'dataStores') {
            return projectObjectRegistry.getObjects()
                .filter(o => o.className === 'TDataStore')
                .map(o => ({ value: o.name, label: o.name }));
        }
        if (prop.source === 'dataStoreFields') {
            // Felder des gewählten DataStores dynamisch auflösen
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { dataService } = require('../../services/DataService');
                const allObjects = projectObjectRegistry.getObjects();
                // Den DataStore-Namen vom aktuell selektierten Objekt lesen
                const dsName = prop._context?.dataStore;
                if (dsName) {
                    const dsObj = allObjects.find(o => o.name === dsName || o.id === dsName);
                    const collection = (dsObj as any)?.defaultCollection || '';
                    if (collection) {
                        const fields = dataService.getModelFieldsSync('db.json', collection);
                        if (fields.length > 0) {
                            return fields.map((f: string) => ({ value: f, label: f }));
                        }
                    }
                }
                // Fallback: Standard-Felder
                return ['id', 'name', 'text', 'value', 'email', 'score'].map(f => ({ value: f, label: f }));
            } catch {
                return ['id', 'name', 'text', 'value'].map(f => ({ value: f, label: f }));
            }
        }
        if (prop.source === 'easing-functions') {
            return ['linear', 'easeIn', 'easeOut', 'easeInOut'].map(e => ({ value: e, label: e }));
        }
        return [];
    }
}
