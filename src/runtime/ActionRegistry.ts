export interface ActionContext {
    vars: Record<string, any>;
    contextVars: any;
    objects: any[]; // New: objects list passed dynamically per execution
    eventData?: any;
    multiplayerManager?: any;
    onNavigate?: (target: string, params?: any) => void;
    spawnObject?: (templateId: string, x?: number, y?: number) => any;
    destroyObject?: (instanceId: string) => void;
}

export interface ActionParameter {
    name: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'variable' | 'object' | 'json' | 'stage' | 'select' | 'method';
    source?: string; // e.g. 'variables', 'objects', 'stages', 'services'
    options?: string[]; // Hardcoded options for select
    hint?: string;
    placeholder?: string;
    defaultValue?: any;
    visibleWhen?: { field: string; values: any[] };
}

export interface ActionMetadata {
    type: string;
    label: string;
    description?: string;
    hidden?: boolean;
    requiresServer?: boolean;
    requiresMultiplayer?: boolean;
    parameters: ActionParameter[];
}

export type ActionHandler = (action: any, context: ActionContext) => Promise<any> | any;

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

    public getVisibleActionTypes(project: any): { value: string, label: string }[] {
        const hasServer = project ? !!(project.objects?.some((o: any) => o.className === 'TGameServer') || project.stages?.some((s: any) => s.objects?.some((o: any) => o.className === 'TGameServer'))) : false;
        const hasMultiplayer = project ? !!(project.objects?.some((o: any) => o.className === 'TRemoteGameManager') || project.stages?.some((s: any) => s.objects?.some((o: any) => o.className === 'TRemoteGameManager'))) : false;

        return this.getAllMetadata().filter(m => {
            if (m.hidden) return false;
            if (m.requiresServer && !hasServer) return false;
            if (m.requiresMultiplayer && !hasMultiplayer) return false;
            return true;
        }).map(m => ({ value: m.type, label: m.label }));
    }

    public hasHandler(type: string): boolean {
        return this.handlers.has(type);
    }
}

export const actionRegistry = ActionRegistry.getInstance();
