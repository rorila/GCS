import { Logger } from '../utils/Logger';

const logger = Logger.get('DialogComponentFactory');

export interface DialogComponentContext {
    dialogData: any;
    evaluateExpression: (expr: any) => any;
    handleAction: (action: string, actionData?: any) => void;
    updateModelValue: (name: string, value: any) => void;
    renderObject: (obj: any) => HTMLElement | null;
}

/**
 * DialogComponentFactory - Handles the creation of individual UI components 
 * for JSON-based dialogs.
 */
export class DialogComponentFactory {

    public static createComponent(obj: any, ctx: DialogComponentContext): HTMLElement | null {
        try {
            const className = obj.className;
            const el = document.createElement('div');
            el.className = `dialog-object ${className}`;
            el.style.marginBottom = '8px';

            if (obj.scrollKey) {
                el.setAttribute('data-scroll-key', obj.scrollKey);
            }

            // Apply styles
            if (obj.style) {
                Object.entries(obj.style).forEach(([key, value]) => {
                    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                    const evaluatedValue = ctx.evaluateExpression(value);
                    el.style.setProperty(cssKey, String(evaluatedValue));
                });
            }

            switch (className) {
                case 'TLabel':
                    el.innerText = ctx.evaluateExpression(obj.text || '');
                    break;

                case 'TEdit':
                case 'TMemo': {
                    const isMemo = className === 'TMemo';
                    const input = document.createElement(isMemo ? 'textarea' : 'input');
                    if (!isMemo) (input as HTMLInputElement).type = 'text';

                    const currentVal = ctx.dialogData._formValues?.[obj.name];
                    input.value = currentVal !== undefined ? currentVal : ctx.evaluateExpression(obj.text || '');
                    input.placeholder = obj.placeholder || '';
                    if (obj.name) input.setAttribute('data-name', obj.name);

                    input.style.cssText = `
                        width: 100%;
                        padding: 6px;
                        background: #333;
                        color: white;
                        border: 1px solid #555;
                        border-radius: 3px;
                        box-sizing: border-box;
                        min-height: ${isMemo ? (obj.rowSpan ? obj.rowSpan * 24 : 60) : 'auto'}px;
                    `;

                    input.oninput = () => {
                        if (obj.name) ctx.updateModelValue(obj.name, input.value);
                    };

                    input.onchange = () => {
                        if (obj.action) ctx.handleAction(obj.action, obj.actionData);
                    };

                    el.appendChild(input);
                    break;
                }

                case 'TDropdown': {
                    const select = document.createElement('select');
                    if (obj.name) select.setAttribute('data-name', obj.name);

                    const optionsArr = ctx.evaluateExpression(obj.options || []);
                    const currentSelection = ctx.dialogData._formValues?.[obj.name];
                    const selectedValue = currentSelection !== undefined ? currentSelection : ctx.evaluateExpression(obj.selectedValue);
                    let selectedIndex = currentSelection !== undefined ? undefined : ctx.evaluateExpression(obj.selectedIndex);

                    if (selectedIndex !== undefined && typeof selectedIndex !== 'number') {
                        selectedIndex = parseInt(selectedIndex as any);
                    }

                    const hasValidSelection = (selectedValue !== undefined && selectedValue !== '') || (selectedIndex !== undefined && !isNaN(selectedIndex));

                    if (!hasValidSelection) {
                        const placeholder = document.createElement('option');
                        placeholder.value = '';
                        placeholder.text = '--- bitte wählen ---';
                        placeholder.disabled = true;
                        placeholder.selected = true;
                        select.appendChild(placeholder);
                    }

                    optionsArr.forEach((opt: any, idx: number) => {
                        const option = document.createElement('option');
                        const optVal = (typeof opt === 'object' && opt !== null) ? opt.value : opt;
                        const optLabel = (typeof opt === 'object' && opt !== null) ? (opt.label || opt.name || opt.value) : opt;

                        option.value = optVal;
                        option.text = optLabel;

                        const sVal = selectedValue !== undefined && selectedValue !== null ? String(selectedValue).trim() : undefined;
                        const oVal = optVal !== undefined && optVal !== null ? String(optVal).trim() : undefined;

                        if ((sVal !== undefined && sVal !== '' && sVal === oVal) || selectedIndex === idx) {
                            option.selected = true;
                        }

                        select.appendChild(option);
                    });

                    select.style.cssText = `
                        width: 100%;
                        padding: 6px;
                        background: #333;
                        color: white;
                        border: 1px solid #555;
                        border-radius: 3px;
                        cursor: pointer;
                    `;

                    select.onchange = () => {
                        if (obj.name) ctx.updateModelValue(obj.name, select.value);
                        if (obj.action) ctx.handleAction(obj.action, obj.actionData);
                    };
                    el.appendChild(select);
                    break;
                }

                case 'TCheckbox': {
                    const label = document.createElement('label');
                    label.style.cssText = 'display: flex; align-items: center; cursor: pointer;';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';

                    const currentVal = obj.name ? ctx.dialogData._formValues?.[obj.name] : undefined;
                    checkbox.checked = currentVal !== undefined ? currentVal : ctx.evaluateExpression(obj.checked || false);
                    checkbox.style.marginRight = '8px';
                    if (obj.name) checkbox.setAttribute('data-name', obj.name);

                    checkbox.onchange = () => {
                        if (obj.name) ctx.updateModelValue(obj.name, checkbox.checked);
                        if (obj.action) ctx.handleAction(obj.action, obj.actionData);
                    };
                    label.appendChild(checkbox);

                    const text = document.createElement('span');
                    text.innerText = ctx.evaluateExpression(obj.label || '');
                    text.style.color = 'white';
                    label.appendChild(text);

                    el.appendChild(label);
                    break;
                }

                case 'TButton': {
                    const button = document.createElement('button');
                    button.id = `btn-${obj.name || 'unknown'}`;
                    button.innerText = ctx.evaluateExpression(obj.caption || obj.name);

                    button.style.cssText = `
                        padding: 8px 16px;
                        background: ${obj.style?.backgroundColor || '#0e639c'};
                        color: ${obj.style?.color || 'white'};
                        border: none;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 12px;
                    `;

                    el.style.backgroundColor = 'transparent';

                    button.onclick = (e) => {
                        e.stopPropagation();
                        if (obj.action) ctx.handleAction(obj.action, obj.actionData);
                    };
                    el.appendChild(button);
                    break;
                }

                case 'TPanel':
                    if (obj.children && Array.isArray(obj.children)) {
                        obj.children.forEach((child: any) => {
                            const childEl = ctx.renderObject(child);
                            if (childEl) el.appendChild(childEl);
                        });
                    }

                    if (obj.action) {
                        el.style.cursor = 'pointer';
                        el.onclick = () => ctx.handleAction(obj.action, obj.actionData);
                    }

                    if (obj.doubleClickAction) {
                        el.ondblclick = () => ctx.handleAction(obj.doubleClickAction, obj.doubleClickActionData || obj.actionData);
                    }
                    break;

                case 'TImage': {
                    const img = document.createElement('img');
                    const src = ctx.evaluateExpression(obj.src || '');
                    if (src) {
                        img.src = src.startsWith('http') || src.startsWith('/') || src.startsWith('data:')
                            ? src
                            : `/images/${src}`;
                    }
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = obj.objectFit || 'contain';
                    img.style.display = src ? 'block' : 'none';
                    el.appendChild(img);
                    break;
                }

                default:
                    el.innerText = `[${className}] ${obj.name}`;
                    el.style.color = '#666';
            }

            return el;
        } catch (e: any) {
            logger.error('Error rendering object:', obj, e);
            const errEl = document.createElement('div');
            errEl.style.color = 'red';
            errEl.innerText = `Error rendering ${obj.className || 'object'}: ${e.message}`;
            return errEl;
        }
    }
}
