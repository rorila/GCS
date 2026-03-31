import { IRenderContext } from './IRenderContext';

export class InputRenderer {
    
    public static renderCheckbox(ctx: IRenderContext, el: HTMLElement, obj: any, isNew: boolean): void {
        if (isNew) {
            el.innerHTML = '';
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '8px';
            label.style.width = '100%';
            label.style.height = '100%';
            label.style.cursor = 'inherit';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.style.cursor = 'pointer';

            const textSpan = document.createElement('span');
            textSpan.className = 'checkbox-label';

            label.appendChild(input);
            label.appendChild(textSpan);
            el.appendChild(label);
        }

        const input = el.querySelector('input') as HTMLInputElement;
        const textSpan = el.querySelector('.checkbox-label') as HTMLElement;

        if (input) {
            if (ctx.host.runMode) {
                input.onchange = () => {
                    obj.checked = input.checked;
                };
            }
            input.checked = !!obj.checked;
        }
        if (textSpan) {
            textSpan.innerText = obj.label || obj.name;
            textSpan.style.color = obj.style?.color || '#000000';
            textSpan.style.fontSize = obj.style?.fontSize ? ctx.scaleFontSize(obj.style.fontSize) : ctx.scaleFontSize(14);
            const fw = obj.style?.fontWeight;
            textSpan.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';
            const fs = obj.style?.fontStyle;
            textSpan.style.fontStyle = (fs === true || fs === 'italic') ? 'italic' : 'normal';
            if (obj.style?.fontFamily) textSpan.style.fontFamily = obj.style.fontFamily;
        }
    }

    public static renderNumberInput(ctx: IRenderContext, el: HTMLElement, obj: any, isNew: boolean): void {
        if (isNew) {
            el.innerHTML = '';
            const input = document.createElement('input');
            input.type = 'number';
            input.style.width = '100%';
            input.style.height = '100%';
            input.style.border = 'none';
            input.style.background = 'transparent';
            input.style.padding = '0 8px';
            input.style.fontSize = 'inherit';
            input.style.outline = 'none';
            input.style.boxSizing = 'border-box';
            el.appendChild(input);
        }
        const input = el.querySelector('input') as HTMLInputElement;
        if (input) {
            if (ctx.host.runMode) {
                input.oninput = () => {
                    obj.value = parseFloat(input.value);
                };
            }

            if (parseFloat(input.value) !== obj.value) input.value = String(obj.value || 0);
            if (obj.min !== undefined && obj.min !== -Infinity) input.min = String(obj.min);
            if (obj.max !== undefined && obj.max !== Infinity) input.max = String(obj.max);
            if (obj.step !== undefined) input.step = String(obj.step);

            input.style.color = obj.style?.color || '#000000';
            input.style.backgroundColor = obj.style?.backgroundColor || 'transparent';
            input.style.fontSize = obj.style?.fontSize ? ctx.scaleFontSize(obj.style.fontSize) : 'inherit';
            input.style.textAlign = obj.style?.textAlign || 'left';
            const fw = obj.style?.fontWeight;
            input.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';
            const fs = obj.style?.fontStyle;
            input.style.fontStyle = (fs === true || fs === 'italic') ? 'italic' : 'normal';
            if (obj.style?.fontFamily) input.style.fontFamily = obj.style.fontFamily;
        }
    }

    public static renderTextInput(ctx: IRenderContext, el: HTMLElement, obj: any, isNew: boolean): void {
        const isInput = !ctx.host.runMode || obj.className === 'TTextInput' || obj.className === 'TEdit';
        if (isInput) {
            if (isNew) {
                el.innerHTML = '';
                const input = document.createElement('input');
                input.type = 'text';
                input.style.width = '100%';
                input.style.height = '100%';
                input.style.border = 'none';
                input.style.background = 'transparent';
                input.style.padding = '0 8px';
                input.style.fontSize = 'inherit';
                input.style.outline = 'none';
                input.style.boxSizing = 'border-box';
                el.appendChild(input);
            }
            const input = el.querySelector('input') as HTMLInputElement;
            if (input) {
                if (ctx.host.runMode) {
                    input.oninput = () => {
                        let val = input.value;
                        if (obj.uppercase) val = val.toUpperCase();
                        obj.text = val;
                        input.value = val;
                    };
                }
                if (input.value !== (obj.text || '')) input.value = obj.text || '';
                input.placeholder = obj.placeholder || '';
                input.style.color = obj.style?.color || '#000000';
                input.style.backgroundColor = obj.style?.backgroundColor || 'transparent';
                input.style.textAlign = obj.style?.textAlign || 'left';
                input.style.fontSize = obj.style?.fontSize ? ctx.scaleFontSize(obj.style.fontSize) : 'inherit';
                const fw = obj.style?.fontWeight;
                input.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';
                const fs = obj.style?.fontStyle;
                input.style.fontStyle = (fs === true || fs === 'italic') ? 'italic' : 'normal';
                if (obj.style?.fontFamily) input.style.fontFamily = obj.style.fontFamily;
            }
        } else {
            el.innerText = obj.text || obj.placeholder || 'Enter text...';
        }
    }

    public static renderColorPicker(ctx: IRenderContext, el: HTMLElement, obj: any, isNew: boolean): void {
        if (isNew) {
            el.innerHTML = '';
            const input = document.createElement('input');
            input.type = 'color';
            input.style.width = '100%';
            input.style.height = '100%';
            input.style.border = 'none';
            input.style.padding = '0';
            input.style.margin = '0';
            input.style.cursor = 'pointer';
            input.style.opacity = '0'; 
            input.style.position = 'absolute';
            input.style.top = '0';
            input.style.left = '0';
            input.className = 'color-picker-input';
            el.appendChild(input);
        }
        
        const input = el.querySelector('.color-picker-input') as HTMLInputElement;
        if (input) {
            let validHex = obj.color || '#000000';
            if (!validHex.startsWith('#')) validHex = '#000000';
            if (validHex.length === 4) {
                validHex = '#' + validHex[1]+validHex[1] + validHex[2]+validHex[2] + validHex[3]+validHex[3];
            } else if (validHex.length > 7) {
                validHex = validHex.substring(0, 7);
            }
            
            if (input.value !== validHex) {
                input.value = validHex;
            }

            if (ctx.host.runMode) {
                input.oninput = (e) => {
                    e.stopPropagation();
                    const newColor = input.value;
                    obj.color = newColor;
                    
                    obj.style = obj.style || {};
                    obj.style.backgroundColor = newColor;
                    el.style.backgroundColor = newColor;

                    if (ctx.host.onEvent) {
                        ctx.host.onEvent(obj.id, 'onChange', newColor);
                        ctx.host.onEvent(obj.id, 'propertyChange', { property: 'color', value: newColor });
                    }
                };
            }
        }
    }

    public static renderDropdown(ctx: IRenderContext, el: HTMLElement, obj: any, isNew: boolean): void {
        if (isNew) {
            el.innerHTML = '';
            const select = document.createElement('select');
            select.style.width = '100%';
            select.style.height = '100%';
            select.style.border = 'none';
            select.style.background = 'transparent';
            select.style.outline = 'none';
            select.style.cursor = 'pointer';
            el.appendChild(select);
        }

        const select = el.querySelector('select') as HTMLSelectElement;
        if (select) {
            const currentOptionsHtml = select.innerHTML;
            
            let optionsList: string[] = [];
            if (Array.isArray(obj.options)) {
                optionsList = obj.options;
            } else if (typeof obj.options === 'string') {
                optionsList = obj.options.split(',').map((s: string) => s.trim());
            } else {
                optionsList = ['Option 1', 'Option 2', 'Option 3'];
            }

            let expectedHtml = '';
            optionsList.forEach((opt, idx) => {
                expectedHtml += `<option value="${idx}">${opt}</option>`;
            });

            if (currentOptionsHtml !== expectedHtml) {
                select.innerHTML = expectedHtml;
            }

            const targetIndex = (obj.selectedIndex !== undefined && obj.selectedIndex >= 0 && obj.selectedIndex < optionsList.length) 
                                ? obj.selectedIndex : 0;
            if (select.selectedIndex !== targetIndex) {
                select.selectedIndex = targetIndex;
            }

            if (ctx.host.runMode) {
                select.onchange = (e) => {
                    e.stopPropagation();
                    const newIndex = select.selectedIndex;
                    const newValue = optionsList[newIndex];
                    
                    obj.selectedIndex = newIndex;
                    obj.selectedValue = newValue;

                    if (ctx.host.onEvent) {
                        ctx.host.onEvent(obj.id, 'onChange', newValue);
                        ctx.host.onEvent(obj.id, 'propertyChange', { property: 'selectedIndex', value: newIndex });
                        ctx.host.onEvent(obj.id, 'propertyChange', { property: 'selectedValue', value: newValue });
                    }
                };
            }

            select.style.color = obj.style?.color || '#000000';
            select.style.backgroundColor = obj.style?.backgroundColor || 'transparent';
            select.style.fontSize = obj.style?.fontSize ? ctx.scaleFontSize(obj.style.fontSize) : 'inherit';
            select.style.fontFamily = obj.style?.fontFamily || 'inherit';
            select.style.fontWeight = (obj.style?.fontWeight === true || obj.style?.fontWeight === 'bold') ? 'bold' : 'normal';
        }
    }
}
