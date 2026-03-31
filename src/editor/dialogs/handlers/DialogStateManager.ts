import { Logger } from '../../../utils/Logger';
import { IDialogContext } from '../IDialogContext';

const logger = Logger.get('JSONDialogRenderer', 'DialogStateManager');

export class DialogStateManager {

    public static collectFormData(ctx: IDialogContext) {
        ctx.setIsCollectingData(true);
        logger.info(`collectFormData starting...`);
        try {
            const namedElements = ctx.dialogWindow.querySelectorAll('[data-name]');
            namedElements.forEach(el => {
                const name = el.getAttribute('data-name');
                let value: any = (el as HTMLInputElement | HTMLSelectElement).value;

                if (el instanceof HTMLInputElement && (el as HTMLInputElement).type === 'checkbox') {
                    value = (el as HTMLInputElement).checked;
                }

                if (name) {
                    ctx.updateModelValue(name, value);
                }
            });

            logger.info(`Resulting dialogData:`, JSON.stringify(ctx.dialogData, null, 2));

            // Re-run cleanup to ensure saved data is clean
            ctx.cleanupActionFields(ctx.dialogData.type);

            logger.info(`Resulting dialogData AFTER cleanup:`, JSON.stringify(ctx.dialogData, null, 2));

            // Regenerate details for visibility in FlowEditor
            ctx.dialogData.details = DialogStateManager.generateActionDetails(ctx.dialogData);

        } finally {
            ctx.setIsCollectingData(false);
        }

        // Strip internal form values before returning
        delete ctx.dialogData._formValues;
        delete ctx.dialogData.IncrementVariableInput;
    }

    public static generateActionDetails(action: any): string {
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

    public static stringifyCalcSteps(steps: any[]): string {
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

    public static getInputValue(ctx: IDialogContext, name: string): string | undefined {
        const el = ctx.dialogWindow.querySelector(`[data-name="${name}"]`);
        const value = (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) ? el.value : undefined;
        return value;
    }
}
