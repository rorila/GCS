import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export type TGridStyle = 'lines' | 'dots';

export class TPanel extends TWindow {
    private _showGrid: boolean = false;
    private _gridColor: string = '#000000';
    private _gridStyle: TGridStyle = 'lines';

    constructor(name: string, x: number, y: number, width: number, height: number) {
        super(name, x, y, width, height);
        // Default style for a panel
        this.style.backgroundColor = '#f0f0f0';
        this.style.borderColor = '#999999';
        this.style.borderWidth = 1;
    }

    get caption(): string {
        return this.name;
    }

    set caption(v: string) {
        this.name = v;
    }

    get showGrid(): boolean {
        return this._showGrid;
    }

    set showGrid(v: boolean) {
        this._showGrid = v;
    }

    get gridColor(): string {
        return this._gridColor;
    }

    set gridColor(v: string) {
        this._gridColor = v;
    }

    get gridStyle(): TGridStyle {
        return this._gridStyle;
    }

    set gridStyle(v: TGridStyle) {
        this._gridStyle = v;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'caption', label: 'Caption', type: 'string', group: 'Specifics' },
            { name: 'showGrid', label: 'Show Grid', type: 'boolean', group: 'Specifics' },
            { name: 'gridColor', label: 'Grid Color', type: 'color', group: 'Specifics' },
            { name: 'gridStyle', label: 'Grid Style', type: 'select', options: ['lines', 'dots'], group: 'Specifics' }
        ];
    }
}
