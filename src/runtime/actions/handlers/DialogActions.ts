import { actionRegistry } from '../../ActionRegistry';
import { resolveTarget } from '../ActionHelper';
import { Logger } from '../../../utils/Logger';
import { GameLoopManager } from '../../GameLoopManager';

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
        const isDialog = className === 'TDialogRoot' || className === 'TThemeDialog' || className === 'TDialog' || className === 'TSidePanel';
        if (!isDialog) {
            logger.warn(`toggle_dialog: Ziel "${action.target}" ist kein Dialog/Side-Panel (className=${className}).`);
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

        // Side-Panel mit modal/pauseGame haelt das Spiel an. Redundant zu
        // TSidePanel.onVisibilityChanged, greift aber auch dann, wenn das
        // aufgeloeste Ziel kein lebendes TSidePanel-Objekt (sondern eine Kopie) ist.
        if (className === 'TSidePanel' && (target.modal || target.pauseGame)) {
            const gm = GameLoopManager.getInstance();
            if (target.visible) {
                gm.pause();
            } else if (gm.getState() === 'paused') {
                gm.resume();
            }
        }

        logger.info(`toggle_dialog: ${target.name} → visible=${target.visible} (mode=${mode})`);
    }, {
        type: 'toggle_dialog',
        label: 'Dialog ein-/ausblenden',
        description: 'Blendet einen TDialogRoot per Slide-Animation ein oder aus.',
        parameters: [
            { name: 'target', label: 'Dialog (TDialogRoot)', type: 'object', source: 'objects', allowVariableBinding: true, hint: 'Name des Dialog-Objekts (auch ${Var} mit Objekt-ID/Name)' },
            { name: 'mode', label: 'Modus', type: 'select', options: ['toggle', 'show', 'hide'], defaultValue: 'toggle' }
        ]
    });
}
