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
                // Effekt-spezifische Parameter auslesen
                switch (effect) {
                    case 'grow':
                        animManager.grow(targetObj, Number(action.targetScale) || 2.0, duration);
                        break;
                    case 'shrink':
                        animManager.shrink(targetObj, Number(action.targetScale) || 0.3, duration);
                        break;
                    case 'explode':
                        animManager.explode(targetObj, Number(action.fragments) || 9, Number(action.spread) || 120, duration);
                        break;
                    case 'pop':
                        animManager.pop(targetObj, Number(action.fragments) || 9, duration);
                        break;
                    case 'fadeIn':
                        animManager.fadeIn(targetObj, duration);
                        break;
                    case 'fadeOut':
                        animManager.fadeOut(targetObj, duration);
                        break;
                    case 'spin':
                        animManager.spin(targetObj, Number(action.degrees) || 360, duration);
                        break;
                    case 'wobble':
                        animManager.wobble(targetObj, Number(action.intensity) || 15, duration);
                        break;
                    case 'flip':
                        animManager.flip(targetObj, duration);
                        break;
                    default: {
                        // Legacy-Effekte: shake, pulse, bounce, fade
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
                        } else {
                            runtimeLogger.warn(`[Action: animate] Effekt "${effect}" ist im AnimationManager nicht definiert.`);
                        }
                    }
                }
                runtimeLogger.info(`[Action: animate] ${effect} auf ${targetName} angewendet.`);
            } catch (err) {
                 runtimeLogger.error(`[Action: animate] Fehler beim Ausführen von ${effect}:`, err);
            }
        }
        return atLeastOneAnimated;
    }, {
        type: 'animate',
        label: 'Komponente animieren',
        description: 'Startet eine Animation/Effekt auf einer Komponente.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'select', source: 'objects', hint: 'Das zu animierende Objekt' },
            { name: 'effect', label: 'Effekt', type: 'select', options: [
                'shake', 'pulse', 'bounce', 'fade', 
                'grow', 'shrink', 'explode', 'pop',
                'fadeIn', 'fadeOut', 'spin', 'wobble', 'flip'
            ], defaultValue: 'shake' },
            { name: 'duration', label: 'Dauer (ms)', type: 'number', defaultValue: 500, hint: 'Zeit in Millisekunden' },
            { name: 'targetScale', label: 'Ziel-Skalierung', type: 'number', defaultValue: 2.0, hint: 'Für grow/shrink', visibleWhen: { field: 'effect', values: ['grow', 'shrink', 'pulse'] } },
            { name: 'fragments', label: 'Fragmente', type: 'number', defaultValue: 9, hint: 'Für explode/pop', visibleWhen: { field: 'effect', values: ['explode', 'pop'] } },
            { name: 'spread', label: 'Ausbreitung (px)', type: 'number', defaultValue: 120, hint: 'Für explode', visibleWhen: { field: 'effect', values: ['explode'] } },
            { name: 'degrees', label: 'Grad', type: 'number', defaultValue: 360, hint: 'Für spin', visibleWhen: { field: 'effect', values: ['spin'] } },
            { name: 'intensity', label: 'Intensität', type: 'number', defaultValue: 15, hint: 'Für wobble/shake', visibleWhen: { field: 'effect', values: ['wobble', 'shake'] } },
            { name: 'height', label: 'Sprunghöhe (px)', type: 'number', defaultValue: 20, hint: 'Für bounce', visibleWhen: { field: 'effect', values: ['bounce'] } },
            { name: 'targetOpacity', label: 'Ziel-Transparenz (0-1)', type: 'number', defaultValue: 0, hint: 'Für fade', visibleWhen: { field: 'effect', values: ['fade'] } }
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

    // 6. Sprite Frame-Animation
    actionRegistry.register('sprite_animate', (action, context) => {
        const target = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        if (!target) {
            runtimeLogger.warn('[Action: sprite_animate] Zielkomponente nicht gefunden.');
            return false;
        }

        const fromFrame = Number(action.fromFrame) || 0;
        const toFrame = Number(action.toFrame) || 7;
        const duration = Number(action.duration) || 1000;

        AnimationManager.getInstance().spriteAnimate(target, fromFrame, toFrame, duration);
        runtimeLogger.info(`[Action: sprite_animate] Frames ${fromFrame}→${toFrame} auf "${target.name}" (${duration}ms)`);
        return true;
    }, {
        type: 'sprite_animate',
        label: 'Sprite-Frame Animation',
        description: 'Durchläuft die Frames einer TImageList von Start bis Ende (einmalig).',
        parameters: [
            { name: 'target', label: 'Ziel-Sprite', type: 'select', source: 'objects', hint: 'Das Sprite mit einer TImageList' },
            { name: 'fromFrame', label: 'Start-Frame', type: 'number', defaultValue: 0 },
            { name: 'toFrame', label: 'End-Frame', type: 'number', defaultValue: 7 },
            { name: 'duration', label: 'Dauer (ms)', type: 'number', defaultValue: 1000 }
        ]
    });
}
