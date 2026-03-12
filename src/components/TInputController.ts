import { TPropertyDef, IRuntimeComponent } from './TComponent';
import { TWindow } from './TWindow';
import { Logger } from '../utils/Logger';

/**
 * TInputController - A stage-placeable component that handles keyboard input.
 * Place on stage, configure target sprites in Inspector, and it will handle player controls.
 */
export class TInputController extends TWindow implements IRuntimeComponent {
    private static logger = Logger.get('TInputController', 'Input_Handling');

    // Input settings
    public enabled: boolean = true;

    // Internal state
    private keysPressed: Set<string> = new Set();
    private isActive: boolean = false;
    private eventCallback: ((id: string, event: string, data?: any) => void) | null = null;

    // 🔍 Debug: Instance-ID um mehrere Instanzen zu unterscheiden
    private _instanceId = Math.random().toString(36).substr(2, 5);

    // Event handlers (bound for proper removal)
    private handleKeyDown: (e: KeyboardEvent) => void;
    private handleKeyUp: (e: KeyboardEvent) => void;

    constructor(name: string, x: number = 0, y: number = 0) {
        super(name, x, y, 3, 1);
        // Visual indicator style
        this.style.backgroundColor = '#9c27b0';
        this.style.borderColor = '#6a1b9a';
        this.style.borderWidth = 2;
        this.style.color = '#ffffff';

        // Bind handlers
        this.handleKeyDown = this.onKeyDown.bind(this);
        this.handleKeyUp = this.onKeyUp.bind(this);

        // Visibility & Scoping Meta-Flags
        this.isService = true;
        this.isHiddenInRun = true;

        TInputController.logger.info(`[IC-${this._instanceId}] CONSTRUCTOR: name=${name}`);
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'enabled', label: 'Enabled', type: 'boolean', group: 'Input' }
        ];
    }

    public toJSON(): any {
        return super.toJSON();
    }

    public initRuntime(callbacks: { handleEvent: any, objects: any[] }): void {
        this.init(callbacks.objects, callbacks.handleEvent);
        // Store globally so instances can self-heal if HMR breaks the reference
        (window as any).__inputControllerCallback = callbacks.handleEvent;
        (window as any).__inputControllerObjects = callbacks.objects;
    }

    public onRuntimeStart(): void {
        this.start();
    }

    public onRuntimeStop(): void {
        this.stop();
    }

    /**
     * Initialize with game objects and event callback
     */
    public init(_objects: TWindow[], eventCallback?: (id: string, event: string, data?: any) => void): void {
        this.eventCallback = eventCallback || null;
        TInputController.logger.info(`[IC-${this._instanceId}] INIT: hasCallback=${!!this.eventCallback}`);
    }

    /**
     * Start listening for keyboard events
     */
    public start(): void {
        TInputController.logger.info(`[IC-${this._instanceId}] START called: isActive=${this.isActive}, enabled=${this.enabled}`);
        if (this.isActive || !this.enabled) return;

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        this.isActive = true;
        TInputController.logger.info(`[IC-${this._instanceId}] START done: isActive=${this.isActive}`);
    }

    /**
     * Stop listening for keyboard events
     */
    public stop(): void {
        if (!this.isActive) return;

        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.keysPressed.clear();
        this.isActive = false;
    }

    /**
     * Handle keydown event
     */
    private onKeyDown(e: KeyboardEvent): void {
        // Self-healing: Falls kein Callback gesetzt, versuche globalen Callback zu holen
        if (!this.eventCallback && (window as any).__inputControllerCallback) {
            this.eventCallback = (window as any).__inputControllerCallback;
            this.isActive = true;
            TInputController.logger.warn(`[IC-${this._instanceId}] 🔧 SELF-HEAL: Callback aus window.__inputControllerCallback geholt!`);
        }

        // 🔍 DEBUG: Tastendruck sichtbar machen
        TInputController.logger.info(`[IC-${this._instanceId}] 🎮 KEY DOWN: ${e.code} | isActive=${this.isActive} | hasCallback=${!!this.eventCallback}`);

        // Prevent default for game keys to avoid scrolling
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) {
            e.preventDefault();
        }

        // Only add if not already pressed (avoid repeated events)
        if (!this.keysPressed.has(e.code)) {
            this.keysPressed.add(e.code);

            // Notify multiplayer syncer if available
            if ((window as any).__multiplayerInputCallback) {
                (window as any).__multiplayerInputCallback(e.code, 'down');
            }

            // TRIGGER TASK SIGNAL
            if (this.eventCallback) {
                TInputController.logger.info(`[InputController] ➡️ CALLBACK: id=${this.id}, event=onKeyDown_${e.code}`);
                this.eventCallback(this.id, `onKeyDown_${e.code}`, { keyCode: e.code });
            } else {
                TInputController.logger.warn(`[InputController] ❌ KEIN CALLBACK! Event onKeyDown_${e.code} geht verloren!`);
            }
        }
    }

    /**
     * Handle keyup event
     */
    private onKeyUp(e: KeyboardEvent): void {
        this.keysPressed.delete(e.code);

        // Notify multiplayer syncer if available
        if ((window as any).__multiplayerInputCallback) {
            (window as any).__multiplayerInputCallback(e.code, 'up');
        }

        // TRIGGER TASK SIGNAL
        if (this.eventCallback) {
            this.eventCallback(this.id, `onKeyUp_${e.code}`, { keyCode: e.code });
        }
    }

    /**
     * Simulate a remote key press (for multiplayer)
     */
    public simulateKeyPress(code: string): void {
        if (!this.keysPressed.has(code)) {
            this.keysPressed.add(code);
            if (this.eventCallback) {
                this.eventCallback(this.id, `onKeyDown_${code}`, { keyCode: code });
            }
        }
    }

    /**
     * Simulate a remote key release (for multiplayer)
     */
    public simulateKeyRelease(code: string): void {
        if (this.keysPressed.has(code)) {
            this.keysPressed.delete(code);
            if (this.eventCallback) {
                this.eventCallback(this.id, `onKeyUp_${code}`, { keyCode: code });
            }
        }
    }

    /**
     * Update sprites (called by GameLoop)
     */
    public update(): void {
        // No default movement logic anymore; handled by tasks
    }

    public getEvents(): string[] {
        const events = super.getEvents();
        return [
            ...events,
            'onKeyDown_KeyW',
            'onKeyDown_KeyS',
            'onKeyDown_KeyA',
            'onKeyDown_KeyD',
            'onKeyDown_ArrowUp',
            'onKeyDown_ArrowDown',
            'onKeyDown_ArrowLeft',
            'onKeyDown_ArrowRight',
            'onKeyDown_Space',
            'onKeyDown_Enter',
            'onKeyUp_KeyW',
            'onKeyUp_KeyS',
            'onKeyUp_KeyA',
            'onKeyUp_KeyD',
            'onKeyUp_ArrowUp',
            'onKeyUp_ArrowDown',
            'onKeyUp_ArrowLeft',
            'onKeyUp_ArrowRight',
            'onKeyUp_Space',
            'onKeyUp_Enter'
        ];
    }
}
