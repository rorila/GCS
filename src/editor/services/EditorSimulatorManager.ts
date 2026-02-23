import { GameProject } from '../../model/types';
import { projectRegistry } from '../../services/ProjectRegistry';
import { serviceRegistry } from '../../services/ServiceRegistry';
import { dataService } from '../../services/DataService';

export interface EditorSimulatorHost {
    project: GameProject;
    inspector: any;
    runManager: any;
}

export class EditorSimulatorManager {
    private host: EditorSimulatorHost;

    constructor(host: EditorSimulatorHost) {
        this.host = host;
    }

    public registerServices() {
        // Register Mock HttpServer for API Simulation in Editor
        serviceRegistry.register('HttpServer', {
            respond: (requestId: string, status: number, data: any) => {
                if (requestId && requestId.startsWith('sim-')) {
                    console.log(`[EditorSimulator] Sim-Response empfangen für ${requestId}:`, data);
                    // Suche nach der TAPIServer Komponente im Projekt
                    const allObjects = projectRegistry.getObjects();
                    const server = allObjects.find(o => (o as any).className === 'TAPIServer');
                    if (server) {
                        (server as any).testResponse = `Status: ${status}\n\n${JSON.stringify(data, null, 2)}`;
                        // Update Inspector falls dieses Objekt ausgewählt ist
                        if (this.host.inspector && this.host.inspector.getSelectedObject() === server) {
                            this.host.inspector.update(server);
                        }
                    }
                }
                // Store response for ApiSimulator to retrieve
                if ((window as any).__pendingApiResponses) {
                    const resolver = (window as any).__pendingApiResponses.get(requestId);
                    if (resolver) {
                        resolver({ status, data });
                        (window as any).__pendingApiResponses.delete(requestId);
                    }
                }
            }
        });

        // Register ApiSimulator service for intercepting http action requests in Editor
        (window as any).__pendingApiResponses = new Map();
        serviceRegistry.register('ApiSimulator', {
            request: async (method: string, url: string, body: any, storageFile: string = 'db.json'): Promise<any> => {
                const requestId = 'sim-' + Math.floor(Math.random() * 1000000);

                // Parse URL to extract path & query
                let path = url;
                let query: Record<string, string> = {};

                try {
                    // Use a dummy base for relative URLs
                    const urlObj = new URL(url, 'http://localhost');
                    path = urlObj.pathname;

                    // Extract query params
                    urlObj.searchParams.forEach((value, key) => {
                        query[key] = value;
                    });
                } catch (e) {
                    console.warn('[ApiSimulator] URL parsing failed:', e);
                }

                console.log(`[ApiSimulator] Simulating (${storageFile}): ${method} ${path}`, { body, query });

                // --- SPECIAL PLATFORM ROUTING ---
                if (path === '/api/platform/login' && method === 'POST') {
                    console.log(`[ApiSimulator] Simulating Platform Login`, body);
                    const authCode = body?.authCode;
                    if (!authCode) {
                        console.warn(`[ApiSimulator] Login Error: Missing authCode in body`);
                        return { error: 'Missing authCode', status: 400 };
                    }

                    const targetFile = storageFile || 'db.json';
                    const users = await dataService.findItems(targetFile, 'users', {});
                    const user = users.find((u: any) => {
                        const userAuth = Array.isArray(u.authCode) ? u.authCode.join('') : String(u.authCode);
                        const targetAuth = Array.isArray(authCode) ? authCode.join('') : String(authCode);
                        return userAuth === targetAuth;
                    });

                    if (user) {
                        console.log(`[ApiSimulator] Login SUCCESS for: ${user.name} (ID: ${user.id})`);
                        return {
                            success: true,
                            token: 'sim-jwt-token-' + user.id,
                            user: {
                                id: user.id,
                                name: user.name,
                                role: user.role,
                                avatar: user.avatar
                            }
                        };
                    } else {
                        console.warn(`[ApiSimulator] Login FAILED: authCode "${authCode}" not found in ${targetFile}`);
                        return { error: 'Invalid authCode', status: 401 };
                    }
                }

                // --- AUTOMATIC RESOURCE ROUTING (Keep it simple) ---
                if (path.startsWith('/api/data/')) {
                    const parts = path.split('/');
                    const resource = parts[3];

                    if (resource) {
                        try {
                            const targetFile = storageFile || 'db.json';

                            if (method === 'GET') {
                                console.log(`[ApiSimulator] Auto-GET for resource: ${resource}`);
                                const operator = query.operator || '==';
                                const cleanQuery = { ...query };
                                delete cleanQuery.operator;

                                const allItems = await dataService.findItems(targetFile, resource, cleanQuery, operator);
                                return allItems;
                            } else if (method === 'POST') {
                                console.log(`[ApiSimulator] Auto-POST for resource: ${resource}`);
                                const newItem = await dataService.saveItem(targetFile, resource, body);
                                return { success: true, item: newItem };
                            }
                        } catch (err) {
                            console.error(`[ApiSimulator] Auto-Routing Error for ${resource}:`, err);
                            return { error: String(err), status: 500 };
                        }
                    }
                }

                // --- LEGACY / CUSTOM EVENT ROUTING ---
                return new Promise((resolve) => {
                    (window as any).__pendingApiResponses.set(requestId, (response: any) => {
                        console.log(`[ApiSimulator] Response received for ${requestId}:`, response);
                        resolve(response);
                    });

                    const allObjects = projectRegistry.getObjects();
                    const server = allObjects.find((o: any) => o.className === 'TAPIServer');

                    if (server && this.host.runManager && this.host.runManager.runtime) {
                        const runtime = this.host.runManager.runtime;
                        runtime.handleEvent(server.id, 'onRequest', {
                            method,
                            path,
                            body,
                            query,
                            requestId,
                            isSimulation: true
                        });
                    } else {
                        console.warn('[ApiSimulator] No TAPIServer found for manual routing. Returning mock error.');
                        resolve({ error: 'No API Server configured and no auto-route matched', status: 503 });
                    }

                    setTimeout(() => {
                        if ((window as any).__pendingApiResponses.has(requestId)) {
                            (window as any).__pendingApiResponses.delete(requestId);
                            console.warn(`[ApiSimulator] Timeout for request ${requestId}`);
                            resolve({ error: 'Simulation timeout - no respond_http action executed', status: 504 });
                        }
                    }, 5000);
                });
            }
        }, 'API Request Simulator for Editor Mode');
    }
}
