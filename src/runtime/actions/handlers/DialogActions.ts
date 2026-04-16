import { actionRegistry } from '../../ActionRegistry';
import { resolveTarget } from '../ActionHelper';
import { Logger } from '../../../utils/Logger';

const logger = Logger.get('DialogActions', 'Runtime_Execution');

/**
 * Registriert Dialog-bezogene Runtime-Actions.
 * 
 * - toggle_dialog: Blendet einen TDialogRoot ein oder aus (mit Slide-Animation).
 */
export function registerDialogActions() {
    actionRegistry.register('toggle_dialog', (action, context) => {
        const target = resolveTarget(action.target, context.objects, context.vars, context.eventData);

        if (!target) {
            logger.warn(`toggle_dialog: Ziel "${action.target}" nicht gefunden.`);
            return;
        }

        const className = target.className || target.constructor?.name;
        if (className !== 'TDialogRoot' && className !== 'TDialog') {
            logger.warn(`toggle_dialog: Ziel "${action.target}" ist kein Dialog (className=${className}).`);
        }

        const mode = action.mode || 'toggle';

        switch (mode) {
            case 'show':
                target.visible = true;
                if (typeof target.show === 'function') target.show();
                break;
            case 'hide':
                target.visible = false;
                if (typeof target.hide === 'function') target.hide();
                break;
            case 'toggle':
            default:
                if (target.visible) {
                    target.visible = false;
                    if (typeof target.hide === 'function') target.hide();
                } else {
                    target.visible = true;
                    if (typeof target.show === 'function') target.show();
                }
                break;
        }

        logger.info(`toggle_dialog: ${target.name} → visible=${target.visible} (mode=${mode})`);
    }, {
        type: 'toggle_dialog',
        label: 'Dialog ein-/ausblenden',
        description: 'Blendet einen TDialogRoot per Slide-Animation ein oder aus.',
        parameters: [
            { name: 'target', label: 'Dialog (TDialogRoot)', type: 'object', source: 'objects', hint: 'Name des Dialog-Objekts' },
            { name: 'mode', label: 'Modus', type: 'select', options: ['toggle', 'show', 'hide'], defaultValue: 'toggle' }
        ]
    });
}
