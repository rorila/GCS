import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';
import { resolveTarget } from '../ActionHelper';
import { DebugLogService } from '../../../services/DebugLogService';
import { Logger } from '../../../utils/Logger';

const runtimeLogger = Logger.get('RecordListAction', 'Runtime_Execution');

/**
 * REGISTRIERUNG DER RECORD-LIST-AKTIONEN
 *
 * Arbeiten auf einer TObjectList, die pro enthaltenem Objekt zusaetzliche
 * Felder verwaltet (recordData). Das Schema (fields) gilt list-weit.
 */

/** Sucht die TObjectList anhand von Name oder ID. */
function resolveList(name: string, context: any): any {
    if (!name) return null;

    let actualName = name;
    if (typeof actualName === 'string' && actualName.includes('${')) {
        actualName = PropertyHelper.interpolate(actualName, {
            ...context.contextVars,
            ...context.vars,
            $event: context.eventData,
            $eventData: context.eventData
        }, context.objects);
    }

    const list = context.objects?.find((o: any) =>
        (o.name === actualName || o.id === actualName) && o.className === 'TObjectList'
    );

    if (!list) {
        runtimeLogger.warn(`RecordList: "${actualName}" ist keine TObjectList oder wurde nicht gefunden`);
    }
    return list || null;
}

/**
 * Loest das Zielobjekt auf und liefert dessen ID (Schluessel in recordData).
 *
 * Akzeptiert: leer/self (ausloesendes Objekt), Objektname, Objekt-ID,
 * ${Variable} sowie einen numerischen Zeilenindex (0-basiert).
 */
function resolveRowId(rawTarget: string, list: any, context: any): string | null {
    // Leeres Ziel bedeutet "ausloesendes Objekt". Der Inspector zeigt "self" als
    // erste Option an, speichert ohne Auswahl-Aenderung aber einen Leerstring.
    const raw = (rawTarget === undefined || rawTarget === null || String(rawTarget).trim() === '')
        ? 'self'
        : rawTarget;

    const interpolated = typeof raw === 'string' && raw.includes('${')
        ? PropertyHelper.interpolate(raw, {
            ...context.contextVars,
            ...context.vars,
            $event: context.eventData,
            $eventData: context.eventData
        }, context.objects)
        : raw;

    const items: string[] = Array.isArray(list.items) ? list.items : [];

    // Numerischer Zeilenindex (z.B. 0 oder ${loopIndex})
    const asIndex = Number(interpolated);
    if (String(interpolated).trim() !== '' && Number.isInteger(asIndex) && asIndex >= 0 && asIndex < items.length) {
        return items[asIndex];
    }

    const obj = resolveTarget(String(interpolated), context.objects, context.vars, context.eventData);
    if (obj?.id && items.includes(obj.id)) return obj.id;
    if (obj?.name && items.includes(obj.name)) return obj.name;

    // Fallback: direkter ID-Treffer ohne Objektaufloesung (z.B. aus record_find)
    if (items.includes(String(interpolated))) return String(interpolated);

    runtimeLogger.warn(`RecordList "${list.name}": Ziel "${interpolated}" ist nicht in der Liste enthalten`);
    DebugLogService.getInstance().log('Event',
        `[record] Ziel "${interpolated}" nicht aufloesbar in "${list.name}"`,
        {
            data: {
                rawTarget,
                interpolated,
                resolvedId: obj?.id,
                resolvedName: obj?.name,
                items
            }
        }
    );
    return null;
}

/** Interpoliert einen Wert und wandelt "true"/"false"/Zahlen in native Typen. */
function parseValue(raw: any, context: any): any {
    let value = raw;
    if (typeof value === 'string' && value.includes('${')) {
        value = PropertyHelper.interpolate(value, {
            ...context.contextVars,
            ...context.vars,
            $event: context.eventData,
            $eventData: context.eventData
        }, context.objects);
    }
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;
    if (trimmed !== '' && !isNaN(Number(trimmed))) return Number(trimmed);
    return value;
}

/** Schreibt ein Ergebnis in lokale + globale Vars sowie in das TVariable-Objekt. */
function writeResult(name: string, value: any, context: any): void {
    if (!name) return;

    // Der Inspector speichert Variablen teils als "${VarName}" — ohne Bereinigung
    // entstuende eine Variable, die woertlich "${VarName}" heisst.
    const clean = String(name).replace(/^\$\{\s*/, '').replace(/\s*\}$/, '').trim();
    if (!clean) return;

    context.vars[clean] = value;
    context.contextVars[clean] = value;

    const varObj = context.objects?.find((o: any) =>
        (o.name === clean || o.id === clean) &&
        (o.isVariable === true || o.className?.includes('Variable'))
    );
    if (varObj) varObj.value = value;
}

/** Haelt die abgeleitete Tabellenansicht aktuell. */
function refresh(list: any, context: any): void {
    if (typeof list.rebuildData === 'function') {
        list.rebuildData(context.objects || []);
    }
}

/** Vergleicht zwei Werte tolerant gegenueber String/Number/Boolean-Mischformen. */
function valuesMatch(a: any, b: any): boolean {
    if (a === b) return true;
    if (a === undefined || a === null || b === undefined || b === null) return false;
    return String(a) === String(b);
}

const LIST_PARAM = { name: 'list', label: 'Objekt-Liste', type: 'select' as const, source: 'objects', placeholder: '--- TObjectList waehlen ---' };
const FIELD_PARAM = { name: 'field', label: 'Feldname', type: 'string' as const, placeholder: 'z.B. isSelected' };

export function registerRecordListActions() {

    // ─── record_set: Feldwert einer Zeile setzen ───
    actionRegistry.register('record_set', (action, context) => {
        const list = resolveList(action.list, context);
        if (!list) return;

        const rowId = resolveRowId(action.target, list, context);
        if (!rowId) return;

        const field = String(action.field || '').trim();
        if (!field) {
            runtimeLogger.warn(`record_set: Kein Feldname angegeben`);
            return;
        }

        const value = parseValue(action.value, context);
        if (typeof list.setRecordValue === 'function') {
            list.setRecordValue(rowId, field, value);
        } else {
            if (!list.recordData) list.recordData = {};
            if (!list.recordData[rowId]) list.recordData[rowId] = {};
            list.recordData[rowId][field] = value;
        }

        refresh(list, context);
        DebugLogService.getInstance().log('Action', `record_set: ${list.name}[${rowId}].${field} = ${JSON.stringify(value)}`);
    }, {
        type: 'record_set',
        label: 'Record: Wert setzen',
        description: 'Setzt ein Record-Feld fuer ein Objekt in einer TObjektliste.',
        parameters: [
            LIST_PARAM,
            { name: 'target', label: 'Ziel-Objekt', type: 'select', source: 'objects', allowVariableBinding: true, defaultValue: 'self', placeholder: 'self / Objektname / Zeilenindex' },
            FIELD_PARAM,
            { name: 'value', label: 'Wert', type: 'string', placeholder: 'true / false / Zahl / ${var}' }
        ]
    });

    // ─── record_get: Feldwert einer Zeile lesen ───
    actionRegistry.register('record_get', (action, context) => {
        const list = resolveList(action.list, context);
        if (!list) return;

        const rowId = resolveRowId(action.target, list, context);
        const field = String(action.field || '').trim();

        let value: any = undefined;
        if (rowId && field) {
            value = typeof list.getRecordValue === 'function'
                ? list.getRecordValue(rowId, field)
                : list.recordData?.[rowId]?.[field];
        }

        writeResult(action.resultVariable, value, context);
        DebugLogService.getInstance().log('Action', `record_get: ${list.name}[${rowId}].${field} -> ${JSON.stringify(value)}`);
    }, {
        type: 'record_get',
        label: 'Record: Wert lesen',
        description: 'Liest ein Record-Feld eines Objekts in eine Variable.',
        parameters: [
            LIST_PARAM,
            { name: 'target', label: 'Ziel-Objekt', type: 'select', source: 'objects', allowVariableBinding: true, defaultValue: 'self', placeholder: 'self / Objektname / Zeilenindex' },
            FIELD_PARAM,
            { name: 'resultVariable', label: 'Ergebnis in Variable', type: 'variable', source: 'variables' }
        ]
    });

    // ─── record_index: Index eines bestimmten Objekts ermitteln ───
    actionRegistry.register('record_index', (action, context) => {
        const list = resolveList(action.list, context);
        if (!list) return;

        const rowId = resolveRowId(action.target, list, context);
        const items: string[] = Array.isArray(list.items) ? list.items : [];

        let index = -1;
        if (rowId) {
            index = items.indexOf(rowId);
        }

        writeResult(action.resultVariable, index, context);
        DebugLogService.getInstance().log('Action', `record_index: ${list.name}[${rowId}] -> index ${index}`);
    }, {
        type: 'record_index',
        label: 'Record: Index ermitteln',
        description: 'Liefert den 0-basierten Listenindex eines Objekts in einer TObjectList.',
        parameters: [
            LIST_PARAM,
            { name: 'target', label: 'Ziel-Objekt', type: 'select', source: 'objects', allowVariableBinding: true, defaultValue: 'self', placeholder: 'self / Objektname / Zeilenindex' },
            { name: 'resultVariable', label: 'Ergebnis in Variable', type: 'variable', source: 'variables' }
        ]
    });

    // ─── record_find: Alle Objekt-IDs mit passendem Feldwert ───
    actionRegistry.register('record_find', (action, context) => {
        const list = resolveList(action.list, context);
        if (!list) return;

        const field = String(action.field || '').trim();
        const expected = parseValue(action.value, context);
        const items: string[] = Array.isArray(list.items) ? list.items : [];

        const matches = items.filter((id: string) => valuesMatch(list.recordData?.[id]?.[field], expected));

        writeResult(action.resultVariable, matches, context);
        DebugLogService.getInstance().log('Action', `record_find: ${list.name}.${field} == ${JSON.stringify(expected)} -> ${matches.length} Treffer`);
    }, {
        type: 'record_find',
        label: 'Record: Zeilen suchen',
        description: 'Schreibt alle Objekt-IDs mit passendem Feldwert als Liste in eine Variable.',
        parameters: [
            LIST_PARAM,
            FIELD_PARAM,
            { name: 'value', label: 'Gesuchter Wert', type: 'string', placeholder: 'true / false / Zahl / ${var}' },
            { name: 'resultVariable', label: 'Ergebnis in Variable', type: 'variable', source: 'variables' }
        ]
    });

    // ─── record_count: Anzahl passender Zeilen ───
    actionRegistry.register('record_count', (action, context) => {
        const list = resolveList(action.list, context);
        if (!list) return;

        const field = String(action.field || '').trim();
        const expected = parseValue(action.value, context);
        const items: string[] = Array.isArray(list.items) ? list.items : [];

        const count = items.filter((id: string) => valuesMatch(list.recordData?.[id]?.[field], expected)).length;

        writeResult(action.resultVariable, count, context);
        DebugLogService.getInstance().log('Action', `record_count: ${list.name}.${field} == ${JSON.stringify(expected)} -> ${count}`);
    }, {
        type: 'record_count',
        label: 'Record: Zeilen zaehlen',
        description: 'Zaehlt alle Zeilen mit passendem Feldwert (z.B. Siegbedingung).',
        parameters: [
            LIST_PARAM,
            FIELD_PARAM,
            { name: 'value', label: 'Gesuchter Wert', type: 'string', placeholder: 'true / false / Zahl / ${var}' },
            { name: 'resultVariable', label: 'Ergebnis in Variable', type: 'variable', source: 'variables' }
        ]
    });

    // ─── record_reset: Feld in allen Zeilen zuruecksetzen ───
    actionRegistry.register('record_reset', (action, context) => {
        const list = resolveList(action.list, context);
        if (!list) return;

        const field = String(action.field || '').trim();
        if (!field) {
            runtimeLogger.warn(`record_reset: Kein Feldname angegeben`);
            return;
        }

        const hasExplicitValue = action.value !== undefined && action.value !== null && action.value !== '';
        const value = hasExplicitValue ? parseValue(action.value, context) : undefined;

        let count = 0;
        if (typeof list.resetField === 'function') {
            count = list.resetField(field, value);
        } else {
            const items: string[] = Array.isArray(list.items) ? list.items : [];
            if (!list.recordData) list.recordData = {};
            items.forEach((id: string) => {
                if (!list.recordData[id]) list.recordData[id] = {};
                list.recordData[id][field] = value;
                count++;
            });
        }

        refresh(list, context);
        DebugLogService.getInstance().log('Action', `record_reset: ${list.name}.${field} in ${count} Zeilen zurueckgesetzt`);
    }, {
        type: 'record_reset',
        label: 'Record: Feld zuruecksetzen',
        description: 'Setzt ein Feld in allen Zeilen auf den Default oder einen festen Wert.',
        parameters: [
            LIST_PARAM,
            FIELD_PARAM,
            { name: 'value', label: 'Wert (leer = Default)', type: 'string', placeholder: 'leer lassen fuer Schema-Default' }
        ]
    });
}
