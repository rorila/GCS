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
                return value !== undefined ? String(value) : '';
            } catch (error) {
                console.warn(`[ExpressionParser] Failed to evaluate: ${expression}`, error);
                return match; // Return original if evaluation fails
            }
        });

        // Try to parse as number or boolean if entire string was a single expression
        if (text.startsWith('${') && text.endsWith('}') && !text.includes('${', 2)) {
            // Single expression - try to preserve type
            const expression = text.slice(2, -1).trim();
            try {
                return this.evaluate(expression, context);
            } catch (error) {
                return result;
            }
        }

        return result;
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
            // Only include keys that are valid JS identifiers to prevent SyntaxErrors
            const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
            const contextKeys = Object.keys(context).filter(key => validIdentifierRegex.test(key));
            const contextValues = contextKeys.map(key => context[key]);

            // Create function that evaluates the expression
            const func = new Function(...contextKeys, `return ${expression}`);

            return func(...contextValues);
        } catch (error: any) {
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
    static getNestedProperty(path: string, context: Record<string, any>): any {
        const parts = path.split('.');
        let current: any = context;

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
        // Match all word sequences (variable names)
        const matches = expression.match(/\b[a-zA-Z_]\w*\b/g) || [];

        // Filter out JavaScript keywords
        const keywords = new Set(['true', 'false', 'null', 'undefined', 'typeof', 'instanceof']);

        return [...new Set(matches.filter(m => !keywords.has(m)))];
    }
}
