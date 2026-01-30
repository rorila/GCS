import { TWindow } from './TWindow';
export class TListVariable extends TWindow {
    constructor(name, x, y) {
        super(name, x, y, 3, 2);
        this.className = 'TListVariable';
        this.items = [];
        this.isVariable = true;
        this.style.backgroundColor = '#9c27b0'; // Purple for List
        this.style.borderColor = '#7b1fa2';
        this.style.borderWidth = 2;
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            // Value editing for lists might be complex in property inspector,
            // but we can show the item count at least.
        ];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onItemAdded',
            'onItemRemoved',
            'onCleared'
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            items: this.items
        };
    }
}
