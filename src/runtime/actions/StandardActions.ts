import { actionRegistry } from '../ActionRegistry';
import { PropertyHelper } from '../PropertyHelper';
import { ExpressionParser } from '../ExpressionParser';
import { AnimationManager } from '../AnimationManager';
import { serviceRegistry } from '../../services/ServiceRegistry';
import { DebugLogService } from '../../services/DebugLogService';
import { ActionApiHandler } from '../../components/actions/ActionApiHandler';
import { Logger } from '../../utils/Logger';

const runtimeLogger = Logger.get('Action', 'Runtime_Execution');
const dataLogger = Logger.get('Action', 'DataStore_Sync');

/**
 * Hilfsfunktion zum Auflösen von Targets
 */
function resolveTarget(targetName: string, objects: any[], vars: Record<string, any>, eventData?: any): any {
    if (!targetName) return null;

    // Clean up Editor UI artifacts like " (nicht in Stage)"
    const cleanTargetName = targetName.replace(/\s*\(nicht in Stage\)$/i, '');
    
    // Normalize %Self% / %Other% / self / Self etc.
    const normalized = cleanTargetName.replace(/%/g, '').toLowerCase();

    // Resolve 'self' and 'other' from event context (collision events provide {self, other, hitSide})
    if (normalized === 'self') {
        if (eventData?.self) return eventData.self;
        // Fallback: eventData IS the context object itself
        if (eventData && eventData.name) return eventData;
        return null;
    }
    if (normalized === 'other') {
        if (eventData?.other) return eventData.other;
        return null;
    }

    let actualName = cleanTargetName;
    if (cleanTargetName.startsWith('${') && cleanTargetName.endsWith('}')) {
        const varName = cleanTargetName.substring(2, cleanTargetName.length - 1);
        actualName = String(vars[varName] || cleanTargetName);
    }
    let foundObj = objects.find(o => o.name === actualName || o.id === actualName);
    if (!foundObj && typeof vars === 'object' && vars[actualName]) {
        foundObj = vars[actualName];
    }
    return foundObj;
}

/**
 * REGISTRIERUNG ALLER STANDARD-AKTIONEN
 */
export function registerStandardActions() {

    // 1. Property ändern
    actionRegistry.register('property', (action, context) => {
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
    }, {
        type: 'property',
        label: 'Eigenschaft ändern',
        description: 'Ändert eine oder mehrere Eigenschaften eines Objekts.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects' },
            { name: 'changes', label: 'Änderungen (JSON)', type: 'json', hint: 'Beispiel: { "text": "Hallo", "visible": true }' }
        ]
    });

    // 1b. Alias: 'action' → identisch mit 'property' (auto-generierte Actions nutzen diesen Typ)
    actionRegistry.register('action', actionRegistry.getHandler('property')!, {
        type: 'action',
        label: 'Eigenschaft ändern',
        description: 'Alias für property — ändert eine oder mehrere Eigenschaften eines Objekts.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects' },
            { name: 'changes', label: 'Änderungen (JSON)', type: 'json', hint: 'Beispiel: { "text": "Hallo", "visible": true }' }
        ]
    });

    // 2. Variable lesen / setzen (Read Variable)
    actionRegistry.register('variable', (action, context) => {
        let val: any = undefined;
        const sourceName = action.source;
        const variableName = action.variableName;

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

        // 4. FIX (v3.3.17): Direkt definierten Literal-Wert verwenden (z.B. set_variable mit value:"")
        //    Wichtig: leerer String "" ist ein valider Wert, daher explizite Prüfung auf undefined
        //    Priorität geändert (neu): Wenn action.value explizit gesetzt ist (und nicht auf ein Objekt verweist)
        if ((val === undefined || (!action.source && !action.sourceProperty)) && action.value !== undefined) {
            const combinedCtx = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
            val = PropertyHelper.interpolate(String(action.value), combinedCtx, context.objects);
        }

        // Zuweisung
        if (val !== undefined && variableName) {
            context.vars[variableName] = val;
            context.contextVars[variableName] = val;

            // FIX: Auch das TVariable-Objekt in context.objects aktualisieren,
            // damit PropertyWatcher greift (analog zu calculate)
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

    }, {
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

    // 2b. Alias für Variable setzen (für UI-Unterscheidung)
    actionRegistry.register('set_variable', actionRegistry.getHandler('variable')!, {
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

    // 3. Berechnung
    actionRegistry.register('calculate', (action, context) => {
        // COMPATIBILITY FIX: Detect misclassified variable actions
        // Some older projects save variable-type actions (source/sourceProperty/variableName)
        // as type 'calculate'. Detect and handle them correctly.
        if (action.source && action.sourceProperty && action.variableName) {
            const srcObj = resolveTarget(action.source, context.objects, context.vars, context.eventData);
            let val: any = undefined;
            if (srcObj) {
                val = PropertyHelper.getPropertyValue(srcObj, action.sourceProperty);
            }
            if (val === undefined) {
                // Fallback: check vars/contextVars
                const varVal = context.vars[action.source] !== undefined ? context.vars[action.source] : context.contextVars[action.source];
                if (varVal !== undefined && typeof varVal === 'object' && varVal !== null) {
                    val = PropertyHelper.getPropertyValue(varVal, action.sourceProperty);
                }
            }
            runtimeLogger.info(`Variable-Read (via calculate): ${action.variableName} := ${action.source}.${action.sourceProperty} = ${val}`);
            if (action.variableName) {
                context.contextVars[action.variableName] = val;
                if (context.vars) {
                    context.vars[action.variableName] = val;
                }
            }
            return;
        }

        // Build evalContext with objects, vars, and self/other from eventData
        const objectMap = context.objects.reduce((acc: Record<string, any>, obj: any) => {
            if (obj.id) acc[obj.id] = obj;
            if (obj.name) acc[obj.name] = obj;
            return acc;
        }, {});

        const evalContext: Record<string, any> = {
            ...objectMap,
            ...context.contextVars,
            ...context.vars,
            $eventData: context.eventData
        };

        // Inject self/other for collision context
        // context.eventData = contextObj (the triggering TWindow, e.g. BallSprite)
        // context.vars.sender = contextObj (same as eventData)
        // context.vars.otherSprite = the collision partner object (e.g. RightPaddle)
        // context.vars.other = STRING name of collision partner (e.g. "RightPaddle")
        if (context.eventData && typeof context.eventData === 'object') {
            // self = the object that triggered the event
            if (!evalContext['self'] || typeof evalContext['self'] !== 'object') {
                evalContext['self'] = context.vars?.sender || context.eventData;
            }
            // other = the collision partner (otherSprite is the actual object, other is just a name string)
            if (!evalContext['other'] || typeof evalContext['other'] !== 'object') {
                const otherObj = context.vars?.otherSprite;
                if (otherObj && typeof otherObj === 'object') {
                    evalContext['other'] = otherObj;
                } else if (typeof evalContext['other'] === 'string' && objectMap[evalContext['other']]) {
                    // Resolve string name to actual object from objectMap
                    evalContext['other'] = objectMap[evalContext['other']];
                }
            }
        }

        let formula = action.formula || action.expression;

        // Fallback: If no formula but calcSteps exist, evaluate calcSteps
        if (!formula && action.calcSteps && Array.isArray(action.calcSteps) && action.calcSteps.length > 0) {
            try {
                let result: number = 0;

                for (let i = 0; i < action.calcSteps.length; i++) {
                    const step = action.calcSteps[i];

                    // Resolve the operand value
                    let operandValue: number = 0;

                    if (step.constant !== undefined && !step.variable) {
                        operandValue = Number(step.constant);
                    } else if ((step.operandType === 'variable' || !step.operandType) && step.variable) {
                        // Handle dot-notation: "other.y", "self.height" → resolve as property path
                        if (step.variable.includes('.')) {
                            const parts = step.variable.split('.');
                            const rootName = parts[0];  // e.g. "other", "self"
                            const propPath = parts.slice(1).join('.'); // e.g. "y", "height"
                            const rootObj = evalContext[rootName];
                            if (rootObj && typeof rootObj === 'object') {
                                operandValue = Number(PropertyHelper.getPropertyValue(rootObj, propPath)) || 0;
                            } else {
                                operandValue = NaN;
                            }
                        } else {
                            const v = evalContext[step.variable];
                            operandValue = v !== undefined ? Number(v) : NaN;
                        }
                    } else if (step.operandType === 'objectProperty' && step.source && step.property) {
                        // Read property from an object (self/other/named)
                        const srcObj = resolveTarget(step.source, context.objects, context.vars, context.eventData);
                        operandValue = srcObj ? Number(PropertyHelper.getPropertyValue(srcObj, step.property)) : NaN;
                    }

                    if (i === 0) {
                        // First step: set initial value
                        result = operandValue;
                    } else {
                        // Apply operator
                        switch (step.operator) {
                            case '+': result += operandValue; break;
                            case '-': result -= operandValue; break;
                            case '*': result *= operandValue; break;
                            case '/': result = operandValue !== 0 ? result / operandValue : NaN; break;
                            default: result = operandValue; break;
                        }
                    }
                }

                runtimeLogger.info(`CalcSteps result for "${action.name}": ${result} (Target: ${action.resultVariable})`);

                if (action.resultVariable) {
                    context.contextVars[action.resultVariable] = result;
                    if (context.vars) {
                        context.vars[action.resultVariable] = result;
                    }

                    // FIX: Auch das TVariable-Objekt aktualisieren (identisch zum formula-Pfad)
                    const varObj = context.objects.find((o: any) =>
                        (o.name === action.resultVariable || o.id === action.resultVariable) &&
                        (o.isVariable === true || o.className?.includes('Variable'))
                    );
                    if (varObj) {
                        varObj.value = result;
                        DebugLogService.getInstance().log('Variable',
                            `${action.resultVariable}.value changed: ${result}`, {
                            objectName: action.resultVariable,
                            flatten: true
                        });
                    }
                }
            } catch (err) {
                runtimeLogger.error(`Error evaluating calcSteps for "${action.name}":`, err);
            }
            return;
        }

        if (formula) {
            try {
                const result = ExpressionParser.evaluate(formula, evalContext);

                runtimeLogger.info(`Result of "${formula}" -> ${JSON.stringify(result)} (Target: ${action.resultVariable})`);

                if (action.resultVariable) {
                    context.contextVars[action.resultVariable] = result;
                    if (context.vars) {
                        context.vars[action.resultVariable] = result;
                    }

                    // FIX: Auch das TVariable-Objekt in context.objects aktualisieren,
                    // damit der PropertyWatcher das Binding-Update triggert.
                    // Ohne dies bleibt ReactiveRuntime.variables unverändert und
                    // Bindings wie ${Countdown} zeigen den alten Wert.
                    const varObj = context.objects.find((o: any) =>
                        (o.name === action.resultVariable || o.id === action.resultVariable) &&
                        (o.isVariable === true || o.className?.includes('Variable'))
                    );
                    if (varObj) {
                        varObj.value = result;
                        DebugLogService.getInstance().log('Variable',
                            `${action.resultVariable}.value changed: ${result}`, {
                            objectName: action.resultVariable,
                            flatten: true
                        });
                    }
                }
            } catch (err) {
                runtimeLogger.error(`Error evaluating "${formula}":`, err);
            }
        } else {
            runtimeLogger.warn('No formula/expression/calcSteps provided in action:', action);
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

    // 3b. Negate – Negiert numerische Properties eines Objekts (z.B. velocityX * -1)
    // Verwendet in Arkanoid/Tennis für Ball-Richtungsänderung bei Kollision.
    // Format: { type: 'negate', target: 'self'/'other'/Name, changes: { velocityX: true/1 } }
    actionRegistry.register('negate', (action, context) => {
        const target = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        if (target && action.changes) {
            Object.keys(action.changes).forEach(prop => {
                const currentValue = PropertyHelper.getPropertyValue(target, prop);
                if (typeof currentValue === 'number') {
                    // If velocity is 0, check for _prevVelocityX/Y saved by triggerBoundaryEvent
                    // This handles the case where boundary hit zeros velocity in the same frame as a collision
                    let valueToNegate = currentValue;
                    if (currentValue === 0) {
                        const prevKey = `_prev${prop.charAt(0).toUpperCase()}${prop.slice(1)}`;
                        const prevVal = (target as any)[prevKey];
                        if (typeof prevVal === 'number' && prevVal !== 0) {
                            valueToNegate = prevVal;
                            runtimeLogger.info(`Negate: Using saved previous ${prop}: ${prevVal} (current was 0)`);
                        }
                    }
                    const negated = valueToNegate * -1;
                    PropertyHelper.setPropertyValue(target, prop, negated);
                    runtimeLogger.info(`Negate: ${target.name || target.id}.${prop}: ${currentValue} -> ${negated}`);

                    // DebugLogService triggert Reactivity und kann bei 60fps / schnellen Kollisionen Framedrops verursachen
                    // DebugLogService.getInstance().log('Variable', `${target.name || target.id}.${prop} negiert: ${currentValue} → ${negated}`, {
                    //    objectName: target.name || target.id,
                    //    flatten: true
                    // });
                } else {
                    runtimeLogger.warn(`Negate: ${target.name || target.id}.${prop} ist kein numerischer Wert (${typeof currentValue}: ${currentValue})`);
                }
            });
        }
    }, {
        type: 'negate',
        label: 'Wert negieren',
        description: 'Negiert (multipliziert mit -1) numerische Eigenschaften eines Objekts. Typisch für Richtungsumkehr (z.B. velocityX).',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects' },
            { name: 'changes', label: 'Properties (JSON)', type: 'json', hint: 'z.B. { "velocityX": true }' }
        ]
    });

    // 4. Animation
    actionRegistry.register('animate', (action, context) => {
        const target = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (target) {
            const toValue = Number(PropertyHelper.interpolate(String(action.to), combinedContext, context.objects));
            AnimationManager.getInstance().addTween(target, action.property || 'x', toValue, action.duration || 500, action.easing || 'easeOut');
        }
    }, {
        type: 'animate',
        label: 'Animieren',
        description: 'Animiert eine Eigenschaft eines Objekts.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects' },
            { name: 'property', label: 'Eigenschaft', type: 'string', defaultValue: 'x' },
            { name: 'to', label: 'Ziel-Wert', type: 'string' },
            { name: 'duration', label: 'Dauer (ms)', type: 'number', defaultValue: 500 },
            { name: 'easing', label: 'Easing', type: 'select', source: 'easing-functions', defaultValue: 'easeOut' }
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

    // 6. Navigation
    actionRegistry.register('navigate', (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        let targetGame = PropertyHelper.interpolate(action.target, combinedContext, context.objects);
        if (targetGame && context.onNavigate) {
            context.onNavigate(targetGame, action.params);
        }
    }, {
        type: 'navigate',
        label: 'Spiel wechseln',
        hidden: true,
        description: 'Wechselt zu einem anderen Projekt.',
        parameters: [
            { name: 'target', label: 'Ziel-Projekt', type: 'string' }
        ]
    });

    actionRegistry.register('navigate_stage', (action, context) => {
        const stageId = action.stageId;
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (!stageId) return;

        const resolved = PropertyHelper.interpolate(String(stageId), combinedContext, context.objects);

        // Robust: Direkt über TStageController navigieren (funktioniert in JEDEM Host)
        const stageController = context.objects.find(
            (o: any) => o.className === 'TStageController' || o.constructor?.name === 'TStageController'
        );
        if (stageController && typeof (stageController as any).goToStage === 'function') {
            runtimeLogger.info(`Via TStageController → ${resolved}`);

            DebugLogService.getInstance().log('Action', `Stage wechselt zu: ${resolved}`, {
                objectName: 'TStageController',
                data: { stageId: resolved }
            });

            (stageController as any).goToStage(resolved);
            return;
        }

        // Fallback: über onNavigate-Callback (Editor-Modus)
        if (context.onNavigate) {
            runtimeLogger.info(`Via onNavigate fallback → stage:${resolved}`);

            DebugLogService.getInstance().log('Action', `Navigation zu Stage: ${resolved}`, {
                data: { stageId: resolved }
            });

            context.onNavigate(`stage:${resolved}`, action.params);
        }
    }, {
        type: 'navigate_stage',
        label: 'Stage wechseln',
        description: 'Wechselt zu einer anderen Stage innerhalb des Projekts.',
        parameters: [
            { name: 'stageId', label: 'Ziel-Stage', type: 'select', source: 'stages' }
        ]
    });

    // 7. Service Calls
    actionRegistry.register('service', async (action, context) => {
        if (action.service && action.method && serviceRegistry.has(action.service)) {
            const params = (Array.isArray(action.serviceParams) ? action.serviceParams : []).map((v: any) =>
                PropertyHelper.interpolate(String(v), { ...context.contextVars, ...context.vars }, context.objects)
            );
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
            { name: 'serviceParams', label: 'Parameter-Liste', type: 'json' },
            { name: 'resultVariable', label: 'Ergebnis speichern in', type: 'variable', source: 'variables' }
        ]
    });

    // 8. Multiplayer Room Management
    actionRegistry.register('create_room', (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (context.multiplayerManager) {
            let gameName = PropertyHelper.interpolate(action.game, combinedContext, context.objects);
            context.multiplayerManager.createRoom(gameName);
        }
    }, {
        type: 'create_room',
        label: 'Multiplayer-Raum erstellen',
        requiresMultiplayer: true,
        description: 'Erstellt einen neuen Multiplayer-Raum.',
        parameters: [
            { name: 'game', label: 'Spiel-Identifikator', type: 'string' }
        ]
    });

    actionRegistry.register('join_room', (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (context.multiplayerManager) {
            let code = action.params?.code ? PropertyHelper.interpolate(String(action.params.code), combinedContext, context.objects) : '';
            if (code.length >= 4) {
                context.multiplayerManager.joinRoom(code);
            }
        }
    }, {
        type: 'join_room',
        label: 'Multiplayer-Raum beitreten',
        requiresMultiplayer: true,
        description: 'Tritt einem Multiplayer-Raum bei.',
        parameters: [
            { name: 'code', label: 'Raum-Code', type: 'string' }
        ]
    });

    // 9. HTTP Request (API Call)
    actionRegistry.register('http', async (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };

        // Auto-URL Construction if 'resource' is present (DataAction support)
        let effectiveUrl = String(action.url || '');
        if (!effectiveUrl) {
            let res = action.resource;

            // If resource is missing, try to resolve from DataStore
            if (!res && action.dataStore) {
                const dsName = action.dataStore;
                const dsComponent = context.objects.find(o => o.name === dsName || o.id === dsName);
                res = (dsComponent as any)?.defaultCollection;
            }

            if (res) {
                effectiveUrl = `/api/data/${res}`;
                const qProp = action.queryProperty || action.property;
                const qVal = action.queryValue || action.value;
                const qOp = action.queryOperator || '==';

                if (qProp && qVal) {
                    const interpValue = PropertyHelper.interpolate(String(qVal), combinedContext, context.objects);
                    effectiveUrl += `?${qProp}=${encodeURIComponent(interpValue)}&operator=${qOp}`;
                }
            }
        }

        let url = PropertyHelper.interpolate(effectiveUrl, combinedContext, context.objects);
        let method = action.method || 'GET';

        // Runtime Safety: If requestJWT is true, we enforce the platform login route and POST method
        if (action.requestJWT) {
            if (!url || url === '/' || url.startsWith('/api/data/')) {
                dataLogger.info(`Auto-fixing URL for JWT request: ${url} -> /api/platform/login`);
                url = '/api/platform/login';
            }
            if (method === 'GET') {
                dataLogger.info(`Auto-fixing METHOD for JWT request: GET -> POST`);
                method = 'POST';
            }
        }
        let body = null;
        let parsedBody = {};

        if (method !== 'GET' && action.body) {
            const bodyStr = typeof action.body === 'object' ? JSON.stringify(action.body) : String(action.body);
            body = PropertyHelper.interpolate(bodyStr, combinedContext, context.objects);
            try {
                parsedBody = JSON.parse(body);
            } catch (e) {
                parsedBody = body;
            }
        }

        // Special: Auto-Body for JWT Login if nothing else is specified
        if (action.requestJWT && !action.body) {
            const qProp = action.queryProperty || action.property;
            const qVal = action.queryValue || action.value;
            if (qProp && qVal) {
                dataLogger.info(`Interpolating qVal "${qVal}" for qProp "${qProp}"`);
                const interpValue = PropertyHelper.interpolate(String(qVal), combinedContext, context.objects);
                dataLogger.info(`Interpolated Value: "${interpValue}"`);
                parsedBody = { [qProp]: interpValue };
                body = JSON.stringify(parsedBody);
                dataLogger.info(`Auto-constructed Login Body (JWT):`, parsedBody);
            }
        }

        // Log interpolated details for DebugLogViewer
        DebugLogService.getInstance().log('Action', `HTTP: ${method} ${url}`, {
            data: { type: 'http', method, url, body: parsedBody }
        });

        // Check if ApiSimulator service is available (Editor mode simulation)
        if (serviceRegistry.has('ApiSimulator')) {
            dataLogger.info(`Using API Simulation for: ${method} ${url}`);
            try {
                // Resolve storagePath from dataStore component if present
                const dsName = action.dataStore;
                const dsComponent = context.objects.find(o => o.name === dsName || o.id === dsName);
                const storageFile = (dsComponent as any)?.storagePath || 'db.json';

                if (action.requestJWT) {
                    dataLogger.info(`JWT Simulation Request: ${method} ${url}`, parsedBody);
                }
                let result = await serviceRegistry.call('ApiSimulator', 'request', [method, url, parsedBody, storageFile]);

                if (action.requestJWT) {
                    dataLogger.info(`JWT Simulation Result:`, result);
                    // Standard JWT handling: Save token & return User object
                    if (result && result.token) {
                        localStorage.setItem('auth_token', result.token);
                        dataLogger.info('Auto-saved JWT token to localStorage "auth_token"');
                    }
                    if (result && result.user) {
                        result = result.user;
                        dataLogger.info('Auto-unwrapped user object from JWT response');
                    }
                }

                // Smart-Mapping: Extract path if specified
                if (action.resultPath && result) {
                    result = PropertyHelper.getPropertyValue(result, action.resultPath);
                }

                // SQL Projection (SELECT name, role, count(*))
                if (action.selectFields && action.selectFields !== '*' && result) {
                    const fields = action.selectFields.split(',').map((f: string) => f.trim()).filter((f: string) => f);
                    const isCountOnly = fields.length === 1 && fields[0] === 'count(*)';

                    if (isCountOnly && Array.isArray(result)) {
                        result = result.length;
                        dataLogger.info(`Applied SQL COUNT Projection: ${result}`);
                    } else {
                        const project = (obj: any) => {
                            if (typeof obj !== 'object' || obj === null) return obj;
                            const partial: any = {};
                            fields.forEach((f: string) => {
                                if (f === 'count(*)' || f === 'count') {
                                    partial['count'] = 1;
                                } else if (f in obj) {
                                    partial[f] = obj[f];
                                }
                            });
                            return partial;
                        };
                        result = Array.isArray(result) ? result.map(project) : project(result);
                        dataLogger.info(`Applied SQL Projection (${action.selectFields}):`, result);
                    }
                }

                // Smart-Unwrap: Only for JWT login responses (single user object expected)
                if (action.requestJWT && Array.isArray(result) && result.length === 1) {
                    dataLogger.info(`Auto-Unwrapping single-item JWT result for ${action.resultVariable}`);
                    result = result[0];
                }

                const resVar = action.resultVariable || action.variable;
                if (resVar) {
                    context.vars[resVar] = result;
                    context.contextVars[resVar] = result;

                    const varName = context.objects?.find(o => o.id === resVar)?.name || resVar;
                    const displayValue = Array.isArray(result)
                        ? `[${result.length} Einträge]`
                        : (typeof result === 'object' && result !== null ? JSON.stringify(result)?.substring(0, 80) : String(result));

                    DebugLogService.getInstance().log('Variable', `${varName} ← HTTP-Ergebnis: ${displayValue}`, {
                        objectName: varName,
                        data: result
                    });

                    if (action.requestJWT) {
                        dataLogger.info(`Variable "${varName}" gesetzt auf:`, displayValue);
                    }
                }

                // If result contains an error, return false to trigger the Error branch in Flow Editor
                if (result && (result.error || result.status >= 400)) {
                    return false;
                }
            } catch (err) {
                dataLogger.error('Simulation Error:', err);
                if (action.resultVariable) {
                    const errorObj = { error: String(err), status: 500 };
                    context.vars[action.resultVariable] = errorObj;
                    context.contextVars[action.resultVariable] = errorObj;
                }
                return false;
            }
            return;
        }

        // Real HTTP request (Production/Standalone mode)
        try {
            const options: RequestInit = {
                method,
                headers: { 'Content-Type': 'application/json', ...(action.headers || {}) }
            };

            // Auto-Inject JWT Token if available
            const token = localStorage.getItem('auth_token');
            if (token) {
                (options.headers as any)['Authorization'] = `Bearer ${token}`;
            }

            if (body) options.body = body;

            if (action.requestJWT) {
                dataLogger.info(`JWT Real Request: ${method} ${url}`, { headers: options.headers, body: parsedBody });
            }

            const response = await fetch(url, options);
            let data = await response.json();

            if (action.requestJWT) {
                dataLogger.info(`JWT Real Response:`, data);
                // Standard JWT handling: Save token & return User object
                if (data && data.token) {
                    localStorage.setItem('auth_token', data.token);
                    dataLogger.info('Auto-saved JWT token to localStorage "auth_token"');
                }
                if (data && data.user) {
                    data = data.user;
                    dataLogger.info('Auto-unwrapped user object from JWT response');
                }
            }

            // Smart-Mapping: Extract path if specified
            if (action.resultPath && data) {
                data = PropertyHelper.getPropertyValue(data, action.resultPath);
            }

            // Smart-Unwrap: Only for JWT login responses (single user object expected)
            if (action.requestJWT && Array.isArray(data) && data.length === 1) {
                dataLogger.info(`Auto-Unwrapping single-item JWT result for ${action.resultVariable}`);
                data = data[0];
            }

            if (action.resultVariable) {
                context.vars[action.resultVariable] = data;
                context.contextVars[action.resultVariable] = data;

                const varName = context.objects?.find(o => o.id === action.resultVariable)?.name || action.resultVariable;
                const displayValue = Array.isArray(data)
                    ? `[${data.length} Einträge]`
                    : (typeof data === 'object' && data !== null ? JSON.stringify(data).substring(0, 80) : String(data));

                DebugLogService.getInstance().log('Variable', `${varName} ← HTTP-Ergebnis: ${displayValue}`, {
                    objectName: varName,
                    data: data
                });

                if (action.requestJWT) {
                    dataLogger.info(`Produktion: Variable "${varName}" gesetzt auf:`, displayValue);
                }
            }

            // Return false if status code indicates failure (triggers Error branch)
            if (!response.ok) {
                return false;
            }
        } catch (err) {
            dataLogger.error('Error:', err);
            if (action.resultVariable) {
                const errorObj = { error: String(err) };
                context.vars[action.resultVariable] = errorObj;
                context.contextVars[action.resultVariable] = errorObj;
            }
            return false;
        }
    }, {
        type: 'http',
        label: 'HTTP Request',
        description: 'Führt einen API-Call aus (REST/JSON).',
        parameters: [
            { name: 'url', label: 'URL', type: 'string' },
            { name: 'method', label: 'Methode', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], defaultValue: 'GET' },
            { name: 'body', label: 'Body (JSON-String oder Objekt)', type: 'string' },
            { name: 'resultVariable', label: 'Ergebnis speichern in', type: 'variable', source: 'variables' },
            { name: 'resultPath', label: 'Daten-Pfad (Selektor)', type: 'string', hint: 'Optional: Pfad zum Objekt in der Response (z.B. "user")' },
            { name: 'selectFields', label: 'Felder (SELECT)', type: 'string', hint: 'Kommagetrennte Liste der Felder oder count(*)' },
            { name: 'queryProperty', label: 'Filter-Feld (WHERE)', type: 'string', hint: 'z.B. id oder email' },
            { name: 'queryOperator', label: 'Operator', type: 'select', options: ['==', '!=', '>', '<', '>=', '<=', 'CONTAINS'], defaultValue: '==' },
            { name: 'queryValue', label: 'Filter-Wert', type: 'string', hint: 'Wert oder ${variable}' }
        ]
    });

    // 10. Token Speicher (JWT)
    actionRegistry.register('store_token', (action, context) => {
        const key = action.tokenKey || 'auth_token';
        const operation = action.operation || 'set';

        if (operation === 'delete') {
            localStorage.removeItem(key);
        } else {
            const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
            const token = PropertyHelper.interpolate(String(action.token || ''), combinedContext, context.objects);
            dataLogger.info(`Speichere Token "${key}":`, token ? (token.substring(0, 15) + '...') : 'null');
            localStorage.setItem(key, token);
        }
    }, {
        type: 'store_token',
        label: 'Token speichern/löschen',
        hidden: true,
        description: 'Verwaltet Authentifizierungs-Token (JWT) im LocalStorage.',
        parameters: [
            { name: 'operation', label: 'Operation', type: 'select', options: ['set', 'delete'], defaultValue: 'set' },
            { name: 'token', label: 'Token (Daten)', type: 'string' },
            { name: 'tokenKey', label: 'Speicher-Schlüssel', type: 'string', defaultValue: 'auth_token' }
        ]
    });

    // 11. Toast Benachrichtigung
    actionRegistry.register('show_toast', (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        const message = PropertyHelper.interpolate(String(action.message || ''), combinedContext, context.objects);
        const toastType = action.toastType || 'info';

        // Suche nach einer TToast-Komponente im Projekt
        const toaster = context.objects.find(o => o.className === 'TToast' || o.constructor?.name === 'TToast');

        if (toaster && typeof (toaster as any).show === 'function') {
            (toaster as any).show(message, toastType);
        } else {
            // Fallback auf Konsole und einfaches Alert für Sichtbarkeit
            runtimeLogger.info(`[TOAST: ${toastType.toUpperCase()}] ${message}`);
            // alert(message); // Alert ist oft störend, aber für Debugging gut. Wir lassen es weg, wenn Konsole reicht.
        }
    }, {
        type: 'show_toast',
        label: 'Toast anzeigen',
        description: 'Blendet eine kurze Nachricht am Bildschirmrand ein.',
        parameters: [
            { name: 'message', label: 'Nachricht', type: 'string' },
            { name: 'toastType', label: 'Typ', type: 'select', options: ['info', 'success', 'warning', 'error'], defaultValue: 'info' }
        ]
    });

    // 12. Methoden-Aufruf auf Objekt oder Service (call_method)
    //     Unterstützt: { type:'call_method', target:'Toaster', method:'show', params:['msg','error'] }
    actionRegistry.register('call_method', async (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        const targetName = action.target;
        const methodName = action.method;
        const rawParams: any[] = Array.isArray(action.params) ? action.params : [];
        const resolvedParams = rawParams.map(p =>
            PropertyHelper.interpolate(String(p), combinedContext, context.objects)
        );

        // 1. Ziel-Objekt im Projekt suchen
        const targetObj = resolveTarget(targetName, context.objects, context.vars, context.eventData);
        if (targetObj && typeof (targetObj as any)[methodName] === 'function') {
            const result = await (targetObj as any)[methodName](...resolvedParams);
            if (action.resultVariable) {
                context.vars[action.resultVariable] = result;
                context.contextVars[action.resultVariable] = result;
            }
            runtimeLogger.info(`${targetName}.${methodName}(${resolvedParams.join(', ')}) aufgerufen.`);
            return;
        }

        // 2. Service Registry prüfen
        if (serviceRegistry.has(targetName)) {
            const result = await serviceRegistry.call(targetName, methodName, resolvedParams);
            if (action.resultVariable) {
                context.vars[action.resultVariable] = result;
                context.contextVars[action.resultVariable] = result;
            }
            runtimeLogger.info(`Service ${targetName}.${methodName}(${resolvedParams.join(', ')}) aufgerufen.`);
            return;
        }

        // 3. Spezialfall: Toaster ohne TToast-Objekt → show_toast als Fallback
        if (targetName === 'Toaster' && methodName === 'show') {
            const message = resolvedParams[0] || '';
            const toastType = resolvedParams[1] || 'info';
            const toaster = context.objects.find(o =>
                (o as any).className === 'TToast' || (o as any).constructor?.name === 'TToast'
            );
            if (toaster && typeof (toaster as any).show === 'function') {
                (toaster as any).show(message, toastType);
            } else {
                runtimeLogger.info(`[TOAST: ${toastType.toUpperCase()}] ${message}`);
            }
            return;
        }

        console.warn(`[Action: call_method] Ziel "${targetName}" nicht gefunden oder Methode "${methodName}" nicht vorhanden.`);
    }, {
        type: 'call_method',
        label: 'Methode aufrufen',
        description: 'Ruft eine Methode auf einem Objekt oder registrierten Service auf.',
        parameters: [
            { name: 'target', label: 'Ziel (Objekt oder Service)', type: 'string' },
            { name: 'method', label: 'Methode', type: 'string' },
            { name: 'params', label: 'Parameter (Array)', type: 'json', hint: '["param1", "param2"]' },
            { name: 'resultVariable', label: 'Ergebnis speichern in', type: 'variable', source: 'variables' }
        ]
    });

    // 17. HTTP Response (für TAPIServer / HttpServer)
    actionRegistry.register('respond_http', async (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        const requestId = PropertyHelper.interpolate(String(action.requestId || ''), combinedContext, context.objects);
        const status = Number(PropertyHelper.interpolate(String(action.status || 200), combinedContext, context.objects));
        const dataStr = PropertyHelper.interpolate(String(action.data || '{}'), combinedContext, context.objects);

        let data = dataStr;
        try {
            if (dataStr.trim().startsWith('{') || dataStr.trim().startsWith('[')) {
                data = JSON.parse(dataStr);
            }
        } catch (e) {
            dataLogger.warn('Could not parse data as JSON, sending as string:', e);
        }

        dataLogger.info(`Sending response for ${requestId}:`, { status, data });

        if (serviceRegistry.has('HttpServer')) {
            await serviceRegistry.call('HttpServer', 'respond', [requestId, status, data]);
        } else {
            dataLogger.warn('No HttpServer service registered!');
        }
    }, {
        type: 'respond_http',
        label: 'HTTP Antwort senden',
        requiresServer: true,
        description: 'Sendet eine Antwort auf einen eingehenden HTTP-Request (nur im Server-Modus).',
        parameters: [
            { name: 'requestId', label: 'Request ID', type: 'string', hint: 'Wird automatisch vom onRequest-Event bereitgestellt.' },
            { name: 'status', label: 'HTTP Status', type: 'number', defaultValue: 200 },
            { name: 'data', label: 'Antwort-Daten (JSON)', type: 'string', hint: 'Das Objekt, das als JSON gesendet wird.' }
        ]
    });

    // 18. Execute Login Request (Primitive Action for SubmitLogin DataAction)
    actionRegistry.register('execute_login_request', async (_action, context) => {
        const pin = context.vars['currentPIN'] || context.contextVars['currentPIN'];

        dataLogger.info('Attempting login with PIN:', pin);

        if (!pin) {
            dataLogger.warn('No PIN provided!');
            return false;
        }

        try {
            // For now, we simulate the request or use a hardcoded endpoint if available
            // In a real scenario, this would be:
            // const response = await fetch('http://localhost:8080/api/auth/login', { ... });

            // Simulation specific for this project context
            // We assume successful login if PIN is '1234' (or whatever logic is desired)
            // BUT: The original action sequence did a real HTTP POST. Let's try to replicate that.

            const response = await fetch('http://localhost:8080/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pin })
            });

            if (response.ok) {
                const data = await response.json();
                dataLogger.info('Login success:', data);

                // Store result in global/context variables as expected by the DataAction's successBody
                context.contextVars['loginResult'] = data;
                context.vars['loginResult'] = data;

                return true;
            } else {
                dataLogger.warn('Login failed:', response.status);
                return false;
            }
        } catch (error) {
            dataLogger.error('Network error:', error);
            return false;
        }
    }, {
        type: 'execute_login_request',
        label: 'Login Request ausführen',
        hidden: true,
        description: 'Führt den Login-Request gegen das Backend aus.',
        parameters: []
    });

    // 19. Generic DataAction Handler (Delegates to specific types like http, sql)
    actionRegistry.register('data_action', async (action, context) => {
        // DataActions have an internal type, e.g. { type: 'data_action', data: { type: 'http', ... } }
        // OR sometimes attributes are directly on the action: { type: 'data_action', resource: '...', url: '...' }
        // We need to determine the effective sub-type.

        // Strategy 1: Check if it wraps another action in 'data' prop (common in some editor mappings)
        // (Strategy 1 removed as effectiveAction is unused and caused lint errors)


        // Strategy 2: Look for 'type' property inside the data_action definition that maps to a known handler
        // The Project JSON shows: "type": "data_action", "data": { "type": "http", ... }
        // So we should look at action.data.type
        const subType = action.data?.type || action.subType || 'http'; // Default to http if ambiguous?

        runtimeLogger.info(`Delegating to ${subType}`);

        const handler = actionRegistry.getHandler(subType);
        if (handler) {
            // Merge properties: 'data' properties should be top-level for the handler
            const mergedAction = { ...action.data, ...action, type: subType };
            return await handler(mergedAction, context);
        } else {
            runtimeLogger.warn(`No handler found for sub-type "${subType}"`);
            return false;
        }
    }, {
        type: 'data_action',
        label: 'Data Action',
        description: 'Führt eine Daten-Aktion aus (HTTP, SQL, etc.).',
        parameters: [
            { name: 'dataStore', label: 'Data Store (Komponente)', type: 'select', source: 'components', hint: 'Wähle eine TDataStore-Komponente (z.B. UserData)' },
            { name: 'selectFields', label: 'Felder (SELECT)', type: 'string', hint: 'Kommagetrennte Liste der Felder oder count(*)' },
            { name: 'queryProperty', label: 'Filter-Feld (WHERE)', type: 'string', hint: 'z.B. id oder email' },
            { name: 'queryOperator', label: 'Operator', type: 'select', options: ['==', '!=', '>', '<', '>=', '<=', 'CONTAINS'], defaultValue: '==' },
            { name: 'queryValue', label: 'Filter-Wert', type: 'string', hint: 'Wert oder ${variable}' }
        ] // Dynamic based on sub-type
    });

    // 20. API Handler Action (Simulates DB interaction)
    actionRegistry.register('handle_api_request', async (action, context) => {
        // Fix: ActionExecutor passes contextObj as context.eventData.
        // The real event payload is in vars.eventData (populated by GameRuntime/TaskExecutor).
        const eventData = context.vars?.eventData || context.eventData;

        if (!eventData || !eventData.requestId) {
            console.warn('[Action: handle_api_request] Missing requestId in eventData. Is this triggered by onRequest?');
            return false;
        }

        const logicResponse = await ActionApiHandler.handle(action, {
            path: eventData.path,
            method: eventData.method,
            body: eventData.body,
            query: eventData.query
        }, context.objects);

        // Send response back via ApiSimulator mechanism
        // We use the global map established in Editor.ts
        const pendingMap = (window as any).__pendingApiResponses;
        if (pendingMap) {
            const resolver = pendingMap.get(eventData.requestId);
            if (resolver) {
                resolver(logicResponse);
                pendingMap.delete(eventData.requestId);
                console.log(`[Action: handle_api_request] Sent response for ${eventData.requestId}`, logicResponse);
                return true;
            }
        }

        console.warn(`[Action: handle_api_request] Could not find pending response resolver for ${eventData.requestId}`);
        return false;
    }, {
        type: 'handle_api_request',
        label: 'API Request verarbeiten',
        requiresServer: true,
        description: 'Verarbeitet einen API-Request mit Datenbank-Logik und sendet die Antwort.',
        parameters: []
    });
    // 21. Komponenten Animation (Option 2 - Weg A)
    actionRegistry.register('animate', (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        // Kann ein String wie "Zahl1, Zahl2, Ergebnis" sein
        const rawTargetStr = PropertyHelper.interpolate(String(action.target || ''), combinedContext, context.objects);
        const effect = action.effect || 'shake';
        const duration = Number(action.duration) || 500;
        
        // Multi-Target Support: Aufteilen an Kommas, leere Strings entfernen
        const targetNames = rawTargetStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
        
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
                // Dynamischer Aufruf des Effekt-Makros
                if (typeof (animManager as any)[effect] === 'function') {
                    // Standard-Aufruf mit (target, param2, duration)
                    let param2 = undefined;
                    if (effect === 'shake') param2 = Number(action.intensity) || 5;
                    if (effect === 'pulse') param2 = Number(action.scale) || 1.15;
                    if (effect === 'bounce') param2 = Number(action.height) || 20;
                    if (effect === 'fade') param2 = Number(action.targetOpacity) !== undefined && !isNaN(Number(action.targetOpacity)) ? Number(action.targetOpacity) : 0;

                    if (param2 !== undefined) {
                        (animManager as any)[effect](targetObj, param2, duration);
                    } else {
                        // Fallback
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
        
        // Blockierend für den Flow Editor (Task pausieren)?
        // Wenn action.waitForAnimation == true, könnten wir einen Promise zurückgeben.
        // Option für die Zukunft, vorerst asynchron auslösen.
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

    // 22. Audio Play/Stop
    actionRegistry.register('play_audio', (action, context) => {
        const targetObj = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        if (targetObj && typeof (targetObj as any).play === 'function') {
            (targetObj as any).play();
            return true;
        }
        runtimeLogger.warn(`[Action: play_audio] Ziel "${action.target}" ist kein TAudio Element oder nicht gefunden.`);
        return false;
    }, {
        type: 'play_audio',
        label: 'Audio abspielen',
        description: 'Spielt ein TAudio-Element (zerolatenz via WebAudio) ab.',
        parameters: [
            { name: 'target', label: 'Audio-Objekt', type: 'select', source: 'objects', hint: 'Das TAudio Element' }
        ]
    });

    actionRegistry.register('stop_audio', (action, context) => {
        const targetObj = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        if (targetObj && typeof (targetObj as any).stop === 'function') {
            (targetObj as any).stop();
            return true;
        }
        return false;
    }, {
        type: 'stop_audio',
        label: 'Audio stoppen',
        description: 'Stoppt ein laufendes TAudio-Element.',
        parameters: [
            { name: 'target', label: 'Audio-Objekt', type: 'select', source: 'objects', hint: 'Das TAudio Element' }
        ]
    });

    // ─── OBJECT POOL ACTIONS ───────────────────────────────────────

    actionRegistry.register('spawn_object', (action, context) => {
        if (!context.spawnObject) {
            runtimeLogger.warn('spawn_object: kein spawnObject-Callback verfügbar');
            return null;
        }
        
        let templateId = action.templateId || action.target;
        const templateObj = resolveTarget(templateId, context.objects, context.vars, context.eventData);
        if (templateObj) {
            templateId = templateObj.id || templateObj.name;
        }

        
        // Entweder feste Koordinaten oder relativ zu einem Bezugsobjekt
        let finalX = action.x;
        let finalY = action.y;

        if (action.referenceObject) {
            const refObj = resolveTarget(action.referenceObject, context.objects, context.vars, context.eventData);
            if (refObj) {
                // Bei Bezugsobjekt: Objekt-Position + definierter Offset
                const offsetX = action.offsetX !== undefined ? Number(action.offsetX) : 0;
                const offsetY = action.offsetY !== undefined ? Number(action.offsetY) : 0;
                finalX = (refObj.x || 0) + offsetX;
                finalY = (refObj.y || 0) + offsetY;
                // Zentrierung berücksichtigen? (Optional)
            }
        }

        const x = finalX !== undefined && finalX !== '' && !isNaN(Number(finalX)) ? Number(finalX) : undefined;
        const y = finalY !== undefined && finalY !== '' && !isNaN(Number(finalY)) ? Number(finalY) : undefined;
        
        return context.spawnObject(templateId, x, y);
    }, {
        type: 'spawn_object',
        label: 'Objekt spawnen',
        description: 'Holt eine Instanz aus dem Object Pool eines TSpriteTemplate.',
        parameters: [
            { name: 'templateId', label: 'Template', type: 'select', source: 'objects', hint: 'Das TSpriteTemplate' },
            { name: 'referenceObject', label: 'Spawnen bei Objekt', type: 'select', source: 'objects', hint: 'Optional: Koords von diesem Objekt übernehmen' },
            { name: 'offsetX', label: 'Offset X', type: 'number', hint: 'Verschiebung auf X-Achse (falls Objekt gewählt)' },
            { name: 'offsetY', label: 'Offset Y', type: 'number', hint: 'Verschiebung auf Y-Achse (falls Objekt gewählt)' },
            { name: 'x', label: 'Absolute X-Position', type: 'number', hint: 'Nur wenn kein Bezugsobjekt gewählt ist' },
            { name: 'y', label: 'Absolute Y-Position', type: 'number', hint: 'Nur wenn kein Bezugsobjekt gewählt ist' }
        ]
    });

    actionRegistry.register('destroy_object', (action, context) => {
        if (!context.destroyObject) {
            runtimeLogger.warn('destroy_object: kein destroyObject-Callback verfügbar');
            return;
        }
        // Target auflösen: kann %Self%, ein Name oder eine ID sein
        const target = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        if (target) {
            context.destroyObject(target.id || target.name);
        } else {
            // Direkter ID/Name-Versuch
            context.destroyObject(action.target);
        }
    }, {
        type: 'destroy_object',
        label: 'Objekt zerstören',
        description: 'Gibt eine Pool-Instanz zurück (macht sie unsichtbar und verfügbar).',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'string', hint: 'Pool-Instanz oder %Self%' }
        ]
    });
}
