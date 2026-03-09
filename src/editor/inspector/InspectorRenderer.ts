import { projectRegistry } from '../../services/ProjectRegistry';
import { serviceRegistry } from '../../services/ServiceRegistry';
import { actionRegistry } from '../../runtime/ActionRegistry';
import { MethodRegistry } from '../MethodRegistry';
import { PropertyHelper } from '../../runtime/PropertyHelper';

/**
 * InspectorRenderer - Handles the visual generation of Inspector UI components.
 * This class captures the "View" part of the Inspector.
 */
export class InspectorRenderer {
    constructor() { }

    /**
     * Renders a basic Label element
     */
    public renderLabel(text: string, style?: any): HTMLElement {
        const el = document.createElement('div');
        el.className = 'inspector-label';
        el.innerText = text;

        // Base styles
        el.style.fontSize = '11px';
        el.style.color = '#ccc';
        el.style.marginBottom = '4px';

        // Apply custom style
        if (style) {
            if (typeof style === 'object') {
                if (style.fontSize) el.style.fontSize = typeof style.fontSize === 'number' ? `${style.fontSize}px` : style.fontSize;
                if (style.color) el.style.color = style.color;
                this.applyStyle(el, style);
            } else {
                this.applyStyle(el, style);
            }
        }
        return el;
    }

    /**
     * Renders a horizontal separator
     */
    public renderSeparator(): HTMLElement {
        const el = document.createElement('div');
        el.style.height = '1px';
        el.style.backgroundColor = '#444';
        el.style.margin = '12px 0 8px 0';
        return el;
    }

    /**
     * Renders a TEdit-like input field
     */
    public renderEdit(value: string, placeholder: string = ''): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value || '';
        input.placeholder = placeholder;
        input.className = 'inspector-input';

        // Base styling (could be moved to a CSS file)
        this.applyStyle(input, {
            width: '100%',
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '3px',
            padding: '4px 6px',
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box'
        });

        return input;
    }

    /**
     * Renders a TSelect-like dropdown
     */
    public renderSelect(options: any[], selectedValue: string, placeholder?: string): HTMLSelectElement {
        const select = document.createElement('select');
        select.className = 'inspector-select';

        this.applyStyle(select, {
            width: '100%',
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '3px',
            padding: '4px 2px',
            fontSize: '12px',
            outline: 'none',
            cursor: 'pointer'
        });

        if (placeholder) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.text = placeholder;
            opt.disabled = true;
            if (!selectedValue) opt.selected = true;
            select.appendChild(opt);
        }

        options.forEach(opt => {
            const option = document.createElement('option');
            let val: string;
            let text: string;

            if (typeof opt === 'string') {
                val = opt;
                text = opt;
            } else {
                val = opt.value;
                text = opt.label || opt.text || opt.name || opt.value;
            }

            option.value = val;
            option.text = text;

            if (val === selectedValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        return select;
    }

    /**
     * Renders a TButton-like button
     */
    public renderButton(text: string, onClick: () => void, customStyle?: any): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.className = 'inspector-button';

        this.applyStyle(btn, {
            width: '100%',
            backgroundColor: '#444',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '3px',
            padding: '6px',
            fontSize: '11px',
            cursor: 'pointer',
            textAlign: 'center'
        });

        if (customStyle) {
            this.applyStyle(btn, customStyle);
        }

        btn.onmouseover = () => btn.style.opacity = '0.8';
        btn.onmouseout = () => btn.style.opacity = '1';
        btn.onclick = onClick;

        return btn;
    }

    /**
     * Renders a TNumberInput-like numeric input
     */
    public renderNumberInput(value: number, min?: number, max?: number, step?: number): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = String(value || 0);
        if (min !== undefined) input.min = String(min);
        if (max !== undefined) input.max = String(max);
        if (step !== undefined) input.step = String(step);
        input.className = 'inspector-number-input';

        // Base styling (could be moved to a CSS file)
        this.applyStyle(input, {
            width: '100%',
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '3px',
            padding: '4px 6px',
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box'
        });

        return input;
    }

    /**
     * Renders a TCheckbox-like checkbox
     */
    public renderCheckbox(checked: boolean, label: string): HTMLElement {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '8px';
        container.style.padding = '4px 0';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = checked;
        cb.style.cursor = 'pointer';

        const lbl = document.createElement('span');
        lbl.innerText = label;
        lbl.style.fontSize = '12px';
        lbl.style.color = '#ccc';

        container.appendChild(cb);
        container.appendChild(lbl);

        // Expose the checkbox for events
        (container as any).input = cb;
        return container;
    }

    /**
     * Renders a TPanel-like container
     */
    public renderPanel(style?: any): HTMLElement {
        const el = document.createElement('div');
        el.className = 'inspector-panel';
        if (style) {
            this.applyStyle(el, style);
        }
        return el;
    }

    /**
     * Renders a TChips component (list of tag chips)
     */
    public renderChips(value: string, onRemove: (chip: string) => void): HTMLElement {
        const container = document.createElement('div');
        container.className = 'inspector-chips-container';
        this.applyStyle(container, {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            padding: '4px',
            backgroundColor: '#222',
            border: '1px solid #444',
            borderRadius: '3px',
            minHeight: '26px'
        });

        const chips = (value || '').split(',').map(s => s.trim()).filter(s => s);

        chips.forEach(chip => {
            const el = document.createElement('div');
            el.className = 'inspector-chip';
            this.applyStyle(el, {
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                backgroundColor: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '12px',
                fontSize: '11px',
                whiteSpace: 'nowrap'
            });

            const text = document.createElement('span');
            text.innerText = chip;
            el.appendChild(text);

            const removeBtn = document.createElement('span');
            removeBtn.innerText = '×';
            this.applyStyle(removeBtn, {
                cursor: 'pointer',
                fontWeight: 'bold',
                color: '#f44336',
                marginLeft: '4px'
            });
            removeBtn.onclick = () => onRemove(chip);
            el.appendChild(removeBtn);

            container.appendChild(el);
        });

        return container;
    }

    /**
     * Renders dynamic action parameters based on action type metadata.
     */
    public renderActionParams(_obj: any, selectedObject: any, onUpdate: (prop: string, val: any) => void, onAction?: (actionDef: any) => void): HTMLElement | null {
        const type = selectedObject.actionType || selectedObject.type;
        const meta = actionRegistry.getMetadata(type);
        if (!meta) return null;

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '8px';
        container.style.marginTop = '4px';

        meta.parameters.forEach((param: any) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.gap = '2px';

            const label = this.renderLabel(param.label);
            row.appendChild(label);

            let input: HTMLElement | null = null;
            const currentValue = PropertyHelper.getPropertyValue(selectedObject, param.name) ?? (param.defaultValue || '');

            // --- SPECIAL: Dynamic Method Parameters for call_method ---
            if (type === 'call_method' && param.name === 'params') {
                const methodName = selectedObject.method;
                const signature = (MethodRegistry as any)[methodName] || [{ name: 'params', type: 'string', label: 'Parameter' }];

                const paramContainer = document.createElement('div');
                paramContainer.style.display = 'flex';
                paramContainer.style.flexDirection = 'column';
                paramContainer.style.gap = '6px';
                paramContainer.style.paddingLeft = '10px';
                paramContainer.style.borderLeft = '2px solid #444';
                paramContainer.style.marginTop = '4px';

                signature.forEach((sigParam: any, idx: number) => {
                    const sigRow = document.createElement('div');
                    sigRow.style.display = 'flex';
                    sigRow.style.flexDirection = 'column';
                    sigRow.style.gap = '2px';

                    const sigLabel = document.createElement('label');
                    sigLabel.innerText = `${sigParam.label || sigParam.name} (${sigParam.type})`;
                    sigLabel.style.fontSize = '10px';
                    sigLabel.style.color = '#888';
                    sigRow.appendChild(sigLabel);

                    const params = PropertyHelper.getPropertyValue(selectedObject, 'params') || [];
                    const currentParamValue = (Array.isArray(params) ? params[idx] : '') || '';

                    let sigInput: HTMLElement;
                    if (sigParam.type === 'select' || sigParam.type === 'stage' || sigParam.type === 'variable') {
                        const opts = this.getOptionsFromSource(sigParam);
                        const sel = this.renderSelect(opts, currentParamValue, '--- wählen ---');
                        sel.name = sigParam.name; // Technical name for E2E
                        sel.onchange = () => {
                            const p = Array.isArray(params) ? [...params] : [];
                            p[idx] = sel.value;
                            onUpdate('params', p);
                        };
                        sigInput = sel;
                    } else {
                        const ed = this.renderEdit(currentParamValue);
                        ed.onchange = () => {
                            const p = Array.isArray(params) ? [...params] : [];
                            p[idx] = ed.value;
                            if (sigParam.type === 'number') p[idx] = Number(ed.value);
                            onUpdate('params', p);
                        };
                        ed.style.flex = '1';

                        const cont = document.createElement('div');
                        cont.style.display = 'flex';
                        cont.style.gap = '4px';
                        cont.appendChild(ed);

                        if (onAction && sigParam.type !== 'number') {
                            const b = document.createElement('button');
                            b.innerText = 'V';
                            b.style.cssText = 'width: 32px; padding: 4px; background-color: #e67e22; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;';
                            b.onclick = () => {
                                onAction({
                                    action: 'pickVariable',
                                    actionData: { property: 'params', index: idx } // index is needed for array update
                                });
                            };
                            cont.appendChild(b);
                        }
                        sigInput = cont;
                    }
                    sigRow.appendChild(sigInput);
                    paramContainer.appendChild(sigRow);
                });
                input = paramContainer;
            } else {
                switch (param.type) {
                    case 'json': {
                        let displayValue = '';
                        if (typeof currentValue === 'object' && currentValue !== null) {
                            const keys = Object.keys(currentValue);
                            if (keys.length > 0) {
                                displayValue = keys.map(k => {
                                    const val = currentValue[k];
                                    if (typeof val === 'string') return `${k} := '${val}'`;
                                    return `${k} := ${val}`;
                                }).join(', ');
                            } else {
                                displayValue = '{}';
                            }
                        } else {
                            displayValue = String(currentValue || '');
                        }

                        const edit = this.renderEdit(displayValue, param.placeholder || '');
                        edit.onchange = () => {
                            let val: any = edit.value;
                            try {
                                if (val.trim().startsWith('{')) {
                                    val = JSON.parse(val);
                                } else if (val.includes(':=')) {
                                    const parts = val.split(',').map((p: string) => p.trim());
                                    const obj: any = {};
                                    parts.forEach((p: string) => {
                                        const [k, v] = p.split(':=').map((s: string) => s.trim());
                                        if (k && v !== undefined) {
                                            let cleanV = v;
                                            if (cleanV.startsWith("'") && cleanV.endsWith("'")) {
                                                cleanV = cleanV.slice(1, -1);
                                            } else if (cleanV.startsWith('"') && cleanV.endsWith('"')) {
                                                cleanV = cleanV.slice(1, -1);
                                            } else if (cleanV === 'true') cleanV = true as any;
                                            else if (cleanV === 'false') cleanV = false as any;
                                            else if (!isNaN(Number(cleanV)) && cleanV !== '') cleanV = Number(cleanV) as any;
                                            obj[k] = cleanV;
                                        }
                                    });
                                    val = obj;
                                }
                            } catch (e) {
                                console.warn('Failed to parse assigned JSON', e);
                            }
                            onUpdate(param.name, val);
                        };
                        edit.style.flex = '1';

                        const cont = document.createElement('div');
                        cont.style.display = 'flex';
                        cont.style.gap = '4px';
                        cont.style.width = '100%';
                        cont.appendChild(edit);

                        if (onAction) {
                            const b = document.createElement('button');
                            b.innerText = 'V';
                            b.style.cssText = 'width: 32px; padding: 4px; background-color: #e67e22; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;';
                            b.onclick = () => {
                                onAction({
                                    action: 'pickVariable',
                                    actionData: { property: param.name }
                                });
                            };
                            cont.appendChild(b);
                        }
                        input = cont;
                        break;
                    }
                    case 'object':
                    case 'variable':
                    case 'stage':
                    case 'select':
                    case 'method': {
                        const options = this.getOptionsFromSource(param);
                        const sel = this.renderSelect(options, currentValue, '--- wählen ---');
                        sel.name = param.name; // Technical name for E2E
                        sel.onchange = () => onUpdate(param.name, sel.value);
                        input = sel;
                        break;
                    }
                    default: {
                        let finalValue = currentValue;
                        if (typeof finalValue === 'object' && finalValue !== null) {
                            finalValue = JSON.stringify(finalValue);
                        }
                        const edit = this.renderEdit(finalValue, param.placeholder || '');
                        edit.name = param.name; // Technical name for E2E
                        edit.onchange = () => onUpdate(param.name, edit.value);
                        edit.style.flex = '1';

                        const cont = document.createElement('div');
                        cont.style.display = 'flex';
                        cont.style.gap = '4px';
                        cont.style.width = '100%';
                        cont.appendChild(edit);

                        if (onAction && param.type !== 'number' && param.type !== 'boolean') {
                            const b = document.createElement('button');
                            b.innerText = 'V';
                            b.style.cssText = 'width: 32px; padding: 4px; background-color: #e67e22; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;';
                            b.onclick = () => {
                                onAction({
                                    action: 'pickVariable',
                                    actionData: { property: param.name }
                                });
                            };
                            cont.appendChild(b);
                        }
                        input = cont;
                        break;
                    }
                }
            }

            if (input) row.appendChild(input);
            container.appendChild(row);
        });

        return container;
    }

    /**
     * Generates a UI object array from component property definitions.
     */
    public generateUIFromProperties(object: any, _isMerging: boolean = false): any[] {
        if (typeof object.getInspectorProperties !== 'function') return [];

        const properties = object.getInspectorProperties();
        const uiObjects: any[] = [];

        // Group properties by group
        const grouped: Map<string, any[]> = new Map();
        properties.forEach((prop: any) => {
            const group = prop.group || 'General';
            if (!grouped.has(group)) {
                grouped.set(group, []);
            }
            grouped.get(group)!.push(prop);
        });

        // Render each group
        grouped.forEach((groupProps, groupName) => {
            const groupChildren: any[] = [];

            // Group header
            groupChildren.push({
                className: 'TLabel',
                name: `${groupName}Header`,
                text: groupName.toUpperCase(),
                style: { fontSize: 11, fontWeight: 'bold', color: '#4da6ff', marginBottom: 12, borderBottom: '1px solid #4da6ff', paddingBottom: '4px' } // Enhanced header style
            });

            // Properties in group
            for (let i = 0; i < groupProps.length; i++) {
                const prop = groupProps[i];
                const labelStyle: any = { fontSize: 12, color: '#aaa' };

                // Start an inline group if this prop and next prop are inline
                if (prop.inline && groupProps[i + 1]?.inline) {
                    const inlineGroup: any[] = [];
                    const wrapper = {
                        className: 'TPanel',
                        name: `${prop.name}InlineWrapper`,
                        style: { display: 'flex', gap: '12px', marginBottom: '8px', padding: '0', alignItems: 'center' },
                        children: inlineGroup
                    };
                    groupChildren.push(wrapper);

                    // Collect up to 2 consecutive inline props
                    let inlineCount = 0;
                    while (i < groupProps.length && groupProps[i].inline && inlineCount < 2) {
                        const p = groupProps[i];
                        // For inline props, we still might want a small label if it's not a checkbox
                        if (p.type !== 'boolean' && p.label) {
                            inlineGroup.push({
                                className: 'TLabel',
                                name: `${p.name}Label`,
                                text: `${p.label}:`,
                                style: { ...labelStyle, marginBottom: 0 }
                            });
                        }

                        const inputName = `${p.name}Input`;
                        const binding = `\${selectedObject.${p.name}}`;
                        this.pushInputIntoUI(inlineGroup, p, inputName, binding);

                        inlineCount++;

                        // If we haven't reached 2 yet, check if the next one is inline
                        if (inlineCount < 2 && groupProps[i + 1]?.inline) {
                            i++;
                        } else {
                            break;
                        }
                    }
                    continue;
                }

                // Normal rendering (not inline group)
                if (prop.type !== 'boolean') {
                    groupChildren.push({
                        className: 'TLabel',
                        name: `${prop.name}Label`,
                        text: `${prop.label || prop.name}:`,
                        style: labelStyle,
                        readOnly: prop.readOnly
                    });
                }

                const inputName = `${prop.name}Input`;
                const binding = `\${selectedObject.${prop.name}}`;
                this.pushInputIntoUI(groupChildren, prop, inputName, binding);
            }

            // Wrap the group in a Card Panel
            uiObjects.push({
                className: 'TPanel',
                name: `${groupName}Card`,
                style: {
                    backgroundColor: '#2a2a2a',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                    border: '1px solid #3a3a3a',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                },
                children: groupChildren
            });
        });


        return uiObjects;
    }

    /**
     * Renders a specialized Color Input
     */
    public renderColorInput(value: string): HTMLElement {
        const container = document.createElement('div');
        container.className = 'inspector-color-container';
        this.applyStyle(container, {
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            width: '100%',
            marginBottom: '8px'
        });

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = value && value.startsWith('#') && value.length === 7 ? value : '#000000';
        colorInput.className = 'inspector-color-input';
        this.applyStyle(colorInput, {
            width: '32px',
            height: '24px',
            padding: '0',
            border: '1px solid #444',
            borderRadius: '3px',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            flexShrink: '0'
        });

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = value || '#000000';
        textInput.className = 'inspector-color-text';
        this.applyStyle(textInput, {
            flex: '1',
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '3px',
            padding: '4px 6px',
            fontSize: '12px',
            outline: 'none'
        });

        container.appendChild(colorInput);
        container.appendChild(textInput);

        // Expose inputs for events
        (container as any).colorInput = colorInput;
        (container as any).textInput = textInput;

        return container;
    }

    private pushInputIntoUI(target: any[], prop: any, inputName: string, binding: string): void {
        if (prop.type === 'number') {
            target.push({
                className: 'TNumberInput',
                name: inputName,
                value: binding,
                min: prop.min ?? 0,
                max: prop.max,
                step: prop.step ?? 0.1
            });
        } else if (prop.type === 'color') {
            target.push({
                className: 'TColorInput',
                name: inputName,
                value: binding
            });
        } else if (prop.type === 'string') {
            target.push({
                className: 'TPanel',
                name: `${prop.name}Wrapper`,
                style: { display: 'flex', gap: '4px', marginBottom: '8px', padding: '0', flex: 1 },
                children: [
                    {
                        className: 'TEdit',
                        name: inputName,
                        text: binding,
                        style: { flex: 1, marginBottom: '0' }
                    },
                    {
                        className: 'TButton',
                        name: `${prop.name}PickVarBtn`,
                        caption: 'V',
                        action: 'pickVariable',
                        actionData: { property: prop.name, inputName: inputName },
                        style: { width: '32px', minWidth: '32px', flexShrink: '0', padding: '4px', marginTop: '0', backgroundColor: '#e67e22', color: '#fff', fontWeight: 'bold', border: 'none' }
                    }
                ]
            });
        } else if (prop.type === 'boolean') {
            target.push({
                className: 'TCheckbox',
                name: inputName,
                checked: binding,
                label: prop.label
            });
        } else if (prop.type === 'select') {
            target.push({
                className: 'TDropdown',
                name: inputName,
                options: this.getOptionsFromSource(prop),
                selectedValue: binding
            });
        } else if (prop.type === 'image_picker') {
            target.push({
                className: 'TPanel',
                name: `${prop.name}Wrapper`,
                style: { display: 'flex', gap: '4px', marginBottom: '8px', padding: '0', flex: 1 },
                children: [
                    {
                        className: 'TEdit',
                        name: inputName,
                        text: binding,
                        style: { flex: 1, marginBottom: '0' }
                    },
                    {
                        className: 'TButton',
                        name: `${prop.name}BrowseBtn`,
                        caption: '...',
                        action: 'browseImage',
                        actionData: { property: prop.name, inputName: inputName },
                        style: { width: '32px', padding: '4px', marginTop: '0' }
                    }
                ]
            });
        } else if (prop.type === 'button') {
            target.push({
                className: 'TButton',
                name: inputName,
                caption: prop.label || prop.name,
                action: prop.action,
                style: prop.style
            });
        }
    }

    public getOptionsFromSource(prop: any): any[] {
        if (Array.isArray(prop.options)) return prop.options;
        if (!prop.source) return [];

        if (prop.source === 'tasks') {
            return projectRegistry.getTasks().map(t => ({ value: t.name, label: t.name }));
        }
        if (prop.source === 'actions') {
            return projectRegistry.getActions().map(a => ({ value: a.name, label: a.name }));
        }
        if (prop.source === 'dataActions') {
            return projectRegistry.getActions().filter(a => a.type === 'data_action' || a.type === 'http').map(a => ({ value: a.name, label: a.name }));
        }
        if (prop.source === 'variables') {
            return projectRegistry.getVariables().map(v => ({ value: v.name, label: v.name }));
        }
        if (prop.source === 'objects') {
            return projectRegistry.getObjects().map(o => ({ value: o.name, label: o.name }));
        }
        if (prop.source === 'services') {
            return serviceRegistry.listServices().map(s => ({ value: s, label: s }));
        }
        if (prop.source === 'stages') {
            return projectRegistry.getStages().map((s: any) => ({ value: s.id, label: s.name || s.id }));
        }
        if (prop.source === 'easing-functions') {
            return ['linear', 'easeIn', 'easeOut', 'easeInOut'].map(e => ({ value: e, label: e }));
        }
        return [];
    }

    /**
     * Safely applies styles to an element, supporting both objects and strings.
     */
    private applyStyle(el: HTMLElement, style: any): void {
        if (!style) return;
        if (typeof style === 'string') {
            // Apply as cssText (merge with existing if possible or replace safe)
            el.style.cssText += ';' + style;
        } else if (typeof style === 'object') {
            Object.assign(el.style, style);
        }
    }
}
