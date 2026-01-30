import { TTextControl } from './TTextControl';
/**
 * TGameHeader - A header component for games
 *
 * Contains a title that can be aligned left, center, or right.
 * Default dock position is TOP with full width.
 */
export class TGameHeader extends TTextControl {
    constructor(name, x = 0, y = 0, width = 32, height = 2) {
        super(name, x, y, width, height);
        // Default header style
        this.align = 'TOP';
        this._title = name;
        // Use TTextControl styles
        this.style.backgroundColor = '#2c3e50';
        this.style.borderColor = '#34495e';
        this.style.borderWidth = 0;
        this.style.color = '#ffffff';
        this.style.fontSize = 18;
        this.style.fontWeight = 'bold';
        this.style.fontFamily = 'Segoe UI, sans-serif';
        this.style.textAlign = 'center';
    }
    // Title property (mapped to caption/text)
    get title() {
        return this._title;
    }
    set title(value) {
        this._title = value;
        this.caption = value; // Updates inherited text property
    }
    // Helper for legacy titleAlign
    get titleAlign() {
        const align = this.style.textAlign || 'center';
        return align === 'left' ? 'LEFT' : (align === 'right' ? 'RIGHT' : 'CENTER');
    }
    set titleAlign(value) {
        this.style.textAlign = value.toLowerCase();
    }
    /**
     * Legacy Accessors for Inspector compatibility
     * These map strictly to TTextControl styles now.
     */
    get textColor() { return this.style.color || '#ffffff'; }
    set textColor(v) { this.style.color = v; }
    get fontSize() { return this.style.fontSize; }
    set fontSize(v) { this.style.fontSize = v; }
    get fontWeight() { return this.style.fontWeight; }
    set fontWeight(v) { this.style.fontWeight = v; }
    get fontFamily() { return this.style.fontFamily; }
    set fontFamily(v) { this.style.fontFamily = v; }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        // Remove redundant props if any, or just add specific 'title' alias
        return [
            ...props,
            { name: 'title', label: 'Titel', type: 'string', group: 'IDENTITÄT' }
            // Inherits Typography group from TTextControl
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            title: this._title,
            // titleAlign etc are stored in style now
        };
    }
}
