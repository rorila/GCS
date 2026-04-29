import { IInspectable } from '../types';
import { IInspectorContext } from './IInspectorContext';
import { GROUP_COLORS } from '../../../components/TComponent';
import { PropertyHelper } from '../../../runtime/PropertyHelper';
import { mediatorService } from '../../../services/MediatorService';
import { componentRegistry } from '../../../services/ComponentRegistry';
import { NotificationToast } from '../../ui/NotificationToast';
import { PropertyPickerDialog } from '../PropertyPickerDialog';
import { MediaPickerDialog } from '../MediaPickerDialog';



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
            while (i < props.length) {
                const propDef = props[i];

                if (propDef.visibleWhen) {
                    const condValues = propDef.visibleWhen.values;
                    const currentCondValue = PropertyHelper.getPropertyValue(obj, propDef.visibleWhen.field) ?? '';
                    if (Array.isArray(condValues) && !condValues.includes(currentCondValue)) { i++; continue; }
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
                    body.appendChild(inlineRow);
                } else {
                    const el = this.renderProperty(propDef, obj, context);
                    if (el) body.appendChild(el);
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

        const container = document.createElement('div');
        const isInline = !!propDef.inline;
        container.style.cssText = `display:flex;align-items:center;gap:${isInline ? '4' : '8'}px;margin-bottom:4px;`;

        if (propDef.type === 'button') {
            container.style.display = 'block';
            const btn = document.createElement('button');
            btn.innerText = propDef.label;
            btn.style.cssText = 'width:100%;padding:6px 12px;border:none;border-radius:4px;cursor:pointer;color:#fff;font-size:11px;' +
                (propDef.style ? Object.entries(propDef.style).map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`).join(';') : 'background:#444');
            btn.onclick = () => {
                if (propDef.action && context.actionHandler) {
                    (context.actionHandler as any).handleAction(propDef, obj);
                }
            };
            container.appendChild(btn);
            return container;
        }

        if (propDef.type === 'info') {
            container.style.display = 'block';
            const info = document.createElement('div');
            info.textContent = propDef.label || '';
            if (propDef.style) {
                info.style.cssText = Object.entries(propDef.style)
                    .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`)
                    .join(';');
            } else {
                info.style.cssText = 'font-size:11px;color:#8c9eff;padding:4px 8px;border-radius:4px;background:rgba(63,81,181,0.3);border:1px solid rgba(63,81,181,0.5)';
            }
            container.appendChild(info);
            return container;
        }

        if (propDef.label && propDef.type !== 'textarea') {
            const label = context.renderer.renderLabel(propDef.label);
            label.style.marginBottom = '0';
            label.style.flexShrink = '0';
            if (propDef.type === 'keyvalue') {
                label.style.whiteSpace = 'normal';
            } else if (isInline) {
                label.style.whiteSpace = 'nowrap';
            } else {
                label.style.minWidth = '70px';
                label.style.maxWidth = '90px';
                label.style.whiteSpace = 'nowrap';
                label.style.overflow = 'hidden';
                label.style.textOverflow = 'ellipsis';
            }
            container.appendChild(label);
        }

        const currentValue = PropertyHelper.getPropertyValue(obj, propDef.name) ?? propDef.defaultValue ?? '';

        if (propDef.type === 'select') {
            let options = propDef.options || [];
            if (!Array.isArray(options) || options.length === 0) {
                if (propDef.source) {
                    options = context.renderer.getOptionsFromSource(propDef, obj);
                }
            }
            // Placeholder-Text: bei Ziel-Auswahl immer erzwingen
            const placeholderText = propDef.placeholder ||
                (propDef.source === 'objects_and_services' ? '--- Ziel wählen ---' :
                 propDef.source === 'methods_of_target'   ? '--- Methode wählen ---' : undefined);

            // Wenn obj.target fehlt aber Optionen vorhanden: ersten Wert als Default setzen
            let effectiveValue = currentValue;
            if (!effectiveValue && (propDef.source === 'objects_and_services') && options.length > 0) {
                effectiveValue = options[0].value || options[0];
                PropertyHelper.setPropertyValue(obj, propDef.name, effectiveValue);
            }

            const select = context.renderer.renderSelect(
                Array.isArray(options) ? options : [],
                effectiveValue,
                placeholderText
            );
            const selectName = propDef.controlName || propDef.name || '';
            if (selectName) select.name = selectName;
            select.onchange = async () => {
                if (context.eventHandler) {
                    const event = context.eventHandler.handleControlChange(
                        selectName, select.value, obj,
                        { ...propDef, property: propDef.name }
                    );
                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (context.onObjectUpdate) context.onObjectUpdate(event);
                    }
                }
                if (typeof obj.applyChange === 'function') {
                    const needsReRender = obj.applyChange(propDef.name, select.value, currentValue);
                    if (needsReRender) {
                        context.update(obj);
                    }
                }
                // Bei Ziel-Wechsel: Inspector neu rendern damit Methoden-Liste sich aktualisiert
                if (propDef.name === 'target' || propDef.name === 'service') {
                    PropertyHelper.setPropertyValue(obj, propDef.name, select.value);
                    context.update(obj);
                }
            };
            select.style.flex = '1';
            container.appendChild(select);
        } else if (propDef.type === 'boolean' || propDef.type === 'checkbox') {
            const cb = document.createElement('input');
            cb.type = 'checkbox';

            const isFontWeight = propDef.name === 'style.fontWeight';
            const isFontStyle = propDef.name === 'style.fontStyle';

            if (isFontWeight) {
                cb.checked = currentValue === 'bold' || currentValue === '700' || currentValue === '800' || currentValue === '900';
            } else if (isFontStyle) {
                cb.checked = currentValue === 'italic';
            } else {
                cb.checked = !!currentValue;
            }

            cb.onchange = () => {
                let newValue: any = cb.checked;
                if (isFontWeight) newValue = cb.checked ? 'bold' : 'normal';
                if (isFontStyle) newValue = cb.checked ? 'italic' : 'normal';

                if (context.eventHandler) {
                    const event = context.eventHandler.handleControlChange(
                        propDef.name, newValue, obj,
                        { ...propDef, property: propDef.name }
                    );
                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (context.onObjectUpdate) context.onObjectUpdate(event);
                    }
                }
            };
            container.appendChild(cb);
        } else if (propDef.type === 'color') {
            const colorContainer = context.renderer.renderColorInput(String(currentValue || '#000000'));
            const colorInput = (colorContainer as any).colorInput as HTMLInputElement;
            const textInput = (colorContainer as any).textInput as HTMLInputElement;

            const updateColorValue = (newValue: string) => {
                if (context.eventHandler) {
                    const event = context.eventHandler.handleControlChange(
                        propDef.name, newValue, obj,
                        { ...propDef, property: propDef.name }
                    );
                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (context.onObjectUpdate) context.onObjectUpdate(event);
                    }
                }
            };

            colorInput.oninput = () => {
                textInput.value = colorInput.value;
                updateColorValue(colorInput.value);
            };

            textInput.oninput = () => {
                if (textInput.value.startsWith('#') && textInput.value.length === 7) {
                    colorInput.value = textInput.value;
                    updateColorValue(textInput.value);
                }
            };

            textInput.onchange = () => {
                updateColorValue(textInput.value);
            };

            colorContainer.style.flex = '1';
            colorContainer.style.marginBottom = '0'; // Überschreibe default margin von renderColorInput
            
            const pickVarBtn = document.createElement('button');
            pickVarBtn.textContent = 'V';
            pickVarBtn.title = 'Variable verknüpfen (Bind)';
            pickVarBtn.style.cssText = 'padding: 4px; background: #e67e22; color: #fff; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; width: 24px; font-weight: bold; flex-shrink: 0;';
            pickVarBtn.onclick = () => {
                if (context.actionHandler) {
                    (context.actionHandler as any).handleAction(
                        { action: 'pickVariable', property: propDef.name, propertyType: propDef.type },
                        obj
                    );
                }
            };
            
            colorContainer.appendChild(pickVarBtn);
            container.appendChild(colorContainer);
        } else if (propDef.type === 'keyvalue') {
            container.style.display = 'block'; 
            container.style.marginBottom = '8px';

            if (propDef.hint) {
                const hint = document.createElement('div');
                hint.style.cssText = 'font-size:10px;color:#666;margin-bottom:6px;font-style:italic;';
                hint.textContent = propDef.hint;
                container.appendChild(hint);
            }

            const changes: Record<string, any> = propDef.value || {};
            const entries = Object.entries(changes);

            const rowsContainer = document.createElement('div');
            rowsContainer.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

            const applyChanges = (newChanges: Record<string, any>) => {
                if (typeof obj.applyChange === 'function') {
                    obj.applyChange('changes', newChanges);
                } else {
                    PropertyHelper.setPropertyValue(obj, 'changes', newChanges);
                }
                if (typeof obj.refreshVisuals === 'function') obj.refreshVisuals();
                context.update(obj);
            };

            let targetPropertyOptions: { name: string, label: string, type: string, options?: any[] }[] = [];
            let targetObj: any = null;
            if (obj.target && (obj as any).projectRef) {
                const project = (obj as any).projectRef;

                const flattenObjects = (arr: any[]): any[] => {
                    let res: any[] = [];
                    for (const o of arr) {
                        res.push(o);
                        if (o.children && Array.isArray(o.children)) res.push(...flattenObjects(o.children));
                    }
                    return res;
                };

                for (const stage of (project.stages || [])) {
                    const allStageObjects = flattenObjects(stage.objects || []);
                    const found = allStageObjects.find((o: any) => o.name === obj.target || o.id === obj.target);
                    if (found) { targetObj = found; break; }
                    const foundVar = (stage.variables || []).find((v: any) => v.name === obj.target || v.id === obj.target);
                    if (foundVar) { targetObj = foundVar; break; }
                }

                if (!targetObj) {
                    const allGlobalObjects = flattenObjects(project.objects || []);
                    targetObj = allGlobalObjects.find((o: any) => o.name === obj.target || o.id === obj.target);
                }
                if (!targetObj) {
                    targetObj = (project.variables || []).find((v: any) => v.name === obj.target || v.id === obj.target);
                }
                if (targetObj?.className) {
                    const props = componentRegistry.getInspectorProperties({ className: targetObj.className });
                    targetPropertyOptions = props
                        .filter((p: any) => p.name && p.name !== 'name' && p.name !== 'id')
                        .map((p: any) => ({
                            name: p.name,
                            label: p.label || p.name,
                            type: p.type || 'string',
                            options: p.options
                        }));
                }
            }

            if (entries.length === 0) {
                const emptyHint = document.createElement('div');
                emptyHint.style.cssText = 'font-size:10px;color:#666;padding:6px 8px;background:rgba(255,255,255,0.03);border-radius:4px;text-align:center;font-style:italic;';
                emptyHint.textContent = 'Keine Eigenschafts-Änderungen definiert';
                rowsContainer.appendChild(emptyHint);
            } else {
                entries.forEach(([key, value]) => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:4px 6px;background:rgba(255,255,255,0.04);border-radius:4px;border:1px solid rgba(255,255,255,0.08);';

                    const propInfo = targetPropertyOptions.find(p => p.name === key);
                    const propType = propDef.valueType || propInfo?.type || 'string';

                    let keyElement: HTMLSelectElement | HTMLInputElement;
                    if (targetPropertyOptions.length > 0) {
                        const keySelect = document.createElement('select');
                        keySelect.title = 'Eigenschafts-Name';
                        keySelect.style.cssText = 'flex:1;padding:3px 6px;background:#2a2a3e;color:#e0d4f5;border:1px solid #444;border-radius:3px;font-size:11px;font-family:Consolas,monospace;min-width:60px;cursor:pointer;';
                        for (const propOpt of targetPropertyOptions) {
                            const opt = document.createElement('option');
                            opt.value = propOpt.name;
                            opt.textContent = `${propOpt.label} (${propOpt.name})`;
                            if (propOpt.name === key) opt.selected = true;
                            keySelect.appendChild(opt);
                        }
                        if (key && !targetPropertyOptions.find(p => p.name === key)) {
                            const customOpt = document.createElement('option');
                            customOpt.value = key;
                            customOpt.textContent = `${key} (benutzerdefiniert)`;
                            customOpt.selected = true;
                            keySelect.insertBefore(customOpt, keySelect.firstChild);
                        }
                        keySelect.onchange = () => {
                            const newKey = keySelect.value.trim();
                            if (!newKey || newKey === key) return;
                            const newChanges: Record<string, any> = {};
                            for (const [k, v] of Object.entries(changes)) {
                                newChanges[k === key ? newKey : k] = v;
                            }
                            applyChanges(newChanges);
                        };
                        keyElement = keySelect;
                    } else {
                        const keyInput = document.createElement('input');
                        keyInput.type = 'text';
                        keyInput.value = key;
                        keyInput.title = 'Eigenschafts-Name';
                        keyInput.style.cssText = 'flex:1;padding:3px 6px;background:#2a2a3e;color:#e0d4f5;border:1px solid #444;border-radius:3px;font-size:11px;font-family:Consolas,monospace;min-width:60px;';
                        keyInput.onchange = () => {
                            const newKey = keyInput.value.trim();
                            if (!newKey || newKey === key) return;
                            const newChanges: Record<string, any> = {};
                            for (const [k, v] of Object.entries(changes)) {
                                newChanges[k === key ? newKey : k] = v;
                            }
                            applyChanges(newChanges);
                        };
                        keyElement = keyInput;
                    }

                    const sep = document.createElement('span');
                    sep.textContent = ':';
                    sep.style.cssText = 'color:#888;font-size:11px;font-weight:bold;flex-shrink:0;';

                    let valElement: HTMLElement;

                    if (propType === 'boolean') {
                        const cbLabel = document.createElement('label');
                        cbLabel.style.cssText = 'flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;padding:2px 6px;';
                        const cb = document.createElement('input');
                        cb.type = 'checkbox';
                        cb.checked = value === true || value === 'true';
                        cb.style.cssText = 'width:14px;height:14px;accent-color:#4fc3f7;cursor:pointer;';
                        const cbText = document.createElement('span');
                        cbText.textContent = cb.checked ? 'Ja' : 'Nein';
                        cbText.style.cssText = 'font-size:11px;color:#4fc3f7;';
                        cb.onchange = () => {
                            cbText.textContent = cb.checked ? 'Ja' : 'Nein';
                            const newChanges = { ...changes };
                            newChanges[key] = cb.checked;
                            applyChanges(newChanges);
                        };
                        cbLabel.appendChild(cb);
                        cbLabel.appendChild(cbText);
                        valElement = cbLabel;

                    } else if (propType === 'select' && propInfo?.options) {
                        const valSelect = document.createElement('select');
                        valSelect.style.cssText = 'flex:1;padding:3px 6px;background:#2a2a3e;color:#4fc3f7;border:1px solid #444;border-radius:3px;font-size:11px;cursor:pointer;';
                        for (const opt of propInfo.options) {
                            const optEl = document.createElement('option');
                            if (typeof opt === 'object' && opt.value !== undefined) {
                                optEl.value = opt.value;
                                optEl.textContent = opt.label || opt.value;
                            } else {
                                optEl.value = String(opt);
                                optEl.textContent = String(opt);
                            }
                            if (String(opt?.value ?? opt) === String(value)) optEl.selected = true;
                            valSelect.appendChild(optEl);
                        }
                        if (value && !propInfo.options.find((o: any) => String(o?.value ?? o) === String(value))) {
                            const customOpt = document.createElement('option');
                            customOpt.value = String(value);
                            customOpt.textContent = `${value} (aktuell)`;
                            customOpt.selected = true;
                            valSelect.insertBefore(customOpt, valSelect.firstChild);
                        }
                        valSelect.onchange = () => {
                            const newChanges = { ...changes };
                            newChanges[key] = valSelect.value;
                            applyChanges(newChanges);
                        };
                        valElement = valSelect;

                    } else if (propType === 'color') {
                        const colorRow = document.createElement('div');
                        colorRow.style.cssText = 'flex:1;display:flex;align-items:center;gap:4px;';
                        const colorInput = document.createElement('input');
                        colorInput.type = 'color';
                        colorInput.value = String(value || '#000000');
                        colorInput.style.cssText = 'width:24px;height:20px;border:none;cursor:pointer;background:transparent;';
                        const colorText = document.createElement('input');
                        colorText.type = 'text';
                        colorText.value = String(value || '');
                        colorText.style.cssText = 'flex:1;padding:3px 6px;background:#2a2a3e;color:#4fc3f7;border:1px solid #444;border-radius:3px;font-size:11px;font-family:Consolas,monospace;';
                        colorInput.oninput = () => {
                            colorText.value = colorInput.value;
                            const newChanges = { ...changes };
                            newChanges[key] = colorInput.value;
                            applyChanges(newChanges);
                        };
                        colorText.onchange = () => {
                            colorInput.value = colorText.value;
                            const newChanges = { ...changes };
                            newChanges[key] = colorText.value;
                            applyChanges(newChanges);
                        };
                        colorRow.appendChild(colorInput);
                        colorRow.appendChild(colorText);
                        valElement = colorRow;

                    } else if (propType === 'number') {
                        const isBinding = typeof value === 'string' && value.includes('${');
                        const numInput = document.createElement('input');
                        numInput.type = isBinding ? 'text' : 'number';
                        numInput.value = String(value ?? '');
                        numInput.title = 'Numerischer Wert';
                        numInput.style.cssText = 'flex:1;padding:3px 6px;background:#2a2a3e;color:#4fc3f7;border:1px solid #444;border-radius:3px;font-size:11px;font-family:Consolas,monospace;min-width:60px;';
                        numInput.onchange = () => {
                            const newChanges = { ...changes };
                            const raw = numInput.value.trim();
                            if (raw.includes('${')) {
                                newChanges[key] = raw;
                            } else {
                                newChanges[key] = Number(raw) || 0;
                            }
                            applyChanges(newChanges);
                        };
                        valElement = numInput;

                    } else {
                        const valWrapper = document.createElement('div');
                        valWrapper.style.cssText = 'display:flex;gap:4px;flex:1;';

                        const valInput = document.createElement('input');
                        valInput.type = 'text';
                        valInput.value = String(value);
                        valInput.title = 'Wert';
                        valInput.style.cssText = 'flex:1;padding:3px 6px;background:#2a2a3e;color:#4fc3f7;border:1px solid #444;border-radius:3px;font-size:11px;font-family:Consolas,monospace;min-width:60px;';
                        valInput.onchange = () => {
                            const newChanges = { ...changes };
                            const raw = valInput.value.trim();
                            const num = Number(raw);
                            newChanges[key] = (!isNaN(num) && raw !== '') ? num : raw;
                            applyChanges(newChanges);
                        };
                        valWrapper.appendChild(valInput);

                        const lowerKey = key.toLowerCase();
                        const isImage = lowerKey.includes('image') || key === 'src' || key === 'icon';
                        const isAudio = lowerKey.includes('sound') || lowerKey.includes('audio') || key === 'bgm' || key === 'sfx';
                        
                        if (isImage || isAudio) {
                            const browseBtn = document.createElement('button');
                            browseBtn.textContent = isImage ? '🖼️' : '🔊';
                            browseBtn.title = isImage ? 'Bild auswählen' : 'Audio auswählen';
                            browseBtn.style.cssText = 'padding:2px 6px;background:#2a2a3e;color:#fff;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:11px;flex-shrink:0;transition:all 0.15s;';
                            browseBtn.onmouseenter = () => { browseBtn.style.borderColor = '#89b4fa'; browseBtn.style.background = '#3a3a4e'; };
                            browseBtn.onmouseleave = () => { browseBtn.style.borderColor = '#555'; browseBtn.style.background = '#2a2a3e'; };
                            browseBtn.onclick = async () => {
                                const chosen = await MediaPickerDialog.show({
                                    mode: isImage ? 'image' : 'audio',
                                    currentValue: String(value || '')
                                });
                                if (chosen !== null) {
                                    valInput.value = chosen;
                                    valInput.onchange!(new Event('change'));
                                }
                            };
                            valWrapper.appendChild(browseBtn);
                        }

                        valElement = valWrapper;
                    }

                    const delBtn = document.createElement('button');
                    delBtn.textContent = '🗑️';
                    delBtn.title = 'Diese Eigenschaft entfernen';
                    delBtn.style.cssText = 'padding:2px 4px;background:#d11a2a;color:white;border:none;border-radius:3px;cursor:pointer;font-size:10px;flex-shrink:0;';
                    delBtn.onclick = () => {
                        const newChanges = { ...changes };
                        delete newChanges[key];
                        applyChanges(newChanges);
                    };


                    const pickVarBtn = document.createElement('button');
                    pickVarBtn.textContent = 'V';
                    pickVarBtn.title = 'Variable verkn�pfen (Bind)';
                    pickVarBtn.style.cssText = 'padding:2px 4px;background:#e67e22;color:white;border:none;border-radius:3px;cursor:pointer;font-size:10px;font-weight:bold;flex-shrink:0;';
                    pickVarBtn.onclick = async () => {
                        let repeaterFields: string[] = [];
                        try {
                            const editor = (window as any).editor;
                            if (editor && editor.findParentContainer) {
                                let currentParent = editor.findParentContainer(obj.id);
                                while (currentParent) {
                                    if (currentParent.className === 'TDataList' || currentParent.type === 'DataList') {
                                        const dsName = currentParent.dataSource;
                                        if (dsName) {
                                            const { projectActionRegistry } = await import('../../../services/registry/ActionRegistry');
                                            const action = projectActionRegistry.getActions('all', false).find((a: any) => a.resultVariable === dsName || a.name === dsName);
                                            if (action && (action as any).selectFields) {
                                                const fieldsStr = (action as any).selectFields;
                                                repeaterFields = fieldsStr === '*' ? ['*'] : fieldsStr.split(',').map((f: string) => f.trim()).filter((f: string) => f);
                                            }
                                        }
                                        break;
                                    }
                                    currentParent = editor.findParentContainer(currentParent.id);
                                }
                            }
                        } catch (e) { console.error('Fehler beim Aufl�sen der Repeater-Bindings:', e); }

                        const { VariablePickerDialog } = await import('../VariablePickerDialog');
                        const chosen = await VariablePickerDialog.show({
                            objectId: obj.id || obj.name,
                            repeaterFields
                        });

                        if (chosen) {
                            console.log('[V-Button] Chosen variable:', chosen, 'key:', key);
                            const actualInput = valElement instanceof HTMLInputElement ? valElement : valElement.querySelector('input');
                            console.log('[V-Button] actualInput found?', actualInput !== null, 'valElement:', valElement);
                            if (actualInput instanceof HTMLInputElement) {
                                console.log('[V-Button] setting actualInput.value...');
                                actualInput.type = 'text';
                                actualInput.value = '${' + chosen + '}';
                                if (typeof actualInput.onchange === 'function') {
                                    console.log('[V-Button] triggering onchange');
                                    actualInput.onchange(new Event('change'));
                                } else {
                                    console.log('[V-Button] no onchange found on actualInput');
                                }
                            } else {
                                console.log('[V-Button] falling back to applyChanges');
                                const newChanges = { ...changes };
                                newChanges[key] = '${' + chosen + '}';
                                applyChanges(newChanges);
                            }
                        }
                    };

                    row.appendChild(keyElement);
                    row.appendChild(sep);
                    row.appendChild(valElement);
                    row.appendChild(pickVarBtn);
                    row.appendChild(delBtn);
                    rowsContainer.appendChild(row);
                });
            }

            container.appendChild(rowsContainer);

            const addBtn = document.createElement('button');
            addBtn.textContent = '+ Eigenschaft hinzufügen';
            addBtn.style.cssText = 'margin-top:6px;width:100%;padding:5px 10px;background:#2e7d32;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;';
            addBtn.onclick = async () => {
                const usedKeys = Object.keys(changes);
                if (!targetObj) {
                    const freeOpt = targetPropertyOptions.find(p => !usedKeys.includes(p.name));
                    const defaultKey = freeOpt ? freeOpt.name : '';
                    const newChanges = { ...changes, [defaultKey]: '' };
                    applyChanges(newChanges);
                    return;
                }
                const selectedKey = await PropertyPickerDialog.show(targetObj, usedKeys);
                if (selectedKey) {
                    const newChanges = { ...changes, [selectedKey]: '' };
                    applyChanges(newChanges);
                }
            };
            container.appendChild(addBtn);

            return container;
        } else if (propDef.type === 'image_picker' || propDef.type === 'audio_picker' || propDef.type === 'video_picker') {
            const pickerIcon = propDef.type === 'image_picker' ? '🖼️'
                             : propDef.type === 'audio_picker' ? '🔊'
                             : '🎬';
            const pickerAction = propDef.type === 'image_picker' ? 'browseImage'
                               : propDef.type === 'audio_picker' ? 'browseAudio'
                               : 'browseVideo';

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex;gap:4px;flex:1;align-items:center;';

            const input = context.renderer.renderEdit(String(currentValue));
            input.style.flex = '1';
            if (propDef.name) input.name = propDef.name + 'Input';
            input.onchange = () => {
                if (context.eventHandler) {
                    const event = context.eventHandler.handleControlChange(
                        input.name, input.value, obj,
                        { ...propDef, property: propDef.name }
                    );
                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (context.onObjectUpdate) context.onObjectUpdate(event);
                    }
                }
            };

            const browseBtn = document.createElement('button');
            browseBtn.textContent = pickerIcon;
            browseBtn.title = propDef.type === 'image_picker' ? 'Bild auswählen'
                            : propDef.type === 'audio_picker' ? 'Audio auswählen'
                            : 'Video auswählen';
            browseBtn.style.cssText = 'padding:4px 8px;background:#2a2a3e;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:14px;flex-shrink:0;transition:all 0.15s;';
            browseBtn.onmouseenter = () => { browseBtn.style.borderColor = '#89b4fa'; browseBtn.style.background = '#3a3a4e'; };
            browseBtn.onmouseleave = () => { browseBtn.style.borderColor = '#555'; browseBtn.style.background = '#2a2a3e'; };
            browseBtn.onclick = () => {
                if (context.actionHandler) {
                    (context.actionHandler as any).handleAction(
                        { action: pickerAction, property: propDef.name },
                        obj
                    );
                }
            };

            wrapper.appendChild(input);
            wrapper.appendChild(browseBtn);

            if (propDef.type === 'image_picker') {
                const pasteBtn = document.createElement('button');
                pasteBtn.textContent = '📋';
                pasteBtn.title = 'Bild aus Zwischenablage einfügen (Base64)';
                pasteBtn.style.cssText = 'padding:4px 8px;background:#2a2a3e;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:14px;flex-shrink:0;transition:all 0.15s;';
                pasteBtn.onmouseenter = () => { pasteBtn.style.borderColor = '#a6e3a1'; pasteBtn.style.background = '#2a3e2e'; };
                pasteBtn.onmouseleave = () => { pasteBtn.style.borderColor = '#555'; pasteBtn.style.background = '#2a2a3e'; };
                pasteBtn.onclick = async () => {
                    try {
                        const clipboardItems = await navigator.clipboard.read();
                        let imageBlob: Blob | null = null;
                        for (const item of clipboardItems) {
                            const imageType = item.types.find(t => t.startsWith('image/'));
                            if (imageType) {
                                imageBlob = await item.getType(imageType);
                                break;
                            }
                        }
                        if (!imageBlob) {
                            NotificationToast.show('Kein Bild in der Zwischenablage gefunden.');
                            return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const dataUrl = reader.result as string;
                            input.value = dataUrl;
                            input.dispatchEvent(new Event('change'));
                            pasteBtn.textContent = '✅';
                            setTimeout(() => { pasteBtn.textContent = '📋'; }, 1500);
                        };
                        reader.readAsDataURL(imageBlob);
                    } catch (e: any) {
                        NotificationToast.show('Fehler beim Lesen der Zwischenablage: ' + e.message);
                    }
                };
                wrapper.appendChild(pasteBtn);
            }

            container.appendChild(wrapper);
        } else {
            let input: HTMLInputElement | HTMLTextAreaElement;
            if (propDef.type === 'textarea') {
                input = context.renderer.renderTextArea(String(currentValue));
            } else if (propDef.type === 'number') {
                // VALIDIERUNG: Number-Inputs bekommen nativen type='number' + Constraints
                input = document.createElement('input');
                input.type = 'number';
                input.value = String(currentValue);
                input.className = 'inspector-input';
                input.style.cssText = 'width:100%;background:#222;color:#fff;border:1px solid #444;border-radius:3px;padding:4px 6px;font-size:12px;outline:none;box-sizing:border-box;';
                if (propDef.min !== undefined) (input as HTMLInputElement).min = String(propDef.min);
                if (propDef.max !== undefined) (input as HTMLInputElement).max = String(propDef.max);
                if (propDef.step !== undefined) (input as HTMLInputElement).step = String(propDef.step);
            } else {
                input = context.renderer.renderEdit(String(currentValue));
            }
            input.style.flex = '1';
            if (propDef.readonly) input.readOnly = true;
            if (propDef.name) input.name = propDef.name + 'Input';

            // Generiere Tooltip mit Wertebereich-Info
            if (propDef.type === 'number' && (propDef.min !== undefined || propDef.max !== undefined)) {
                const parts: string[] = [];
                if (propDef.min !== undefined) parts.push(`Min: ${propDef.min}`);
                if (propDef.max !== undefined) parts.push(`Max: ${propDef.max}`);
                if (propDef.step !== undefined) parts.push(`Schritt: ${propDef.step}`);
                const rangeInfo = parts.join(' | ');
                input.title = propDef.hint ? `${propDef.hint} (${rangeInfo})` : rangeInfo;
            } else if (propDef.hint) {
                input.title = propDef.hint;
            }

            // Hint-Element für Validierungsmeldungen
            const hintEl = document.createElement('div');
            hintEl.className = 'inspector-hint';
            hintEl.style.display = 'none';

            const submitChange = () => {
                const rawVal = input.value.trim();
                const isBinding = rawVal.includes('${');

                // Binding-Validierung: Syntax prüfen
                if (isBinding) {
                    const openBraces = (rawVal.match(/\$\{/g) || []).length;
                    const closeBraces = (rawVal.match(/\}/g) || []).length;
                    if (openBraces !== closeBraces) {
                        hintEl.textContent = 'Ungültige Binding-Syntax: ${ und } müssen paarweise sein';
                        hintEl.style.display = 'block';
                        input.classList.add('inspector-input-error');
                        return; // BLOCKIERE ungültiges Binding
                    }
                }

                let newVal: any = propDef.type === 'number' && !isBinding ? Number(rawVal) : rawVal;

                // Auto-Clamp bei Number-Werten
                if (propDef.type === 'number' && !isBinding && !isNaN(newVal)) {
                    let clamped = false;
                    if (propDef.min !== undefined && newVal < propDef.min) {
                        newVal = propDef.min;
                        clamped = true;
                    }
                    if (propDef.max !== undefined && newVal > propDef.max) {
                        newVal = propDef.max;
                        clamped = true;
                    }
                    if (clamped) {
                        input.value = String(newVal);
                        // Shake-Animation für visuelles Feedback
                        input.classList.remove('inspector-input-error');
                        void (input as HTMLElement).offsetWidth; // Force reflow for re-triggering animation
                        input.classList.add('inspector-input-error');
                        setTimeout(() => {
                            input.classList.remove('inspector-input-error');
                            input.classList.add('inspector-input-valid');
                            setTimeout(() => input.classList.remove('inspector-input-valid'), 600);
                        }, 300);
                    }
                }

                // Custom Validator
                if (propDef.validate) {
                    const error = propDef.validate(newVal);
                    if (error) {
                        hintEl.textContent = error;
                        hintEl.style.display = 'block';
                        input.classList.add('inspector-input-error');
                        return; // BLOCKIERE ungültigen Wert
                    }
                }

                // Validierung bestanden → Hint ausblenden
                hintEl.textContent = '';
                hintEl.style.display = 'none';
                input.classList.remove('inspector-input-error', 'inspector-input-warning');

                if (context.eventHandler) {
                    const event = context.eventHandler.handleControlChange(
                        input.name, newVal, obj,
                        { ...propDef, property: propDef.name }
                    );
                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (context.onObjectUpdate) context.onObjectUpdate(event);
                    }
                }
            };
            
            // Live-Validierung bei Eingabe (nur visuelles Feedback, kein Block)
            if (propDef.type === 'number') {
                input.addEventListener('input', () => {
                    const rawVal = input.value.trim();
                    const isBinding = rawVal.includes('${');
                    if (isBinding || rawVal === '' || rawVal === '-') {
                        // Binding oder leeres Feld: keine Live-Validierung
                        input.classList.remove('inspector-input-warning', 'inspector-input-error');
                        hintEl.style.display = 'none';
                        return;
                    }
                    const num = Number(rawVal);
                    if (isNaN(num)) {
                        hintEl.textContent = 'Bitte eine Zahl eingeben';
                        hintEl.style.display = 'block';
                        input.classList.add('inspector-input-error');
                        input.classList.remove('inspector-input-warning');
                    } else if (propDef.min !== undefined && num < propDef.min) {
                        hintEl.textContent = `Wird auf Minimum (${propDef.min}) korrigiert`;
                        hintEl.style.display = 'block';
                        input.classList.add('inspector-input-warning');
                        input.classList.remove('inspector-input-error');
                    } else if (propDef.max !== undefined && num > propDef.max) {
                        hintEl.textContent = `Wird auf Maximum (${propDef.max}) korrigiert`;
                        hintEl.style.display = 'block';
                        input.classList.add('inspector-input-warning');
                        input.classList.remove('inspector-input-error');
                    } else {
                        hintEl.textContent = '';
                        hintEl.style.display = 'none';
                        input.classList.remove('inspector-input-warning', 'inspector-input-error');
                    }
                });
            }

            input.onchange = submitChange;
            
            if (propDef.type === 'textarea') {
                const wrapper = document.createElement('div');
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.gap = '4px';
                wrapper.style.width = '100%';
                
                const btnContainer = document.createElement('div');
                btnContainer.style.display = 'flex';
                btnContainer.style.justifyContent = 'space-between';
                btnContainer.style.alignItems = 'center';
                
                const pickVarBtn = document.createElement('button');
                pickVarBtn.textContent = 'V';
                pickVarBtn.title = 'Variable verknüpfen (Bind)';
                pickVarBtn.style.cssText = 'padding: 4px; background: #e67e22; color: #fff; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; width: 24px; font-weight: bold; flex-shrink: 0;';
                pickVarBtn.onclick = () => {
                    if (context.actionHandler) {
                        (context.actionHandler as any).handleAction(
                            { action: 'pickVariable', property: propDef.name, propertyType: propDef.type },
                            obj
                        );
                    }
                };

                const btn = document.createElement('button');
                btn.textContent = 'Übernehmen';
                btn.title = 'Text speichern und anzeigen';
                btn.style.cssText = 'padding: 4px 8px; background: #2e7d32; color: #fff; border: 1px solid #1b5e20; border-radius: 3px; cursor: pointer; font-size: 11px;';
                btn.onclick = submitChange;
                
                btnContainer.appendChild(pickVarBtn);
                btnContainer.appendChild(btn);
                
                wrapper.appendChild(input);
                wrapper.appendChild(hintEl);
                wrapper.appendChild(btnContainer);
                container.appendChild(wrapper);
            } else {
                const outerWrapper = document.createElement('div');
                outerWrapper.style.cssText = 'display:flex;flex-direction:column;flex:1;';

                const wrapper = document.createElement('div');
                wrapper.style.display = 'flex';
                wrapper.style.gap = '4px';
                wrapper.style.flex = '1';
                wrapper.style.alignItems = 'center';
                
                const pickVarBtn = document.createElement('button');
                pickVarBtn.textContent = 'V';
                pickVarBtn.title = 'Variable verknüpfen (Bind)';
                pickVarBtn.style.cssText = 'padding: 4px; background: #e67e22; color: #fff; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; width: 24px; font-weight: bold; flex-shrink: 0;';
                pickVarBtn.onclick = () => {
                    if (context.actionHandler) {
                        (context.actionHandler as any).handleAction(
                            { action: 'pickVariable', property: propDef.name, propertyType: propDef.type },
                            obj
                        );
                    }
                };

                wrapper.appendChild(input);
                
                const lowerName = (propDef.name || '').toLowerCase();
                const isImage = lowerName.includes('image') || propDef.name === 'src' || propDef.name === 'icon';
                const isAudio = lowerName.includes('sound') || lowerName.includes('audio') || propDef.name === 'bgm' || propDef.name === 'sfx';
                
                if ((isImage || isAudio) && propDef.type !== 'number') {
                    const browseBtn = document.createElement('button');
                    browseBtn.textContent = isImage ? '🖼️' : '🎵';
                    browseBtn.title = isImage ? 'Bild auswählen' : 'Audio auswählen';
                    browseBtn.style.cssText = 'padding: 4px; background: #2a2a3e; color: #fff; border: 1px solid #555; border-radius: 3px; cursor: pointer; font-size: 11px; width: 24px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;';
                    browseBtn.onclick = async () => {
                        const chosen = await MediaPickerDialog.show({
                            mode: isImage ? 'image' : 'audio',
                            currentValue: input.value
                        });
                        if (chosen !== null) {
                            input.value = chosen;
                            submitChange();
                        }
                    };
                    wrapper.appendChild(browseBtn);
                }
                wrapper.appendChild(pickVarBtn);
                outerWrapper.appendChild(wrapper);
                outerWrapper.appendChild(hintEl);
                container.appendChild(outerWrapper);
            }
        }

        return container;
    }
}













