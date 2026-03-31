import { actionRegistry } from '../runtime/ActionRegistry';
import { Logger } from '../utils/Logger';
import { DialogComponentFactory } from './DialogComponentFactory';
import { ActionParamRenderer } from './ActionParamRenderer';
import { ReactiveRuntime } from '../runtime/ReactiveRuntime';
import { GameProject } from '../model/types';
import { serviceRegistry } from '../services/ServiceRegistry';
import { hydrateObjects } from '../utils/Serialization';
import { imageService } from '../services/ImageService';
import { MethodRegistry } from './MethodRegistry';
import { projectRegistry } from '../services/ProjectRegistry';

const logger = Logger.get('JSONDialogRenderer', 'Inspector_Update');
export interface IActionEditorDialogManager {
    showDialog(name: string, modal: boolean, data: any): Promise<any>;
}

/**
 * JSONDialogRenderer - Renders dialogs from JSON definitions
 * Similar to InspectorHost but for modal dialogs
 */
export class JSONDialogRenderer {
    private runtime: ReactiveRuntime;
    private overlay: HTMLElement;
    private dialogWindow: HTMLElement;
    private dialogData: any;
    private project: GameProject;
    private dialogDef: any;
    private onResult: (result: { action: string; data: any }) => void;
    private dialogManager?: IActionEditorDialogManager;
    private isCollectingData: boolean = false; // Guard to prevent re-renders during form collection
    private enrichedProject: GameProject;  // Project with stage objects for expressions

    constructor(
        dialogDef: any,
        dialogData: any,
        project: GameProject,
        onResult: (result: { action: string; data: any }) => void,
        dialogManager?: IActionEditorDialogManager
    ) {
        logger.info(`Initializing for: ${dialogDef.title}`);
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

        logger.debug(`Enrichment: Found ${stageObjects.length} objects and ${stageVars.length} variables in Registry.`);

        const enrichedProject = {
            ...this.project,
            objects: stageObjects.length > 0 ? stageObjects : (this.project.objects || []),
            variables: stageVars.length > 0 ? stageVars : (this.project.variables || [])
        };
        this.enrichedProject = enrichedProject as GameProject;
        this.runtime.registerVariable('project', this.enrichedProject);

        this.runtime.registerVariable('taskName', dialogData.taskName || '');
        this.runtime.registerVariable('actionName', dialogData.actionName || '');
        this.runtime.registerVariable('getProperties', (name: string) => this.getPropertiesForObject(name));
        this.runtime.registerVariable('getMethods', (name: string) => this.getMethodsForObject(name));
        this.runtime.registerVariable('getMethodSignature', (target: string, method: string) => this.getMethodSignature(target, method));
        this.runtime.registerVariable('getStageOptions', () => {
            // BUGFIX: project.stages statt enrichedProject.stages nutzen,
            // da enrichedProject ein Snapshot ist und neue Stages fehlen können
            return (this.project.stages || []).map(s => ({ value: s.id, label: s.name || s.id }));
        });
        this.runtime.registerVariable('getAllActionTypes', () => {
            const registered = actionRegistry.getVisibleActionTypes(this.enrichedProject);
            if (registered.length > 0) return registered;

            return [
                { value: 'property', label: '📝 Property Change (Set)' },
                { value: 'increment', label: '➕ Increment (Add)' },
                { value: 'variable', label: '📦 Read Variable' },
                { value: 'service', label: '🔌 Call Service' },
                { value: 'calculate', label: '🧮 Calculate' }
            ];
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

    private render() {
        // Save scroll positions using a more robust key (either data-scroll-key or tag+class+index)
        const scrollMap = new Map<string, number>();
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
                        el.scrollTop = scrollMap.get(key)!;
                    }
                });
            });
        }

        // Setup bindings
        this.setupBindings();
    }

    private createHeader(): HTMLElement {
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

    private createBody(): HTMLElement {
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
            this.dialogDef.objects.forEach((obj: any) => {
                const el = this.renderObject(obj);
                if (el) body.appendChild(el);
            });
        }

        return body;
    }

    private createFooter(): HTMLElement {
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
            this.dialogDef.footer.forEach((obj: any) => {
                const el = this.renderObject(obj);
                if (el) footer.appendChild(el);
            });
        }

        return footer;
    }

    private renderObject(obj: any): HTMLElement | null {
        try {
            // Check visibility
            if (obj.visible !== undefined) {
                const isVisible = this.evaluateExpression(obj.visible);
                if (!isVisible) return null;
            }

            const className = obj.className;

            if (className === 'TForEach') {
                return this.renderForEach(obj);
            }

            if (className === 'TActionParams') {
                return this.renderActionParams(obj);
            }

            return DialogComponentFactory.createComponent(obj, {
                dialogData: this.dialogData,
                evaluateExpression: (expr) => this.evaluateExpression(expr),
                handleAction: (action, data) => this.handleAction(action, data),
                updateModelValue: (name, value) => this.updateModelValue(name, value),
                renderObject: (o) => this.renderObject(o)
            });
        } catch (e: any) {
            logger.error('Error rendering object:', obj, e);
            const errEl = document.createElement('div');
            errEl.style.color = 'red';
            errEl.innerText = `Error rendering ${obj.className || 'object'}: ${e.message}`;
            return errEl;
        }
    }

    private renderActionParams(_obj: any): HTMLElement | null {
        return ActionParamRenderer.render({
            dialogData: this.dialogData,
            project: this.project,
            enrichedProject: this.enrichedProject,
            evaluateExpression: (expr) => this.evaluateExpression(expr),
            getMethodSignature: (target, method) => this.getMethodSignature(target, method),
            render: () => this.render(),
            onUpdate: (name, value) => this.updateModelValue(name, value)
        });
    }

    private renderForEach(obj: any): HTMLElement | null {
        const container = document.createElement('div');
        container.className = 'foreach-container';
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.width = '100%';

        const sourceData = this.evaluateExpression(obj.source);
        if (!sourceData) return null;

        let items: any[] = [];
        if (Array.isArray(sourceData)) {
            items = sourceData;
        } else if (typeof sourceData === 'object' && sourceData !== null) {
            items = Object.entries(sourceData); // Key-value pairs as [key, value]
        }

        // Apply filter if specified
        if (obj.filter && items.length > 0) {
            items = items.filter((item: any) => {
                try {
                    // Include item and usual scope variables in filter context
                    const fn = new Function('item', 'dialogData', 'project', 'taskName', 'actionName', 'name', 'serviceRegistry', 'getProperties', 'getMethods', `return ${obj.filter}`);
                    return fn(item, this.dialogData, this.project, this.dialogData.taskName, this.dialogData.actionName, this.dialogData.name, serviceRegistry, (name: string) => this.getPropertiesForObject(name), (name: string) => this.getMethodsForObject(name));
                } catch (e) {
                    logger.error(`[JSONDialogRenderer] Filter evaluation error: ${obj.filter}`, e);
                    return true;
                }
            });
        }

        items.forEach((item: any, index: number) => {
            obj.template.forEach((templateObj: any) => {
                const instance = JSON.parse(JSON.stringify(templateObj));
                this.replaceTemplateVars(instance, item, index);

                const el = this.renderObject(instance);
                if (el) container.appendChild(el);
            });
        });

        return container;
    }

    private replaceTemplateVars(obj: any, item: any, index: number) {
        const replace = (target: any): any => {
            if (typeof target === 'string') {
                // Check if string contains template variables
                if (!target.includes('${')) return target;

                // Check if the ENTIRE string is a single template expression that should return an object/array directly
                // e.g. "${item.options}" or "${getMethodSignature(...)}"
                const fullMatch = target.match(/^\$\{([^}]+)\}$/);
                if (fullMatch) {
                    try {
                        const code = fullMatch[1];
                        const fn = new Function('item', 'index', 'dialogData', 'project', 'serviceRegistry', 'getProperties', 'getMethods', 'getMethodSignature', 'getStageOptions', `return ${code}`);
                        return fn(
                            item,
                            index,
                            this.dialogData,
                            this.enrichedProject,
                            serviceRegistry,
                            (name: string) => this.getPropertiesForObject(name),
                            (name: string) => this.getMethodsForObject(name),
                            (target: string, method: string) => this.getMethodSignature(target, method),
                            () => (this.enrichedProject.stages || []).map(s => ({ value: s.id, label: s.name || s.id }))
                        );
                    } catch (e) {
                        // Fallback to string replacement if evaluation fails
                        logger.warn(`[JSONDialogRenderer] Failed to evaluate full template "${target}":`, e);
                    }
                }

                // Standard string interpolation for mixed content (e.g. "Value: ${item.val}")
                return target.replace(/\${([^}]+)}/g, (match, code) => {
                    try {
                        const fn = new Function('item', 'index', 'dialogData', 'project', 'serviceRegistry', 'getProperties', 'getMethods', 'getMethodSignature', 'getStageOptions', `return \`${code}\``);
                        const result = fn(
                            item,
                            index,
                            this.dialogData,
                            this.enrichedProject,
                            serviceRegistry,
                            (name: string) => this.getPropertiesForObject(name),
                            (name: string) => this.getMethodsForObject(name),
                            (target: string, method: string) => this.getMethodSignature(target, method),
                            () => (this.enrichedProject.stages || []).map(s => ({ value: s.id, label: s.name || s.id }))
                        );
                        return result !== undefined ? String(result) : '';
                    } catch (e) {
                        logger.warn(`[JSONDialogRenderer] Failed to evaluate template part "${match}":`, e);
                        return match;
                    }
                });

            } else if (typeof target === 'object' && target !== null) {
                // Return new object to avoid modifying original template items
                const newObj = Array.isArray(target) ? [] : {};
                Object.keys(target).forEach(key => {
                    (newObj as any)[key] = replace(target[key]);
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

    private evaluateExpression(expr: any, fallback: any = undefined): any {
        if (typeof expr !== 'string' || !expr.includes('${')) {
            return expr === undefined ? fallback : expr;
        }

        const code = expr.startsWith('${') && expr.endsWith('}')
            ? expr.substring(2, expr.length - 1)
            : `\`${expr.replace(/`/g, '\\`').replace(/\$\{/g, '${')}\``;

        try {
            const fn = new Function('dialogData', 'project', 'taskName', 'actionName', 'name', 'serviceRegistry', 'getProperties', 'getMethods', 'getMethodSignature', 'getStageOptions', `return ${code}`);
            const result = fn(
                this.dialogData,
                this.enrichedProject,
                this.dialogData.taskName,
                this.dialogData.actionName || this.dialogData.name,
                this.dialogData.name,
                serviceRegistry,
                (name: string) => this.getPropertiesForObject(name),
                (name: string) => this.getMethodsForObject(name),
                (target: string, method: string) => this.getMethodSignature(target, method),
                () => (this.enrichedProject.stages || []).map(s => ({ value: s.id, label: s.name || s.id }))
            );

            return result;
        } catch (e) {
            logger.warn(`[JSONDialogRenderer] Expression evaluation failed: "${expr}"`, e);
            return fallback !== undefined ? fallback : expr;
        }
    }

    private getMethodSignature(_targetName: string, methodName: string): any[] {
        if (!methodName) return [];
        // Fallback for no target (generic) or unknown target

        // Lookup in Registry
        const signature = MethodRegistry[methodName];
        logger.info(`[JSONDialogRenderer] getMethodSignature('${_targetName}', '${methodName}'):`, signature);
        if (signature) {
            return signature;
        }

        // Default generic param if unknown
        return [{ name: 'params', type: 'string', label: 'Parameter', isGeneric: true }];
    }

    private evaluateActionData(data: any): any {
        if (!data || typeof data !== 'object') return data;
        const result: any = Array.isArray(data) ? [] : {};
        for (const [key, value] of Object.entries(data)) {
            result[key] = typeof value === 'string' ? this.evaluateExpression(value) : value;
        }
        return result;
    }

    private handleAction(action: string, rawActionData?: any) {
        const actionData = this.evaluateActionData(rawActionData);
        logger.info('[JSONDialogRenderer] Action:', action, actionData);

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
                // Sync type from dropdown first
                const typeVal = this.getInputValue('ActionTypeSelect');
                if (typeVal) {
                    this.updateModelValue('ActionTypeSelect', typeVal);
                }
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
                    this.updateModelValue(actionData.field, this.getInputValue(actionData.input));
                    this.render();
                }
                break;

            case 'insertVariableToField':
                if (actionData && actionData.field) {
                    const sourceElement = actionData.input || 'VariableNameSelect';
                    const varName = this.getInputValue(sourceElement);
                    logger.info(`[JSONDialogRenderer] insertVariableToField: field="${actionData.field}", source="${sourceElement}", value="${varName}"`);
                    if (varName && !varName.includes('wählen')) {
                        this.insertVariableToField(actionData.field, varName);
                    } else if (!varName) {
                        logger.warn(`[JSONDialogRenderer] -> Could NOT find value for source element "${sourceElement}"`);
                    }
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
                        } else {
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
                logger.info('[JSONDialogRenderer] Marking image:', actionData.path);
                this.dialogData.selectedPath = actionData.path;
                this.render();
                break;

            case 'selectImage':
                logger.info('[JSONDialogRenderer] selectImage called. Current selectedPath:', this.dialogData.selectedPath, 'actionData:', actionData);
                if (actionData && actionData.path) {
                    this.dialogData.selectedPath = actionData.path;
                }
                if (this.dialogData.selectedPath) {
                    logger.info('[JSONDialogRenderer] Closing with selection:', this.dialogData.selectedPath);
                    this.close('select');
                } else {
                    alert('Bitte wähle zuerst ein Bild aus.');
                }
                break;

            default:
                logger.warn('[JSONDialogRenderer] Unknown action:', action);
        }
    }

    private moveSequenceItem(index: number, direction: 'up' | 'down') {
        const list = this.dialogData.actionSequence;
        if (!list) return;

        if (direction === 'up' && index > 0) {
            [list[index - 1], list[index]] = [list[index], list[index - 1]];
            this.render();
        } else if (direction === 'down' && index < list.length - 1) {
            [list[index], list[index + 1]] = [list[index + 1], list[index]];
            this.render();
        }
    }

    private deleteSequenceItem(index: number) {
        const list = this.dialogData.actionSequence;
        if (list) {
            list.splice(index, 1);
            this.render();
        }
    }

    private addAction() {
        const actionName = this.getInputValue('ActionSelect')?.split(' ')[0]; // Extract name from "Name (Target)"
        if (actionName) {
            this.dialogData.actionSequence = this.dialogData.actionSequence || [];
            this.dialogData.actionSequence.push({ type: 'action', name: actionName });
            this.render();
        }
    }

    private addTaskCall() {
        const taskName = this.getInputValue('TaskSelect')?.replace('🔗 ', '');
        if (taskName) {
            this.dialogData.actionSequence = this.dialogData.actionSequence || [];
            this.dialogData.actionSequence.push({ type: 'task', name: taskName });
            this.render();
        }
    }

    private addVariable() {
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

        this.project.variables.push({ name: name!, type: 'string', scope: 'global', defaultValue: value || '' });
        this.render();
    }

    private toggleVariable(name: string) {
        if (!name) return;

        this.dialogData.usedVariables = this.dialogData.usedVariables || [];
        const idx = this.dialogData.usedVariables.indexOf(name);

        if (idx === -1) {
            this.dialogData.usedVariables.push(name);
        } else {
            this.dialogData.usedVariables.splice(idx, 1);
        }
        // Force re-render to update checkboxes
        this.render();
    }

    private cleanupActionFields(type: string) {
        if (!this.dialogData) return;

        // Fields that should be KEPT for all types 
        const baseFields = ['type', 'name', 'description', 'details', 'showDetails', 'sync', 'taskParams', 'actionName', 'taskName'];

        const allowedFieldsMap: Record<string, string[]> = {
            'property': ['target', 'changes'],
            'increment': ['target', 'changes'],
            'negate': ['target', 'changes'],
            'call_method': ['target', 'method', 'params'],
            'variable': ['variableName', 'source', 'sourceProperty'],
            'set_variable': ['variableName', 'value', 'source', 'sourceProperty'],
            'service': ['service', 'method', 'serviceParams', 'resultVariable'],
            'broadcast': ['eventName', 'eventData'],
            'navigate_stage': ['stageId', 'params'],
            'calculate': ['resultVariable', 'formula', 'calcSteps']
        };

        const allowed = [...baseFields, ...(allowedFieldsMap[type] || [])];
        logger.info(`[JSONDialogRenderer] cleanupActionFields for type "${type}". Allowed:`, allowed);

        // Clean up
        Object.keys(this.dialogData).forEach(key => {
            if (!allowed.includes(key) && !key.startsWith('_')) {
                logger.info(`[JSONDialogRenderer] -> CLEANUP: Deleting field "${key}" (not allowed for type ${type})`);
                delete this.dialogData[key];
            } else if (!key.startsWith('_')) {
                logger.info(`[JSONDialogRenderer] -> CLEANUP: Keeping field "${key}"`);
            }
        });
    }

    private reloadTypeDefaults() {
        // We allow reload even during isCollectingData if it's called explicitly (but usually it's from UI)
        const type = this.dialogData.type;
        this.cleanupActionFields(type);

        // Reset/init fields based on type
        if (type === 'variable') {
            this.dialogData.variableName = this.dialogData.variableName || '';
            this.dialogData.source = this.dialogData.source || (projectRegistry.getObjects()[0]?.name || '');
            this.dialogData.sourceProperty = this.dialogData.sourceProperty || 'text';
        } else if (type === 'set_variable') {
            this.dialogData.variableName = this.dialogData.variableName || '';
            this.dialogData.value = this.dialogData.value !== undefined ? this.dialogData.value : '';
        } else if (type === 'call_method') {
            this.dialogData.target = this.dialogData.target || (projectRegistry.getObjects()[0]?.name || '');
            this.dialogData.method = this.dialogData.method || '';
            this.dialogData.params = this.dialogData.params || [];
        } else if (type === 'calculate') {
            this.dialogData.resultVariable = this.dialogData.resultVariable || '';
            this.dialogData.calcSteps = this.dialogData.calcSteps || [];

            // Generate formula string if missing
            if (!this.dialogData.formula && this.dialogData.calcSteps.length > 0) {
                this.dialogData.formula = this.stringifyCalcSteps(this.dialogData.calcSteps);
            }
        } else if (type === 'property' || type === 'increment' || type === 'negate') {
            this.dialogData.target = this.dialogData.target || (projectRegistry.getObjects()[0]?.name || '');
            this.dialogData.changes = this.dialogData.changes || {};
        }
    }

    private applyPropertyChange(prop: string, val: any) {
        logger.info(`[JSONDialogRenderer] applyPropertyChange: property="${prop}", value="${val}" (type: ${typeof val})`);
        if (!prop) return;

        let finalValue = val;

        // Type inference for simple strings
        if (typeof val === 'string' && !val.includes('${')) {
            const trimmed = val.trim();
            if (trimmed === 'true') finalValue = true;
            else if (trimmed === 'false') finalValue = false;
            else if (trimmed !== '' && !isNaN(Number(trimmed)) && !trimmed.startsWith('#')) {
                finalValue = Number(trimmed);
            }
        }

        this.dialogData.changes = this.dialogData.changes || {};
        this.dialogData.changes[prop] = finalValue;
    }

    private addPropertyChange() {
        // Explicitly get current values from inputs to ensure we have the latest
        const prop = this.getInputValue('PropertySelect');
        const val = this.getInputValue('PropertyValueInput');

        logger.info(`[JSONDialogRenderer] addPropertyChange button clicked:`, { prop, val });

        if (!prop) {
            logger.warn('[JSONDialogRenderer] addPropertyChange - no property selected!');
            return;
        }

        this.applyPropertyChange(prop, val);

        logger.info(`[JSONDialogRenderer] Current changes after add:`, this.dialogData.changes);

        // Clear input value for next addition
        this.dialogData._formValues = this.dialogData._formValues || {};
        this.dialogData._formValues['PropertyValueInput'] = '';
        const input = this.dialogWindow.querySelector('[data-name="PropertyValueInput"]') as HTMLInputElement;
        if (input) input.value = '';

        this.render();
    }

    private insertVariable() {
        const varName = this.getInputValue('VariablePickerSelect');
        if (varName && varName !== '📦 Var') {
            // NEW: More robust approach for insertVariable
            // 1. Check if a target actionData index/name is provided or use default
            const targetInputName = 'PropertyValueInput';
            const input = this.dialogWindow.querySelector(`[data-name="${targetInputName}"]`) as HTMLInputElement;

            if (input) {
                const currentVal = input.value || '';
                input.value = currentVal + `\${${varName}}`;
                // Sync to model
                this.updateModelValue(targetInputName, input.value);
            }

            // Reset picker
            const picker = this.dialogWindow.querySelector('[data-name="VariablePickerSelect"]') as HTMLSelectElement;
            if (picker) picker.selectedIndex = 0;
        }
    }

    private insertVariableToField(fieldName: string, value: string) {
        if (!fieldName || !value) return;

        // Clean value (remove emojis if present)
        const cleanValue = value.replace('📦 ', '').replace('🌎 ', '').replace('🎭 ', '').replace('📚 ', '');

        this.updateModelValue(fieldName, cleanValue);
        this.render();
    }

    private generateActionDetails(action: any): string {
        if (!action) return '(nicht definiert)';

        if (action.type === 'property') {
            const changes = action.changes || {};
            const entries = Object.entries(changes);
            if (entries.length === 0) {
                return action.target ? `${action.target} (keine Änderungen)` : '(property - keine Details)';
            }
            return entries.map(([prop, value]) => `${action.target}.${prop} := ${value}`).join('; ');
        }

        if (action.type === 'variable' || action.type === 'set_variable') {
            const varName = action.variableName || action.variable || '???';
            const value = action.value !== undefined ? action.value : (action.source ? `${action.source}.${action.sourceProperty}` : '???');
            return `${varName} := ${value}`;
        }

        if (action.type === 'service') {
            const result = action.resultVariable ? `${action.resultVariable} := ` : '';
            const params = (action.serviceParams || []).map((p: any) => JSON.stringify(p)).join(', ');
            return `${result}${action.service}.${action.method}(${params})`;
        }

        if (action.type === 'calculate') {
            const result = action.resultVariable ? `${action.resultVariable} := ` : '';
            return `${result}${action.formula || '(Berechnung)'}`;
        }

        if (action.type === 'call_method') {
            const params = action.params ? (Array.isArray(action.params) ? action.params.join(', ') : action.params) : '';
            return `${action.target}.${action.method}(${params})`;
        }

        if (action.type === 'increment') {
            const amount = action.changes?.value !== undefined ? action.changes.value : '1';
            return `${action.target}.value += ${amount}`;
        }

        if (action.type === 'negate') {
            return `${action.target}.value := !${action.target}.value`;
        }

        return `(${action.type})`;
    }

    private collectFormData() {
        this.isCollectingData = true;
        logger.info(`[JSONDialogRenderer] collectFormData starting...`);
        try {
            const namedElements = this.dialogWindow.querySelectorAll('[data-name]');
            namedElements.forEach(el => {
                const name = el.getAttribute('data-name');
                let value: any = (el as HTMLInputElement | HTMLSelectElement).value;

                if (el instanceof HTMLInputElement && (el as HTMLInputElement).type === 'checkbox') {
                    value = (el as HTMLInputElement).checked;
                }

                if (name) {
                    this.updateModelValue(name, value);
                }
            });

            logger.info(`[JSONDialogRenderer] Resulting dialogData:`, JSON.stringify(this.dialogData, null, 2));

            // Re-run cleanup to ensure saved data is clean
            this.cleanupActionFields(this.dialogData.type);

            logger.info(`[JSONDialogRenderer] Resulting dialogData AFTER cleanup:`, JSON.stringify(this.dialogData, null, 2));

            // Regenerate details for visibility in FlowEditor
            this.dialogData.details = this.generateActionDetails(this.dialogData);

        } finally {
            this.isCollectingData = false;
        }

        // Strip internal form values before returning to keep project clean
        delete this.dialogData._formValues;

        // Cleanup simplified UI helper properties if they exist
        delete this.dialogData.IncrementVariableInput;
    }

    private getInputValue(name: string): string | undefined {
        // Find element by name in DOM
        // Updated to use data-name lookup

        // Strategy: Iterate rendered inputs and find match
        // But wait, renderObject doesn't set ID/name on inputs typically.
        // Let's rely on finding by class/structure or modifying renderObject to add data-name

        // Better: Find based on rendered structure which we control

        // FIX: Update renderObject to add data-name attribute
        const el = this.dialogWindow.querySelector(`[data-name="${name}"]`);
        const value = (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) ? el.value : undefined;
        logger.info(`[JSONDialogRenderer] getInputValue("${name}"):`, { found: !!el, value });
        return value;
    }

    private setupBindings() {
        // TODO: Implement reactive bindings similar to InspectorHost. 
        // Currently we rely on manual re-renders via this.render() calls in actions.
    }

    private async handleCreateAction() {
        if (!this.dialogManager) {
            logger.warn('[JSONDialogRenderer] Cannot create action: DialogManager not available');
            return;
        }

        // Create a temporary action stub
        const timestamp = Date.now();
        const actionName = `Action_${timestamp}`;
        const newAction: any = {
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
        } else {
            // Cancelled. Remove it.
            const idx = this.project.actions.indexOf(newAction);
            if (idx !== -1) this.project.actions.splice(idx, 1);
            this.render();
        }
    }

    private updateModelValue(name: string, value: any) {
        // Sync to a central formValues bag for easy collection
        this.dialogData._formValues = this.dialogData._formValues || {};
        this.dialogData._formValues[name] = value;

        logger.debug(`updateModelValue: name="${name}", value="${value}"`);

        // Standard properties list for Actions (Straight Path)
        const actionProps = [
            'type', 'name', 'description', 'target', 'method', 'params',
            'variableName', 'source', 'sourceProperty', 'value', 'formula',
            'service', 'serviceParams', 'resultVariable', 'eventName',
            'eventData', 'stageId', 'sync'
        ];

        // 1. Check if name is a direct property or a known action property
        if (name in this.dialogData || actionProps.includes(name)) {
            logger.info(`[JSONDialogRenderer] -> Setting property "${name}" to:`, value);
            this.dialogData[name] = value;
        } else if (name === 'CalcResultVariableSelect' || name === 'VariableNameSelect' || name === 'ServiceSelect' || name === 'MethodSelect') {
            // These are intermediate UI helpers/selectors - they don't need to be in dialogData directly
            // unless they map to a known property.
            logger.info(`[JSONDialogRenderer] -> intermediate UI component "${name}" changed to "${value}"`);
        } else {
            logger.warn(`[JSONDialogRenderer] -> Field "${name}" is NOT a known property and was NOT set in dialogData.`);
        }

        // 2. Specialized Mappings (UI names that differ from model properties)
        if (name === 'NameInput' || name === 'ActionNameInput') {
            this.dialogData.name = value;
            logger.info(`[JSONDialogRenderer] -> Synced name to: ${value}`);
        }
        if (name === 'DescriptionInput') this.dialogData.description = value;
        if (name === 'TaskNameInput') this.dialogData.taskName = value;
        if (name === 'CalcResultVariable' || name === 'ResultVariableInput') {
            this.dialogData.resultVariable = value;
            logger.info(`[JSONDialogRenderer] -> Synced resultVariable to: ${value}`);
        }
        if (name === 'CalcFormulaInput') this.dialogData.formula = value;

        if (name === 'ActionTypeSelect') {
            const types: Record<string, string> = {
                '📝 Property Change (Set)': 'property',
                '➕ Increment (+1)': 'increment',
                '✖️ Negate (Bool/Num)': 'negate',
                '⚡ Call Method': 'call_method',
                '📂 Read Variable': 'variable',
                '💾 Set Variable (Assign)': 'set_variable',
                '🌐 Server-Aktion': 'service',
                '📣 Broadcast Event': 'broadcast',
                '🚀 Stage wechseln': 'navigate_stage',
                '🧮 Calculate': 'calculate'
            };
            const newType = types[value] || value;

            if (this.dialogData.type !== newType) {
                logger.info(`[JSONDialogRenderer] -> Action Type changed: ${this.dialogData.type} -> ${newType}`);
                this.dialogData.type = newType;
                this.reloadTypeDefaults();
                if (!this.isCollectingData) this.render();
            }
        }

        // Special handler for increment amount in UI
        if (name === 'IncrementVariableInput') {
            this.dialogData.changes = this.dialogData.changes || {};
            this.dialogData.changes['value'] = value !== '' ? Number(value) : 1;
        }

        // Ensure dependent fields re-render
        if (name === 'target' || name === 'ServiceSelect' || name === 'service' || name === 'method' || name === 'ActionTypeSelect' || name === 'VariableNameInput') {
            if (!this.isCollectingData) this.render();
        }
    }

    private handleSelectTarget() {
        const selectedValue = this.getInputValue('TargetObjectSelect');
        logger.info('[JSONDialogRenderer] handleSelectTarget:', selectedValue);

        if (selectedValue === '📦 Neue Funktionsvariable...') {
            // Prompt for variable name
            const varName = prompt('Name der Funktionsvariable (z.B. targetObj):');
            if (varName && varName.trim()) {
                const cleanName = varName.trim().replace(/\s+/g, '');
                this.dialogData.target = `\${${cleanName}}`;
                logger.info('[JSONDialogRenderer] Created function variable target:', this.dialogData.target);
            } else {
                // User cancelled - reset to first object or empty
                this.dialogData.target = projectRegistry.getObjects()[0]?.name || '';
            }
            this.render();
        } else if (selectedValue?.startsWith('📦 ${')) {
            // Extract the ${varName} from "📦 ${varName}"
            const match = selectedValue.match(/📦 (\$\{[^}]+\})/);
            if (match) {
                this.dialogData.target = match[1];
                logger.info('[JSONDialogRenderer] Selected existing function variable:', this.dialogData.target);
            }
        }
        // For regular objects, dialogData.target is already updated by updateModelValue

        // CRITICAL: Re-render to update dependent fields (like PropertySelect options)
        this.render();
    }

    private stringifyCalcSteps(steps: any[]): string {
        if (!steps || !Array.isArray(steps)) return "";
        let formula = "";
        steps.forEach((step, index) => {
            if (index > 0 && step.operator) {
                formula += ` ${step.operator} `;
            }
            if (step.operandType === 'variable') {
                formula += step.variable || "0";
            } else {
                formula += step.constant !== undefined ? step.constant : "0";
            }
        });
        return formula;
    }

    public close(action: string) {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }

        this.onResult({
            action,
            data: this.dialogData
        });
    }

    private findVariable(objectName: string) {
        if (!objectName) return null;

        logger.info(`[JSONDialogRenderer] findVariable looking for: "${objectName}"`);

        // Robust lookup:
        // 1. Exact match in enrichedProject
        let allVars = this.enrichedProject?.variables || [];
        let variable = allVars.find(v => v.name === objectName);
        if (variable) logger.info(`[JSONDialogRenderer] -> Found exact match in enrichedProject:`, variable);

        // 2. Normalized match (remove emojis, trim, case-insensitive)
        if (!variable) {
            const cleanName = objectName.replace(/[^\w]/g, '').toLowerCase();
            variable = allVars.find(v => (v.name || '').replace(/[^\w]/g, '').toLowerCase() === cleanName);
            if (variable) logger.info(`[JSONDialogRenderer] -> Found normalized match in enrichedProject:`, variable);
        }

        // 3. Fallback to Registry (full lookup)
        if (!variable) {
            const regVars = projectRegistry.getVariables({
                taskName: this.dialogData.taskName,
                actionId: this.dialogData.actionId || this.dialogData.name
            });
            logger.info(`[JSONDialogRenderer] -> Registry variables for context:`, regVars.length);

            variable = regVars.find(v => v.name === objectName);
            if (variable) logger.info(`[JSONDialogRenderer] -> Found exact match in Registry:`, variable);

            if (!variable) {
                const cleanName = objectName.replace(/[^\w]/g, '').toLowerCase();
                variable = regVars.find(v => (v.name || '').replace(/[^\w]/g, '').toLowerCase() === cleanName);
                if (variable) logger.info(`[JSONDialogRenderer] -> Found normalized match in Registry:`, variable);
            }
        }

        if (!variable) {
            // Not found as variable. This is normal if it is an object/component.
            // logger.warn(`[JSONDialogRenderer] -> FAILED to find variable "${objectName}" in any source!`);
        }

        return variable;
    }

    private getPropertiesForObject(objectName: string): string[] {
        const variable = this.findVariable(objectName);
        logger.info(`[JSONDialogRenderer] getProperties for "${objectName}":`, {
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
            logger.info(`[JSONDialogRenderer] -> Resolved properties for variable "${objectName}":`, uniqueProps);
            return uniqueProps;
        }

        const objects = projectRegistry.getObjects();
        const objData = objects.find(o => o.name === objectName);
        if (!objData) return ["x", "y", "width", "height", "caption", "text", "style.visible"];

        try {
            const hydrated = hydrateObjects([objData]);
            if (hydrated.length > 0) {
                const hProps = hydrated[0].getInspectorProperties().map((p: any) => {
                    if (typeof p === 'string') return p;
                    return p.name;
                });
                return Array.from(new Set(["x", "y", "width", "height", "visible", ...hProps]));
            }
        } catch (e) {
            logger.warn(`[JSONDialogRenderer] Failed to hydrate ${objectName} for properties`, e);
        }
        return ["x", "y", "width", "height", "caption", "text", "style.visible"];
    }

    /**
     * Returns a list of callable methods for a given object name.
     * Uses a predefined mapping per component type.
     */
    private getMethodsForObject(objectName: string): string[] {
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
            logger.warn(`[JSONDialogRenderer] getMethods: Object "${objectName}" not found in current stage (Objects: ${objects.length}).`);
            return [];
        }

        const className = objData.className || 'TComponent';

        // Mapping of component types to their callable methods
        const methodMap: Record<string, string[]> = {
            'TNumberLabel': ['incValue', 'decValue', 'reset'],
            'TToast': ['info', 'success', 'warning', 'error', 'clear'],
            'TTimer': ['timerStart', 'timerStop', 'reset'],
            'TIntervalTimer': ['start', 'stop', 'reset'],
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
