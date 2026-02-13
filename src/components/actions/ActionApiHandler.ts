import { DataService } from '../../services/DataService';

export class ActionApiHandler {
    static async handle(_action: any, params: any, globalObjects: any[]): Promise<any> {
        console.log('[ActionApiHandler] Handling API Request:', params);

        // 1. Determine Target DB from Params or Action Config
        // In our case, the action in project.json might typically specify the target,
        // but for a generic API handler, we might look at the path.

        const path = params.path || '';
        const method = params.method || 'GET';

        // --- ROUTING LOGIC ---

        // A) Login / User Search
        // Path: /api/data/users
        if (path.includes('/users') && method === 'GET') {
            return this.handleUserSearch(params, globalObjects);
        }

        // Default: 404
        return {
            status: 404,
            data: { error: `Resource not found: ${path}` }
        };
    }

    private static async handleUserSearch(params: any, globalObjects: any[]): Promise<any> {
        // 1. Find UserData component to get storage settings
        const userDataStore = globalObjects.find(obj => obj.name === 'UserData' && obj.className === 'TDataStore');
        const storagePath = userDataStore?.storagePath || 'users.json';
        const collection = userDataStore?.defaultCollection || 'users';

        // 2. Extract Query (Pin/AuthCode)
        let query = params.query || {};

        // Robustness: Parse query from path if missing in params
        if (!params.query && params.path && params.path.includes('?')) {
            try {
                const urlObj = new URL(params.path, 'http://localhost');
                urlObj.searchParams.forEach((value, key) => {
                    query[key] = value;
                });
                console.log('[ActionApiHandler] Parsed query from path:', query);
            } catch (e) {
                console.warn('[ActionApiHandler] Failed to parse query from path:', e);
            }
        }

        let requestPin = query.code || query.authCode || query.pin;

        // Fallback: Check body if POST
        if (!requestPin && params.body?.code) requestPin = params.body.code;
        if (!requestPin && params.body?.pin) requestPin = params.body.pin;

        console.log(`[ActionApiHandler] Searching in ${storagePath}/${collection} for PIN: "${requestPin}"`);

        if (!requestPin) {
            return { status: 400, data: { error: "Missing 'code', 'pin' or 'authCode' parameter" } };
        }

        // 3. Query DataService
        // Need to match array or string, so fetch all users first
        const allItems = await DataService.getInstance().findItems(storagePath, collection, {});
        console.log(`[ActionApiHandler] Found ${allItems.length} candidates in DB.`);

        const foundUser = allItems.find((user: any) => {
            let userPin = '';
            // Check 'authCode' (Array)
            if (Array.isArray(user.authCode)) {
                userPin = user.authCode.join('');
            } else if (user.authCode) {
                userPin = user.authCode;
            }
            // Check 'pin' (String legacy)
            else if (user.pin) {
                userPin = user.pin;
            }

            const isMatch = userPin === requestPin;
            console.log(`[ActionApiHandler] Checking user ${user.id} (${user.name}): DB_PIN="${userPin}" vs REQ_PIN="${requestPin}" => Match? ${isMatch}`);
            return isMatch;
        });

        if (foundUser) {
            console.log('[ActionApiHandler] User found:', foundUser.name);
            const token = `sim-token-${Date.now()}-${Math.random().toString(36).substr(2)}`;
            return {
                status: 200,
                data: {
                    user: foundUser,
                    token: token
                }
            };
        } else {
            console.warn('[ActionApiHandler] User not found or PIN incomplete.');
            return { status: 401, data: { error: "Invalid credentials" } };
        }
    }
}
