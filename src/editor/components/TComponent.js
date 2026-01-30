export class TComponent {
    constructor(name) {
        this.parent = null;
        this.children = [];
        this.scope = 'stage'; // Visibility scope
        this.isVariable = false; // Flag for variable-like components
        // Drag & Drop Properties
        this.draggable = false;
        this.dragMode = 'move';
        this.droppable = false;
        this.id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = name;
        this.className = this.constructor.name; // Set default from constructor
        this.Tasks = {}; // Initialize empty tasks object to avoid undefined errors in Inspector
    }
    getBaseProperties() {
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
    toJSON() {
        const json = {
            className: this.className || this.constructor.name,
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
            if (p.serializable === false)
                return; // Nicht speichern
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
    getPropertyValue(path) {
        if (!path.includes('.'))
            return this[path];
        const parts = path.split('.');
        let current = this;
        for (const part of parts) {
            if (current === undefined || current === null)
                return undefined;
            current = current[part];
        }
        return current;
    }
    addChild(child) {
        if (child.parent) {
            child.parent.removeChild(child);
        }
        child.parent = this;
        this.children.push(child);
    }
    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parent = null;
        }
    }
    findChild(name) {
        return this.children.find(c => c.name === name) || null;
    }
}
