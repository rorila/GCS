import { TWindow } from './TWindow';
export class TPanel extends TWindow {
    constructor(name, x, y, width, height) {
        super(name, x, y, width, height);
        this._showGrid = false;
        this._gridColor = '#000000';
        this._gridStyle = 'lines';
        // Default style for a panel
        this.style.backgroundColor = '#f0f0f0';
        this.style.borderColor = '#999999';
        this.style.borderWidth = 1;
    }
    get caption() {
        return this.name;
    }
    set caption(v) {
        this.name = v;
    }
    get showGrid() {
        return this._showGrid;
    }
    set showGrid(v) {
        this._showGrid = v;
    }
    get gridColor() {
        return this._gridColor;
    }
    set gridColor(v) {
        this._gridColor = v;
    }
    get gridStyle() {
        return this._gridStyle;
    }
    set gridStyle(v) {
        this._gridStyle = v;
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'caption', label: 'Caption', type: 'string', group: 'Specifics' },
            { name: 'showGrid', label: 'Show Grid', type: 'boolean', group: 'Specifics' },
            { name: 'gridColor', label: 'Grid Color', type: 'color', group: 'Specifics' },
            { name: 'gridStyle', label: 'Grid Style', type: 'select', options: ['lines', 'dots'], group: 'Specifics' }
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            caption: this.caption,
            showGrid: this._showGrid,
            gridColor: this._gridColor,
            gridStyle: this._gridStyle,
            style: {
                ...super.toJSON().style,
                borderColor: this.style.borderColor,
                borderWidth: this.style.borderWidth,
                backgroundColor: this.style.backgroundColor
            },
            // Serialize children explicitly
            children: this.children.map(child => child.toJSON())
        };
    }
}
