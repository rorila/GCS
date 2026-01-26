export interface ActionContext {
    vars: Record<string, any>;
    contextVars: any;
    eventData?: any;
    multiplayerManager?: any;
    onNavigate?: (target: string, params?: any) => void;
}

export interface ActionParameter {
    name: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'variable' | 'object' | 'json' | 'stage' | 'select' | 'method';
    source?: string; // e.g. 'variables', 'objects', 'stages', 'services'
    hint?: string;
    placeholder?: string;
    defaultValue?: any;
}

export interface ActionMetadata {
    type: string;
    label: string;
    description?: string;
    parameters: ActionParameter[];
}

export type ActionHandler = (action: any, context: ActionContext) => Promise<void> | void;

export class ActionRegistry {
    private static instance: ActionRegistry | null = null;
    private handlers: Map<string, ActionHandler> = new Map();
    private metadata: Map<string, ActionMetadata> = new Map();

    private constructor() { }

    public static getInstance(): ActionRegistry {
        if (!ActionRegistry.instance) {
            ActionRegistry.instance = new ActionRegistry();
        }
        return ActionRegistry.instance;
    }

    public register(type: string, handler: ActionHandler, meta?: ActionMetadata): void {
        this.handlers.set(type, handler);
        if (meta) {
            this.metadata.set(type, meta);
        }
    }

    public getHandler(type: string): ActionHandler | undefined {
        return this.handlers.get(type);
    }

    public getMetadata(type: string): ActionMetadata | undefined {
        return this.metadata.get(type);
    }

    public getAllMetadata(): ActionMetadata[] {
        return Array.from(this.metadata.values());
    }

    public hasHandler(type: string): boolean {
        return this.handlers.has(type);
    }
}

export const actionRegistry = ActionRegistry.getInstance();
