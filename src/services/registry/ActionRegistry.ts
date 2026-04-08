import { coreStore } from './CoreStore';
import { ScopedAction } from './RegistryTypes';
import { projectReferenceTracker } from './ReferenceTracker';
import { GameAction } from '../../model/types';
import { projectTaskRegistry } from './TaskRegistry';

class ActionRegistry {
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

    public findOriginalAction(nameOrId: string): GameAction | null {
        const project = coreStore.project;
        if (!project) return null;

        const isMatch = (a: any) =>
            a.name === nameOrId ||
            a.id === nameOrId ||
            a.actionName === nameOrId ||
            (a.data && (a.data.name === nameOrId || a.data.actionName === nameOrId)) ||
            (a.properties && (a.properties.name === nameOrId || a.properties.text === nameOrId));

        const globalAction = (project.actions || []).find(isMatch);
        if (globalAction) return globalAction;

        if (project.stages) {
            for (const stage of project.stages) {
                const stageAction = (stage.actions || []).find(isMatch);
                if (stageAction) return stageAction;
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

    public renameAction(oldName: string, newName: string): boolean {
        const project = coreStore.project;
        if (!project) return false;
        
        let action = project.actions.find((a: any) => a.name === oldName);
        if (!action && project.stages) {
            for (const stage of project.stages) {
                if (stage.actions) {
                    action = stage.actions.find((a: any) => a.name === oldName);
                    if (action) break;
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

    public deleteAction(name: string): boolean {
        const project = coreStore.project;
        if (!project) return false;
        
        project.actions = project.actions.filter(a => a.name !== name);
        if (project.stages) {
            project.stages.forEach(s => { if (s.actions) s.actions = s.actions.filter((a: any) => a.name !== name); });
        }
        return true;
    }
}

export const projectActionRegistry = new ActionRegistry();
