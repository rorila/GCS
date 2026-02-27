import { DebugLogService } from '../services/DebugLogService';
import { Logger } from '../utils/Logger';

/**
 * PropertyWatcher - Watches object properties and triggers callbacks on changes
 * 
 * Enables reactive programming by notifying listeners when properties change.
 * Used as the foundation for automatic UI updates in the reactive system.
 */
export class PropertyWatcher {
    private static logger = Logger.get('PropertyWatcher', 'Variable_Management');
    // Map: Object -> Map: PropertyPath -> Set of Callbacks
    private watchers = new Map<any, Map<string, Set<(newValue: any, oldValue: any) => void>>>();

    // Global listeners called for ANY property change
    private globalListeners = new Set<(object: any, propertyPath: string, newValue: any, oldValue: any) => void>();

    /**
     * Helper to get the raw object if it's a proxy
     */
    private unwrap(obj: any): any {
        if (obj !== null && typeof obj === 'object' && (obj as any).__isProxy__) {
            return (obj as any).__target__;
        }
        return obj;
    }

    /**
     * Registers a watcher for a specific property
     * @param object Object to watch
     * @param propertyPath Property path (e.g., "score" or "style.color")
     * @param callback Function to call when property changes
     */
    watch(
        object: any,
        propertyPath: string,
        callback: (newValue: any, oldValue: any) => void
    ): void {
        const target = this.unwrap(object);
        if (!target || typeof target !== 'object') {
            PropertyWatcher.logger.warn(`Cannot watch non-object: ${target}`);
            return;
        }

        // Initialize watchers for this object if needed
        if (!this.watchers.has(target)) {
            this.watchers.set(target, new Map());
        }

        const objectWatchers = this.watchers.get(target)!;

        // Initialize watchers for this property if needed
        if (!objectWatchers.has(propertyPath)) {
            objectWatchers.set(propertyPath, new Set());
        }

        objectWatchers.get(propertyPath)!.add(callback);
    }

    /**
     * Adds a global listener
     */
    addGlobalListener(callback: (object: any, propertyPath: string, newValue: any, oldValue: any) => void): void {
        this.globalListeners.add(callback);
    }

    /**
     * Removes a global listener
     */
    removeGlobalListener(callback: (object: any, propertyPath: string, newValue: any, oldValue: any) => void): void {
        this.globalListeners.delete(callback);
    }

    /**
     * Removes a specific watcher
     * @param object Object being watched
     * @param propertyPath Property path
     * @param callback Callback to remove (if omitted, removes all callbacks for this property)
     */
    unwatch(
        object: any,
        propertyPath: string,
        callback?: (newValue: any, oldValue: any) => void
    ): void {
        const target = this.unwrap(object);
        const objectWatchers = this.watchers.get(target);
        if (!objectWatchers) return;

        const propertyWatchers = objectWatchers.get(propertyPath);
        if (!propertyWatchers) return;

        if (callback) {
            propertyWatchers.delete(callback);
        } else {
            propertyWatchers.clear();
        }

        // Clean up empty maps
        if (propertyWatchers.size === 0) {
            objectWatchers.delete(propertyPath);
        }
        if (objectWatchers.size === 0) {
            this.watchers.delete(target);
        }
    }

    /**
     * Removes all watchers for an object
     * @param object Object to stop watching
     */
    unwatchAll(object: any): void {
        this.watchers.delete(this.unwrap(object));
    }

    /**
     * Notifies all watchers that a property has changed
     * @param object Object that changed
     * @param propertyPath Property that changed
     * @param newValue New value
     * @param oldValue Old value (optional)
     */
    notify(object: any, propertyPath: string, newValue: any, oldValue?: any): void {
        const target = this.unwrap(object);
        const objectWatchers = this.watchers.get(target);
        const objName = target.name || target.id || 'Unknown';

        // List of internal properties that are not relevant for the user workflow
        const INTERNAL_PROPERTIES = new Set(['eventCallback', 'onEvent', 'events', 'Tasks', 'id', 'className']);

        // Log to DebugLogService
        if (DebugLogService.getInstance().isEnabled()) {
            if (INTERNAL_PROPERTIES.has(propertyPath)) return; // Skip noise

            const displayNew = typeof newValue === 'object' ? JSON.stringify(newValue)?.substring(0, 50) : newValue;
            const displayOld = typeof oldValue === 'object' ? JSON.stringify(oldValue)?.substring(0, 50) : oldValue;

            DebugLogService.getInstance().log('Variable',
                `${objName}.${propertyPath} changed: ${displayOld} -> ${displayNew}`,
                {
                    objectName: objName,
                    data: { newValue, oldValue }
                }
            );
        }

        if (!objectWatchers) {
            // Still notify global listeners even if no specific object watchers exist
            this.notifyGlobal(target, propertyPath, newValue, oldValue);
            return;
        }

        const propertyWatchers = objectWatchers.get(propertyPath);
        if (propertyWatchers && propertyWatchers.size > 0) {
            // Call all callbacks
            propertyWatchers.forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (error) {
                    PropertyWatcher.logger.error('Callback error:', error);
                }
            });
        }

        this.notifyGlobal(target, propertyPath, newValue, oldValue);
    }

    /**
     * Gets the number of watchers for a specific property
     */
    getWatcherCount(object: any, propertyPath: string): number {
        const target = this.unwrap(object);
        const objectWatchers = this.watchers.get(target);
        if (!objectWatchers) return 0;
        const propertyWatchers = objectWatchers.get(propertyPath);
        return propertyWatchers ? propertyWatchers.size : 0;
    }

    private notifyGlobal(object: any, propertyPath: string, newValue: any, oldValue?: any): void {
        this.globalListeners.forEach(callback => {
            try {
                callback(object, propertyPath, newValue, oldValue);
            } catch (error) {
                PropertyWatcher.logger.error('Global callback error:', error);
            }
        });
    }

    /**
     * Gets total number of watched objects
     */
    getTotalWatchedObjects(): number {
        return this.watchers.size;
    }

    /**
     * Gets total number of watchers across all objects
     */
    getTotalWatchers(): number {
        let total = 0;
        this.watchers.forEach(objectWatchers => {
            objectWatchers.forEach(propertyWatchers => {
                total += propertyWatchers.size;
            });
        });
        return total;
    }

    /**
     * Clears all watchers (useful for cleanup)
     */
    clear(): void {
        this.watchers.clear();
        this.globalListeners.clear();
    }

    /**
     * Debug: Lists all active watchers
     */
    debug(): void {
        PropertyWatcher.logger.info('Active Watchers:');
        this.watchers.forEach((objectWatchers, object) => {
            const objName = object.name || object.id || 'Unknown';
            objectWatchers.forEach((callbacks, propertyPath) => {
                PropertyWatcher.logger.info(`  ${objName}.${propertyPath}: ${callbacks.size} watchers`);
            });
        });
    }
}
