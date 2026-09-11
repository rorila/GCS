import { applyStyle } from './InspectorRendererHelpers';

export class ColorMediaControlRenderer {
    /**
     * Renders a specialized Color Input
     */
    public static renderColorInput(value: string): HTMLElement {
        const container = document.createElement('div');
        container.className = 'inspector-color-container';
        applyStyle(container, {
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            width: '100%',
            marginBottom: '8px'
        });

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = value && value.startsWith('#') && value.length === 7 ? value : '#000000';
        colorInput.className = 'inspector-color-input';
        applyStyle(colorInput, {
            width: '32px',
            height: '24px',
            padding: '0',
            border: '1px solid #444',
            borderRadius: '3px',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            flexShrink: '0'
        });

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = value || '#000000';
        textInput.className = 'inspector-color-text';
        applyStyle(textInput, {
            flex: '1',
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '3px',
            padding: '4px 6px',
            fontSize: '12px',
            outline: 'none'
        });

        container.appendChild(colorInput);
        container.appendChild(textInput);

        // Expose inputs for events
        (container as any).colorInput = colorInput;
        (container as any).textInput = textInput;

        return container;
    }
}
