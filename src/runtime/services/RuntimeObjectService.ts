import { Logger } from '../../utils/Logger';
import type { GameRuntime } from '../GameRuntime';
import { TSpriteTemplate } from '../../components/TSpriteTemplate';
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

    public spawnObject(runtime: GameRuntime, templateId: string, x?: number, y?: number): any {
            // Template-Objekt finden (für Velocity-Defaults)
            const template = runtime.objects.find(o => o.id === templateId) as TSpriteTemplate | undefined;
            if (!template) {
                logger.warn(`spawnObject: Template "${templateId}" nicht gefunden`);
                return null;
            }
    
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
