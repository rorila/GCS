import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';
import { AnimationManager } from '../../AnimationManager';
import { resolveTarget, isPureBinding } from '../ActionHelper';
import { Logger } from '../../../utils/Logger';

const runtimeLogger = Logger.get('Action', 'Runtime_Execution');

export function registerAnimationActions() {
    
    // Anmerkung: Die alte StandardActions hatte zwei "animate" Aktionen. Die zweite (Effekte) hat die erste überschrieben.
    // Für Abwärtskompatibilität implementieren wir nur die letzte Variante (Effekte), die tatsächlich von der UI genutzt wurde.
    actionRegistry.register('animate', (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        // Robuster Target-Lookup: 'target' ist der Standard. 'referenceObject' ist ein Fallback
        // für Actions, die von einem anderen Typ (z.B. spawn_object) umkonfiguriert wurden
        // und noch das alte Feld-Schema mitbringen.
        const rawTarget = action.target || action.referenceObject || '';
        // Eine reine ${Var}-Bindung wird NICHT vorab interpoliert: Haelt die Variable
        // ein Objekt (z.B. eine Record-Zeile aus list_get), ergaebe das "[object Object]".
        // resolveTarget entpackt solche Werte selbst.
        const rawTargetStr = isPureBinding(rawTarget)
            ? String(rawTarget).trim()
            : PropertyHelper.interpolate(String(rawTarget), combinedContext, context.objects);
        const effect = action.effect || 'shake';
        const duration = Number(action.duration) || 500;
        
        const targetNames = rawTargetStr.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        
        if (targetNames.length === 0) {
            runtimeLogger.warn(`[Action: animate] Kein Ziel definiert. action.target="${action.target}", action.referenceObject="${action.referenceObject}"`);
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
                    case 'grow': {
                        const growScale = Number(action.targetScale);
                        animManager.grow(targetObj, (isNaN(growScale) || growScale <= 0) ? 2.0 : growScale, duration);
                        break;
                    }
                    case 'shrink': {
                        let shrinkScale: number;
                        if (action.targetScale === undefined || action.targetScale === null || String(action.targetScale).trim() === '') {
                            shrinkScale = 0.3;
                        } else {
                            const raw = Number(action.targetScale);
                            if (isNaN(raw) || raw >= 1) {
                                shrinkScale = 0.3;
                            } else {
                                shrinkScale = raw;
                            }
                        }
                        animManager.shrink(targetObj, shrinkScale, duration);
                        break;
                    }
                    case 'explode':
                        animManager.explode(targetObj, Number(action.fragments) || 9, Number(action.spread) || 120, duration);
                        break;
                    case 'pop':
                        animManager.pop(targetObj, Number(action.fragments) || 9, duration);
                        break;
                    case 'implode': {
                        let sourceObj: any = null;
                        const rawSource = action.source || '';
                        const rawSourceStr = PropertyHelper.interpolate(String(rawSource), combinedContext, context.objects);
                        if (rawSourceStr) {
                            sourceObj = resolveTarget(rawSourceStr, context.objects, context.vars, context.eventData);
                        } else if (context.eventData?.contactX !== undefined && context.eventData?.contactY !== undefined) {
                            sourceObj = { x: context.eventData.contactX, y: context.eventData.contactY, width: 0, height: 0 };
                        }
                        animManager.implode(targetObj, sourceObj, duration);
                        break;
                    }
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
                    case 'flip': {
                        const midpointTask = action.midpointTask || '';
                        const onMidpoint = midpointTask && context.runTask
                            ? () => {
                                const interpolatedTask = PropertyHelper.interpolate(String(midpointTask), { ...context.contextVars, ...context.vars, $eventData: context.eventData }, context.objects);
                                context.runTask!(interpolatedTask, { self: targetObj, sender: targetObj, target: targetObj }, targetObj);
                            }
                            : undefined;
                        animManager.flip(targetObj, duration, onMidpoint, context.objects);
                        break;
                    }
                    default: {
                        // Legacy-Effekte: shake, pulse, bounce, fade
                        if (typeof (animManager as any)[effect] === 'function') {
                            let param2 = undefined;
                            if (effect === 'shake') param2 = Number(action.intensity) || 5;
                            if (effect === 'pulse') param2 = Number(action.scale) || 1.15;
                            if (effect === 'bounce') param2 = Number(action.height) || 20;
                            if (effect === 'fade') param2 = action.targetOpacity !== undefined && !isNaN(Number(action.targetOpacity)) ? Number(action.targetOpacity) : 0;

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
                runtimeLogger.info(`[Action: animate] ${effect} auf "${targetObj.name}" (${targetName}) erfolgreich aufgerufen.`);
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
            { name: 'target', label: 'Ziel-Objekt', type: 'select', source: 'objects', allowVariableBinding: true, defaultValue: '', placeholder: '--- Komponente auswählen ---', hint: 'Das zu animierende Objekt ("self" = das auslösende Objekt, oder ${Var} mit Objekt-ID/Name)' },
            { name: 'effect', label: 'Effekt', type: 'select', options: [
                'shake', 'pulse', 'bounce', 'fade', 
                'grow', 'shrink', 'explode', 'pop', 'implode',
                'fadeIn', 'fadeOut', 'spin', 'wobble', 'flip'
            ], defaultValue: 'shake' },
            { name: 'duration', label: 'Dauer (ms)', type: 'number', defaultValue: 500, hint: 'Zeit in Millisekunden' },
            { name: 'source', label: 'Quell-Objekt (Saug-Ziel)', type: 'select', source: 'objects', allowVariableBinding: true, defaultValue: '', placeholder: '--- Objekt auswählen ---', hint: 'Optional: Objekt, auf das eingesaugt wird (self/other/Name). Leer = Kollisionskontaktpunkt (contactX/contactY) bzw. eigene Mitte.', visibleWhen: { field: 'effect', values: ['implode'] } },
            { name: 'targetScale', label: 'Ziel-Skalierung', type: 'number', defaultValue: 2.0, hint: 'Für grow/shrink', visibleWhen: { field: 'effect', values: ['grow', 'shrink', 'pulse'] } },
            { name: 'fragments', label: 'Fragmente', type: 'number', defaultValue: 9, hint: 'Für explode/pop', visibleWhen: { field: 'effect', values: ['explode', 'pop'] } },
            { name: 'spread', label: 'Ausbreitung (px)', type: 'number', defaultValue: 120, hint: 'Für explode', visibleWhen: { field: 'effect', values: ['explode'] } },
            { name: 'degrees', label: 'Grad', type: 'number', defaultValue: 360, hint: 'Für spin', visibleWhen: { field: 'effect', values: ['spin'] } },
            { name: 'intensity', label: 'Intensität', type: 'number', defaultValue: 15, hint: 'Für wobble/shake', visibleWhen: { field: 'effect', values: ['wobble', 'shake'] } },
            { name: 'height', label: 'Sprunghöhe (px)', type: 'number', defaultValue: 20, hint: 'Für bounce', visibleWhen: { field: 'effect', values: ['bounce'] } },
            { name: 'targetOpacity', label: 'Ziel-Transparenz (0-1)', type: 'number', defaultValue: 0, hint: 'Für fade', visibleWhen: { field: 'effect', values: ['fade'] } },
            { name: 'midpointTask', label: 'Midpoint-Task', type: 'select', source: 'tasks', defaultValue: '', placeholder: '--- Task auswählen ---', hint: 'Wird bei 50% des Flip-Effekts ausgeführt (z.B. um das Bild zu wechseln).', visibleWhen: { field: 'effect', values: ['flip'] } }
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
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects', allowVariableBinding: true, hint: 'Objektname, "self" oder ${Var} mit Objekt-ID/Name' },
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
            { name: 'target', label: 'Ziel-Sprite', type: 'select', source: 'objects', allowVariableBinding: true, hint: 'Das Sprite mit einer TImageList (auch ${Var} mit Objekt-ID/Name)' },
            { name: 'fromFrame', label: 'Start-Frame', type: 'number', defaultValue: 0 },
            { name: 'toFrame', label: 'End-Frame', type: 'number', defaultValue: 7 },
            { name: 'duration', label: 'Dauer (ms)', type: 'number', defaultValue: 1000 }
        ]
    });
}
