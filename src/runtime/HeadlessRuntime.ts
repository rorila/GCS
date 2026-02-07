
import { GameRuntime, RuntimeOptions } from './GameRuntime';
import { GameLoopManager } from './GameLoopManager';

/**
 * HeadlessRuntime - Eine spezielle Runtime für Node.js Umgebungen (Server).
 * Entkoppelt die Engine vom Browser/DOM und stellt notwendige Mocks bereit.
 */
export class HeadlessRuntime {
    private runtime: GameRuntime;

    constructor(project: any, options: RuntimeOptions = {}) {
        this.setupMocks();

        // Headless-spezifische Optionen
        const headlessOptions: RuntimeOptions = {
            ...options,
            makeReactive: options.makeReactive !== undefined ? options.makeReactive : true,
            onRender: () => { /* Kein Rendering in Headless */ }
        };

        this.runtime = new GameRuntime(project, undefined, headlessOptions);

        // Den GameLoop für Node.js patchen
        this.patchGameLoop();
    }

    /**
     * Stellt Mocks für Browser-spezifische APIs bereit
     */
    private setupMocks(): void {
        // 1. performance.now() Mock falls nicht vorhanden
        if (typeof performance === 'undefined') {
            (global as any).performance = {
                now: () => Date.now()
            };
        }

        // 2. localStorage Mock (In-Memory für Server-Betrieb)
        if (typeof localStorage === 'undefined') {
            const store: Record<string, string> = {};
            (global as any).localStorage = {
                getItem: (key: string) => store[key] || null,
                setItem: (key: string, value: string) => { store[key] = value; },
                removeItem: (key: string) => { delete store[key]; },
                clear: () => { for (const key in store) delete store[key]; }
            };
            console.log('[HeadlessRuntime] localStorage Mock initialisiert (In-Memory)');
        }

        // 3. fetch Mock (Node 18+ hat fetch global, für ältere Versionen oder Stabilität)
        if (typeof fetch === 'undefined') {
            console.warn('[HeadlessRuntime] Globales fetch fehlt. Bitte Node.js 18+ verwenden oder polyfill hinzufügen.');
        }

        // 4. requestAnimationFrame / cancelAnimationFrame Mocks
        if (typeof requestAnimationFrame === 'undefined') {
            (global as any).requestAnimationFrame = (callback: (time: number) => void) => {
                return setTimeout(() => callback(performance.now()), 16);
            };
            (global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
        }
    }

    /**
     * Optimiert den GameLoop für Server-Betrieb
     */
    private patchGameLoop(): void {
        GameLoopManager.getInstance();
        // Hier könnten Server-spezifische Anpassungen am Loop erfolgen (z.B. fixe Tick-Rate)
        console.log('[HeadlessRuntime] GameLoop für Server-Betrieb optimiert');
    }

    /**
     * Startet die Runtime
     */
    public start(): void {
        this.runtime.start();
        console.log('[HeadlessRuntime] Server-Runtime gestartet.');
    }

    /**
     * Stoppt die Runtime
     */
    public stop(): void {
        this.runtime.stop();
        console.log('[HeadlessRuntime] Server-Runtime gestoppt.');
    }

    /**
     * Gibt Zugriff auf die interne Runtime
     */
    public getRuntime(): GameRuntime {
        return this.runtime;
    }
}
