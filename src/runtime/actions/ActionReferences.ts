import { Logger } from '../../utils/Logger';

const logger = Logger.get('ActionReferences', 'Runtime_Execution');

/**
 * Parameter-Quellen, deren Wert auf ein Projekt-Objekt verweist.
 * Nur fuer diese Parameter wird ein ID-Referenzfeld gepflegt.
 */
export const REFERENCE_SOURCES = new Set([
    'objects',
    'variables',
    'objects_and_services',
    'objects_and_variables',
    'imageLists',
    'animations',
    'theme_dialogs'
]);

/** Suffix des Begleitfeldes, das die Objekt-ID zu einem Namensfeld haelt. */
export const REF_SUFFIX = '_ref';

/** Werte, die keine Objektreferenz sind und daher nie ersetzt werden. */
const NON_REFERENCE_VALUES = new Set(['self', 'other', '%self%', '%other%']);

/** Gehoert zu diesem Parameter ein ID-Referenzfeld? */
export function isReferenceParameter(param: any): boolean {
    return !!param && typeof param.source === 'string' && REFERENCE_SOURCES.has(param.source);
}

/** Name des Referenzfeldes zu einem Parameter (z.B. "target" -> "target_ref"). */
export function refFieldName(paramName: string): string {
    return `${paramName}${REF_SUFFIX}`;
}

/**
 * Darf der aktuelle Wert durch eine ID ersetzt werden?
 * Magic-Werte (self/other) und ${...}-Bindungen bleiben unangetastet.
 */
export function isReplaceableValue(value: any): boolean {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (trimmed.includes('${')) return false;
    return !NON_REFERENCE_VALUES.has(trimmed.toLowerCase());
}

/**
 * Ersetzt Namensreferenzen durch die eindeutige Objekt-ID.
 *
 * Hintergrund: Objektnamen sind projektweit NICHT eindeutig (dieselbe Stage-Vorlage
 * kann in mehreren Stages existieren). Alle Resolver akzeptieren bereits Name ODER
 * ID — indem wir hier auf die ID normalisieren, wird die Aufloesung eindeutig, ohne
 * jeden einzelnen Handler anzufassen.
 *
 * Tolerantes Verhalten: Zeigt die gespeicherte ID auf kein vorhandenes Objekt,
 * bleibt der Name als Fallback stehen und es wird gewarnt.
 *
 * @returns Die Action selbst oder eine flache Kopie mit ersetzten Werten.
 */
export function applyReferenceIds(action: any, metadata: any, objects: any[]): any {
    if (!action || !metadata?.parameters || !Array.isArray(objects) || objects.length === 0) {
        return action;
    }

    let patched: any = null;

    for (const param of metadata.parameters) {
        if (!isReferenceParameter(param)) continue;

        const refId = action[refFieldName(param.name)];
        if (!refId || typeof refId !== 'string') continue;

        const current = action[param.name];
        if (current === refId) continue;
        if (!isReplaceableValue(current)) continue;

        const exists = objects.some(o => o && o.id === refId);
        if (!exists) {
            logger.warn(
                `Referenz "${refFieldName(param.name)}" = "${refId}" zeigt auf kein vorhandenes Objekt. ` +
                `Fallback auf den Namen "${current}".`
            );
            continue;
        }

        if (!patched) patched = { ...action };
        patched[param.name] = refId;
    }

    return patched || action;
}
