
import { Logger } from '../utils/Logger';

const logger = Logger.get('PropertyHelper', 'Variable_Handling');

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

            // Resolve target for this step (Transparency vs Metadata)
            let target = current;
            const isVarLike = current.isVariable === true || 
                             (current.className && (current.className.includes('Variable') || current.className === 'TStringMap'));
                             
            if (isVarLike) {
                target = this.resolveValue(current);
            }

            // SMART-ACCESS: Automatically unwrap single-element arrays
            if (Array.isArray(target) && target.length === 1 && (target as any)[part] === undefined && part !== 'length') {
                target = target[0];
            }

            // Access property (Priority 1: Content / Priority 2: Component / Priority 3: FlowNode Data)
            const hasInContent = (target !== null && typeof target === 'object' && (part in target)) ||
                (target !== undefined && target !== null && (target as any)[part] !== undefined);

            if (hasInContent) {
                current = target[part];
            } else if (current && current.isFlowNode === true && current.data && current.data[part] !== undefined) {
                current = current.data[part];
            } else if (target && target.isFlowNode === true && target.data && target.data[part] !== undefined) {
                current = target.data[part];
            } else if (current !== target && (current[part] !== undefined || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(current), part)?.get !== undefined)) {
                // FALLBACK: If we resolved to a content (target) but didn't find the prop there,
                // check if the original component (current) has it (e.g. metadata like .type or .defaultValue)
                current = current[part];
            } else if (target === current) {
                // Only fallback to component properties if we are NOT operating on a resolved variable value
                current = current[part];
            } else {
                // If we resolved to a variable value (target) but property wasn't found,
                // don't fallback to the component's metadata (like .name)
                current = undefined;
            }

            if (propPath.includes('LeftOperand') || propPath.includes('BaseVar')) {
                logger.info(`getPropertyValue("${propPath}") member "${part}":`, {
                    targetType: (target as any).constructor?.name || typeof target,
                    hasInContent,
                    result: (typeof current === 'string' ? `"${current}"` : (current === undefined ? "undefined" : "object/val"))
                });
            }

            if (current === undefined || current === null) return undefined;
        }

        return this.resolveValue(current);
    }

    /**
     * Resolves a value from an object, unpacking variable components if necessary.
     */
    static resolveValue(val: any): any {
        if (val && typeof val === 'object') {
            const isVarLike = val.isVariable === true || 
                             (val.className && (val.className.includes('Variable') || val.className === 'TStringMap'));
                             
            if (isVarLike) {
                // Priority 1: Collection Data (for TObjectList, TTable, TList)
                if (Array.isArray(val.data)) return val.data;
                if (Array.isArray(val.items)) return val.items;

                // Priority 2: Map Data (for TStringMap)
                if (val.entries !== undefined) return val.entries;

                // Priority 3: Simple Value
                if (val.value !== undefined) return val.value;
            }
        }
        return val;
    }

    /**
     * Sets a property value using a dot-path
     */
    static setPropertyValue(obj: any, propPath: string, value: any): void {
        if (!obj || !propPath) return;

        const parts = propPath.split('.');
        if (parts.length === 1) {
            const part = parts[0];
            // If it's a FlowNode and doesn't have a setter for this property, put it into data
            if (obj.isFlowNode === true && obj.data && !(part in obj) &&
                Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), part)?.set === undefined) {
                obj.data[part] = value;
            } else {
                obj[part] = value;
            }
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
            logger.info(`Starting interpolation for path: "${trimmedPath}"`);
            // 0. Try literals first
            if (trimmedPath === 'true') return 'true';
            if (trimmedPath === 'false') return 'false';
            if (!isNaN(Number(trimmedPath))) return trimmedPath;

            // Magic-Variable-Pfade auflösen ($event.source.* und self.*)
            if (trimmedPath.startsWith('$event.source.')) {
                const subPath = trimmedPath.slice('$event.source.'.length);
                const evt = vars.$event ?? vars.$eventData;
                if (evt) {
                    const val = this.getPropertyValue(evt, subPath);
                    if (val !== undefined) return String(val);
                }
            }
            if (trimmedPath === 'self' || trimmedPath.startsWith('self.')) {
                const evt = vars.$event ?? vars.$eventData;
                if (evt) {
                    if (trimmedPath === 'self') return String(evt?.name ?? '');
                    const subPath = trimmedPath.slice('self.'.length);
                    const val = this.getPropertyValue(evt, subPath);
                    if (val !== undefined) return String(val);
                }
            }

            // 1. Try objects first (Live components have priority)
            if (objects) {
                if (trimmedPath.includes('.')) {
                    const [objName, ...propParts] = trimmedPath.split('.');
                    const propPath = propParts.join('.');
                    const obj = objects.find(o => o.name === objName || o.id === objName);
                    if (obj) {
                        const val = this.getPropertyValue(obj, propPath);
                        logger.info(`Interpolate "${trimmedPath}" matched Object "${objName}". Prop: "${propPath}", Value: "${val}"`);
                        if (val !== undefined) return String(val);
                    }
                } else {
                    // Direct object reference (e.g. ${currentPIN})
                    const obj = objects.find(o => o.name === trimmedPath || o.id === trimmedPath);
                    if (obj) {
                        const resolved = this.resolveValue(obj);
                        logger.info(`Interpolate "${trimmedPath}" found Object. ID: ${obj.id}, Name: ${obj.name}, Value: "${resolved}"`);
                        if (resolved !== obj) return String(resolved ?? '');
                        // Otherwise return the name or [object]
                        return obj.name || obj.id || String(obj);
                    }
                }
            }

            // 2. Fallback to simple vars (parameters, event data, etc.)
            let val = vars[trimmedPath];

            // If not found directly, try dot notation lookup in vars
            if (val === undefined && trimmedPath.includes('.')) {
                const [rootVar, ...parts] = trimmedPath.split('.');
                if (vars[rootVar] !== undefined) {
                    val = PropertyHelper.getPropertyValue(vars[rootVar], parts.join('.'));
                }
            }

            if (val !== undefined) {
                const resolvedVal = this.resolveValue(val);
                logger.info(`Interpolate "${trimmedPath}" found in vars. Value: "${resolvedVal}"`);
                return String(resolvedVal);
            }

            logger.warn(`Interpolation failed for path: "${trimmedPath}". Variable not found.`);
            return '';
        });
    }

    /**
     * Tries to convert a string value back to its likely intended type (number or boolean)
     */
    static autoConvert(value: any): any {
        if (typeof value !== 'string') return value;
        if (value === '') return value;

        const trimmed = value.trim();

        // Try JSON (Simple heuristic: starts and ends with brackets)
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try {
                return JSON.parse(trimmed);
            } catch (e) {
                // Not valid JSON, fall through
            }
        }

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
