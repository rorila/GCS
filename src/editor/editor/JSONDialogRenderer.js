import { ReactiveRuntime } from '../runtime/ReactiveRuntime';
import { serviceRegistry } from '../services/ServiceRegistry';
import { hydrateObjects } from '../utils/Serialization';
import { imageService } from '../services/ImageService';
import { MethodRegistry } from './MethodRegistry';
import { projectRegistry } from '../services/ProjectRegistry';
import { actionRegistry } from '../runtime/ActionRegistry';
/**
 * JSONDialogRenderer - Renders dialogs from JSON definitions
 * Similar to JSONInspector but for modal dialogs
 */
export class JSONDialogRenderer {
    constructor(dialogDef, dialogData, project, onResult, dialogManager) {
        console.log(`[JSONDialogRenderer] Initializing for:`, dialogDef.title);
        this.dialogDef = dialogDef;
        this.project = project;
        this.onResult = onResult;
        this.dialogManager = dialogManager;
        this.runtime = new ReactiveRuntime();
        // Initialize dialogData - user data first, then fill in missing defaults
        this.dialogData = { ...dialogData };
        // Clear transient form state from previous sessions to avoid pollution
        delete this.dialogData._formValues;
        this.dialogData._formValues = {};
        // Only set defaults if properties are truly missing (not just empty)
        if (this.dialogData.type === undefined) {
            this.dialogData.type = 'property';
        }
        if (this.dialogData.target === undefined) {
            this.dialogData.target = projectRegistry.getObjects()[0]?.name || '';
        }
        if (this.dialogData.changes === undefined) {
            this.dialogData.changes = {};
        }
        // Register variables
        this.runtime.registerVariable('dialogData', this.dialogData);
        this.runtime.registerVariable('serviceRegistry', serviceRegistry);
        const stageObjects = projectRegistry.getObjects();
        const stageVars = projectRegistry.getVariables({
            taskName: this.dialogData.taskName,
            actionId: this.dialogData.actionId || this.dialogData.name
        });
        console.log(`[JSONDialogRenderer] Enrichment: Found ${stageObjects.length} objects and ${stageVars.length} variables in Registry.`);
        const enrichedProject = {
            ...this.project,
            objects: stageObjects.length > 0 ? stageObjects : (this.project.objects || []),
            variables: stageVars.length > 0 ? stageVars : (this.project.variables || [])
        };
        this.enrichedProject = enrichedProject;
        this.runtime.registerVariable('project', this.enrichedProject);
        this.runtime.registerVariable('taskName', dialogData.taskName || '');
        this.runtime.registerVariable('actionName', dialogData.actionName || '');
        this.runtime.registerVariable('getProperties', (name) => this.getPropertiesForObject(name));
        this.runtime.registerVariable('getMethods', (name) => this.getMethodsForObject(name));
        this.runtime.registerVariable('getMethodSignature', (target, method) => this.getMethodSignature(target, method));
        this.runtime.registerVariable('getStageOptions', () => {
            return (this.enrichedProject.stages || []).map(s => ({ value: s.id, label: s.name || s.id }));
        });
        this.runtime.registerVariable('getAllActionTypes', () => {
            return actionRegistry.getAllMetadata().map(m => ({ value: m.type, label: m.label }));
        });
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'task-editor-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        // Create dialog window
        this.dialogWindow = document.createElement('div');
        this.dialogWindow.className = 'task-editor-window';
        this.dialogWindow.style.cssText = `
            background: #1e1e1e;
            border-radius: 8px;
            width: ${this.dialogDef.width || 600}px;
            max-height: ${this.dialogDef.height || 700}px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;
        this.overlay.appendChild(this.dialogWindow);
        document.body.appendChild(this.overlay);
        this.render();
    }
    render() {
        // Save scroll positions using a more robust key (either data-scroll-key or tag+class+index)
        const scrollMap = new Map();
        this.dialogWindow.querySelectorAll('*').forEach((el, idx) => {
            if (el.scrollTop > 0) {
                const key = el.getAttribute('data-scroll-key') || `${el.tagName}_${el.className}_${idx}`;
                scrollMap.set(key, el.scrollTop);
            }
        });
        this.dialogWindow.innerHTML = '';
        // Header
        const header = this.createHeader();
        this.dialogWindow.appendChild(header);
        // Body
        const body = this.createBody();
        this.dialogWindow.appendChild(body);
        // Footer
        const footer = this.createFooter();
        this.dialogWindow.appendChild(footer);
        // Restore scroll positions
        if (scrollMap.size > 0) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                this.dialogWindow.querySelectorAll('*').forEach((el, idx) => {
                    const key = el.getAttribute('data-scroll-key') || `${el.tagName}_${el.className}_${idx}`;
                    if (scrollMap.has(key)) {
                        el.scrollTop = scrollMap.get(key);
                    }
                });
            });
        }
        // Setup bindings
        this.setupBindings();
    }
    createHeader() {
        const header = document.createElement('div');
        header.className = 'task-editor-header';
        header.style.cssText = `
            padding: 16px 20px;
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        const title = document.createElement('span');
        title.style.cssText = 'font-size: 16px; font-weight: bold; color: white;';
        title.innerText = this.evaluateExpression(this.dialogDef.title);
        header.appendChild(title);
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
        `;
        closeBtn.onclick = () => this.close('cancel');
        header.appendChild(closeBtn);
        return header;
    }
    createBody() {
        const body = document.createElement('div');
        body.className = 'task-editor-body';
        body.style.cssText = `
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            flex: 1;
            padding: 16px 20px;
        `;
        if (this.dialogDef.objects) {
            this.dialogDef.objects.forEach((obj) => {
                const el = this.renderObject(obj);
                if (el)
                    body.appendChild(el);
            });
        }
        return body;
    }
    createFooter() {
        const footer = document.createElement('div');
        footer.className = 'task-editor-footer';
        footer.style.cssText = `
            padding: 16px 20px;
            border-top: 1px solid #444;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        `;
        // Render footer buttons
        if (this.dialogDef.footer) {
            this.dialogDef.footer.forEach((obj) => {
                const el = this.renderObject(obj);
                if (el)
                    footer.appendChild(el);
            });
        }
        return footer;
    }
    renderObject(obj) {
        try {
            // Check visibility
            if (obj.visible !== undefined) {
                const isVisible = this.evaluateExpression(obj.visible);
                if (obj.name === 'PropertySelect') {
                    console.log(`[JSONDialogRenderer] Visibility check for PropertySelect:`, {
                        expr: obj.visible,
                        result: isVisible,
                        data: {
                            type: this.dialogData.type,
                            target: this.dialogData.target,
                            targetProps: this.getPropertiesForObject(this.dialogData.target)
                        }
                    });
                }
                if (!isVisible)
                    return null;
            }
            const className = obj.className;
            if (className === 'TForEach') {
                return this.renderForEach(obj);
            }
            if (className === 'TActionParams') {
                return this.renderActionParams(obj);
            }
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
                    const evaluatedValue = this.evaluateExpression(value);
                    el.style.setProperty(cssKey, String(evaluatedValue));
                });
            }
            // Render based on type
            switch (className) {
                case 'TLabel':
                    el.innerText = this.evaluateExpression(obj.text || '');
                    break;
                case 'TEdit':
                case 'TMemo': {
                    const isMemo = className === 'TMemo';
                    const input = document.createElement(isMemo ? 'textarea' : 'input');
                    if (!isMemo)
                        input.type = 'text';
                    // Prioritize current form value during session, then static text
                    const currentVal = this.dialogData._formValues?.[obj.name];
                    input.value = currentVal !== undefined ? currentVal : this.evaluateExpression(obj.text || '');
                    input.placeholder = obj.placeholder || '';
                    if (obj.name)
                        input.setAttribute('data-name', obj.name);
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
                    // Real-time sync to model (does not re-render)
                    input.oninput = () => {
                        if (obj.name) {
                            this.updateModelValue(obj.name, input.value);
                        }
                    };
                    // Trigger heavy actions (parsing/rendering) only on commit (blur/enter)
                    input.onchange = () => {
                        if (obj.action) {
                            this.handleAction(obj.action, obj.actionData);
                        }
                    };
                    el.appendChild(input);
                    break;
                }
                case 'TDropdown':
                    const select = document.createElement('select');
                    if (obj.name)
                        select.setAttribute('data-name', obj.name);
                    const optionsArr = this.evaluateExpression(obj.options || []);
                    console.log(`[JSONDialogRenderer] Rendering TDropdown "${obj.name}" with options:`, optionsArr);
                    // Prioritize current form value during session
                    const currentSelection = this.dialogData._formValues?.[obj.name];
                    const selectedValue = currentSelection !== undefined ? currentSelection : this.evaluateExpression(obj.selectedValue);
                    const selectedIndex = currentSelection !== undefined ? undefined : this.evaluateExpression(obj.selectedIndex);
                    // Add placeholder if requested or if no valid selection exists
                    if (!selectedValue && !selectedIndex) {
                        const placeholder = document.createElement('option');
                        placeholder.value = '';
                        placeholder.text = '--- bitte wählen ---';
                        placeholder.disabled = true;
                        placeholder.selected = true;
                        select.appendChild(placeholder);
                    }
                    optionsArr.forEach((opt, idx) => {
                        const option = document.createElement('option');
                        if (typeof opt === 'object' && opt !== null) {
                            option.value = opt.value;
                            option.text = opt.label || opt.name || opt.value;
                            if (selectedValue === opt.value)
                                option.selected = true;
                        }
                        else {
                            option.value = opt;
                            option.text = opt;
                            if (selectedValue === opt)
                                option.selected = true;
                            else if (selectedIndex === idx) {
                                // Only auto-select if we don't have a placeholder selected
                                if (!select.querySelector('option[selected]')) {
                                    option.selected = true;
                                }
                            }
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
                        // Sync to model
                        if (obj.name) {
                            this.updateModelValue(obj.name, select.value);
                        }
                        if (obj.action) {
                            this.handleAction(obj.action, obj.actionData);
                        }
                    };
                    el.appendChild(select);
                    break;
                case 'TCheckbox': {
                    const label = document.createElement('label');
                    label.style.cssText = 'display: flex; align-items: center; cursor: pointer;';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    // Prioritize current form value during session
                    const currentVal = obj.name ? this.dialogData._formValues?.[obj.name] : undefined;
                    checkbox.checked = currentVal !== undefined ? currentVal : this.evaluateExpression(obj.checked || false);
                    checkbox.style.marginRight = '8px';
                    if (obj.name)
                        checkbox.setAttribute('data-name', obj.name);
                    checkbox.onchange = () => {
                        // Sync to model
                        if (obj.name) {
                            this.updateModelValue(obj.name, checkbox.checked);
                        }
                        if (obj.action) {
                            this.handleAction(obj.action, obj.actionData);
                        }
                    };
                    label.appendChild(checkbox);
                    const text = document.createElement('span');
                    text.innerText = this.evaluateExpression(obj.label || '');
                    text.style.color = 'white';
                    label.appendChild(text);
                    el.appendChild(label);
                    break;
                }
                case 'TButton':
                    const button = document.createElement('button');
                    button.id = `btn-${obj.name || 'unknown'}`;
                    button.innerText = this.evaluateExpression(obj.caption || obj.name);
                    // Apply button styles - note: background color comes from obj.style, not hardcoded
                    button.style.cssText = `
                    padding: 8px 16px;
                    background: ${obj.style?.backgroundColor || '#0e639c'};
                    color: ${obj.style?.color || 'white'};
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                `;
                    // Clear wrapper background - button has its own
                    el.style.backgroundColor = 'transparent';
                    button.onclick = (e) => {
                        e.stopPropagation();
                        if (obj.action) {
                            this.handleAction(obj.action, obj.actionData);
                        }
                    };
                    el.appendChild(button);
                    break;
                case 'TPanel':
                    // Render children
                    if (obj.children && Array.isArray(obj.children)) {
                        obj.children.forEach((child) => {
                            const childEl = this.renderObject(child);
                            if (childEl)
                                el.appendChild(childEl);
                        });
                    }
                    // Add action support for panels
                    if (obj.action) {
                        el.style.cursor = 'pointer';
                        el.onclick = () => {
                            this.handleAction(obj.action, obj.actionData);
                        };
                    }
                    // Support double-click to directly select
                    if (obj.doubleClickAction) {
                        el.ondblclick = () => {
                            this.handleAction(obj.doubleClickAction, obj.doubleClickActionData || obj.actionData);
                        };
                    }
                    break;
                case 'TImage': {
                    const img = document.createElement('img');
                    const src = this.evaluateExpression(obj.src || '');
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
        }
        catch (e) {
            console.error('[JSONDialogRenderer] Error rendering object:', obj, e);
            const errEl = document.createElement('div');
            errEl.style.color = 'red';
            errEl.innerText = `Error rendering ${obj.className || 'object'}: ${e.message}`;
            return errEl;
        }
    }
    renderActionParams(_obj) {
        const type = this.dialogData.type;
        const meta = actionRegistry.getMetadata(type);
        if (!meta)
            return null;
        const container = document.createElement('div');
        container.className = 'action-params-container';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '12px';
        container.style.width = '100%';
        meta.parameters.forEach(param => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.gap = '4px';
            const label = document.createElement('label');
            label.innerText = param.label;
            label.style.fontSize = '12px';
            label.style.color = '#aaa';
            row.appendChild(label);
            let input = null;
            switch (param.type) {
                case 'object':
                case 'variable':
                case 'stage':
                case 'select': {
                    const sel = document.createElement('select');
                    sel.setAttribute('data-name', param.name);
                    sel.style.cssText = 'width: 100%; padding: 6px; background: #333; color: white; border: 1px solid #555; border-radius: 3px;';
                    let items = [];
                    if (param.source === 'objects')
                        items = projectRegistry.getObjects().map(o => ({ value: o.name, label: o.name }));
                    else if (param.source === 'variables')
                        items = projectRegistry.getVariables().map(v => ({ value: v.name, label: v.name }));
                    else if (param.source === 'stages')
                        items = (this.project.stages || []).map((s) => ({ value: s.id, label: s.name || s.id }));
                    else if (param.source === 'services')
                        items = serviceRegistry.listServices().map(s => ({ value: s, label: s }));
                    else if (param.source === 'easing-functions')
                        items = ['linear', 'easeIn', 'easeOut', 'easeInOut'].map(e => ({ value: e, label: e }));
                    // Add empty option
                    const empty = document.createElement('option');
                    empty.value = '';
                    empty.text = '--- wählen ---';
                    sel.appendChild(empty);
                    items.forEach(it => {
                        const opt = document.createElement('option');
                        opt.value = it.value;
                        opt.text = it.label;
                        if (this.dialogData[param.name] === it.value)
                            opt.selected = true;
                        sel.appendChild(opt);
                    });
                    sel.onchange = () => {
                        this.dialogData[param.name] = sel.value;
                        this.render();
                    };
                    input = sel;
                    break;
                }
                case 'json':
                case 'string':
                case 'number':
                default: {
                    const edit = document.createElement('input');
                    edit.type = 'text';
                    edit.setAttribute('data-name', param.name);
                    edit.value = this.dialogData[param.name] !== undefined ? (typeof this.dialogData[param.name] === 'object' ? JSON.stringify(this.dialogData[param.name]) : this.dialogData[param.name]) : (param.defaultValue || '');
                    edit.style.cssText = 'width: 100%; padding: 6px; background: #333; color: white; border: 1px solid #555; border-radius: 3px;';
                    edit.onchange = () => {
                        let val = edit.value;
                        if (param.type === 'number')
                            val = Number(val);
                        if (param.type === 'json') {
                            try {
                                val = JSON.parse(val);
                            }
                            catch (e) {
                                // Support "prop=val" syntax for convenience (as requested by user)
                                if (typeof val === 'string' && val.includes('=') && !val.trim().startsWith('{')) {
                                    const parts = val.split('=').map(s => s.trim());
                                    if (parts.length === 2) {
                                        const [k, v] = parts;
                                        // Auto-convert numbers if possible
                                        const numV = Number(v);
                                        val = { [k]: !isNaN(numV) && v !== '' ? numV : v };
                                        console.log(`[JSONDialogRenderer] Auto-converted "${edit.value}" to JSON:`, val);
                                    }
                                }
                                else {
                                    console.error('Invalid JSON in param', param.name, val);
                                }
                            }
                        }
                        this.dialogData[param.name] = val;
                        if (param.name === 'target' || param.name === 'service' || param.name === 'method') {
                            this.render();
                        }
                    };
                    input = edit;
                    break;
                }
            }
            if (input)
                row.appendChild(input);
            if (param.hint) {
                const hint = document.createElement('div');
                hint.innerText = param.hint;
                hint.style.fontSize = '10px';
                hint.style.color = '#666';
                row.appendChild(hint);
            }
            container.appendChild(row);
        });
        return container;
    }
    renderForEach(obj) {
        const container = document.createElement('div');
        container.className = 'foreach-container';
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.width = '100%';
        const sourceData = this.evaluateExpression(obj.source);
        if (!sourceData)
            return null;
        let items = [];
        if (Array.isArray(sourceData)) {
            items = sourceData;
        }
        else if (typeof sourceData === 'object' && sourceData !== null) {
            items = Object.entries(sourceData); // Key-value pairs as [key, value]
        }
        // Apply filter if specified
        if (obj.filter && items.length > 0) {
            items = items.filter((item) => {
                try {
                    // Include item and usual scope variables in filter context
                    const fn = new Function('item', 'dialogData', 'project', 'taskName', 'actionName', 'name', 'serviceRegistry', 'getProperties', 'getMethods', `return ${obj.filter}`);
                    return fn(item, this.dialogData, this.project, this.dialogData.taskName, this.dialogData.actionName, this.dialogData.name, serviceRegistry, (name) => this.getPropertiesForObject(name), (name) => this.getMethodsForObject(name));
                }
                catch (e) {
                    console.error(`[JSONDialogRenderer] Filter evaluation error: ${obj.filter}`, e);
                    return true;
                }
            });
        }
        items.forEach((item, index) => {
            obj.template.forEach((templateObj) => {
                const instance = JSON.parse(JSON.stringify(templateObj));
                this.replaceTemplateVars(instance, item, index);
                const el = this.renderObject(instance);
                if (el)
                    container.appendChild(el);
            });
        });
        return container;
    }
    replaceTemplateVars(obj, item, index) {
        const replace = (target) => {
            if (typeof target === 'string') {
                // Check if string contains template variables
                if (!target.includes('${'))
                    return target;
                // Check if the ENTIRE string is a single template expression that should return an object/array directly
                // e.g. "${item.options}" or "${getMethodSignature(...)}"
                const fullMatch = target.match(/^\$\{([^}]+)\}$/);
                if (fullMatch) {
                    try {
                        const code = fullMatch[1];
                        const fn = new Function('item', 'index', 'dialogData', 'project', 'serviceRegistry', 'getProperties', 'getMethods', 'getMethodSignature', 'getStageOptions', `return ${code}`);
                        return fn(item, index, this.dialogData, this.enrichedProject, serviceRegistry, (name) => this.getPropertiesForObject(name), (name) => this.getMethodsForObject(name), (target, method) => this.getMethodSignature(target, method), () => (this.enrichedProject.stages || []).map(s => ({ value: s.id, label: s.name || s.id })));
                    }
                    catch (e) {
                        // Fallback to string replacement if evaluation fails
                        console.warn(`[JSONDialogRenderer] Failed to evaluate full template "${target}":`, e);
                    }
                }
                // Standard string interpolation for mixed content (e.g. "Value: ${item.val}")
                return target.replace(/\${([^}]+)}/g, (match, code) => {
                    try {
                        const fn = new Function('item', 'index', 'dialogData', 'project', 'serviceRegistry', 'getProperties', 'getMethods', 'getMethodSignature', 'getStageOptions', `return \`${code}\``);
                        const result = fn(item, index, this.dialogData, this.enrichedProject, serviceRegistry, (name) => this.getPropertiesForObject(name), (name) => this.getMethodsForObject(name), (target, method) => this.getMethodSignature(target, method), () => (this.enrichedProject.stages || []).map(s => ({ value: s.id, label: s.name || s.id })));
                        return result !== undefined ? String(result) : '';
                    }
                    catch (e) {
                        console.warn(`[JSONDialogRenderer] Failed to evaluate template part "${match}":`, e);
                        return match;
                    }
                });
            }
            else if (typeof target === 'object' && target !== null) {
                // Return new object to avoid modifying original template items
                const newObj = Array.isArray(target) ? [] : {};
                Object.keys(target).forEach(key => {
                    newObj[key] = replace(target[key]);
                });
                return newObj;
            }
            return target;
        };
        // We need to mutate the object in place because JSONDialogRenderer uses it that way
        // but replace() now returns a new value for nested objects.
        Object.keys(obj).forEach(key => {
            obj[key] = replace(obj[key]);
        });
    }
    evaluateExpression(expr, fallback = undefined) {
        if (typeof expr !== 'string' || !expr.includes('${')) {
            return expr === undefined ? fallback : expr;
        }
        const code = expr.startsWith('${') && expr.endsWith('}')
            ? expr.substring(2, expr.length - 1)
            : `\`${expr.replace(/`/g, '\\`').replace(/\$\{/g, '${')}\``;
        try {
            const fn = new Function('dialogData', 'project', 'taskName', 'actionName', 'name', 'serviceRegistry', 'getProperties', 'getMethods', 'getMethodSignature', 'getStageOptions', `return ${code}`);
            const result = fn(this.dialogData, this.enrichedProject, this.dialogData.taskName, this.dialogData.actionName || this.dialogData.name, this.dialogData.name, serviceRegistry, (name) => this.getPropertiesForObject(name), (name) => this.getMethodsForObject(name), (target, method) => this.getMethodSignature(target, method), () => (this.enrichedProject.stages || []).map(s => ({ value: s.id, label: s.name || s.id })));
            return result;
        }
        catch (e) {
            console.warn(`[JSONDialogRenderer] Expression evaluation failed: "${expr}"`, e);
            return fallback !== undefined ? fallback : expr;
        }
    }
    getMethodSignature(_targetName, methodName) {
        if (!methodName)
            return [];
        // Fallback for no target (generic) or unknown target
        // Lookup in Registry
        const signature = MethodRegistry[methodName];
        console.log(`[JSONDialogRenderer] getMethodSignature('${_targetName}', '${methodName}'):`, signature);
        if (signature) {
            return signature;
        }
        // Default generic param if unknown
        return [{ name: 'params', type: 'string', label: 'Parameter (Nachricht)', isGeneric: true }];
    }
    handleAction(action, actionData) {
        console.log('[JSONDialogRenderer] Action:', action, actionData);
        switch (action) {
            case 'save':
                this.collectFormData();
                this.close('save');
                break;
            case 'cancel':
                this.close('cancel');
                break;
            case 'delete':
                this.close('delete');
                break;
            case 'moveSequenceItem':
                this.moveSequenceItem(actionData.index, actionData.direction);
                break;
            case 'deleteSequenceItem':
                this.deleteSequenceItem(actionData.index);
                break;
            case 'addAction':
                this.addAction();
                break;
            case 'addTaskCall':
                this.addTaskCall();
                break;
            case 'addVariable':
                this.addVariable();
                break;
            case 'toggleVariable':
                this.toggleVariable(actionData.variableName);
                break;
            case 'changeActionType':
                this.reloadTypeDefaults();
                this.render();
                break;
            case 'addPropertyChange':
                this.addPropertyChange();
                break;
            case 'deletePropertyChange':
                delete this.dialogData.changes[actionData.property];
                this.render();
                break;
            case 'insertVariable':
                this.insertVariable();
                break;
            case 'createAction':
                this.handleCreateAction();
                break;
            case 'updateValue':
                if (actionData && actionData.field && actionData.input) {
                    this.dialogData[actionData.field] = this.getInputValue(actionData.input);
                    this.render();
                }
                break;
            case 'updateArrayItem':
                if (actionData && actionData.arrayField && actionData.index !== undefined) {
                    const idx = typeof actionData.index === 'string' ? parseInt(actionData.index, 10) : actionData.index;
                    if (!isNaN(idx)) {
                        const arr = this.dialogData[actionData.arrayField] || [];
                        const val = this.getInputValue(actionData.input);
                        if (actionData.property && typeof arr[idx] === 'object' && arr[idx] !== null) {
                            // Update property of object in array
                            arr[idx][actionData.property] = val;
                        }
                        else {
                            // Update entire item
                            arr[idx] = val;
                        }
                        this.dialogData[actionData.arrayField] = arr;
                        this.render();
                    }
                }
                break;
            case 'addArrayItem':
                if (actionData && actionData.arrayField) {
                    const arr = this.dialogData[actionData.arrayField] || [];
                    arr.push(actionData.value !== undefined ? actionData.value : '');
                    this.dialogData[actionData.arrayField] = arr;
                    this.render();
                }
                break;
            case 'deleteArrayItem':
                if (actionData && actionData.arrayField && actionData.index !== undefined) {
                    const idx = typeof actionData.index === 'string' ? parseInt(actionData.index, 10) : actionData.index;
                    if (!isNaN(idx)) {
                        const arr = this.dialogData[actionData.arrayField] || [];
                        arr.splice(idx, 1);
                        this.dialogData[actionData.arrayField] = arr;
                        this.render();
                    }
                }
                break;
            case 'selectTarget':
                this.handleSelectTarget();
                break;
            case 'refreshImages':
                imageService.listImages().then(images => {
                    this.dialogData.images = imageService.flattenImages(images);
                    this.render();
                });
                break;
            case 'markImage':
                console.log('[JSONDialogRenderer] Marking image:', actionData.path);
                this.dialogData.selectedPath = actionData.path;
                this.render();
                break;
            case 'selectImage':
                console.log('[JSONDialogRenderer] selectImage called. Current selectedPath:', this.dialogData.selectedPath, 'actionData:', actionData);
                if (actionData && actionData.path) {
                    this.dialogData.selectedPath = actionData.path;
                }
                if (this.dialogData.selectedPath) {
                    console.log('[JSONDialogRenderer] Closing with selection:', this.dialogData.selectedPath);
                    this.close('select');
                }
                else {
                    alert('Bitte wähle zuerst ein Bild aus.');
                }
                break;
            default:
                console.warn('[JSONDialogRenderer] Unknown action:', action);
        }
    }
    moveSequenceItem(index, direction) {
        const list = this.dialogData.actionSequence;
        if (!list)
            return;
        if (direction === 'up' && index > 0) {
            [list[index - 1], list[index]] = [list[index], list[index - 1]];
            this.render();
        }
        else if (direction === 'down' && index < list.length - 1) {
            [list[index], list[index + 1]] = [list[index + 1], list[index]];
            this.render();
        }
    }
    deleteSequenceItem(index) {
        const list = this.dialogData.actionSequence;
        if (list) {
            list.splice(index, 1);
            this.render();
        }
    }
    addAction() {
        const actionName = this.getInputValue('ActionSelect')?.split(' ')[0]; // Extract name from "Name (Target)"
        if (actionName) {
            this.dialogData.actionSequence = this.dialogData.actionSequence || [];
            this.dialogData.actionSequence.push({ type: 'action', name: actionName });
            this.render();
        }
    }
    addTaskCall() {
        const taskName = this.getInputValue('TaskSelect')?.replace('🔗 ', '');
        if (taskName) {
            this.dialogData.actionSequence = this.dialogData.actionSequence || [];
            this.dialogData.actionSequence.push({ type: 'task', name: taskName });
            this.render();
        }
    }
    addVariable() {
        const name = this.getInputValue('NewVariableNameInput');
        const value = this.getInputValue('NewVariableValueInput');
        if (!name) {
            alert('Variable name is required');
            return;
        }
        if (this.project.variables.some(v => v.name === name)) {
            alert(`Variable "${name}" already exists!`);
            return;
        }
        this.project.variables.push({ name: name, type: 'string', scope: 'global', defaultValue: value || '' });
        this.render();
    }
    toggleVariable(name) {
        if (!name)
            return;
        this.dialogData.usedVariables = this.dialogData.usedVariables || [];
        const idx = this.dialogData.usedVariables.indexOf(name);
        if (idx === -1) {
            this.dialogData.usedVariables.push(name);
        }
        else {
            this.dialogData.usedVariables.splice(idx, 1);
        }
        // Force re-render to update checkboxes
        this.render();
    }
    reloadTypeDefaults() {
        // Reset/init fields based on type
        if (this.dialogData.type === 'variable') {
            this.dialogData.variableName = this.dialogData.variableName || '';
            this.dialogData.source = this.dialogData.source || (projectRegistry.getObjects()[0]?.name || '');
            this.dialogData.sourceProperty = this.dialogData.sourceProperty || 'text';
        }
        else if (this.dialogData.type === 'call_method') {
            this.dialogData.target = this.dialogData.target || (projectRegistry.getObjects()[0]?.name || '');
            this.dialogData.method = this.dialogData.method || '';
            this.dialogData.params = this.dialogData.params || [];
        }
        else if (this.dialogData.type === 'calculate') {
            this.dialogData.resultVariable = this.dialogData.resultVariable || '';
            this.dialogData.calcSteps = this.dialogData.calcSteps || [];
            // Generate formula string if missing
            if (!this.dialogData.formula && this.dialogData.calcSteps.length > 0) {
                this.dialogData.formula = this.stringifyCalcSteps(this.dialogData.calcSteps);
            }
        }
        else {
            this.dialogData.target = this.dialogData.target || (projectRegistry.getObjects()[0]?.name || '');
            this.dialogData.changes = this.dialogData.changes || {};
        }
        // Default sync to true if not specified
        if (this.dialogData.sync === undefined) {
            this.dialogData.sync = true;
        }
    }
    applyPropertyChange(prop, val) {
        console.log(`[JSONDialogRenderer] applyPropertyChange: property="${prop}", value="${val}" (type: ${typeof val})`);
        if (!prop)
            return;
        let finalValue = val;
        // Type inference for simple strings
        if (typeof val === 'string' && !val.includes('${')) {
            const trimmed = val.trim();
            if (trimmed === 'true')
                finalValue = true;
            else if (trimmed === 'false')
                finalValue = false;
            else if (trimmed !== '' && !isNaN(Number(trimmed)) && !trimmed.startsWith('#')) {
                finalValue = Number(trimmed);
            }
        }
        this.dialogData.changes = this.dialogData.changes || {};
        this.dialogData.changes[prop] = finalValue;
    }
    addPropertyChange() {
        // Explicitly get current values from inputs to ensure we have the latest
        const prop = this.getInputValue('PropertySelect');
        const val = this.getInputValue('PropertyValueInput');
        console.log(`[JSONDialogRenderer] addPropertyChange button clicked:`, { prop, val });
        if (!prop) {
            console.warn('[JSONDialogRenderer] addPropertyChange - no property selected!');
            return;
        }
        this.applyPropertyChange(prop, val);
        console.log(`[JSONDialogRenderer] Current changes after add:`, this.dialogData.changes);
        // Clear input value for next addition
        this.dialogData._formValues = this.dialogData._formValues || {};
        this.dialogData._formValues['PropertyValueInput'] = '';
        const input = this.dialogWindow.querySelector('[data-name="PropertyValueInput"]');
        if (input)
            input.value = '';
        this.render();
    }
    insertVariable() {
        const varName = this.getInputValue('VariablePickerSelect');
        if (varName && varName !== '📦 Var') {
            // Find inputs to insert into
            // Try to find PropertyValueInput specifically, or just use the focused one if possible
            // Simpler approach: update PropertyValueInput directly since we know context
            // Just update the internal value map for next render or handle DOM directly
            // For now, simpler to assume it targets PropertyValueInput
            const input = this.dialogWindow.querySelector('input[placeholder="Value or ${varName}"]');
            if (input) {
                input.value = `\${${varName}}`;
                // Trigger input event to update model if bound
                input.dispatchEvent(new Event('input'));
            }
            // Reset picker
            const picker = this.dialogWindow.querySelectorAll('select')[2]; // Hacky index, better use name
            if (picker)
                picker.selectedIndex = 0;
        }
    }
    collectFormData() {
        const namedElements = this.dialogWindow.querySelectorAll('[data-name]');
        namedElements.forEach(el => {
            const name = el.getAttribute('data-name');
            let value = el.value;
            if (el instanceof HTMLInputElement && el.type === 'checkbox') {
                value = el.checked;
            }
            if (name) {
                this.updateModelValue(name, value);
            }
        });
        // Strip internal form values before returning to keep project clean
        delete this.dialogData._formValues;
        // Cleanup simplified UI helper properties if they exist
        delete this.dialogData.IncrementVariableInput;
    }
    getInputValue(name) {
        // Find element by name in DOM
        // Updated to use data-name lookup
        // Strategy: Iterate rendered inputs and find match
        // But wait, renderObject doesn't set ID/name on inputs typically.
        // Let's rely on finding by class/structure or modifying renderObject to add data-name
        // Better: Find based on rendered structure which we control
        // FIX: Update renderObject to add data-name attribute
        const el = this.dialogWindow.querySelector(`[data-name="${name}"]`);
        const value = (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) ? el.value : undefined;
        console.log(`[JSONDialogRenderer] getInputValue("${name}"):`, { found: !!el, value });
        return value;
    }
    setupBindings() {
        // TODO: Implement reactive bindings similar to JSONInspector. 
        // Currently we rely on manual re-renders via this.render() calls in actions.
    }
    async handleCreateAction() {
        if (!this.dialogManager) {
            console.warn('[JSONDialogRenderer] Cannot create action: DialogManager not available');
            return;
        }
        // Create a temporary action stub
        const timestamp = Date.now();
        const actionName = `Action_${timestamp}`;
        const newAction = {
            name: actionName,
            type: 'property', // Default
            target: '',
            changes: {}
        };
        // Add to project.actions temporarily
        this.project.actions = this.project.actions || [];
        this.project.actions.push(newAction);
        const result = await this.dialogManager.showDialog('action_editor', true, newAction);
        if (result && result.action === 'save') {
            // Saved. Keep it.
            this.render(); // Update dropdowns
        }
        else {
            // Cancelled. Remove it.
            const idx = this.project.actions.indexOf(newAction);
            if (idx !== -1)
                this.project.actions.splice(idx, 1);
            this.render();
        }
    }
    updateModelValue(name, value) {
        // Sync to a central formValues bag for easy collection
        this.dialogData._formValues = this.dialogData._formValues || {};
        this.dialogData._formValues[name] = value;
        // Map common component names to dialogData properties
        if (name === 'NameInput') {
            this.dialogData.name = value;
        }
        if (name === 'ActionTypeSelect') {
            const types = {
                '📝 Property Change (Set)': 'property',
                '🔧 Eigenschaft setzen': 'property', // Legacy fallback
                '📞 Call Method': 'call_method',
                'Plus Increment (Add)': 'increment', // Fallback
                '➕ Increment (Add)': 'increment',
                '➕ Wert erhöhen': 'increment', // Legacy
                '➖ Wert verringern': 'decrement',
                '↔️ Negate (Invert)': 'negate',
                '🔄 Wert invertieren': 'negate', // Legacy
                '📦 Read Variable': 'variable',
                '📱 Variable setzen': 'variable', // Legacy
                '💾 Set Variable (Assign)': 'set_variable', // New Set Variable
                '☁️ Service Call (RPC)': 'service',
                '🧮 Calculate': 'calculate',
                '🧮 Berechnen': 'calculate' // Legacy
            };
            const newType = types[value] || 'property';
            if (this.dialogData.type !== newType) {
                this.dialogData.type = newType;
                this.reloadTypeDefaults();
                this.render();
            }
        }
        if (name === 'TargetObjectSelect' || name === 'CallMethodTargetSelect') {
            this.dialogData.target = value;
            this.dialogData.method = ''; // Reset method on target change
            this.render();
        }
        // Special handler for simplified variable increment
        if (name === 'IncrementVariableInput') {
            this.dialogData.changes = this.dialogData.changes || {};
            this.dialogData.changes['value'] = value !== '' ? Number(value) : 0;
        }
        if (name === 'CallMethodMethodSelect' || name === 'CallMethodMethodInput') {
            this.dialogData.method = value;
            this.render();
        }
        if (name === 'VariableNameInput') {
            if (this.dialogData.type === 'set_variable') {
                this.dialogData.variable = value;
            }
            else {
                this.dialogData.variableName = value;
            }
        }
        if (name === 'SourceObjectSelect') {
            this.dialogData.source = value;
            this.render();
        }
        if (name === 'SourcePropertySelect')
            this.dialogData.sourceProperty = value;
        if (name === 'ActionNameInput')
            this.dialogData.actionName = value;
        if (name === 'TaskNameInput')
            this.dialogData.taskName = value;
        if (name === 'CalcResultVariable')
            this.dialogData.resultVariable = value;
        if (name === 'CalcFormulaInput')
            this.dialogData.formula = value;
        if (name === 'DescriptionInput')
            this.dialogData.description = value;
        if (name === 'SetValueInput')
            this.dialogData.value = value;
        if (name === 'ServiceSelect')
            this.dialogData.serviceName = value;
        if (name === 'MethodSelect')
            this.dialogData.serviceMethod = value;
        if (name === 'CallMethodParamsInput') {
            // Store as array (legacy support)
            this.dialogData.params = value ? [value] : [];
        }
    }
    handleSelectTarget() {
        const selectedValue = this.getInputValue('TargetObjectSelect');
        console.log('[JSONDialogRenderer] handleSelectTarget:', selectedValue);
        if (selectedValue === '📦 Neue Funktionsvariable...') {
            // Prompt for variable name
            const varName = prompt('Name der Funktionsvariable (z.B. targetObj):');
            if (varName && varName.trim()) {
                const cleanName = varName.trim().replace(/\s+/g, '');
                this.dialogData.target = `\${${cleanName}}`;
                console.log('[JSONDialogRenderer] Created function variable target:', this.dialogData.target);
            }
            else {
                // User cancelled - reset to first object or empty
                this.dialogData.target = projectRegistry.getObjects()[0]?.name || '';
            }
            this.render();
        }
        else if (selectedValue?.startsWith('📦 ${')) {
            // Extract the ${varName} from "📦 ${varName}"
            const match = selectedValue.match(/📦 (\$\{[^}]+\})/);
            if (match) {
                this.dialogData.target = match[1];
                console.log('[JSONDialogRenderer] Selected existing function variable:', this.dialogData.target);
            }
        }
        // For regular objects, dialogData.target is already updated by updateModelValue
        // CRITICAL: Re-render to update dependent fields (like PropertySelect options)
        this.render();
    }
    stringifyCalcSteps(steps) {
        if (!steps || !Array.isArray(steps))
            return "";
        let formula = "";
        steps.forEach((step, index) => {
            if (index > 0 && step.operator) {
                formula += ` ${step.operator} `;
            }
            if (step.operandType === 'variable') {
                formula += step.variable || "0";
            }
            else {
                formula += step.constant !== undefined ? step.constant : "0";
            }
        });
        return formula;
    }
    close(action) {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.onResult({
            action,
            data: this.dialogData
        });
    }
    findVariable(objectName) {
        if (!objectName)
            return null;
        console.log(`[JSONDialogRenderer] findVariable looking for: "${objectName}"`);
        // Robust lookup:
        // 1. Exact match in enrichedProject
        let allVars = this.enrichedProject?.variables || [];
        let variable = allVars.find(v => v.name === objectName);
        if (variable)
            console.log(`[JSONDialogRenderer] -> Found exact match in enrichedProject:`, variable);
        // 2. Normalized match (remove emojis, trim, case-insensitive)
        if (!variable) {
            const cleanName = objectName.replace(/[^\w]/g, '').toLowerCase();
            variable = allVars.find(v => (v.name || '').replace(/[^\w]/g, '').toLowerCase() === cleanName);
            if (variable)
                console.log(`[JSONDialogRenderer] -> Found normalized match in enrichedProject:`, variable);
        }
        // 3. Fallback to Registry (full lookup)
        if (!variable) {
            const regVars = projectRegistry.getVariables({
                taskName: this.dialogData.taskName,
                actionId: this.dialogData.actionId || this.dialogData.name
            });
            console.log(`[JSONDialogRenderer] -> Registry variables for context:`, regVars.length);
            variable = regVars.find(v => v.name === objectName);
            if (variable)
                console.log(`[JSONDialogRenderer] -> Found exact match in Registry:`, variable);
            if (!variable) {
                const cleanName = objectName.replace(/[^\w]/g, '').toLowerCase();
                variable = regVars.find(v => (v.name || '').replace(/[^\w]/g, '').toLowerCase() === cleanName);
                if (variable)
                    console.log(`[JSONDialogRenderer] -> Found normalized match in Registry:`, variable);
            }
        }
        if (!variable) {
            // Not found as variable. This is normal if it is an object/component.
            // console.warn(`[JSONDialogRenderer] -> FAILED to find variable "${objectName}" in any source!`);
        }
        return variable;
    }
    getPropertiesForObject(objectName) {
        const variable = this.findVariable(objectName);
        console.log(`[JSONDialogRenderer] getProperties for "${objectName}":`, {
            found: !!variable,
            type: variable?.type,
            fullVariable: variable
        });
        if (variable) {
            const props = ["value"];
            const vt = (variable.type || '').toLowerCase();
            // 1. Timer Properties
            if (vt.includes('timer') || variable.duration !== undefined) {
                props.push("duration", "currentTime", "onFinish", "onTick", "onFinished");
            }
            // 2. Threshold Properties
            if (vt.includes('threshold') || variable.threshold !== undefined) {
                props.push("threshold", "onThresholdReached", "onThresholdLeft", "onThresholdExceeded");
            }
            // 3. Trigger Properties
            if (vt.includes('trigger') || variable.triggerValue !== undefined) {
                props.push("triggerValue", "onTriggerEnter", "onTriggerExit");
            }
            // 4. Numeric / Random / Range
            if (vt.includes('range') || vt.includes('random') || variable.min !== undefined || variable.max !== undefined) {
                props.push("min", "max");
            }
            if (vt.includes('random') || variable.isRandom) {
                props.push("isRandom", "isInteger", "onGenerated");
            }
            // 5. List / Object List
            if (vt.includes('list')) {
                props.push("onItemAdded", "onItemRemoved", "count", "isEmpty");
                if (vt.includes('object') || variable.searchProperty !== undefined) {
                    props.push("searchProperty", "searchValue", "onContains", "onNotContains");
                }
            }
            const uniqueProps = Array.from(new Set(props));
            console.log(`[JSONDialogRenderer] -> Resolved properties for variable "${objectName}":`, uniqueProps);
            return uniqueProps;
        }
        const objects = projectRegistry.getObjects();
        const objData = objects.find(o => o.name === objectName);
        if (!objData)
            return ["x", "y", "width", "height", "caption", "text", "style.visible"];
        try {
            const hydrated = hydrateObjects([objData]);
            if (hydrated.length > 0) {
                const hProps = hydrated[0].getInspectorProperties().map((p) => {
                    if (typeof p === 'string')
                        return p;
                    return p.name;
                });
                return Array.from(new Set(["x", "y", "width", "height", "visible", ...hProps]));
            }
        }
        catch (e) {
            console.warn(`[JSONDialogRenderer] Failed to hydrate ${objectName} for properties`, e);
        }
        return ["x", "y", "width", "height", "caption", "text", "style.visible"];
    }
    /**
     * Returns a list of callable methods for a given object name.
     * Uses a predefined mapping per component type.
     */
    getMethodsForObject(objectName) {
        const variable = this.findVariable(objectName);
        if (variable) {
            const methods = ["reset"];
            const vt = (variable.type || '').toLowerCase(); // Normalize
            // 1. Timer Methods
            if (vt.includes('timer') || variable.duration !== undefined) {
                methods.push("start", "stop");
            }
            // 2. Random Methods
            if (vt.includes('random') || variable.isRandom) {
                methods.push("roll");
            }
            // 3. List Methods
            if (vt.includes('list')) {
                methods.push("add", "remove", "clear", "contains", "sort");
            }
            return Array.from(new Set(methods));
        }
        const objects = projectRegistry.getObjects();
        const objData = objects.find(o => o.name === objectName);
        if (!objData) {
            console.warn(`[JSONDialogRenderer] getMethods: Object "${objectName}" not found in current stage (Objects: ${objects.length}).`);
            return [];
        }
        const className = objData.className || 'TComponent';
        // Mapping of component types to their callable methods
        const methodMap = {
            'TNumberLabel': ['incValue', 'decValue', 'reset'],
            'TToast': ['info', 'success', 'warning', 'error', 'clear'],
            'TTimer': ['timerStart', 'timerStop', 'reset'],
            'TRepeater': ['start', 'stop', 'reset'],
            'TGameLoop': ['start', 'stop', 'pause', 'resume'],
            'TGameState': ['setState', 'reset'],
            'TSprite': ['moveTo', 'setVelocity', 'stop', 'reset'],
            'TButton': ['click', 'enable', 'disable', 'moveTo'],
            'TLabel': ['setText', 'moveTo'],
            'TEdit': ['setText', 'clear', 'focus', 'moveTo'],
            'TPanel': ['show', 'hide', 'toggle', 'moveTo'],
            'TImage': ['setSrc', 'show', 'hide', 'moveTo'],
            'TVideo': ['play', 'pause', 'stop', 'setSrc', 'moveTo'],
            'TAudio': ['play', 'pause', 'stop', 'setSrc'],
            'TGameServer': ['connect', 'disconnect', 'createRoom', 'joinRoom', 'leaveRoom', 'sendMessage'],
            'TGameCard': ['flip', 'reset', 'moveTo'],
            'TInputController': ['enable', 'disable'],
            'TStatusBar': ['setSection', 'show', 'hide', 'moveTo'],
            'TWindow': ['open', 'close', 'toggle', 'moveTo'],
            'TTabControl': ['selectTab'],
            'TStageController': ['goToStage', 'goToMainStage', 'goToFirstStage', 'nextStage', 'previousStage'],
        };
        return methodMap[className] || [];
    }
}
