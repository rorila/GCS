export interface TPropertyDef {
    name: string;      // Property key or path (e.g. 'x', 'style.backgroundColor')
    label: string;     // Display label
    type: 'string' | 'number' | 'boolean' | 'color' | 'select' | 'checkbox' | 'image_picker';
    group?: string;    // 'Geometry', 'Style', 'Identity' etc.
    readonly?: boolean;
    serializable?: boolean; // Ob die Property gespeichert werden soll (default: true)
    editorOnly?: boolean;   // Ob die Property nur im Editor relevant ist (default: false)
    defaultValue?: any;     // Standardwert
    step?: string;     // for number inputs
    options?: string[]; // for select type - available options
}

/**
 * Interface für Komponenten, die an der Runtime-Loop teilnehmen
 */
export interface IRuntimeComponent {
    /** Wird aufgerufen, um der Komponente Zugriff auf Runtime-Callbacks zu geben */
    initRuntime?(callbacks: {
        handleEvent: (objectId: string, eventName: string, data?: any) => void;
        render: () => void;
        gridConfig: any;
        objects: any[];
    }): void;

    onRuntimeStart?(): void;
    onRuntimeUpdate?(deltaTime: number): void;
    onRuntimeStop?(): void;
}

export abstract class TComponent {
    public id: string;
    public name: string;
    public className: string; // Explicit className for production builds
    public parent: TComponent | null = null;
    public children: TComponent[] = [];
    public Tasks?: Record<string, string>; // EventName -> TaskName
    public scope: 'global' | 'stage' | string = 'stage'; // Visibility scope
    public isVariable: boolean = false; // Flag for variable-like components

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

    public abstract getInspectorProperties(): TPropertyDef[];

    protected getBaseProperties(): TPropertyDef[] {
        return [
            { name: 'name', label: 'Name', type: 'string', group: 'IDENTITÄT' },
            { name: 'id', label: 'ID', type: 'string', group: 'IDENTITÄT', readonly: true },
            { name: 'scope', label: 'Scope', type: 'select', group: 'IDENTITÄT', options: ['global', 'stage'] },
            { name: 'draggable', label: 'Draggable', type: 'boolean', group: 'INTERAKTION', editorOnly: true },
            { name: 'dragMode', label: 'Drag Mode', type: 'select', group: 'INTERAKTION', options: ['move', 'copy'], editorOnly: true },
            { name: 'droppable', label: 'Droppable', type: 'boolean', group: 'INTERAKTION', editorOnly: true }
        ];
    }

    /**
     * Generisches toJSON, das die Metadaten aus getInspectorProperties nutzt.
     */
    public toJSON(): any {
        const json: any = {
            className: (this as any).className || this.constructor.name,
            id: this.id,
            isVariable: this.isVariable
        };

        // Tasks separat behandeln
        if (this.Tasks && Object.keys(this.Tasks).length > 0) {
            json.Tasks = this.Tasks;
        }

        // Alle Properties aus dem Inspector durchgehen
        const props = this.getInspectorProperties();
        props.forEach(p => {
            if (p.serializable === false) return; // Nicht speichern

            const value = this.getPropertyValue(p.name);
            if (value !== undefined) {
                json[p.name] = value;
            }
        });

        return json;
    }

    /**
     * Hilfsmethode um Property-Werte (auch verschachtelte) zu lesen
     */
    protected getPropertyValue(path: string): any {
        if (!path.includes('.')) return (this as any)[path];

        const parts = path.split('.');
        let current: any = this;
        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }
        return current;
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
