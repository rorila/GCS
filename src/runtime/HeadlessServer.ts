
import express from 'express';
import { HeadlessRuntime } from './HeadlessRuntime';
import { serviceRegistry } from '../services/ServiceRegistry';
import { dataService } from '../services/DataService';

/**
 * HeadlessServer - Express-Integration für die GCS Backend-Engine.
 * Mappt HTTP-Requests auf GCS-Events und verwaltet Antworten.
 */
export class HeadlessServer {
    private app: express.Application;
    private runtime: HeadlessRuntime;
    private pendingResponses: Map<string, express.Response> = new Map();
    private requestIdCounter: number = 0;

    constructor(runtime: HeadlessRuntime) {
        this.runtime = runtime;
        this.app = express();
        this.app.use(express.json());

        // Als Service registrieren, damit Actions darauf zugreifen können
        serviceRegistry.register('HttpServer', this, 'Zentraler HTTP-Server für GCS-Projekte');
        serviceRegistry.register('Data', dataService, 'Data Persistence Service');
    }

    /**
     * Startet den Server basierend auf der Projekt-Konfiguration
     */
    public start(): void {
        const project = this.runtime.getRuntime().project;
        // Finde TAPIServer Komponenten im Projekt
        const stages = project.stages || [];
        let serverComp: any = null;

        for (const stage of stages) {
            serverComp = stage.objects?.find((o: any) => o.className === 'TAPIServer');
            if (serverComp) break;
        }

        if (!serverComp) {
            console.warn('[HeadlessServer] Keine TAPIServer-Komponente im Projekt gefunden. Nutze Standardwerte.');
            serverComp = { port: 3000, baseUrl: '/api', cors: true };
        }

        const port = serverComp.port || 3000;
        const baseUrl = serverComp.baseUrl || '/api';

        if (serverComp.cors) {
            this.app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                if (req.method === 'OPTIONS') return res.sendStatus(200);
                next();
            });
        }

        // Catch-all Route für das GCS-Backend
        this.app.all(`${baseUrl}/*`, (req, res) => {
            this.handleRequest(serverComp.id, req, res);
        });

        this.app.listen(port, () => {
            console.log(`[HeadlessServer] Läuft auf Port ${port}`);
            console.log(`[HeadlessServer] API Basis-URL: ${baseUrl}`);
        });
    }

    /**
     * Verarbeitet einen eingehenden Request und leitet ihn an die GCS-Engine weiter
     */
    private handleRequest(apiServerId: string, req: express.Request, res: express.Response): void {
        const requestId = `req_${Date.now()}_${this.requestIdCounter++}`;
        this.pendingResponses.set(requestId, res);

        const eventData = {
            requestId,
            path: req.path,
            method: req.method,
            params: req.params,
            query: req.query,
            body: req.body,
            headers: req.headers
        };

        console.log(`[HeadlessServer] Request erhalten: ${req.method} ${req.path} (ID: ${requestId})`);

        // Event in der Runtime feuern
        this.runtime.getRuntime().handleEvent(apiServerId, 'onRequest', eventData);

        // Timeout-Schutz: Falls der GCS-Flow nicht antwortet
        setTimeout(() => {
            if (this.pendingResponses.has(requestId)) {
                console.warn(`[HeadlessServer] Timeout für Request ${requestId}`);
                res.status(504).json({ error: 'Gateway Timeout (GCS Logic not responding)' });
                this.pendingResponses.delete(requestId);
            }
        }, 10000);
    }

    /**
     * Sendet eine Antwort zurück an den Client (aufgerufen via Action)
     */
    public respond(requestId: string, statusCode: number, data: any): void {
        const res = this.pendingResponses.get(requestId);
        if (res) {
            console.log(`[HeadlessServer] Sende Antwort für ${requestId} (Status: ${statusCode})`);
            res.status(statusCode).json(data);
            this.pendingResponses.delete(requestId);
        } else {
            console.warn(`[HeadlessServer] Konnte Antwort für ${requestId} nicht senden (Response-Objekt nicht gefunden)`);
        }
    }
}
