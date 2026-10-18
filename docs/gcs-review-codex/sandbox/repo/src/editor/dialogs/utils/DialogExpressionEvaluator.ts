import { serviceRegistry } from '../../../services/ServiceRegistry';
import { Logger } from '../../../utils/Logger';
import { IDialogContext } from '../IDialogContext';
import { ExpressionParser } from '../../../runtime/ExpressionParser';

const logger = Logger.get('JSONDialogRenderer', 'DialogExpressionEvaluator');

export class DialogExpressionEvaluator {
    
    public static evaluateExpression(ctx: IDialogContext, expr: any, fallback: any = undefined): any {
        if (typeof expr !== 'string' || !expr.includes('${')) {
            return expr === undefined ? fallback : expr;
        }

        try {
            const contextVars = {
                dialogData: ctx.dialogData,
                project: ctx.enrichedProject,
                taskName: ctx.dialogData.taskName,
                actionName: ctx.dialogData.actionName || ctx.dialogData.name,
                name: ctx.dialogData.name,
                serviceRegistry: serviceRegistry,
                getProperties: (name: string) => ctx.getPropertiesForObject(name),
                getMethods: (name: string) => ctx.getMethodsForObject(name),
                getMethodSignature: (target: string, method: string) => ctx.getMethodSignature(target, method),
                getStageOptions: () => (ctx.enrichedProject.stages || []).map(s => ({ value: s.id, label: s.name || s.id }))
            };
            const allowedCalls = ['getProperties', 'getMethods', 'getMethodSignature', 'getStageOptions', 'serviceRegistry.get', 'serviceRegistry.listServices', 'serviceRegistry.has'];

            const result = ExpressionParser.interpolate(expr, contextVars, allowedCalls);
            return result === undefined ? fallback : result;
        } catch (e) {
            logger.warn(`Expression evaluation failed: "${expr}"`, e);
            return fallback !== undefined ? fallback : expr;
        }
    }

    public static evaluateActionData(ctx: IDialogContext, data: any): any {
        if (!data || typeof data !== 'object') return data;
        const result: any = Array.isArray(data) ? [] : {};
        for (const [key, value] of Object.entries(data)) {
            result[key] = typeof value === 'string' ? DialogExpressionEvaluator.evaluateExpression(ctx, value) : value;
        }
        return result;
    }

    public static replaceTemplateVars(ctx: IDialogContext, obj: any, item: any, index: number) {
        const replace = (target: any): any => {
            if (typeof target === 'string') {
                if (!target.includes('${')) return target;

                try {
                    const contextVars = {
                        item,
                        index,
                        dialogData: ctx.dialogData,
                        project: ctx.enrichedProject,
                        serviceRegistry: serviceRegistry,
                        getProperties: (name: string) => ctx.getPropertiesForObject(name),
                        getMethods: (name: string) => ctx.getMethodsForObject(name),
                        getMethodSignature: (target: string, method: string) => ctx.getMethodSignature(target, method),
                        getStageOptions: () => (ctx.enrichedProject.stages || []).map(s => ({ value: s.id, label: s.name || s.id }))
                    };
                    const allowedCalls = ['getProperties', 'getMethods', 'getMethodSignature', 'getStageOptions', 'serviceRegistry.get', 'serviceRegistry.listServices', 'serviceRegistry.has'];

                    return ExpressionParser.interpolate(target, contextVars, allowedCalls);
                } catch (e) {
                    logger.warn(`Failed to evaluate template "${target}":`, e);
                    return target;
                }
            } else if (typeof target === 'object' && target !== null) {
                const newObj = Array.isArray(target) ? [] : {};
                Object.keys(target).forEach(key => {
                    (newObj as any)[key] = replace(target[key]);
                });
                return newObj;
            }
            return target;
        };

        Object.keys(obj).forEach(key => {
            obj[key] = replace(obj[key]);
        });
    }
}
