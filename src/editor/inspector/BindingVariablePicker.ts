/**
 * Helpers for rendering the binding/variable pick button ('V')
 * used by action and property editors.
 */
export class BindingVariablePicker {
    /**
     * Appends a small 'V' button to the given container that triggers
     * the variable/binding picker via the provided onAction callback.
     */
    public static appendPickVariableButton(
        container: HTMLElement,
        onAction: ((actionDef: any) => void) | undefined,
        actionData: any
    ): void {
        if (!onAction) return;

        const b = document.createElement('button');
        b.innerText = 'V';
        b.style.cssText = 'width: 32px; padding: 4px; background-color: #e67e22; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;';
        b.onclick = () => {
            onAction({
                action: 'pickVariable',
                actionData
            });
        };
        container.appendChild(b);
    }
}
