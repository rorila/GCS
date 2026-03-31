import { serviceRegistry } from '../../../services/ServiceRegistry';
import { Logger } from '../../../utils/Logger';
import { IDialogContext } from '../IDialogContext';

const logger = Logger.get('JSONDialogRenderer', 'DialogExpressionEvaluator');

export class DialogExpressionEvaluator {
    
    public static evaluateExpression(ctx: IDialogContext, expr: any, fallback: any = undefined): any {
        if (typeof expr !== 'string' || !expr.includes('${')) {
            return expr === undefined ? fallback : expr;
        }

        const code = expr.startsWith('${') && expr.endsWith('}')
            ? expr.substring(2, expr.length - 1)
            : `\`${expr.replace(/`/g, '\\`').replace(/\$\{/g, '${')}\``;

        try {
            const fn = new Function('dialogData', 'project', 'taskName', 'actionName', 'name', 'serviceRegistry', 'getProperties', 'getMethods', 'getMethodSignature', 'getStageOptions', `return ${code}`);
            const result = fn(
                ctx.dialogData,
                ctx.enrichedProject,
                ctx.dialogData.taskName,
                ctx.dialogData.actionName || ctx.dialogData.name,
                ctx.dialogData.name,
                serviceRegistry,
                (name: string) => ctx.getPropertiesForObject(name),
                (name: string) => ctx.getMethodsForObject(name),
                (target: string, method: string) => ctx.getMethodSignature(target, method),
                () => (ctx.enrichedProject.stages || []).map(s => ({ value: s.id, label: s.name || s.id }))
            );

            return result;
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

                // Check for full match evaluation
                const fullMatch = target.match(/^\$\{([^}]+)\}$/);
                if (fullMatch) {
                    try {
                        const code = fullMatch[1];
                        const fn = new Function('item', 'index', 'dialogData', 'project', 'serviceRegistry', 'getProperties', 'getMethods', 'getMethodSignature', 'getStageOptions', `return ${code}`);
                        return fn(
                            item,
                            index,
                            ctx.dialogData,
                            ctx.enrichedProject,
                            serviceRegistry,
                            (name: string) => ctx.getPropertiesForObject(name),
                            (name: string) => ctx.getMethodsForObject(name),
                            (target: string, method: string) => ctx.getMethodSignature(target, method),
                            () => (ctx.enrichedProject.stages || []).map(s => ({ value: s.id, label: s.name || s.id }))
                        );
                    } catch (e) {
                        logger.warn(`Failed to evaluate full template "${target}":`, e);
                    }
                }

                // Standard string interpolation
                return target.replace(/\${([^}]+)}/g, (match, code) => {
                    try {
                        const fn = new Function('item', 'index', 'dialogData', 'project', 'serviceRegistry', 'getProperties', 'getMethods', 'getMethodSignature', 'getStageOptions', `return \`${code}\``);
                        const result = fn(
                            item,
                            index,
                            ctx.dialogData,
                            ctx.enrichedProject,
                            serviceRegistry,
                            (name: string) => ctx.getPropertiesForObject(name),
                            (name: string) => ctx.getMethodsForObject(name),
                            (target: string, method: string) => ctx.getMethodSignature(target, method),
                            () => (ctx.enrichedProject.stages || []).map(s => ({ value: s.id, label: s.name || s.id }))
                        );
                        return result !== undefined ? String(result) : '';
                    } catch (e) {
                        logger.warn(`Failed to evaluate template part "${match}":`, e);
                        return match;
                    }
                });

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
