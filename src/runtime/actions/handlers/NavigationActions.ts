import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';
import { DebugLogService } from '../../../services/DebugLogService';

export function registerNavigationActions() {
    // 6. Navigation
    actionRegistry.register('navigate', (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        let targetGame = PropertyHelper.interpolate(action.target, combinedContext, context.objects);
        if (targetGame && context.onNavigate) {
            context.onNavigate(targetGame, action.params);
        }
    }, {
        type: 'navigate',
        label: 'Spiel wechseln',
        hidden: true,
        description: 'Wechselt zu einem anderen Projekt.',
        parameters: [
            { name: 'target', label: 'Ziel-Projekt', type: 'string' }
        ]
    });

    actionRegistry.register('navigate_stage', (action, context) => {
        const stageId = action.stageId;
        const reset = action.reset || false;
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (!stageId) return;

        const resolved = PropertyHelper.interpolate(String(stageId), combinedContext, context.objects);

        console.log(`[navigate_stage] Stage wechseln zu: ${resolved} (reset=${reset})`);

        const stageController = context.objects.find(
            (o: any) => o.className === 'TStageController' || o.constructor?.name === 'TStageController'
        );
        if (stageController && typeof (stageController as any).goToStage === 'function') {
            console.log(`[navigate_stage] Via TStageController → ${resolved} (reset=${reset})`);

            DebugLogService.getInstance().log('Action', `Stage wechselt zu: ${resolved}${reset ? ' (Reset)' : ''}`, {
                objectName: 'TStageController',
                data: { stageId: resolved, reset }
            });

            (stageController as any).goToStage(resolved, reset);
            return;
        }

        if (context.onNavigate) {
            console.log(`[navigate_stage] Via onNavigate fallback → stage:${resolved} (reset=${reset})`);

            DebugLogService.getInstance().log('Action', `Navigation zu Stage: ${resolved}${reset ? ' (Reset)' : ''}`, {
                data: { stageId: resolved, reset }
            });

            context.onNavigate(`stage:${resolved}`, { ...action.params, reset });
        }
    }, {
        type: 'navigate_stage',
        label: 'Stage wechseln',
        description: 'Wechselt zu einer anderen Stage innerhalb des Projekts.',
        parameters: [
            { name: 'stageId', label: 'Ziel-Stage', type: 'select', source: 'stages' },
            { name: 'reset', label: 'Stage zurücksetzen', type: 'boolean', defaultValue: false, hint: 'Wenn aktiviert, wird die Stage komplett neu aufgebaut (alle Komponenten auf Initialwerte)' }
        ]
    });
}
