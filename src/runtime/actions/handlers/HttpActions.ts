import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';
import { serviceRegistry } from '../../../services/ServiceRegistry';
import { DebugLogService } from '../../../services/DebugLogService';
import { ActionApiHandler } from '../../../components/actions/ActionApiHandler';
import { Logger } from '../../../utils/Logger';

const runtimeLogger = Logger.get('Action', 'Runtime_Execution');
const dataLogger = Logger.get('Action', 'DataStore_Sync');

export function registerHttpActions() {
    // 9. HTTP Request (API Call)
    actionRegistry.register('http', async (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };

        let effectiveUrl = String(action.url || '');
        if (!effectiveUrl) {
            let res = action.resource;

            if (!res && action.dataStore) {
                const dsName = action.dataStore;
                const dsComponent = context.objects.find(o => o.name === dsName || o.id === dsName);
                res = (dsComponent as any)?.defaultCollection;
            }

            if (res) {
                effectiveUrl = `/api/data/${res}`;
                const qProp = action.queryProperty || action.property;
                const qVal = action.queryValue || action.value;
                const qOp = action.queryOperator || '==';

                if (qProp && qVal) {
                    const interpValue = PropertyHelper.interpolate(String(qVal), combinedContext, context.objects);
                    effectiveUrl += `?${qProp}=${encodeURIComponent(interpValue)}&operator=${qOp}`;
                }
            }
        }

        let url = PropertyHelper.interpolate(effectiveUrl, combinedContext, context.objects);
        let method = action.method || 'GET';

        if (action.requestJWT) {
            if (!url || url === '/' || url.startsWith('/api/data/')) {
                dataLogger.info(`Auto-fixing URL for JWT request: ${url} -> /api/platform/login`);
                url = '/api/platform/login';
            }
            if (method === 'GET') {
                dataLogger.info(`Auto-fixing METHOD for JWT request: GET -> POST`);
                method = 'POST';
            }
        }
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

        if (action.requestJWT && !action.body) {
            const qProp = action.queryProperty || action.property;
            const qVal = action.queryValue || action.value;
            if (qProp && qVal) {
                dataLogger.info(`Interpolating qVal "${qVal}" for qProp "${qProp}"`);
                const interpValue = PropertyHelper.interpolate(String(qVal), combinedContext, context.objects);
                dataLogger.info(`Interpolated Value: "${interpValue}"`);
                parsedBody = { [qProp]: interpValue };
                body = JSON.stringify(parsedBody);
                dataLogger.info(`Auto-constructed Login Body (JWT):`, parsedBody);
            }
        }

        DebugLogService.getInstance().log('Action', `HTTP: ${method} ${url}`, {
            data: { type: 'http', method, url, body: parsedBody }
        });

        if (serviceRegistry.has('ApiSimulator')) {
            dataLogger.info(`Using API Simulation for: ${method} ${url}`);
            try {
                const dsName = action.dataStore;
                const dsComponent = context.objects.find(o => o.name === dsName || o.id === dsName);
                const storageFile = (dsComponent as any)?.storagePath || 'db.json';

                if (action.requestJWT) {
                    dataLogger.info(`JWT Simulation Request: ${method} ${url}`, parsedBody);
                }
                let result = await serviceRegistry.call('ApiSimulator', 'request', [method, url, parsedBody, storageFile]);

                if (action.requestJWT) {
                    dataLogger.info(`JWT Simulation Result:`, result);
                    if (result && result.token) {
                        localStorage.setItem('auth_token', result.token);
                        dataLogger.info('Auto-saved JWT token to localStorage "auth_token"');
                    }
                    if (result && result.user) {
                        result = result.user;
                        dataLogger.info('Auto-unwrapped user object from JWT response');
                    }
                }

                if (action.resultPath && result) {
                    result = PropertyHelper.getPropertyValue(result, action.resultPath);
                }

                if (action.selectFields && action.selectFields !== '*' && result) {
                    const fields = action.selectFields.split(',').map((f: string) => f.trim()).filter((f: string) => f);
                    const isCountOnly = fields.length === 1 && fields[0] === 'count(*)';

                    if (isCountOnly && Array.isArray(result)) {
                        result = result.length;
                        dataLogger.info(`Applied SQL COUNT Projection: ${result}`);
                    } else {
                        const project = (obj: any) => {
                            if (typeof obj !== 'object' || obj === null) return obj;
                            const partial: any = {};
                            fields.forEach((f: string) => {
                                if (f === 'count(*)' || f === 'count') {
                                    partial['count'] = 1;
                                } else if (f in obj) {
                                    partial[f] = obj[f];
                                }
                            });
                            return partial;
                        };
                        result = Array.isArray(result) ? result.map(project) : project(result);
                        dataLogger.info(`Applied SQL Projection (${action.selectFields}):`, result);
                    }
                }

                if (action.requestJWT && Array.isArray(result) && result.length === 1) {
                    dataLogger.info(`Auto-Unwrapping single-item JWT result for ${action.resultVariable}`);
                    result = result[0];
                }

                const resVar = action.resultVariable || action.variable;
                if (resVar) {
                    context.vars[resVar] = result;
                    context.contextVars[resVar] = result;

                    const varName = context.objects?.find(o => o.id === resVar)?.name || resVar;
                    const displayValue = Array.isArray(result)
                        ? `[${result.length} Einträge]`
                        : (typeof result === 'object' && result !== null ? JSON.stringify(result)?.substring(0, 80) : String(result));

                    DebugLogService.getInstance().log('Variable', `${varName} ← HTTP-Ergebnis: ${displayValue}`, {
                        objectName: varName,
                        data: result
                    });

                    if (action.requestJWT) {
                        dataLogger.info(`Variable "${varName}" gesetzt auf:`, displayValue);
                    }
                }

                if (result && (result.error || result.status >= 400)) {
                    return false;
                }
            } catch (err) {
                dataLogger.error('Simulation Error:', err);
                if (action.resultVariable) {
                    const errorObj = { error: String(err), status: 500 };
                    context.vars[action.resultVariable] = errorObj;
                    context.contextVars[action.resultVariable] = errorObj;
                }
                return false;
            }
            return;
        }

        try {
            const options: RequestInit = {
                method,
                headers: { 'Content-Type': 'application/json', ...(action.headers || {}) }
            };

            const token = localStorage.getItem('auth_token');
            if (token) {
                (options.headers as any)['Authorization'] = `Bearer ${token}`;
            }

            if (body) options.body = body;

            if (action.requestJWT) {
                dataLogger.info(`JWT Real Request: ${method} ${url}`, { headers: options.headers, body: parsedBody });
            }

            const response = await fetch(url, options);
            let data = await response.json();

            if (action.requestJWT) {
                dataLogger.info(`JWT Real Response:`, data);
                if (data && data.token) {
                    localStorage.setItem('auth_token', data.token);
                    dataLogger.info('Auto-saved JWT token to localStorage "auth_token"');
                }
                if (data && data.user) {
                    data = data.user;
                    dataLogger.info('Auto-unwrapped user object from JWT response');
                }
            }

            if (action.resultPath && data) {
                data = PropertyHelper.getPropertyValue(data, action.resultPath);
            }

            if (action.requestJWT && Array.isArray(data) && data.length === 1) {
                dataLogger.info(`Auto-Unwrapping single-item JWT result for ${action.resultVariable}`);
                data = data[0];
            }

            if (action.resultVariable) {
                context.vars[action.resultVariable] = data;
                context.contextVars[action.resultVariable] = data;

                const varName = context.objects?.find(o => o.id === action.resultVariable)?.name || action.resultVariable;
                const displayValue = Array.isArray(data)
                    ? `[${data.length} Einträge]`
                    : (typeof data === 'object' && data !== null ? JSON.stringify(data).substring(0, 80) : String(data));

                DebugLogService.getInstance().log('Variable', `${varName} ← HTTP-Ergebnis: ${displayValue}`, {
                    objectName: varName,
                    data: data
                });

                if (action.requestJWT) {
                    dataLogger.info(`Produktion: Variable "${varName}" gesetzt auf:`, displayValue);
                }
            }

            if (!response.ok) {
                return false;
            }
        } catch (err) {
            dataLogger.error('Error:', err);
            if (action.resultVariable) {
                const errorObj = { error: String(err) };
                context.vars[action.resultVariable] = errorObj;
                context.contextVars[action.resultVariable] = errorObj;
            }
            return false;
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
            { name: 'resultPath', label: 'Daten-Pfad (Selektor)', type: 'string', hint: 'Optional: Pfad zum Objekt in der Response (z.B. "user")' },
            { name: 'selectFields', label: 'Felder (SELECT)', type: 'string', hint: 'Kommagetrennte Liste der Felder oder count(*)' },
            { name: 'queryProperty', label: 'Filter-Feld (WHERE)', type: 'string', hint: 'z.B. id oder email' },
            { name: 'queryOperator', label: 'Operator', type: 'select', options: ['==', '!=', '>', '<', '>=', '<=', 'CONTAINS'], defaultValue: '==' },
            { name: 'queryValue', label: 'Filter-Wert', type: 'string', hint: 'Wert oder ${variable}' }
        ]
    });

    // 17. HTTP Response
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
            dataLogger.warn('Could not parse data as JSON, sending as string:', e);
        }

        dataLogger.info(`Sending response for ${requestId}:`, { status, data });

        if (serviceRegistry.has('HttpServer')) {
            await serviceRegistry.call('HttpServer', 'respond', [requestId, status, data]);
        } else {
            dataLogger.warn('No HttpServer service registered!');
        }
    }, {
        type: 'respond_http',
        label: 'HTTP Antwort senden',
        requiresServer: true,
        description: 'Sendet eine Antwort auf einen eingehenden HTTP-Request (nur im Server-Modus).',
        parameters: [
            { name: 'requestId', label: 'Request ID', type: 'string', hint: 'Wird automatisch vom onRequest-Event bereitgestellt.' },
            { name: 'status', label: 'HTTP Status', type: 'number', defaultValue: 200 },
            { name: 'data', label: 'Antwort-Daten (JSON)', type: 'string', hint: 'Das Objekt, das als JSON gesendet wird.' }
        ]
    });

    // 18. Execute Login Request
    actionRegistry.register('execute_login_request', async (_action, context) => {
        const pin = context.vars['currentPIN'] || context.contextVars['currentPIN'];

        dataLogger.info('Attempting login with PIN:', pin);

        if (!pin) {
            dataLogger.warn('No PIN provided!');
            return false;
        }

        try {
            const response = await fetch('http://localhost:8080/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pin })
            });

            if (response.ok) {
                const data = await response.json();
                dataLogger.info('Login success:', data);

                context.contextVars['loginResult'] = data;
                context.vars['loginResult'] = data;

                return true;
            } else {
                dataLogger.warn('Login failed:', response.status);
                return false;
            }
        } catch (error) {
            dataLogger.error('Network error:', error);
            return false;
        }
    }, {
        type: 'execute_login_request',
        label: 'Login Request ausführen',
        hidden: true,
        description: 'Führt den Login-Request gegen das Backend aus.',
        parameters: []
    });

    // 19. Generic DataAction Handler
    actionRegistry.register('data_action', async (action, context) => {
        const subType = action.data?.type || action.subType || 'http';

        runtimeLogger.info(`Delegating to ${subType}`);

        const handler = actionRegistry.getHandler(subType);
        if (handler) {
            const mergedAction = { ...action.data, ...action, type: subType };
            return await handler(mergedAction, context);
        } else {
            runtimeLogger.warn(`No handler found for sub-type "${subType}"`);
            return false;
        }
    }, {
        type: 'data_action',
        label: 'Data Action',
        description: 'Führt eine Daten-Aktion aus (HTTP, SQL, etc.).',
        parameters: [
            { name: 'dataStore', label: 'Data Store (Komponente)', type: 'select', source: 'components', hint: 'Wähle eine TDataStore-Komponente (z.B. UserData)' },
            { name: 'selectFields', label: 'Felder (SELECT)', type: 'string', hint: 'Kommagetrennte Liste der Felder oder count(*)' },
            { name: 'queryProperty', label: 'Filter-Feld (WHERE)', type: 'string', hint: 'z.B. id oder email' },
            { name: 'queryOperator', label: 'Operator', type: 'select', options: ['==', '!=', '>', '<', '>=', '<=', 'CONTAINS'], defaultValue: '==' },
            { name: 'queryValue', label: 'Filter-Wert', type: 'string', hint: 'Wert oder ${variable}' }
        ]
    });

    // 20. API Handler Action
    actionRegistry.register('handle_api_request', async (action, context) => {
        const eventData = context.vars?.eventData || context.eventData;

        if (!eventData || !eventData.requestId) {
            runtimeLogger.warn('handle_api_request: Missing requestId in eventData.');
            return false;
        }

        const logicResponse = await ActionApiHandler.handle(action, {
            path: eventData.path,
            method: eventData.method,
            body: eventData.body,
            query: eventData.query
        }, context.objects);

        const pendingMap = (window as any).__pendingApiResponses;
        if (pendingMap) {
            const resolver = pendingMap.get(eventData.requestId);
            if (resolver) {
                resolver(logicResponse);
                pendingMap.delete(eventData.requestId);
                runtimeLogger.info(`handle_api_request: Sent response for ${eventData.requestId}`, logicResponse);
                return true;
            }
        }

        runtimeLogger.warn(`handle_api_request: Could not find pending response resolver for ${eventData.requestId}`);
        return false;
    }, {
        type: 'handle_api_request',
        label: 'API Request verarbeiten',
        requiresServer: true,
        description: 'Verarbeitet einen API-Request mit Datenbank-Logik und sendet die Antwort.',
        parameters: []
    });
}
