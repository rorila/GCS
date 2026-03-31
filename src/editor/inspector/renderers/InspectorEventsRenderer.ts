import { IInspectorContext } from './IInspectorContext';
import { InspectorRegistry } from '../InspectorRegistry';
import { componentRegistry } from '../../../services/ComponentRegistry';
import { InspectorLegacyRenderer } from './InspectorLegacyRenderer';
import { Logger } from '../../../utils/Logger';

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

        if (!obj._supportedEvents || obj._supportedEvents.length === 0) {
            if (typeof obj.getEvents === 'function') {
                obj._supportedEvents = obj.getEvents();
            } else {
                try {
                    obj._supportedEvents = componentRegistry.getEvents(obj);
                } catch (e) {
                    logger.warn('Could not determine events for object:', obj);
                }
            }
        }

        try {
            const uiObjects = await context.templateLoader.loadTemplate(eventsFile, obj);

            if (!uiObjects || uiObjects.length === 0) {
                parent.innerHTML = '<div style="color: #666; font-style: italic;">Keine Events für dieses Objekt verfügbar.</div>';
                return;
            }

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
