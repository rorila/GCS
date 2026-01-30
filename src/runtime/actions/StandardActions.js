import { actionRegistry } from '../ActionRegistry';
import { PropertyHelper } from '../PropertyHelper';
import { ExpressionParser } from '../ExpressionParser';
import { AnimationManager } from '../AnimationManager';
import { serviceRegistry } from '../../services/ServiceRegistry';
/**
 * Hilfsfunktion zum Auflösen von Targets (aus ActionExecutor kopiert/angepasst)
 */
function resolveTarget(targetName, objects, vars, contextObj) {
    if (!targetName)
        return null;
    if ((targetName === '$eventSource' || targetName === 'self' || targetName === '$self') && contextObj)
        return contextObj;
    if ((targetName === 'other' || targetName === '$other') && vars.otherSprite)
        return vars.otherSprite;
    let actualName = targetName;
    if (targetName.startsWith('${') && targetName.endsWith('}')) {
        const varName = targetName.substring(2, targetName.length - 1);
        const varVal = vars[varName];
        if (varVal && typeof varVal === 'object' && varVal.id)
            return varVal;
        if (varVal)
            actualName = String(varVal);
    }
    return objects.find(o => o.name === actualName || o.id === actualName || o.name?.toLowerCase() === actualName.toLowerCase());
}
/**
 * REGISTRIERUNG ALLER STANDARD-AKTIONEN
 */
export function registerStandardActions(objects) {
    // 1. Property ändern
    actionRegistry.register('property', (action, context) => {
        const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
        if (target && action.changes) {
            Object.keys(action.changes).forEach(prop => {
                const rawValue = action.changes[prop];
                const value = PropertyHelper.interpolate(String(rawValue), context.vars, objects);
                PropertyHelper.setPropertyValue(target, prop, PropertyHelper.autoConvert(value));
            });
        }
    }, {
        type: 'property',
        label: 'Eigenschaft ändern',
        description: 'Ändert eine oder mehrere Eigenschaften eines Objekts.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects' },
            { name: 'changes', label: 'Änderungen (JSON)', type: 'json', hint: 'Beispiel: { "text": "Hallo", "visible": true }' }
        ]
    });
    // 2. Variable setzen
    actionRegistry.register('variable', (action, context) => {
        const srcObj = resolveTarget(action.source, objects, context.vars, context.contextVars);
        if (srcObj && action.variableName && action.sourceProperty) {
            const val = PropertyHelper.getPropertyValue(srcObj, action.sourceProperty);
            context.vars[action.variableName] = val;
            context.contextVars[action.variableName] = val;
        }
    }, {
        type: 'variable',
        label: 'Variable setzen',
        description: 'Kopiert den Wert einer Objekteigenschaft in eine Variable.',
        parameters: [
            { name: 'variableName', label: 'Variablen-Name', type: 'variable', source: 'variables' },
            { name: 'source', label: 'Quell-Objekt', type: 'object', source: 'objects' },
            { name: 'sourceProperty', label: 'Quell-Eigenschaft', type: 'string', placeholder: 'z.B. x' }
        ]
    });
    // 3. Berechnung
    actionRegistry.register('calculate', (action, context) => {
        if (action.formula) {
            const result = ExpressionParser.evaluate(action.formula, { ...context.contextVars, ...context.vars });
            if (action.resultVariable) {
                context.vars[action.resultVariable] = result;
                context.contextVars[action.resultVariable] = result;
            }
        }
    }, {
        type: 'calculate',
        label: 'Berechnung',
        description: 'Führt eine mathematische Berechnung aus.',
        parameters: [
            { name: 'resultVariable', label: 'Ziel-Variable', type: 'variable', source: 'variables' },
            { name: 'formula', label: 'Formel', type: 'string', placeholder: 'z.B. score + 10' }
        ]
    });
    // 4. Animation
    actionRegistry.register('animate', (action, context) => {
        const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
        if (target) {
            const toValue = Number(PropertyHelper.interpolate(String(action.to), context.vars, objects));
            AnimationManager.getInstance().addTween(target, action.property || 'x', toValue, action.duration || 500, action.easing || 'easeOut');
        }
    }, {
        type: 'animate',
        label: 'Animieren',
        description: 'Animiert eine Eigenschaft eines Objekts.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects' },
            { name: 'property', label: 'Eigenschaft', type: 'string', defaultValue: 'x' },
            { name: 'to', label: 'Ziel-Wert', type: 'number' },
            { name: 'duration', label: 'Dauer (ms)', type: 'number', defaultValue: 500 },
            { name: 'easing', label: 'Easing', type: 'select', source: 'easing-functions', defaultValue: 'easeOut' }
        ]
    });
    // 5. Bewegen zu
    actionRegistry.register('move_to', (action, context) => {
        const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
        if (target) {
            const toX = Number(PropertyHelper.interpolate(String(action.x), context.vars, objects));
            const toY = Number(PropertyHelper.interpolate(String(action.y), context.vars, objects));
            if (typeof target.moveTo === 'function') {
                target.moveTo(toX, toY, action.duration || 500, action.easing || 'easeOut');
            }
            else {
                AnimationManager.getInstance().addTween(target, 'x', toX, action.duration || 500, action.easing || 'easeOut');
                AnimationManager.getInstance().addTween(target, 'y', toY, action.duration || 500, action.easing || 'easeOut');
            }
        }
    }, {
        type: 'move_to',
        label: 'Bewegen zu',
        description: 'Bewegt ein Objekt an eine bestimmte Position.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects' },
            { name: 'x', label: 'Ziel-X', type: 'number' },
            { name: 'y', label: 'Ziel-Y', type: 'number' },
            { name: 'duration', label: 'Dauer (ms)', type: 'number', defaultValue: 500 },
            { name: 'easing', label: 'Easing', type: 'select', source: 'easing-functions', defaultValue: 'easeOut' }
        ]
    });
    // 6. Navigation
    actionRegistry.register('navigate', (action, context) => {
        let targetGame = PropertyHelper.interpolate(action.target, context.vars, objects);
        if (targetGame && context.onNavigate) {
            context.onNavigate(targetGame, action.params);
        }
    }, {
        type: 'navigate',
        label: 'Spiel wechseln',
        description: 'Wechselt zu einem anderen Projekt.',
        parameters: [
            { name: 'target', label: 'Ziel-Projekt', type: 'string' }
        ]
    });
    actionRegistry.register('navigate_stage', (action, context) => {
        const stageId = action.params?.stageId || action.stageId;
        if (stageId && context.onNavigate) {
            const resolved = PropertyHelper.interpolate(String(stageId), context.vars, objects);
            context.onNavigate(`stage:${resolved}`, action.params);
        }
    }, {
        type: 'navigate_stage',
        label: 'Stage wechseln',
        description: 'Wechselt zu einer anderen Stage innerhalb des Projekts.',
        parameters: [
            { name: 'stageId', label: 'Ziel-Stage', type: 'stage', source: 'stages' }
        ]
    });
    // 7. Service Calls
    actionRegistry.register('service', async (action, context) => {
        if (action.service && action.method && serviceRegistry.has(action.service)) {
            const params = Object.values(action.serviceParams || {}).map(v => PropertyHelper.interpolate(String(v), { ...context.contextVars, ...context.vars }, objects));
            const result = await serviceRegistry.call(action.service, action.method, params);
            if (action.resultVariable) {
                context.vars[action.resultVariable] = result;
                context.contextVars[action.resultVariable] = result;
            }
        }
    }, {
        type: 'service',
        label: 'Service aufrufen',
        description: 'Ruft eine Methode eines registrierten Services auf.',
        parameters: [
            { name: 'service', label: 'Service', type: 'select', source: 'services' },
            { name: 'method', label: 'Methode', type: 'string' },
            { name: 'serviceParams', label: 'Parameter (JSON)', type: 'json' },
            { name: 'resultVariable', label: 'Ergebnis speichern in', type: 'variable', source: 'variables' }
        ]
    });
    // 8. Multiplayer Room Management
    actionRegistry.register('create_room', (action, context) => {
        if (context.multiplayerManager) {
            let gameName = PropertyHelper.interpolate(action.game, context.vars, objects);
            context.multiplayerManager.createRoom(gameName);
        }
    }, {
        type: 'create_room',
        label: 'Multiplayer-Raum erstellen',
        description: 'Erstellt einen neuen Multiplayer-Raum.',
        parameters: [
            { name: 'game', label: 'Spiel-Identifikator', type: 'string' }
        ]
    });
    actionRegistry.register('join_room', (action, context) => {
        if (context.multiplayerManager) {
            let code = action.params?.code ? PropertyHelper.interpolate(String(action.params.code), context.vars, objects) : '';
            if (code.length >= 4) {
                context.multiplayerManager.joinRoom(code);
            }
        }
    }, {
        type: 'join_room',
        label: 'Multiplayer-Raum beitreten',
        description: 'Tritt einem Multiplayer-Raum bei.',
        parameters: [
            { name: 'code', label: 'Raum-Code', type: 'string' }
        ]
    });
}
