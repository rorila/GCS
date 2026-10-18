import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';

export class TLabel extends TTextControl {

    constructor(name: string, x: number, y: number, text?: string) {
        // Init with text or name as default
        super(name, x, y, 8, 2);
        this.text = text !== undefined ? text : name;

        // Default style wird nun über ThemeRegistry gesteuert
    }

    public getInspectorProperties(): TPropertyDef[] {
        return super.getInspectorProperties();
    }
}


// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TLabel', (objData: any) => new TLabel(objData.name, objData.x, objData.y, objData.text));
