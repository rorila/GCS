import { IInspectable } from '../types';
import { IInspectorContext } from './IInspectorContext';
import { GROUP_COLORS } from '../../../components/TComponent';
import { PropertyHelper } from '../../../runtime/PropertyHelper';
import { mediatorService } from '../../../services/MediatorService';
import { SectionRendererHelpers } from './SectionRendererHelpers';
import { StandardPropertyRenderer } from './StandardPropertyRenderer';
import { RecordSchemaEditor } from './RecordSchemaEditor';
import { ListValueEditor } from './ListValueEditor';
import { KeyValueEditor } from './KeyValueEditor';
import { MediaImageEditor } from './MediaImageEditor';

export class InspectorSectionRenderer {
    public static renderSections(obj: IInspectable, parent: HTMLElement, context: IInspectorContext): void {
        const groupColors = GROUP_COLORS;
        const sections = obj.getInspectorSections();

        sections.forEach(section => {
            const colorKey = section.label.replace(/^[^\w]*/, '').trim().toUpperCase();
            const accentColor = groupColors[colorKey] || '#4da6ff';

            const card = document.createElement('div');
            const borderStyle = accentColor ? `border-left:4px solid ${accentColor};` : 'border-left:4px solid rgba(255,255,255,0.08);';
            const bgTint = accentColor ? `background:linear-gradient(135deg, ${accentColor}12 0%, rgba(30,30,40,0.95) 100%);` : 'background:rgba(30,30,40,0.85);';
            card.style.cssText = `${borderStyle}${bgTint}margin:8px 0;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.3);overflow:hidden;`;

            const header = document.createElement('div');
            header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;user-select:none;transition:background 0.15s;';
            header.onmouseenter = () => { header.style.background = 'rgba(255,255,255,0.05)'; };
            header.onmouseleave = () => { header.style.background = ''; };

            const headerColor = accentColor || '#aaa';
            header.innerHTML = `
                <span style="font-size:14px">${section.icon || '📋'}</span>
                <span style="font-size:12px;font-weight:700;color:${headerColor};flex:1;letter-spacing:0.3px;text-transform:uppercase">${section.label}</span>
                <span style="font-size:9px;color:#555;transition:transform 0.2s" data-collapse-icon>${section.collapsed ? '▶' : '▼'}</span>
            `;

            const body = document.createElement('div');
            body.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:6px 12px 10px;';
            if (section.collapsed) body.style.display = 'none';

            header.onclick = () => {
                const isCollapsed = body.style.display === 'none';
                body.style.display = isCollapsed ? 'flex' : 'none';
                const icon = header.querySelector('[data-collapse-icon]');
                if (icon) {
                    icon.textContent = isCollapsed ? '▼' : '▶';
                }
            };

            card.appendChild(header);
            card.appendChild(body);
            parent.appendChild(card);

            const props = section.properties;
            let i = 0;
            let currentBody: HTMLElement = body;

            while (i < props.length) {
                const propDef = props[i];

                if (propDef.visibleWhen) {
                    const condValues = propDef.visibleWhen.values;
                    const currentCondValue = PropertyHelper.getPropertyValue(obj, propDef.visibleWhen.field) ?? '';
                    if (Array.isArray(condValues) && !condValues.includes(currentCondValue)) { i++; continue; }
                }

                if (propDef.type === 'separator') {
                    const frame = document.createElement('div');
                    frame.style.cssText = 'border:1px solid #444; border-radius:6px; padding:8px; margin-top:8px; margin-bottom:12px; background:#1e1e2e; display:flex; flex-direction:column; gap:6px;';
                    const header = document.createElement('div');
                    header.textContent = propDef.label || '';
                    header.style.cssText = 'font-size:12px;font-weight:bold;color:#4da6ff;margin-bottom:4px;';
                    frame.appendChild(header);
                    body.appendChild(frame);
                    currentBody = frame;
                    i++;
                    continue;
                }

                if (propDef.inline && i + 1 < props.length && props[i + 1].inline) {
                    const inlineRow = document.createElement('div');
                    inlineRow.style.cssText = 'display:flex;gap:8px;margin-bottom:4px;';

                    let count = 0;
                    while (i < props.length && props[i].inline && count < 2) {
                        const el = this.renderProperty(props[i], obj, context);
                        if (el) {
                            el.style.flex = '1';
                            el.style.marginBottom = '0';
                            inlineRow.appendChild(el);
                        }
                        i++;
                        count++;
                    }
                    currentBody.appendChild(inlineRow);
                } else {
                    const el = this.renderProperty(propDef, obj, context);
                    if (el) currentBody.appendChild(el);
                    i++;
                }
            }

            // Theme-Reset Button für die STIL Sektion hinzufügen
            if (colorKey === 'STIL' && (obj as any).style && Object.keys((obj as any).style).length > 0) {
                const resetBtn = document.createElement('button');
                resetBtn.innerText = 'Auf Theme zurücksetzen';
                resetBtn.style.cssText = 'margin-top: 8px; width: 100%; padding: 6px; background: rgba(255,100,100,0.2); border: 1px solid rgba(255,100,100,0.4); color: #ffcccc; border-radius: 4px; cursor: pointer; font-size: 11px; transition: background 0.2s;';
                resetBtn.onmouseenter = () => { resetBtn.style.background = 'rgba(255,100,100,0.3)'; };
                resetBtn.onmouseleave = () => { resetBtn.style.background = 'rgba(255,100,100,0.2)'; };
                resetBtn.onclick = () => {
                    if (confirm('Möchtest du alle manuellen Stilanpassungen dieser Komponente entfernen und sie auf das aktive Theme zurücksetzen?')) {
                        // Alle eigenen style-Eigenschaften löschen, außer Pflicht-Properties falls vorhanden
                        (obj as any).style = {};
                        mediatorService.notifyDataChanged({ property: 'style', value: {}, oldValue: null, object: obj }, 'inspector'); context.update(obj);
                    }
                };
                body.appendChild(resetBtn);
            }
        });
    }

    private static renderProperty(propDef: any, obj: any, context: IInspectorContext): HTMLElement | null {
        // Hidden-Properties sind nur für die Serialisierung (toDTO), nicht für die UI
        if (propDef.type === 'hidden') return null;

        if (propDef.type === 'label') {
            return StandardPropertyRenderer.renderLabel(propDef);
        }

        if (propDef.type === 'object_list') {
            return RecordSchemaEditor.renderObjectList(propDef, obj, context);
        }

        if (propDef.type === 'record_schema') {
            return RecordSchemaEditor.renderRecordSchema(propDef, obj, context);
        }

        if (propDef.type === 'value_list') {
            return ListValueEditor.renderValueList(propDef, obj, context);
        }

        const container = document.createElement('div');
        const isInline = !!propDef.inline;
        container.style.cssText = `display:flex;align-items:center;gap:${isInline ? '4' : '8'}px;margin-bottom:4px;`;

        let labelEl: HTMLElement | null = null;
        if (propDef.label && propDef.type !== 'textarea') {
            labelEl = context.renderer.renderLabel(propDef.label);
            labelEl.style.marginBottom = '0';
            labelEl.style.flexShrink = '0';
            if (propDef.type === 'keyvalue') {
                labelEl.style.whiteSpace = 'normal';
            } else if (isInline) {
                labelEl.style.whiteSpace = 'nowrap';
            } else {
                labelEl.style.minWidth = '70px';
                labelEl.style.maxWidth = '90px';
                labelEl.style.whiteSpace = 'nowrap';
                labelEl.style.overflow = 'hidden';
                labelEl.style.textOverflow = 'ellipsis';
            }
            container.appendChild(labelEl);
        }

        if (propDef.type === 'button') {
            StandardPropertyRenderer.renderButton(propDef, obj, context, container);
            return container;
        }

        if (propDef.type === 'info') {
            StandardPropertyRenderer.renderInfo(propDef, container);
            return container;
        }

        const { currentValue, isThemeValue, isFlowNode } = SectionRendererHelpers.resolvePropertyState(propDef, obj);

        if (labelEl && isThemeValue) {
            const indicator = document.createElement('span');
            indicator.textContent = '●';
            indicator.title = 'Wert aus dem aktiven Theme (lokal nicht überschrieben)';
            indicator.style.cssText = 'font-size:9px;color:#00bcd4;margin-left:4px;cursor:help;flex-shrink:0;';
            labelEl.appendChild(indicator);
        }

        switch (propDef.type) {
            case 'select':
                StandardPropertyRenderer.renderSelect(propDef, obj, context, container, currentValue, isFlowNode);
                break;
            case 'boolean':
            case 'checkbox':
                StandardPropertyRenderer.renderBoolean(propDef, obj, context, container, currentValue, isFlowNode);
                break;
            case 'color':
                MediaImageEditor.renderColor(propDef, obj, context, container, currentValue);
                break;
            case 'keyvalue':
                KeyValueEditor.renderKeyValue(propDef, obj, context, container);
                break;
            case 'image_picker':
            case 'audio_picker':
            case 'video_picker':
                MediaImageEditor.renderMediaPicker(propDef, obj, context, container, currentValue);
                break;
            default:
                StandardPropertyRenderer.renderGeneric(propDef, obj, context, container, currentValue);
                break;
        }

        return container;
    }
}
