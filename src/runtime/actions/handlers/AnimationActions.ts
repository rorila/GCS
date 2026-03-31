import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';
import { AnimationManager } from '../../AnimationManager';
import { resolveTarget } from '../ActionHelper';
import { Logger } from '../../../utils/Logger';

const runtimeLogger = Logger.get('Action', 'Runtime_Execution');

export function registerAnimationActions() {
    
    // Anmerkung: Die alte StandardActions hatte zwei "animate" Aktionen. Die zweite (Effekte) hat die erste überschrieben.
    // Für Abwärtskompatibilität implementieren wir nur die letzte Variante (Effekte), die tatsächlich von der UI genutzt wurde.
    actionRegistry.register('animate', (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        const rawTargetStr = PropertyHelper.interpolate(String(action.target || ''), combinedContext, context.objects);
        const effect = action.effect || 'shake';
        const duration = Number(action.duration) || 500;
        
        const targetNames = rawTargetStr.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        
        if (targetNames.length === 0) {
            runtimeLogger.warn('[Action: animate] Kein Ziel definiert.');
            return false;
        }

        let atLeastOneAnimated = false;
        const animManager = AnimationManager.getInstance();

        for (const targetName of targetNames) {
            const targetObj = resolveTarget(targetName, context.objects, context.vars, context.eventData);
            if (!targetObj) {
                runtimeLogger.warn(`[Action: animate] Zielkomponente "${targetName}" nicht gefunden.`);
                continue;
            }

            atLeastOneAnimated = true;
            try {
                if (typeof (animManager as any)[effect] === 'function') {
                    let param2 = undefined;
                    if (effect === 'shake') param2 = Number(action.intensity) || 5;
                    if (effect === 'pulse') param2 = Number(action.scale) || 1.15;
                    if (effect === 'bounce') param2 = Number(action.height) || 20;
                    if (effect === 'fade') param2 = Number(action.targetOpacity) !== undefined && !isNaN(Number(action.targetOpacity)) ? Number(action.targetOpacity) : 0;

                    if (param2 !== undefined) {
                        (animManager as any)[effect](targetObj, param2, duration);
                    } else {
                        (animManager as any)[effect](targetObj, undefined, duration);
                    }
                    runtimeLogger.info(`[Action: animate] ${effect} auf ${targetName} angewendet.`);
                } else {
                    runtimeLogger.warn(`[Action: animate] Effekt "${effect}" ist im AnimationManager nicht definiert.`);
                }
            } catch (err) {
                 runtimeLogger.error(`[Action: animate] Fehler beim Ausführen von ${effect}:`, err);
            }
        }
        return atLeastOneAnimated;
    }, {
        type: 'animate',
        label: 'Komponente animieren',
        description: 'Startet eine sofortige Animation auf einer Komponente.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'select', source: 'objects', hint: 'Das zu animierende Objekt' },
            { name: 'effect', label: 'Effekt', type: 'select', options: ['shake', 'pulse', 'bounce', 'fade'], defaultValue: 'shake' },
            { name: 'duration', label: 'Dauer (ms)', type: 'number', defaultValue: 500, hint: 'Zeit in Millisekunden' }
        ]
    });

    // 5. Bewegen zu
    actionRegistry.register('move_to', (action, context) => {
        const target = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (target) {
            const toX = Number(PropertyHelper.interpolate(String(action.x), combinedContext, context.objects));
            const toY = Number(PropertyHelper.interpolate(String(action.y), combinedContext, context.objects));
            if (typeof target.moveTo === 'function') {
                target.moveTo(toX, toY, action.duration || 500, action.easing || 'easeOut');
            } else {
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
}
