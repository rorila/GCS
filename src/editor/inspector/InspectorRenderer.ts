import { StandardControlRenderer } from './StandardControlRenderer';
import { ColorMediaControlRenderer } from './ColorMediaControlRenderer';
import { DynamicOptionsRenderer } from './DynamicOptionsRenderer';
import { ActionParameterRenderer } from './ActionParameterRenderer';
import { InspectorUIRenderer } from './InspectorUIRenderer';

/**
 * InspectorRenderer - Handles the visual generation of Inspector UI components.
 * This class captures the "View" part of the Inspector.
 * It now delegates to cohesive renderer modules.
 */
export class InspectorRenderer {
    constructor() { }

    public renderLabel(text: string, style?: any): HTMLElement {
        return StandardControlRenderer.renderLabel(text, style);
    }

    public renderSeparator(): HTMLElement {
        return StandardControlRenderer.renderSeparator();
    }

    public renderEdit(value: string, placeholder: string = ''): HTMLInputElement {
        return StandardControlRenderer.renderEdit(value, placeholder);
    }

    public renderTextArea(value: string, placeholder: string = ''): HTMLTextAreaElement {
        return StandardControlRenderer.renderTextArea(value, placeholder);
    }

    public renderSelect(options: any[], selectedValue: string, placeholder?: string): HTMLSelectElement {
        return StandardControlRenderer.renderSelect(options, selectedValue, placeholder);
    }

    public renderButton(text: string, onClick: () => void, customStyle?: any): HTMLButtonElement {
        return StandardControlRenderer.renderButton(text, onClick, customStyle);
    }

    public renderNumberInput(value: number, min?: number, max?: number, step?: number): HTMLInputElement {
        return StandardControlRenderer.renderNumberInput(value, min, max, step);
    }

    public renderCheckbox(checked: boolean, label: string): HTMLElement {
        return StandardControlRenderer.renderCheckbox(checked, label);
    }

    public renderPanel(style?: any): HTMLElement {
        return StandardControlRenderer.renderPanel(style);
    }

    public renderChips(value: string, onRemove: (chip: string) => void): HTMLElement {
        return StandardControlRenderer.renderChips(value, onRemove);
    }

    public renderColorInput(value: string): HTMLElement {
        return ColorMediaControlRenderer.renderColorInput(value);
    }

    public getOptionsFromSource(prop: any, actionObj?: any): any[] {
        return DynamicOptionsRenderer.getOptionsFromSource(prop, actionObj);
    }

    public generateUIFromProperties(object: any, _isMerging: boolean = false): any[] {
        return InspectorUIRenderer.generateUIFromProperties(object, _isMerging);
    }

    public renderActionParams(_obj: any, selectedObject: any, onUpdate: (prop: string, val: any) => void, onAction?: (actionDef: any) => void): HTMLElement | null {
        return ActionParameterRenderer.renderActionParams(_obj, selectedObject, onUpdate, onAction);
    }
}
