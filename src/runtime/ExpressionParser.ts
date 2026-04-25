import { PropertyHelper } from './PropertyHelper';
import { Logger } from '../utils/Logger';
import jsep from 'jsep';

const logger = Logger.get('ExpressionParser', 'Runtime_Execution');

/**
 * ExpressionParser - Parses and evaluates expressions in strings
 * 
 * Supports:
 * - Simple variables: ${variableName}
 * - Nested properties: ${player.score}
 * - Arithmetic: ${score + 10}
 * - Comparisons: ${score > 100}
 * - Logical operators: ${isPlayer1 && score > 50}
 */
export class ExpressionParser {
    /**
     * Finds all ${...} expressions in a string
     * @param text String to search
     * @returns Array of expression contents (without ${})
     */
    static findExpressions(text: string): string[] {
        const regex = /\$\{([^}]+)\}/g;
        const matches: string[] = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
            matches.push(match[1].trim());
        }

        return matches;
    }

    /**
     * Interpolates ${...} expressions with actual values
     * @param text String containing ${...} expressions
     * @param context Object containing variable values
     * @returns Interpolated value (string, number, boolean, etc.)
     */
    static interpolate(text: any, context: Record<string, any>, allowedCalls?: string[]): any {
        // If not a string or no ${...} expressions, return as-is
        if (typeof text !== 'string' || !text.includes('${')) {
            return text;
        }

        let result = '';
        let i = 0;

        while (i < text.length) {
            if (text[i] === '$' && text[i + 1] === '{') {
                // Start of expression - find matching closing brace with nesting support
                let braceDepth = 1;
                let start = i + 2;
                let j = start;

                while (j < text.length && braceDepth > 0) {
                    if (text[j] === '$' && text[j + 1] === '{') {
                        braceDepth++;
                        j++; // Skip {
                    } else if (text[j] === '}') {
                        braceDepth--;
                    }
                    j++;
                }

                if (braceDepth === 0) {
                    // Found matched expression
                    const expression = text.substring(start, j - 1);
                    try {
                        // Recursively interpolate nested expressions first if any
                        const interpolatedExpr = this.interpolate(expression, context, allowedCalls);

                        const evaluated = this.evaluate(interpolatedExpr.trim(), context, allowedCalls);

                        // If the entire text was just this one expression, return the raw value
                        if (i === 0 && j === text.length) {
                            // FAIL-SAFE: If evaluation failed but it still contains template tags, return original
                            if (evaluated === undefined && (interpolatedExpr.includes('${') || expression.includes('${'))) {
                                return text;
                            }
                            return evaluated;
                        }

                        // FAIL-SAFE for nested interpolation: 
                        // If evaluate returns undefined but it looks like a template variable remains,
                        // keep the ${...} tag instead of converting to empty string.
                        if (evaluated === undefined && (interpolatedExpr.includes('${') || expression.includes('${'))) {
                            result += `\${${interpolatedExpr}}`;
                        } else {
                            result += this.valueToString(evaluated);
                        }
                    } catch (error) {
                        logger.error(`Error evaluating expression "${expression}":`, error);
                        result += `\${${expression}}`;
                    }
                    i = j;
                    continue;
                }
            }
            result += text[i];
            i++;
        }

        return result;
    }

    /**
     * Converts any value to a human-readable string representation
     */
    private static valueToString(value: any): string {
        if (value === undefined || value === null) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);

        // If it's a Variable-Component, we want its actual value/content
        const resolved = PropertyHelper.resolveValue(value);
        if (resolved !== value) return this.valueToString(resolved);

        // Handle Arrays
        if (Array.isArray(value)) {
            return value.map(v => this.valueToString(v)).join(', ');
        }

        // Handle Components/Proxies with a name property
        if (value.name && typeof value.name === 'string') {
            return value.name;
        }

        // Handle Objects (prevent [object Object])
        try {
            // If it's a complex object, show a small preview or its class name
            if (value.className) return `[${value.className}]`;
            if (value.constructor && value.constructor.name !== 'Object') {
                return `[${value.constructor.name}]`;
            }

            const json = JSON.stringify(value);
            return json.length > 50 ? json.substring(0, 47) + '...' : json;
        } catch (e) {
            return '[Object]';
        }
    }

    /**
     * Evaluates an expression (without ${})
     * @param expression Expression to evaluate (e.g., "player.score", "x + 10")
     * @param context Object containing variable values
     * @returns Evaluated value
     */
    static evaluate(expression: string, context: Record<string, any>, allowedCalls?: string[]): any {
        // PRE-PROCESS: Strip ${ } templates if the user typed them in a pure formula context
        // This makes the runtime highly resilient and allows users to type ${score} + 1 instead of score + 1
        if (typeof expression === 'string' && expression.includes('${')) {
            expression = expression.replace(/\$\{([^}]+)\}/g, '$1');
        }

        const trimmed = expression.trim();

        if (trimmed === 'true') return true;
        if (trimmed === 'false') return false;
        if (trimmed === 'null') return null;
        if (trimmed === 'undefined') return undefined;

        // Check if expression is just a number
        if (!isNaN(Number(trimmed)) && trimmed !== '') {
            return Number(trimmed);
        }

        // Handle simple property access (e.g., "playerName", "player.score")
        if (/^[a-zA-Z_$][\w.]*$/.test(trimmed)) {
            return this.getNestedProperty(trimmed, context);
        }

        // Handle arithmetic and comparisons via JSEP AST Evaluator
        try {
            const ast = jsep(trimmed);
            const result = this.evaluateAST(ast, context, allowedCalls);

            // Console Tracing for debugging
            if (result === undefined || (result !== result && typeof result === 'number')) {
                logger.debug(`Suspicious result for "${expression}":`, { result });
            }

            return result;
        } catch (error: any) {
            const msg = error?.message || '';
            const name = error?.name || '';

            if (name === 'ReferenceError' || error instanceof ReferenceError) {
                logger.warn(`ReferenceError in "${expression}": ${msg}`);
                return undefined;
            }

            logger.warn(`Evaluation error for "${expression}":`, error);
            return undefined;
        }
    }

    /**
     * Evaluates a JSEP AST Node securely
     */
    private static evaluateAST(node: any, context: Record<string, any>, allowedCalls?: string[]): any {
        if (!node) return undefined;

        switch (node.type) {
            case 'Literal':
                return node.value;
            
            case 'Identifier':
                // Allowed safe globals
                if (node.name === 'Math') return Math;
                if (node.name === 'Number') return Number;
                if (node.name === 'String') return String;
                if (node.name === 'Boolean') return Boolean;
                if (node.name === 'parseInt') return parseInt;
                if (node.name === 'parseFloat') return parseFloat;
                if (node.name === 'isNaN') return isNaN;
                
                const val = context[node.name];
                return PropertyHelper.resolveValue(val);

            case 'MemberExpression':
                const obj = this.evaluateAST(node.object, context, allowedCalls);
                const propName = node.computed ? this.evaluateAST(node.property, context, allowedCalls) : node.property.name;
                
                if (propName === '__proto__' || propName === 'constructor' || propName === 'prototype') {
                    throw new Error(`Security Violation: Access to ${propName} is forbidden.`);
                }
                
                if (obj === undefined || obj === null) return undefined;
                
                const result = obj[propName];
                return PropertyHelper.resolveValue(result);

            case 'CallExpression':
                const callee = node.callee;
                let calleeObj: any = null;
                let calleeFunc: Function;
                let funcNameStr = '';

                if (callee.type === 'Identifier') {
                    funcNameStr = callee.name;
                    calleeFunc = this.evaluateAST(callee, context, allowedCalls);
                } else if (callee.type === 'MemberExpression') {
                    calleeObj = this.evaluateAST(callee.object, context, allowedCalls);
                    const pName = callee.computed ? this.evaluateAST(callee.property, context, allowedCalls) : callee.property.name;
                    
                    if (pName === '__proto__' || pName === 'constructor' || pName === 'prototype') {
                        throw new Error(`Security Violation: Access to ${pName} is forbidden.`);
                    }
                    if (calleeObj === undefined || calleeObj === null) return undefined;
                    
                    calleeFunc = calleeObj[pName];
                    
                    if (callee.object.type === 'Identifier') {
                        funcNameStr = `${callee.object.name}.${pName}`;
                    } else {
                        funcNameStr = `*.${pName}`;
                    }
                } else {
                    throw new Error(`Unsupported callee type.`);
                }

                if (typeof calleeFunc !== 'function') {
                    return undefined;
                }

                // Strict Allowlist for functions
                const allowedFunctions = new Set([
                    'Math.floor', 'Math.ceil', 'Math.round', 'Math.random', 'Math.min', 'Math.max', 
                    'Math.abs', 'Math.sqrt', 'Math.pow', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
                    'Number', 'String', 'Boolean'
                ]);

                // Safe Prototype methods for internal primitive objects (String/Array)
                const allowedMethods = new Set([
                    'toUpperCase', 'toLowerCase', 'trim', 'replace', 'substring', 'substr', 'split',
                    'includes', 'indexOf', 'lastIndexOf', 'charAt', 'concat', 'join', 'slice',
                    'push', 'pop', 'shift', 'unshift', 'splice', 'reverse'
                ]);

                let isAllowed = false;
                if (allowedFunctions.has(funcNameStr)) isAllowed = true;
                else if (callee.type === 'MemberExpression') {
                    const pName = callee.computed ? this.evaluateAST(callee.property, context) : callee.property.name;
                    if (allowedMethods.has(pName)) isAllowed = true;
                }

                if (!isAllowed && allowedCalls && allowedCalls.includes(funcNameStr)) {
                    isAllowed = true;
                }

                if (!isAllowed) {
                    throw new Error(`Function call '${funcNameStr || 'unknown'}' blocked by security allowlist.`);
                }

                const args = node.arguments.map((arg: any) => this.evaluateAST(arg, context, allowedCalls));
                return calleeFunc.apply(calleeObj, args);

            case 'BinaryExpression':
                const left = this.evaluateAST(node.left, context, allowedCalls);
                // Kurzschluss-Auswertung (Short-circuiting) für logische Operatoren in BinaryExpression (jsep legacy)
                if (node.operator === '&&') return left && this.evaluateAST(node.right, context, allowedCalls);
                if (node.operator === '||') return left || this.evaluateAST(node.right, context, allowedCalls);

                const right = this.evaluateAST(node.right, context, allowedCalls);
                switch (node.operator) {
                    case '+': return left + right;
                    case '-': return left - right;
                    case '*': return left * right;
                    case '/': return left / right;
                    case '%': return left % right;
                    case '==': return left == right;
                    case '!=': return left != right;
                    case '===': return left === right;
                    case '!==': return left !== right;
                    case '<': return left < right;
                    case '>': return left > right;
                    case '<=': return left <= right;
                    case '>=': return left >= right;
                    default: return undefined;
                }

            case 'LogicalExpression':
                const lLogical = this.evaluateAST(node.left, context, allowedCalls);
                if (node.operator === '&&') return lLogical && this.evaluateAST(node.right, context, allowedCalls);
                if (node.operator === '||') return lLogical || this.evaluateAST(node.right, context, allowedCalls);
                return undefined;

            case 'UnaryExpression':
                const arg = this.evaluateAST(node.argument, context, allowedCalls);
                switch (node.operator) {
                    case '!': return !arg;
                    case '-': return -arg;
                    case '+': return +arg;
                    case '~': return ~arg;
                    case 'typeof': return typeof arg;
                    default: return undefined;
                }

            case 'ArrayExpression':
                return node.elements.map((el: any) => this.evaluateAST(el, context, allowedCalls));

            case 'ConditionalExpression':
                const test = this.evaluateAST(node.test, context, allowedCalls);
                return test ? this.evaluateAST(node.consequent, context, allowedCalls) : this.evaluateAST(node.alternate, context, allowedCalls);

            default:
                throw new Error(`Unsupported expression type: ${node.type}`);
        }
    }

    /**
     * Gets a nested property value (e.g., "player.score.total")
     * @param path Property path (e.g., "player.score")
     * @param context Object containing values
     * @returns Property value or undefined
     */
    static getNestedProperty(path: string, context: Record<string, any>): any {
        return PropertyHelper.getPropertyValue(context, path);
    }

    /**
     * Sets a nested property value (e.g., "player.score.total")
     * @param path Property path
     * @param value Value to set
     * @param context Object to modify
     */
    static setNestedProperty(path: string, value: any, context: Record<string, any>): void {
        const parts = path.split('.');
        let current: any = context;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }

        current[parts[parts.length - 1]] = value;
    }

    /**
     * Extracts variable dependencies from an expression
     * @param expression Expression to analyze
     * @returns Array of variable names used
     */
    static extractDependencies(expression: string): string[] {
        // Match identifiers, and check if they are preceded by a dot
        const regex = /(\.)?([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        const deps = new Set<string>();
        let match;

        while ((match = regex.exec(expression)) !== null) {
            const dot = match[1];
            const name = match[2];
            // If it has NO dot prefix, it's a potential root variable/context key
            if (!dot) {
                deps.add(name);
            }
        }

        // Filter out JavaScript keywords
        const keywords = new Set(['true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'new', 'return', 'if', 'else', 'for', 'while']);

        return Array.from(deps).filter(m => !keywords.has(m));
    }

    /**
     * Evaluates an expression and returns the raw value (preserving type)
     */
    static evaluateRaw(expression: string, context: Record<string, any>, allowedCalls?: string[]): any {
        if (expression.startsWith('${') && expression.endsWith('}')) {
            expression = expression.slice(2, -1).trim();
        }
        const result = this.evaluate(expression, context, allowedCalls);
        if (expression.includes('BaseVar') || expression.includes('availableVariableFields')) {
            logger.debug(`evaluateRaw("${expression}") ->`, result);
        }
        return result;
    }
}
