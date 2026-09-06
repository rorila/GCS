import { Logger } from '../utils/Logger';

const logger = Logger.get('EventContext', 'Runtime_Execution');

/**
 * EventContext — Kontext-Daten eines ausgelösten Events.
 * 
 * Wird vom GameRuntime.handleEvent() erzeugt und als Magic-Variable
 * '$event' in den TaskExecutor-Stack injiziert. Lebt nur während
 * der Task-Ausführung (Stack-Frame-Scope).
 * 
 * Zugriff in Expressions: ${$event.source.name}, ${$event.data.x}
 * Zugriff via self-Alias: ${self.x} (Live-Property des Source-Objekts)
 */
export interface EventContext {
    /** Welches Objekt das Event ausgelöst hat. */
    source: {
        name: string;        // z.B. 'Card_3'
        className: string;   // z.B. 'TButton'
        stageId: string;     // z.B. 'stage_main'
    };
    /** Welches Event ausgelöst wurde. */
    event: string;           // z.B. 'onClick'
    /** Event-spezifische Payload — Schema je Event-Typ. */
    data: Record<string, any>;
    /** performance.now()-Timestamp beim Trigger. */
    timestamp: number;
}

/**
 * Leerer EventContext für Tasks ohne Event-Trigger
 * (z.B. onLoad-Actions, manuelle Aufrufe).
 */
export const EMPTY_EVENT_CONTEXT: EventContext = {
    source: { name: '__system__', className: '__system__', stageId: '__system__' },
    event: '__none__',
    data: {},
    timestamp: 0
};

/**
 * Factory-Funktion für EventContext.
 * Wird von GameRuntime.handleEvent() aufgerufen.
 */
export function buildEventContext(
    source: { name: string; className: string; stageId: string },
    event: string,
    data: Record<string, any> = {}
): EventContext {
    const ctx: EventContext = {
        source,
        event,
        data,
        timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now()
    };
    logger.debug(`Built EventContext: ${source.name}.${event}`, ctx);
    return ctx;
}

/**
 * Reservierte Magic-Variablen-Namen.
 * Dürfen nicht als Benutzer-Variablen angelegt werden.
 */
export const RESERVED_VARIABLE_NAMES = new Set(['$event', 'self', '$index', '$item']);
