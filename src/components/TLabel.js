import { TTextControl } from './TTextControl';
export class TLabel extends TTextControl {
    constructor(name, x, y, text) {
        // Init with text or name as default
        super(name, x, y, 100, 20);
        this.text = text !== undefined ? text : name;
        this.style.backgroundColor = 'transparent';
        this.style.color = '#000000';
        this.style.textAlign = 'left';
    }
    getInspectorProperties() {
        return super.getInspectorProperties();
    }
}
