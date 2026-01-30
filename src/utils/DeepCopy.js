/**
 * Deep copy of an object, handling circular references and reactive proxies.
 * Useful for decoupling UI state from live project data.
 */
export function safeDeepCopy(obj, seen = new WeakMap()) {
    // Handle primitives and null/undefined
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    // Handle Dates
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    // Handle RegExps
    if (obj instanceof RegExp) {
        return new RegExp(obj.source, obj.flags);
    }
    // Handle Circular References
    if (seen.has(obj)) {
        return seen.get(obj);
    }
    // Handle Reactive Proxies (unwrap if needed)
    let target = obj;
    if (obj.__isProxy__) {
        target = obj.__target__;
    }
    // Handle Arrays
    if (Array.isArray(target)) {
        const result = [];
        seen.set(obj, result);
        for (let i = 0; i < target.length; i++) {
            result[i] = safeDeepCopy(target[i], seen);
        }
        return result;
    }
    // Handle Plain Objects
    const result = {};
    seen.set(obj, result);
    const keys = Object.keys(target);
    for (const key of keys) {
        // Skip internal/private properties starting with _ that might cause issues?
        // In GCS some private properties are important, so we keep them unless they are known to be problematic.
        // Skip DOM elements
        const val = target[key];
        if (val instanceof HTMLElement || val instanceof Node) {
            continue;
        }
        try {
            result[key] = safeDeepCopy(val, seen);
        }
        catch (err) {
            console.warn(`[DeepCopy] Could not copy property "${key}":`, err);
        }
    }
    return result;
}
