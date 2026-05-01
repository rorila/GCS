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
        if (action.changes) {
            Object.keys(action.changes).forEach(key => {
                const parts = key.split('.');
                const rootName = parts[0];
                const propPath = parts.length > 1 ? parts.slice(1).join('.') : '';
                
                const target = resolveTarget(rootName, context.objects, context.vars, context.eventData);

                if (target && propPath) {
                    const currentValue = PropertyHelper.getPropertyValue(target, propPath);
                    if (typeof currentValue === 'number') {
                        let valueToNegate = currentValue;
                        if (currentValue === 0) {
                            const prevKey = `_prev${propPath.charAt(0).toUpperCase()}${propPath.slice(1)}`;
                            const prevVal = (target as any)[prevKey];
                            if (typeof prevVal === 'number' && prevVal !== 0) {
                                valueToNegate = prevVal;
                            }
                        }
                        const negated = valueToNegate * -1;
                        PropertyHelper.setPropertyValue(target, propPath, negated);
                    }
                } else if (target && !propPath) { // Global Variable
                    const currentValue = context.vars[rootName] !== undefined ? context.vars[rootName] : context.contextVars[rootName];
                    if (typeof currentValue === 'number') {
                        const negated = currentValue * -1;
                        context.vars[rootName] = negated;
                        context.contextVars[rootName] = negated;
                        const varObj = context.objects.find((o: any) => (o.name === rootName || o.id === rootName));
                        if (varObj) varObj.value = negated;
                    }
                }
            });
        }
    }, {
        type: 'negate',
        label: 'Wert negieren',
        description: 'Negiert numerische Eigenschaften oder Variablen (- wird zu +, + wird zu -).',
        parameters: [
            { name: 'changes', label: 'Zuweisungen', type: 'keyvalue', hint: 'Wähle Datenquellen (links) aus, die negiert werden sollen.' }
        ]
    });

    // 3c. Increment
    actionRegistry.register('increment', (action, context) => {
        if (action.changes) {
            Object.keys(action.changes).forEach(key => {
                const rawValue = action.changes[key];
                const incrementAmount = Number(PropertyHelper.interpolate(String(rawValue), { ...context.vars, ...context.contextVars, $eventData: context.eventData }, context.objects)) || 0;

                const parts = key.split('.');
                const rootName = parts[0];
                const propPath = parts.length > 1 ? parts.slice(1).join('.') : '';
                
                const target = resolveTarget(rootName, context.objects, context.vars, context.eventData);

                if (target && propPath) {
                    const currentValue = Number(PropertyHelper.getPropertyValue(target, propPath)) || 0;
                    PropertyHelper.setPropertyValue(target, propPath, currentValue + incrementAmount);
                } else if (target && !propPath) { // Global Variable
                    const currentValue = Number(context.vars[rootName] !== undefined ? context.vars[rootName] : context.contextVars[rootName]) || 0;
                    const newValue = currentValue + incrementAmount;
                    context.vars[rootName] = newValue;
                    context.contextVars[rootName] = newValue;
                    const varObj = context.objects.find((o: any) => (o.name === rootName || o.id === rootName));
                    if (varObj) varObj.value = newValue;
                }
            });
        }
    }, {
        type: 'increment',
        label: 'Werte addieren',
        description: 'Addiert numerische Werte auf bestehende Variablen oder Eigenschaften.',
        parameters: [
            { name: 'changes', label: 'Zuweisungen', type: 'keyvalue', hint: 'Wähle Datenquellen (links) und den Wert, der addiert werden soll (rechts).' }
        ]
    });
}
