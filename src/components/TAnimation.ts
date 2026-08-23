import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

/**
 * TAnimation - Zyklisches Sprite-Sheet-Animation
 *
 * Kann einem oder mehreren Sprites zugeordnet werden.
 * Das Sprite trägt `animationId` = Name dieser TAnimation.
 */
export class TAnimation extends TWindow {
    /** Name/ID der TImageList mit den Animations-Frames */
    public imageListId: string = '';
    /** Anzahl der zu verwendenden Frames */
    public imageCount: number = 1;
    /** Dauer pro Frame in Millisekunden */
    public frameDuration: number = 100;
    /** Animation wiederholen? */
    public loop: boolean = true;
    /** Automatisch abspielen? */
    public enabled: boolean = true;

    // Runtime state
    private currentFrame: number = 0;
    private elapsedMs: number = 0;
    private runtimeCallbacks: any = null;

    /**
     * Zuletzt an die Sprites uebertragener Frame; -1 erzwingt die erste
     * Uebertragung.
     *
     * PERF: Ohne diesen Merker wurden imageListId und imageIndex bei JEDEM
     * Loop-Durchlauf neu zugewiesen — auch wenn sich der Frame gar nicht
     * geaendert hatte. Da imageIndex nicht zu den Loop-eigenen Sprite-
     * Eigenschaften zaehlt, loeste jede Zuweisung ein einzelnes DOM-Update
     * mit Bildwechsel aus.
     */
    private lastAppliedFrame: number = -1;

    constructor(name: string, x: number, y: number, width: number = 2, height: number = 2) {
        super(name, x, y, width, height);
        this.isHiddenInRun = true;
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'imageListId', label: 'Image List', type: 'select', source: 'imageLists', group: 'ANIMATION', hint: 'TImageList mit den Animations-Frames' },
            { name: 'imageCount', label: 'Anzahl Bilder', type: 'number', min: 1, step: 1, group: 'ANIMATION' },
            { name: 'frameDuration', label: 'Dauer pro Bild (ms)', type: 'number', min: 1, step: 10, group: 'ANIMATION' },
            { name: 'loop', label: 'Wiederholen', type: 'boolean', group: 'ANIMATION' },
            { name: 'enabled', label: 'Aktiviert', type: 'boolean', group: 'ANIMATION' }
        ];
    }

    public initRuntime(callbacks: any): void {
        this.runtimeCallbacks = callbacks;
    }

    public onRuntimeStart(): void {
        this.currentFrame = 0;
        this.elapsedMs = 0;
        this.lastAppliedFrame = -1;
    }

    public onRuntimeUpdate(deltaTime: number): void {
        if (!this.enabled || !this.imageListId) return;

        this.elapsedMs += deltaTime * 1000;

        const duration = Math.max(1, this.frameDuration);
        if (this.elapsedMs >= duration) {
            const framesToAdvance = Math.floor(this.elapsedMs / duration);
            this.elapsedMs = this.elapsedMs % duration;

            this.currentFrame += framesToAdvance;
            const count = Math.max(1, this.imageCount);

            if (this.currentFrame >= count) {
                if (this.loop) {
                    this.currentFrame = this.currentFrame % count;
                } else {
                    this.currentFrame = count - 1;
                    this.enabled = false;
                }
            }
        }

        // Nur uebertragen, wenn sich der Frame tatsaechlich geaendert hat.
        // Bei 100 ms Framedauer und 60 Bildern pro Sekunde entfaellt damit
        // rund fuenf Sechstel der bisherigen Arbeit.
        if (this.currentFrame === this.lastAppliedFrame) return;
        this.lastAppliedFrame = this.currentFrame;

        const objects = this.runtimeCallbacks?.objects || [];
        const isMatch = (obj: any) => (obj.className === 'TSprite' || obj.constructor?.name === 'TSprite') && obj.animationId === this.name;
        objects.forEach((obj: any) => {
            if (isMatch(obj)) {
                obj.imageListId = this.imageListId;
                obj.imageIndex = this.currentFrame;
            }
        });
    }

    public onRuntimeStop(): void {
        this.currentFrame = 0;
        this.elapsedMs = 0;
        this.lastAppliedFrame = -1;
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            imageListId: this.imageListId,
            imageCount: this.imageCount,
            frameDuration: this.frameDuration,
            loop: this.loop,
            enabled: this.enabled
        };
    }
}

import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TAnimation', (objData: any) => new TAnimation(objData.name, objData.x, objData.y, objData.width, objData.height), ['Animation']);
