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
    static findExpressions(text) {
        const regex = /\$\{([^}]+)\}/g;
        const matches = [];
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
    static interpolate(text, context) {
        // If not a string, return as-is
        if (typeof text !== 'string') {
            return text;
        }
        // If no ${...} expressions, return as-is
        if (!text.includes('${')) {
            return text;
        }
        // Replace all ${...} with evaluated values
        const result = text.replace(/\$\{([^}]+)\}/g, (match, expression) => {
            try {
                const value = this.evaluate(expression.trim(), context);
                return this.valueToString(value);
            }
            catch (error) {
                console.warn(`[ExpressionParser] Failed to evaluate: ${expression}`, error);
                return match; // Return original if evaluation fails
            }
        });
        // Try to parse as number or boolean if entire string was a single expression
        if (text.startsWith('${') && text.endsWith('}') && !text.includes('${', 2)) {
            // Single expression - try to preserve type for primitives, but stringify objects
            const expression = text.slice(2, -1).trim();
            try {
                const value = this.evaluate(expression, context);
                // If it's a "real" object (and not null/primitive), stringify it
                // to avoid [object Object] when it's assigned to a string property like a label's text.
                if (value !== null && typeof value === 'object') {
                    return this.valueToString(value);
                }
                return value;
            }
            catch (error) {
                return result;
            }
        }
        return result;
    }
    /**
     * Converts any value to a human-readable string representation
     */
    static valueToString(value) {
        if (value === undefined || value === null)
            return '';
        if (typeof value === 'string')
            return value;
        if (typeof value === 'number' || typeof value === 'boolean')
            return String(value);
        // If it's a Variable-Component, we want its actual value/content
        if (value.isVariable === true) {
            if (value.value !== undefined)
                return this.valueToString(value.value);
            if (Array.isArray(value.items))
                return this.valueToString(value.items);
        }
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
            if (value.className)
                return `[${value.className}]`;
            if (value.constructor && value.constructor.name !== 'Object') {
                return `[${value.constructor.name}]`;
            }
            const json = JSON.stringify(value);
            return json.length > 50 ? json.substring(0, 47) + '...' : json;
        }
        catch (e) {
            return '[Object]';
        }
    }
    /**
     * Evaluates an expression (without ${})
     * @param expression Expression to evaluate (e.g., "player.score", "x + 10")
     * @param context Object containing variable values
     * @returns Evaluated value
     */
    static evaluate(expression, context) {
        // Handle simple property access (e.g., "playerName", "player.score")
        if (/^[\w.]+$/.test(expression)) {
            return this.getNestedProperty(expression, context);
        }
        // Handle arithmetic and comparisons
        // SECURITY NOTE: Using Function constructor is safer than eval
        // but still requires trusted input. For production, use a proper parser.
        try {
            // Create a function with context variables as parameters
            // Only include keys that are valid JS identifiers to prevent SyntaxErrors
            const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
            const contextKeys = Object.keys(context).filter(key => validIdentifierRegex.test(key));
            const contextValues = contextKeys.map(key => context[key]);
            // Create function that evaluates the expression
            const func = new Function(...contextKeys, `return ${expression}`);
            return func(...contextValues);
        }
        catch (error) {
            // Suppress common "undefined" errors during initialization/object selection
            const msg = error?.message || '';
            const name = error?.name || '';
            if ((name === 'TypeError' || error instanceof TypeError) &&
                (msg.includes('undefined') || msg.includes('null'))) {
                return undefined;
            }
            if (name === 'ReferenceError' || error instanceof ReferenceError) {
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
    static getNestedProperty(path, context) {
        const parts = path.split('.');
        let current = context;
        for (const part of parts) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[part];
        }
        return current;
    }
    /**
     * Sets a nested property value (e.g., "player.score.total")
     * @param path Property path
     * @param value Value to set
     * @param context Object to modify
     */
    static setNestedProperty(path, value, context) {
        const parts = path.split('.');
        let current = context;
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
    static extractDependencies(expression) {
        // Match all word sequences (variable names)
        const matches = expression.match(/\b[a-zA-Z_]\w*\b/g) || [];
        // Filter out JavaScript keywords
        const keywords = new Set(['true', 'false', 'null', 'undefined', 'typeof', 'instanceof']);
        return [...new Set(matches.filter(m => !keywords.has(m)))];
    }
    /**
     * Evaluates an expression and returns the raw value (preserving type)
     */
    static evaluateRaw(expression, context) {
        if (expression.startsWith('${') && expression.endsWith('}')) {
            expression = expression.slice(2, -1).trim();
        }
        return this.evaluate(expression, context);
    }
}
