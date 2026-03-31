import { IInspectorContext } from './IInspectorContext';
import { isInspectable } from '../types';
import { InspectorSectionRenderer } from './InspectorSectionRenderer';
import { InspectorLegacyRenderer } from './InspectorLegacyRenderer';
import { InspectorRegistry } from '../InspectorRegistry';
import { componentRegistry } from '../../../services/ComponentRegistry';
import { PropertyHelper } from '../../../runtime/PropertyHelper';

export class InspectorPropertiesRenderer {
    public static async renderPropertiesContent(obj: any, parent: HTMLElement, context: IInspectorContext): Promise<void> {

        if (isInspectable(obj)) {
            InspectorSectionRenderer.renderSections(obj, parent, context);
            return;
        }

        if (!isInspectable(obj) && obj.className) {
            const instance = componentRegistry.createInstance(obj);
            if (instance && isInspectable(instance)) {
                const proxy = new Proxy(obj, {
                    get(target: any, prop: string) {
                        if (prop === 'getInspectorSections') return () => instance.getInspectorSections();
                        if (prop === 'applyChange') return (propertyName: string, newValue: any) => {
                            PropertyHelper.setPropertyValue(target, propertyName, newValue);
                            return propertyName === 'type' || propertyName === 'className';
                        };
                        return target[prop];
                    }
                });
                InspectorSectionRenderer.renderSections(proxy as any, parent, context);
                return;
            }
        }

        const handler = InspectorRegistry.getHandler(obj);
        if (handler && typeof (handler as any).getSections === 'function') {
            const sections = (handler as any).getSections(obj, context.project);
            if (sections && sections.length > 0) {
                const stageObj = obj;
                const proxy = new Proxy(stageObj, {
                    get(target: any, prop: string) {
                        if (prop === 'getInspectorSections') return () => sections;
                        if (prop === 'applyChange') return (propertyName: string, newValue: any) => {
                            PropertyHelper.setPropertyValue(target, propertyName, newValue);
                            return propertyName === 'type';
                        };
                        return target[prop];
                    }
                });
                InspectorSectionRenderer.renderSections(proxy as any, parent, context);
                return;
            }
        }

        let inspectorFile = './inspector.json';

        if (handler && typeof handler.getInspectorTemplate === 'function') {
            const customTemplate = handler.getInspectorTemplate(obj);
            if (customTemplate) inspectorFile = customTemplate;
        } else if (typeof (obj as any).getInspectorFile === 'function') {
            inspectorFile = (obj as any).getInspectorFile();
        }

        const staticObjects = await context.templateLoader.loadTemplate(inspectorFile, obj);

        const isDefaultInspector = inspectorFile === './inspector.json';
        const dynamicObjects = isDefaultInspector ? context.renderer.generateUIFromProperties(obj) : [];

        const uiObjects = [...staticObjects, ...dynamicObjects];

        uiObjects.forEach(def => {
            const el = InspectorLegacyRenderer.renderUIDefinition(def, obj, context);
            if (el) parent.appendChild(el);
        });
    }
}
