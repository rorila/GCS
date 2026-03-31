import { actionRegistry } from '../runtime/ActionRegistry';
import { Logger } from '../utils/Logger';
import { ReactiveRuntime } from '../runtime/ReactiveRuntime';
import { GameProject } from '../model/types';
import { serviceRegistry } from '../services/ServiceRegistry';
import { projectRegistry } from '../services/ProjectRegistry';
import { IDialogContext } from './dialogs/IDialogContext';
import { DialogDOMBuilder } from './dialogs/renderers/DialogDOMBuilder';

import { DialogStateManager } from './dialogs/handlers/DialogStateManager';
import { DialogExpressionEvaluator } from './dialogs/utils/DialogExpressionEvaluator';
import { DialogDomainHelper } from './dialogs/utils/DialogDomainHelper';

const logger = Logger.get('JSONDialogRenderer', 'Inspector_Update');

export interface IActionEditorDialogManager {
    showDialog(name: string, modal: boolean, data: any): Promise<any>;
}

/**
 * JSONDialogRenderer - Renders dialogs from JSON definitions
 * Uses modular handlers and renderers for clean architecture
 */
export class JSONDialogRenderer implements IDialogContext {
    private runtime: ReactiveRuntime;
    public overlay: HTMLElement;
    public dialogWindow: HTMLElement;
    public dialogData: any;
    public project: GameProject;
    public dialogDef: any;
    private onResult: (result: { action: string; data: any }) => void;
    public dialogManager?: IActionEditorDialogManager;
    private isCollectingData: boolean = false;
    public enrichedProject: GameProject;

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

        // Initialize dialogData
        this.dialogData = { ...dialogData };
        delete this.dialogData._formValues;
        this.dialogData._formValues = {};

        if (this.dialogData.type === undefined) this.dialogData.type = 'property';
        if (this.dialogData.target === undefined) this.dialogData.target = projectRegistry.getObjects()[0]?.name || '';
        if (this.dialogData.changes === undefined) this.dialogData.changes = {};

        this.runtime.registerVariable('dialogData', this.dialogData);
        this.runtime.registerVariable('serviceRegistry', serviceRegistry);

        const stageObjects = projectRegistry.getObjects();
        const stageVars = projectRegistry.getVariables({
            taskName: this.dialogData.taskName,
            actionId: this.dialogData.actionId || this.dialogData.name
        });

        this.enrichedProject = {
            ...this.project,
            objects: stageObjects.length > 0 ? stageObjects : (this.project.objects || []),
            variables: stageVars.length > 0 ? stageVars : (this.project.variables || [])
        } as GameProject;

        this.runtime.registerVariable('project', this.enrichedProject);
        this.runtime.registerVariable('taskName', dialogData.taskName || '');
        this.runtime.registerVariable('actionName', dialogData.actionName || '');
        this.runtime.registerVariable('getProperties', (name: string) => this.getPropertiesForObject(name));
        this.runtime.registerVariable('getMethods', (name: string) => this.getMethodsForObject(name));
        this.runtime.registerVariable('getMethodSignature', (target: string, method: string) => this.getMethodSignature(target, method));
        this.runtime.registerVariable('getStageOptions', () => {
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

        this.overlay = document.createElement('div');
        this.overlay.className = 'task-editor-overlay';
        this.overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;
        `;

        this.dialogWindow = document.createElement('div');
        this.dialogWindow.className = 'task-editor-window';
        this.dialogWindow.style.cssText = `
            background: #1e1e1e; border-radius: 8px; width: ${this.dialogDef.width || 600}px;
            max-height: ${this.dialogDef.height || 700}px; display: flex; flex-direction: column;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;

        this.overlay.appendChild(this.dialogWindow);
        document.body.appendChild(this.overlay);

        this.render();
    }

    public render() {
        const scrollMap = new Map<string, number>();
        this.dialogWindow.querySelectorAll('*').forEach((el, idx) => {
            if (el.scrollTop > 0) {
                const key = el.getAttribute('data-scroll-key') || `${el.tagName}_${el.className}_${idx}`;
                scrollMap.set(key, el.scrollTop);
            }
        });

        this.dialogWindow.innerHTML = '';
        this.dialogWindow.appendChild(DialogDOMBuilder.createHeader(this));
        this.dialogWindow.appendChild(DialogDOMBuilder.createBody(this));
        this.dialogWindow.appendChild(DialogDOMBuilder.createFooter(this));

        if (scrollMap.size > 0) {
            requestAnimationFrame(() => {
                this.dialogWindow.querySelectorAll('*').forEach((el, idx) => {
                    const key = el.getAttribute('data-scroll-key') || `${el.tagName}_${el.className}_${idx}`;
                    if (scrollMap.has(key)) el.scrollTop = scrollMap.get(key)!;
                });
            });
        }
    }

    public close(action: string) {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.onResult({ action, data: this.dialogData });
    }

    public updateModelValue(name: string, value: any) {
        this.dialogData._formValues = this.dialogData._formValues || {};
        this.dialogData._formValues[name] = value;

        const actionProps = [
            'type', 'name', 'description', 'target', 'method', 'params',
            'variableName', 'source', 'sourceProperty', 'value', 'formula',
            'service', 'serviceParams', 'resultVariable', 'eventName',
            'eventData', 'stageId', 'sync'
        ];

        if (name in this.dialogData || actionProps.includes(name)) {
            this.dialogData[name] = value;
        }

        if (name === 'NameInput' || name === 'ActionNameInput') this.dialogData.name = value;
        if (name === 'DescriptionInput') this.dialogData.description = value;
        if (name === 'TaskNameInput') this.dialogData.taskName = value;
        if (name === 'CalcResultVariable' || name === 'ResultVariableInput') this.dialogData.resultVariable = value;
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
                this.dialogData.type = newType;
                this.reloadTypeDefaults();
                if (!this.isCollectingData) this.render();
            }
        }

        if (name === 'IncrementVariableInput') {
            this.dialogData.changes = this.dialogData.changes || {};
            this.dialogData.changes['value'] = value !== '' ? Number(value) : 1;
        }

        if (['target', 'ServiceSelect', 'service', 'method', 'ActionTypeSelect', 'VariableNameInput'].includes(name)) {
            if (!this.isCollectingData) this.render();
        }
    }

    public reloadTypeDefaults() {
        const type = this.dialogData.type;
        this.cleanupActionFields(type);

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
            if (!this.dialogData.formula && this.dialogData.calcSteps.length > 0) {
                this.dialogData.formula = this.stringifyCalcSteps(this.dialogData.calcSteps);
            }
        } else if (type === 'property' || type === 'increment' || type === 'negate') {
            this.dialogData.target = this.dialogData.target || (projectRegistry.getObjects()[0]?.name || '');
            this.dialogData.changes = this.dialogData.changes || {};
        }
    }

    public cleanupActionFields(type: string) {
        if (!this.dialogData) return;

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

        Object.keys(this.dialogData).forEach(key => {
            if (!allowed.includes(key) && !key.startsWith('_')) {
                delete this.dialogData[key];
            }
        });
    }

    public getInputValue(name: string): string | undefined {
        return DialogStateManager.getInputValue(this, name);
    }
    
    public collectFormData() {
        DialogStateManager.collectFormData(this);
    }

    public evaluateExpression(expr: any, fallback?: any): any {
        return DialogExpressionEvaluator.evaluateExpression(this, expr, fallback);
    }

    public stringifyCalcSteps(steps: any[]): string {
        return DialogStateManager.stringifyCalcSteps(steps);
    }

    public getPropertiesForObject(name: string): string[] {
        return DialogDomainHelper.getPropertiesForObject(this, name);
    }

    public getMethodsForObject(name: string): string[] {
        return DialogDomainHelper.getMethodsForObject(this, name);
    }

    public getMethodSignature(target: string, method: string): any[] {
        return DialogDomainHelper.getMethodSignature(target, method);
    }

    public getIsCollectingData() { return this.isCollectingData; }
    public setIsCollectingData(val: boolean) { this.isCollectingData = val; }
}
