import { IInspectorContext } from './IInspectorContext';
import { mediatorService } from '../../../services/MediatorService';
import { Logger } from '../../../utils/Logger';

const logger = Logger.get('InspectorLegacyRenderer');

export class InspectorLegacyRenderer {
    public static renderUIDefinition(def: any, obj: any, context: IInspectorContext): HTMLElement | null {
        if (def.visible !== undefined) {
            const isVisible = context.resolveRawValue(def.visible, obj, def);
            if (!isVisible) return null;
        }

        if (def.label && def.className !== 'TLabel' && def.className !== 'TCheckbox' && def.className !== 'TActionParams') {
            const container = document.createElement('div');
            container.style.marginBottom = '8px';

            const label = context.renderer.renderLabel(def.label);
            container.appendChild(label);

            const shallowCopy = { ...def };
            delete shallowCopy.label;
            const control = InspectorLegacyRenderer.renderUIDefinition(shallowCopy, obj, context);

            if (control) {
                container.appendChild(control);
                return container;
            }
        }

        switch (def.className) {
            case 'TLabel':
                return context.renderer.renderLabel(context.resolveValue(def.text, obj, def), def.style);
            case 'TEdit': {
                const value = context.resolveValue(def.text || def.value, obj, def);
                const stringValue = (value === undefined || value === null) ? '' : String(value);
                const input = context.renderer.renderEdit(stringValue);
                if (def.name) input.name = def.name;
                input.onchange = () => {
                    const event = context.eventHandler.handleControlChange(def.name, input.value, obj, def);

                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (context.onObjectUpdate) context.onObjectUpdate(event);
                    }
                };
                return input;
            }
            case 'TNumberInput': {
                const value = context.resolveValue(def.text || def.value, obj, def);
                const input = context.renderer.renderNumberInput(Number(value), def.min, def.max, def.step);
                if (def.name) input.name = def.name;
                input.onchange = () => {
                    const event = context.eventHandler.handleControlChange(def.name, Number(input.value), obj, def);

                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (context.onObjectUpdate) context.onObjectUpdate(event);
                    }
                };
                return input;
            }
            case 'TSelect':
            case 'TDropdown': {
                const value = context.resolveValue(def.selectedValue, obj, def);

                let options = def.options;

                if (typeof options === 'string' && options.includes('${')) {
                    options = context.resolveValue(options, obj, def);
                }

                if (!Array.isArray(options)) {
                    options = context.renderer.getOptionsFromSource(def);
                }

                if ((!Array.isArray(options) || options.length === 0) && def.source) {
                    options = context.resolveRawValue(`\${${def.source}}`, obj, def);
                }

                const select = context.renderer.renderSelect(Array.isArray(options) ? options : [], value, def.placeholder);
                if (def.name) select.name = def.name;
                select.onchange = async () => {
                    logger.info(`[UI-TRACE] Control="${def.name}" onchange: NewValue="${select.value}"`);
                    const event = context.eventHandler.handleControlChange(def.name, select.value, obj, def);

                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                    }

                    if (def.action) {
                        await (context.actionHandler as any).handleAction(def, obj, select.value);
                    } else {
                        context.update(obj);
                    }
                    if (context.onObjectUpdate) context.onObjectUpdate(event);
                };
                return select;
            }
            case 'TCheckbox': {
                const value = context.resolveValue(def.checked, obj, def);
                const container = context.renderer.renderCheckbox(!!value, def.label || '');
                const cb = (container as any).input as HTMLInputElement;
                if (def.name) cb.name = def.name;
                cb.onchange = () => {
                    const event = context.eventHandler.handleControlChange(def.name, cb.checked, obj, def);

                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (context.onObjectUpdate) context.onObjectUpdate(event);
                    }

                    if (def.action) {
                        context.actionHandler.handleAction(def, obj, cb.checked);
                    }

                    context.update(obj); 
                };
                return container;
            }
            case 'TChips': {
                const value = context.resolveValue(def.value, obj, def);
                const chips = context.renderer.renderChips(String(value || ''), (chipToRemove) => {
                    const currentValues = String(value || '').split(',').map(s => s.trim()).filter(s => s);
                    const newValues = currentValues.filter(v => v !== chipToRemove);
                    const newValueString = newValues.join(', ');

                    const event = context.eventHandler.handleControlChange(def.name, newValueString, obj, def);
                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        context.update(obj);
                    }
                });
                return chips;
            }
            case 'TButton': {
                return context.renderer.renderButton(def.caption || def.name, () => {
                    context.actionHandler.handleAction(def, obj);
                }, def.style);
            }
            case 'TColorInput': {
                const value = context.resolveValue(def.text || def.value, obj, def);
                const container = context.renderer.renderColorInput(String(value || '#000000'));
                const colorInput = (container as any).colorInput as HTMLInputElement;
                const textInput = (container as any).textInput as HTMLInputElement;

                const updateValue = (newValue: string) => {
                    logger.info(`[InspectorHost] TColorInput changed: ${newValue} for ${def.name}`);
                    const event = context.eventHandler.handleControlChange(def.name, newValue, obj, def);
                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (context.onObjectUpdate) context.onObjectUpdate(event);
                    }
                };

                colorInput.oninput = () => {
                    textInput.value = colorInput.value;
                    updateValue(colorInput.value);
                };

                textInput.oninput = () => {
                    if (textInput.value.startsWith('#') && textInput.value.length === 7) {
                        colorInput.value = textInput.value;
                        updateValue(textInput.value);
                    }
                };

                textInput.onchange = () => {
                    updateValue(textInput.value);
                };

                return container;
            }
            case 'TActionParams': {
                const onUpdate = (prop: string, val: any) => {
                    const event = context.eventHandler.handleControlChange(prop, val, obj, { name: prop, property: prop });

                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (context.onObjectUpdate) context.onObjectUpdate(event);
                    }
                    context.update(obj); 
                };
                const onAction = (actionDef: any) => {
                    context.actionHandler.handleAction(actionDef, obj);
                };
                return context.renderer.renderActionParams(def, obj, onUpdate, onAction);
            }
            case 'TPanel': {
                const panel = context.renderer.renderPanel(def.style);
                if (def.children && Array.isArray(def.children)) {
                    def.children.forEach((child: any) => {
                        const childEl = InspectorLegacyRenderer.renderUIDefinition(child, obj, context);
                        if (childEl) panel.appendChild(childEl);
                    });
                }
                return panel;
            }
            default:
                return null;
        }
    }
}
