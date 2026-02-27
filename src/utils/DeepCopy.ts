import { Logger } from './Logger';

const logger = Logger.get('DeepCopy', 'Project_Save_Load');

/**
 * Deep copy of an object, handling circular references and reactive proxies.
 * Useful for decoupling UI state from live project data.
 */
export function safeDeepCopy<T>(obj: T, seen = new WeakMap()): T {
    // Handle primitives and null/undefined
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Handle Dates
    if (obj instanceof Date) {
        return new Date(obj.getTime()) as any;
    }

    // Handle RegExps
    if (obj instanceof RegExp) {
        return new RegExp(obj.source, obj.flags) as any;
    }

    // Handle Circular References
    if (seen.has(obj)) {
        return seen.get(obj);
    }

    // Handle Reactive Proxies (unwrap if needed)
    let target = obj;
    if ((obj as any).__isProxy__) {
        target = (obj as any).__target__;
    }

    // Handle Arrays
    if (Array.isArray(target)) {
        const result: any[] = [];
        seen.set(obj, result);
        for (let i = 0; i < target.length; i++) {
            result[i] = safeDeepCopy(target[i], seen);
        }
        return result as any;
    }

    // Handle Plain Objects
    const result: any = {};
    seen.set(obj, result);

    const keys = Object.keys(target);
    for (const key of keys) {
        // Skip internal/private properties starting with _ that might cause issues?
        // In GCS some private properties are important, so we keep them unless they are known to be problematic.

        // Skip DOM elements
        const val = (target as any)[key];
        if (val instanceof HTMLElement || val instanceof Node) {
            continue;
        }

        try {
            result[key] = safeDeepCopy(val, seen);
        } catch (err) {
            logger.warn(`Could not copy property "${key}":`, err);
        }
    }

    return result;
}
