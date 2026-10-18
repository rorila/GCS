import { IInspectorContext } from './IInspectorContext';
import { PropertyHelper } from '../../../runtime/PropertyHelper';
import { MediaPickerDialog } from '../MediaPickerDialog';
import { SectionRendererHelpers } from './SectionRendererHelpers';

export class ListValueEditor {
    // ─── TListVariable: Werte-Array editieren (Index + Input + Löschen) ───
    public static renderValueList(propDef: any, obj: any, context: IInspectorContext): HTMLElement {
        const container = document.createElement('div');
        const rawValue = PropertyHelper.getPropertyValue(obj, propDef.name);
        let items = Array.isArray(rawValue) ? [...rawValue] : [];
        container.style.display = 'block';

        const list = document.createElement('div');
        list.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:6px;';

        const parseInput = (text: string, original: any): any => {
            if (typeof original === 'number') return isNaN(Number(text)) ? 0 : Number(text);
            if (typeof original === 'boolean') return text.trim().toLowerCase() === 'true';
            if (typeof original === 'object' && original !== null) {
                try { return JSON.parse(text); } catch { return original; }
            }
            return text;
        };

        const saveItems = () => {
            if (context.eventHandler) {
                context.eventHandler.handleControlChange(propDef.name, [...items], obj, propDef);
            } else {
                PropertyHelper.setPropertyValue(obj, propDef.name, [...items]);
            }
            context.update(obj);
            if (context.onProjectUpdate) context.onProjectUpdate();
        };

        const renderItems = () => {
            list.innerHTML = '';
            if (items.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'Noch keine Werte.';
                empty.style.cssText = 'font-size:11px;color:#8c9eff;padding:4px 0;';
                list.appendChild(empty);
                return;
            }
            items.forEach((value: any, index: number) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:4px;background:rgba(255,255,255,0.05);font-size:11px;color:#e0e0e0;';

                const indexLabel = document.createElement('span');
                indexLabel.style.cssText = 'min-width:28px;color:#8c9eff;font-weight:bold;';
                indexLabel.textContent = `[${index}]`;

                const input = document.createElement('input');
                input.type = 'text';
                input.value = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
                input.style.cssText = 'flex:1;background:#2a2a3e;color:#e0e0e0;border:1px solid #444;border-radius:3px;padding:4px;font-size:11px;';
                const isImageLike = (v: string) => /^(\.\/images|images|https?:\/\/|data:image)/i.test(v.trim());
                const previewImg = document.createElement('img');
                previewImg.style.cssText = 'width:24px;height:24px;border-radius:3px;object-fit:cover;flex-shrink:0;display:none;';
                if (isImageLike(input.value)) {
                    previewImg.src = input.value;
                    previewImg.style.display = 'inline';
                }
                previewImg.onerror = () => { previewImg.style.display = 'none'; };
                input.onchange = () => {
                    items[index] = parseInput(input.value, items[index]);
                    if (isImageLike(input.value)) {
                        previewImg.src = input.value;
                        previewImg.style.display = 'inline';
                    } else {
                        previewImg.style.display = 'none';
                    }
                    saveItems();
                };

                const pickVarBtn = document.createElement('button');
                pickVarBtn.textContent = 'V';
                pickVarBtn.title = 'Variable / Eigenschaft einfügen';
                pickVarBtn.style.cssText = 'margin-left:4px;padding:4px;background:#e67e22;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;width:24px;font-weight:bold;flex-shrink:0;';
                pickVarBtn.onclick = async () => {
                    const { VariablePickerDialog } = await import('../VariablePickerDialog');
                    const chosen = await VariablePickerDialog.show(undefined, 'all');
                    if (chosen !== null) {
                        const resolved = SectionRendererHelpers.resolveListValue(chosen);
                        const safe = resolved !== undefined ? resolved : chosen;
                        input.value = typeof safe === 'object' && safe !== null ? JSON.stringify(safe) : String(safe ?? '');
                        items[index] = safe;
                        saveItems();
                    }
                };

                const pickImgBtn = document.createElement('button');
                pickImgBtn.textContent = '🖼️';
                pickImgBtn.title = 'Bild auswählen';
                pickImgBtn.style.cssText = 'margin-left:4px;padding:4px;background:#2a2a3e;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;width:24px;flex-shrink:0;';
                pickImgBtn.onclick = async () => {
                    const picked = await MediaPickerDialog.show({ mode: 'image', currentValue: input.value });
                    if (picked !== null) {
                        input.value = picked;
                        items[index] = picked;
                        previewImg.src = picked;
                        previewImg.style.display = 'inline';
                        saveItems();
                    }
                };

                const del = document.createElement('button');
                del.textContent = '✕';
                del.title = 'Entfernen';
                del.style.cssText = 'margin-left:4px;background:transparent;border:none;color:#ff5252;cursor:pointer;font-size:12px;';
                del.onclick = () => {
                    items.splice(index, 1);
                    saveItems();
                    renderItems();
                };

                row.appendChild(indexLabel);
                row.appendChild(input);
                row.appendChild(previewImg);
                row.appendChild(pickVarBtn);
                row.appendChild(pickImgBtn);
                row.appendChild(del);
                list.appendChild(row);
            });
        };

        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Wert hinzufügen';
        addBtn.style.cssText = 'width:100%;padding:6px 12px;border:none;border-radius:4px;cursor:pointer;color:#fff;font-size:11px;background:#4caf50;margin-bottom:6px;';
        addBtn.onclick = () => {
            items.push('');
            saveItems();
            renderItems();
        };

        container.appendChild(addBtn);
        container.appendChild(list);
        renderItems();
        return container;
    }
}
