/**
 * PropertyHelper provides centralized logic for path-based property access,
 * modification, and variable interpolation.
 */
export class PropertyHelper {
    /**
     * Reads a property value using a dot-path (e.g., "style.backgroundColor")
     */
    static getPropertyValue(obj: any, propPath: string): any {
        if (!obj || !propPath) return undefined;

        const parts = propPath.split('.');
        let current = obj;

        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }

        return current;
    }

    /**
     * Sets a property value using a dot-path
     */
    static setPropertyValue(obj: any, propPath: string, value: any): void {
        if (!obj || !propPath) return;

        const parts = propPath.split('.');
        if (parts.length === 1) {
            obj[parts[0]] = value;
        } else {
            let current: any = obj;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            }
            current[parts[parts.length - 1]] = value;
        }
    }

    /**
     * Interpolates variables in a string template (e.g., "Score: ${score}" or "Value: ${Object.property}")
     */
    static interpolate(template: string, vars: Record<string, any>, objects?: any[]): string {
        if (typeof template !== 'string' || !template.includes('${')) {
            return template;
        }

        return template.replace(/\$\{([^}]+)\}/g, (_, path) => {
            const trimmedPath = path.trim();

            // 0. Try literals first
            if (trimmedPath === 'true') return 'true';
            if (trimmedPath === 'false') return 'false';
            if (!isNaN(Number(trimmedPath))) return trimmedPath;

            // 1. Try simple vars
            if (vars[trimmedPath] !== undefined) return String(vars[trimmedPath]);

            // 2. Try object property path if objects are provided
            if (objects && trimmedPath.includes('.')) {
                const [objName, ...propParts] = trimmedPath.split('.');
                const propPath = propParts.join('.');
                const obj = objects.find(o => o.name === objName || o.id === objName);
                if (obj) {
                    const val = this.getPropertyValue(obj, propPath);
                    if (val !== undefined) return String(val);
                }
            }

            return '';
        });
    }

    /**
     * Tries to convert a string value back to its likely intended type (number or boolean)
     */
    static autoConvert(value: any): any {
        if (typeof value !== 'string') return value;
        if (value === '') return value;

        // Try number
        const num = Number(value);
        if (!isNaN(num) && value.trim() !== '') {
            return num;
        }

        // Try boolean
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;

        return value;
    }
}
