import { actionRegistry } from './ActionRegistry';
import { registerStandardActions } from './actions/StandardActions';
import { DebugLogService } from '../services/DebugLogService';
/**
 * ActionExecutor handles the execution of all action types,
 * including core property changes and multiplayer/navigation actions.
 */
export class ActionExecutor {
    constructor(objects, multiplayerManager, onNavigate) {
        this.objects = objects;
        this.multiplayerManager = multiplayerManager;
        this.onNavigate = onNavigate;
        // Registriere Standard-Aktionen
        registerStandardActions(this.objects);
    }
    setObjects(objects) {
        this.objects = objects;
        // Re-register with new objects if necessary
        registerStandardActions(this.objects);
    }
    /**
     * Executes a single action
     */
    async execute(action, vars, globalVars = {}, contextObj, parentId) {
        if (!action || !action.type)
            return;
        const actionName = action.name || this.getDescriptiveName(action);
        DebugLogService.getInstance().log('Action', actionName, {
            parentId,
            data: action
        });
        console.log(`%c[Action] Executing: type="${action.type}"`, 'color: #4caf50', action);
        // 1. Check Registry first
        const handler = actionRegistry.getHandler(action.type);
        if (handler) {
            await handler(action, {
                vars,
                contextVars: globalVars,
                eventData: contextObj,
                multiplayerManager: this.multiplayerManager,
                onNavigate: this.onNavigate
            });
            return;
        }
        // 2. Legacy Fallback (only for anything not yet in Registry)
        if (!handler) {
            console.warn(`[ActionExecutor] Unknown action type: ${action.type}`);
        }
    }
    getDescriptiveName(action) {
        const meta = actionRegistry.getMetadata(action.type);
        if (meta) {
            let name = meta.label;
            if (action.target)
                name += ` auf ${action.target}`;
            else if (action.variableName)
                name += ` (${action.variableName})`;
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
