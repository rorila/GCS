/**
 * PropertyWatcher - Watches object properties and triggers callbacks on changes
 *
 * Enables reactive programming by notifying listeners when properties change.
 * Used as the foundation for automatic UI updates in the reactive system.
 */
export class PropertyWatcher {
    constructor() {
        // Map: Object -> Map: PropertyPath -> Set of Callbacks
        this.watchers = new Map();
        // Global listeners called for ANY property change
        this.globalListeners = new Set();
    }
    /**
     * Helper to get the raw object if it's a proxy
     */
    unwrap(obj) {
        if (obj !== null && typeof obj === 'object' && obj.__isProxy__) {
            return obj.__target__;
        }
        return obj;
    }
    /**
     * Registers a watcher for a specific property
     * @param object Object to watch
     * @param propertyPath Property path (e.g., "score" or "style.color")
     * @param callback Function to call when property changes
     */
    watch(object, propertyPath, callback) {
        const target = this.unwrap(object);
        if (!target || typeof target !== 'object') {
            console.warn('[PropertyWatcher] Cannot watch non-object:', target);
            return;
        }
        // Initialize watchers for this object if needed
        if (!this.watchers.has(target)) {
            this.watchers.set(target, new Map());
        }
        const objectWatchers = this.watchers.get(target);
        // Initialize watchers for this property if needed
        if (!objectWatchers.has(propertyPath)) {
            objectWatchers.set(propertyPath, new Set());
        }
        objectWatchers.get(propertyPath).add(callback);
    }
    /**
     * Adds a global listener
     */
    addGlobalListener(callback) {
        this.globalListeners.add(callback);
    }
    /**
     * Removes a global listener
     */
    removeGlobalListener(callback) {
        this.globalListeners.delete(callback);
    }
    /**
     * Removes a specific watcher
     * @param object Object being watched
     * @param propertyPath Property path
     * @param callback Callback to remove (if omitted, removes all callbacks for this property)
     */
    unwatch(object, propertyPath, callback) {
        const target = this.unwrap(object);
        const objectWatchers = this.watchers.get(target);
        if (!objectWatchers)
            return;
        const propertyWatchers = objectWatchers.get(propertyPath);
        if (!propertyWatchers)
            return;
        if (callback) {
            propertyWatchers.delete(callback);
        }
        else {
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
    unwatchAll(object) {
        this.watchers.delete(this.unwrap(object));
    }
    /**
     * Notifies all watchers that a property has changed
     * @param object Object that changed
     * @param propertyPath Property that changed
     * @param newValue New value
     * @param oldValue Old value (optional)
     */
    notify(object, propertyPath, newValue, oldValue) {
        const target = this.unwrap(object);
        const objectWatchers = this.watchers.get(target);
        const objName = target.name || target.id || 'Unknown';
        if (!objectWatchers) {
            // Still notify global listeners even if no specific object watchers exist
            this.notifyGlobal(target, propertyPath, newValue, oldValue);
            return;
        }
        const propertyWatchers = objectWatchers.get(propertyPath);
        if (propertyWatchers && propertyWatchers.size > 0) {
            console.log(`[PropertyWatcher] Notifying ${propertyWatchers.size} listeners for ${objName}.${propertyPath}`);
            // Call all callbacks
            propertyWatchers.forEach(callback => {
                try {
                    callback(newValue, oldValue);
                }
                catch (error) {
                    console.error('[PropertyWatcher] Callback error:', error);
                }
            });
        }
        this.notifyGlobal(target, propertyPath, newValue, oldValue);
    }
    /**
     * Gets the number of watchers for a specific property
     */
    getWatcherCount(object, propertyPath) {
        const target = this.unwrap(object);
        const objectWatchers = this.watchers.get(target);
        if (!objectWatchers)
            return 0;
        const propertyWatchers = objectWatchers.get(propertyPath);
        return propertyWatchers ? propertyWatchers.size : 0;
    }
    notifyGlobal(object, propertyPath, newValue, oldValue) {
        this.globalListeners.forEach(callback => {
            try {
                callback(object, propertyPath, newValue, oldValue);
            }
            catch (error) {
                console.error('[PropertyWatcher] Global callback error:', error);
            }
        });
    }
    /**
     * Gets total number of watched objects
     */
    getTotalWatchedObjects() {
        return this.watchers.size;
    }
    /**
     * Gets total number of watchers across all objects
     */
    getTotalWatchers() {
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
    clear() {
        this.watchers.clear();
        this.globalListeners.clear();
    }
    /**
     * Debug: Lists all active watchers
     */
    debug() {
        console.log('[PropertyWatcher] Active Watchers:');
        this.watchers.forEach((objectWatchers, object) => {
            const objName = object.name || object.id || 'Unknown';
            objectWatchers.forEach((callbacks, propertyPath) => {
                console.log(`  ${objName}.${propertyPath}: ${callbacks.size} watchers`);
            });
        });
    }
}
