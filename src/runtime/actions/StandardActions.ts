import { actionRegistry } from '../ActionRegistry';
import { PropertyHelper } from '../PropertyHelper';
import { ExpressionParser } from '../ExpressionParser';
import { AnimationManager } from '../AnimationManager';
import { serviceRegistry } from '../../services/ServiceRegistry';
import { DebugLogService } from '../../services/DebugLogService';
import { ActionApiHandler } from '../../components/actions/ActionApiHandler';

/**
 * Hilfsfunktion zum Auflösen von Targets
 */
function resolveTarget(targetName: string, objects: any[], vars: Record<string, any>, _contextObj?: any): any {
    if (!targetName) return null;
    let actualName = targetName;
    if (targetName.startsWith('${') && targetName.endsWith('}')) {
        const varName = targetName.substring(2, targetName.length - 1);
        actualName = String(vars[varName] || targetName);
    }
    return objects.find(o => o.name === actualName || o.id === actualName);
}

/**
 * REGISTRIERUNG ALLER STANDARD-AKTIONEN
 */
export function registerStandardActions() {

    // 1. Property ändern
    actionRegistry.register('property', (action, context) => {
        const target = resolveTarget(action.target, context.objects, context.vars, context.contextVars);
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (target && action.changes) {
            Object.keys(action.changes).forEach(prop => {
                const rawValue = action.changes[prop];
                const value = PropertyHelper.interpolate(String(rawValue), combinedContext, context.objects);
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

    // 2. Variable lesen / setzen (Read Variable)
    actionRegistry.register('variable', (action, context) => {
        let val: any = undefined;
        const sourceName = action.source;
        const variableName = action.variableName;

        // 1. Quelle auflösen (Objekt oder Variable)
        const srcObj = resolveTarget(sourceName, context.objects, context.vars, context.contextVars);

        if (srcObj) {
            // Falls Objekt gefunden, Eigenschaft lesen
            if (action.sourceProperty) {
                val = PropertyHelper.getPropertyValue(srcObj, action.sourceProperty);
            } else {
                val = srcObj;
            }
        }

        // 2. Falls kein Objekt gefunden oder Wert noch undefined, in Variablen suchen
        if (val === undefined) {
            const varVal = context.vars[sourceName] !== undefined ? context.vars[sourceName] : context.contextVars[sourceName];
            if (varVal !== undefined) {
                if (action.sourceProperty && typeof varVal === 'object' && varVal !== null) {
                    val = PropertyHelper.getPropertyValue(varVal, action.sourceProperty);
                } else {
                    val = varVal;
                }
            }
        }

        // 3. Fallback: Interpolation (falls Quelle z.B. "${andereVar}")
        if (val === undefined && sourceName && String(sourceName).includes('${')) {
            val = PropertyHelper.interpolate(String(sourceName), { ...context.contextVars, ...context.vars }, context.objects);
        }

        // Zuweisung
        if (val !== undefined && variableName) {
            context.vars[variableName] = val;
            context.contextVars[variableName] = val;

            DebugLogService.getInstance().log('Variable', `Variable "${variableName}" auf "${val}" gesetzt (Quelle: ${sourceName}${action.sourceProperty ? '.' + action.sourceProperty : ''})`, {
                data: { value: val, source: sourceName, property: action.sourceProperty }
            });
        } else {
            console.warn(`[Action:variable] Fehler: Quelle "${sourceName}" konnte nicht aufgelöst werden oder variableName fehlt.`);
            DebugLogService.getInstance().log('Action', `⚠️ Variable konnte nicht gelesen werden. Quelle: ${sourceName}`, {
                data: action
            });
        }

    }, {
        type: 'variable',
        label: 'Variable lesen / setzen',
        description: 'Liest einen Wert aus einer Quelle (Objekt-Eigenschaft oder andere Variable) und speichert ihn in einer Ziel-Variable.',
        parameters: [
            { name: 'variableName', label: 'Ziel-Variable', type: 'variable', source: 'variables' },
            { name: 'source', label: 'Quell-Objekt / Variable', type: 'object', source: 'objects' },
            { name: 'sourceProperty', label: 'Eigenschaft (optional)', type: 'string', placeholder: 'z.B. text oder value' }
        ]
    });

    // 2b. Alias für Variable setzen (für UI-Unterscheidung)
    actionRegistry.register('set_variable', actionRegistry.getHandler('variable')!, {
        type: 'set_variable',
        label: 'Variable setzen (Zuweisung)',
        description: 'Liest einen Wert aus einer Quelle und speichert ihn in einer Ziel-Variable.',
        parameters: [
            { name: 'variableName', label: 'Ziel-Variable', type: 'variable', source: 'variables' },
            { name: 'source', label: 'Quell-Objekt / Variable', type: 'object', source: 'objects' },
            { name: 'sourceProperty', label: 'Eigenschaft (optional)', type: 'string', placeholder: 'z.B. text oder value' }
        ]
    });

    // 3. Berechnung
    actionRegistry.register('calculate', (action, context) => {
        const formula = action.formula || action.expression;
        if (formula) {
            // Add objects to context to allow access to component properties (e.g. PinPicker.selectedEmoji)
            const objectMap = context.objects.reduce((acc: Record<string, any>, obj: any) => {
                if (obj.id) acc[obj.id] = obj;
                if (obj.name) acc[obj.name] = obj;
                return acc;
            }, {});

            const evalContext = {
                ...objectMap,
                ...context.contextVars,
                ...context.vars,
                $eventData: context.eventData
            };

            try {
                const result = ExpressionParser.evaluate(formula, evalContext);

                console.log(`%c[Action:calculate] Result of "${formula}" -> ${JSON.stringify(result)} (Target: ${action.resultVariable})`, 'color: #2196f3');

                if (action.resultVariable) {
                    context.contextVars[action.resultVariable] = result;
                    // Also update local vars to ensure visibility in the same task chain
                    if (context.vars) {
                        context.vars[action.resultVariable] = result;
                    }
                }
            } catch (err) {
                console.error(`[Action:calculate] Error evaluating "${formula}":`, err);
            }
        } else {
            console.warn('[Action:calculate] No formula/expression provided in action:', action);
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
        const target = resolveTarget(action.target, context.objects, context.vars, context.contextVars);
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (target) {
            const toValue = Number(PropertyHelper.interpolate(String(action.to), combinedContext, context.objects));
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
        const target = resolveTarget(action.target, context.objects, context.vars, context.contextVars);
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (target) {
            const toX = Number(PropertyHelper.interpolate(String(action.x), combinedContext, context.objects));
            const toY = Number(PropertyHelper.interpolate(String(action.y), combinedContext, context.objects));
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
        let targetGame = PropertyHelper.interpolate(action.target, combinedContext, context.objects);
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
        const stageId = action.stageId;
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (stageId && context.onNavigate) {
            const resolved = PropertyHelper.interpolate(String(stageId), combinedContext, context.objects);
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
            const params = (Array.isArray(action.serviceParams) ? action.serviceParams : []).map((v: any) =>
                PropertyHelper.interpolate(String(v), { ...context.contextVars, ...context.vars }, context.objects)
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
            { name: 'serviceParams', label: 'Parameter-Liste', type: 'json' },
            { name: 'resultVariable', label: 'Ergebnis speichern in', type: 'variable', source: 'variables' }
        ]
    });

    // 8. Multiplayer Room Management
    actionRegistry.register('create_room', (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        if (context.multiplayerManager) {
            let gameName = PropertyHelper.interpolate(action.game, combinedContext, context.objects);
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
            let code = action.params?.code ? PropertyHelper.interpolate(String(action.params.code), combinedContext, context.objects) : '';
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

        // Auto-URL Construction if 'resource' is present (DataAction support)
        let effectiveUrl = String(action.url || '');
        if (!effectiveUrl) {
            let res = action.resource;

            // If resource is missing, try to resolve from DataStore
            if (!res && action.dataStore) {
                const dsName = action.dataStore;
                const dsComponent = context.objects.find(o => o.name === dsName || o.id === dsName);
                res = (dsComponent as any)?.defaultCollection;
            }

            if (res) {
                effectiveUrl = `/api/data/${res}`;
                if (action.queryProperty && action.queryValue) {
                    const interpValue = PropertyHelper.interpolate(String(action.queryValue), combinedContext, context.objects);
                    effectiveUrl += `?${action.queryProperty}=${encodeURIComponent(interpValue)}`;
                }
            }
        }

        const url = PropertyHelper.interpolate(effectiveUrl, combinedContext, context.objects);
        const method = action.method || 'GET';
        let body = null;
        let parsedBody = {};

        if (method !== 'GET' && action.body) {
            const bodyStr = typeof action.body === 'object' ? JSON.stringify(action.body) : String(action.body);
            body = PropertyHelper.interpolate(bodyStr, combinedContext, context.objects);
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
                // Resolve storagePath from dataStore component if present
                const dsName = action.dataStore;
                const dsComponent = context.objects.find(o => o.name === dsName || o.id === dsName);
                const storageFile = (dsComponent as any)?.storagePath || 'db.json';

                let result = await serviceRegistry.call('ApiSimulator', 'request', [method, url, parsedBody, storageFile]);

                // Smart-Mapping: Extract path if specified
                if (action.resultPath && result) {
                    result = PropertyHelper.getPropertyValue(result, action.resultPath);
                }

                // Final Smart-Unwrap: If result is an array with 1 item, unwrap it (e.g. API query result)
                if (Array.isArray(result) && result.length === 1) {
                    console.log(`[Action: http] Auto-Unwrapping single-item array result for ${action.resultVariable}`);
                    result = result[0];
                }

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
            let data = await response.json();

            // Smart-Mapping: Extract path if specified
            if (action.resultPath && data) {
                data = PropertyHelper.getPropertyValue(data, action.resultPath);
            }

            // Final Smart-Unwrap: If result is an array with 1 item, unwrap it (e.g. API query result)
            if (Array.isArray(data) && data.length === 1) {
                console.log(`[Action: http] Auto-Unwrapping single-item array result for ${action.resultVariable}`);
                data = data[0];
            }

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
            { name: 'resultVariable', label: 'Ergebnis speichern in', type: 'variable', source: 'variables' },
            { name: 'resultPath', label: 'Daten-Pfad (Selektor)', type: 'string', hint: 'Optional: Pfad zum Objekt in der Response (z.B. "user")' }
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
            const token = PropertyHelper.interpolate(String(action.token || ''), combinedContext, context.objects);
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
        const message = PropertyHelper.interpolate(String(action.message || ''), combinedContext, context.objects);
        const toastType = action.toastType || 'info';

        // Suche nach einer TToast-Komponente im Projekt
        const toaster = context.objects.find(o => o.className === 'TToast' || o.constructor?.name === 'TToast');

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

    // 17. HTTP Response (für TAPIServer / HttpServer)
    actionRegistry.register('respond_http', async (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        const requestId = PropertyHelper.interpolate(String(action.requestId || ''), combinedContext, context.objects);
        const status = Number(PropertyHelper.interpolate(String(action.status || 200), combinedContext, context.objects));
        const dataStr = PropertyHelper.interpolate(String(action.data || '{}'), combinedContext, context.objects);

        let data = dataStr;
        try {
            if (dataStr.trim().startsWith('{') || dataStr.trim().startsWith('[')) {
                data = JSON.parse(dataStr);
            }
        } catch (e) {
            console.warn('[Action: respond_http] Could not parse data as JSON, sending as string:', e);
        }

        console.log(`[Action: respond_http] Sending response for ${requestId}:`, { status, data });

        if (serviceRegistry.has('HttpServer')) {
            await serviceRegistry.call('HttpServer', 'respond', [requestId, status, data]);
        } else {
            console.warn('[Action: respond_http] No HttpServer service registered!');
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

    // 18. Execute Login Request (Primitive Action for SubmitLogin DataAction)
    actionRegistry.register('execute_login_request', async (_action, context) => {
        const pin = context.vars['currentPIN'] || context.contextVars['currentPIN'];

        console.log('[Action: execute_login_request] Attempting login with PIN:', pin);

        if (!pin) {
            console.warn('[Action: execute_login_request] No PIN provided!');
            return false;
        }

        try {
            // For now, we simulate the request or use a hardcoded endpoint if available
            // In a real scenario, this would be:
            // const response = await fetch('http://localhost:8080/api/auth/login', { ... });

            // Simulation specific for this project context
            // We assume successful login if PIN is '1234' (or whatever logic is desired)
            // BUT: The original action sequence did a real HTTP POST. Let's try to replicate that.

            const response = await fetch('http://localhost:8080/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pin })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('[Action: execute_login_request] Login success:', data);

                // Store result in global/context variables as expected by the DataAction's successBody
                context.contextVars['loginResult'] = data;
                context.vars['loginResult'] = data;

                return true;
            } else {
                console.warn('[Action: execute_login_request] Login failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('[Action: execute_login_request] Network error:', error);
            return false;
        }
    }, {
        type: 'execute_login_request',
        label: 'Login Request ausführen',
        description: 'Führt den Login-Request gegen das Backend aus.',
        parameters: []
    });

    // 19. Generic DataAction Handler (Delegates to specific types like http, sql)
    actionRegistry.register('data_action', async (action, context) => {
        // DataActions have an internal type, e.g. { type: 'data_action', data: { type: 'http', ... } }
        // OR sometimes attributes are directly on the action: { type: 'data_action', resource: '...', url: '...' }
        // We need to determine the effective sub-type.

        // Strategy 1: Check if it wraps another action in 'data' prop (common in some editor mappings)
        // (Strategy 1 removed as effectiveAction is unused and caused lint errors)


        // Strategy 2: Look for 'type' property inside the data_action definition that maps to a known handler
        // The Project JSON shows: "type": "data_action", "data": { "type": "http", ... }
        // So we should look at action.data.type
        const subType = action.data?.type || action.subType || 'http'; // Default to http if ambiguous?

        console.log(`[Action: data_action] Delegating to ${subType}`);

        const handler = actionRegistry.getHandler(subType);
        if (handler) {
            // Merge properties: 'data' properties should be top-level for the handler
            const mergedAction = { ...action.data, ...action, type: subType };
            return await handler(mergedAction, context);
        } else {
            console.warn(`[Action: data_action] No handler found for sub-type "${subType}"`);
            return false;
        }
    }, {
        type: 'data_action',
        label: 'Data Action',
        description: 'Führt eine Daten-Aktion aus (HTTP, SQL, etc.).',
        parameters: [
            { name: 'dataStore', label: 'Data Store (Komponente)', type: 'select', source: 'components', hint: 'Wähle eine TDataStore-Komponente (z.B. UserData)' }
        ] // Dynamic based on sub-type
    });

    // 20. API Handler Action (Simulates DB interaction)
    actionRegistry.register('handle_api_request', async (action, context) => {
        // Fix: ActionExecutor passes contextObj as context.eventData.
        // The real event payload is in vars.eventData (populated by GameRuntime/TaskExecutor).
        const eventData = context.vars?.eventData || context.eventData;

        if (!eventData || !eventData.requestId) {
            console.warn('[Action: handle_api_request] Missing requestId in eventData. Is this triggered by onRequest?');
            return false;
        }

        const logicResponse = await ActionApiHandler.handle(action, {
            path: eventData.path,
            method: eventData.method,
            body: eventData.body,
            query: eventData.query
        }, context.objects);

        // Send response back via ApiSimulator mechanism
        // We use the global map established in Editor.ts
        const pendingMap = (window as any).__pendingApiResponses;
        if (pendingMap) {
            const resolver = pendingMap.get(eventData.requestId);
            if (resolver) {
                resolver(logicResponse);
                pendingMap.delete(eventData.requestId);
                console.log(`[Action: handle_api_request] Sent response for ${eventData.requestId}`, logicResponse);
                return true;
            }
        }

        console.warn(`[Action: handle_api_request] Could not find pending response resolver for ${eventData.requestId}`);
        return false;
    }, {
        type: 'handle_api_request',
        label: 'API Request verarbeiten',
        description: 'Verarbeitet einen API-Request mit Datenbank-Logik und sendet die Antwort.',
        parameters: []
    });
}
