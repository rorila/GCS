import { IInspectorContext } from './IInspectorContext';
import { PropertyHelper } from '../../../runtime/PropertyHelper';
import { projectObjectRegistry } from '../../../services/registry/ObjectRegistry';

export class RecordSchemaEditor {
    // ─── TObjectList: Liste ausgewählter Objekte mit Index anzeigen ───
    public static renderObjectList(propDef: any, obj: any, context: IInspectorContext): HTMLElement {
        const container = document.createElement('div');
        const rawValue = PropertyHelper.getPropertyValue(obj, propDef.name);
        const items = Array.isArray(rawValue) ? rawValue : [];
        const allObjects = projectObjectRegistry.getObjects();
        container.style.display = 'block';

        const list = document.createElement('div');
        list.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:6px;';

        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'Noch keine Objekte ausgewählt.';
            empty.style.cssText = 'font-size:11px;color:#8c9eff;padding:4px 0;';
            list.appendChild(empty);
        } else {
            const schema: any[] = Array.isArray((obj as any).fields) ? (obj as any).fields : [];
            const recordData: Record<string, any> = ((obj as any).recordData && typeof (obj as any).recordData === 'object')
                ? (obj as any).recordData
                : {};

            const commitRecordData = (next: Record<string, any>) => {
                if (context.eventHandler) {
                    context.eventHandler.handleControlChange('recordData', next, obj, { name: 'recordData', label: 'Record-Werte', type: 'json' });
                } else {
                    PropertyHelper.setPropertyValue(obj, 'recordData', next);
                }
                if (typeof (obj as any).rebuildData === 'function') (obj as any).rebuildData(allObjects);
                if (context.onProjectUpdate) context.onProjectUpdate();
            };

            items.forEach((id: string, index: number) => {
                const o = allObjects.find((oo: any) => oo.id === id);
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:4px;background:rgba(255,255,255,0.05);font-size:11px;color:#e0e0e0;flex-wrap:wrap;';
                const name = o ? o.name : id;
                const cls = o ? o.className : '';
                const text = document.createElement('span');
                text.style.cssText = 'flex:1;min-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
                text.textContent = `[${index}] ${name}` + (cls ? ` (${cls})` : '');
                row.appendChild(text);

                schema.forEach((field: any) => {
                    if (!field || !field.name) return;
                    const cell = document.createElement('label');
                    cell.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:10px;color:#8c9eff;flex-shrink:0;';
                    const caption = document.createElement('span');
                    caption.textContent = field.name;
                    cell.appendChild(caption);

                    const current = recordData[id]?.[field.name] ?? field.defaultValue;

                    const write = (raw: any) => {
                        const next = { ...recordData };
                        next[id] = { ...(next[id] || {}), [field.name]: raw };
                        commitRecordData(next);
                    };

                    if (field.type === 'boolean') {
                        const box = document.createElement('input');
                        box.type = 'checkbox';
                        box.checked = current === true || String(current).toLowerCase() === 'true';
                        box.style.cssText = 'cursor:pointer;margin:0;';
                        box.onchange = () => write(box.checked);
                        cell.appendChild(box);
                    } else {
                        const input = document.createElement('input');
                        input.type = field.type === 'number' ? 'number' : 'text';
                        input.value = current === undefined || current === null ? '' : String(current);
                        input.style.cssText = 'width:56px;background:#2a2a3e;color:#e0e0e0;border:1px solid #444;border-radius:3px;padding:2px 4px;font-size:10px;';
                        input.onchange = () => {
                            write(field.type === 'number' ? (isNaN(Number(input.value)) ? 0 : Number(input.value)) : input.value);
                        };
                        cell.appendChild(input);
                    }

                    row.appendChild(cell);
                });

                const del = document.createElement('button');
                del.textContent = '✕';
                del.title = 'Entfernen';
                del.style.cssText = 'margin-left:8px;background:transparent;border:none;color:#ff5252;cursor:pointer;font-size:12px;';
                del.onclick = () => {
                    const newItems = [...items];
                    newItems.splice(index, 1);
                    if (context.eventHandler) {
                        context.eventHandler.handleControlChange(propDef.name, newItems, obj, propDef);
                    } else {
                        PropertyHelper.setPropertyValue(obj, propDef.name, newItems);
                    }
                    context.update(obj);
                };
                row.appendChild(del);
                list.appendChild(row);
            });
        }

        const btn = document.createElement('button');
        btn.textContent = 'Objekte wählen...';
        btn.style.cssText = 'width:100%;padding:6px 12px;border:none;border-radius:4px;cursor:pointer;color:#fff;font-size:11px;background:#4caf50;';
        btn.onclick = () => {
            if (context.actionHandler) {
                (context.actionHandler as any).handleAction({ action: 'openObjectListPicker' }, obj);
            }
        };

        container.appendChild(list);
        container.appendChild(btn);
        return container;
    }

    // ─── TObjectList: Record-Schema definieren (gilt für alle Zeilen) ───
    public static renderRecordSchema(propDef: any, obj: any, context: IInspectorContext): HTMLElement {
        const container = document.createElement('div');
        const rawValue = PropertyHelper.getPropertyValue(obj, propDef.name);
        const fields: any[] = Array.isArray(rawValue) ? [...rawValue] : [];
        container.style.display = 'block';

        const saveFields = (next: any[]) => {
            if (context.eventHandler) {
                context.eventHandler.handleControlChange(propDef.name, next, obj, propDef);
            } else {
                PropertyHelper.setPropertyValue(obj, propDef.name, next);
            }
            if (typeof (obj as any).rebuildData === 'function') {
                (obj as any).rebuildData(projectObjectRegistry.getObjects());
            }
            context.update(obj);
            if (context.onProjectUpdate) context.onProjectUpdate();
        };

        const list = document.createElement('div');
        list.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:6px;';

        if (fields.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'Noch keine Record-Felder definiert.';
            empty.style.cssText = 'font-size:11px;color:#8c9eff;padding:4px 0;';
            list.appendChild(empty);
        }

        fields.forEach((field: any, index: number) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:4px;background:rgba(255,255,255,0.05);';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = String(field.name ?? '');
            nameInput.placeholder = 'Feldname';
            nameInput.style.cssText = 'flex:1;min-width:60px;background:#2a2a3e;color:#e0e0e0;border:1px solid #444;border-radius:3px;padding:3px 5px;font-size:11px;';
            nameInput.onchange = () => {
                const next = fields.map((f, i) => i === index ? { ...f, name: nameInput.value.trim() } : f);
                saveFields(next);
            };

            const typeSelect = document.createElement('select');
            typeSelect.style.cssText = 'background:#2a2a3e;color:#e0e0e0;border:1px solid #444;border-radius:3px;padding:3px;font-size:11px;';
            [['boolean', 'Ja/Nein'], ['number', 'Zahl'], ['string', 'Text']].forEach(([value, label]) => {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = label;
                if ((field.type || 'boolean') === value) opt.selected = true;
                typeSelect.appendChild(opt);
            });
            typeSelect.onchange = () => {
                const newType = typeSelect.value;
                const newDefault = newType === 'boolean' ? false : newType === 'number' ? 0 : '';
                saveFields(fields.map((f, i) => i === index ? { ...f, type: newType, defaultValue: newDefault } : f));
            };

            const defaultLabel = document.createElement('span');
            defaultLabel.textContent = 'Default';
            defaultLabel.style.cssText = 'font-size:10px;color:#8c9eff;flex-shrink:0;';

            let defaultControl: HTMLElement;
            if ((field.type || 'boolean') === 'boolean') {
                const box = document.createElement('input');
                box.type = 'checkbox';
                box.checked = field.defaultValue === true;
                box.style.cssText = 'cursor:pointer;margin:0;';
                box.onchange = () => saveFields(fields.map((f, i) => i === index ? { ...f, defaultValue: box.checked } : f));
                defaultControl = box;
            } else {
                const input = document.createElement('input');
                input.type = field.type === 'number' ? 'number' : 'text';
                input.value = field.defaultValue === undefined || field.defaultValue === null ? '' : String(field.defaultValue);
                input.style.cssText = 'width:56px;background:#2a2a3e;color:#e0e0e0;border:1px solid #444;border-radius:3px;padding:3px 5px;font-size:11px;';
                input.onchange = () => {
                    const parsed = field.type === 'number' ? (isNaN(Number(input.value)) ? 0 : Number(input.value)) : input.value;
                    saveFields(fields.map((f, i) => i === index ? { ...f, defaultValue: parsed } : f));
                };
                defaultControl = input;
            }

            const resetBtn = document.createElement('button');
            resetBtn.textContent = '⟲';
            resetBtn.title = 'Dieses Feld in allen Zeilen auf den Default zurücksetzen';
            resetBtn.style.cssText = 'background:transparent;border:none;color:#4da6ff;cursor:pointer;font-size:13px;';
            resetBtn.onclick = () => {
                const fieldName = String(field.name ?? '');
                if (!fieldName) return;
                const itemIds: string[] = Array.isArray((obj as any).items) ? (obj as any).items : [];
                const current = ((obj as any).recordData && typeof (obj as any).recordData === 'object') ? (obj as any).recordData : {};
                const next: Record<string, any> = { ...current };
                itemIds.forEach((id: string) => {
                    next[id] = { ...(next[id] || {}), [fieldName]: field.defaultValue };
                });
                if (context.eventHandler) {
                    context.eventHandler.handleControlChange('recordData', next, obj, { name: 'recordData', label: 'Record-Werte', type: 'json' });
                } else {
                    PropertyHelper.setPropertyValue(obj, 'recordData', next);
                }
                if (typeof (obj as any).rebuildData === 'function') {
                    (obj as any).rebuildData(projectObjectRegistry.getObjects());
                }
                context.update(obj);
                if (context.onProjectUpdate) context.onProjectUpdate();
            };

            const del = document.createElement('button');
            del.textContent = '✕';
            del.title = 'Feld entfernen';
            del.style.cssText = 'background:transparent;border:none;color:#ff5252;cursor:pointer;font-size:12px;';
            del.onclick = () => saveFields(fields.filter((_, i) => i !== index));

            row.appendChild(nameInput);
            row.appendChild(typeSelect);
            row.appendChild(defaultLabel);
            row.appendChild(defaultControl);
            row.appendChild(resetBtn);
            row.appendChild(del);
            list.appendChild(row);
        });

        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Feld hinzufügen';
        addBtn.style.cssText = 'width:100%;padding:6px 12px;border:none;border-radius:4px;cursor:pointer;color:#fff;font-size:11px;background:#4caf50;';
        addBtn.onclick = () => {
            saveFields([...fields, { name: `feld${fields.length + 1}`, type: 'boolean', defaultValue: false }]);
        };

        container.appendChild(list);
        container.appendChild(addBtn);
        return container;
    }
}
