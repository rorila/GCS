export interface TPropertyDef {
    name: string;      // Property key or path (e.g. 'x', 'style.backgroundColor')
    label: string;     // Display label
    type: 'string' | 'number' | 'boolean' | 'color' | 'select' | 'checkbox' | 'image_picker';
    group?: string;    // 'Geometry', 'Style', 'Identity' etc.
    readonly?: boolean;
    step?: string;     // for number inputs
    options?: string[]; // for select type - available options
}

export abstract class TComponent {
    public id: string;
    public name: string;
    public className: string; // Explicit className for production builds
    public parent: TComponent | null = null;
    public children: TComponent[] = [];
    public Tasks?: Record<string, string>; // EventName -> TaskName

    // Drag & Drop Properties
    public draggable: boolean = false;
    public dragMode: 'move' | 'copy' = 'move';
    public droppable: boolean = false;

    constructor(name: string) {
        this.id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = name;
        this.className = this.constructor.name; // Set default from constructor
        this.Tasks = {}; // Initialize empty tasks object to avoid undefined errors in Inspector
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            { name: 'name', label: 'Name', type: 'string', group: 'Identity' },
            { name: 'id', label: 'ID', type: 'string', group: 'Identity', readonly: true },
            { name: 'draggable', label: 'Draggable', type: 'boolean', group: 'Interaction' },
            { name: 'dragMode', label: 'Drag Mode', type: 'select', group: 'Interaction', options: ['move', 'copy'] },
            { name: 'droppable', label: 'Droppable', type: 'boolean', group: 'Interaction' }
        ];
    }

    public toJSON(): any {
        return {
            className: this.constructor.name,
            id: this.id,
            name: this.name,
            Tasks: this.Tasks,
            draggable: this.draggable,
            dragMode: this.dragMode,
            droppable: this.droppable
        };
    }

    public addChild(child: TComponent) {
        if (child.parent) {
            child.parent.removeChild(child);
        }
        child.parent = this;
        this.children.push(child);
    }

    public removeChild(child: TComponent) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parent = null;
        }
    }

    public findChild(name: string): TComponent | null {
        return this.children.find(c => c.name === name) || null;
    }
}
