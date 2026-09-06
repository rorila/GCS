import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';
import { DebugLogService } from '../../../services/DebugLogService';
import { Logger } from '../../../utils/Logger';

const runtimeLogger = Logger.get('CollectionAction', 'Runtime_Execution');

/**
 * Mulberry32 PRNG — Deterministisches Shuffling mit Seed.
 * Wenn kein Seed angegeben wird, wird Math.random() verwendet.
 */
function mulberry32(seed: number): () => number {
    return () => {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/**
 * Fisher-Yates Shuffle mit optionalem deterministischem Seed.
 */
function shuffleArray<T>(arr: T[], seed?: number): T[] {
    const result = [...arr];
    const rng = seed !== undefined ? mulberry32(seed) : Math.random;
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Löst den Namen einer Collection-Variable auf und gibt deren aktuellen Wert zurück.
 * Sucht in vars → contextVars → objects (TVariable).
 */
function resolveCollection(name: string, context: any): any {
    if (!name) return undefined;

    // Interpolation: Falls ${...} enthalten
    if (typeof name === 'string' && name.includes('${')) {
        name = PropertyHelper.interpolate(name, { ...context.contextVars, ...context.vars }, context.objects);
    }

    // resolveValue kennt alle Ablage-Slots: items (TListVariable), data (TObjectList),
    // entries (TStringMap) und value (skalare Variablen). Der Aufruf ist auch fuer
    // vars/contextVars noetig, weil GameRuntime jedes Objekt zusaetzlich unter seinem
    // Namen in die Event-Vars legt — dort steckt also die Komponente, kein Array.
    // 1. Lokale Vars
    if (context.vars[name] !== undefined) return PropertyHelper.resolveValue(context.vars[name]);
    // 2. Globale Vars
    if (context.contextVars[name] !== undefined) return PropertyHelper.resolveValue(context.contextVars[name]);
    // 3. TVariable-Objekt
    const varObj = findVariableObject(name, context);
    if (varObj) return PropertyHelper.resolveValue(varObj);

    return undefined;
}

/** Sucht das Variablen-Objekt zu einem Namen bzw. einer ID. */
function findVariableObject(name: string, context: any): any {
    return context.objects?.find((o: any) =>
        (o.name === name || o.id === name) &&
        (o.isVariable === true || o.className?.includes('Variable'))
    );
}

/**
 * Entfernt eine umschliessende ${...}-Bindung aus einem Variablen-NAMEN.
 * Der Variablen-Picker im Inspector traegt Bindungen auch in Namensfelder ein.
 */
function cleanVariableName(name: string): string {
    return String(name).replace(/^\$\{\s*/, '').replace(/\s*\}$/, '').trim();
}

/**
 * Schreibt einen Wert zurück in eine Variable (lokal, global und TVariable-Objekt).
 */
function writeVariable(name: string, value: any, context: any): void {
    const clean = cleanVariableName(name);
    if (!clean) return;

    context.vars[clean] = value;
    context.contextVars[clean] = value;

    // TVariable-Objekt synchronisieren
    const varObj = findVariableObject(clean, context);
    if (!varObj) {
        runtimeLogger.warn(`Ergebnis-Variable "${clean}" ist kein bekanntes Variablen-Objekt`);
        DebugLogService.getInstance().log('Event',
            `[collection] Ergebnis-Variable "${clean}" existiert nicht als Variablen-Objekt`,
            { data: { rawName: name, cleanName: clean } }
        );
        return;
    }

    // In den Slot zurueckschreiben, aus dem resolveCollection auch liest.
    const isPlainObject = typeof value === 'object' && value !== null && !Array.isArray(value);
    if (Array.isArray(value) && Array.isArray(varObj.items)) {
        varObj.items = value;
    } else if (isPlainObject && varObj.entries !== undefined) {
        varObj.entries = value;
    } else {
        varObj.value = value;
    }

    // Abgeleitete Ansichten aktualisieren: Eine TObjectList berechnet data/columns
    // aus items. Ohne Rebuild zeigt die Tabelle nach z.B. list_shuffle weiterhin
    // die alte Reihenfolge — die record_*-Actions machen das schon so.
    if (typeof varObj.rebuildData === 'function') {
        varObj.rebuildData(context.objects || []);
    }
}

/**
 * Lesbare Bezeichnung einer Collection fuer das DebugLog.
 *
 * Zur Laufzeit steht im Action-Feld die eindeutige Objekt-ID (siehe ActionReferences).
 * Fuer die Diagnose ist aber der Name entscheidend — daher "Name (ID)".
 */
function describeCollection(nameOrId: string, context: any): string {
    const obj = findVariableObject(nameOrId, context)
        || (context.vars?.[nameOrId] && typeof context.vars[nameOrId] === 'object' ? context.vars[nameOrId] : null);
    const name = obj?.name;
    return name && name !== nameOrId ? `${name} (${nameOrId})` : String(nameOrId);
}

function interpolateValue(value: any, context: any): any {
    if (typeof value === 'string' && value.includes('${')) {
        return PropertyHelper.interpolate(value, { 
            ...context.contextVars, 
            ...context.vars, 
            $event: context.eventData, 
            $eventData: context.eventData 
        }, context.objects);
    }
    return value;
}

/**
 * REGISTRIERUNG ALLER COLLECTION-AKTIONEN (Feature B)
 * 
 * 9 Listen-Operationen + 5 Map-Operationen = 14 ActionTypes.
 * Alle Handler arbeiten direkt auf den Runtime-Variablen.
 */
export function registerCollectionActions() {

    // ═══════════════════════════════════════════════
    // LIST OPERATIONS
    // ═══════════════════════════════════════════════

    // ─── list_push: Element an Liste anhängen ───
    actionRegistry.register('list_push', (action, context) => {
        const listName = action.target || action.listName;
        let list = resolveCollection(listName, context);

        if (list === undefined || list === null) {
            list = [];
            writeVariable(listName, list, context);
        }

        if (!Array.isArray(list)) {
            runtimeLogger.warn(`list_push: "${listName}" ist kein Array (${typeof list})`);
            return;
        }

        const value = interpolateValue(action.value, context);
        list.push(value);
        writeVariable(listName, list, context);

        DebugLogService.getInstance().log('Action', `list_push: ${describeCollection(listName, context)} += ${JSON.stringify(value)} (len=${list.length})`);
    }, {
        type: 'list_push',
        label: 'Liste: Element hinzufügen',
        description: 'Hängt einen Wert an das Ende einer Liste an.',
        parameters: [
            { name: 'target', label: 'Listen-Variable', type: 'variable', source: 'variables' },
            { name: 'value', label: 'Wert', type: 'string', placeholder: 'Literal oder ${var}' }
        ]
    });

    // ─── list_pop: Letztes Element entfernen und in Variable speichern ───
    actionRegistry.register('list_pop', (action, context) => {
        const listName = action.target || action.listName;
        const list = resolveCollection(listName, context);

        if (!Array.isArray(list) || list.length === 0) {
            runtimeLogger.warn(`list_pop: "${listName}" ist leer oder kein Array`);
            if (action.resultVariable) {
                writeVariable(action.resultVariable, undefined, context);
            }
            return;
        }

        const value = list.pop();
        writeVariable(listName, list, context);

        if (action.resultVariable) {
            writeVariable(action.resultVariable, value, context);
        }

        DebugLogService.getInstance().log('Action', `list_pop: ${describeCollection(listName, context)} → ${JSON.stringify(value)} (len=${list.length})`);
    }, {
        type: 'list_pop',
        label: 'Liste: Letztes Element entfernen',
        description: 'Entfernt das letzte Element und speichert es optional in einer Variable.',
        parameters: [
            { name: 'target', label: 'Listen-Variable', type: 'variable', source: 'variables' },
            { name: 'resultVariable', label: 'Ergebnis-Variable (optional)', type: 'variable', source: 'variables' }
        ]
    });

    // ─── list_get: Element per Index lesen ───
    actionRegistry.register('list_get', (action, context) => {
        const listName = action.target || action.listName;
        const list = resolveCollection(listName, context);

        const label = describeCollection(listName, context);

        if (!Array.isArray(list)) {
            runtimeLogger.warn(`list_get: "${listName}" ist kein Array`);
            DebugLogService.getInstance().log('Event',
                `list_get FEHLER: ${label} ist keine Liste (${typeof list})`,
                { data: { listName, resolved: list } }
            );
            if (action.resultVariable) {
                writeVariable(action.resultVariable, action.defaultValue ?? undefined, context);
            }
            return;
        }

        let index = interpolateValue(action.index, context);
        index = Number(index);

        if (isNaN(index) || index < 0 || index >= list.length) {
            runtimeLogger.warn(`list_get: Index ${index} out of bounds (len=${list.length})`);
            DebugLogService.getInstance().log('Event',
                `list_get FEHLER: ${label} — Index ${index} liegt ausserhalb von 0..${list.length - 1}`,
                { data: { listName, rawIndex: action.index, index, length: list.length } }
            );
            if (action.resultVariable) {
                writeVariable(action.resultVariable, action.defaultValue ?? undefined, context);
            }
            return;
        }

        let value = list[index];

        // Optional nur ein Feld der Zeile uebernehmen. Eine TObjectList liefert
        // ganze Datensaetze ({ index, objectId, name, ... }); fuer Ziel-Felder
        // anderer Actions wird meist nur die objectId gebraucht.
        const field = String(action.field || '').trim();
        if (field) {
            if (value && typeof value === 'object') {
                value = (value as any)[field];
                if (value === undefined) {
                    runtimeLogger.warn(`list_get: Feld "${field}" existiert nicht in ${label}[${index}]`);
                    DebugLogService.getInstance().log('Event',
                        `list_get: Feld "${field}" fehlt in ${label}[${index}]`,
                        { data: { listName, index, field, row: list[index] } }
                    );
                    value = action.defaultValue ?? undefined;
                }
            } else {
                runtimeLogger.warn(`list_get: Feld "${field}" angegeben, aber ${label}[${index}] ist kein Objekt`);
            }
        }

        // Vor dem Schreiben loggen: sonst erscheinen erst die reaktiven
        // [Variable]-Eintraege und die Herkunft des Wertes bleibt unklar.
        DebugLogService.getInstance().log('Action',
            `list_get: ${label}[${index}]${field ? '.' + field : ''} = ${JSON.stringify(value)}`,
            { data: { listName, index, field, value, length: list.length } }
        );

        if (action.resultVariable) {
            writeVariable(action.resultVariable, value, context);
        }
    }, {
        type: 'list_get',
        label: 'Liste: Element lesen',
        description: 'Liest ein Element an einer bestimmten Position.',
        parameters: [
            { name: 'target', label: 'Listen-Variable', type: 'variable', source: 'variables' },
            { name: 'index', label: 'Index (0-basiert)', type: 'string', placeholder: '0 oder ${var}' },
            { name: 'field', label: 'Feld (optional)', type: 'string', placeholder: 'z.B. objectId — leer = ganze Zeile' },
            { name: 'resultVariable', label: 'Ergebnis-Variable', type: 'variable', source: 'variables' },
            { name: 'defaultValue', label: 'Standard-Wert (bei Fehler)', type: 'string' }
        ]
    });

    // ─── list_set: Element per Index setzen ───
    actionRegistry.register('list_set', (action, context) => {
        const listName = action.target || action.listName;
        const list = resolveCollection(listName, context);

        if (!Array.isArray(list)) {
            runtimeLogger.warn(`list_set: "${listName}" ist kein Array`);
            return;
        }

        let index = interpolateValue(action.index, context);
        index = Number(index);
        const value = interpolateValue(action.value, context);

        if (isNaN(index) || index < 0 || index >= list.length) {
            runtimeLogger.warn(`list_set: Index ${index} out of bounds (len=${list.length})`);
            return;
        }

        list[index] = value;
        writeVariable(listName, list, context);

        DebugLogService.getInstance().log('Action', `list_set: ${describeCollection(listName, context)}[${index}] = ${JSON.stringify(value)}`);
    }, {
        type: 'list_set',
        label: 'Liste: Element setzen',
        description: 'Setzt ein Element an einer bestimmten Position.',
        parameters: [
            { name: 'target', label: 'Listen-Variable', type: 'variable', source: 'variables' },
            { name: 'index', label: 'Index (0-basiert)', type: 'string', placeholder: '0 oder ${var}' },
            { name: 'value', label: 'Neuer Wert', type: 'string', placeholder: 'Literal oder ${var}' }
        ]
    });

    // ─── list_remove: Element per Index entfernen ───
    actionRegistry.register('list_remove', (action, context) => {
        const listName = action.target || action.listName;
        const list = resolveCollection(listName, context);

        if (!Array.isArray(list)) {
            runtimeLogger.warn(`list_remove: "${listName}" ist kein Array`);
            return;
        }

        let index = interpolateValue(action.index, context);
        index = Number(index);

        if (isNaN(index) || index < 0 || index >= list.length) {
            runtimeLogger.warn(`list_remove: Index ${index} out of bounds (len=${list.length})`);
            return;
        }

        const removed = list.splice(index, 1)[0];
        writeVariable(listName, list, context);

        if (action.resultVariable) {
            writeVariable(action.resultVariable, removed, context);
        }

        DebugLogService.getInstance().log('Action', `list_remove: ${describeCollection(listName, context)}[${index}] entfernt (len=${list.length})`);
    }, {
        type: 'list_remove',
        label: 'Liste: Element entfernen (Index)',
        description: 'Entfernt ein Element an einer bestimmten Position.',
        parameters: [
            { name: 'target', label: 'Listen-Variable', type: 'variable', source: 'variables' },
            { name: 'index', label: 'Index (0-basiert)', type: 'string', placeholder: '0 oder ${var}' },
            { name: 'resultVariable', label: 'Entferntes Element in Variable (optional)', type: 'variable', source: 'variables' }
        ]
    });

    // ─── list_clear: Liste leeren ───
    actionRegistry.register('list_clear', (action, context) => {
        const listName = action.target || action.listName;
        writeVariable(listName, [], context);
        DebugLogService.getInstance().log('Action', `list_clear: ${describeCollection(listName, context)} geleert`);
    }, {
        type: 'list_clear',
        label: 'Liste: Leeren',
        description: 'Entfernt alle Elemente aus einer Liste.',
        parameters: [
            { name: 'target', label: 'Listen-Variable', type: 'variable', source: 'variables' }
        ]
    });

    // ─── list_shuffle: Liste mischen (Fisher-Yates) ───
    actionRegistry.register('list_shuffle', (action, context) => {
        const listName = action.target || action.listName;
        const list = resolveCollection(listName, context);

        if (!Array.isArray(list)) {
            runtimeLogger.warn(`list_shuffle: "${listName}" ist kein Array`);
            return;
        }

        let seed: number | undefined = undefined;
        if (action.seed !== undefined && action.seed !== '') {
            seed = Number(interpolateValue(action.seed, context));
            if (isNaN(seed)) seed = undefined;
        }

        const shuffled = shuffleArray(list, seed);
        writeVariable(listName, shuffled, context);

        DebugLogService.getInstance().log('Action', `list_shuffle: ${describeCollection(listName, context)} gemischt (seed=${seed ?? 'random'}, len=${shuffled.length})`);
    }, {
        type: 'list_shuffle',
        label: 'Liste: Mischen',
        description: 'Mischt eine Liste zufällig (Fisher-Yates). Optionaler Seed für Reproduzierbarkeit.',
        parameters: [
            { name: 'target', label: 'Listen-Variable', type: 'variable', source: 'variables' },
            { name: 'seed', label: 'Seed (optional, für deterministisch)', type: 'string', placeholder: 'z.B. 42' }
        ]
    });

    // ─── list_contains: Prüft ob Element in Liste enthalten ───
    actionRegistry.register('list_contains', (action, context) => {
        const listName = action.target || action.listName;
        const list = resolveCollection(listName, context);
        const value = interpolateValue(action.value, context);

        if (!Array.isArray(list)) {
            runtimeLogger.warn(`list_contains: "${listName}" ist kein Array`);
            if (action.resultVariable) writeVariable(action.resultVariable, false, context);
            return;
        }

        // Deep comparison for objects, strict for primitives
        const found = list.some(item => {
            if (typeof item === 'object' && typeof value === 'object') {
                return JSON.stringify(item) === JSON.stringify(value);
            }
             
            return item == value;  // Loose comparison for string/number compat
        });

        if (action.resultVariable) {
            writeVariable(action.resultVariable, found, context);
        }

        DebugLogService.getInstance().log('Action', `list_contains: ${describeCollection(listName, context)} contains ${JSON.stringify(value)} → ${found}`);
    }, {
        type: 'list_contains',
        label: 'Liste: Enthält Element?',
        description: 'Prüft ob ein Wert in der Liste enthalten ist. Ergebnis (true/false) in Variable.',
        parameters: [
            { name: 'target', label: 'Listen-Variable', type: 'variable', source: 'variables' },
            { name: 'value', label: 'Suchwert', type: 'string', placeholder: 'Literal oder ${var}' },
            { name: 'resultVariable', label: 'Ergebnis-Variable (boolean)', type: 'variable', source: 'variables' }
        ]
    });

    // ─── list_length: Länge einer Liste ermitteln ───
    actionRegistry.register('list_length', (action, context) => {
        const listName = action.target || action.listName;
        const list = resolveCollection(listName, context);

        const length = Array.isArray(list) ? list.length : 0;

        if (action.resultVariable) {
            writeVariable(action.resultVariable, length, context);
        }

        DebugLogService.getInstance().log('Action', `list_length: ${describeCollection(listName, context)} → ${length}`);
    }, {
        type: 'list_length',
        label: 'Liste: Länge',
        description: 'Ermittelt die Anzahl der Elemente in einer Liste.',
        parameters: [
            { name: 'target', label: 'Listen-Variable', type: 'variable', source: 'variables' },
            { name: 'resultVariable', label: 'Ergebnis-Variable (Zahl)', type: 'variable', source: 'variables' }
        ]
    });

    // ═══════════════════════════════════════════════
    // MAP OPERATIONS
    // ═══════════════════════════════════════════════

    // ─── map_get: Wert aus Map per Key lesen ───
    actionRegistry.register('map_get', (action, context) => {
        const mapName = action.target || action.mapName;
        const map = resolveCollection(mapName, context);
        const key = String(interpolateValue(action.key, context));

        if (typeof map !== 'object' || map === null || Array.isArray(map)) {
            runtimeLogger.warn(`map_get: "${mapName}" ist keine Map/Object`);
            if (action.resultVariable) {
                writeVariable(action.resultVariable, action.defaultValue ?? undefined, context);
            }
            return;
        }

        const value = map[key] !== undefined ? map[key] : (action.defaultValue ?? undefined);

        if (action.resultVariable) {
            writeVariable(action.resultVariable, value, context);
        }

        DebugLogService.getInstance().log('Action', `map_get: ${describeCollection(mapName, context)}["${key}"] = ${JSON.stringify(value)}`);
    }, {
        type: 'map_get',
        label: 'Map: Wert lesen',
        description: 'Liest einen Wert aus einem Key-Value-Objekt.',
        parameters: [
            { name: 'target', label: 'Map-Variable', type: 'variable', source: 'variables' },
            { name: 'key', label: 'Schlüssel', type: 'string', placeholder: 'Key oder ${var}' },
            { name: 'resultVariable', label: 'Ergebnis-Variable', type: 'variable', source: 'variables' },
            { name: 'defaultValue', label: 'Standard-Wert (bei fehlendem Key)', type: 'string' }
        ]
    });

    // ─── map_set: Wert in Map per Key schreiben ───
    actionRegistry.register('map_set', (action, context) => {
        const mapName = action.target || action.mapName;
        let map = resolveCollection(mapName, context);
        const key = String(interpolateValue(action.key, context));
        const value = interpolateValue(action.value, context);

        if (map === undefined || map === null) {
            map = {};
            writeVariable(mapName, map, context);
        }

        if (typeof map !== 'object' || Array.isArray(map)) {
            runtimeLogger.warn(`map_set: "${mapName}" ist keine Map/Object`);
            return;
        }

        map[key] = value;
        writeVariable(mapName, map, context);

        DebugLogService.getInstance().log('Action', `map_set: ${describeCollection(mapName, context)}["${key}"] = ${JSON.stringify(value)}`);
    }, {
        type: 'map_set',
        label: 'Map: Wert setzen',
        description: 'Setzt einen Wert in einem Key-Value-Objekt.',
        parameters: [
            { name: 'target', label: 'Map-Variable', type: 'variable', source: 'variables' },
            { name: 'key', label: 'Schlüssel', type: 'string', placeholder: 'Key oder ${var}' },
            { name: 'value', label: 'Wert', type: 'string', placeholder: 'Literal oder ${var}' }
        ]
    });

    // ─── map_delete: Key aus Map entfernen ───
    actionRegistry.register('map_delete', (action, context) => {
        const mapName = action.target || action.mapName;
        const map = resolveCollection(mapName, context);
        const key = String(interpolateValue(action.key, context));

        if (typeof map !== 'object' || map === null || Array.isArray(map)) {
            runtimeLogger.warn(`map_delete: "${mapName}" ist keine Map/Object`);
            return;
        }

        delete map[key];
        writeVariable(mapName, map, context);

        DebugLogService.getInstance().log('Action', `map_delete: ${describeCollection(mapName, context)}["${key}"] entfernt`);
    }, {
        type: 'map_delete',
        label: 'Map: Schlüssel löschen',
        description: 'Entfernt einen Schlüssel aus einem Key-Value-Objekt.',
        parameters: [
            { name: 'target', label: 'Map-Variable', type: 'variable', source: 'variables' },
            { name: 'key', label: 'Schlüssel', type: 'string', placeholder: 'Key oder ${var}' }
        ]
    });

    // ─── map_has: Prüft ob Key in Map existiert ───
    actionRegistry.register('map_has', (action, context) => {
        const mapName = action.target || action.mapName;
        const map = resolveCollection(mapName, context);
        const key = String(interpolateValue(action.key, context));

        let exists = false;
        if (typeof map === 'object' && map !== null && !Array.isArray(map)) {
            exists = key in map;
        }

        if (action.resultVariable) {
            writeVariable(action.resultVariable, exists, context);
        }

        DebugLogService.getInstance().log('Action', `map_has: ${describeCollection(mapName, context)} has "${key}" → ${exists}`);
    }, {
        type: 'map_has',
        label: 'Map: Schlüssel vorhanden?',
        description: 'Prüft ob ein Schlüssel in der Map existiert.',
        parameters: [
            { name: 'target', label: 'Map-Variable', type: 'variable', source: 'variables' },
            { name: 'key', label: 'Schlüssel', type: 'string', placeholder: 'Key oder ${var}' },
            { name: 'resultVariable', label: 'Ergebnis-Variable (boolean)', type: 'variable', source: 'variables' }
        ]
    });

    // ─── map_keys: Alle Schlüssel einer Map als Liste ───
    actionRegistry.register('map_keys', (action, context) => {
        const mapName = action.target || action.mapName;
        const map = resolveCollection(mapName, context);

        let keys: string[] = [];
        if (typeof map === 'object' && map !== null && !Array.isArray(map)) {
            keys = Object.keys(map);
        } else {
            runtimeLogger.warn(`map_keys: "${mapName}" ist keine Map/Object`);
        }

        if (action.resultVariable) {
            writeVariable(action.resultVariable, keys, context);
        }

        DebugLogService.getInstance().log('Action', `map_keys: ${describeCollection(mapName, context)} → [${keys.join(', ')}]`);
    }, {
        type: 'map_keys',
        label: 'Map: Alle Schlüssel',
        description: 'Gibt alle Schlüssel einer Map als Liste zurück.',
        parameters: [
            { name: 'target', label: 'Map-Variable', type: 'variable', source: 'variables' },
            { name: 'resultVariable', label: 'Ergebnis-Variable (Liste)', type: 'variable', source: 'variables' }
        ]
    });

    runtimeLogger.info('14 Collection-Actions registriert (9 list_* + 5 map_*)');
}
