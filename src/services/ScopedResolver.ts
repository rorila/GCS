/**
 * ScopedResolver — Zentrale Auflösung von Tasks und Actions im Stage-Kontext.
 * 
 * Phase 2/3 des Refactors: Single Source of Truth für alle Lookups.
 * Ersetzt die verstreuten `find(t => t.name === ...)` Logiken.
 * 
 * Auflösungsreihenfolge (definiert und konsistent):
 * 1. Stage-Kontext (wenn angegeben/explizit)
 * 2. Aktive Stage (wenn im Editor-Kontext)
 * 3. Blueprint Stage (globale Definitionen)
 * 4. Legacy Root (project.tasks/actions - Fallback)
 * 
 * @since Phase 2/3 — Task/Action Identity Refactor
 */

import { coreStore } from './registry/CoreStore';
import { Logger } from '../utils/Logger';

const logger = Logger.get('ScopedResolver');

export interface ResolutionContext {
    stageId?: string;           // Explizite Stage-Priorität
    useActiveStage?: boolean;   // Aktive Stage priorisieren (Editor-Modus)
    includeBlueprint?: boolean; // Blueprint durchsuchen (default: true)
    includeRoot?: boolean;      // Legacy Root durchsuchen (default: true)
}

export class ScopedResolver {
    private static instance: ScopedResolver;
    
    private constructor() {}
    
    public static getInstance(): ScopedResolver {
        if (!ScopedResolver.instance) {
            ScopedResolver.instance = new ScopedResolver();
        }
        return ScopedResolver.instance;
    }

    // ========================================================================
    // Task Resolution
    // ========================================================================

    /**
     * Löst einen Task-Namen im gegebenen Kontext auf.
     * 
     * @param taskName Der zu suchende Task-Name
     * @param context Auflösungskontext (Stage, aktive Stage, etc.)
     * @returns Der Task oder null
     */
    public resolveTask(taskName: string, context: ResolutionContext = {}): any | null {
        const project = coreStore.project;
        if (!project || !taskName) return null;

        // 1. Explizite Stage priorisieren
        if (context.stageId) {
            const stage = project.stages?.find((s: any) => s.id === context.stageId);
            const task = stage?.tasks?.find((t: any) => t.name === taskName);
            if (task) {
                logger.debug(`resolveTask: "${taskName}" in expliziter Stage "${stage?.name}" gefunden.`);
                return task;
            }
        }

        // 2. Aktive Stage priorisieren (wenn gewünscht und vorhanden)
        if (context.useActiveStage !== false) {
            const activeId = coreStore.activeStageId;
            if (activeId) {
                const activeStage = project.stages?.find((s: any) => s.id === activeId);
                const task = activeStage?.tasks?.find((t: any) => t.name === taskName);
                if (task) {
                    logger.debug(`resolveTask: "${taskName}" in aktiver Stage "${activeStage?.name}" gefunden.`);
                    return task;
                }
            }
        }

        // 3. Blueprint Stage
        if (context.includeBlueprint !== false) {
            const blueprint = project.stages?.find((s: any) => 
                s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint'
            );
            const task = blueprint?.tasks?.find((t: any) => t.name === taskName);
            if (task) {
                logger.debug(`resolveTask: "${taskName}" in Blueprint gefunden.`);
                return task;
            }
        }

        // 4. Legacy Root
        if (context.includeRoot !== false) {
            const task = project.tasks?.find((t: any) => t.name === taskName);
            if (task) {
                logger.debug(`resolveTask: "${taskName}" in Root-Tasks gefunden.`);
                return task;
            }
        }

        // 5. Fallback: Alle Stages durchsuchen (letzte Chance)
        if (project.stages) {
            for (const stage of project.stages) {
                const task = stage.tasks?.find((t: any) => t.name === taskName);
                if (task) {
                    logger.debug(`resolveTask: "${taskName}" in Stage "${stage.name}" (Fallback) gefunden.`);
                    return task;
                }
            }
        }

        logger.debug(`resolveTask: "${taskName}" nicht gefunden.`);
        return null;
    }

    /**
     * Löst eine Task-ID direkt auf.
     * 
     * @param taskId Die Task-ID
     * @returns Der Task oder null
     */
    public resolveTaskById(taskId: string): any | null {
        const project = coreStore.project;
        if (!project || !taskId) return null;

        // Suche in allen Stages + Root
        const allTasks = [
            ...(project.tasks || []),
            ...(project.stages?.flatMap((s: any) => s.tasks || []) || [])
        ];
        
        return allTasks.find((t: any) => t.id === taskId) || null;
    }

    // ========================================================================
    // Action Resolution
    // ========================================================================

    /**
     * Löst einen Action-Namen im gegebenen Kontext auf.
     * 
     * @param actionName Der zu suchende Action-Name
     * @param context Auflösungskontext
     * @returns Die Action oder null
     */
    public resolveAction(actionName: string, context: ResolutionContext = {}): any | null {
        const project = coreStore.project;
        if (!project || !actionName) return null;

        // 1. Explizite Stage
        if (context.stageId) {
            const stage = project.stages?.find((s: any) => s.id === context.stageId);
            const action = stage?.actions?.find((a: any) => a.name === actionName);
            if (action) return action;
        }

        // 2. Aktive Stage
        if (context.useActiveStage !== false) {
            const activeId = coreStore.activeStageId;
            if (activeId) {
                const activeStage = project.stages?.find((s: any) => s.id === activeId);
                const action = activeStage?.actions?.find((a: any) => a.name === actionName);
                if (action) return action;
            }
        }

        // 3. Blueprint
        if (context.includeBlueprint !== false) {
            const blueprint = project.stages?.find((s: any) => 
                s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint'
            );
            const action = blueprint?.actions?.find((a: any) => a.name === actionName);
            if (action) return action;
        }

        // 4. Legacy Root
        if (context.includeRoot !== false) {
            const action = project.actions?.find((a: any) => a.name === actionName);
            if (action) return action;
        }

        // 5. Fallback: Alle Stages
        if (project.stages) {
            for (const stage of project.stages) {
                const action = stage.actions?.find((a: any) => a.name === actionName);
                if (action) return action;
            }
        }

        return null;
    }

    /**
     * Löst eine Action-ID direkt auf.
     */
    public resolveActionById(actionId: string): any | null {
        const project = coreStore.project;
        if (!project || !actionId) return null;

        const allActions = [
            ...(project.actions || []),
            ...(project.stages?.flatMap((s: any) => s.actions || []) || [])
        ];
        
        return allActions.find((a: any) => a.id === actionId) || null;
    }

    // ========================================================================
    // Container / Meta-Information
    // ========================================================================

    /**
     * Ermittelt, in welcher Stage ein Task lebt.
     * 
     * @param taskNameOrId Task-Name oder Task-ID
     * @returns Stage-Info oder null
     */
    public getTaskContainer(taskNameOrId: string): { type: 'global' | 'stage' | 'none'; stageId?: string; stageName?: string } {
        const project = coreStore.project;
        if (!project) return { type: 'none' };

        // Zuerst als ID versuchen
        const byId = this.resolveTaskById(taskNameOrId);
        if (byId) {
            // Finde die Stage, die diesen Task enthält
            if (project.stages) {
                for (const stage of project.stages) {
                    if (stage.tasks?.some((t: any) => t.id === taskNameOrId)) {
                        return { type: 'stage', stageId: stage.id, stageName: stage.name };
                    }
                }
            }
            // Root-Task?
            if (project.tasks?.some((t: any) => t.id === taskNameOrId)) {
                return { type: 'global' };
            }
            return { type: 'none' };
        }

        // Als Name versuchen (mit aktiver Stage priorisiert)
        const byName = this.resolveTask(taskNameOrId, { useActiveStage: true });
        if (byName) {
            // Wieder die Stage finden
            if (project.stages) {
                for (const stage of project.stages) {
                    if (stage.tasks?.some((t: any) => t.name === taskNameOrId)) {
                        return { type: 'stage', stageId: stage.id, stageName: stage.name };
                    }
                }
            }
            if (project.tasks?.some((t: any) => t.name === taskNameOrId)) {
                return { type: 'global' };
            }
        }

        return { type: 'none' };
    }

    /**
     * Gibt alle Tasks im gegebenen Kontext zurück.
     */
    public getAllTasks(context: ResolutionContext = {}): any[] {
        const project = coreStore.project;
        if (!project) return [];

        const tasks: any[] = [];

        if (context.stageId) {
            const stage = project.stages?.find((s: any) => s.id === context.stageId);
            if (stage?.tasks) tasks.push(...stage.tasks);
        } else if (context.useActiveStage !== false) {
            const activeId = coreStore.activeStageId;
            const activeStage = project.stages?.find((s: any) => s.id === activeId);
            if (activeStage?.tasks) tasks.push(...activeStage.tasks);
        }

        if (context.includeBlueprint !== false) {
            const blueprint = project.stages?.find((s: any) => s.type === 'blueprint');
            if (blueprint?.tasks) tasks.push(...blueprint.tasks);
        }

        if (context.includeRoot !== false && project.tasks) {
            tasks.push(...project.tasks);
        }

        return tasks;
    }

    /**
     * Gibt alle Actions im gegebenen Kontext zurück.
     */
    public getAllActions(context: ResolutionContext = {}): any[] {
        const project = coreStore.project;
        if (!project) return [];

        const actions: any[] = [];

        if (context.stageId) {
            const stage = project.stages?.find((s: any) => s.id === context.stageId);
            if (stage?.actions) actions.push(...stage.actions);
        } else if (context.useActiveStage !== false) {
            const activeId = coreStore.activeStageId;
            const activeStage = project.stages?.find((s: any) => s.id === activeId);
            if (activeStage?.actions) actions.push(...activeStage.actions);
        }

        if (context.includeBlueprint !== false) {
            const blueprint = project.stages?.find((s: any) => s.type === 'blueprint');
            if (blueprint?.actions) actions.push(...blueprint.actions);
        }

        if (context.includeRoot !== false && project.actions) {
            actions.push(...project.actions);
        }

        return actions;
    }
}

// Exportiere Singleton-Instance
export const scopedResolver = ScopedResolver.getInstance();
