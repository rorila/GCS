
import { ReactiveRuntime } from '../../runtime/ReactiveRuntime';
import { GameProject } from '../../model/types';
import { TPropertyDef } from '../../components/TComponent';

/**
 * Interface for a property change event
 */
export interface PropertyChangeEvent {
    object: any;
    propertyName: string;
    newValue: any;
    oldValue: any;
    config?: any; // Original inspector UI object (from JSON)
}

/**
 * Interface for specialized Inspector handlers
 */
export interface IInspectorHandler {
    /**
     * Checks if this handler can handle the given object
     */
    canHandle(obj: any): boolean;

    /**
     * Handles a property change delegation
     * @returns boolean true if the change was handled, false otherwise
     */
    handlePropertyChange(event: PropertyChangeEvent, project: GameProject, runtime: ReactiveRuntime): boolean;

    /**
     * Optional: Returns specialized inspector properties for this component
     */
    getInspectorProperties?(obj: any): any[];

    /**
     * Optional: Returns a custom template file path for this component
     */
    getInspectorTemplate?(obj: any): string | null;

    /**
     * Optional: Returns a custom events template file path for this component
     */
    getEventsTemplate?(obj: any): string | null;
}

// =====================================================================
// IInspectable: Component-Owned Inspector Architecture
// =====================================================================

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

