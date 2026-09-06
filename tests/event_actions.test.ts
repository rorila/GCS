import { actionRegistry } from '../src/runtime/ActionRegistry';
import { registerEventActions } from '../src/runtime/actions/handlers/EventActions';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

// Idempotente Registrierung (falls Tests im selben Process mehrfach laufen)
let registered = false;
function ensureRegistered() {
    if (registered) return;
    registerEventActions();
    registered = true;
}

function makeContext(target: any) {
    return {
        objects: [target],
        vars: {},
        contextVars: {},
        eventData: undefined,
    } as any;
}

export async function runEventActionsTests(): Promise<TestResult[]> {
    console.log('🧪 Testing bind_event / unbind_event Actions...');
    ensureRegistered();
    const results: TestResult[] = [];

    const add = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'Event Actions',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details,
        });
    };

    const bindHandler = actionRegistry.getHandler('bind_event');
    const unbindHandler = actionRegistry.getHandler('unbind_event');

    // 0. Registry-Check
    add('bind_event registered',   !!bindHandler);
    add('unbind_event registered', !!unbindHandler);
    if (!bindHandler || !unbindHandler) return results;

    // 1. bind_event setzt events[evt]
    {
        const target = { name: 'Enemy1', events: undefined as any };
        await bindHandler({ type: 'bind_event', target: 'Enemy1', event: 'onClick', task: 'TaskA' }, makeContext(target));
        const ok = target.events && target.events.onClick === 'TaskA';
        add('bind_event sets events[event] = task', ok, JSON.stringify(target.events));
    }

    // 2. bind_event mit leerem task entfernt die Zuweisung
    {
        const target = { name: 'Enemy2', events: { onClick: 'OldTask' } };
        await bindHandler({ type: 'bind_event', target: 'Enemy2', event: 'onClick', task: '' }, makeContext(target));
        const ok = !target.events.onClick;
        add('bind_event with empty task removes binding', ok, JSON.stringify(target.events));
    }

    // 3. bind_event ueberschreibt existierende Zuweisung
    {
        const target = { name: 'Enemy3', events: { onClick: 'OldTask' } };
        await bindHandler({ type: 'bind_event', target: 'Enemy3', event: 'onClick', task: 'NewTask' }, makeContext(target));
        const ok = target.events.onClick === 'NewTask';
        add('bind_event overwrites existing binding', ok, JSON.stringify(target.events));
    }

    // 4. unbind_event entfernt
    {
        const target = { name: 'Enemy4', events: { onClick: 'TaskA', onHover: 'TaskB' } };
        await unbindHandler({ type: 'unbind_event', target: 'Enemy4', event: 'onClick' }, makeContext(target));
        const ok = !target.events.onClick && target.events.onHover === 'TaskB';
        add('unbind_event removes only specified event', ok, JSON.stringify(target.events));
    }

    // 5. bind_event auf Target ohne events-Objekt initialisiert es
    {
        const target = { name: 'Enemy5' } as any;
        await bindHandler({ type: 'bind_event', target: 'Enemy5', event: 'onCollision', task: 'Boom' }, makeContext(target));
        const ok = target.events && target.events.onCollision === 'Boom';
        add('bind_event initializes events object if missing', ok, JSON.stringify(target.events));
    }

    // 6. bind_event mit unbekanntem Target macht nichts kaputt
    {
        const target = { name: 'Enemy6' } as any;
        let threw = false;
        try {
            await bindHandler({ type: 'bind_event', target: 'DoesNotExist', event: 'onClick', task: 'X' }, makeContext(target));
        } catch (e) {
            threw = true;
        }
        add('bind_event with unknown target does not throw', !threw);
    }

    // 7. bind_event mit leerem event-Namen macht nichts
    {
        const target = { name: 'Enemy7' } as any;
        await bindHandler({ type: 'bind_event', target: 'Enemy7', event: '', task: 'X' }, makeContext(target));
        const ok = !target.events || Object.keys(target.events).length === 0;
        add('bind_event ignores empty event name', ok, JSON.stringify(target.events));
    }

    // 8. Metadata vorhanden (Inspector-Schema)
    {
        const meta = actionRegistry.getMetadata('bind_event');
        const params = meta?.parameters || [];
        const hasTarget = params.some((p: any) => p.name === 'target');
        const hasEvent  = params.some((p: any) => p.name === 'event');
        const hasTask   = params.some((p: any) => p.name === 'task');
        add('bind_event metadata exposes target/event/task params', hasTarget && hasEvent && hasTask,
            `params: ${params.map((p: any) => p.name).join(',')}`);
    }

    return results;
}
