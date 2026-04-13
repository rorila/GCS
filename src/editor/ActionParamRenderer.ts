import { projectObjectRegistry } from '../services/registry/ObjectRegistry';
import { projectActionRegistry } from '../services/registry/ActionRegistry';
import { projectTaskRegistry } from '../services/registry/TaskRegistry';
import { actionRegistry } from '../runtime/ActionRegistry';


import { serviceRegistry } from '../services/ServiceRegistry';
import { Logger } from '../utils/Logger';

const logger = Logger.get('ActionParamRenderer');

export interface ActionParamContext {
    dialogData: any;
    project: any;
    enrichedProject: any;
    evaluateExpression: (expr: any) => any;
    getMethods?: (target: string) => string[];
    getMethodSignature: (target: string, method: string) => any[];
    render: () => void;
    onUpdate?: (name: string, value: any) => void;
}

/**
 * ActionParamRenderer - Handles the specialized rendering of action parameters
 * based on the selected action type.
 */
export class ActionParamRenderer {

    public static render(ctx: ActionParamContext): HTMLElement | null {
        const type = ctx.dialogData.type;
        const meta = actionRegistry.getMetadata(type);
        if (!meta) return null;

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

            let input: HTMLElement | null = null;

            switch (param.type) {
                case 'object':
                case 'variable':
                case 'stage':
                case 'select': {
                    const sel = document.createElement('select');
                    sel.setAttribute('data-name', param.name);
                    sel.style.cssText = 'width: 100%; padding: 6px; background: #333; color: white; border: 1px solid #555; border-radius: 3px;';

                    let items: any[] = [];
                    if (param.source === 'objects') items = projectObjectRegistry.getObjects().map(o => ({ value: o.name, label: o.name }));
                    else if (param.source === 'variables') items = (ctx.enrichedProject.variables || []).map((v: any) => ({ value: v.name, label: v.name }));
                    else if (param.source === 'stages') items = (ctx.project.stages || []).map((s: any) => ({ value: s.id, label: s.name || s.id }));
                    else if (param.source === 'objects_and_services') {
                        const validObjects = projectObjectRegistry.getObjects().filter((o: any) => {
                            try {
                                if (!ctx.getMethods) return true;
                                const methods = ctx.getMethods(o.name);
                                return methods && methods.length > 0;
                            } catch (e) { return false; }
                        });
                        items = [
                            ...validObjects.map((o: any) => ({ value: o.name, label: o.name })),
                            ...serviceRegistry.listServices().map((s: string) => ({ value: s, label: s + ' (Service)' }))
                        ];
                    }
                    else if (param.source === 'methods_of_target') {
                        const targetName = ctx.dialogData.target;
                        if (targetName && ctx.getMethods) {
                            items = ctx.getMethods(targetName).map((m: string) => ({ value: m, label: m }));
                        }
                    }
                    else if (param.source === 'services') items = serviceRegistry.listServices().map(s => ({ value: s, label: s }));
                    else if (param.source === 'tasks') items = projectTaskRegistry.getTasks().map(t => ({ value: t.name, label: t.name }));
                    else if (param.source === 'actions') items = projectActionRegistry.getActions().map(a => ({ value: a.name, label: a.name }));
                    else if (param.source === 'easing-functions') items = ['linear', 'easeIn', 'easeOut', 'easeInOut'].map(e => ({ value: e, label: e }));

                    const empty = document.createElement('option');
                    empty.value = '';
                    empty.text = '--- wählen ---';
                    sel.appendChild(empty);

                    items.forEach(it => {
                        const opt = document.createElement('option');
                        opt.value = it.value;
                        opt.text = it.label;
                        if (ctx.dialogData[param.name] === it.value) opt.selected = true;
                        sel.appendChild(opt);
                    });

                    sel.onchange = () => {
                        ctx.dialogData[param.name] = sel.value;
                        if (ctx.onUpdate) ctx.onUpdate(param.name, sel.value);
                        ctx.render();
                    };
                    input = sel;
                    break;
                }
                case 'json':
                case 'string':
                case 'number':
                default: {
                    if (type === 'call_method' && param.name === 'params') {
                        input = this.renderMethodParams(ctx);
                    } else {
                        const edit = document.createElement('input');
                        edit.type = 'text';
                        edit.setAttribute('data-name', param.name);
                        edit.value = ctx.dialogData[param.name] !== undefined ? (typeof ctx.dialogData[param.name] === 'object' ? JSON.stringify(ctx.dialogData[param.name]) : ctx.dialogData[param.name]) : (param.defaultValue || '');
                        edit.style.cssText = 'width: 100%; padding: 6px; background: #333; color: white; border: 1px solid #555; border-radius: 3px;';

                        edit.onchange = () => {
                            let val: any = edit.value;
                            if (param.type === 'number') val = Number(val);
                            if (param.type === 'json') {
                                try {
                                    val = JSON.parse(val);
                                } catch (e) {
                                    if (typeof val === 'string' && val.includes('=') && !val.trim().startsWith('{')) {
                                        const parts = val.split('=').map(s => s.trim());
                                        if (parts.length === 2) {
                                            const [k, v] = parts;
                                            const numV = Number(v);
                                            val = { [k]: !isNaN(numV) && v !== '' ? numV : v };
                                            logger.debug(`Auto-converted "${edit.value}" to JSON:`, val);
                                        }
                                    } else {
                                        logger.error('Invalid JSON in param', param.name, val);
                                    }
                                }
                            }
                            ctx.dialogData[param.name] = val;
                            if (ctx.onUpdate) ctx.onUpdate(param.name, val);
                            if (param.name === 'target' || param.name === 'service' || param.name === 'method') {
                                ctx.render();
                            }
                        };
                        input = edit;
                    }
                    break;
                }
            }

            if (input) row.appendChild(input);
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

    private static renderMethodParams(ctx: ActionParamContext): HTMLElement {
        const methodName = ctx.dialogData.method;
        const signature = ctx.getMethodSignature(ctx.dialogData.target, methodName);

        const paramContainer = document.createElement('div');
        paramContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding-left: 10px; border-left: 2px solid #555; margin-top: 4px;';

        signature.forEach((sigParam: any, idx: number) => {
            const sigRow = document.createElement('div');
            sigRow.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

            const sigLabel = document.createElement('label');
            sigLabel.innerText = `${sigParam.label || sigParam.name} (${sigParam.type})`;
            sigLabel.style.cssText = 'font-size: 11px; color: #888;';
            sigRow.appendChild(sigLabel);

            const currentParamValue = (Array.isArray(ctx.dialogData.params) ? ctx.dialogData.params[idx] : '') || '';

            let sigInput: HTMLElement;
            if (sigParam.type === 'select' || sigParam.type === 'stage' || sigParam.type === 'variable') {
                const opts = sigParam.options || [];
                const evaluatedOpts = (typeof opts === 'string') ? ctx.evaluateExpression(opts) : opts;

                let items = evaluatedOpts;
                if (sigParam.source === 'stages') items = (ctx.project.stages || []).map((s: any) => ({ value: s.id, label: s.name || s.id }));
                else if (sigParam.source === 'variables') items = (ctx.enrichedProject.variables || []).map((v: any) => ({ value: v.name, label: v.name }));

                const sel = document.createElement('select');
                sel.style.cssText = 'width: 100%; padding: 6px; background: #333; color: white; border: 1px solid #555; border-radius: 3px;';

                const empty = document.createElement('option');
                empty.value = '';
                empty.text = '--- wählen ---';
                sel.appendChild(empty);

                items.forEach((it: any) => {
                    const opt = document.createElement('option');
                    opt.value = it.value || it;
                    opt.text = it.label || it.name || it;
                    if (currentParamValue === opt.value) opt.selected = true;
                    sel.appendChild(opt);
                });

                sel.onchange = () => {
                    const p = Array.isArray(ctx.dialogData.params) ? [...ctx.dialogData.params] : [];
                    p[idx] = sel.value;
                    ctx.dialogData.params = p;
                    if (ctx.onUpdate) ctx.onUpdate('params', p);
                    ctx.render();
                };
                sigInput = sel;
            } else {
                const ed = document.createElement('input');
                ed.type = 'text';
                ed.value = currentParamValue;
                ed.style.cssText = 'width: 100%; padding: 6px; background: #333; color: white; border: 1px solid #555; border-radius: 3px;';
                ed.onchange = () => {
                    const p = Array.isArray(ctx.dialogData.params) ? [...ctx.dialogData.params] : [];
                    p[idx] = ed.value;
                    if (sigParam.type === 'number') p[idx] = Number(ed.value);
                    ctx.dialogData.params = p;
                    if (ctx.onUpdate) ctx.onUpdate('params', p);
                };
                sigInput = ed;
            }
            sigRow.appendChild(sigInput);
            paramContainer.appendChild(sigRow);
        });

        return paramContainer;
    }
}

