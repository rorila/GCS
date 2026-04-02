import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';

export class TLabel extends TTextControl {

    constructor(name: string, x: number, y: number, text?: string) {
        // Init with text or name as default
        super(name, x, y, 8, 2);
        this.text = text !== undefined ? text : name;

        this.style.backgroundColor = 'transparent';
        this.style.color = '#000000';
        this.style.textAlign = 'left';
    }

    public getInspectorProperties(): TPropertyDef[] {
        return super.getInspectorProperties();
    }
}

