import { actionRegistry } from './ActionRegistry';
import { registerStandardActions } from './actions/StandardActions';
import { DebugLogService } from '../services/DebugLogService';

/**
 * ActionExecutor handles the execution of all action types,
 * including core property changes and multiplayer/navigation actions.
 */
export class ActionExecutor {
    constructor(
        private objects: any[],
        private multiplayerManager?: any,
        private onNavigate?: (target: string, params?: any) => void
    ) {
        // Registriere Standard-Aktionen
        registerStandardActions(this.objects);
    }

    public setObjects(objects: any[]) {
        this.objects = objects;
        // Re-register with new objects if necessary
        registerStandardActions(this.objects);
    }

    /**
     * Executes a single action
     */
    async execute(action: any, vars: Record<string, any>, globalVars: Record<string, any> = {}, contextObj?: any, parentId?: string): Promise<any> {
        if (!action || !action.type) return;

        const actionName = action.name || this.getDescriptiveName(action);
        const logId = DebugLogService.getInstance().log('Action', actionName, {
            parentId,
            data: action
        });

        console.log(`%c[Action] Executing: type="${action.type}"`, 'color: #4caf50', action);

        DebugLogService.getInstance().pushContext(logId);
        try {
            // 1. Check Registry first
            const handler = actionRegistry.getHandler(action.type);
            if (handler) {
                return await handler(action, {
                    vars,
                    contextVars: globalVars,
                    eventData: contextObj,
                    multiplayerManager: this.multiplayerManager,
                    onNavigate: this.onNavigate
                });
            }

            // 2. Legacy Fallback
            if (!handler) {
                console.warn(`[ActionExecutor] Unknown action type: ${action.type}`);
            }
        } finally {
            DebugLogService.getInstance().popContext();
        }
    }

    private getDescriptiveName(action: any): string {
        const meta = actionRegistry.getMetadata(action.type);
        if (meta) {
            let name = meta.label;
            if (action.target) name += ` auf ${action.target}`;
            else if (action.variableName) name += ` (${action.variableName})`;
            return name;
        }

        switch (action.type) {
            case 'variable': return `Set ${action.variableName || 'var'}`;
            case 'calculate': return `Calc ${action.resultVariable || 'result'}`;
            case 'property': {
                const keys = action.changes ? Object.keys(action.changes) : [];
                const first = keys.length > 0 ? keys[0] : '';
                return `Set ${action.target || 'target'}.${first}${keys.length > 1 ? '...' : ''}`;
            }
            case 'service': return `Call ${action.service}.${action.method}`;
            case 'call_method': return `Method ${action.method} on ${action.target}`;
            case 'increment': return `Inc ${action.variableName}`;
            case 'negate': return `Toggle ${action.variableName}`;
            case 'animate': return `Animate ${action.target}`;
            case 'navigate': return `To page ${action.pageId}`;
            case 'shake': return `Shake ${action.target}`;
            default: return `Action: ${action.type || 'unknown'}`;
        }
    }
}
