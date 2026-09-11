import { projectObjectRegistry } from '../../services/registry/ObjectRegistry';
import { projectVariableRegistry } from '../../services/registry/VariableRegistry';
import { REFERENCE_SOURCES, isReplaceableValue } from '../../runtime/actions/ActionReferences';

/** Ermittelt die eindeutige ID zu einem ausgewaehlten Objekt-/Variablennamen. */
export function lookupReferenceId(source: string | undefined, selectedName: string): string {
    if (!source || !REFERENCE_SOURCES.has(source)) return '';
    if (!selectedName || !isReplaceableValue(selectedName)) return '';
    const target = projectObjectRegistry.getObjects().find((o: any) => o.name === selectedName)
        || projectVariableRegistry.getVariables().find((v: any) => v.name === selectedName);
    return (target as any)?.id || '';
}


/**
 * Safely applies styles to an element, supporting both objects and strings.
 */
export function applyStyle(el: HTMLElement, style: any): void {
    if (!style) return;
    if (typeof style === 'string') {
        // Apply as cssText (merge with existing if possible or replace safe)
        el.style.cssText += ';' + style;
    } else if (typeof style === 'object') {
        Object.assign(el.style, style);
    }
}

