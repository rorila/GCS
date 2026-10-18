import { TVariable } from './TVariable';

export class TBooleanVariable extends TVariable {
    public className: string = 'TBooleanVariable';

    constructor(name: string, x: number, y: number) {
        super(name, x, y);
        this.variableType = 'boolean';
        this.defaultValue = false;
        this.value = false;
        this.caption = `⚖️ ${name}`;
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TBooleanVariable', (objData: any) => new TBooleanVariable(objData.name, objData.x, objData.y));
