import { IInspectorContext } from './IInspectorContext';

export class InspectorHeaderRenderer {
    public static renderHeader(obj: any, context: IInspectorContext): HTMLElement {
        const header = document.createElement('div');
        header.style.padding = '10px';
        header.style.backgroundColor = '#333';
        header.style.borderBottom = '1px solid #444';
        header.style.fontWeight = 'bold';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        const selectContainer = document.createElement('div');
        selectContainer.style.display = 'flex';
        selectContainer.style.alignItems = 'center';
        selectContainer.style.gap = '8px';
        selectContainer.style.flex = '1';

        const type = document.createElement('span');
        type.style.color = '#888';
        type.style.fontSize = '10px';
        type.innerText = obj.className || obj.constructor?.name || 'Object';
        
        const select = document.createElement('select');
        select.style.cssText = 'flex: 1; min-width: 0; padding: 4px; background: #222; color: #fff; border: 1px solid #555; border-radius: 4px; font-size: 13px; font-weight: bold; cursor: pointer;';
        
        // Rekursives Flattening: Kinder von TGroupPanel muessen ebenfalls
        // in der Komponentenliste erscheinen.
        const flattenWithChildren = (objects: any[]): any[] => {
            const result: any[] = [];
            for (const obj of objects) {
                result.push(obj);
                if (obj.children && Array.isArray(obj.children) && obj.children.length > 0) {
                    result.push(...flattenWithChildren(obj.children));
                }
            }
            return result;
        };

        let allObjects: any[] = [];
        const activeStage = context.project.stages?.find(s => s.id === context.project.activeStageId);
        if (activeStage) {
            allObjects = flattenWithChildren([...(activeStage.objects || []), ...(activeStage.variables || [])]);
        }
        const blueprintStage = context.project.stages?.find(s => s.type === 'blueprint');
        if (blueprintStage && activeStage?.type !== 'blueprint') {
             allObjects = [...allObjects, ...flattenWithChildren([...(blueprintStage.objects || []), ...(blueprintStage.variables || [])])];
        }

        const uniqueObjects = Array.from(new Map(allObjects.map(o => [o.id, o])).values());
        
        uniqueObjects.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.id;
            opt.textContent = o.name || o.id || 'Unbenannt';
            
            if (o.parentId) {
                opt.textContent += ' (Child)';
            } else if (activeStage && !activeStage.objects?.find(ao => ao.id === o.id) && !activeStage.variables?.find(av => av.id === o.id)) {
                opt.textContent += ' (Global)';
            }
            if (o.id === obj.id) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });

        select.onchange = () => {
            const selectedId = select.value;
            if (selectedId && context.onObjectSelect) {
                context.onObjectSelect(selectedId);
            }
        };

        const isFlowNode = obj.isFlowNode || obj.constructor?.name === 'FlowAction' || obj.constructor?.name === 'FlowTask';
        const objInList = uniqueObjects.find(o => o.id === obj.id);

        if (objInList && !isFlowNode) {
            selectContainer.appendChild(select);
        } else {
            const label = document.createElement('span');
            label.style.cssText = 'flex: 1; min-width: 0; padding: 4px; color: #fff; font-size: 13px; font-weight: bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            label.textContent = obj.name || obj.id || obj.className || 'Unbenannt';
            selectContainer.appendChild(label);
        }

        selectContainer.appendChild(type);
        header.appendChild(selectContainer);

        // Papierkorb-Icon zum Löschen
        if (context.onObjectDelete) {
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '🗑️';
            delBtn.title = 'Löschen';
            delBtn.style.cssText = 'background:none; border:none; color:#ff5252; cursor:pointer; font-size:14px; padding:0 5px;';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                context.onObjectDelete!(obj);
            };
            header.appendChild(delBtn);
        }

        return header;
    }
}
