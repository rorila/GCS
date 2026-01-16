/**
 * PropertyWatcher - Watches object properties and triggers callbacks on changes
 * 
 * Enables reactive programming by notifying listeners when properties change.
 * Used as the foundation for automatic UI updates in the reactive system.
 */
export class PropertyWatcher {
    // Map: Object -> Map: PropertyPath -> Set of Callbacks
    private watchers = new Map<any, Map<string, Set<(newValue: any, oldValue: any) => void>>>();

    // Track watched objects to prevent memory leaks
    private watchedObjects = new WeakSet<any>();

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
        if (!object || typeof object !== 'object') {
            console.warn('[PropertyWatcher] Cannot watch non-object:', object);
            return;
        }

        // Initialize watchers for this object if needed
        if (!this.watchers.has(object)) {
            this.watchers.set(object, new Map());
        }

        const objectWatchers = this.watchers.get(object)!;

        // Initialize watchers for this property if needed
        if (!objectWatchers.has(propertyPath)) {
            objectWatchers.set(propertyPath, new Set());
        }

        // Add the callback
        objectWatchers.get(propertyPath)!.add(callback);
        this.watchedObjects.add(object);

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
        const objectWatchers = this.watchers.get(object);
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
            this.watchers.delete(object);
        }
    }

    /**
     * Removes all watchers for an object
     * @param object Object to stop watching
     */
    unwatchAll(object: any): void {
        this.watchers.delete(object);
    }

    /**
     * Notifies all watchers that a property has changed
     * @param object Object that changed
     * @param propertyPath Property that changed
     * @param newValue New value
     * @param oldValue Old value (optional)
     */
    notify(object: any, propertyPath: string, newValue: any, oldValue?: any): void {
        const objectWatchers = this.watchers.get(object);
        if (!objectWatchers) return;

        const propertyWatchers = objectWatchers.get(propertyPath);
        if (!propertyWatchers || propertyWatchers.size === 0) return;


        // Call all callbacks
        propertyWatchers.forEach(callback => {
            try {
                callback(newValue, oldValue);
            } catch (error) {
                console.error('[PropertyWatcher] Callback error:', error);
            }
        });
    }

    /**
     * Gets the number of watchers for a specific property
     * @param object Object being watched
     * @param propertyPath Property path
     * @returns Number of watchers
     */
    getWatcherCount(object: any, propertyPath: string): number {
        const objectWatchers = this.watchers.get(object);
        if (!objectWatchers) return 0;

        const propertyWatchers = objectWatchers.get(propertyPath);
        return propertyWatchers ? propertyWatchers.size : 0;
    }

    /**
     * Gets total number of watched objects
     * @returns Number of objects being watched
     */
    getTotalWatchedObjects(): number {
        return this.watchers.size;
    }

    /**
     * Gets total number of watchers across all objects
     * @returns Total watcher count
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
     * Helper to get object name for logging
     */
    private getObjectName(object: any): string {
        return object.name || object.id || object.constructor?.name || 'Unknown';
    }

    /**
     * Clears all watchers (useful for cleanup)
     */
    clear(): void {
        this.watchers.clear();
    }

    /**
     * Debug: Lists all active watchers
     */
    debug(): void {
        console.log('[PropertyWatcher] Active Watchers:');
        this.watchers.forEach((objectWatchers, object) => {
            const objName = this.getObjectName(object);
            objectWatchers.forEach((callbacks, propertyPath) => {
                console.log(`  ${objName}.${propertyPath}: ${callbacks.size} watchers`);
            });
        });
    }
}
