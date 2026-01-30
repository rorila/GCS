import { TTextControl } from './TTextControl';
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
    constructor(name, x, y, width = 8, height = 2) {
        super(name, x, y, width, height);
        // TEdit-specific event callbacks
        this.onChangeCallback = null;
        this.onEnterCallback = null;
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
    get caption() {
        return this.text;
    }
    set caption(v) {
        this.text = v;
    }
    /**
     * Called when text changes
     */
    triggerChange(newText) {
        this.text = newText;
        if (this.onChangeCallback) {
            this.onChangeCallback(newText);
        }
    }
    /**
     * Called when Enter key is pressed
     */
    triggerEnter() {
        if (this.onEnterCallback) {
            this.onEnterCallback(this.text);
        }
    }
    /**
     * Set TEdit-specific event handlers
     */
    setOnChange(callback) {
        this.onChangeCallback = callback;
    }
    setOnEnter(callback) {
        this.onEnterCallback = callback;
    }
    /**
     * Get available events for this component
     * Extends TWindow events with TEdit-specific events
     */
    getEvents() {
        return [...super.getEvents(), 'onChange', 'onEnter'];
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'placeholder', label: 'Placeholder', type: 'string', group: 'Specifics' },
            { name: 'maxLength', label: 'Max Length', type: 'number', group: 'Specifics' }
            // Inherits styles from TTextControl
        ];
    }
}
