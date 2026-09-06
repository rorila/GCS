import { IInspectorContext } from './IInspectorContext';
import { InspectorLegacyRenderer } from './InspectorLegacyRenderer';
import { Logger } from '../../../utils/Logger';

const logger = Logger.get('InspectorLogsRenderer');

export class InspectorLogsRenderer {
    public static async renderLogsContent(obj: any, parent: HTMLElement, context: IInspectorContext): Promise<void> {
        logger.debug('Loading inspector_logs.json');
        try {
            const staticObjects = await context.templateLoader.loadTemplate('./inspector_logs.json', obj);
            staticObjects.forEach(def => {
                const el = InspectorLegacyRenderer.renderUIDefinition(def, obj, context);
                if (el) parent.appendChild(el);
            });
        } catch (e) {
            logger.error('Failed to load logs template', e);
            parent.innerHTML = '<div style="color: red;">Fehler beim Laden der Logs-Ansicht.</div>';
        }
    }
}
