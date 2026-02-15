export interface TPropertyDef {
    name: string;      // Property key or path (e.g. 'x', 'style.backgroundColor')
    label: string;     // Display label
    type: 'string' | 'number' | 'boolean' | 'color' | 'select' | 'checkbox' | 'image_picker' | 'json' | 'button';
    group?: string;    // 'Geometry', 'Style', 'Identity' etc.
    readonly?: boolean;
    serializable?: boolean; // Ob die Property gespeichert werden soll (default: true)
    editorOnly?: boolean;   // Ob die Property nur im Editor relevant ist (default: false)
    defaultValue?: any;     // Standardwert
    step?: string;     // for number inputs
    options?: string[]; // for select type - available options
    selectedValue?: any; // Explicitly set value (overrides binding)
    source?: string;    // for select type - dynamic source name (e.g. 'availableModels')
    hint?: string;      // Tooltip or hint text
    placeholder?: string; // Input placeholder
    style?: any;       // For button type: custom CSS styles
    action?: string;   // For button type: internal action name
    actionData?: any;  // For button type: payload for action
}

/** 
 * Symbol to store original formula/expressions (Design Values) 
 * to prevent them from being lost when overwritten by runtime results.
 */
export const DESIGN_VALUES = Symbol('DESIGN_VALUES');

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
    public events?: Record<string, string>; // EventName -> TaskName
    public scope: 'global' | 'stage' | string = 'stage'; // Visibility scope
    public isVariable: boolean = false; // Flag for variable-like components
    public isTransient: boolean = false; // If true, this component is not persisted in project files

    // Visibility & Scoping Meta-Flags
    public isService: boolean = false;       // If true, component is merged globally across stages
    public isHiddenInRun: boolean = false;    // If true, component is hidden in run mode
    public isBlueprintOnly: boolean = false;  // If true, component is only visible on blueprint stages in editor

    // Drag & Drop Properties
    public draggable: boolean = false;
    public dragMode: 'move' | 'copy' = 'move';
    public droppable: boolean = false;

    constructor(name: string) {
        this.id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = name;
        this.className = this.constructor.name; // Set default from constructor
        this.events = {}; // Initialize empty events object to avoid undefined errors in Inspector
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
     * Unterstützt verschachtelte Property-Pfade (z.B. 'style.backgroundColor').
     */
    public toJSON(): any {
        const json: any = {
            className: (this as any).className || this.constructor.name,
            id: this.id,
            isVariable: this.isVariable,
            isService: this.isService,
            isHiddenInRun: this.isHiddenInRun,
            isBlueprintOnly: this.isBlueprintOnly
        };

        // Events separat behandeln
        if (this.events && Object.keys(this.events).length > 0) {
            json.events = this.events;
        }

        // Alle Properties aus dem Inspector durchgehen
        const props = this.getInspectorProperties();
        props.forEach(p => {
            if (p.serializable === false) return; // Nicht speichern

            // PREFER DESIGN VALUE (Formula) over current runtime value for persistence
            const designValues = (this as any)[DESIGN_VALUES];
            const value = (designValues && designValues[p.name] !== undefined)
                ? designValues[p.name]
                : this.getPropertyValue(p.name);

            if (value !== undefined) {
                if (!p.name.includes('.')) {
                    json[p.name] = value;
                } else {
                    // Handle nested paths (e.g. style.backgroundColor)
                    const parts = p.name.split('.');
                    let current = json;
                    for (let i = 0; i < parts.length - 1; i++) {
                        const part = parts[i];
                        if (!current[part]) current[part] = {};
                        current = current[part];
                    }
                    current[parts[parts.length - 1]] = value;
                }
            }
        });

        // Kinder rekursiv serialisieren
        if (this.children.length > 0) {
            json.children = this.children.map(child => child.toJSON());
        }

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

    /**
     * JS-Integration: Erlaubt es Komponenten, in Ausdrücken (z.B. currentPIN + '2')
     * direkt ihren Wert zu verwenden.
     */
    public valueOf(): any {
        if (this.isVariable) {
            if ((this as any).value !== undefined) return (this as any).value;
            if ((this as any).items !== undefined) return (this as any).items;
        }
        return this;
    }

    public toString(): string {
        const val = this.valueOf();
        if (val === this) return `[${(this as any).className || this.constructor.name}: ${this.name}]`;
        if (Array.isArray(val)) return val.join(', ');
        return String(val ?? '');
    }
}
