import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export class TSpawner extends TWindow {
    /** Name des TSpriteTemplate, aus dem Instanzen gespawnt werden */
    public templateName: string = '';
    /** Schaltet den Spawner ein/aus */
    public enabled: boolean = true;
    /** Zeit zwischen zwei Spawns in Sekunden */
    public spawnInterval: number = 1.5;
    /** X-Position in Grid-Zellen, an der gespawnt wird */
    public spawnX: number = 70;
    /** Minimale Y-Position */
    public spawnYMin: number = 20;
    /** Maximale Y-Position */
    public spawnYMax: number = 35;
    /** Anzahl sofortiger Spawns beim Start */
    public spawnCountStart: number = 3;
    /** Zufällige Y-Position zwischen Min und Max */
    public randomizeY: boolean = true;
    /** Instanzen automatisch zurückgeben, wenn sie links aus dem Bild laufen */
    public recycleOffScreen: boolean = true;
    /** Optionale Überschreibung der X-Geschwindigkeit */
    public velocityX: number | undefined = undefined;

    private running: boolean = false;
    private callbacks: any = null;
    private templateId: string = '';
    private timer: number = 0;
    private activeInstances: any[] = [];

    constructor(name: string, x: number, y: number, width: number, height: number) {
        super(name, x, y, width, height);
        this.isHiddenInRun = true;
        this.collisionEnabled = false;
        this.text = '';
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'templateName', label: 'Template-Name', type: 'string', group: 'SPAWNER' },
            { name: 'enabled', label: 'Aktiviert', type: 'boolean', group: 'SPAWNER' },
            { name: 'spawnInterval', label: 'Spawn-Intervall (s)', type: 'number', group: 'SPAWNER' },
            { name: 'spawnX', label: 'Spawn-X (Zellen)', type: 'number', group: 'SPAWNER' },
            { name: 'spawnYMin', label: 'Spawn-Y Min (Zellen)', type: 'number', group: 'SPAWNER' },
            { name: 'spawnYMax', label: 'Spawn-Y Max (Zellen)', type: 'number', group: 'SPAWNER' },
            { name: 'spawnCountStart', label: 'Start-Spawns', type: 'number', group: 'SPAWNER' },
            { name: 'randomizeY', label: 'Y zufällig', type: 'boolean', group: 'SPAWNER' },
            { name: 'recycleOffScreen', label: 'Recyclen wenn außerhalb', type: 'boolean', group: 'SPAWNER' },
            { name: 'velocityX', label: 'Velocity X (optional)', type: 'number', group: 'SPAWNER' }
        ];
    }

    public initRuntime(callbacks: any): void {
        this.callbacks = callbacks;
        this.running = true;
    }

    public onRuntimeStart(): void {
        this.running = true;
        this.timer = 0;
        this.activeInstances = [];
        this.findTemplate();

        for (let i = 0; i < this.spawnCountStart; i++) {
            // Erste Spawns leicht versetzt, damit sie nicht alle übereinander liegen
            this.spawnOne(this.spawnX + i * 15);
        }
    }

    public onRuntimeStop(): void {
        this.running = false;
        this.activeInstances = [];
    }

    public onRuntimeUpdate(deltaTime: number): void {
        if (!this.running || !this.enabled || !this.callbacks) return;

        this.timer += deltaTime;
        if (this.timer >= this.spawnInterval) {
            this.timer = 0;
            this.spawnOne();
        }

        if (this.recycleOffScreen) {
            this.recycleOffScreenInstances();
        }
    }

    private findTemplate(): void {
        this.templateId = '';
        const template = (this.callbacks.objects || []).find((o: any) => o.name === this.templateName && (o.className === 'TSpriteTemplate' || o.constructor?.name === 'TSpriteTemplate'));
        if (template) {
            this.templateId = template.id || template.name;
        } else {
            logger.warn(`[TSpawner] Template "${this.templateName}" nicht gefunden`);
        }
    }

    private spawnOne(x: number = this.spawnX): void {
        if (!this.templateId) {
            this.findTemplate();
        }
        if (!this.templateId || !this.callbacks.spawnObject) return;

        const y = this.randomizeY
            ? this.spawnYMin + Math.random() * (this.spawnYMax - this.spawnYMin)
            : this.spawnYMin;

        const instance = this.callbacks.spawnObject(this.templateId, x, y);
        if (!instance) return;

        if (this.velocityX !== undefined) {
            instance.velocityX = this.velocityX;
        }

        this.activeInstances.push(instance);
    }

    private recycleOffScreenInstances(): void {
        if (!this.callbacks.destroyObject) return;

        for (let i = this.activeInstances.length - 1; i >= 0; i--) {
            const inst = this.activeInstances[i];
            const rightEdge = (inst.x || 0) + (inst.width || 0);
            if (rightEdge < 0) {
                this.callbacks.destroyObject(inst.id || inst.name);
                this.activeInstances.splice(i, 1);
            }
        }
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            templateName: this.templateName,
            enabled: this.enabled,
            spawnInterval: this.spawnInterval,
            spawnX: this.spawnX,
            spawnYMin: this.spawnYMin,
            spawnYMax: this.spawnYMax,
            spawnCountStart: this.spawnCountStart,
            randomizeY: this.randomizeY,
            recycleOffScreen: this.recycleOffScreen,
            velocityX: this.velocityX
        };
    }
}

import { ComponentRegistry } from '../utils/ComponentRegistry';
import { Logger } from '../utils/Logger';
const logger = Logger.get('TSpawner');

ComponentRegistry.register('TSpawner', (objData: any) => new TSpawner(
    objData.name,
    objData.x ?? 0,
    objData.y ?? 0,
    objData.width ?? 4,
    objData.height ?? 2
));
