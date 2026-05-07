import { actionRegistry } from '../../ActionRegistry';
import { resolveTarget } from '../ActionHelper';
import { Logger } from '../../../utils/Logger';
import { ExpressionParser } from '../../../runtime/ExpressionParser';
import { DebugLogService } from '../../../services/DebugLogService';

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

        // --- Variablen-Auflösung via ExpressionParser ---
        const exprContext = { ...context.vars, ...context.objects };
        if (context.eventData) {
            exprContext.$event = context.eventData;
            exprContext.self = context.eventData.self || context.vars?.self;
        } else if (context.vars && context.vars.self) {
            exprContext.self = context.vars.self;
        }

        let rawX = action.x;
        let rawY = action.y;
        if (typeof rawX === 'string' && rawX.includes('${')) rawX = ExpressionParser.interpolate(rawX, exprContext);
        if (typeof rawY === 'string' && rawY.includes('${')) rawY = ExpressionParser.interpolate(rawY, exprContext);

        let finalX = rawX;
        let finalY = rawY;
        let offsetX = 0;
        let offsetY = 0;

        if (action.referenceObject) {
            const refObj = resolveTarget(action.referenceObject, context.objects, context.vars, context.eventData);
            if (refObj) {
                let rawOffsetX = action.offsetX;
                let rawOffsetY = action.offsetY;
                
                if (typeof rawOffsetX === 'string' && rawOffsetX.includes('${')) rawOffsetX = ExpressionParser.interpolate(rawOffsetX, exprContext);
                if (typeof rawOffsetY === 'string' && rawOffsetY.includes('${')) rawOffsetY = ExpressionParser.interpolate(rawOffsetY, exprContext);

                const offsetXStr = String(rawOffsetX || '0').replace(',', '.');
                const offsetYStr = String(rawOffsetY || '0').replace(',', '.');
                offsetX = !isNaN(Number(offsetXStr)) ? Number(offsetXStr) : 0;
                offsetY = !isNaN(Number(offsetYStr)) ? Number(offsetYStr) : 0;
                
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
        
        runtimeLogger.info(`[spawn_object] Details -> Template: ${templateId}, RefObj: ${action.referenceObject || 'none'}, Offset: (${offsetX}, ${offsetY}), Final: (${x}, ${y})`, {
            actionConfig: { 
                rawOffsetX: action.offsetX, 
                rawOffsetY: action.offsetY, 
                rawX: action.x, 
                rawY: action.y 
            },
            resolved: { offsetX, offsetY, x, y }
        });
        
        DebugLogService.getInstance().log('Action', `Spawned: ${templateId} an Position (${x || 0}, ${y || 0}) (Basis: ${action.referenceObject || 'N/A'}, Offset: ${offsetX || 0}, ${offsetY || 0})`, {
            data: {
                type: 'spawn_object_details',
                templateId,
                referenceObject: action.referenceObject,
                offsetX,
                offsetY,
                finalX: x,
                finalY: y
            }
        });
        
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
