import { coreStore } from './CoreStore';
import { ComponentData } from '../../model/types';
import { ScopedObject } from './RegistryTypes';
import { projectReferenceTracker } from './ReferenceTracker';

class ObjectRegistry {

    public getObjects(scopeFilter?: 'stage-only' | 'all'): ComponentData[] {
        const project = coreStore.project;
        if (!project) return [];

        const globalServiceClasses = [
            'TStageController', 'TGameLoop', 'TGameState', 'TGameServer',
            'TInputController', 'THandshake', 'THeartbeat', 'TToast', 'TStatusBar',
            'TAPIServer', 'TDataStore'
        ];

        const isService = (obj: any) => (obj as any).isService === true || globalServiceClasses.includes(obj.className);

        const allObjects: ComponentData[] = [];
        const objectIds = new Set<string>();

        const activeStage = coreStore.activeStageId ? project.stages?.find((s: any) => s.id === coreStore.activeStageId) : null;
        const isBlueprint = activeStage?.type === 'blueprint' || activeStage?.id === 'stage_blueprint' || activeStage?.id === 'blueprint';

        const flattenObjects = (arr: any[]): any[] => {
            let res: any[] = [];
            for (const o of arr) {
                res.push(o);
                if (o.children && Array.isArray(o.children)) res.push(...flattenObjects(o.children));
            }
            return res;
        };

        if (project.stages && project.stages.length > 0) {
            if (activeStage) {
                const stageItems = [
                    ...flattenObjects(activeStage.objects || []),
                    ...(activeStage.variables || []) as unknown as ComponentData[]
                ];
                stageItems.forEach((obj: any) => {
                    if (!objectIds.has(obj.id)) {
                        allObjects.push(obj);
                        objectIds.add(obj.id);
                    }
                });
            }

            const actualBlueprintId = project.stages.find((s: any) => s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint')?.id;

            project.stages.forEach((stage: any) => {
                if (stage.id === coreStore.activeStageId) return;

                const isStageBlueprint = stage.id === actualBlueprintId;
                
                let stageItemsToInclude: any[];

                if (scopeFilter === 'all') {
                    stageItemsToInclude = [
                        ...flattenObjects(stage.objects || []).map((o: any) => ({ ...o, uiScope: isStageBlueprint ? 'global' : `stage: ${stage.name || stage.id}` })),
                        ...(stage.variables || []).map((v: any) => ({ ...v, uiScope: isStageBlueprint ? 'global' : `stage: ${stage.name || stage.id}` })) as unknown as ComponentData[]
                    ];
                } else {
                    stageItemsToInclude = [
                        ...flattenObjects(stage.objects || []).filter((obj: any) => (obj as any).scope === 'global' || isService(obj) || isStageBlueprint),
                        ...(stage.variables || []).filter((v: any) => (v as any).scope === 'global' || isStageBlueprint) as unknown as ComponentData[]
                    ];
                }

                stageItemsToInclude.forEach((obj: any) => {
                    if (!objectIds.has(obj.id)) {
                        // isInherited nur setzen, wenn wir nicht den Gesamtüberblick anfordern
                        const inheritedObj = scopeFilter === 'all' ? obj : { ...obj, isInherited: true };
                        allObjects.push(inheritedObj);
                        objectIds.add(obj.id);
                    }
                });
            });

            if (scopeFilter === 'stage-only') {
                const actStage = project.stages.find((s: any) => s.id === coreStore.activeStageId);
                const stageResult = [
                    ...flattenObjects(actStage?.objects || []),
                    ...(actStage?.variables || []) as unknown as ComponentData[]
                ];
                const uniqueByName = new Map<string, any>();
                stageResult.forEach(o => {
                    if (o.name && !uniqueByName.has(o.name)) uniqueByName.set(o.name, o);
                });
                return Object.freeze(Array.from(uniqueByName.values()).sort((a, b) => a.name.localeCompare(b.name))) as ComponentData[];
            }
        }

        if (isBlueprint) {
            const rootGlobals = [
                ...flattenObjects(project.objects || []).filter((obj: any) => obj.scope === 'global'),
                ...(project.variables || []).filter(v => (v as any).scope === 'global') as unknown as ComponentData[]
            ];
            rootGlobals.forEach(gObj => {
                if (!objectIds.has(gObj.id)) {
                    allObjects.push(gObj);
                    objectIds.add(gObj.id);
                }
            });
        }

        if (allObjects.length === 0 && (!project.stages || project.stages.length === 0)) {
            const legacyItems = [
                ...flattenObjects(project.objects || []),
                ...(project.variables || []) as unknown as ComponentData[]
            ];
            const uniqueLegacy = new Map<string, any>();
            legacyItems.forEach(o => {
                if (o.name && !uniqueLegacy.has(o.name)) uniqueLegacy.set(o.name, o);
            });
            return Object.freeze(Array.from(uniqueLegacy.values()).sort((a, b) => a.name.localeCompare(b.name))) as ComponentData[];
        }

        const uniqueAll = new Map<string, any>();
        allObjects.forEach(o => {
            if (o.name && !uniqueAll.has(o.name)) uniqueAll.set(o.name, o);
        });
        return Object.freeze(Array.from(uniqueAll.values()).sort((a, b) => a.name.localeCompare(b.name))) as ComponentData[];
    }

    public getFlowObjects(): any[] {
        return coreStore.project?.flow?.elements || [];
    }

    public getObjectsWithMetadata(resolveUsage: boolean = true): ScopedObject[] {
        const objects = this.getObjects();
        return objects.map((obj: any) => {
            const usage = resolveUsage ? projectReferenceTracker.getObjectUsage(obj.name) : [];
            const isGlobal = coreStore.project?.objects.some(o => o.name === obj.name);
            const scopedObj = { ...obj } as ScopedObject;
            scopedObj.uiScope = isGlobal ? ('global' as const) : ('stage' as const);
            scopedObj.usageCount = usage.length;
            return scopedObj;
        });
    }

    public validateObjectName(name: string): { valid: boolean; error?: string } {
        if (!/^[A-Z][a-zA-Z0-9_]*$/.test(name)) {
            return { valid: false, error: 'Objekt-Namen müssen mit einem Großbuchstaben beginnen.' };
        }

        const objects = this.getObjects();
        if (objects.some(o => o.name === name)) {
            return { valid: false, error: 'Objekt-Name existiert bereits auf der Stage.' };
        }

        const project = coreStore.project;
        if (!project) return { valid: true };

        const checkFlows = (charts: any) => {
            if (!charts) return false;
            return Object.values(charts).some((chart: any) =>
                chart.elements && chart.elements.some((e: any) => e.name === name)
            );
        };

        if (checkFlows(project.flowCharts)) {
            return { valid: false, error: 'Objekt-Name wird bereits im Flow verwendet.' };
        }

        if (project.stages) {
            for (const stage of project.stages) {
                if (checkFlows(stage.flowCharts)) {
                    return { valid: false, error: `Objekt-Name wird bereits im Flow der Stage '${stage.name}' verwendet.` };
                }
            }
        }

        return { valid: true };
    }
}

export const projectObjectRegistry = new ObjectRegistry();
