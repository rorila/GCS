import { TVariable } from './TVariable';

export class TIntegerVariable extends TVariable {
    public className: string = 'TIntegerVariable';

    constructor(name: string, x: number, y: number) {
        super(name, x, y);
        this.variableType = 'integer';
        this.defaultValue = 0;
        this.value = 0;
        this.caption = `🔢 ${name}`;
    }
}
