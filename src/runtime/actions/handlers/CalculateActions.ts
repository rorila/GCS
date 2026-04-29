import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';
import { ExpressionParser } from '../../ExpressionParser';
import { DebugLogService } from '../../../services/DebugLogService';
import { resolveTarget } from '../ActionHelper';
import { Logger } from '../../../utils/Logger';

const runtimeLogger = Logger.get('Action', 'Runtime_Execution');

export function registerCalculateActions() {
    // 3. Berechnung
    actionRegistry.register('calculate', (action, context) => {
        // FIX: Strip ${...} wrapper from resultVariable if present (Editor V-Button bug)
        if (action.resultVariable && action.resultVariable.startsWith('${') && action.resultVariable.endsWith('}')) {
            action = { ...action, resultVariable: action.resultVariable.slice(2, -1) };
        }
        // COMPATIBILITY FIX: Detect misclassified variable actions
        if (action.source && action.sourceProperty && action.variableName) {
            const srcObj = resolveTarget(action.source, context.objects, context.vars, context.eventData);
            let val: any = undefined;
            if (srcObj) {
                val = PropertyHelper.getPropertyValue(srcObj, action.sourceProperty);
            }
            if (val === undefined) {
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

        if (context.eventData && typeof context.eventData === 'object') {
            if (!evalContext['self'] || typeof evalContext['self'] !== 'object') {
                evalContext['self'] = context.vars?.sender || context.eventData;
            }
            if (!evalContext['other'] || typeof evalContext['other'] !== 'object') {
                const otherObj = context.vars?.otherSprite;
                if (otherObj && typeof otherObj === 'object') {
                    evalContext['other'] = otherObj;
                } else if (typeof evalContext['other'] === 'string' && objectMap[evalContext['other']]) {
                    evalContext['other'] = objectMap[evalContext['other']];
                }
            }
        }

        let formula = action.formula || action.expression;

        // Fallback: If no formula but calcSteps exist
        if (!formula && action.calcSteps && Array.isArray(action.calcSteps) && action.calcSteps.length > 0) {
            try {
                let result: number = 0;

                for (let i = 0; i < action.calcSteps.length; i++) {
                    const step = action.calcSteps[i];
                    let operandValue: number = 0;

                    if (step.constant !== undefined && !step.variable) {
                        operandValue = Number(step.constant);
                    } else if ((step.operandType === 'variable' || !step.operandType) && step.variable) {
                        if (step.variable.includes('.')) {
                            const parts = step.variable.split('.');
                            const rootName = parts[0];
                            const propPath = parts.slice(1).join('.');
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
                        const srcObj = resolveTarget(step.source, context.objects, context.vars, context.eventData);
                        operandValue = srcObj ? Number(PropertyHelper.getPropertyValue(srcObj, step.property)) : NaN;
                    }

                    if (i === 0) {
                        result = operandValue;
                    } else {
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
                    if (action.resultVariable.includes('.')) {
                        const parts = action.resultVariable.split('.');
                        const rootName = parts[0];
                        const propPath = parts.slice(1).join('.');
                        const rootObj = resolveTarget(rootName, context.objects, context.vars, context.eventData) || evalContext[rootName];
                        if (rootObj && typeof rootObj === 'object') {
                            PropertyHelper.setPropertyValue(rootObj, propPath, result);
                            runtimeLogger.info(`Calc property set: ${rootName}.${propPath} = ${result}`);
                        } else {
                            runtimeLogger.warn(`Calc property set failed: object '${rootName}' not found.`);
                        }
                        // FIX: Also store as flat key so interpolate() can resolve ${Var.value}
                        context.contextVars[action.resultVariable] = result;
                        if (context.vars) {
                            context.vars[action.resultVariable] = result;
                        }
                    } else {
                        context.contextVars[action.resultVariable] = result;
                        if (context.vars) {
                            context.vars[action.resultVariable] = result;
                        }
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
                    if (action.resultVariable.includes('.')) {
                        const parts = action.resultVariable.split('.');
                        const rootName = parts[0];
                        const propPath = parts.slice(1).join('.');
                        const rootObj = resolveTarget(rootName, context.objects, context.vars, context.eventData) || evalContext[rootName];
                        if (rootObj && typeof rootObj === 'object') {
                            PropertyHelper.setPropertyValue(rootObj, propPath, result);
                            runtimeLogger.info(`Calc property set: ${rootName}.${propPath} = ${result}`);
                        } else {
                            runtimeLogger.warn(`Calc property set failed: object '${rootName}' not found.`);
                        }
                        // FIX: Also store as flat key so interpolate() can resolve ${Var.value}
                        context.contextVars[action.resultVariable] = result;
                        if (context.vars) {
                            context.vars[action.resultVariable] = result;
                        }
                    } else {
                        context.contextVars[action.resultVariable] = result;
                        if (context.vars) {
                            context.vars[action.resultVariable] = result;
                        }
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

    // 3b. Negate
    actionRegistry.register('negate', (action, context) => {
        const target = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        if (target && action.changes) {
            Object.keys(action.changes).forEach(prop => {
                const currentValue = PropertyHelper.getPropertyValue(target, prop);
                if (typeof currentValue === 'number') {
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
                } else {
                    runtimeLogger.warn(`Negate: ${target.name || target.id}.${prop} ist kein numerischer Wert`);
                }
            });
        }
    }, {
        type: 'negate',
        label: 'Wert negieren',
        description: 'Negiert numerische Eigenschaften eines Objekts.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects' },
            { name: 'changes', label: 'Properties (JSON)', type: 'json', hint: 'z.B. { "velocityX": true }' }
        ]
    });
}
