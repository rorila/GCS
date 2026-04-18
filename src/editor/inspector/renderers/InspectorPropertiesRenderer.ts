import { IInspectorContext } from './IInspectorContext';
import { isInspectable } from '../types';
import { InspectorSectionRenderer } from './InspectorSectionRenderer';
import { InspectorLegacyRenderer } from './InspectorLegacyRenderer';
import { InspectorRegistry } from '../InspectorRegistry';
import { componentRegistry } from '../../../services/ComponentRegistry';
import { PropertyHelper } from '../../../runtime/PropertyHelper';

export class InspectorPropertiesRenderer {
    public static async renderPropertiesContent(obj: any, parent: HTMLElement, context: IInspectorContext): Promise<void> {

        // ═══════════════════════════════════════════════════════════════
        // GUARD: Geerbte Blueprint-Objekte auf Nicht-Blueprint-Stages
        // dürfen NICHT konfiguriert werden – nur ausgeblendet.
        // ═══════════════════════════════════════════════════════════════
        if (obj.isInherited && obj.isFromBlueprint) {
            const project = context.project;
            const activeStage = project?.stages?.find((s: any) => s.id === project.activeStageId);
            if (activeStage && activeStage.type !== 'blueprint') {
                this.renderInheritedBlueprintCard(obj, parent, context, activeStage);
                return;
            }
        }

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
        
        let dynamicObjects: any[] = [];
        if (isDefaultInspector) {
            // FIX: Für nackte JSON-Objekte generieren wir die Properties via Registry nach!
            if (typeof obj.getInspectorProperties !== 'function') {
                const props = componentRegistry.getInspectorProperties(obj);
                if (props && props.length > 0) {
                    obj.getInspectorProperties = () => props;
                }
            }
            dynamicObjects = context.renderer.generateUIFromProperties(obj);
        }

        const uiObjects = [...staticObjects, ...dynamicObjects];

        uiObjects.forEach(def => {
            const el = InspectorLegacyRenderer.renderUIDefinition(def, obj, context);
            if (el) parent.appendChild(el);
        });
    }

    /**
     * Rendert eine Read-Only Info-Karte für geerbte Blueprint-Objekte.
     * Zeigt Name, Typ, Herkunft und einen Button zum Ausblenden auf dieser Stage.
     */
    private static renderInheritedBlueprintCard(
        obj: any,
        parent: HTMLElement,
        context: IInspectorContext,
        activeStage: any
    ): void {
        const card = document.createElement('div');
        card.style.cssText = 'margin:8px 0;padding:16px;background:linear-gradient(135deg,rgba(63,81,181,0.15) 0%,rgba(30,30,40,0.95) 100%);border-left:4px solid #3f51b5;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.3);';

        // Objekt-Name
        const title = document.createElement('div');
        title.style.cssText = 'font-size:14px;font-weight:700;color:#8c9eff;margin-bottom:8px;';
        title.textContent = obj.name || obj.id || 'Unbekannt';
        card.appendChild(title);

        // Typ-Badge
        const typeBadge = document.createElement('div');
        typeBadge.style.cssText = 'display:inline-block;padding:2px 8px;background:rgba(63,81,181,0.3);color:#8c9eff;border-radius:4px;font-size:11px;border:1px solid rgba(63,81,181,0.5);margin-bottom:12px;';
        typeBadge.textContent = `${obj.className || 'Objekt'} – aus Blueprint geerbt`;
        card.appendChild(typeBadge);

        // Info-Text
        const info = document.createElement('div');
        info.style.cssText = 'color:#888;font-size:12px;line-height:1.5;margin-bottom:16px;';
        info.innerHTML = `Dieses Element stammt aus der <strong style="color:#8c9eff">Blueprint-Stage</strong> und wird auf allen Stages angezeigt.<br><br>Um es zu bearbeiten, wechsle zur Blueprint-Stage.`;
        card.appendChild(info);

        // Separator
        const sep = document.createElement('div');
        sep.style.cssText = 'height:1px;background:#444;margin:12px 0;';
        card.appendChild(sep);

        // Ausblenden-Button
        const hideBtn = document.createElement('button');
        hideBtn.style.cssText = 'width:100%;padding:8px;background:#3d1515;color:#ffab91;border:1px solid #662222;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;transition:background 0.15s;';
        hideBtn.textContent = `👻 Auf "${activeStage.name}" ausblenden`;
        hideBtn.onmouseenter = () => { hideBtn.style.background = '#662222'; };
        hideBtn.onmouseleave = () => { hideBtn.style.background = '#3d1515'; };
        hideBtn.onclick = () => {
            if (!activeStage.excludedBlueprintIds) activeStage.excludedBlueprintIds = [];
            const objId = obj.id || obj.name;
            if (!activeStage.excludedBlueprintIds.includes(objId)) {
                activeStage.excludedBlueprintIds.push(objId);
            }
            // Inspector und Stage neu rendern
            if (context.onObjectSelect) context.onObjectSelect(null);
            if (context.onObjectUpdate) context.onObjectUpdate();
        };
        card.appendChild(hideBtn);

        parent.appendChild(card);
    }
}
