import { TPanel } from './TPanel';
import { TPropertyDef, IRuntimeComponent } from './TComponent';

/**
 * TAPIServer - Backend API Server Komponente
 * 
 * Stellt einen virtuellen Server dar, der HTTP-Endpunkte (Tasks) verwaltet.
 * Visuell wird er als Monitor-Icon im Flow-Editor oder auf der Stage dargestellt.
 */
export class TAPIServer extends TPanel implements IRuntimeComponent {
    public port: number = 3000;
    public baseUrl: string = '/api';
    public cors: boolean = true;
    public active: boolean = true;

    // Tester-Properties (nur für Editor/Simulation)
    public testMethod: string = 'GET';
    public testPath: string = '/';
    public testBody: string = '{}';
    public testResponse: string = '';

    // Runtime-Callback
    private eventCallback: ((eventName: string, data?: any) => void) | null = null;

    constructor(name: string = 'APIServer', x: number = 0, y: number = 0) {
        super(name, x, y, 6, 4);

        // Server-Design
        this.style.backgroundColor = '#1a1a2e';
        this.style.borderColor = '#4fc3f7';
        this.style.borderWidth = 2;
        this.style.borderRadius = 8;
        this.caption = '🖥️ API Server';

        // Visibility & Scoping Meta-Flags
        this.isService = true;
        this.isHiddenInRun = true;
    }

    /**
     * Verfügbare Events für den Server
     */
    public getEvents(): string[] {
        return ['onRequest', 'onStart', 'onStop', 'onError'];
    }

    /**
     * Simuliert einen API-Request (für den Editor-Tester)
     */
    public simulateRequest(): void {
        const requestId = 'sim-' + Math.floor(Math.random() * 1000000);
        let body = {};
        try {
            if (this.testBody) body = JSON.parse(this.testBody);
        } catch (e) {
            console.error('[TAPIServer] Invalid JSON in testBody');
        }

        console.log(`[TAPIServer] Simuliere Request: ${this.testMethod} ${this.testPath}`, body);
        this.testResponse = 'Warte auf Antwort...';

        // Trigger onRequest
        this.triggerEvent('onRequest', {
            method: this.testMethod,
            path: this.testPath,
            body: body,
            requestId: requestId,
            isSimulation: true
        });
    }

    /**
     * Runtime-Initialisierung
     */
    public initRuntime(callbacks: { handleEvent: (id: string, ev: string, data?: any) => void }): void {
        this.eventCallback = (ev: string, data?: any) => callbacks.handleEvent(this.id, ev, data);
    }

    /**
     * Hilfsmethode zum Feuern von Events
     */
    private triggerEvent(eventName: string, data?: any): void {
        if (this.eventCallback) {
            this.eventCallback(eventName, data);
        } else {
            console.warn(`[TAPIServer] Event ${eventName} gefeuert, aber kein Runtime-Callback registriert.`);
        }
    }

    /**
     * Inspector-Eigenschaften für den Server
     */
    public getInspectorProperties(): TPropertyDef[] {
        const baseProps = super.getInspectorProperties();

        // Filter out unnecessary panel props for the server node
        const filtered = baseProps.filter(p => !['showGrid', 'gridColor', 'caption'].includes(p.name));

        return [
            ...filtered,
            { name: 'caption', label: 'Titel', type: 'string', group: 'IDENTITÄT' },
            { name: 'port', label: 'Netzwerk-Port', type: 'number', group: 'SERVER', defaultValue: 3000 },
            { name: 'baseUrl', label: 'Basis-URL', type: 'string', group: 'SERVER', defaultValue: '/api' },
            { name: 'cors', label: 'CORS erlauben', type: 'boolean', group: 'SERVER', defaultValue: true },
            { name: 'active', label: 'Server Aktiv', type: 'boolean', group: 'SERVER', defaultValue: true },

            // TESTER GROUP
            { name: 'testMethod', label: 'Methode', type: 'select', group: 'API TESTER', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], defaultValue: 'GET' },
            { name: 'testPath', label: 'Relative Path', type: 'string', group: 'API TESTER', defaultValue: '/' },
            { name: 'testBody', label: 'Request Body (JSON)', type: 'json', group: 'API TESTER', defaultValue: '{}' },
            {
                name: 'testApiBtn',
                label: '🚀 Request Senden',
                type: 'button',
                group: 'API TESTER',
                action: 'testApi',
                style: { backgroundColor: '#4caf50', color: '#fff', marginTop: 12, fontWeight: 'bold' }
            },
            { name: 'testResponse', label: 'Response', type: 'string', group: 'API TESTER', readonly: true }
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            port: this.port,
            baseUrl: this.baseUrl,
            cors: this.cors,
            active: this.active,
            testMethod: this.testMethod,
            testPath: this.testPath,
            testBody: this.testBody
        };
    }
}
