import { PropertyWatcher } from './PropertyWatcher';

import { Logger } from '../utils/Logger';

const logger = Logger.get('Proxy', 'Variable_Management');

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
export function makeReactive<T extends object>(
    obj: T,
    watcher: PropertyWatcher,
    path: string = '',
    root: any = null
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

    const actualRoot = root || obj;

    // Create proxy
    return new Proxy(obj, {
        get(target: any, property: string | symbol) {
            // Handle proxy detection and unwrapping
            if (property === '__isProxy__') return true;
            if (property === '__target__') return target;

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
                
                // CHROMIUM DEVTOOLS HEURISTIC:
                // Do not recursively weave Proxies over structural properties that point BACKWARDS
                // or parallel in the tree, because Chromium DevTools parses scoping trees and
                // these cyclic properties cause infinite '__cachedProxy' path expansion crash.
                if (property === 'parent' || property === 'stage' || property === 'children' || property === 'objects') {
                    return value;
                }

                // INTERN: Alle __-Präfix-Properties RAW zurückgeben (kein weiteres Proxy-Wrapping!).
                // Dazu gehört '__cachedProxy' selbst - sonst: Proxy liest __cachedProxy,
                // der Proxy des __cachedProxy liest wieder __cachedProxy => Stack Overflow.
                if (typeof property === 'string' && property.startsWith('__')) {
                    return value;
                }

                // PERFORMANCE/CRASH FIX:
                // Memoize the proxy on the raw object. Without this, every 'get' creates a new Proxy.
                // DevTools inspecting global variables drops into an infinite proxy creation loop and crashes.
                if (!(value as any).__cachedProxy) {
                    const nestedPath = path ? `${path}.${property}` : property;
                    Object.defineProperty(value, '__cachedProxy', {
                        value: makeReactive(value, watcher, nestedPath, actualRoot),
                        enumerable: false, // WICHTIG: Nicht aufzählbar für JSON.stringify oder Object.keys
                        configurable: true
                    });
                }
                return (value as any).__cachedProxy;
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
                const objName = actualRoot.name || actualRoot.id || 'Unknown';
                logger.info(`Set ${objName}.${propertyPath} = ${newValue}`);

                watcher.notify(actualRoot, propertyPath, newValue, oldValue);
            } else {
                target[property] = newValue;
            }

            return true;
        }
    });
}

/**
 * Checks if an object is reactive (wrapped in Proxy)
 */
export function isReactive(obj: any): boolean {
    return obj !== null && typeof obj === 'object' && (obj as any).__isProxy__ === true;
}

/**
 * Returns the raw object behind a reactive proxy
 */
export function unwrap<T extends object>(obj: T): T {
    if (obj !== null && typeof obj === 'object' && (obj as any).__isProxy__) {
        return (obj as any).__target__;
    }
    return obj;
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
            logger.warn('[BatchUpdater] Already executing, skipping nested execution');
            return;
        }

        this.isExecuting = true;

        try {
            this.updates.forEach(update => {
                try {
                    update();
                } catch (error) {
                    logger.error('[BatchUpdater] Update error:', error);
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
