import { actionRegistry } from '../../ActionRegistry';
import { PropertyHelper } from '../../PropertyHelper';
import { serviceRegistry } from '../../../services/ServiceRegistry';
import { resolveTarget } from '../ActionHelper';
import { Logger } from '../../../utils/Logger';

const runtimeLogger = Logger.get('Action', 'Runtime_Execution');
const dataLogger = Logger.get('Action', 'DataStore_Sync');

export function registerMiscActions() {
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
        requiresMultiplayer: true,
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
        requiresMultiplayer: true,
        description: 'Tritt einem Multiplayer-Raum bei.',
        parameters: [
            { name: 'code', label: 'Raum-Code', type: 'string' }
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
            dataLogger.info(`Speichere Token "${key}":`, token ? (token.substring(0, 15) + '...') : 'null');
            localStorage.setItem(key, token);
        }
    }, {
        type: 'store_token',
        label: 'Token speichern/löschen',
        hidden: true,
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

        const toaster = context.objects.find(o => o.className === 'TToast' || o.constructor?.name === 'TToast');

        if (toaster && typeof (toaster as any).show === 'function') {
            (toaster as any).show(message, toastType);
        } else {
            runtimeLogger.info(`[TOAST: ${toastType.toUpperCase()}] ${message}`);
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

    // 12. Methoden-Aufruf auf Objekt oder Service
    actionRegistry.register('call_method', async (action, context) => {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        const targetName = action.target;
        const methodName = action.method;
        const rawParams: any[] = Array.isArray(action.params) ? action.params : [];
        const resolvedParams = rawParams.map(p =>
            PropertyHelper.interpolate(String(p), combinedContext, context.objects)
        );

        const targetObj = resolveTarget(targetName, context.objects, context.vars, context.eventData);
        if (targetObj && typeof (targetObj as any)[methodName] === 'function') {
            const result = await (targetObj as any)[methodName](...resolvedParams);
            if (action.resultVariable) {
                context.vars[action.resultVariable] = result;
                context.contextVars[action.resultVariable] = result;
            }
            runtimeLogger.info(`${targetName}.${methodName}(${resolvedParams.join(', ')}) aufgerufen.`);
            return;
        }

        if (serviceRegistry.has(targetName)) {
            const result = await serviceRegistry.call(targetName, methodName, resolvedParams);
            if (action.resultVariable) {
                context.vars[action.resultVariable] = result;
                context.contextVars[action.resultVariable] = result;
            }
            runtimeLogger.info(`Service ${targetName}.${methodName}(${resolvedParams.join(', ')}) aufgerufen.`);
            return;
        }

        if (targetName === 'Toaster' && methodName === 'show') {
            const message = resolvedParams[0] || '';
            const toastType = resolvedParams[1] || 'info';
            const toaster = context.objects.find(o =>
                (o as any).className === 'TToast' || (o as any).constructor?.name === 'TToast'
            );
            if (toaster && typeof (toaster as any).show === 'function') {
                (toaster as any).show(message, toastType);
            } else {
                runtimeLogger.info(`[TOAST: ${toastType.toUpperCase()}] ${message}`);
            }
            return;
        }

        runtimeLogger.warn(`call_method: Ziel "${targetName}" nicht gefunden oder Methode "${methodName}" nicht vorhanden.`);
    }, {
        type: 'call_method',
        label: 'Methode aufrufen',
        description: 'Ruft eine Methode auf einem Objekt oder registrierten Service auf.',
        parameters: [
            { name: 'target', label: 'Ziel (Objekt oder Service)', type: 'select', source: 'objects_and_services' },
            { name: 'method', label: 'Methode', type: 'select', source: 'methods_of_target' },
            { name: 'params', label: 'Parameter (Array)', type: 'json', hint: '["param1", "param2"]' },
            { name: 'resultVariable', label: 'Ergebnis speichern in', type: 'variable', source: 'variables' }
        ]
    });

    // 22. Audio Play/Stop
    actionRegistry.register('play_audio', (action, context) => {
        const targetObj = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        if (targetObj && typeof (targetObj as any).play === 'function') {
            (targetObj as any).play();
            return true;
        }
        runtimeLogger.warn(`[Action: play_audio] Ziel "${action.target}" ist kein TAudio Element oder nicht gefunden.`);
        return false;
    }, {
        type: 'play_audio',
        label: 'Audio abspielen',
        description: 'Spielt ein TAudio-Element (zerolatenz via WebAudio) ab.',
        parameters: [
            { name: 'target', label: 'Audio-Objekt', type: 'select', source: 'objects', hint: 'Das TAudio Element' }
        ]
    });

    actionRegistry.register('stop_audio', (action, context) => {
        const targetObj = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        if (targetObj && typeof (targetObj as any).stop === 'function') {
            (targetObj as any).stop();
            return true;
        }
        return false;
    }, {
        type: 'stop_audio',
        label: 'Audio stoppen',
        description: 'Stoppt ein laufendes TAudio-Element.',
        parameters: [
            { name: 'target', label: 'Audio-Objekt', type: 'select', source: 'objects', hint: 'Das TAudio Element' }
        ]
    });

    // 23. Theme / TStringMap laden
    actionRegistry.register('load_theme_map', (action, context) => {
        const targetName = action.target;
        const sourceName = action.source;

        if (!targetName || !sourceName) return false;

        const targetObj = context.objects.find(o => o.name === targetName || o.id === targetName);
        const sourceObj = context.objects.find(o => o.name === sourceName || o.id === sourceName);

        if (targetObj && sourceObj && targetObj.className === 'TStringMap' && sourceObj.className === 'TStringMap') {
            const sEntries = (sourceObj as any).entries || {};
            const tEntries = (targetObj as any).entries || {};
            
            // Jeden Key aus der Quelle übertragen und Proxy triggern!
            Object.keys(sEntries).forEach(key => {
                const newValue = sEntries[key];
                
                // 1. Physisch in das Dictionary schreiben (das eigentliche Speicher-Ziel der StringMap)
                tEntries[key] = newValue;
                
                // 2. Den Surrogate Proxy-Trigger auslösen!
                // Da reaktive Bindings nach dem Syntax "${MainThemes.StageBackground}" lauschen,
                // warten die Watcher auf ein Set-Event des Root-Properties 'StageBackground'.
                // Durch das direkte (blinde) Setzen auf das Root-Objekt fängt der TStringMap-Proxy
                // die Zuweisung in der GameRuntime auf und benachrichtigt genau den Listener, der es braucht!
                targetObj[key] = newValue;
            });
            
            // Event triggern (z.B. für FlowActions die danach laufen)
            const anyContext = context as any;
            if (anyContext.handleEvent) {
                anyContext.handleEvent(targetObj.id, 'onEntryChanged', { sourceTheme: sourceName });
            }
            return true;
        }

        runtimeLogger.warn(`[Action: load_theme_map] Konnte Ziel/Quelle nicht als TStringMap identifizieren (${targetName} <- ${sourceName})`);
        return false;
    }, {
        type: 'load_theme_map',
        label: 'Theme (TStringMap) laden',
        description: 'Kopiert alle Strings aus einer Quell-TStringMap in eine Ziel-TStringMap (erlaubt sofortigen Theme-Wechsel).',
        parameters: [
            { name: 'target', label: 'Ziel (z.B. MainThemes)', type: 'select', source: 'objects', hint: 'Welches Theme soll überschrieben werden?' },
            { name: 'source', label: 'Quelle (z.B. DataThemeDark)', type: 'select', source: 'objects', hint: 'Welches Theme soll geladen werden?' }
        ]
    });
}
