import { PropertyHelper } from '../PropertyHelper';

export class TaskConditionEvaluator {
    public static evaluateCondition(condition: any, vars: Record<string, any>, globalVars: Record<string, any>): boolean {
        if (!condition) return false;

        let leftValue: any;
        let rightValue: any;
        let operator = '==';
        let conditionStr = '';

        if (typeof condition === 'string') {
            conditionStr = condition;
            const parts = condition.split(/\s*(==|!=|>|<|>=|<=)\s*/);
            if (parts.length === 3) {
                const left = parts[0].trim();
                operator = parts[1];
                const right = parts[2].trim();

                leftValue = this.resolveValue(left, vars, globalVars);
                rightValue = this.resolveValue(right, vars, globalVars);
            } else {
                return !!this.resolveValue(condition, vars, globalVars);
            }
        } else {
            const leftType = condition.leftType || 'variable';
            const rightType = condition.rightType || 'literal';
            const leftValRaw = condition.leftValue || condition.variable;
            const rightValRaw = condition.rightValue || condition.value;
            operator = condition.operator || '==';

            if (leftType === 'variable' || leftType === 'property') {
                leftValue = this.resolveValue(leftValRaw, vars, globalVars);
            } else {
                leftValue = leftValRaw;
            }

            if (rightType === 'variable' || rightType === 'property') {
                rightValue = this.resolveValue(rightValRaw, vars, globalVars);
            } else {
                rightValue = rightValRaw;
            }

            conditionStr = `${leftValRaw} (${leftType}) ${operator} ${rightValRaw} (${rightType})`;
        }

        console.log(`[TaskConditionEvaluator] Evaluating Condition: "${conditionStr}"`);
        console.log(`               Left:  "${leftValue}" (type: ${typeof leftValue})`);
        console.log(`               Right: "${rightValue}" (type: ${typeof rightValue})`);
        console.log(`               Op:    "${operator}"`);

        switch (operator) {
            case '==': return String(leftValue) === String(rightValue);
            case '!=': return String(leftValue) !== String(rightValue);
            case '>': return Number(leftValue) > Number(rightValue);
            case '<': return Number(leftValue) < Number(rightValue);
            case '>=': return Number(leftValue) >= Number(rightValue);
            case '<=': return Number(leftValue) <= Number(rightValue);
            default: return String(leftValue) === String(rightValue);
        }
    }

    public static resolveValue(value: number | string | undefined, vars: Record<string, any>, globalVars: Record<string, any>): any {
        if (typeof value === 'number') return value;
        if (typeof value === 'boolean') return value;
        if (value === undefined || value === null) return value;

        if (typeof value === 'string') {
            if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
                return value.substring(1, value.length - 1);
            }

            const match = value.match(/^\$\{(.+)\}$/);
            if (match) {
                return this.resolveVarPath(match[1], vars, globalVars);
            }

            return this.resolveVarPath(value, vars, globalVars);
        }
        return value;
    }

    public static resolveVarPath(path: string, vars: Record<string, any>, globalVars: Record<string, any>): any {
        let root = vars;
        let lookup = path;

        if (lookup.startsWith('${') && lookup.endsWith('}')) {
            lookup = lookup.slice(2, -1);
        }

        if (lookup.startsWith('global.')) {
            root = globalVars;
            lookup = lookup.substring(7);
        } else if (lookup.startsWith('stage.')) {
            root = vars;
            lookup = lookup.substring(6);
        }

        return PropertyHelper.getPropertyValue(root, lookup);
    }
}
