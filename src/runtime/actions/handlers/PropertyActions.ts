import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';
import { DebugLogService } from '../../../services/DebugLogService';
import { resolveTarget } from '../ActionHelper';

export function registerPropertyActions() {
    const handler = (action: any, context: any) => {
        const target = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        if (target && action.changes) {
            const combinedContext = { 
                ...context.contextVars, 
                ...context.vars, 
                $eventData: context.eventData, 
                $event: context.eventData 
            };
            Object.keys(action.changes).forEach(prop => {
                const rawValue = action.changes[prop];
                const value = PropertyHelper.interpolate(String(rawValue), combinedContext, context.objects);
                const finalValue = PropertyHelper.autoConvert(value);
                PropertyHelper.setPropertyValue(target, prop, finalValue);

                DebugLogService.getInstance().log('Variable', `${target.name || target.id}.${prop} = ${finalValue}`, {
                    objectName: target.name || target.id,
                    flatten: true
                });
            });
        }
    };

    // 1. Property ändern
    actionRegistry.register('property', handler, {
        type: 'property',
        label: 'Eigenschaft ändern',
        description: 'Ändert eine oder mehrere Eigenschaften eines Objekts.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects' },
            { name: 'changes', label: 'Änderungen (JSON)', type: 'json', hint: 'Beispiel: { "text": "Hallo", "visible": true }' }
        ]
    });

    // 1b. Alias: 'action' → identisch mit 'property'
    actionRegistry.register('action', handler, {
        type: 'action',
        label: 'Eigenschaft ändern',
        description: 'Alias für property — ändert eine oder mehrere Eigenschaften eines Objekts.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects' },
            { name: 'changes', label: 'Änderungen (JSON)', type: 'json', hint: 'Beispiel: { "text": "Hallo", "visible": true }' }
        ]
    });

    // 2. Kind-Property ändern (für Templates/Gruppen)
    actionRegistry.register('set_child_property', (action, context) => {
        const parent = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        if (!parent || !parent.children) return;

        const findChild = (children: any[]): any => {
            for (const child of children) {
                // Name-Matching kann partiel sein, weil spawnObject das _spawn_XYZ suffix dranhängt an die Template-Names!
                if (child.name === action.childName || child.name.startsWith(action.childName + '_spawn')) return child;
                if (child.children) {
                    const found = findChild(child.children);
                    if (found) return found;
                }
            }
            return null;
        };

        const child = findChild(parent.children);
        if (child && action.changes) {
            const combinedContext = { 
                ...context.contextVars, 
                ...context.vars, 
                $eventData: context.eventData, 
                $event: context.eventData 
            };
            Object.keys(action.changes).forEach(prop => {
                const rawValue = action.changes[prop];
                const value = PropertyHelper.interpolate(String(rawValue), combinedContext, context.objects);
                const finalValue = PropertyHelper.autoConvert(value);
                PropertyHelper.setPropertyValue(child, prop, finalValue);

                DebugLogService.getInstance().log('Variable', `${child.name || child.id}.${prop} = ${finalValue}`, {
                    objectName: child.name || child.id,
                    flatten: true
                });
            });
        }
    }, {
        type: 'set_child_property',
        label: 'Kind-Eigenschaft ändern',
        description: 'Sucht ein Kind-Element im TGroupPanel über dessen Namen und ändert dessen Eigenschaften.',
        parameters: [
            { name: 'target', label: 'Eltern-Objekt (TGroupPanel)', type: 'object', source: 'objects', hint: 'Oft %Self% oder ID des gespawnten Templates' },
            { name: 'childName', label: 'Kind Name', type: 'string', hint: 'Name des zu modifizierenden Kind-Elements im Template' },
            { name: 'changes', label: 'Änderungen (JSON)', type: 'json', hint: 'Beispiel: { "text": "Neuer Text" }' }
        ]
    });
}
