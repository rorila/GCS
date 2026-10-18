import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export class TSpawner extends TWindow {
    /** Name des TSpriteTemplate, aus dem Instanzen gespawnt werden */
    public templateName: string = '';
    /** Schaltet den Spawner ein/aus */
    public enabled: boolean = true;
    /** Zeit zwischen zwei Spawns in Sekunden */
    public spawnInterval: number = 1.5;
    /** X-Position in Grid-Zellen, an der gespawnt wird (nur bei spawnAxis = 'Y') */
    public spawnX: number = 70;
    /** Fixe Y-Position in Grid-Zellen, wenn spawnAxis = 'X' */
    public spawnY: number = 20;
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
    /** Aktive Spawn-Achse: Y, X oder XY */
    public spawnAxis: 'Y' | 'X' | 'XY' = 'Y';
    /** Minimale X-Position */
    public spawnXMin: number = 0;
    /** Maximale X-Position */
    public spawnXMax: number = 70;
    /** Zufällige X-Position zwischen Min und Max */
    public randomizeX: boolean = true;
    private running: boolean = false;
    private callbacks: any = null;
    private templateId: string = '';
    private timer: number = 0;
    private activeInstances: any[] = [];

    constructor(name: string, x: number = 0, y: number = 0, width: number = 8, height: number = 2) {
        super(name, x, y, width, height);
        this.isService = true;
        this.isHiddenInRun = true;
        this.collisionEnabled = false;
        this.text = '';
        this.style.backgroundColor = '#34d399';
        this.style.borderColor = '#065f46';
        this.style.borderWidth = 2;
        this.style.color = '#ffffff';
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'templateName', label: 'Template-Name', type: 'string', group: 'SPAWNER ALLGEMEIN' },
            { name: 'enabled', label: 'Aktiviert', type: 'boolean', group: 'SPAWNER ALLGEMEIN' },
            { name: 'spawnInterval', label: 'Spawn-Intervall (s)', type: 'number', group: 'SPAWNER ALLGEMEIN' },
            { name: 'spawnAxis', label: 'Spawn-Achse', type: 'select', group: 'SPAWNER ALLGEMEIN', options: [{ value: 'Y', label: 'Y' }, { value: 'X', label: 'X' }, { value: 'XY', label: 'XY' }] },
            { name: 'spawnCountStart', label: 'Start-Spawns', type: 'number', group: 'SPAWNER ALLGEMEIN' },
            { name: 'recycleOffScreen', label: 'Recyclen wenn außerhalb', type: 'boolean', group: 'SPAWNER ALLGEMEIN' },
            { name: 'spawnY', label: 'Spawn-Y (fix, wenn X)', type: 'number', group: 'SPAWNER X' },
            { name: 'spawnXMin', label: 'Spawn-X Min (Zellen)', type: 'number', group: 'SPAWNER X' },
            { name: 'spawnXMax', label: 'Spawn-X Max (Zellen)', type: 'number', group: 'SPAWNER X' },
            { name: 'randomizeX', label: 'X zufällig', type: 'boolean', group: 'SPAWNER X' },
            { name: 'spawnX', label: 'Spawn-X (fix, wenn Y)', type: 'number', group: 'SPAWNER Y' },
            { name: 'spawnYMin', label: 'Spawn-Y Min (Zellen)', type: 'number', group: 'SPAWNER Y' },
            { name: 'spawnYMax', label: 'Spawn-Y Max (Zellen)', type: 'number', group: 'SPAWNER Y' },
            { name: 'randomizeY', label: 'Y zufällig', type: 'boolean', group: 'SPAWNER Y' }
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
            // Erste Spawns leicht versetzt bei Y-Achse, sonst zufällig im gewählten Achsenbereich
            if (this.spawnAxis === 'Y') {
                this.spawnOne(this.spawnX + i * 15);
            } else {
                this.spawnOne();
            }
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

    private spawnOne(x?: number, y?: number): void {
        if (!this.templateId) {
            this.findTemplate();
        }
        if (!this.templateId || !this.callbacks.spawnObject) return;

        let spawnX: number;
        if (x !== undefined) {
            spawnX = x;
        } else if (this.spawnAxis === 'X' || this.spawnAxis === 'XY') {
            spawnX = this.randomizeX
                ? this.spawnXMin + Math.random() * (this.spawnXMax - this.spawnXMin)
                : this.spawnXMin;
        } else {
            spawnX = this.spawnX;
        }

        let spawnY: number;
        if (y !== undefined) {
            spawnY = y;
        } else if (this.spawnAxis === 'Y' || this.spawnAxis === 'XY') {
            spawnY = this.randomizeY
                ? this.spawnYMin + Math.random() * (this.spawnYMax - this.spawnYMin)
                : this.spawnYMin;
        } else {
            spawnY = this.spawnY;
        }

        const instance = this.callbacks.spawnObject(this.templateId, spawnX, spawnY);
        if (!instance) return;

        // VelocityX kommt ausschließlich aus dem TSpriteTemplate (SpritePool.acquire)
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
            spawnY: this.spawnY,
            spawnAxis: this.spawnAxis,
            spawnXMin: this.spawnXMin,
            spawnXMax: this.spawnXMax,
            randomizeX: this.randomizeX,
            spawnYMin: this.spawnYMin,
            spawnYMax: this.spawnYMax,
            randomizeY: this.randomizeY,
            spawnCountStart: this.spawnCountStart,
            recycleOffScreen: this.recycleOffScreen
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
