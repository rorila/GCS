import { PropertyWatcher } from './PropertyWatcher';

/**
 * Makes an object reactive by wrapping it in a Proxy
 * All property changes will trigger the PropertyWatcher
 * 
 * @param obj Object to make reactive
 * @param watcher PropertyWatcher instance
 * @param path Current property path (for nested objects)
 * @returns Proxied object
 */
export function makeReactive<T extends object>(
    obj: T,
    watcher: PropertyWatcher,
    path: string = ''
): T {
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

    // Create proxy
    return new Proxy(obj, {
        get(target: any, property: string | symbol) {
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
                return makeReactive(value, watcher, nestedPath);
            }

            return value;
        },

        set(target: any, property: string | symbol, newValue: any) {
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
                watcher.notify(target, propertyPath, newValue, oldValue);
            } else {
                target[property] = newValue;
            }

            return true;
        }
    });
}

/**
 * Checks if an object is reactive (wrapped in Proxy)
 * Note: This is a heuristic check, not 100% reliable
 */
export function isReactive(obj: any): boolean {
    try {
        // Try to detect if it's a Proxy by checking for Proxy-specific behavior
        return obj !== null && typeof obj === 'object' &&
            Object.getOwnPropertyDescriptor(obj, '__isReactive__') !== undefined;
    } catch {
        return false;
    }
}

/**
 * Batch multiple property updates to reduce watcher notifications
 * Useful for performance when updating many properties at once
 */
export class BatchUpdater {
    private updates: Array<() => void> = [];
    private isExecuting = false;

    /**
     * Adds an update to the batch
     */
    add(update: () => void): void {
        this.updates.push(update);
    }

    /**
     * Executes all batched updates
     */
    execute(): void {
        if (this.isExecuting) {
            console.warn('[BatchUpdater] Already executing, skipping nested execution');
            return;
        }

        this.isExecuting = true;

        try {
            this.updates.forEach(update => {
                try {
                    update();
                } catch (error) {
                    console.error('[BatchUpdater] Update error:', error);
                }
            });
        } finally {
            this.updates = [];
            this.isExecuting = false;
        }
    }

    /**
     * Clears all pending updates without executing them
     */
    clear(): void {
        this.updates = [];
    }

    /**
     * Gets number of pending updates
     */
    get pendingCount(): number {
        return this.updates.length;
    }
}
