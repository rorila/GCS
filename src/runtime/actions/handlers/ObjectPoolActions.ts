import { actionRegistry } from '../../ActionRegistry';
import { resolveTarget } from '../ActionHelper';
import { Logger } from '../../../utils/Logger';

const runtimeLogger = Logger.get('Action', 'Runtime_Execution');

export function registerObjectPoolActions() {
    // ─── OBJECT POOL ACTIONS ───────────────────────────────────────
    actionRegistry.register('spawn_object', (action, context) => {
        if (!context.spawnObject) {
            runtimeLogger.warn('spawn_object: kein spawnObject-Callback verfügbar');
            return null;
        }
        
        let templateId = action.templateId || action.target;
        const templateObj = resolveTarget(templateId, context.objects, context.vars, context.eventData);
        if (templateObj) {
            templateId = templateObj.id || templateObj.name;
        } else {
            runtimeLogger.warn(`[spawn_object] Template "${action.templateId}" nicht gefunden!`);
        }

        let finalX = action.x;
        let finalY = action.y;

        if (action.referenceObject) {
            const refObj = resolveTarget(action.referenceObject, context.objects, context.vars, context.eventData);
            if (refObj) {
                const offsetXStr = String(action.offsetX || '0').replace(',', '.');
                const offsetYStr = String(action.offsetY || '0').replace(',', '.');
                const offsetX = !isNaN(Number(offsetXStr)) ? Number(offsetXStr) : 0;
                const offsetY = !isNaN(Number(offsetYStr)) ? Number(offsetYStr) : 0;
                
                // MULTI-SPAWN LOGIC: Wenn das Bezugsobjekt ein Template ist und ein spezieller Modus gewählt wurde
                if (refObj.className === 'TSpriteTemplate' && action.spawnMode && action.spawnMode !== 'normal') {
                    const activeInstances = context.objects.filter(o => o.templateId === refObj.id && o.visible === true);
                    
                    if (activeInstances.length === 0) {
                        runtimeLogger.debug(`[spawn_object] ${action.spawnMode}: Keine aktiven Instanzen für "${refObj.name}" – übersprungen`);
                        return null;
                    }

                    if (action.spawnMode === 'all_active') {
                        // Alle aktiven Ufos schießen
                        runtimeLogger.info(`[spawn_object] all_active: ${activeInstances.length} Instanzen von "${refObj.name}" schießen`);
                        activeInstances.forEach(inst => {
                            context.spawnObject!(templateId, (inst.x || 0) + offsetX, (inst.y || 0) + offsetY);
                        });
                        return true;
                    } else if (action.spawnMode === 'random_active') {
                        // Nur ein zufälliges aktives Ufo schießt
                        const randomIndex = Math.floor(Math.random() * activeInstances.length);
                        const inst = activeInstances[randomIndex];
                        runtimeLogger.info(`[spawn_object] random_active: ${inst.name} @ (${inst.x}, ${inst.y}) schießt`);
                        return context.spawnObject!(templateId, (inst.x || 0) + offsetX, (inst.y || 0) + offsetY);
                    }
                }

                // NORMAL LOGIC: Nur einmal am Bezugsobjekt spawnen
                finalX = (refObj.x || 0) + offsetX;
                finalY = (refObj.y || 0) + offsetY;
            } else {
                runtimeLogger.warn(`[spawn_object] Bezugsobjekt "${action.referenceObject}" nicht gefunden!`);
            }
        }

        const xStr = finalX !== undefined && finalX !== null && finalX !== '' ? String(finalX).replace(',', '.') : '';
        const yStr = finalY !== undefined && finalY !== null && finalY !== '' ? String(finalY).replace(',', '.') : '';
        const x = xStr !== '' && !isNaN(Number(xStr)) ? Number(xStr) : undefined;
        const y = yStr !== '' && !isNaN(Number(yStr)) ? Number(yStr) : undefined;
        
        return context.spawnObject!(templateId, x, y);
    }, {
        type: 'spawn_object',
        label: 'Objekt spawnen',
        description: 'Holt eine Instanz aus dem Object Pool eines TSpriteTemplate.',
        parameters: [
            { name: 'templateId', label: 'Template', type: 'select', source: 'objects', hint: 'Das TSpriteTemplate' },
            { name: 'referenceObject', label: 'Spawnen bei Objekt', type: 'select', source: 'objects', hint: 'Optional: Koords von dieses Objekts übernehmen' },
            { name: 'spawnMode', label: 'Template Spawn Modus', type: 'select', options: ['normal', 'all_active', 'random_active'], defaultValue: 'normal', hint: 'Gilt nur, wenn das Bezugsobjekt ein Template ist.' },
            { name: 'offsetX', label: 'Offset X', type: 'number', hint: 'Verschiebung auf X-Achse' },
            { name: 'offsetY', label: 'Offset Y', type: 'number', hint: 'Verschiebung auf Y-Achse' },
            { name: 'x', label: 'Absolute X-Position', type: 'number', hint: 'Nur wenn kein Bezugsobjekt gewählt ist' },
            { name: 'y', label: 'Absolute Y-Position', type: 'number', hint: 'Nur wenn kein Bezugsobjekt gewählt ist' }
        ]
    });

    actionRegistry.register('destroy_object', (action, context) => {
        if (!context.destroyObject) {
            runtimeLogger.warn('destroy_object: kein destroyObject-Callback verfügbar');
            return;
        }
        const target = resolveTarget(action.target, context.objects, context.vars, context.eventData);
        if (target) {
            context.destroyObject(target.id || target.name);
        } else {
            context.destroyObject(action.target);
        }
    }, {
        type: 'destroy_object',
        label: 'Objekt zerstören',
        description: 'Gibt eine Pool-Instanz zurück (macht sie unsichtbar und verfügbar).',
        parameters: [
            { name: 'target', label: 'Ziel-Objekt', type: 'string', hint: 'Pool-Instanz oder %Self%' }
        ]
    });
}
