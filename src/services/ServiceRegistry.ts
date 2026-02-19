/**
 * ServiceRegistry - Central registry for services that can be called from dialogs
 * 
 * Services are registered by name and can be called via the registry.
 * This enables visual binding of dialog buttons to backend logic.
 */

export interface ServiceMethod {
    name: string;
    description?: string;
}

export interface ServiceInfo {
    name: string;
    instance: any;
    methods: ServiceMethod[];
    description?: string;
}

export class ServiceRegistryClass {
    private id: string = Math.random().toString(36).substr(2, 9);
    private services: Map<string, ServiceInfo> = new Map();

    constructor() {
        console.log(`%c[ServiceRegistry] INSTANCE CREATED: ${this.id}`, 'background: #000; color: #fff; font-size: 14px; padding: 4px;');
        const globalScope = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {} as any);
        globalScope._serviceRegistryInstances = globalScope._serviceRegistryInstances || [];
        globalScope._serviceRegistryInstances.push(this.id);
    }

    /**
     * Register a service with the registry
     * @param name Unique name for the service (e.g., 'RemoteGameManager')
     * @param instance The service instance
     * @param description Optional description for the service
     */
    register(name: string, instance: any, description?: string): void {
        // Auto-discover methods from the instance
        const methods: ServiceMethod[] = [];

        // Get all method names from the instance itself (for plain objects)
        const instanceMethods = Object.getOwnPropertyNames(instance)
            .filter(prop => typeof instance[prop] === 'function');

        for (const methodName of instanceMethods) {
            methods.push({ name: methodName });
        }

        // Get all method names from the instance's prototype chain (for classes)
        let proto = Object.getPrototypeOf(instance);
        while (proto && proto !== Object.prototype) {
            const methodNames = Object.getOwnPropertyNames(proto)
                .filter(prop => {
                    if (prop === 'constructor') return false;
                    try {
                        return typeof instance[prop] === 'function';
                    } catch {
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
    unregister(name: string): void {
        this.services.delete(name);
        console.log(`[ServiceRegistry] Unregistered service: ${name} `);
    }

    /**
     * Get a service by name
     */
    get<T>(name: string): T | undefined {
        return this.services.get(name)?.instance as T | undefined;
    }

    /**
     * Check if a service is registered
     */
    has(name: string): boolean {
        return this.services.has(name);
    }

    /**
     * Call a method on a service
     * @param serviceName Name of the registered service
     * @param methodName Name of the method to call
     * @param params Optional parameters to pass to the method
     * @returns Promise with the method's return value
     */
    async call(serviceName: string, methodName: string, params?: any[]): Promise<any> {
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
        } catch (error) {
            console.error(`[ServiceRegistry] ${serviceName}.${methodName} threw: `, error);
            throw error;
        }
    }

    /**
     * List all registered service names (for Inspector dropdowns)
     */
    listServices(): string[] {
        return Array.from(this.services.keys());
    }

    /**
     * List all methods of a service (for Inspector dropdowns)
     */
    listMethods(serviceName: string): ServiceMethod[] {
        return this.services.get(serviceName)?.methods || [];
    }

    /**
     * Get service info
     */
    getServiceInfo(serviceName: string): ServiceInfo | undefined {
        return this.services.get(serviceName);
    }

    /**
     * Get all services info (for debugging)
     */
    getAllServices(): ServiceInfo[] {
        return Array.from(this.services.values());
    }
}

// Singleton instance - WINDOW/GLOBAL BOUND to prevent dual instances
const globalScope = typeof window !== 'undefined' ? window : global;
export const serviceRegistry: ServiceRegistryClass = (globalScope as any)._globalServiceRegistry || new ServiceRegistryClass();
(globalScope as any)._globalServiceRegistry = serviceRegistry;

console.log(`[ServiceRegistry] Singleton bound to window. ID: ${(serviceRegistry as any).id}`);
