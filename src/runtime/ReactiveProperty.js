/**
 * Makes an object reactive by wrapping it in a Proxy
 * All property changes will trigger the PropertyWatcher
 *
 * @param obj Object to make reactive
 * @param watcher PropertyWatcher instance
 * @param path Current property path (for nested objects)
 * @param root Root object for this reactive tree
 * @returns Proxied object
 */
export function makeReactive(obj, watcher, path = '', root = null) {
    // Don't wrap primitives or null
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    // Don't wrap DOM elements or built-in special objects
    if (obj instanceof HTMLElement || obj instanceof Node ||
        obj instanceof Set || obj instanceof Map ||
        obj instanceof Date || obj instanceof RegExp) {
        return obj;
    }
    const actualRoot = root || obj;
    // Create proxy
    return new Proxy(obj, {
        get(target, property) {
            // Handle proxy detection and unwrapping
            if (property === '__isProxy__')
                return true;
            if (property === '__target__')
                return target;
            // Skip symbol properties
            if (typeof property === 'symbol') {
                return target[property];
            }
            const value = target[property];
            // If value is an object, make it reactive too (for nested properties)
            // But skip DOM elements and built-ins
            if (value && typeof value === 'object' &&
                !(value instanceof HTMLElement) &&
                !(value instanceof Set) && !(value instanceof Map) &&
                !(value instanceof Date) && !(value instanceof RegExp)) {
                const nestedPath = path ? `${path}.${property}` : property;
                return makeReactive(value, watcher, nestedPath, actualRoot);
            }
            return value;
        },
        set(target, property, newValue) {
            // Skip symbol properties
            if (typeof property === 'symbol') {
                target[property] = newValue;
                return true;
            }
            const oldValue = target[property];
            // Only notify if value actually changed
            if (oldValue !== newValue) {
                target[property] = newValue;
                const propertyPath = path ? `${path}.${property}` : property;
                const objName = actualRoot.name || actualRoot.id || 'Unknown';
                console.log(`%c[Proxy] Set ${objName}.${propertyPath} = ${newValue}`, 'color: #2196f3');
                watcher.notify(actualRoot, propertyPath, newValue, oldValue);
            }
            else {
                target[property] = newValue;
            }
            return true;
        }
    });
}
/**
 * Checks if an object is reactive (wrapped in Proxy)
 */
export function isReactive(obj) {
    return obj !== null && typeof obj === 'object' && obj.__isProxy__ === true;
}
/**
 * Returns the raw object behind a reactive proxy
 */
export function unwrap(obj) {
    if (obj !== null && typeof obj === 'object' && obj.__isProxy__) {
        return obj.__target__;
    }
    return obj;
}
/**
 * Batch multiple property updates to reduce watcher notifications
 * Useful for performance when updating many properties at once
 */
export class BatchUpdater {
    constructor() {
        this.updates = [];
        this.isExecuting = false;
    }
    /**
     * Adds an update to the batch
     */
    add(update) {
        this.updates.push(update);
    }
    /**
     * Executes all batched updates
     */
    execute() {
        if (this.isExecuting) {
            console.warn('[BatchUpdater] Already executing, skipping nested execution');
            return;
        }
        this.isExecuting = true;
        try {
            this.updates.forEach(update => {
                try {
                    update();
                }
                catch (error) {
                    console.error('[BatchUpdater] Update error:', error);
                }
            });
        }
        finally {
            this.updates = [];
            this.isExecuting = false;
        }
    }
    /**
     * Clears all pending updates without executing them
     */
    clear() {
        this.updates = [];
    }
    /**
     * Gets number of pending updates
     */
    get pendingCount() {
        return this.updates.length;
    }
}
