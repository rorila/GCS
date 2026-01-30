/**
 * ServiceRegistry - Central registry for services that can be called from dialogs
 *
 * Services are registered by name and can be called via the registry.
 * This enables visual binding of dialog buttons to backend logic.
 */
class ServiceRegistryClass {
    constructor() {
        this.id = Math.random().toString(36).substr(2, 9);
        this.services = new Map();
        console.log(`%c[ServiceRegistry] INSTANCE CREATED: ${this.id}`, 'background: #000; color: #fff; font-size: 14px; padding: 4px;');
        window._serviceRegistryInstances = window._serviceRegistryInstances || [];
        window._serviceRegistryInstances.push(this.id);
    }
    /**
     * Register a service with the registry
     * @param name Unique name for the service (e.g., 'RemoteGameManager')
     * @param instance The service instance
     * @param description Optional description for the service
     */
    register(name, instance, description) {
        // Auto-discover methods from the instance
        const methods = [];
        // Get all method names from the instance's prototype chain
        let proto = Object.getPrototypeOf(instance);
        while (proto && proto !== Object.prototype) {
            const methodNames = Object.getOwnPropertyNames(proto)
                .filter(prop => {
                if (prop === 'constructor')
                    return false;
                try {
                    return typeof instance[prop] === 'function';
                }
                catch {
                    return false;
                }
            });
            for (const methodName of methodNames) {
                if (!methods.find(m => m.name === methodName)) {
                    methods.push({ name: methodName });
                }
            }
            proto = Object.getPrototypeOf(proto);
        }
        this.services.set(name, {
            name,
            instance,
            methods,
            description
        });
        console.log(`[ServiceRegistry:${this.id}] Registered service: ${name} with methods:`, methods.map(m => m.name));
    }
    /**
     * Unregister a service
     */
    unregister(name) {
        this.services.delete(name);
        console.log(`[ServiceRegistry] Unregistered service: ${name} `);
    }
    /**
     * Get a service by name
     */
    get(name) {
        return this.services.get(name)?.instance;
    }
    /**
     * Check if a service is registered
     */
    has(name) {
        return this.services.has(name);
    }
    /**
     * Call a method on a service
     * @param serviceName Name of the registered service
     * @param methodName Name of the method to call
     * @param params Optional parameters to pass to the method
     * @returns Promise with the method's return value
     */
    async call(serviceName, methodName, params) {
        const serviceInfo = this.services.get(serviceName);
        if (!serviceInfo) {
            throw new Error(`Service '${serviceName}' not found in registry`);
        }
        const method = serviceInfo.instance[methodName];
        if (typeof method !== 'function') {
            throw new Error(`Method '${methodName}' not found on service '${serviceName}'`);
        }
        console.log(`[ServiceRegistry] Calling ${serviceName}.${methodName} (`, params, ')');
        try {
            const result = await method.apply(serviceInfo.instance, params || []);
            console.log(`[ServiceRegistry] ${serviceName}.${methodName} returned: `, result);
            return result;
        }
        catch (error) {
            console.error(`[ServiceRegistry] ${serviceName}.${methodName} threw: `, error);
            throw error;
        }
    }
    /**
     * List all registered service names (for Inspector dropdowns)
     */
    listServices() {
        return Array.from(this.services.keys());
    }
    /**
     * List all methods of a service (for Inspector dropdowns)
     */
    listMethods(serviceName) {
        return this.services.get(serviceName)?.methods || [];
    }
    /**
     * Get service info
     */
    getServiceInfo(serviceName) {
        return this.services.get(serviceName);
    }
    /**
     * Get all services info (for debugging)
     */
    getAllServices() {
        return Array.from(this.services.values());
    }
}
// Singleton instance - WINDOW BOUND to prevent dual instances
export const serviceRegistry = window._globalServiceRegistry || new ServiceRegistryClass();
window._globalServiceRegistry = serviceRegistry;
console.log(`[ServiceRegistry] Singleton bound to window. ID: ${serviceRegistry.id}`);
