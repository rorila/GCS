import { Logger } from '../../utils/Logger';

const logger = Logger.get('GameRuntimeInput', 'Runtime_Execution');

export class GameRuntimeInput {
    private _globalKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
    private _globalKeyupHandler: ((e: KeyboardEvent) => void) | null = null;
    private _domRuntimeEventsHandler: ((e: Event) => void) | null = null;

    constructor(
        private getObjects: () => any[],
        private handleEvent: (id: string, ev: string, data?: any) => void
    ) {}

    public init(): void {
        this.dispose();

        const activeICs: any[] = [];
        const objects = this.getObjects();

        // DOM Event Listener für Entkopplung des DevTools-Bugs
        this._domRuntimeEventsHandler = (e: Event) => {
            const ce = e as CustomEvent;
            if (ce.detail && ce.detail.id && ce.detail.event) {
                this.handleEvent(ce.detail.id, ce.detail.event, ce.detail.data);
            }
        };
        window.addEventListener('GameRuntime_Event', this._domRuntimeEventsHandler);

        objects.forEach(obj => {
            if ((obj as any).className === 'TInputController' || obj.constructor?.name === 'TInputController') {
                const rawObj = (obj as any).__raw__ || (obj as any).__v_raw || obj;

                // Force-Reset: Zustand aus vorheigen Runs bereinigen
                rawObj.isActive = false;
                rawObj.eventCallback = null;
                if (rawObj.keysPressed) rawObj.keysPressed.clear();

                // Init OHNE Callback (wegen Chromium DevTools Closure Bug)
                if (typeof rawObj.init === 'function') {
                    rawObj.init(objects, undefined);
                }

                // Aktivieren (setzt nur isActive=true, KEINE window.addEventListener!)
                rawObj.isActive = true;
                activeICs.push(rawObj);

                logger.info(`[GameRuntimeInput] InputController "${rawObj.name}" initialized (id=${rawObj._instanceId})`);
            }
        });

        // EIN globales Listener-Paar installieren, das an alle aktiven ICs delegiert
        if (activeICs.length > 0) {
            this._globalKeydownHandler = (e: KeyboardEvent) => {
                activeICs.forEach(ic => ic.handleKeyDownEvent?.(e));
            };
            this._globalKeyupHandler = (e: KeyboardEvent) => {
                activeICs.forEach(ic => ic.handleKeyUpEvent?.(e));
            };
            window.addEventListener('keydown', this._globalKeydownHandler);
            window.addEventListener('keyup', this._globalKeyupHandler);
            logger.info(`[GameRuntimeInput] Global keyboard handler installed for ${activeICs.length} InputController(s)`);
        }
    }

    public dispose(): void {
        if (this._globalKeydownHandler) {
            window.removeEventListener('keydown', this._globalKeydownHandler);
            this._globalKeydownHandler = null;
        }
        if (this._globalKeyupHandler) {
            window.removeEventListener('keyup', this._globalKeyupHandler);
            this._globalKeyupHandler = null;
        }
        if (this._domRuntimeEventsHandler) {
            window.removeEventListener('GameRuntime_Event', this._domRuntimeEventsHandler);
            this._domRuntimeEventsHandler = null;
        }
    }
}
