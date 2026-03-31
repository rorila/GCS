import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';
import { DebugLogService } from '../../../services/DebugLogService';
import { Logger } from '../../../utils/Logger';

const runtimeLogger = Logger.get('Action', 'Runtime_Execution');

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
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (!stageId) return;

        const resolved = PropertyHelper.interpolate(String(stageId), combinedContext, context.objects);

        const stageController = context.objects.find(
            (o: any) => o.className === 'TStageController' || o.constructor?.name === 'TStageController'
        );
        if (stageController && typeof (stageController as any).goToStage === 'function') {
            runtimeLogger.info(`Via TStageController → ${resolved}`);

            DebugLogService.getInstance().log('Action', `Stage wechselt zu: ${resolved}`, {
                objectName: 'TStageController',
                data: { stageId: resolved }
            });

            (stageController as any).goToStage(resolved);
            return;
        }

        if (context.onNavigate) {
            runtimeLogger.info(`Via onNavigate fallback → stage:${resolved}`);

            DebugLogService.getInstance().log('Action', `Navigation zu Stage: ${resolved}`, {
                data: { stageId: resolved }
            });

            context.onNavigate(`stage:${resolved}`, action.params);
        }
    }, {
        type: 'navigate_stage',
        label: 'Stage wechseln',
        description: 'Wechselt zu einer anderen Stage innerhalb des Projekts.',
        parameters: [
            { name: 'stageId', label: 'Ziel-Stage', type: 'select', source: 'stages' }
        ]
    });
}
