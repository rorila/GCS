import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export class TListVariable extends TWindow {
    public className: string = 'TListVariable';
    public items: any[] = [];

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 4, 2);
        this.isVariable = true;
        this.style.backgroundColor = '#9c27b0'; // Purple for List
        this.style.borderColor = '#7b1fa2';
        this.style.borderWidth = 2;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            // Value editing for lists might be complex in property inspector,
            // but we can show the item count at least.
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onItemAdded',
            'onItemRemoved',
            'onCleared'
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            items: this.items
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TListVariable', (objData: any) => new TListVariable(objData.name, objData.x, objData.y));
