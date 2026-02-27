import { GameProject } from '../../model/types';
import { projectRegistry } from '../../services/ProjectRegistry';
import { serviceRegistry } from '../../services/ServiceRegistry';
import { Logger } from '../../utils/Logger';

const logger = Logger.get('EditorSimulator', 'API_Simulation');


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
                    logger.info(`Sim-Response empfangen für ${requestId}:`, data);
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
                    logger.warn('URL parsing failed:', e);
                }

                logger.info(`Simulating (${storageFile}): ${method} ${path}`, { body, query });

                // --- SPECIAL PLATFORM ROUTING (Proxy to Server) ---
                if (path === '/api/platform/login' && method === 'POST') {
                    logger.info(`Proxying Platform Login to server...`);
                    try {
                        const response = await fetch('/api/platform/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        });
                        const data = await response.json();
                        if (response.ok) {
                            logger.info(`Server Login SUCCESS`);
                            return data;
                        } else {
                            logger.warn(`Server Login FAILED:`, data);
                            return { ...data, status: response.status };
                        }
                    } catch (err) {
                        logger.error(`Proxy Login Error:`, err);
                        return { error: String(err), status: 500 };
                    }
                }

                // --- AUTOMATIC RESOURCE ROUTING (Proxy to Server) ---
                if (path.startsWith('/api/data/')) {
                    logger.info(`Proxying Data-Request to server: ${method} ${url}`);
                    try {
                        const fetchOptions: any = {
                            method,
                            headers: { 'Content-Type': 'application/json' }
                        };
                        if (method !== 'GET' && body) {
                            fetchOptions.body = JSON.stringify(body);
                        }

                        // Reconstruct search params for proxy
                        const response = await fetch(url, fetchOptions);
                        const data = await response.json();
                        if (response.ok) {
                            return data;
                        } else {
                            return { ...data, status: response.status };
                        }
                    } catch (err) {
                        logger.error(`Proxy Data Error:`, err);
                        return { error: String(err), status: 500 };
                    }
                }


                // --- LEGACY / CUSTOM EVENT ROUTING ---
                return new Promise((resolve) => {
                    (window as any).__pendingApiResponses.set(requestId, (response: any) => {
                        logger.info(`Response received for ${requestId}:`, response);
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
                            logger.warn(`Timeout for request ${requestId}`);
                            resolve({ error: 'Simulation timeout - no respond_http action executed', status: 504 });
                        }
                    }, 5000);
                });
            }
        }, 'API Request Simulator for Editor Mode');
    }
}
