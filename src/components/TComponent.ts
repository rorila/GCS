import { IInspectable, InspectorSection, TPropertyDef } from '../model/InspectorTypes';
import { ComponentData, GridConfig } from '../model/types';

// Re-Export für Abwärtskompatibilität: Andere Dateien, die TPropertyDef aus TComponent importieren
export type { TPropertyDef } from '../model/InspectorTypes';

// TPropertyDef wird nun aus model/InspectorTypes.ts importiert und re-exportiert (siehe oben)

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
        handleEvent: (objectId: string, eventName: string, data?: unknown) => void;
        render: () => void;
        gridConfig: GridConfig;
        objects: ComponentData[];
    }): void;

    onRuntimeStart?(): void;
    onRuntimeUpdate?(deltaTime: number): void;
    onRuntimeStop?(): void;
}

/** Icon-Mapping für bekannte Gruppen-Namen in InspectorSections */
const GROUP_ICONS: Record<string, string> = {
    'IDENTITÄT': '🏷️',
    'GEOMETRIE': '📐',
    'DARSTELLUNG': '🎨',
    'STIL': '🎨',
    'INHALT': '📝',
    'TYPOGRAFIE': '🔤',
    'ICON': '🖼️',
    'INTERAKTION': '🖱️',
    'KONFIGURATION': '⚙️',
    'DATEN': '📊',
    'ANIMATION': '🎬',
    'NETZWERK': '🌐',
    'SICHERHEIT': '🔒',
    // DataAction SQL-Gruppen
    'FROM / DATENQUELLE': '📦',
    'SELECT / FELDER': '🔍',
    'INTO / ERGEBNIS': '💾',
    'WHERE / FILTER': '🔎',
    'HTTP / REQUEST': '⚙️',
};

/** Farb-Mapping für Inspector-Gruppen (farbige Bordüren & Header) */
export const GROUP_COLORS: Record<string, string> = {
    'ALLGEMEIN': '#666666',
    // Komponenten-Inspector Sektionen
    'IDENTITÄT': '#89b4fa',
    'INTERAKTION': '#fab387',
    'GEOMETRIE': '#a6e3a1',
    'TYPOGRAFIE': '#cba6f7',
    'STIL': '#f38ba8',
    'GLOW-EFFEKT': '#f5c2e7',
    'DARSTELLUNG': '#f9e2af',
    'INHALT': '#94e2d5',
    'KONFIGURATION': '#74c7ec',
    'DATEN': '#89dceb',
    'ANIMATION': '#e67e22',
    'NETZWERK': '#7f8c8d',
    'SICHERHEIT': '#eba0ac',
    // Sprite-spezifische Sektionen
    'MOTION': '#f9e2af',
    'INTERPOLATION': '#b4befe',
    'COLLISION': '#f38ba8',
    'APPEARANCE': '#94e2d5',
    // Weitere Komponenten-Sektionen
    'BILD': '#89dceb',
    'ICON': '#cba6f7',
    'TIMER': '#fab387',
    // DataAction SQL-Gruppen
    'FROM / DATENQUELLE': '#2980b9',
    'SELECT / FELDER': '#27ae60',
    'INTO / ERGEBNIS': '#e67e22',
    'WHERE / FILTER': '#c0392b',
    'HTTP / REQUEST': '#7f8c8d',
    // Stage-Inspector Sektionen
    'BASIS': '#4da6ff',
    'RASTER': '#e6a817',
    'SPLASH SCREEN': '#a855f7',
};

export abstract class TComponent implements IInspectable {
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
            { name: 'draggable', label: 'Draggable', type: 'boolean', group: 'INTERAKTION', editorOnly: true, inline: true },
            { name: 'droppable', label: 'Droppable', type: 'boolean', group: 'INTERAKTION', editorOnly: true, inline: true },
            { name: 'dragMode', label: 'Drag Mode', type: 'select', group: 'INTERAKTION', options: ['move', 'copy'], editorOnly: true }
        ];
    }

    // =========================================================================
    // IInspectable: Component-Owned Inspector
    // =========================================================================

    /**
     * Auto-Konvertierung: Gruppiert getInspectorProperties() nach 'group'
     * und erzeugt daraus InspectorSection[].
     * 
     * Unterklassen können diese Methode überschreiben um eigene Sektionen zu definieren.
     */
    public getInspectorSections(): InspectorSection[] {
        const props = this.getInspectorProperties();

        // Unsichtbare Service-Komponenten/Variablen: Rein visuelle Gruppen ausblenden,
        // da diese Komponenten zur Laufzeit nicht gerendert werden.
        const hiddenGroups = this.isHiddenInRun
            ? ['STIL', 'GLOW-EFFEKT', 'TYPOGRAFIE', 'INTERAKTION']
            : [];

        const groupMap = new Map<string, TPropertyDef[]>();
        const groupOrder: string[] = [];

        for (const prop of props) {
            const group = prop.group || 'ALLGEMEIN';
            if (hiddenGroups.includes(group)) continue;
            if (!groupMap.has(group)) {
                groupMap.set(group, []);
                groupOrder.push(group);
            }
            groupMap.get(group)!.push(prop);
        }

        return groupOrder.map(groupName => ({
            id: groupName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            label: groupName,
            icon: GROUP_ICONS[groupName] || '📋',
            collapsed: false,
            properties: groupMap.get(groupName)!
        }));
    }

    /**
     * Property-Änderung anwenden.
     * Wird vom InspectorHost aufgerufen um zu prüfen ob ein Re-Render nötig ist.
     * Die eigentliche Persistierung läuft über eventHandler.handleControlChange().
     * 
     * @returns true wenn ein vollständiger Inspector-Re-Render nötig ist
     */
    public applyChange(propertyName: string, _newValue: any, _oldValue?: any): boolean {
        // Name-Änderungen erfordern Re-Render (Header ändert sich)
        if (propertyName === 'name') return true;
        // Scope-Änderungen erfordern Re-Render (könnte Sektionen beeinflussen)
        if (propertyName === 'scope') return true;
        return false;
    }

    /**
     * Liefert die Liste aller unterstützten Events für diese Komponente.
     */
    public getEvents(): string[] {
        return ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave', 'onDragStart', 'onDragEnd', 'onDrop', 'onTouchStart', 'onTouchMove', 'onTouchEnd'];
    }

    /**
     * Events-Tab: Exportiert die Event-Bindings für den Inspector.
     */
    public getInspectorEvents(): { name: string; label: string; mappedTask?: string }[] {
        if (!this.events) return [];
        const standardEvents = this.getEvents();
        return standardEvents.map(eventName => ({
            name: eventName,
            label: eventName.replace(/^on/, ''),
            mappedTask: this.events?.[eventName] || undefined
        }));
    }

    // =========================================================================
    // Serialization
    // =========================================================================

    /**
     * Konvertiert die Komponente in ein reines Daten-Objekt (DTO) ohne
     * Zirkelreferenzen, Methoden oder Runtime-Properties.
     * 
     * Nutzt die Inspector-Metadaten (getInspectorProperties) um nur
     * serialisierbare Properties zu extrahieren. Bevorzugt DESIGN_VALUES
     * (Formeln) gegenüber aktuellen Runtime-Werten.
     * 
     * @since v3.22.0 (CleanCode Phase 2, Slice 2.5)
     */
    public toDTO(): ComponentData {
        const dto: any = {
            className: (this as any).className || this.constructor.name,
            id: this.id,
            name: this.name,
            scope: this.scope,
            isVariable: this.isVariable || undefined,
            isService: this.isService || undefined,
            isHiddenInRun: this.isHiddenInRun || undefined,
            isTransient: this.isTransient || undefined,
            draggable: this.draggable || undefined,
            droppable: this.droppable || undefined,
            dragMode: this.dragMode !== 'move' ? this.dragMode : undefined,
        };

        // Events separat behandeln
        if (this.events && Object.keys(this.events).length > 0) {
            dto.events = { ...this.events };
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
                    dto[p.name] = value;
                } else {
                    // Handle nested paths (e.g. style.backgroundColor)
                    const parts = p.name.split('.');
                    let current = dto;
                    for (let i = 0; i < parts.length - 1; i++) {
                        const part = parts[i];
                        if (!current[part]) current[part] = {};
                        current = current[part];
                    }
                    current[parts[parts.length - 1]] = value;
                }
            }
        });

        // Kinder rekursiv konvertieren
        if (this.children.length > 0) {
            dto.children = this.children.map(child => {
                if (typeof child.toDTO === 'function') {
                    return child.toDTO();
                }
                if (typeof child.toJSON === 'function') {
                    return child.toJSON();
                }
                return child; // Plain object – as-is übernehmen
            });
        }

        // undefined-Werte entfernen (saubereres JSON)
        Object.keys(dto).forEach(key => {
            if (dto[key] === undefined) delete dto[key];
        });

        return dto as ComponentData;
    }

    /**
     * Abwärtskompatibilität: JSON.stringify() ruft toJSON() automatisch auf.
     * Delegiert an toDTO().
     */
    public toJSON(): any {
        return this.toDTO();
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

