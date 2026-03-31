import { Logger } from '../../../utils/Logger';
import { IDialogContext } from '../IDialogContext';
import { DialogExpressionEvaluator } from '../utils/DialogExpressionEvaluator';
import { projectRegistry } from '../../../services/ProjectRegistry';
import { imageService } from '../../../services/ImageService';

const logger = Logger.get('JSONDialogRenderer', 'DialogActionHandler');

export class DialogActionHandler {

    public static async handleAction(ctx: IDialogContext, action: string, rawActionData?: any) {
        const actionData = DialogExpressionEvaluator.evaluateActionData(ctx, rawActionData);
        logger.info('[DialogActionHandler] Action:', action, actionData);

        switch (action) {
            case 'save':
                ctx.collectFormData();
                ctx.close('save');
                break;

            case 'cancel':
                ctx.close('cancel');
                break;

            case 'delete':
                ctx.close('delete');
                break;

            case 'moveSequenceItem':
                this.moveSequenceItem(ctx, actionData.index, actionData.direction);
                break;

            case 'deleteSequenceItem':
                this.deleteSequenceItem(ctx, actionData.index);
                break;

            case 'addAction':
                this.addAction(ctx);
                break;

            case 'addTaskCall':
                this.addTaskCall(ctx);
                break;

            case 'addVariable':
                this.addVariable(ctx);
                break;

            case 'toggleVariable':
                this.toggleVariable(ctx, actionData.variableName);
                break;

            case 'changeActionType':
                const typeVal = ctx.getInputValue('ActionTypeSelect');
                if (typeVal) {
                    ctx.updateModelValue('ActionTypeSelect', typeVal);
                }
                ctx.render();
                break;

            case 'addPropertyChange':
                this.addPropertyChange(ctx);
                break;

            case 'deletePropertyChange':
                delete ctx.dialogData.changes[actionData.property];
                ctx.render();
                break;

            case 'insertVariable':
                this.insertVariable(ctx);
                break;

            case 'createAction':
                await this.handleCreateAction(ctx);
                break;

            case 'updateValue':
                if (actionData && actionData.field && actionData.input) {
                    ctx.updateModelValue(actionData.field, ctx.getInputValue(actionData.input));
                    ctx.render();
                }
                break;

            case 'insertVariableToField':
                if (actionData && actionData.field) {
                    const sourceElement = actionData.input || 'VariableNameSelect';
                    const varName = ctx.getInputValue(sourceElement);
                    if (varName && !varName.includes('wählen')) {
                        this.insertVariableToField(ctx, actionData.field, varName);
                    }
                }
                break;

            case 'updateArrayItem':
                if (actionData && actionData.arrayField && actionData.index !== undefined) {
                    const idx = typeof actionData.index === 'string' ? parseInt(actionData.index, 10) : actionData.index;
                    if (!isNaN(idx)) {
                        const arr = ctx.dialogData[actionData.arrayField] || [];
                        const val = ctx.getInputValue(actionData.input);

                        if (actionData.property && typeof arr[idx] === 'object' && arr[idx] !== null) {
                            arr[idx][actionData.property] = val;
                        } else {
                            arr[idx] = val;
                        }

                        ctx.dialogData[actionData.arrayField] = arr;
                        ctx.render();
                    }
                }
                break;

            case 'addArrayItem':
                if (actionData && actionData.arrayField) {
                    const arr = ctx.dialogData[actionData.arrayField] || [];
                    arr.push(actionData.value !== undefined ? actionData.value : '');
                    ctx.dialogData[actionData.arrayField] = arr;
                    ctx.render();
                }
                break;

            case 'deleteArrayItem':
                if (actionData && actionData.arrayField && actionData.index !== undefined) {
                    const idx = typeof actionData.index === 'string' ? parseInt(actionData.index, 10) : actionData.index;
                    if (!isNaN(idx)) {
                        const arr = ctx.dialogData[actionData.arrayField] || [];
                        arr.splice(idx, 1);
                        ctx.dialogData[actionData.arrayField] = arr;
                        ctx.render();
                    }
                }
                break;

            case 'selectTarget':
                this.handleSelectTarget(ctx);
                break;

            case 'refreshImages':
                imageService.listImages().then(images => {
                    ctx.dialogData.images = imageService.flattenImages(images);
                    ctx.render();
                });
                break;

            case 'markImage':
                ctx.dialogData.selectedPath = actionData.path;
                ctx.render();
                break;

            case 'selectImage':
                if (actionData && actionData.path) {
                    ctx.dialogData.selectedPath = actionData.path;
                }
                if (ctx.dialogData.selectedPath) {
                    ctx.close('select');
                } else {
                    alert('Bitte wähle zuerst ein Bild aus.');
                }
                break;

            default:
                logger.warn('[DialogActionHandler] Unknown action:', action);
        }
    }

    private static moveSequenceItem(ctx: IDialogContext, index: number, direction: 'up' | 'down') {
        const list = ctx.dialogData.actionSequence;
        if (!list) return;

        if (direction === 'up' && index > 0) {
            [list[index - 1], list[index]] = [list[index], list[index - 1]];
            ctx.render();
        } else if (direction === 'down' && index < list.length - 1) {
            [list[index], list[index + 1]] = [list[index + 1], list[index]];
            ctx.render();
        }
    }

    private static deleteSequenceItem(ctx: IDialogContext, index: number) {
        const list = ctx.dialogData.actionSequence;
        if (list) {
            list.splice(index, 1);
            ctx.render();
        }
    }

    private static addAction(ctx: IDialogContext) {
        const actionName = ctx.getInputValue('ActionSelect')?.split(' ')[0];
        if (actionName) {
            ctx.dialogData.actionSequence = ctx.dialogData.actionSequence || [];
            ctx.dialogData.actionSequence.push({ type: 'action', name: actionName });
            ctx.render();
        }
    }

    private static addTaskCall(ctx: IDialogContext) {
        const taskName = ctx.getInputValue('TaskSelect')?.replace('🔗 ', '');
        if (taskName) {
            ctx.dialogData.actionSequence = ctx.dialogData.actionSequence || [];
            ctx.dialogData.actionSequence.push({ type: 'task', name: taskName });
            ctx.render();
        }
    }

    private static addVariable(ctx: IDialogContext) {
        const name = ctx.getInputValue('NewVariableNameInput');
        const value = ctx.getInputValue('NewVariableValueInput');

        if (!name) {
            alert('Variable name is required');
            return;
        }

        if (ctx.project.variables.some(v => v.name === name)) {
            alert(`Variable "${name}" already exists!`);
            return;
        }

        ctx.project.variables.push({ name: name!, type: 'string', scope: 'global', defaultValue: value || '' });
        ctx.render();
    }

    private static toggleVariable(ctx: IDialogContext, name: string) {
        if (!name) return;

        ctx.dialogData.usedVariables = ctx.dialogData.usedVariables || [];
        const idx = ctx.dialogData.usedVariables.indexOf(name);

        if (idx === -1) {
            ctx.dialogData.usedVariables.push(name);
        } else {
            ctx.dialogData.usedVariables.splice(idx, 1);
        }
        ctx.render();
    }

    private static applyPropertyChange(ctx: IDialogContext, prop: string, val: any) {
        if (!prop) return;

        let finalValue = val;
        if (typeof val === 'string' && !val.includes('${')) {
            const trimmed = val.trim();
            if (trimmed === 'true') finalValue = true;
            else if (trimmed === 'false') finalValue = false;
            else if (trimmed !== '' && !isNaN(Number(trimmed)) && !trimmed.startsWith('#')) {
                finalValue = Number(trimmed);
            }
        }

        ctx.dialogData.changes = ctx.dialogData.changes || {};
        ctx.dialogData.changes[prop] = finalValue;
    }

    private static addPropertyChange(ctx: IDialogContext) {
        const prop = ctx.getInputValue('PropertySelect');
        const val = ctx.getInputValue('PropertyValueInput');

        if (!prop) return;

        this.applyPropertyChange(ctx, prop, val);

        ctx.dialogData._formValues = ctx.dialogData._formValues || {};
        ctx.dialogData._formValues['PropertyValueInput'] = '';
        const input = ctx.dialogWindow.querySelector('[data-name="PropertyValueInput"]') as HTMLInputElement;
        if (input) input.value = '';

        ctx.render();
    }

    private static insertVariable(ctx: IDialogContext) {
        const varName = ctx.getInputValue('VariablePickerSelect');
        if (varName && varName !== '📦 Var') {
            const targetInputName = 'PropertyValueInput';
            const input = ctx.dialogWindow.querySelector(`[data-name="${targetInputName}"]`) as HTMLInputElement;

            if (input) {
                const currentVal = input.value || '';
                input.value = currentVal + `\${${varName}}`;
                ctx.updateModelValue(targetInputName, input.value);
            }

            const picker = ctx.dialogWindow.querySelector('[data-name="VariablePickerSelect"]') as HTMLSelectElement;
            if (picker) picker.selectedIndex = 0;
        }
    }

    private static insertVariableToField(ctx: IDialogContext, fieldName: string, value: string) {
        if (!fieldName || !value) return;

        const cleanValue = value.replace('📦 ', '').replace('🌎 ', '').replace('🎭 ', '').replace('📚 ', '');
        ctx.updateModelValue(fieldName, cleanValue);
        ctx.render();
    }

    private static async handleCreateAction(ctx: IDialogContext) {
        if (!ctx.dialogManager) {
            logger.warn('[DialogActionHandler] Cannot create action: DialogManager not available');
            return;
        }

        const timestamp = Date.now();
        const actionName = `Action_${timestamp}`;
        const newAction: any = {
            name: actionName,
            type: 'property', 
            target: '',
            changes: {}
        };

        ctx.project.actions = ctx.project.actions || [];
        ctx.project.actions.push(newAction);

        const result = await ctx.dialogManager.showDialog('action_editor', true, newAction);

        if (result && result.action === 'save') {
            ctx.render();
        } else {
            const idx = ctx.project.actions.indexOf(newAction);
            if (idx !== -1) ctx.project.actions.splice(idx, 1);
            ctx.render();
        }
    }

    private static handleSelectTarget(ctx: IDialogContext) {
        const selectedValue = ctx.getInputValue('TargetObjectSelect');

        if (selectedValue === '📦 Neue Funktionsvariable...') {
            const varName = prompt('Name der Funktionsvariable (z.B. targetObj):');
            if (varName && varName.trim()) {
                const cleanName = varName.trim().replace(/\s+/g, '');
                ctx.dialogData.target = `\${${cleanName}}`;
            } else {
                ctx.dialogData.target = projectRegistry.getObjects()[0]?.name || '';
            }
            ctx.render();
        } else if (selectedValue?.startsWith('📦 ${')) {
            const match = selectedValue.match(/📦 (\$\{[^}]+\})/);
            if (match) {
                ctx.dialogData.target = match[1];
            }
        }
        ctx.render();
    }
}
