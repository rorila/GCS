/** Verhindert Selbstzuordnung, fehlende Eltern und Zyklen. */
export function canParentFeature(features:{id:string;parentId?:string}[],id:string,parentId:string):boolean {
 if(!parentId)return true;const visited=new Set<string>();let current=parentId;
 while(current){if(current===id||visited.has(current))return false;visited.add(current);const parent=features.find(f=>f.id===current);if(!parent)return false;current=parent.parentId||'';}
 return true;
}

// ── Feature-Flow-Kontext ('feature:<id>') ────────────────────────────
export const FEATURE_CTX = 'feature:';
export const isFeatureContext = (ctx: string | null | undefined): boolean => !!ctx && ctx.startsWith(FEATURE_CTX);
export const featureContextId = (featureId: string): string => FEATURE_CTX + featureId;
export const parseFeatureContext = (ctx: string | null | undefined): string | null =>
    isFeatureContext(ctx) ? ctx!.slice(FEATURE_CTX.length) : null;

/** Findet ein Feature projektweit (IDs sind pro Stage, Kontext global). */
export function findFeatureById(project: any, featureId: string | null | undefined): { stage: any; feature: any } | null {
    if (!project?.stages || !featureId) return null;
    for (const stage of project.stages) {
        const feature = stage.features?.find((f: any) => f.id === featureId);
        if (feature) return { stage, feature };
    }
    return null;
}

/**
 * Leitet die initiale actionSequence eines Features aus seinen
 * User Stories ab: plannedTask → Task-Schritt (mit userStoryId-Verweis),
 * Story ohne geplanten Task → offener Schritt (type 'story').
 */
export function seedFeatureSequence(project: any, feature: any): any[] {
    const stories = project?.userStories?.userStories || [];
    const seq: any[] = [];
    for (const usId of feature.userStoryIds || []) {
        const us = stories.find((u: any) => u.id === usId);
        if (!us) continue;
        if (us.plannedTask) {
            seq.push({ type: 'task', name: us.plannedTask, userStoryId: usId });
        } else {
            seq.push({ type: 'story', name: us.title || usId, userStoryId: usId });
        }
    }
    return seq;
}

/** Alle Tasks eines Features aus seiner actionSequence (rekursiv über Zweige). */
export function featureTaskNames(feature: any): string[] {
    const names: string[] = [];
    const collect = (seq: any[]) => seq?.forEach(it => {
        if (it.type === 'task' && it.name) names.push(it.name);
        if (it.body) collect(it.body);
        if (it.elseBody) collect(it.elseBody);
        if (it.then) collect(it.then);
        if (it.else) collect(it.else);
    });
    collect(feature?.actionSequence || []);
    return names;
}
