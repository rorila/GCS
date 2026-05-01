import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';
import { DebugLogService } from '../../../services/DebugLogService';
import { resolveTarget } from '../ActionHelper';

export function registerPropertyActions() {
    const handler = (action: any, context: any) => {
        if (action.changes) {
            const combinedContext = { 
                ...context.contextVars, 
                ...context.vars, 
                $eventData: context.eventData, 
                $event: context.eventData 
            };
            
            Object.keys(action.changes).forEach(key => {
                const rawValue = action.changes[key];
                const value = PropertyHelper.interpolate(String(rawValue), combinedContext, context.objects);
                const finalValue = PropertyHelper.autoConvert(value);

                // Split key into root object and property path (e.g., "Player1.x" -> "Player1" and "x")
                // If there's no dot, we assume it's a variable or a direct object (like a global var)
                const parts = key.split('.');
                const rootName = parts[0];
                const propPath = parts.length > 1 ? parts.slice(1).join('.') : '';

                // Resolve target using ActionHelper
                const target = resolveTarget(rootName, context.objects, context.vars, context.eventData);

                if (target) {
                    if (propPath) {
                        PropertyHelper.setPropertyValue(target, propPath, finalValue);
                    } else {
                        // Direct variable assignment
                        if (context.vars[rootName] !== undefined) {
                            context.vars[rootName] = finalValue;
                            context.contextVars[rootName] = finalValue;
                            const varObj = context.objects.find((o: any) => (o.name === rootName || o.id === rootName) && (o.isVariable === true || o.className?.includes('Variable')));
                            if (varObj) varObj.value = finalValue;
                        } else {
                            // Target found, but no property path provided. Might be an error or setting value directly.
                            PropertyHelper.setPropertyValue(target, 'value', finalValue);
                        }
                    }

                    DebugLogService.getInstance().log('Variable', `${key} = ${finalValue}`, {
                        objectName: rootName,
                        flatten: true
                    });
                } else {
                    // Fallback if not found in objects/vars (e.g. creating a new local var)
                    context.vars[rootName] = finalValue;
                    context.contextVars[rootName] = finalValue;
                }
            });
        }
    };

    // 1. Property ändern (Universal Data Setter)
    actionRegistry.register('property', handler, {
        type: 'property',
        label: 'Daten / Eigenschaft setzen',
        description: 'Setzt eine oder mehrere Datenquellen (Variablen oder Objekteigenschaften) auf neue Werte.',
        parameters: [
            { name: 'changes', label: 'Zuweisungen', type: 'keyvalue', hint: 'Wähle eine Datenquelle (links) und weise einen Wert (rechts) zu.' }
        ]
    });

    // 1b. Alias: 'action' → identisch mit 'property'
    actionRegistry.register('action', handler, {
        type: 'action',
        label: 'Daten / Eigenschaft setzen',
        description: 'Alias für property — ändert Datenquellen.',
        parameters: [
            { name: 'changes', label: 'Zuweisungen', type: 'keyvalue', hint: 'Wähle eine Datenquelle (links) und weise einen Wert (rechts) zu.' }
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
