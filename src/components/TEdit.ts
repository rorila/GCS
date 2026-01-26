import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';

/**
 * TEdit - Text input component
 * 
 * Allows users to enter and edit text in the game.
 * Useful for forms, name input, chat, etc.
 * 
 * Events (inherited from TWindow):
 *   onClick  - Fires when clicked
 *   onFocus  - Fires when input gains focus
 *   onBlur   - Fires when input loses focus
 * 
 * Events (specific to TEdit):
 *   onChange - Fires when text changes
 *   onEnter  - Fires when Enter key is pressed
 */
export class TEdit extends TTextControl {
    public text: string;
    public placeholder: string;
    public maxLength: number;

    // TEdit-specific event callbacks
    private onChangeCallback: ((text: string) => void) | null = null;
    private onEnterCallback: ((text: string) => void) | null = null;

    constructor(name: string, x: number, y: number, width: number = 8, height: number = 2) {
        super(name, x, y, width, height);

        this.text = '';
        this.placeholder = 'Enter text...';
        this.maxLength = 100;

        // Default Edit Style
        this.style.backgroundColor = '#ffffff';
        this.style.borderColor = '#cccccc';
        this.style.borderWidth = 1;
        this.style.color = '#000000';
    }

    // Mapping caption to text for consistency
    get caption(): string {
        return this.text;
    }

    set caption(v: string) {
        this.text = v;
    }

    /**
     * Called when text changes
     */
    public triggerChange(newText: string): void {
        this.text = newText;
        if (this.onChangeCallback) {
            this.onChangeCallback(newText);
        }
    }

    /**
     * Called when Enter key is pressed
     */
    public triggerEnter(): void {
        if (this.onEnterCallback) {
            this.onEnterCallback(this.text);
        }
    }

    /**
     * Set TEdit-specific event handlers
     */
    public setOnChange(callback: (text: string) => void): void {
        this.onChangeCallback = callback;
    }

    public setOnEnter(callback: (text: string) => void): void {
        this.onEnterCallback = callback;
    }

    /**
     * Get available events for this component
     * Extends TWindow events with TEdit-specific events
     */
    public override getEvents(): string[] {
        return [...super.getEvents(), 'onChange', 'onEnter'];
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'placeholder', label: 'Placeholder', type: 'string', group: 'Specifics' },
            { name: 'maxLength', label: 'Max Length', type: 'number', group: 'Specifics' }
            // Inherits styles from TTextControl
        ];
    }
}
