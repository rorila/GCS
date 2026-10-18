import { IInspectorContext } from './IInspectorContext';
import { PropertyHelper } from '../../../runtime/PropertyHelper';
import { projectObjectRegistry } from '../../../services/registry/ObjectRegistry';
import { projectVariableRegistry } from '../../../services/registry/VariableRegistry';
import { themeRegistry } from '../../../runtime/ThemeRegistry';
import { mediatorService } from '../../../services/MediatorService';
import { REFERENCE_SOURCES, refFieldName, isReplaceableValue } from '../../../runtime/actions/ActionReferences';

export interface IPropertyState {
    currentValue: any;
    isThemeValue: boolean;
    isFlowNode: boolean;
}

export class SectionRendererHelpers {
    public static notify(context: IInspectorContext, propName: string, newVal: any, oldVal: any, obj: any, event?: any) {
        mediatorService.notifyDataChanged({
            property: propName,
            value: newVal,
            oldValue: oldVal,
            object: obj
        }, 'inspector');
        if (event && context.onObjectUpdate) {
            context.onObjectUpdate(event);
        }
    }

    public static isFlowNode(obj: any): boolean {
        return obj.isFlowNode === true || typeof obj.setShowDetails === 'function';
    }

    /**
     * Haelt das ID-Begleitfeld einer Objektreferenz aktuell (z.B. target -> target_ref).
     *
     * Objektnamen sind projektweit nicht eindeutig; die ID ist es. Der Name bleibt
     * fuer Anzeige und Lesbarkeit erhalten, die Laufzeit loest ueber die ID auf.
     */
    public static syncReferenceId(propDef: any, selectedName: string, obj: any, isFlowNode: boolean): void {
        if (!propDef?.source || !REFERENCE_SOURCES.has(propDef.source)) return;

        let refId = '';
        if (isReplaceableValue(selectedName) && selectedName) {
            const target = projectObjectRegistry.getObjects().find((o: any) => o.name === selectedName)
                || projectVariableRegistry.getVariables().find((v: any) => v.name === selectedName);
            refId = (target as any)?.id || '';
        }

        const field = refFieldName(propDef.name);
        if (isFlowNode && typeof obj.applyChange === 'function') {
            obj.applyChange(field, refId);
        } else {
            PropertyHelper.setPropertyValue(obj, field, refId);
        }
    }

    public static resolveListValue(chosen: string): any {
        let path = chosen;
        if (path.startsWith('${') && path.endsWith('}')) {
            path = path.slice(2, -1);
        }

        const [first, ...rest] = path.split('.');
        if (!first) return undefined;

        const variable = projectVariableRegistry.getVariables().find((v: any) => v.name === first);
        if (variable) {
            let val = (variable as any).value !== undefined ? (variable as any).value : (variable as any).defaultValue;
            for (const part of rest) {
                if (val == null) return undefined;
                val = val[part];
            }
            return val;
        }

        const object = projectObjectRegistry.getObjects().find((o: any) => o.name === first || o.id === first);
        if (object) {
            return PropertyHelper.getPropertyValue(object, rest.join('.'));
        }

        return undefined;
    }

    /**
     * Zeigt für Binding-Ausdrücke (z.B. "${Var_XPos}") einen kleinen Hinweis
     * mit dem aktuell aufgelösten Wert neben dem Input an.
     */
    public static renderBindingPreview(value: any, obj: any, context: IInspectorContext): HTMLElement | null {
        if (typeof value !== 'string' || !value.includes('${')) return null;
        try {
            const resolved = context.resolveValue(value, obj);
            if (resolved === value || resolved === undefined || resolved === null || resolved === '') return null;
            const span = document.createElement('span');
            span.textContent = `:= ${String(resolved)}`;
            span.title = 'Aktuell aufgelöster Wert der Bindung';
            span.style.cssText = 'font-size:10px;color:#e67e22;white-space:nowrap;flex-shrink:0;font-family:Consolas,monospace;';
            return span;
        } catch (e) {
            return null;
        }
    }

    public static resolvePropertyState(propDef: any, obj: any): IPropertyState {
        const isFlowNode = this.isFlowNode(obj);

        // FIX: For FlowNodes (FlowAction), PropertyHelper.getPropertyValue(obj, 'x') reads
        // FlowElement.x (canvas position, e.g. 40) instead of the action parameter (e.g. '${MyVar}').
        // Use getActionDefinition() – the same SSoT method all FlowAction getters use internally.
        let currentValue: any;

        if (isFlowNode && typeof obj.getActionDefinition === 'function') {
            const actionDef = obj.getActionDefinition();
            if (actionDef && propDef.name in actionDef) {
                currentValue = actionDef[propDef.name];
            } else if (obj.data && propDef.name in obj.data) {
                currentValue = obj.data[propDef.name];
            } else {
                currentValue = PropertyHelper.getPropertyValue(obj, propDef.name);
            }
            if (currentValue === undefined || currentValue === null || currentValue === '') {
                currentValue = propDef.defaultValue ?? '';
            }
        } else {
            currentValue = PropertyHelper.getPropertyValue(obj, propDef.name);
            if (currentValue === undefined || currentValue === null || currentValue === '') {
                currentValue = propDef.defaultValue ?? '';
            }
        }

        // Theme-Wert als Fallback anzeigen, wenn die Eigenschaft lokal nicht gesetzt ist.
        // Beim Schreiben wird weiterhin nur obj.style aktualisiert, das Theme bleibt unverändert.
        let isThemeValue = false;
        if (propDef.name.startsWith('style.') && obj && obj.className && obj.style) {
            const styleProp = propDef.name.substring(6);
            const localValue = obj.style[styleProp];
            if ((localValue === undefined || localValue === null) && styleProp) {
                const mergedStyle = themeRegistry.getMergedStyle(obj.className, obj.style);
                if (mergedStyle[styleProp] !== undefined) {
                    currentValue = mergedStyle[styleProp];
                    isThemeValue = true;
                }
            }
        }

        return { currentValue, isThemeValue, isFlowNode };
    }
}
