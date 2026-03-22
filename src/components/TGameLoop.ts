import { TPropertyDef } from './TComponent';
import { TWindow } from './TWindow';
import { GridConfig } from '../model/types';

export type GameLoopState = 'stopped' | 'running' | 'paused';
export type BoundaryMode = 'clamp' | 'event-only' | 'bounce';

/**
 * TGameLoop - Konfigurations-Container für den Game-Loop.
 * 
 * Auf der Stage platzierbar. Konfiguriert boundsOffsetTop/Bottom und targetFPS
 * im Inspector. Der eigentliche Loop wird vom GameLoopManager (Singleton) betrieben,
 * der diese Werte bei GameRuntime.initMainGame() ausliest.
 * 
 * WICHTIG: TGameLoop startet KEINEN eigenen Loop!
 * Der GameLoopManager übernimmt Sprite-Updates, Kollisionen und Boundary-Checks.
 */
export class TGameLoop extends TWindow {
    // Loop settings (read by GameLoopManager)
    public targetFPS: number = 60;
    public state: GameLoopState = 'stopped';

    // Offset for playable area (e.g., for headers/footers)
    public boundsOffsetTop: number = 0;
    public boundsOffsetBottom: number = 0;

    // Boundary behaviour for sprites
    public boundaryMode: BoundaryMode = 'clamp';

    // Grid reference (set via initRuntime)
    private gridConfig: GridConfig | null = null;

    constructor(name: string, x: number = 0, y: number = 0) {
        super(name, x, y, 3, 1);
        this.style.backgroundColor = '#2196f3';
        this.style.borderColor = '#1565c0';
        this.style.borderWidth = 2;
        this.style.color = '#ffffff';

        this.isService = true;
        this.isHiddenInRun = true;
        (this as any).isBlueprintOnly = true;
    }

    // Bounds derived from gridConfig (used by GameLoopManager at init)
    public get boundsWidth(): number {
        const grid = this.gridConfig as any;
        return grid?.grid?.cols ?? grid?.cols ?? 64;
    }
    public set boundsWidth(_) { /* no-op */ }

    public get boundsHeight(): number {
        const grid = this.gridConfig as any;
        return grid?.grid?.rows ?? grid?.rows ?? 40;
    }
    public set boundsHeight(_) { /* no-op */ }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'targetFPS', label: 'Target FPS', type: 'number', group: 'Loop Settings' },
            { name: 'boundaryMode', label: 'Boundary Mode', type: 'select', group: 'Boundaries', options: ['clamp', 'event-only', 'bounce'] },
            { name: 'boundsOffsetTop', label: 'Bounds Offset Top', type: 'number', group: 'Boundaries' },
            { name: 'boundsOffsetBottom', label: 'Bounds Offset Bottom', type: 'number', group: 'Boundaries' }
        ];
    }

    public toJSON(): any {
        return super.toJSON();
    }

    /**
     * IRuntimeComponent: Speichert gridConfig für Bounds-Berechnung.
     * Der GameLoopManager liest boundsOffsetTop/Bottom direkt aus diesem Objekt.
     */
    public initRuntime(callbacks: { handleEvent: any; render: any; gridConfig: any; objects: any[] }): void {
        this.gridConfig = callbacks.gridConfig;
    }

    /**
     * NICHT starten! Der GameLoopManager (Singleton) übernimmt den Loop.
     * TGameLoop dient nur als Konfigurations-Container.
     */
    public onRuntimeStart(): void {
        // Kein eigener Loop — GameLoopManager übernimmt
    }

    public onRuntimeStop(): void {
        this.state = 'stopped';
    }

    public getEvents(): string[] {
        const baseEvents = super.getEvents();
        if (!baseEvents.includes('onFrame')) {
            baseEvents.push('onFrame');
        }
        return baseEvents;
    }

}
