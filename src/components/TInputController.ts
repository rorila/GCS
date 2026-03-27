import { TPropertyDef, IRuntimeComponent } from './TComponent';
import { TWindow } from './TWindow';
import { Logger } from '../utils/Logger';

/**
 * TInputController - A stage-placeable component that handles keyboard input.
 * Place on stage, configure target sprites in Inspector, and it will handle player controls.
 * 
 * WICHTIG (v3.29.0): Die Event-Listener auf `window` werden NICHT von dieser Komponente
 * verwaltet, sondern von GameRuntime.initInputControllers() über ein Single-Global-Handler
 * Pattern. Dies verhindert stale Listener, die durch hydrateObjects()-Instanzwiederverwendung
 * entstehen können.
 */
export class TInputController extends TWindow implements IRuntimeComponent {
    private static logger = Logger.get('TInputController', 'Input_Handling');

    // Input settings
    public enabled: boolean = true;

    // Internal state
    public keysPressed: Set<string> = new Set();
    public isActive: boolean = false;
    public eventCallback: ((id: string, event: string, data?: any) => void) | null = null;

    // 🔍 Debug: Instance-ID um mehrere Instanzen zu unterscheiden
    public _instanceId = Math.random().toString(36).substr(2, 5);

    constructor(name: string, x: number = 0, y: number = 0) {
        super(name, x, y, 3, 1);
        // Visual indicator style
        this.style.backgroundColor = '#9c27b0';
        this.style.borderColor = '#6a1b9a';
        this.style.borderWidth = 2;
        this.style.color = '#ffffff';

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
        // Store globally for multiplayer and external reference
        (window as any).__inputControllerCallback = callbacks.handleEvent;
        (window as any).__inputControllerObjects = callbacks.objects;
    }

    public onRuntimeStart(): void {
        // NOOP: Listener werden von GameRuntime.initInputControllers() verwaltet
    }

    public onRuntimeStop(): void {
        this.resetState();
    }

    /**
     * Initialize with game objects and event callback
     */
    public init(_objects: TWindow[], eventCallback?: (id: string, event: string, data?: any) => void): void {
        this.eventCallback = eventCallback || null;
        TInputController.logger.info(`[IC-${this._instanceId}] INIT: hasCallback=${!!this.eventCallback}`);
    }

    /**
     * Reset internal state (called by GameRuntime during cleanup)
     */
    public resetState(): void {
        this.keysPressed.clear();
        this.isActive = false;
        this.eventCallback = null;
    }

    /**
     * Mark as active (called by GameRuntime after global listener is set up)
     */
    public start(): void {
        this.isActive = true;
        TInputController.logger.info(`[IC-${this._instanceId}] Marked active`);
    }

    /**
     * Mark as inactive and clean up state
     */
    public stop(): void {
        this.resetState();
    }

    /**
     * Handle keydown event — called by GameRuntime's global handler
     */
    public handleKeyDownEvent(e: KeyboardEvent): void {
        if (!this.isActive || !this.enabled) return;

        // Prevent default for game keys to avoid scrolling or button re-triggering
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'Enter'].includes(e.code)) {
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
     * Handle keyup event — called by GameRuntime's global handler
     */
    public handleKeyUpEvent(e: KeyboardEvent): void {
        if (!this.isActive || !this.enabled) return;

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
