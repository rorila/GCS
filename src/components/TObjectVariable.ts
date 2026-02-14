import { TVariable } from './TVariable';

export class TObjectVariable extends TVariable {
    public className: string = 'TObjectVariable';

    constructor(name: string, x: number, y: number) {
        super(name, x, y);
        this.type = 'object';
        this.defaultValue = {};
        this.value = {};
        this.caption = `📦 ${name}`;
    }
}
