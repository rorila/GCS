/**
 * ServiceRegistry - Central registry for services that can be called from dialogs
 *
 * Services are registered by name and can be called via the registry.
 * This enables visual binding of dialog buttons to backend logic.
 * 
 * MANUALLY PATCHED JS VERSION TO ENSURE GLOBAL SINGLETON
 */
class ServiceRegistryClass {
    constructor() {
        this.id = Math.random().toString(36).substr(2, 9);
        this.services = new Map();
        console.log(`%c[ServiceRegistry] INSTANCE CREATED (JS-FILE): ${this.id}`, 'background: #550000; color: #fff; font-size: 14px; padding: 4px;');
        window._serviceRegistryInstances = window._serviceRegistryInstances || [];
        window._serviceRegistryInstances.push(this.id);
    }
    register(name, instance, description) {
        const methods = [];
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
    unregister(name) {
        this.services.delete(name);
        console.log(`[ServiceRegistry] Unregistered service: ${name} `);
    }
    get(name) {
        return this.services.get(name)?.instance;
    }
    has(name) {
        return this.services.has(name);
    }
    async call(serviceName, methodName, params) {
        const serviceInfo = this.services.get(serviceName);
        if (!serviceInfo) {
            // Attempt to re-fetch from global if not found (just in case this instance is stale but global is fresh)
            const globalReg = window._globalServiceRegistry;
            if (globalReg && globalReg !== this && globalReg.has(serviceName)) {
                console.warn(`[ServiceRegistry:${this.id}] Service '${serviceName}' not found locally, DELEGATING to global registry ${globalReg.id}`);
                return globalReg.call(serviceName, methodName, params);
            }

            throw new Error(`Service '${serviceName}' not found in registry (Instance: ${this.id})`);
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
    listServices() {
        return Array.from(this.services.keys());
    }
    listMethods(serviceName) {
        return this.services.get(serviceName)?.methods || [];
    }
    getServiceInfo(serviceName) {
        return this.services.get(serviceName);
    }
    getAllServices() {
        return Array.from(this.services.values());
    }
}

// Singleton instance - WINDOW BOUND to prevent dual instances
export const serviceRegistry = window._globalServiceRegistry || new ServiceRegistryClass();
window._globalServiceRegistry = serviceRegistry;

console.log(`[ServiceRegistry] JS File loaded. Using Singleton ID: ${serviceRegistry.id}`);
