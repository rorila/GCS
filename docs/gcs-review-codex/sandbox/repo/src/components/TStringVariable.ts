import { TVariable } from './TVariable';

export class TStringVariable extends TVariable {
    public className: string = 'TStringVariable';

    constructor(name: string, x: number, y: number) {
        super(name, x, y);
        this.variableType = 'string';
        this.defaultValue = '';
        this.value = '';
        this.caption = `📝 ${name}`;
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TStringVariable', (objData: any) => new TStringVariable(objData.name, objData.x, objData.y));
