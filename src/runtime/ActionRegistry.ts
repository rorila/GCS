import { GameProject, ComponentData, StageDefinition } from '../model/types';
import { DebugLogService } from '../services/DebugLogService';

export interface ActionContext {
    vars: Record<string, any>;
    contextVars: any;
    objects: any[]; // New: objects list passed dynamically per execution
    eventData?: any;
    multiplayerManager?: any;
    onNavigate?: (target: string, params?: any) => void;
    spawnObject?: (templateId: string, x?: number, y?: number) => any;
    destroyObject?: (instanceId: string) => void;
    onRestartGame?: () => void;
}

export interface ActionParameter {
    name: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'variable' | 'object' | 'json' | 'stage' | 'select' | 'method' | 'keyvalue';
    source?: string; // e.g. 'variables', 'objects', 'stages', 'services'
    options?: string[]; // Hardcoded options for select
    hint?: string;
    placeholder?: string;
    defaultValue?: any;
    visibleWhen?: { field: string; values: any[] };
    /** Aktiviert einen V-Button neben dem Eingabefeld, der den VariablePickerDialog oeffnet
     *  und den Wert als ${...}-Binding einfuegt. Aktuell vom select-Renderer ausgewertet. */
    allowVariableBinding?: boolean;
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

// --------------------------------------------------------------------------
// Diagnose-Wrapper: wird automatisch um jeden registrierten Handler gelegt.
// Erkennt ${...}-Bindings in Top-Level-Feldern der Action, loest sie auf,
// schreibt einen Diagnose-Eintrag ins DebugLog-Panel und faengt Exceptions.
// --------------------------------------------------------------------------

interface Binding {
    field: string;
    raw: string;
    varName: string;
    resolved: string | undefined;
    source: 'TVariable' | 'plain' | 'missing';
}

const BINDING_RE = /^\$\{([^}]+)\}$/;
// Felder, die bei der Diagnose nicht als "Eingabe" interessant sind
const SKIP_FIELDS = new Set(['id', 'type', 'name', 'details', 'showDetails', 'changes', 'body', 'children']);

function collectBindings(action: any, vars: Record<string, any>): Binding[] {
    if (!action || typeof action !== 'object') return [];
    const out: Binding[] = [];
    for (const [field, value] of Object.entries(action)) {
        if (SKIP_FIELDS.has(field)) continue;
        if (typeof value !== 'string') continue;
        const m = BINDING_RE.exec(value);
        if (!m) continue;
        const varName = m[1];
        const v = vars?.[varName];
        let resolved: string | undefined;
        let source: Binding['source'] = 'missing';
        if (v && typeof v === 'object' && 'value' in (v as any)) {
            resolved = String((v as any).value);
            source = 'TVariable';
        } else if (v !== undefined && v !== null) {
            resolved = String(v);
            source = 'plain';
        }
        out.push({ field, raw: value, varName, resolved, source });
    }
    return out;
}

function withDiagnostics(type: string, handler: ActionHandler): ActionHandler {
    return async (action: any, context: ActionContext) => {
        const bindings = collectBindings(action, context.vars || {});
        const unresolved = bindings.filter(b => b.resolved === undefined);

        if (bindings.length > 0) {
            const dbg = DebugLogService.getInstance();
            const summary = bindings
                .map(b => `${b.field}="${b.raw}"→${b.resolved === undefined ? 'UNRESOLVED' : `"${b.resolved}"`}`)
                .join(', ');
            const diag: any = {
                actionType: type,
                actionName: action?.name,
                bindings,
                unresolvedCount: unresolved.length,
                availableVarKeys: context.vars ? Object.keys(context.vars) : []
            };
            // Object-Namen nur einbinden, wenn target/sourceObject etc. relevant sind
            if (action?.target || action?.referenceObject || action?.sourceObject) {
                diag.availableObjectNames = (context.objects || [])
                    .map((o: any) => o?.name).filter(Boolean).slice(0, 100);
            }
            if (unresolved.length > 0) {
                dbg.log('Event', `[${type}] UNRESOLVED bindings: ${summary}`, { data: diag });
            } else {
                dbg.log('Action', `[${type}] inputs: ${summary}`, { data: diag });
            }
        }

        try {
            return await handler(action, context);
        } catch (err: any) {
            DebugLogService.getInstance().log('Event',
                `[${type}] FAILED: ${err?.message || err}`,
                { data: { error: String(err), stack: err?.stack, actionType: type, actionName: action?.name, bindings } }
            );
            throw err;
        }
    };
}

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
        // Wrapper transparent vorschalten, damit ALLE Actions automatisch
        // Diagnose-Eintraege ins DebugLog-Panel schreiben und Fehler gefangen werden.
        this.handlers.set(type, withDiagnostics(type, handler));
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

    public getVisibleActionTypes(project: GameProject | null): { value: string, label: string }[] {
        const hasServer = project ? !!(project.objects?.some((o: ComponentData) => o.className === 'TGameServer') || project.stages?.some((s: StageDefinition) => s.objects?.some((o: ComponentData) => o.className === 'TGameServer'))) : false;
        const hasMultiplayer = project ? !!(project.objects?.some((o: ComponentData) => o.className === 'TRemoteGameManager') || project.stages?.some((s: StageDefinition) => s.objects?.some((o: ComponentData) => o.className === 'TRemoteGameManager'))) : false;

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
