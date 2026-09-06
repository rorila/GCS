import { coreStore } from './CoreStore';
import { ScopedAction } from './RegistryTypes';
import { projectReferenceTracker } from './ReferenceTracker';
import { GameAction } from '../../model/types';
import { projectTaskRegistry } from './TaskRegistry';
import { Logger } from '../../utils/Logger';

class ActionRegistry {
    private static logger = Logger.get('ActionRegistry', 'Action_Management');

    public getActions(stageId: string | 'all' | 'active' = 'active', resolveUsage: boolean = true): ScopedAction[] {
        const project = coreStore.project;
        if (!project) return [];

        const rootActions = (project.actions || []).map(a => ({ ...a, uiScope: 'global' as const }));
        const blueprintStage = project.stages?.find(s => s.type === 'blueprint');
        const bpActions = (blueprintStage?.actions || []).map(a => ({ ...a, uiScope: 'global' as const }));

        let globalActions: ScopedAction[] = [...rootActions];
        bpActions.forEach(ba => {
            const idx = globalActions.findIndex(a => a.name === ba.name);
            if (idx === -1) globalActions.push(ba);
            else globalActions[idx] = ba;
        });

        if (stageId === 'all') {
            let allActions = [...globalActions];
            if (project.stages) {
                project.stages.forEach(stage => {
                    if (stage.type === 'blueprint') return;
                    if (stage.actions) {
                        allActions = [...allActions, ...stage.actions.map(a => ({ ...a, uiScope: 'stage' as const }))];
                    }
                });
            }
            return allActions.map(a => ({ ...a, usageCount: resolveUsage ? projectReferenceTracker.getActionUsage(a.name).length : 0 }));
        }

        const targetStageId = stageId === 'active' ? coreStore.activeStageId : stageId;
        if (targetStageId && project.stages) {
            const stage = project.stages.find(s => s.id === targetStageId);
            if (stage && stage.type !== 'blueprint' && stage.actions) {
                const stageActions: ScopedAction[] = stage.actions.map(a => ({ ...a, uiScope: 'stage' as const }));
                return [...globalActions, ...stageActions].map(a => ({ ...a, usageCount: resolveUsage ? projectReferenceTracker.getActionUsage(a.name).length : 0 }));
            }
        }

        return globalActions.map(a => ({
            ...a,
            uiScope: 'global',
            usageCount: resolveUsage ? projectReferenceTracker.getActionUsage(a.name).length : 0
        }));
    }

    /**
     * Sucht die Original-Definition einer Action.
     *
     * Action-Namen sind projektweit NICHT eindeutig: Beim Duplizieren einer Stage
     * entstehen gleichnamige Actions (sogar mit identischer id). Eindeutig ist nur
     * die Kombination Stage + Name. Deshalb wird in dieser Reihenfolge gesucht:
     * angeforderte Stage → aktive Stage → Root → Blueprint → uebrige Stages.
     *
     * @param stageId Stage, zu der die Referenz gehoert (Default: aktive Stage)
     */
    public findOriginalAction(nameOrId: string, stageId?: string): GameAction | null {
        const project = coreStore.project;
        if (!project) return null;

        const isMatch = (a: any) =>
            a.name === nameOrId ||
            a.id === nameOrId ||
            a.actionName === nameOrId ||
            (a.data && (a.data.name === nameOrId || a.data.actionName === nameOrId)) ||
            (a.properties && (a.properties.name === nameOrId || a.properties.text === nameOrId));

        const findInStage = (id?: string | null) => {
            if (!id) return null;
            const stage = project.stages?.find(s => s.id === id);
            return (stage?.actions || []).find(isMatch) || null;
        };

        // 1. Explizit angeforderte Stage
        const requested = findInStage(stageId);
        if (requested) return requested;

        // 2. Aktive Stage — ein Action-Knoten meint die Action seiner eigenen Stage
        if (!stageId || stageId !== coreStore.activeStageId) {
            const active = findInStage(coreStore.activeStageId);
            if (active) return active;
        }

        // 3. Projektweite Actions
        const globalAction = (project.actions || []).find(isMatch);
        if (globalAction) return globalAction;

        // 4. Blueprint (gilt fuer alle Stages)
        const blueprint = project.stages?.find(s => s.type === 'blueprint');
        const blueprintAction = (blueprint?.actions || []).find(isMatch);
        if (blueprintAction) return blueprintAction;

        // 5. Fallback: uebrige Stages. Ein Treffer hier bedeutet, dass die Referenz
        //    aus einer fremden Stage bedient wird — das ist meldenswert.
        if (project.stages) {
            for (const stage of project.stages) {
                if (stage.id === stageId || stage.id === coreStore.activeStageId) continue;
                const stageAction = (stage.actions || []).find(isMatch);
                if (stageAction) {
                    ActionRegistry.logger.warn(
                        `Action "${nameOrId}" wurde nicht in der eigenen Stage gefunden — ` +
                        `es wird die Definition aus "${stage.name || stage.id}" verwendet.`
                    );
                    return stageAction;
                }
            }
        }

        return null;
    }

    public getNextSmartActionName(action: any): string {
        const target = (action.target || 'global').replace(/[^a-zA-Z0-9]/g, '');
        let propPart = 'action';
        if (action.changes) {
            const keys = Object.keys(action.changes);
            if (keys.length > 0) {
                const firstKey = keys[0];
                const val = action.changes[firstKey];
                let valStr = String(val).replace(/[^a-zA-Z0-9]/g, '');
                if (valStr.length > 8) valStr = valStr.substring(0, 8);
                propPart = `${firstKey}_${valStr}`;
            }
        }
        const baseName = `${target}_${propPart}`;
        let finalName = baseName, counter = 1;
        const allActionNames = new Set(this.getActions('all', false).map(a => a.name));
        while (allActionNames.has(finalName)) { finalName = `${baseName}_${counter++}`; }
        return finalName;
    }

    public renameAction(oldName: string, newName: string, stageId?: string): boolean {
        const project = coreStore.project;
        if (!project) return false;
        
        // Phase 4: Wenn stageId angegeben, explizit in dieser Stage suchen
        let action: any;
        if (stageId) {
            const stage = project.stages?.find((s: any) => s.id === stageId);
            action = stage?.actions?.find((a: any) => a.name === oldName);
        }
        // Fallback: Standardsuche (erste Stage mit passendem Namen)
        if (!action) {
            action = project.actions.find((a: any) => a.name === oldName);
            if (!action && project.stages) {
                for (const stage of project.stages) {
                    if (stage.actions) {
                        action = stage.actions.find((a: any) => a.name === oldName);
                        if (action) break;
                    }
                }
            }
        }
        if (action) { action.name = newName; } else { return false; }

        projectTaskRegistry.getTasks('all', false).forEach((t: any) => {
            if (t.actionSequence) {
                t.actionSequence.forEach((item: any) => {
                    if (item.type === 'action' && item.name === oldName) item.name = newName;
                    if (item.thenAction === oldName) item.thenAction = newName;
                    if (item.elseAction === oldName) item.elseAction = newName;
                });
            }
        });
        return true;
    }

    public deleteAction(name: string, stageId?: string): boolean {
        const project = coreStore.project;
        if (!project) return false;
        
        // Phase 4: Wenn stageId angegeben, nur in dieser Stage löschen
        if (stageId) {
            const stage = project.stages?.find((s: any) => s.id === stageId);
            if (stage?.actions) {
                stage.actions = stage.actions.filter((a: any) => a.name !== name);
            }
            // Auch aus Root-Actions entfernen falls vorhanden
            project.actions = project.actions.filter(a => a.name !== name);
            return true;
        }
        
        // Fallback: Überall löschen (altes Verhalten)
        project.actions = project.actions.filter(a => a.name !== name);
        if (project.stages) {
            project.stages.forEach(s => { if (s.actions) s.actions = s.actions.filter((a: any) => a.name !== name); });
        }
        return true;
    }
}

export const projectActionRegistry = new ActionRegistry();
