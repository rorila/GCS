import { actionRegistry } from '../../ActionRegistry';
import { resolveTarget } from '../ActionHelper';
import { Logger } from '../../../utils/Logger';
import { DebugLogService } from '../../../services/DebugLogService';

const runtimeLogger = Logger.get('Action', 'Runtime_Execution');

/**
 * Event-Binding Actions: Weisen einer Komponente zur Laufzeit eine Task fuer
 * ein bestimmtes Event zu (oder entfernen die Zuweisung).
 *
 * Hauptanwendungsfall: Pool-Sprites, deren Verhalten je nach Spielsituation
 * dynamisch wechseln soll (z.B. unterschiedliche onCollision-Tasks).
 *
 * Funktionsweise: Setzt schlicht `target.events[event] = task`. Der TaskExecutor
 * liest dieses Mapping bei jedem Event-Trigger frisch aus (siehe
 * TaskExecutor.ts ~Z. 127), daher wirkt die Aenderung sofort ohne Re-Bind.
 */
export function registerEventActions() {
    // ─── bind_event ──────────────────────────────────────────────────────
    actionRegistry.register('bind_event', (action, context) => {
        const target = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        if (!target) {
            runtimeLogger.warn(`[bind_event] target "${action.target}" nicht gefunden`);
            return;
        }
        const evt = String(action.event || '').trim();
        if (!evt) {
            runtimeLogger.warn('[bind_event] event-Name fehlt');
            return;
        }
        const task = String(action.task || '').trim();
        if (!target.events) target.events = {};
        if (task) {
            target.events[evt] = task;
            DebugLogService.getInstance().log('Action', `bind_event ${evt} -> ${task}`, {
                objectName: target.name
            });
        } else {
            delete target.events[evt];
            DebugLogService.getInstance().log('Action', `bind_event ${evt} (cleared)`, {
                objectName: target.name
            });
        }
    }, {
        type: 'bind_event',
        label: 'Event zuweisen',
        description: 'Weist einer Komponente zur Laufzeit eine Task fuer ein Event zu (z.B. Pool-Sprite).',
        parameters: [
            { name: 'target', label: 'Ziel-Komponente', type: 'select', source: 'objects_and_variables',
              defaultValue: '', allowVariableBinding: true,
              hint: 'Komponente oder Variable, die das Event-Mapping erhaelt (auch self bei Pool-Sprites).' },
            { name: 'event',  label: 'Event',           type: 'select', source: 'events_of_target',
              defaultValue: '',
              hint: 'Bei Variable als Target werden alle bekannten Events angeboten.' },
            { name: 'task',   label: 'Task',            type: 'select', source: 'tasks',
              defaultValue: '',
              hint: 'Leer = Zuweisung entfernen.' }
        ]
    });

    // ─── unbind_event ────────────────────────────────────────────────────
    actionRegistry.register('unbind_event', (action, context) => {
        const target = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        if (!target?.events) return;
        const evt = String(action.event || '').trim();
        if (!evt) return;
        delete target.events[evt];
        DebugLogService.getInstance().log('Action', `unbind_event ${evt}`, {
            objectName: target.name
        });
    }, {
        type: 'unbind_event',
        label: 'Event entfernen',
        description: 'Entfernt eine Event-Zuweisung von einer Komponente.',
        parameters: [
            { name: 'target', label: 'Ziel-Komponente', type: 'select', source: 'objects_and_variables',
              defaultValue: '', allowVariableBinding: true },
            { name: 'event',  label: 'Event',           type: 'select', source: 'events_of_target',
              defaultValue: '' }
        ]
    });
}
