import { actionRegistry } from '../ActionRegistry';
import { PropertyHelper } from '../PropertyHelper';
import { ExpressionParser } from '../ExpressionParser';
import { AnimationManager } from '../AnimationManager';
import { serviceRegistry } from '../../services/ServiceRegistry';

/**
 * Hilfsfunktion zum Auflösen von Targets (aus ActionExecutor kopiert/angepasst)
 */
function resolveTarget(targetName: string, objects: any[], vars: Record<string, any>, contextObj?: any): any {
    if (!targetName) return null;
    if ((targetName === '$eventSource' || targetName === 'self' || targetName === '$self') && contextObj) return contextObj;
    if ((targetName === 'other' || targetName === '$other') && vars.otherSprite) return vars.otherSprite;

    let actualName = targetName;
    if (targetName.startsWith('${') && targetName.endsWith('}')) {
        const varName = targetName.substring(2, targetName.length - 1);
        const varVal = vars[varName];
        if (varVal && typeof varVal === 'object' && varVal.id) return varVal;
        if (varVal) actualName = String(varVal);
    }

    return objects.find(o => o.name === actualName || o.id === actualName || o.name?.toLowerCase() === actualName.toLowerCase());
}

/**
 * REGISTRIERUNG ALLER STANDARD-AKTIONEN
 */
export function registerStandardActions(objects: any[]) {

    // 1. Variable / Property
    actionRegistry.register('property', (action, context) => {
        const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
        if (target && action.changes) {
            Object.keys(action.changes).forEach(prop => {
                const rawValue = action.changes[prop];
                const value = PropertyHelper.interpolate(String(rawValue), context.vars, objects);
                PropertyHelper.setPropertyValue(target, prop, PropertyHelper.autoConvert(value));
            });
        }
    });

    actionRegistry.register('variable', (action, context) => {
        const srcObj = resolveTarget(action.source, objects, context.vars, context.contextVars);
        if (srcObj && action.variableName && action.sourceProperty) {
            const val = PropertyHelper.getPropertyValue(srcObj, action.sourceProperty);
            context.vars[action.variableName] = val;
            context.contextVars[action.variableName] = val;
        }
    });

    // 2. Berechnung
    actionRegistry.register('calculate', (action, context) => {
        if (action.formula) {
            const result = ExpressionParser.evaluate(action.formula, { ...context.contextVars, ...context.vars });
            if (action.resultVariable) {
                context.vars[action.resultVariable] = result;
                context.contextVars[action.resultVariable] = result;
            }
        }
    });

    // 3. Animation
    actionRegistry.register('animate', (action, context) => {
        const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
        if (target) {
            const toValue = Number(PropertyHelper.interpolate(String(action.to), context.vars, objects));
            AnimationManager.getInstance().addTween(target, action.property || 'x', toValue, action.duration || 500, action.easing || 'easeOut');
        }
    });

    actionRegistry.register('move_to', (action, context) => {
        const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
        if (target) {
            const toX = Number(PropertyHelper.interpolate(String(action.x), context.vars, objects));
            const toY = Number(PropertyHelper.interpolate(String(action.y), context.vars, objects));
            if (typeof target.moveTo === 'function') {
                target.moveTo(toX, toY, action.duration || 500, action.easing || 'easeOut');
            } else {
                AnimationManager.getInstance().addTween(target, 'x', toX, action.duration || 500, action.easing || 'easeOut');
                AnimationManager.getInstance().addTween(target, 'y', toY, action.duration || 500, action.easing || 'easeOut');
            }
        }
    });

    // 4. Methoden-Aufrufe
    // 7. Navigation
    actionRegistry.register('navigate', (action, context) => {
        let targetGame = PropertyHelper.interpolate(action.target, context.vars, objects);
        if (targetGame && context.onNavigate) {
            context.onNavigate(targetGame, action.params);
        }
    });

    actionRegistry.register('navigate_stage', (action, context) => {
        const stageId = action.params?.stageId || action.stageId;
        if (stageId && context.onNavigate) {
            const resolved = PropertyHelper.interpolate(String(stageId), context.vars, objects);
            context.onNavigate(`stage:${resolved}`, action.params);
        }
    });

    // 8. Service Calls
    actionRegistry.register('service', async (action, context) => {
        if (action.service && action.method && serviceRegistry.has(action.service)) {
            const params = Object.values(action.serviceParams || {}).map(v =>
                PropertyHelper.interpolate(String(v), { ...context.contextVars, ...context.vars }, objects)
            );
            const result = await serviceRegistry.call(action.service, action.method, params);
            if (action.resultVariable) {
                context.vars[action.resultVariable] = result;
                context.contextVars[action.resultVariable] = result;
            }
        }
    });

    // 9. Multiplayer Room Management
    actionRegistry.register('create_room', (action, context) => {
        if (context.multiplayerManager) {
            let gameName = PropertyHelper.interpolate(action.game, context.vars, objects);
            context.multiplayerManager.createRoom(gameName);
        }
    });

    actionRegistry.register('join_room', (action, context) => {
        if (context.multiplayerManager) {
            let code = action.params?.code ? PropertyHelper.interpolate(String(action.params.code), context.vars, objects) : '';
            if (code.length >= 4) {
                context.multiplayerManager.joinRoom(code);
            }
        }
    });
}
