import { ReactiveRuntime } from '../../runtime/ReactiveRuntime';
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
    constructor(private runtime: ReactiveRuntime) { }

    /**
     * Renders a basic Label element
     */
    public renderLabel(text: string, style?: any): HTMLElement {
        const el = document.createElement('div');
        el.className = 'inspector-label';
        el.innerText = text;
        el.style.fontSize = style?.fontSize ? `${style.fontSize}px` : '11px';
        el.style.color = style?.color || '#ccc';
        el.style.marginBottom = '4px';
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
        Object.assign(input.style, {
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

        Object.assign(select.style, {
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
            if (typeof opt === 'string') {
                option.value = opt;
                option.text = opt;
            } else {
                option.value = opt.value;
                option.text = opt.label || opt.text || opt.name || opt.value;
            }
            if (option.value === selectedValue) option.selected = true;
            select.appendChild(option);
        });

        return select;
    }

    /**
     * Renders a TButton-like button
     */
    public renderButton(text: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.className = 'inspector-button';

        Object.assign(btn.style, {
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

        btn.onmouseover = () => btn.style.backgroundColor = '#555';
        btn.onmouseout = () => btn.style.backgroundColor = '#444';
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

        Object.assign(input.style, {
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
            Object.assign(el.style, style);
        }
        return el;
    }

    /**
     * Renders dynamic action parameters based on action type metadata.
     */
    public renderActionParams(_obj: any, selectedObject: any, onUpdate: (prop: string, val: any) => void): HTMLElement | null {
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
                        sigInput = ed;
                    }
                    sigRow.appendChild(sigInput);
                    paramContainer.appendChild(sigRow);
                });
                input = paramContainer;
            } else {
                switch (param.type) {
                    case 'object':
                    case 'variable':
                    case 'stage':
                    case 'select':
                    case 'method': {
                        const options = this.getOptionsFromSource(param);
                        const sel = this.renderSelect(options, currentValue, '--- wählen ---');
                        sel.onchange = () => onUpdate(param.name, sel.value);
                        input = sel;
                        break;
                    }
                    default: {
                        const edit = this.renderEdit(currentValue, param.placeholder || '');
                        edit.onchange = () => onUpdate(param.name, edit.value);
                        input = edit;
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
        grouped.forEach((props, groupName) => {
            // Group header
            uiObjects.push({
                className: 'TLabel',
                name: `${groupName}Header`,
                text: groupName.toUpperCase(),
                style: { fontSize: 10, fontWeight: 'bold', color: '#888', marginTop: 12, marginBottom: 6 }
            });

            // Properties in group
            props.forEach((prop: any) => {
                const labelStyle: any = { fontSize: 12, color: '#aaa' };

                // Label
                uiObjects.push({
                    className: 'TLabel',
                    name: `${prop.name}Label`,
                    text: `${prop.label || prop.name}:`,
                    style: labelStyle,
                    readOnly: prop.readOnly
                });

                // Input based on type
                const inputName = `${prop.name}Input`;
                const binding = `\${selectedObject.${prop.name}}`;

                if (prop.type === 'number') {
                    uiObjects.push({
                        className: 'TNumberInput',
                        name: inputName,
                        value: binding,
                        min: 0,
                        step: 0.1
                    });
                } else if (prop.type === 'string') {
                    uiObjects.push({
                        className: 'TEdit',
                        name: inputName,
                        text: binding
                    });
                } else if (prop.type === 'boolean') {
                    uiObjects.push({
                        className: 'TCheckbox',
                        name: inputName,
                        checked: binding,
                        label: prop.label
                    });
                } else if (prop.type === 'select') {
                    uiObjects.push({
                        className: 'TDropdown',
                        name: inputName,
                        options: this.getOptionsFromSource(prop),
                        selectedValue: binding
                    });
                } else if (prop.type === 'image_picker') {
                    uiObjects.push({
                        className: 'TPanel',
                        name: `${prop.name}Wrapper`,
                        style: { display: 'flex', gap: '4px', marginBottom: '8px', padding: '0' },
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
                    uiObjects.push({
                        className: 'TButton',
                        name: inputName,
                        caption: prop.label || prop.name,
                        action: prop.action,
                        style: prop.style
                    });
                }
            });
        });

        // Use runtime to suppress lint if needed, although usually we want to use it
        if (this.runtime) { /* placeholder to use runtime */ }

        return uiObjects;
    }

    private getOptionsFromSource(prop: any): any[] {
        if (prop.options) return prop.options;
        if (!prop.source) return [];

        if (prop.source === 'tasks') {
            return projectRegistry.getTasks().map(t => ({ value: t.name, label: t.name }));
        }
        if (prop.source === 'actions') {
            return projectRegistry.getActions().map(a => ({ value: a.name, label: a.name }));
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
}
