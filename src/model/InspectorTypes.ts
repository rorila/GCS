/**
 * InspectorTypes.ts — Reine Daten-Interfaces für die Inspector-Darstellung.
 * 
 * Diese Typen leben im Model-Layer, damit Runtime-Komponenten (TComponent etc.)
 * ihre Inspector-Sektionen deklarieren können, OHNE den Editor zu importieren.
 * 
 * @since v3.20.1 (CleanCode Phase 2, Slice 2.1)
 */

// ─────────────────────────────────────────────
// TPropertyDef: Beschreibung einer einzelnen Property im Inspector
// ─────────────────────────────────────────────

export interface TPropertyDef {
    name: string;      // Property key or path (e.g. 'x', 'style.backgroundColor')
    label: string;     // Display label
    type: 'string' | 'number' | 'boolean' | 'color' | 'select' | 'checkbox' | 'image_picker' | 'audio_picker' | 'video_picker' | 'json' | 'button' | 'text' | 'textarea' | 'TVariableSelect' | 'TObjectSelect';
    group?: string;    // 'Geometry', 'Style', 'Identity' etc.
    readonly?: boolean;
    serializable?: boolean; // Ob die Property gespeichert werden soll (default: true)
    editorOnly?: boolean;   // Ob die Property nur im Editor relevant ist (default: false)
    defaultValue?: any;     // Standardwert
    step?: number | string; // for number inputs
    min?: number;      // for number inputs
    max?: number;      // for number inputs
    options?: (string | { value: string; label: string })[]; // for select type
    selectedValue?: any; // Explicitly set value (overrides binding)
    source?: string;    // for select type - dynamic source name (e.g. 'availableModels')
    hint?: string;      // Tooltip or hint text
    placeholder?: string; // Input placeholder
    style?: any;       // For button type: custom CSS styles
    action?: string;   // For button type: internal action name
    actionData?: any;  // For button type: payload for action
    inline?: boolean;  // Display horizontally if possible
    controlName?: string; // Custom control name attribute for E2E selectors
    buttonType?: string;  // Button variant: 'primary', 'secondary' etc.
    variable?: string;    // Bound variable name for proxy getters/setters
}

// ─────────────────────────────────────────────
// InspectorSection: Eine Gruppe von Properties im Inspector-Panel
// ─────────────────────────────────────────────

/**
 * Eine Sektion im Inspector-Panel (z.B. "Allgemein", "Konfiguration", "Geometrie").
 * Jede Sektion enthält eine Liste von Properties, die als Gruppe gerendert werden.
 */
export interface InspectorSection {
    /** Eindeutige ID der Sektion, z.B. 'allgemein', 'konfiguration' */
    id: string;
    /** Anzeige-Label, z.B. 'Allgemein', 'Konfiguration' */
    label: string;
    /** Optionales Icon (Emoji), z.B. '⚙️' */
    icon?: string;
    /** Standardmäßig eingeklappt? (default: false) */
    collapsed?: boolean;
    /** Properties in dieser Sektion */
    properties: TPropertyDef[];
}

// ─────────────────────────────────────────────
// IInspectable: Interface für selbst-beschreibende Objekte
// ─────────────────────────────────────────────

/**
 * IInspectable — Interface für Objekte, die ihre Inspector-Darstellung selbst steuern.
 *
 * Anstatt dass der Inspector über Handler-Ketten und Templates die Felder bestimmt,
 * deklariert das Objekt selbst:
 * 1. Welche Sektionen/Felder angezeigt werden (getInspectorSections)
 * 2. Wie Property-Änderungen angewendet werden (applyChange)
 *
 * Dies ist die Single Source of Truth für die Inspector-UI.
 */
export interface IInspectable {
    /** Deklariert die Inspector-Sektionen mit allen Feldern */
    getInspectorSections(): InspectorSection[];

    /**
     * Wendet eine Property-Änderung an (inkl. Projekt-JSON Sync).
     * Das Objekt ist verantwortlich für:
     * - Lokale Daten updaten
     * - Projekt-JSON (SSoT) updaten
     * - Visuelles Update auslösen
     *
     * @returns true wenn ein vollständiger Inspector-Re-Render nötig ist (z.B. bei Typ-Wechsel)
     */
    applyChange(propertyName: string, newValue: any, oldValue?: any): boolean;

    /** Optional: Welche Events-Tabs das Objekt unterstützt */
    getInspectorEvents?(): { name: string; label: string; mappedTask?: string }[];
}

/**
 * Type Guard: Prüft ob ein Objekt IInspectable implementiert
 */
export function isInspectable(obj: any): obj is IInspectable {
    return obj &&
        typeof obj.getInspectorSections === 'function' &&
        typeof obj.applyChange === 'function';
}
