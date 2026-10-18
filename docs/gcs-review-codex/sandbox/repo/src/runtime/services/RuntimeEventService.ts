import { Logger } from '../../utils/Logger';
import type { GameRuntime } from '../GameRuntime';
import { GameLoopManager } from '../GameLoopManager';
import { DebugLogService } from '../../services/DebugLogService';
import { buildEventContext } from '../EventContext';
import { PerfOverlay } from '../../utils/PerfOverlay';
const logger = Logger.get('RuntimeEventService', 'Runtime_Execution');

export class RuntimeEventService {
    public handleEvent(runtime: GameRuntime, objectId: string, eventName: string, data: any = {}) {
            // Intercept System Navigation Events (e.g. from TRichText links)
            if (eventName === '__SYSTEM_NAVIGATE__' && data?.target && runtime.options.onNavigate) {
                runtime.options.onNavigate(data.target);
                return;
            }
    
            const obj = runtime.objects.find(o => o.id === objectId);
            if (!obj) return;
    
            PerfOverlay.phaseBegin('ev');
    
            const hasOnEventMap = obj.onEvent && obj.onEvent[eventName];
            
            let hasTaskMap: any = undefined;
            // CRITICAL FIX: Unwrap proxy to ensure we bypass any Proxy limitations
            const rawObj = (obj as any).__isProxy__ ? (obj as any).__target__ : obj;
            
            // onEnter und onMouseEnter werden streng getrennt
            const resolvedEventName = eventName;
    
            if (rawObj.events && resolvedEventName in rawObj.events) {
                hasTaskMap = rawObj.events[resolvedEventName];
            } else if ((rawObj as any).Tasks && resolvedEventName in (rawObj as any).Tasks) {
                hasTaskMap = (rawObj as any).Tasks[resolvedEventName];
            }
            let eventLogId: string | undefined = undefined;
    
            if (hasOnEventMap || hasTaskMap) {
                eventLogId = DebugLogService.getInstance().log('Event', `Triggered: ${obj.name}.${eventName}`, {
                    objectName: obj.name,
                    eventName: eventName,
                    data: data
                });
                DebugLogService.getInstance().pushContext(eventLogId);
            }
    
            try {
                // SPECIAL HANDLING: TEmojiPicker state sync (Global & Local)
                // The view (Stage) triggers onSelect with the emoji as data.
                // We must update the runtime object's state BEFORE executing ANY actions or tasks.
                if (obj.className === 'TEmojiPicker' && eventName === 'onSelect' && typeof data === 'string') {
                    logger.debug(`Syncing selectedEmoji for ${obj.name}: ${data}`);
                    obj.selectedEmoji = data;
                }
    
                if (obj.onEvent) {
                    const actions = obj.onEvent[eventName];
                    if (actions) {
                        // Actions can be a single object or an array
                        const actionList = Array.isArray(actions) ? actions : [actions];
                        // self MUSS mitgegeben werden, sonst kann resolveTarget('%Self%')
                        // das ausloesende Objekt nicht bestimmen und faellt auf die
                        // Event-Daten zurueck (bei Kollisionen ein reines Datenobjekt).
                        const directVars = { self: obj, sender: obj };
                        for (const action of actionList) {
                            runtime.actionExecutor.execute(action, directVars, runtime.contextVars, data, eventLogId);
                        }
                    }
                }
    
                if (runtime.taskExecutor && hasTaskMap) {
                    // Priority 1: Explicit mapping (string), Priority 2: Convention (ObjectName.EventName)
                    const taskName = (typeof hasTaskMap === 'string') ? hasTaskMap : `${obj.name}.${eventName}`;
                    // Object names are provided via prototype, event-specific fields as own properties.
                    const objectNameMap = runtime.getObjectNameMap();
                    const eventVars: Record<string, any> = Object.create(objectNameMap);
                    if (typeof data === 'object' && data !== null) {
                        Object.assign(eventVars, data);
                    }
                    eventVars['eventData'] = data;
                    eventVars['sender'] = obj;
    
                    // ─── FEATURE A: Event-Context ($event + self) ───
                    const $event = buildEventContext(
                        { name: obj.name, className: obj.className || '', stageId: runtime.stage?.id || '' },
                        eventName,
                        typeof data === 'object' && data !== null ? data : { value: data }
                    );
                    eventVars['$event'] = $event;
                    eventVars['self'] = obj;  // Live-Referenz auf das Source-Objekt
                    runtime.taskExecutor.execute(taskName, eventVars, runtime.contextVars, obj, 0, eventLogId);
                }
            } finally {
                const evMs = PerfOverlay.phaseEnd('ev');
                if (evMs && evMs > 16) PerfOverlay.markSlowEvent(eventName, evMs);
    
                // Auto-Sleep: GameLoop aufwecken, falls Event zu Aktivitaet gefuehrt hat
                // (z.B. PhysikAktivieren setzt spritesMoving=true, Countdown startet Animationen)
                GameLoopManager.getInstance().wakeUp();
    
                if (eventLogId) {
                    DebugLogService.getInstance().popContext();
                }
            }
        }
}
