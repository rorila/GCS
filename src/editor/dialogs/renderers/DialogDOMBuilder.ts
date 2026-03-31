import { Logger } from '../../../utils/Logger';
import { IDialogContext } from '../IDialogContext';
import { DialogComponentFactory } from '../../DialogComponentFactory';
import { ActionParamRenderer } from '../../ActionParamRenderer';
import { DialogExpressionEvaluator } from '../utils/DialogExpressionEvaluator';
import { DialogActionHandler } from '../handlers/DialogActionHandler';
import { serviceRegistry } from '../../../services/ServiceRegistry';

const logger = Logger.get('JSONDialogRenderer', 'DialogDOMBuilder');

export class DialogDOMBuilder {

    public static createHeader(ctx: IDialogContext): HTMLElement {
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
        title.innerText = DialogExpressionEvaluator.evaluateExpression(ctx, ctx.dialogDef.title);
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
        closeBtn.onclick = () => ctx.close('cancel');
        header.appendChild(closeBtn);

        return header;
    }

    public static createBody(ctx: IDialogContext): HTMLElement {
        const body = document.createElement('div');
        body.className = 'task-editor-body';
        body.style.cssText = `
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            flex: 1;
            padding: 16px 20px;
        `;

        if (ctx.dialogDef.objects) {
            ctx.dialogDef.objects.forEach((obj: any) => {
                const el = this.renderObject(ctx, obj);
                if (el) body.appendChild(el);
            });
        }

        return body;
    }

    public static createFooter(ctx: IDialogContext): HTMLElement {
        const footer = document.createElement('div');
        footer.className = 'task-editor-footer';
        footer.style.cssText = `
            padding: 16px 20px;
            border-top: 1px solid #444;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        `;

        if (ctx.dialogDef.footer) {
            ctx.dialogDef.footer.forEach((obj: any) => {
                const el = this.renderObject(ctx, obj);
                if (el) footer.appendChild(el);
            });
        }

        return footer;
    }

    public static renderObject(ctx: IDialogContext, obj: any): HTMLElement | null {
        try {
            if (obj.visible !== undefined) {
                const isVisible = DialogExpressionEvaluator.evaluateExpression(ctx, obj.visible);
                if (!isVisible) return null;
            }

            const className = obj.className;

            if (className === 'TForEach') {
                return this.renderForEach(ctx, obj);
            }

            if (className === 'TActionParams') {
                return this.renderActionParams(ctx, obj);
            }

            return DialogComponentFactory.createComponent(obj, {
                dialogData: ctx.dialogData,
                evaluateExpression: (expr) => DialogExpressionEvaluator.evaluateExpression(ctx, expr),
                handleAction: (action, data) => DialogActionHandler.handleAction(ctx, action, data),
                updateModelValue: (name, value) => ctx.updateModelValue(name, value),
                renderObject: (o) => this.renderObject(ctx, o)
            });
        } catch (e: any) {
            logger.error('Error rendering object:', obj, e);
            const errEl = document.createElement('div');
            errEl.style.color = 'red';
            errEl.innerText = `Error rendering ${obj.className || 'object'}: ${e.message}`;
            return errEl;
        }
    }

    private static renderActionParams(ctx: IDialogContext, _obj: any): HTMLElement | null {
        return ActionParamRenderer.render({
            dialogData: ctx.dialogData,
            project: ctx.project,
            enrichedProject: ctx.enrichedProject,
            evaluateExpression: (expr) => DialogExpressionEvaluator.evaluateExpression(ctx, expr),
            getMethodSignature: (target, method) => ctx.getMethodSignature(target, method),
            render: () => ctx.render(),
            onUpdate: (name, value) => ctx.updateModelValue(name, value)
        });
    }

    private static renderForEach(ctx: IDialogContext, obj: any): HTMLElement | null {
        const container = document.createElement('div');
        container.className = 'foreach-container';
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.width = '100%';

        const sourceData = DialogExpressionEvaluator.evaluateExpression(ctx, obj.source);
        if (!sourceData) return null;

        let items: any[] = [];
        if (Array.isArray(sourceData)) {
            items = sourceData;
        } else if (typeof sourceData === 'object' && sourceData !== null) {
            items = Object.entries(sourceData);
        }

        if (obj.filter && items.length > 0) {
            items = items.filter((item: any) => {
                try {
                    const fn = new Function('item', 'dialogData', 'project', 'taskName', 'actionName', 'name', 'serviceRegistry', 'getProperties', 'getMethods', `return ${obj.filter}`);
                    return fn(item, ctx.dialogData, ctx.project, ctx.dialogData.taskName, ctx.dialogData.actionName, ctx.dialogData.name, serviceRegistry, (name: string) => ctx.getPropertiesForObject(name), (name: string) => ctx.getMethodsForObject(name));
                } catch (e) {
                    logger.error(`Filter evaluation error: ${obj.filter}`, e);
                    return true;
                }
            });
        }

        items.forEach((item: any, index: number) => {
            obj.template.forEach((templateObj: any) => {
                const instance = JSON.parse(JSON.stringify(templateObj));
                DialogExpressionEvaluator.replaceTemplateVars(ctx, instance, item, index);

                const el = this.renderObject(ctx, instance);
                if (el) container.appendChild(el);
            });
        });

        return container;
    }
}
