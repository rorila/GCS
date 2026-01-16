import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
// import { TSprite } from './TSprite';

/**
 * TInputController - A stage-placeable component that handles keyboard input.
 * Place on stage, configure target sprites in Inspector, and it will handle player controls.
 */
export class TInputController extends TWindow {
    // Input settings
    public enabled: boolean = true;

    // Internal state
    private keysPressed: Set<string> = new Set();
    // private sprites: TSprite[] = [];
    private isActive: boolean = false;
    private eventCallback: ((id: string, event: string, data?: any) => void) | null = null;

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
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'enabled', label: 'Enabled', type: 'boolean', group: 'Input' }
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            enabled: this.enabled
        };
    }

    /**
     * Initialize with game objects and event callback
     */
    public init(_objects: TWindow[], eventCallback?: (id: string, event: string, data?: any) => void): void {
        // this.sprites = objects.filter(obj =>
        //     (obj as any).className === 'TSprite' || obj.constructor.name === 'TSprite'
        // ) as TSprite[];
        this.eventCallback = eventCallback || null;
    }

    /**
     * Start listening for keyboard events
     */
    public start(): void {
        if (this.isActive || !this.enabled) return;

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        this.isActive = true;
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
                this.eventCallback(this.id, `onKeyDown_${e.code}`, { keyCode: e.code });
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
