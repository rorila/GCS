import { actionRegistry } from '../ActionRegistry';
import { PropertyHelper } from '../PropertyHelper';
import { ExpressionParser } from '../ExpressionParser';
import { AnimationManager } from '../AnimationManager';
import { serviceRegistry } from '../../services/ServiceRegistry';
import { DebugLogService } from '../../services/DebugLogService';

/**
 * Hilfsfunktion zum Auflösen von Targets (aus ActionExecutor kopiert/angepasst)
 */
function resolveTarget(targetName: string, objects: any[], vars: Record<string, any>, contextObj?: any): any {
    if (!targetName) return null;
    if ((targetName === '$eventSource' || targetName === 'self' || targetName === '$self') && contextObj) return contextObj;
    if ((targetName === 'other' || targetName === '$other') && vars.otherSprite) return vars.otherSprite;

    let actualName = targetName;
    if (targetName.startsWith('${') && targetName.endsWith('}')) {
        const varName = targetName.substring(2, targetName.length - 1);
        const varVal = vars[varName];
        if (varVal && typeof varVal === 'object' && varVal.id) return varVal;
        if (varVal) actualName = String(varVal);
    }

    return objects.find(o => o.name === actualName || o.id === actualName || o.name?.toLowerCase() === actualName.toLowerCase());
}

/**
 * REGISTRIERUNG ALLER STANDARD-AKTIONEN
 */
export function registerStandardActions(objects: any[]) {

    // 1. Property ändern
    actionRegistry.register('property', (action, context) => {
        const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (target && action.changes) {
            Object.keys(action.changes).forEach(prop => {
                const rawValue = action.changes[prop];
                const value = PropertyHelper.interpolate(String(rawValue), combinedContext, objects);
                PropertyHelper.setPropertyValue(target, prop, PropertyHelper.autoConvert(value));
            });
        }
    }, {
        type: 'property',
        label: 'Eigenschaft ändern',
        description: 'Ändert eine oder mehrere Eigenschaften eines Objekts.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects' },
            { name: 'changes', label: 'Änderungen (JSON)', type: 'json', hint: 'Beispiel: { "text": "Hallo", "visible": true }' }
        ]
    });

    // 2. Variable setzen
    actionRegistry.register('variable', (action, context) => {
        const srcObj = resolveTarget(action.source, objects, context.vars, context.contextVars);
        if (srcObj && action.variableName && action.sourceProperty) {
            const val = PropertyHelper.getPropertyValue(srcObj, action.sourceProperty);
            context.vars[action.variableName] = val;
            context.contextVars[action.variableName] = val;
        }
    }, {
        type: 'variable',
        label: 'Variable setzen',
        description: 'Kopiert den Wert einer Objekteigenschaft in eine Variable.',
        parameters: [
            { name: 'variableName', label: 'Variablen-Name', type: 'variable', source: 'variables' },
            { name: 'source', label: 'Quell-Objekt', type: 'object', source: 'objects' },
            { name: 'sourceProperty', label: 'Quell-Eigenschaft', type: 'string', placeholder: 'z.B. x' }
        ]
    });

    // 3. Berechnung
    actionRegistry.register('calculate', (action, context) => {
        if (action.formula) {
            // Add objects to context to allow access to component properties (e.g. PinPicker.selectedEmoji)
            const objectMap = objects.reduce((acc: Record<string, any>, obj: any) => {
                if (obj.id) acc[obj.id] = obj;
                if (obj.name) acc[obj.name] = obj;
                return acc;
            }, {});

            const result = ExpressionParser.evaluate(action.formula, {
                ...context.contextVars,
                ...context.vars,
                ...objectMap,
                $eventData: context.eventData
            });

            if (action.resultVariable) {
                context.contextVars[action.resultVariable] = result;
            }
        }
    }, {
        type: 'calculate',
        label: 'Berechnung',
        description: 'Führt eine mathematische Berechnung aus.',
        parameters: [
            { name: 'resultVariable', label: 'Ziel-Variable', type: 'variable', source: 'variables' },
            { name: 'formula', label: 'Formel', type: 'string', placeholder: 'z.B. score + 10' }
        ]
    });

    // 4. Animation
    actionRegistry.register('animate', (action, context) => {
        const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (target) {
            const toValue = Number(PropertyHelper.interpolate(String(action.to), combinedContext, objects));
            AnimationManager.getInstance().addTween(target, action.property || 'x', toValue, action.duration || 500, action.easing || 'easeOut');
        }
    }, {
        type: 'animate',
        label: 'Animieren',
        description: 'Animiert eine Eigenschaft eines Objekts.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects' },
            { name: 'property', label: 'Eigenschaft', type: 'string', defaultValue: 'x' },
            { name: 'to', label: 'Ziel-Wert', type: 'number' },
            { name: 'duration', label: 'Dauer (ms)', type: 'number', defaultValue: 500 },
            { name: 'easing', label: 'Easing', type: 'select', source: 'easing-functions', defaultValue: 'easeOut' }
        ]
    });

    // 5. Bewegen zu
    actionRegistry.register('move_to', (action, context) => {
        const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (target) {
            const toX = Number(PropertyHelper.interpolate(String(action.x), combinedContext, objects));
            const toY = Number(PropertyHelper.interpolate(String(action.y), combinedContext, objects));
            if (typeof target.moveTo === 'function') {
                target.moveTo(toX, toY, action.duration || 500, action.easing || 'easeOut');
            } else {
                AnimationManager.getInstance().addTween(target, 'x', toX, action.duration || 500, action.easing || 'easeOut');
                AnimationManager.getInstance().addTween(target, 'y', toY, action.duration || 500, action.easing || 'easeOut');
            }
        }
    }, {
        type: 'move_to',
        label: 'Bewegen zu',
        description: 'Bewegt ein Objekt an eine bestimmte Position.',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'object', source: 'objects' },
            { name: 'x', label: 'Ziel-X', type: 'number' },
            { name: 'y', label: 'Ziel-Y', type: 'number' },
            { name: 'duration', label: 'Dauer (ms)', type: 'number', defaultValue: 500 },
            { name: 'easing', label: 'Easing', type: 'select', source: 'easing-functions', defaultValue: 'easeOut' }
        ]
    });

    // 6. Navigation
    actionRegistry.register('navigate', (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        let targetGame = PropertyHelper.interpolate(action.target, combinedContext, objects);
        if (targetGame && context.onNavigate) {
            context.onNavigate(targetGame, action.params);
        }
    }, {
        type: 'navigate',
        label: 'Spiel wechseln',
        description: 'Wechselt zu einem anderen Projekt.',
        parameters: [
            { name: 'target', label: 'Ziel-Projekt', type: 'string' }
        ]
    });

    actionRegistry.register('navigate_stage', (action, context) => {
        const stageId = action.params?.stageId || action.stageId;
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (stageId && context.onNavigate) {
            const resolved = PropertyHelper.interpolate(String(stageId), combinedContext, objects);
            context.onNavigate(`stage:${resolved}`, action.params);
        }
    }, {
        type: 'navigate_stage',
        label: 'Stage wechseln',
        description: 'Wechselt zu einer anderen Stage innerhalb des Projekts.',
        parameters: [
            { name: 'stageId', label: 'Ziel-Stage', type: 'stage', source: 'stages' }
        ]
    });

    // 7. Service Calls
    actionRegistry.register('service', async (action, context) => {
        if (action.service && action.method && serviceRegistry.has(action.service)) {
            const params = Object.values(action.serviceParams || {}).map(v =>
                PropertyHelper.interpolate(String(v), { ...context.contextVars, ...context.vars }, objects)
            );
            const result = await serviceRegistry.call(action.service, action.method, params);
            if (action.resultVariable) {
                context.vars[action.resultVariable] = result;
                context.contextVars[action.resultVariable] = result;
            }
        }
    }, {
        type: 'service',
        label: 'Service aufrufen',
        description: 'Ruft eine Methode eines registrierten Services auf.',
        parameters: [
            { name: 'service', label: 'Service', type: 'select', source: 'services' },
            { name: 'method', label: 'Methode', type: 'string' },
            { name: 'serviceParams', label: 'Parameter (JSON)', type: 'json' },
            { name: 'resultVariable', label: 'Ergebnis speichern in', type: 'variable', source: 'variables' }
        ]
    });

    // 8. Multiplayer Room Management
    actionRegistry.register('create_room', (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (context.multiplayerManager) {
            let gameName = PropertyHelper.interpolate(action.game, combinedContext, objects);
            context.multiplayerManager.createRoom(gameName);
        }
    }, {
        type: 'create_room',
        label: 'Multiplayer-Raum erstellen',
        description: 'Erstellt einen neuen Multiplayer-Raum.',
        parameters: [
            { name: 'game', label: 'Spiel-Identifikator', type: 'string' }
        ]
    });

    actionRegistry.register('join_room', (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (context.multiplayerManager) {
            let code = action.params?.code ? PropertyHelper.interpolate(String(action.params.code), combinedContext, objects) : '';
            if (code.length >= 4) {
                context.multiplayerManager.joinRoom(code);
            }
        }
    }, {
        type: 'join_room',
        label: 'Multiplayer-Raum beitreten',
        description: 'Tritt einem Multiplayer-Raum bei.',
        parameters: [
            { name: 'code', label: 'Raum-Code', type: 'string' }
        ]
    });

    // 9. HTTP Request (API Call)
    actionRegistry.register('http', async (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        const url = PropertyHelper.interpolate(String(action.url || ''), combinedContext, objects);
        const method = action.method || 'GET';
        let body = null;
        let parsedBody = {};

        if (method !== 'GET' && action.body) {
            const bodyStr = typeof action.body === 'object' ? JSON.stringify(action.body) : String(action.body);
            body = PropertyHelper.interpolate(bodyStr, combinedContext, objects);
            try {
                parsedBody = JSON.parse(body);
            } catch (e) {
                parsedBody = body;
            }
        }

        // Log interpolated details for DebugLogViewer
        DebugLogService.getInstance().log('Action', `HTTP: ${method} ${url}`, {
            data: { type: 'http', method, url, body: parsedBody }
        });

        // Check if ApiSimulator service is available (Editor mode simulation)
        if (serviceRegistry.has('ApiSimulator')) {
            console.log(`[Action: http] Using API Simulation for: ${method} ${url}`);
            try {
                const result = await serviceRegistry.call('ApiSimulator', 'request', [method, url, parsedBody]);
                if (action.resultVariable) {
                    context.vars[action.resultVariable] = result;
                    context.contextVars[action.resultVariable] = result;
                }
            } catch (err) {
                console.error('[Action: http] Simulation Error:', err);
                if (action.resultVariable) {
                    context.vars[action.resultVariable] = { error: String(err) };
                    context.contextVars[action.resultVariable] = { error: String(err) };
                }
            }
            return;
        }

        // Real HTTP request (Production/Standalone mode)
        try {
            const options: RequestInit = {
                method,
                headers: { 'Content-Type': 'application/json', ...(action.headers || {}) }
            };
            if (body) options.body = body;

            const response = await fetch(url, options);
            const data = await response.json();

            if (action.resultVariable) {
                context.vars[action.resultVariable] = data;
                context.contextVars[action.resultVariable] = data;
            }
        } catch (err) {
            console.error('[Action: http] Error:', err);
            if (action.resultVariable) {
                context.vars[action.resultVariable] = { error: String(err) };
                context.contextVars[action.resultVariable] = { error: String(err) };
            }
        }
    }, {
        type: 'http',
        label: 'HTTP Request',
        description: 'Führt einen API-Call aus (REST/JSON).',
        parameters: [
            { name: 'url', label: 'URL', type: 'string' },
            { name: 'method', label: 'Methode', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], defaultValue: 'GET' },
            { name: 'body', label: 'Body (JSON-String oder Objekt)', type: 'string' },
            { name: 'resultVariable', label: 'Ergebnis speichern in', type: 'variable', source: 'variables' }
        ]
    });

    // 10. Token Speicher (JWT)
    actionRegistry.register('store_token', (action, context) => {
        const key = action.tokenKey || 'auth_token';
        const operation = action.operation || 'set';

        if (operation === 'delete') {
            localStorage.removeItem(key);
        } else {
            const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
            const token = PropertyHelper.interpolate(String(action.token || ''), combinedContext, objects);
            localStorage.setItem(key, token);
        }
    }, {
        type: 'store_token',
        label: 'Token speichern/löschen',
        description: 'Verwaltet Authentifizierungs-Token (JWT) im LocalStorage.',
        parameters: [
            { name: 'operation', label: 'Operation', type: 'select', options: ['set', 'delete'], defaultValue: 'set' },
            { name: 'token', label: 'Token (Daten)', type: 'string' },
            { name: 'tokenKey', label: 'Speicher-Schlüssel', type: 'string', defaultValue: 'auth_token' }
        ]
    });

    // 11. Toast Benachrichtigung
    actionRegistry.register('show_toast', (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        const message = PropertyHelper.interpolate(String(action.message || ''), combinedContext, objects);
        const toastType = action.toastType || 'info';

        // Suche nach einer TToast-Komponente im Projekt
        const toaster = objects.find(o => o.className === 'TToast' || o.constructor?.name === 'TToast');

        if (toaster && typeof (toaster as any).show === 'function') {
            (toaster as any).show(message, toastType);
        } else {
            // Fallback auf Konsole und einfaches Alert für Sichtbarkeit
            console.log(`[TOAST: ${toastType.toUpperCase()}] ${message}`);
            // alert(message); // Alert ist oft störend, aber für Debugging gut. Wir lassen es weg, wenn Konsole reicht.
        }
    }, {
        type: 'show_toast',
        label: 'Toast anzeigen',
        description: 'Blendet eine kurze Nachricht am Bildschirmrand ein.',
        parameters: [
            { name: 'message', label: 'Nachricht', type: 'string' },
            { name: 'toastType', label: 'Typ', type: 'select', options: ['info', 'success', 'warning', 'error'], defaultValue: 'info' }
        ]
    });

    // 12. HTTP Response (Antwort für HeadlessServer)
    actionRegistry.register('respond_http', async (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        const requestId = PropertyHelper.interpolate(String(action.requestId || ''), combinedContext, objects);
        const status = Number(PropertyHelper.interpolate(String(action.status || 200), combinedContext, objects));
        const dataStr = typeof action.data === 'object' ? JSON.stringify(action.data) : String(action.data || '{}');
        const data = JSON.parse(PropertyHelper.interpolate(dataStr, combinedContext, objects));

        if (requestId && serviceRegistry.has('HttpServer')) {
            await serviceRegistry.call('HttpServer', 'respond', [requestId, status, data]);
        } else {
            console.warn('[Action: respond_http] Konnte Antwort nicht senden. requestId fehlt oder HttpServer nicht registriert.');
        }
    }, {
        type: 'respond_http',
        label: 'HTTP Antwort senden',
        description: 'Sendet eine Antwort auf einen eingehenden HTTP-Request (nur im Server-Modus).',
        parameters: [
            { name: 'requestId', label: 'Request ID', type: 'string', hint: 'Wird automatisch vom onRequest-Event bereitgestellt.' },
            { name: 'status', label: 'HTTP Status', type: 'number', defaultValue: 200 },
            { name: 'data', label: 'Antwort-Daten (JSON)', type: 'string', hint: 'Das Objekt, das als JSON gesendet wird.' }
        ]
    });

    // 13. Datenbank Speichern (UPSERT)
    actionRegistry.register('db_save', async (action, context) => {
        const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        const storagePath = PropertyHelper.interpolate(target?.storagePath || action.storagePath || 'data.json', combinedContext, objects);
        const collection = PropertyHelper.interpolate(action.collection || target?.defaultCollection || 'items', combinedContext, objects);

        const dataStr = typeof action.data === 'object' ? JSON.stringify(action.data) : String(action.data || '{}');
        const data = JSON.parse(PropertyHelper.interpolate(dataStr, combinedContext, objects));

        const result = await serviceRegistry.call('Data', 'saveItem', [storagePath, collection, data]);

        // Detail-Logging für Debug-Log-Viewer
        DebugLogService.getInstance().log('Variable', `Data saved in ${storagePath}::${collection}`, {
            data: { type: 'db_save', storagePath, collection, result }
        });

        if (action.resultVariable) {
            context.vars[action.resultVariable] = result;
            context.contextVars[action.resultVariable] = result;
        }

        if (target && typeof (target as any).triggerEvent === 'function') {
            (target as any).triggerEvent('onDataChanged', { collection, operation: 'save', item: result });
            (target as any).triggerEvent('onSave', { collection, item: result });
        }
    }, {
        type: 'db_save',
        label: 'DB: Speichern',
        description: 'Speichert oder aktualisiert ein Objekt in der Datenbank.',
        parameters: [
            { name: 'target', label: 'DataStore Objekt', type: 'object', source: 'objects' },
            { name: 'collection', label: 'Collection', type: 'string', placeholder: 'z.B. users' },
            { name: 'data', label: 'Daten (JSON)', type: 'string' },
            { name: 'resultVariable', label: 'Ergebnis (mit ID) speichern in', type: 'variable', source: 'variables' }
        ]
    });

    // 14. Datenbank Finden
    actionRegistry.register('db_find', async (action, context) => {
        const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };

        const storagePath = PropertyHelper.interpolate(target?.storagePath || action.storagePath || 'data.json', combinedContext, objects);
        const collection = PropertyHelper.interpolate(action.collection || target?.defaultCollection || 'items', combinedContext, objects);

        console.log(`[Action: db_find] Target: ${target ? target.name : 'null'}, Storage: ${storagePath}, Collection: ${collection}`);
        if (target) {
            console.log(`[Action: db_find] Target Properties: storagePath=${target.storagePath}, defaultCollection=${target.defaultCollection}`);
        } else {
            // Debug: List all available objects if target not found
            console.warn(`[Action: db_find] Target '${action.target}' NOT FOUND. Available objects:`, objects.map(o => o.name).join(', '));
        }

        const queryStr = typeof action.query === 'object' ? JSON.stringify(action.query) : String(action.query || '{}');
        const query = JSON.parse(PropertyHelper.interpolate(queryStr, combinedContext, objects));

        // Detail-Logging für Debug-Log-Viewer & Konsole (Transparency)
        console.log(`[Action: db_find] Searching in ${storagePath}::${collection} with Query:`, JSON.stringify(query));

        const results = await serviceRegistry.call('Data', 'findItems', [storagePath, collection, query]);

        console.log(`[Action: db_find] Found ${results.length} items.`);

        DebugLogService.getInstance().log('Variable', `Found ${results.length} items in ${storagePath}::${collection}`, {
            data: { type: 'db_find', storagePath, collection, query, resultsCount: results.length }
        });

        if (action.resultVariable) {
            context.vars[action.resultVariable] = results;
            context.contextVars[action.resultVariable] = results;
        }
    }, {
        type: 'db_find',
        label: 'DB: Suchen',
        description: 'Sucht Objekte in der Datenbank anhand von Filtern.',
        parameters: [
            { name: 'target', label: 'DataStore Objekt', type: 'object', source: 'objects' },
            { name: 'collection', label: 'Collection', type: 'string', placeholder: 'z.B. users' },
            { name: 'query', label: 'Filter (JSON)', type: 'string', hint: 'Beispiel: { "name": "Rolf" }' },
            { name: 'resultVariable', label: 'Ergebnisse speichern in', type: 'variable', source: 'variables' }
        ]
    });

    // 15. Datenbank Löschen
    actionRegistry.register('db_delete', async (action, context) => {
        const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        const storagePath = PropertyHelper.interpolate(target?.storagePath || action.storagePath || 'data.json', combinedContext, objects);
        const collection = PropertyHelper.interpolate(action.collection || target?.defaultCollection || 'items', combinedContext, objects);
        const id = PropertyHelper.interpolate(String(action.id || ''), combinedContext, objects);

        const success = await serviceRegistry.call('Data', 'deleteItem', [storagePath, collection, id]);

        // Detail-Logging für Debug-Log-Viewer
        DebugLogService.getInstance().log('Variable', `Deleted from ${storagePath}::${collection}: ${success}`, {
            data: { type: 'db_delete', storagePath, collection, id, success }
        });

        if (action.resultVariable) {
            context.vars[action.resultVariable] = success;
            context.contextVars[action.resultVariable] = success;
        }

        if (success && target && typeof (target as any).triggerEvent === 'function') {
            (target as any).triggerEvent('onDataChanged', { collection, operation: 'delete', id });
            (target as any).triggerEvent('onDelete', { collection, id });
        }
    }, {
        type: 'db_delete',
        label: 'DB: Löschen',
        description: 'Löscht ein Objekt aus der Datenbank.',
        parameters: [
            { name: 'target', label: 'DataStore Objekt', type: 'object', source: 'objects' },
            { name: 'collection', label: 'Collection', type: 'string', placeholder: 'z.B. users' },
            { name: 'id', label: 'ID des Objekts', type: 'string' },
            { name: 'resultVariable', label: 'Erfolg (true/false) speichern in', type: 'variable', source: 'variables' }
        ]
    });

    // 16. Bedingung (if/else)
    actionRegistry.register('condition', async (action, context) => {
        if (!action.condition) {
            console.warn('[Action: condition] No condition specified');
            return;
        }

        // Evaluate the condition
        const evalContext = { ...context.contextVars, ...context.vars };
        let result = false;
        try {
            result = ExpressionParser.evaluate(action.condition, evalContext);
        } catch (e) {
            console.error(`[Action: condition] Error evaluating condition "${action.condition}":`, e);
        }

        console.log(`[Action: condition] "${action.condition}" => ${result}`);

        // Log result for DebugLogViewer
        DebugLogService.getInstance().log('Condition', `${action.condition} => ${result}`, {
            data: { type: 'condition', condition: action.condition, result }
        });

        // Execute body or elseBody based on result
        if (result && action.body && Array.isArray(action.body)) {
            // Execute each action in body
            for (const bodyAction of action.body) {
                const handler = actionRegistry.getHandler(bodyAction.type);
                if (handler) {
                    await handler(bodyAction, context);
                } else {
                    console.warn(`[Action: condition] Unknown action type in body: ${bodyAction.type}`);
                }
            }
        } else if (!result && action.elseBody && Array.isArray(action.elseBody)) {
            // Execute each action in elseBody
            for (const elseAction of action.elseBody) {
                const handler = actionRegistry.getHandler(elseAction.type);
                if (handler) {
                    await handler(elseAction, context);
                } else {
                    console.warn(`[Action: condition] Unknown action type in elseBody: ${elseAction.type}`);
                }
            }
        }
    }, {
        type: 'condition',
        label: 'Bedingung',
        description: 'Führt Aktionen basierend auf einer Bedingung aus (If/Else).',
        parameters: [
            { name: 'condition', label: 'Bedingung (JS)', type: 'string', placeholder: 'z.B. user.score > 10' },
            { name: 'body', label: 'Dann (Aktionen)', type: 'json' },
            { name: 'elseBody', label: 'Sonst (Aktionen)', type: 'json' }
        ]
    });

    // 17. HTTP Response (für TAPIServer Simulation)
    actionRegistry.register('respond_http', async (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        const requestId = PropertyHelper.interpolate(action.requestId || '', combinedContext, objects);
        const status = parseInt(PropertyHelper.interpolate(String(action.status || 200), combinedContext, objects));

        let data = action.data;
        if (typeof data === 'string' && data.includes('${')) {
            data = PropertyHelper.interpolate(data, combinedContext, objects);
            try { data = JSON.parse(data); } catch (e) { }
        } else if (typeof data === 'object' && data !== null) {
            // Deep clone to avoid mutating the original action definition
            data = JSON.parse(JSON.stringify(data));

            // Helper to recursively interpolate properties
            const interpolateDeep = (obj: any) => {
                for (const key in obj) {
                    const val = obj[key];
                    if (typeof val === 'string' && val.startsWith('${') && val.endsWith('}')) {
                        // Direct variable reference - preserve type (might be an object)
                        const expression = val.slice(2, -1).trim();

                        // Check if it's a complex string interpolation like "${a} ${b}"
                        const isSimpleExpression = !val.includes('${', 2);

                        if (isSimpleExpression) {
                            try {
                                // Use evaluate to get the raw value (e.g. object, number, boolean)
                                obj[key] = ExpressionParser.evaluate(expression, combinedContext);
                            } catch (e) {
                                console.warn(`[Action: respond_http] Failed to evaluate: ${expression}`, e);
                                obj[key] = val;
                            }
                        } else {
                            // Multiple expressions -> result is always a string
                            obj[key] = PropertyHelper.interpolate(val, combinedContext, objects);
                        }
                    } else if (typeof val === 'string') {
                        // Regular string with potential embeddings
                        obj[key] = PropertyHelper.interpolate(val, combinedContext, objects);
                    } else if (typeof val === 'object' && val !== null) {
                        interpolateDeep(val);
                    }
                }
            };

            interpolateDeep(data);
        }

        console.log(`[Action: respond_http] Responding to ${requestId} with status ${status}`);
        serviceRegistry.call('HttpServer', 'respond', [requestId, status, data]);
    }, {
        type: 'respond_http',
        label: 'HTTP: Antworten',
        description: 'Sendet eine Antwort auf einen simulierten HTTP-Request.',
        parameters: [
            { name: 'requestId', label: 'Request ID', type: 'string' },
            { name: 'status', label: 'Status Code', type: 'number', defaultValue: 200 },
            { name: 'data', label: 'Antwort-Daten (JSON)', type: 'string' }
        ]
    });
}
