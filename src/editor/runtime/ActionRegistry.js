export class ActionRegistry {
    constructor() {
        this.handlers = new Map();
        this.metadata = new Map();
    }
    static getInstance() {
        if (!ActionRegistry.instance) {
            ActionRegistry.instance = new ActionRegistry();
        }
        return ActionRegistry.instance;
    }
    register(type, handler, meta) {
        this.handlers.set(type, handler);
        if (meta) {
            this.metadata.set(type, meta);
        }
    }
    getHandler(type) {
        return this.handlers.get(type);
    }
    getMetadata(type) {
        return this.metadata.get(type);
    }
    getAllMetadata() {
        return Array.from(this.metadata.values());
    }
    hasHandler(type) {
        return this.handlers.has(type);
    }
}
ActionRegistry.instance = null;
export const actionRegistry = ActionRegistry.getInstance();
