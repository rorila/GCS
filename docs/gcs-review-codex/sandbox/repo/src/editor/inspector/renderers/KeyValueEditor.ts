import { IInspectorContext } from './IInspectorContext';
import { PropertyHelper } from '../../../runtime/PropertyHelper';
import { MediaImageEditor } from './MediaImageEditor';
import { Logger } from '../../../utils/Logger';
import { SectionRendererHelpers } from './SectionRendererHelpers';

const logger = Logger.get('KeyValueEditor');

export class KeyValueEditor {
    public static renderKeyValue(propDef: any, obj: any, context: IInspectorContext, container: HTMLElement): void {
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

        const isFlowNode = SectionRendererHelpers.isFlowNode(obj);

        const applyChanges = (newChanges: Record<string, any>) => {
            if (isFlowNode && typeof obj.applyChange === 'function') {
                obj.applyChange('changes', newChanges);
            } else {
                PropertyHelper.setPropertyValue(obj, 'changes', newChanges);
            }
            if (typeof obj.refreshVisuals === 'function') obj.refreshVisuals();
            context.update(obj);
        };

        let targetPropertyOptions: { name: string, label: string, type: string, options?: any[] }[] = [];
        // targetObj logic removed for Universal Data Setter

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

                let keyElement: HTMLElement;

                const keyInput = document.createElement('input');
                keyInput.type = 'text';
                keyInput.value = key;
                keyInput.title = 'Datenquelle / Eigenschaft (z.B. Player1.x)';
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

                const changeKeyBtn = document.createElement('button');
                changeKeyBtn.textContent = 'V';
                changeKeyBtn.title = 'Datenquelle wählen';
                changeKeyBtn.style.cssText = 'padding:2px 4px;background:#8e44ad;color:white;border:none;border-radius:3px;cursor:pointer;font-size:10px;font-weight:bold;flex-shrink:0;margin-left:2px;';
                changeKeyBtn.onclick = async () => {
                    const { VariablePickerDialog } = await import('../VariablePickerDialog');
                    const pickerMode = (obj && (obj.type === 'increment' || obj.type === 'negate')) ? 'pure_variable' : 'all';
                    const chosen = await VariablePickerDialog.show(undefined, pickerMode);
                    if (chosen) {
                        const newChanges: Record<string, any> = {};
                        for (const [k, v] of Object.entries(changes)) {
                            newChanges[k === key ? chosen : k] = v;
                        }
                        applyChanges(newChanges);
                    }
                };

                const keyWrapper = document.createElement('div');
                keyWrapper.style.cssText = 'display:flex; flex:1; gap:2px;';
                keyWrapper.appendChild(keyInput);
                keyWrapper.appendChild(changeKeyBtn);
                keyElement = keyWrapper;

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
                        const lower = raw.toLowerCase();
                        if (lower === 'true' || lower === 'false') {
                            newChanges[key] = lower === 'true';
                        } else {
                            const num = Number(raw);
                            newChanges[key] = (!isNaN(num) && raw !== '') ? num : raw;
                        }
                        applyChanges(newChanges);
                    };
                    valWrapper.appendChild(valInput);

                    const lowerKey = key.toLowerCase();
                    const isImage = lowerKey.includes('image') || key === 'src' || key === 'icon';
                    const isAudio = lowerKey.includes('sound') || lowerKey.includes('audio') || key === 'bgm' || key === 'sfx';

                    if (isImage || isAudio) {
                        MediaImageEditor.appendFilePickerButton(valWrapper, valInput, {
                            mode: isImage ? 'image' : 'audio',
                            icon: isImage ? '🖼️' : '🔊'
                        });
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
                pickVarBtn.title = 'Variable verknüpfen (Bind)';
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
                    } catch (e) { logger.error('Fehler beim Auflösen der Repeater-Bindings:', e); }

                    const { VariablePickerDialog } = await import('../VariablePickerDialog');
                    const chosen = await VariablePickerDialog.show({
                        objectId: obj.id || obj.name,
                        repeaterFields
                    });

                    if (chosen) {
                        const actualInput = valElement instanceof HTMLInputElement ? valElement : valElement.querySelector('input');
                        if (actualInput instanceof HTMLInputElement) {
                            actualInput.type = 'text';
                            actualInput.value = '${' + chosen + '}';
                            if (typeof actualInput.onchange === 'function') {
                                actualInput.onchange(new Event('change'));
                            }
                        } else {
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
            const { VariablePickerDialog } = await import('../VariablePickerDialog');
            const selectedKey = await VariablePickerDialog.show();
            if (selectedKey) {
                const defaultVal = propDef.valueType === 'boolean' ? true : '';
                const newChanges = { ...changes, [selectedKey]: defaultVal };
                applyChanges(newChanges);
            }
        };
        container.appendChild(addBtn);
    }
}
