import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';

export function registerStageInterfaceActions(): void {
    for (const type of ['stage_input', 'stage_output']) {
        actionRegistry.register(type, async (action, context) => {
            if (!context.stageInterface) throw Error('Keine Stage-Schnittstelle in dieser Laufzeit.');
            const vars = { ...context.contextVars, ...context.vars };
            const resolve = (value: any): any => {
                if (typeof value === 'string') {
                    const binding = value.match(/^\$\{([^{}]+)\}$/);
                    if (binding) {
                        const [root, ...path] = binding[1].trim().split('.');
                        const source = context.objects.find(object => object.name === root || object.id === root) ?? vars[root];
                        return path.length ? PropertyHelper.getPropertyValue(source, path.join('.')) : PropertyHelper.resolveValue(source);
                    }
                    return PropertyHelper.interpolate(value, vars, context.objects);
                }
                if (Array.isArray(value)) return value.map(resolve);
                if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item)]));
                return value;
            };
            const eventName = String(resolve(action.eventName || ''));
            let payload = resolve(action.payload ?? {});
            if (typeof payload === 'string') payload = JSON.parse(payload);
            const correlationId = String(resolve(action.correlationId || '') || context.vars.stageEvent?.eventId || '') || undefined;
            const result = type === 'stage_output'
                ? context.stageInterface.emit(eventName, payload, correlationId)
                : await context.stageInterface.receive({ name: eventName, eventId: String(resolve(action.eventId || '') || globalThis.crypto.randomUUID()), stageId: String(resolve(action.stageId || '')) || undefined, correlationId, payload });
            if (action.resultVariable) {
                const name = String(action.resultVariable).replace(/^\$\{|\}$/g, '');
                const variable = context.objects.find(object => object.name === name && 'value' in object);
                if (variable) variable.value = result;
                else context.contextVars[name] = result;
            }
            return result;
        }, {
            type,
            label: type === 'stage_input' ? 'Stage-Eingang auslösen' : 'Stage-Ausgang senden',
            description: type === 'stage_input' ? 'Sendet ein Ereignis an einen deklarierten Eingang der aktiven Stage.' : 'Meldet ein deklariertes Stage-Ereignis an verbundene Empfänger.',
            parameters: [
                { name: 'eventName', label: 'Eventname', type: 'string' },
                { name: 'payload', label: 'Nutzdaten (JSON)', type: 'json', defaultValue: {} },
                { name: 'correlationId', label: 'Bezug zum Eingangs-Event', type: 'string', hint: 'Leer: Kennung des auslösenden Stage-Events.' },
                ...(type === 'stage_input' ? [
                    { name: 'stageId', label: 'Ziel-Stage (leer = aktiv)', type: 'string' as const },
                    { name: 'eventId', label: 'Event-Kennung', type: 'string' as const, hint: 'Bei Wiederholung dieselbe Kennung senden; leer erzeugt eine neue.' }
                ] : []),
                { name: 'resultVariable', label: 'Ergebnisvariable', type: 'variable', source: 'variables' }
            ]
        });
    }
}
