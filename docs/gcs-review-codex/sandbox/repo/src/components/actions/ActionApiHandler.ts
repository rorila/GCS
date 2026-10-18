import { DataService } from '../../services/DataService';
import { Logger } from '../../utils/Logger';

const logger = Logger.get('ActionApiHandler');

export class ActionApiHandler {
    static async handle(_action: any, params: any, globalObjects: any[]): Promise<any> {
        logger.info('[ActionApiHandler] Handling API Request:', params);

        // 1. Determine Target DB from Params or Action Config
        // In our case, the action in project.json might typically specify the target,
        // but for a generic API handler, we might look at the path.

        const path = params.path || '';
        const method = params.method || 'GET';

        // --- ROUTING LOGIC ---

        // NEW: DataStore-based Routing (Preferred)
        if (_action.dataStore) {
            const storeName = _action.dataStore;
            const dataStore = globalObjects.find(obj => obj.name === storeName && obj.className === 'TDataStore');

            if (dataStore) {
                logger.info(`[ActionApiHandler] Using TDataStore: ${storeName}`);
                // Extract query from params
                // Note: The caller (StandardActions.ts) passes a combined object covering path/query/body.
                // We need to support 'operation' from action definition or infer it.

                const storagePath = dataStore.storagePath || 'db.json';
                const collection = dataStore.defaultCollection || 'items';
                const query = params.query || _action.query || {};

                return this.performDataQuery(storagePath, collection, query, params);

            } else {
                logger.warn(`[ActionApiHandler] DataStore not found: ${storeName}`);
                return { status: 500, data: { error: `DataStore component not found: ${storeName}` } };
            }
        }

        // FALLBACK: Legacy URL-based Routing (e.g. /api/data/users)
        // Path: /api/data/users
        if (path.includes('/users') && method === 'GET') {
            return this.handleUserSearch(params, globalObjects);
        }

        // Default: 404
        return {
            status: 404,
            data: { error: `Resource not found: ${path} (and no dataStore configured)` }
        };
    }

    private static async performDataQuery(storagePath: string, collection: string, query: any, params: any): Promise<any> {
        // Query logic similar to handleUserSearch but generic
        // 1. Resolve AuthCode/PIN from query or params
        let requestPin = query.code || query.authCode || query.pin;
        if (!requestPin && params.body?.code) requestPin = params.body.code;
        if (!requestPin && params.body?.pin) requestPin = params.body.pin;

        logger.info(`[ActionApiHandler] Querying ${storagePath}/${collection}. Query:`, query);

        const allItems = await DataService.getInstance().findItems(storagePath, collection, {});

        // If specific PIN query is present, use robust matching (Array vs String)
        if (requestPin) {
            const found = allItems.find((item: any) => {
                let itemPin = '';
                if (Array.isArray(item.authCode)) itemPin = item.authCode.join('');
                else if (item.authCode) itemPin = item.authCode;
                else if (item.pin) itemPin = item.pin;

                return itemPin === requestPin;
            });

            if (found) {
                return { status: 200, data: { user: found, token: 'sim-new-token' } }; // Matching expected structure for login
            } else {
                return { status: 401, data: { error: "Not found" } };
            }
        }

        // Default: Return all items (if no specific query logic applies)
        return { status: 200, data: allItems };
    }

    private static async handleUserSearch(params: any, globalObjects: any[]): Promise<any> {
        // Deprecated / Fallback
        const userDataStore = globalObjects.find(obj => obj.name === 'UserData' && obj.className === 'TDataStore');
        const storagePath = userDataStore?.storagePath || 'db.json';
        const collection = userDataStore?.defaultCollection || 'users';

        // ... reuse logic or forward
        return this.performDataQuery(storagePath, collection, params.query, params);
    }
}
