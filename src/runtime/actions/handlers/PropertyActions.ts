import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';
import { DebugLogService } from '../../../services/DebugLogService';
import { resolveTarget } from '../ActionHelper';

export function registerPropertyActions() {
    const handler = (action: any, context: any) => {
        const target = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (target && action.changes) {
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
}
