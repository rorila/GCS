import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';

export class TLabel extends TTextControl {
    public text: string;

    constructor(name: string, x: number, y: number, text?: string) {
        // Init with text or name as default
        super(name, x, y, 100, 20);
        this.text = text !== undefined ? text : name;

        this.style.backgroundColor = 'transparent';
        this.style.color = '#000000';
        this.style.textAlign = 'left';
    }

    // Mapping caption to text for TLabel
    get caption(): string {
        return this.text;
    }

    set caption(v: string) {
        this.text = v;
    }

    public getInspectorProperties(): TPropertyDef[] {
        return super.getInspectorProperties();
    }
}

