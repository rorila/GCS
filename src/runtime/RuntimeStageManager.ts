import { hydrateObjects } from '../utils/Serialization';

export interface MergedStageData {
    objects: any[];
    tasks: any[];
    actions: any[];
    flowCharts: any;
}

export class RuntimeStageManager {
    constructor(private project: any) { }

    public resolveInheritanceChain(stageId: string, visited: Set<string> = new Set()): any[] {
        if (visited.has(stageId)) {
            console.error(`[RuntimeStageManager] Circular inheritance detected for stage: ${stageId}`);
            return [];
        }
        visited.add(stageId);

        const stage = this.project.stages?.find((s: any) => s.id === stageId);
        if (!stage) return [];

        const chain = [stage];
        if (stage.inheritsFrom) {
            chain.unshift(...this.resolveInheritanceChain(stage.inheritsFrom, visited));
        }
        return chain;
    }

    public getMergedStageData(stageId: string): MergedStageData {
        const stageChain = this.resolveInheritanceChain(stageId);

        let mergedObjects: any[] = [];
        // Initialize with global project tasks/actions if available
        let mergedTasks: any[] = [...(this.project.tasks || [])];
        let mergedActions: any[] = [...(this.project.actions || [])];
        let mergedFlowCharts: any = { ...(this.project.flowCharts || {}) };

        // 1. Process Blueprint Stages first (Global Baseline)
        const objectIdSet = new Set<string>();
        const blueprintStages = this.project.stages?.filter((s: any) => s.type === 'blueprint') || [];
        const processStage = (stage: any) => {
            // Objects
            const stageObjects = hydrateObjects(stage.objects || []);
            stageObjects.forEach(obj => {
                // ID-based collision: Child replaces Parent
                mergedObjects = mergedObjects.filter(o => o.id !== obj.id);
                mergedObjects.push(obj);
                objectIdSet.add(obj.id);
            });

            // Tasks
            if (stage.tasks) {
                stage.tasks.forEach((t: any) => {
                    mergedTasks = mergedTasks.filter((existing: any) => existing.name !== t.name);
                    mergedTasks.push(t);
                });
            }

            // Actions
            if (stage.actions) {
                stage.actions.forEach((a: any) => {
                    mergedActions = mergedActions.filter((existing: any) => existing.name !== a.name);
                    mergedActions.push(a);
                });
            }

            // FlowCharts
            if (stage.flowCharts) {
                Object.assign(mergedFlowCharts, stage.flowCharts);
            }

            // Variables (Local to Stage) - Hydrate as objects for UI/Render
            if (stage.variables) {
                const hydratedVars = hydrateObjects(stage.variables);
                hydratedVars.forEach(vObj => {
                    mergedObjects = mergedObjects.filter(o => o.id !== vObj.id);
                    mergedObjects.push(vObj);
                    objectIdSet.add(vObj.id);
                });
            }
        };

        // First merge all blueprints
        // IMPORTANT: Mark blueprint objects as inherited if the target stage is NOT a blueprint!
        // This prevents them from being duplicated visually on normal stages while keeping them available in runtime.
        const targetIsBlueprint = this.project.stages?.find((s: any) => s.id === stageId)?.type === 'blueprint';

        blueprintStages.forEach((bs: any) => {

            // We reuse processStage but inject the isInherited flag manually into mergedObjects afterwards
            // OR we modify processStage to accept an override flag. 
            // EASIER: Iterate mergedObjects AFTER processing blueprint and mark new ones.
            const preCount = mergedObjects.length;
            processStage(bs);
            const postCount = mergedObjects.length;

            if (!targetIsBlueprint) {
                // Mark newly added objects from blueprint as inherited
                for (let i = preCount; i < postCount; i++) {
                    if (mergedObjects[i]) {
                        mergedObjects[i].isInherited = true;
                        // Mark as coming from blueprint for Editor visibility filtering
                        (mergedObjects[i] as any).isFromBlueprint = true;
                    }
                }
            }
        });

        // Then merge the actual stage chain (overriding blueprints if necessary)
        stageChain.forEach(s => {
            if (s.type !== 'blueprint') processStage(s);
        });

        // 3. Special Inheritance: Global Objects from 'Main' (baseline for all sub-stages)
        const activeStage = stageChain[stageChain.length - 1];
        if (activeStage && activeStage.type !== 'splash' && activeStage.type !== 'main') {
            const mainStage = this.project.stages?.find((s: any) => s.type === 'main');
            if (mainStage && mainStage.objects) {
                const globalObjects = hydrateObjects(mainStage.objects);

                // Also hydrate main stage variables as global objects if they are public
                const globalVariables = hydrateObjects(mainStage.variables || []);

                [...globalObjects, ...globalVariables].forEach(gObj => {
                    const isGlobal = gObj.scope === 'global' || (gObj as any).isVariable;
                    // System objects are always considered global for stage baseline
                    const systemClasses = [
                        'TGameLoop', 'TStageController', 'TGameState',
                        'THandshake', 'THeartbeat', 'TGameServer',
                        'TInputController', 'TDebugLog'
                    ];
                    const isSystem = systemClasses.includes(gObj.className);

                    if ((isGlobal || isSystem) && !objectIdSet.has(gObj.id)) {
                        const nameCollision = mergedObjects.find(l => l.name === gObj.name);
                        if (!nameCollision) {
                            mergedObjects.push(gObj);
                        }
                    }
                });
            }
        }

        return {
            objects: mergedObjects,
            tasks: mergedTasks,
            actions: mergedActions,
            flowCharts: mergedFlowCharts
        };
    }
}
