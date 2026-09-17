import { Logger } from '../../utils/Logger';
import type { GameRuntime } from '../GameRuntime';
import { TSpriteTemplate } from '../../components/TSpriteTemplate';
import { GameLoopManager } from '../GameLoopManager';
const logger = Logger.get('RuntimeObjectService', 'Runtime_Execution');

export class RuntimeObjectService {
    public initSpritePools(runtime: GameRuntime): void {
            const templates = runtime.objects.filter(obj =>
                obj.className === 'TSpriteTemplate' || obj.constructor?.name === 'TSpriteTemplate'
            ) as TSpriteTemplate[];
    
            templates.forEach(template => {
                runtime.spritePool.init(template, runtime.objects, runtime.contextVars);
            });
        }

    /**
     * Setzt den Pool eines einzelnen Templates zur Laufzeit zurueck:
     * verwirft dessen bisherige Instanzen (auch verwaiste Eintraege, die
     * nach einem Stage-Wechsel nicht mehr in der Objektliste stehen) und
     * baut den Pool mit der aktuellen poolSize neu auf. Andere Pools
     * bleiben unveraendert. Wird ueber TSpriteTemplate.resetPool() aufgerufen.
     * @returns Anzahl der neu bereitgestellten Pool-Instanzen.
     */
    public resetSpritePool(runtime: GameRuntime, template: TSpriteTemplate): number {
        const spritePool = runtime.spritePool;

        // 1. Bisherige Instanzen dieses Templates aus Pool und Objektliste
        //    entfernen. Splice statt Neuzuweisung, damit saemtliche Referenzen
        //    auf runtime.objects (ActionExecutor, initRuntime-Callbacks)
        //    gueltig bleiben.
        const removed = spritePool.removePool(template.id);
        const removedIds = new Set(removed.map(s => s.id));
        for (let i = runtime.objects.length - 1; i >= 0; i--) {
            const o = runtime.objects[i] as any;
            if (removedIds.has(o.id) || (o.isPoolInstance && o.templateId === template.id)) {
                runtime.reactiveRuntime?.unregisterObject?.(o.id);
                runtime.objects.splice(i, 1);
            }
        }

        // 2. Pool neu aufbauen – init() haengt die neuen Instanzen an runtime.objects.
        //    Kontext: Variablen + Objekte nach Namen. Die Objekt-Aufloesung muss
        //    gewinnen, weil contextVars bei Listen (TObjectList) die alte
        //    Array-Referenz haelt, waehrend ${Liste.length} auf dem Objekt die
        //    aktuellen Records liefert.
        const context: Record<string, any> = { project: runtime.project };
        Object.assign(
            context,
            runtime.projectVariables,
            runtime.stageVariables,
        );
        runtime.objects.forEach((o: any) => {
            if (o.name) context[o.name] = o;
            if (o.id) context[o.id] = o;
        });
        const created = spritePool.init(template, runtime.objects, context);

        // 3. Reaktive Proxies registrieren und in der Objektliste hinterlegen,
        //    damit Property-Schreibzugriffe (visible, x, y) Watcher ausloesen.
        if (runtime.options.makeReactive && runtime.reactiveRuntime) {
            created.forEach(sprite => {
                const proxy = runtime.reactiveRuntime.registerObject(sprite.name, sprite, true);
                const idx = runtime.objects.indexOf(sprite);
                if (idx >= 0) runtime.objects[idx] = proxy;
            });
        }
        if (runtime.actionExecutor) runtime.actionExecutor.setObjects(runtime.objects);

        // 4. Neue Sprites dem GameLoop bekannt machen und die Buehne neu
        //    zeichnen (volles Render gleicht die DOM-Elemente ab).
        GameLoopManager.getInstance().syncObjects(runtime.objects as any);
        runtime.options.onRender?.();
        GameLoopManager.getInstance().requestRender();

        logger.info(`resetSpritePool: Pool "${template.name}" neu aufgebaut (${created.length} Instanzen)`);
        return created.length;
    }

    public spawnObject(runtime: GameRuntime, templateId: string, x?: number, y?: number): any {
            // Template-Objekt finden (für Velocity-Defaults)
            const template = runtime.objects.find(o => o.id === templateId) as TSpriteTemplate | undefined;
            if (!template) {
                logger.warn(`spawnObject: Template "${templateId}" nicht gefunden`);
                console.log(`[PUZZLE-DIAG] spawnObject: Template "${templateId}" NICHT gefunden (objects=${runtime.objects.length})`);
                return null;
            }

            console.log(`[PUZZLE-DIAG] spawnObject: template="${templateId}" hasPool=${runtime.spritePool.hasPool(templateId)} x=${x} y=${y}`);
    
            // Pool-basiertes Spawning
            if (runtime.spritePool.hasPool(templateId)) {
                const spawnX = x ?? template.x;
                const spawnY = y ?? template.y;
                const instance = runtime.spritePool.acquire(templateId, spawnX, spawnY, template);
                return instance;
            }
    
            logger.warn(`spawnObject: Kein Pool für Template "${templateId}" – kein Spawning möglich`);
            return null;
        }

    public destroyObject(runtime: GameRuntime, instanceId: string): void {
            // Versuche nach ID
            if (runtime.spritePool.release(instanceId)) {
                return;
            }
    
            // Versuche nach Name (für %Self%-Auflösung)
            if (runtime.spritePool.releaseByName(instanceId)) {
                return;
            }
    
            logger.warn(`destroyObject: Instanz "${instanceId}" nicht im Pool gefunden`);
        }

    public getContext(runtime: GameRuntime): Record<string, any> {
            const context: Record<string, any> = {
                project: runtime.project
            };
    
            // 1. Add variables (Data) first as baseline
            Object.assign(context, runtime.contextVars);
    
            // 2. Add all objects (Proxies/Components) - they overwrite variables with same name
            // This is crucial because TVariable components carry the "real" UI value.
            runtime.objects.forEach(obj => {
                if (obj.name) {
                    context[obj.name] = obj;
                }
                if (obj.id) {
                    context[obj.id] = obj;
                }
            });
    
            return context;
        }

    public getRawObject(runtime: GameRuntime, id: string): any | undefined {
            return runtime.objects.find(o => o.id === id);
        }

    public getObjects(runtime: GameRuntime): any[] {
            // Originale Proxy-Referenzen zurückgeben (neue Array-Instanz, aber gleiche Objekte)
            return [...runtime.objects];
        }

    public createPhantom(_runtime: GameRuntime, original: any): any {
            return {
                ...original,
                id: 'phantom_' + Math.random().toString(36).substr(2, 9),
                isPhantom: true,
                opacity: (original.opacity || 1) * 0.5
            };
        }

    public removeObject(runtime: GameRuntime, id: string): void {
            runtime.objects = runtime.objects.filter(o => o.id !== id);
            if (runtime.options.onRender) runtime.options.onRender();
        }
}
