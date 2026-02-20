import { PropertyHelper } from './PropertyHelper';

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
    static interpolate(text: any, context: Record<string, any>): any {
        // If not a string or no ${...} expressions, return as-is
        if (typeof text !== 'string' || !text.includes('${')) {
            return text;
        }

        // Replace all ${...} with evaluated values
        const result = text.replace(/\$\{([^}]+)\}/g, (match, expression) => {
            try {
                const value = this.evaluate(expression.trim(), context);
                return this.valueToString(value);
            } catch (error) {
                console.error(`[ExpressionParser] Error evaluating expression "${expression}":`, error);
                return match; // Return original match on error
            }
        });

        // Try to parse as number or boolean if entire string was a single expression
        // Enhanced trim to handle cases like "${ value } "
        const trimmedText = text.trim();
        if (trimmedText.startsWith('${') && trimmedText.endsWith('}') && !trimmedText.includes('${', 2)) {
            // Single expression - try to preserve type including objects and arrays.
            // This is critical for inspector properties like 'options' which expect a real array.
            const expression = trimmedText.slice(2, -1).trim();
            try {
                return this.evaluate(expression, context);
            } catch (error) {
                return result;
            }
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
    static evaluate(expression: string, context: Record<string, any>): any {
        // Handle simple property access (e.g., "playerName", "player.score")
        if (/^[\w.]+$/.test(expression)) {
            return this.getNestedProperty(expression, context);
        }

        // Handle arithmetic and comparisons
        // SECURITY NOTE: Using Function constructor is safer than eval
        // but still requires trusted input. For production, use a proper parser.
        try {
            // Create a function with context variables as parameters
            const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

            // NEW: Use dependencies from the expression instead of Object.keys(context)
            // This is critical when context is a Proxy that doesn't reveal all keys (e.g. contextVars)
            const deps = this.extractDependencies(expression);

            // Filter only for top-level identifiers (no nested properties)
            const contextKeys = deps.filter(key => {
                if (!validIdentifierRegex.test(key)) return false;
                // Only use as top-level key if it's actually in context or if it's a potential root variable
                // (Nested properties like 'selectedEmoji' in 'PinPicker.selectedEmoji' should NOT be keys)
                return (key in context) || !expression.includes(`.${key}`);
            });

            // Resolve all values to their primitive/actual values before evaluation
            const contextValues = contextKeys.map((key: string) => {
                const val = context[key];
                try {
                    const resolved = PropertyHelper.resolveValue(val);
                    // CRITICAL: Treat undefined/null as empty string to prevent "undefined" appearing in UI strings
                    return (resolved === undefined || resolved === null) ? "" : resolved;
                } catch (e) {
                    return "";
                }
            });

            // Create function that evaluates the expression
            const func = new Function(...contextKeys, `return ${expression}`);

            const result = func(...contextValues);

            // Console Tracing for debugging (only if result is suspect or in debug mode)
            if (result === undefined || (result !== result && typeof result === 'number')) { // NaN check
                console.log(`%c[ExpressionParser] Suspicious result for "${expression}":`, 'color: #ff9800', {
                    result,
                    contextKeys,
                    contextValues: contextValues.map((v: any) => typeof v === 'object' ? (v?.name || v?.className || 'Object') : v)
                });
            }

            return result;
        } catch (error: any) {
            const msg = error?.message || '';
            const name = error?.name || '';

            // VERY IMPORTANT: Log ReferenceErrors clearly as they indicate missing variables
            if (name === 'ReferenceError' || error instanceof ReferenceError) {
                console.warn(`%c[ExpressionParser] ReferenceError in "${expression}": ${msg}`, 'color: #f44336; font-weight: bold');
                const deps = this.extractDependencies(expression);
                console.log(`[ExpressionParser] Available context keys:`, deps.filter((k: string) => k in context));
                return undefined;
            }

            if ((name === 'TypeError' || error instanceof TypeError) &&
                (msg.includes('undefined') || msg.includes('null'))) {
                return undefined;
            }

            console.warn(`[ExpressionParser] Evaluation error for "${expression}":`, error);
            return undefined;
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
    static evaluateRaw(expression: string, context: Record<string, any>): any {
        if (expression.startsWith('${') && expression.endsWith('}')) {
            expression = expression.slice(2, -1).trim();
        }
        return this.evaluate(expression, context);
    }
}
