import { IInspectorContext } from './IInspectorContext';
import { InspectorRegistry } from '../InspectorRegistry';
import { componentRegistry } from '../../../services/ComponentRegistry';
import { InspectorLegacyRenderer } from './InspectorLegacyRenderer';
import { Logger } from '../../../utils/Logger';
import { projectTaskRegistry } from '../../../services/registry/TaskRegistry';

const logger = Logger.get('InspectorEventsRenderer');

export class InspectorEventsRenderer {
    public static async renderEventsContent(obj: any, parent: HTMLElement, context: IInspectorContext): Promise<void> {
        parent.innerHTML = '';

        let eventsFile = './inspector_events.json';

        const handler = InspectorRegistry.getHandler(obj);
        if (handler && (handler as any).getEventsTemplate) {
            const customEventsTemplate = (handler as any).getEventsTemplate(obj);
            if (customEventsTemplate) eventsFile = customEventsTemplate;
        } else if (obj.isVariable) {
            eventsFile = './inspector_variable_events.json';
        }

        // IMMER die Events frisch ermitteln (verhindert Caching-Probleme bei HMR / laufender Session)
        let freshEvents: string[] = [];
        // Versuch 1: Direkt vom Objekt (falls Prototyp/Methode vorhanden)
        if (typeof obj.getEvents === 'function') {
            freshEvents = obj.getEvents();
        }
        // Versuch 2: Falls getEvents() leer/undefined lieferte, über ComponentRegistry nachladen.
        if (!freshEvents || freshEvents.length === 0) {
            try {
                freshEvents = componentRegistry.getEvents(obj);
            } catch (e) {
                logger.warn('Could not determine events for object:', obj);
            }
        }
        // Objekt für das JSON-Template patchen
        obj._supportedEvents = freshEvents;

        try {
            const uiObjects = await context.templateLoader.loadTemplate(eventsFile, obj);

            if (!uiObjects || uiObjects.length === 0) {
                parent.innerHTML = '<div style="color: #666; font-style: italic;">Keine Events für dieses Objekt verfügbar.</div>';
                return;
            }

            // GARANTIE-FIX: Tasks SYNCHRON direkt in den contextBuilder injizieren,
            // BEVOR das UI gerendert wird.
            if ((context as any).contextBuilder) {
                const cb = (context as any).contextBuilder;
                if (!cb.availableTasks || cb.availableTasks.length === 0) {
                    const tasks = projectTaskRegistry.getTasks('all');
                    if (tasks && tasks.length > 0) {
                        cb.availableTasks = tasks.map(t => ({
                            value: t.name,
                            label: `${t.uiEmoji || (t.uiScope === 'global' ? '🌎' : '🎭')} ${t.name}`
                        }));
                    }
                }
            }

            // Einmaliges Rendern
            uiObjects.forEach(def => {
                const el = InspectorLegacyRenderer.renderUIDefinition(def, obj, context);
                if (el) parent.appendChild(el);
            });
        } catch (e) {
            logger.warn(`Could not load events template: ${eventsFile}`, e);
            parent.innerHTML = '<div style="color: #666; font-style: italic;">Events konnten nicht geladen werden.</div>';
        }
    }
}
