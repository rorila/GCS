import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';
import { DebugLogService } from '../../../services/DebugLogService';
import { resolveTarget } from '../ActionHelper';
import { Logger } from '../../../utils/Logger';

const runtimeLogger = Logger.get('Action', 'Runtime_Execution');

export function registerVariableActions() {
    const handler = (action: any, context: any) => {
        let val: any = undefined;
        const sourceName = action.source;
        // FIX: Strip ${...} wrapper from variableName if present (Editor V-Button bug)
        let rawVarName = action.variableName;
        if (rawVarName && rawVarName.startsWith('${') && rawVarName.endsWith('}')) {
            rawVarName = rawVarName.slice(2, -1);
        }
        const variableName = rawVarName;

        // 1. Quelle auflösen (Objekt oder Variable)
        const srcObj = resolveTarget(sourceName, context.objects, context.vars, context.eventData);

        if (srcObj) {
            // Falls Objekt gefunden, Eigenschaft lesen
            if (action.sourceProperty) {
                val = PropertyHelper.getPropertyValue(srcObj, action.sourceProperty);
            } else {
                val = srcObj;
            }
        }

        // 2. Falls kein Objekt gefunden oder Wert noch undefined, in Variablen suchen
        if (val === undefined) {
            const varVal = context.vars[sourceName] !== undefined ? context.vars[sourceName] : context.contextVars[sourceName];
            if (varVal !== undefined) {
                if (action.sourceProperty && typeof varVal === 'object' && varVal !== null) {
                    val = PropertyHelper.getPropertyValue(varVal, action.sourceProperty);
                } else {
                    val = varVal;
                }
            }
        }

        // 3. Fallback: Interpolation (falls Quelle z.B. "${andereVar}")
        if (val === undefined && sourceName && String(sourceName).includes('${')) {
            val = PropertyHelper.interpolate(String(sourceName), { ...context.contextVars, ...context.vars }, context.objects);
        }

        // 4. FIX (v3.3.17): Direkt definierten Literal-Wert verwenden
        if ((val === undefined || (!action.source && !action.sourceProperty)) && action.value !== undefined) {
            const combinedCtx = { 
                ...context.contextVars, 
                ...context.vars, 
                $eventData: context.eventData, 
                $event: context.eventData 
            };
            val = PropertyHelper.interpolate(String(action.value), combinedCtx, context.objects);
        }

        // Zuweisung
        if (val !== undefined && variableName) {
            context.vars[variableName] = val;
            context.contextVars[variableName] = val;

            // FIX: If variableName contains a dot (e.g. "MyVar.value"), also set the property
            // on the actual runtime object. This ensures JSEP-based evaluations in CalculateActions
            // can resolve "MyVar.value" via property access on the object in evalContext.
            if (variableName.includes('.')) {
                const parts = variableName.split('.');
                const rootName = parts[0];
                const propPath = parts.slice(1).join('.');
                const rootObj = context.objects.find((o: any) =>
                    o.name === rootName || o.id === rootName
                );
                if (rootObj) {
                    PropertyHelper.setPropertyValue(rootObj, propPath, val);
                    runtimeLogger.info(`Variable dot-path write: ${rootName}.${propPath} = ${val}`);
                }
            }

            // FIX: Auch das TVariable-Objekt in context.objects aktualisieren
            const varObj = context.objects.find((o: any) =>
                (o.name === variableName || o.id === variableName) &&
                (o.isVariable === true || o.className?.includes('Variable'))
            );
            if (varObj) {
                varObj.value = val;
            }

            DebugLogService.getInstance().log('Variable', `Variable "${variableName}" auf "${val}" gesetzt (Quelle: ${sourceName || action.value})${action.sourceProperty ? '.' + action.sourceProperty : ''}`, {
                data: { value: val, source: sourceName, property: action.sourceProperty }
            });
        } else {
            runtimeLogger.warn(`Quelle "${sourceName}" (Value: ${action.value}) konnte nicht aufgelöst werden oder variableName fehlt.`);
            DebugLogService.getInstance().log('Action', `⚠️ Variable konnte nicht gelesen werden. Quelle: ${sourceName}, Value: ${action.value}`, {
                data: action
            });
        }
    };

    // 2. Variable lesen / setzen
    actionRegistry.register('variable', handler, {
        type: 'variable',
        label: 'Variable lesen / setzen',
        description: 'Liest einen Wert aus einer Quelle (Objekt-Eigenschaft, Wert oder andere Variable) und speichert ihn in einer Ziel-Variable.',
        parameters: [
            { name: 'variableName', label: 'Ziel-Variable', type: 'variable', source: 'variables' },
            { name: 'value', label: 'Einfacher Wert (z.B. 555)', type: 'string', placeholder: 'Literal oder ${var}' },
            { name: 'source', label: '(oder) Quell-Objekt / Variable', type: 'object', source: 'objects' },
            { name: 'sourceProperty', label: '(oder) Eigenschaft (optional)', type: 'string', placeholder: 'z.B. text oder value' }
        ]
    });

    // 2b. Alias für Variable setzen
    actionRegistry.register('set_variable', handler, {
        type: 'set_variable',
        label: 'Variable setzen (Zuweisung)',
        hidden: true,
        description: 'Liest einen Wert aus einer Quelle und speichert ihn in einer Ziel-Variable.',
        parameters: [
            { name: 'variableName', label: 'Ziel-Variable', type: 'variable', source: 'variables' },
            { name: 'value', label: 'Einfacher Wert (z.B. 555)', type: 'string', placeholder: 'Literal oder ${var}' },
            { name: 'source', label: '(oder) Quell-Objekt / Variable', type: 'object', source: 'objects' },
            { name: 'sourceProperty', label: '(oder) Eigenschaft (optional)', type: 'string', placeholder: 'z.B. text oder value' }
        ]
    });
}
