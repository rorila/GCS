import { TVariable } from './TVariable';

export class TRealVariable extends TVariable {
    public className: string = 'TRealVariable';

    constructor(name: string, x: number, y: number) {
        super(name, x, y);
        this.variableType = 'real';
        this.defaultValue = 0.0;
        this.value = 0.0;
        this.caption = `📏 ${name}`;
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TRealVariable', (objData: any) => new TRealVariable(objData.name, objData.x, objData.y));
