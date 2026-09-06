import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { unwrap } from '../runtime/ReactiveProperty';

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
    //
    // PERF: Der Unterstrich-Praefix ist zwingend. Diese Objekte sind zur
    // Laufzeit in einen reaktiven Proxy gehuellt; jeder Schreibzugriff loest
    // watcher.notify() aus. Der globale Listener in GameRuntime verwirft
    // Properties mit '_' fruehzeitig — ohne den Praefix landet der interne
    // Zaehlerstand im generischen Render-Pfad.
    private _currentFrame: number = 0;
    private _elapsedMs: number = 0;
    private _runtimeCallbacks: any = null;
    private _targetSprites: any[] = [];
    private _lastObjectCount: number = -1;

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
    private _lastAppliedFrame: number = -1;

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
        this._runtimeCallbacks = callbacks;
    }

    public onRuntimeStart(): void {
        this._currentFrame = 0;
        this._elapsedMs = 0;
        this._lastAppliedFrame = -1;
        this.rebuildTargets(this._runtimeCallbacks?.objects || []);
    }

    private rebuildTargets(objects: any[]): void {
        this._lastObjectCount = objects.length;
        this._targetSprites.length = 0;
        for (let i = 0; i < objects.length; i++) {
            const proxy = objects[i];
            const raw = unwrap(proxy) || proxy;
            if ((raw.className === 'TSprite' || raw.constructor?.name === 'TSprite') && raw.animationId === this.name) {
                this._targetSprites.push(raw);
            }
        }
    }

    public onRuntimeUpdate(deltaTime: number): void {
        if (!this.enabled || !this.imageListId) return;

        this._elapsedMs += deltaTime * 1000;

        const duration = Math.max(1, this.frameDuration);
        if (this._elapsedMs >= duration) {
            const framesToAdvance = Math.floor(this._elapsedMs / duration);
            this._elapsedMs = this._elapsedMs % duration;

            this._currentFrame += framesToAdvance;
            const count = Math.max(1, this.imageCount);

            if (this._currentFrame >= count) {
                if (this.loop) {
                    this._currentFrame = this._currentFrame % count;
                } else {
                    this._currentFrame = count - 1;
                    this.enabled = false;
                }
            }
        }

        // Nur uebertragen, wenn sich der Frame tatsaechlich geaendert hat.
        // Bei 100 ms Framedauer und 60 Bildern pro Sekunde entfaellt damit
        // rund fuenf Sechstel der bisherigen Arbeit.
        if (this._currentFrame === this._lastAppliedFrame) return;
        this._lastAppliedFrame = this._currentFrame;

        const objects = this._runtimeCallbacks?.objects;
        if (!objects) return;
        if (objects.length !== this._lastObjectCount) {
            this.rebuildTargets(objects);
        }

        for (let i = 0; i < this._targetSprites.length; i++) {
            const raw = this._targetSprites[i];
            raw.imageListId = this.imageListId;
            raw.imageIndex = this._currentFrame;
            this._runtimeCallbacks?.markSpriteDirty?.(raw);
        }
    }

    public onRuntimeStop(): void {
        this._currentFrame = 0;
        this._elapsedMs = 0;
        this._lastAppliedFrame = -1;
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
