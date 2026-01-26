export interface ActionContext {
    vars: Record<string, any>;
    contextVars: any;
    eventData?: any;
    multiplayerManager?: any;
    onNavigate?: (target: string, params?: any) => void;
}

export type ActionHandler = (action: any, context: ActionContext) => Promise<void> | void;

class ActionRegistry {
    private static instance: ActionRegistry | null = null;
    private handlers: Map<string, ActionHandler> = new Map();

    private constructor() { }

    public static getInstance(): ActionRegistry {
        if (!ActionRegistry.instance) {
            ActionRegistry.instance = new ActionRegistry();
        }
        return ActionRegistry.instance;
    }

    public register(type: string, handler: ActionHandler): void {
        this.handlers.set(type, handler);
    }

    public getHandler(type: string): ActionHandler | undefined {
        return this.handlers.get(type);
    }

    public hasHandler(type: string): boolean {
        return this.handlers.has(type);
    }
}

export const actionRegistry = ActionRegistry.getInstance();
