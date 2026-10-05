/**
 * FeatureFlowAnalysis — leitet die READ-ONLY Feature-Übersicht ab.
 *
 * Spiegelt die Gliederung der User-Stories-Ansicht im Flow-Canvas:
 *   Bereich (Feature mit Kindern) → Feature-Container → Story-Zeilen.
 * Pro Story eine Zeile: ⚡ Auslöser links → geplanter Task → evtl.
 * transitiv aufgerufene Tasks als Kette nach rechts.
 *
 * Datenquellen (alles deklarativ vorhanden):
 *  - feature.parentId / userStoryIds       → Container-Hierarchie
 *  - us.trigger (event | taskCall)          → Auslöser / deklarierte Aufrufe
 *  - us.plannedTask + task.actionSequence   → implementierte Aufrufe
 *  - feature.actionSequence                 → bindende Reihenfolge (#-Badge)
 *
 * Keine Schreiboperationen — reine Analyse.
 */

export type FeatureNodeKind = 'event' | 'task' | 'implicit' | 'story-open';

export interface FeatureFlowNode {
    id: string;
    kind: FeatureNodeKind;
    label: string;
    taskName?: string;
    storyId?: string;
    storyTitle?: string;
    triggerText?: string;
    /** Position in der bindenden feature.actionSequence (nur Story-Tasks). */
    seqNo?: number;
    /** ID des Features, in dessen Container der Node liegt. */
    containerId: string;
    /** Zeile innerhalb des Containers (Anzeigereihenfolge). */
    rowIndex: number;
    /** Spalte in der Zeile: 0 = Auslöser, 1 = Task, 2+ = Aufrufebenen. */
    xIndex: number;
    /** Vertikaler Slot innerhalb der Zeilengruppe (Geschwister-Aufrufe stapeln). */
    subRow: number;
}

export type FeatureEdgeKind = 'event' | 'call' | 'declared';

export interface FeatureFlowEdge {
    from: string;
    to: string;
    kind: FeatureEdgeKind;
}

/** Ein Feature als Container in der Übersicht. */
export interface FeatureFlowContainer {
    featureId: string;
    title: string;
    /** 'bereich' = hat Unterfeatures, 'feature' = Blatt. */
    kind: 'bereich' | 'feature';
    depth: number;
    children: FeatureFlowContainer[];
}

export interface FeatureFlowGraph {
    nodes: FeatureFlowNode[];
    edges: FeatureFlowEdge[];
    /** Wurzel-Container (das gewählte Feature selbst). */
    container: FeatureFlowContainer | null;
}

/** Wie viele Aufrufebenen pro Zeile nach rechts aufgelöst werden. */
export const FEATURE_CALL_DEPTH = 2;

/** Alle per execute_task/task aufgerufenen Task-Namen einer Sequenz (rekursiv über Zweige). */
function collectCalledTasks(seq: any[] | undefined, out: string[]): void {
    seq?.forEach(item => {
        if ((item.type === 'task' || item.type === 'execute_task') && item.name) out.push(item.name);
        collectCalledTasks(item.body, out);
        collectCalledTasks(item.elseBody, out);
        collectCalledTasks(item.then, out);
        collectCalledTasks(item.else, out);
    });
}

function resolveTask(project: any, name: string): any | null {
    for (const stage of project?.stages || []) {
        const found = stage.tasks?.find((t: any) => t.name === name);
        if (found) return found;
    }
    return (project?.tasks || []).find((t: any) => t.name === name) || null;
}

export function analyzeFeatureFlow(project: any, rootFeature: any, stageFeatures: any[] = []): FeatureFlowGraph {
    const stories: any[] = project?.userStories?.userStories || [];
    const nodes = new Map<string, FeatureFlowNode>();
    const edges: FeatureFlowEdge[] = [];

    const addNode = (node: FeatureFlowNode): FeatureFlowNode => {
        const existing = nodes.get(node.id);
        if (existing) return existing;
        nodes.set(node.id, node);
        return node;
    };

    const addEdge = (from: string, to: string, kind: FeatureEdgeKind): void => {
        if (from === to) return;
        const existing = edges.find(e => e.from === from && e.to === to);
        if (existing) {
            if (existing.kind === 'declared' && kind === 'call') existing.kind = 'call';
            return;
        }
        edges.push({ from, to, kind });
    };

    // ── Container-Baum: Wurzel + alle Unterfeatures (rekursiv) ────────
    const childrenOf = (fid: string) => stageFeatures.filter((f: any) => f.parentId === fid);
    const buildContainer = (f: any, depth: number): FeatureFlowContainer => {
        const children = childrenOf(f.id).map((c: any) => buildContainer(c, depth + 1));
        return {
            featureId: f.id,
            title: f.name || f.id,
            kind: children.length > 0 ? 'bereich' : 'feature',
            depth,
            children
        };
    };
    const container = rootFeature ? buildContainer(rootFeature, 0) : null;

    // ── 1. Story-Zeilen pro Feature-Container ─────────────────────────
    let rowCounter = 0;
    const processFeature = (feature: any) => {
        // Bindende Reihenfolge aus feature.actionSequence, Fallback Liste.
        const orderIndex = new Map<string, number>();
        (feature.actionSequence || []).forEach((it: any) => {
            if (it.type === 'task' && it.name && !orderIndex.has(it.name)) {
                orderIndex.set(it.name, orderIndex.size + 1);
            }
        });
        let fallback = orderIndex.size + 1;

        // Zugehörige Stories: primär us.featureId (so gruppiert auch die
        // Story-Liste), feature.userStoryIds als Fallback/Altdaten.
        const linkedIds = new Set<string>(feature.userStoryIds || []);
        const featureStories = stories.filter((us: any) =>
            us.featureId === feature.id || linkedIds.has(us.id));

        // Reihenfolge der Stories: Sequenz zuerst, dann Listenreihenfolge.
        const orderedStories = featureStories.sort((a: any, b: any) => {
            const pa = orderIndex.get(a.plannedTask) ?? Infinity;
            const pb = orderIndex.get(b.plannedTask) ?? Infinity;
            if (pa !== pb) return pa - pb;
            return stories.indexOf(a) - stories.indexOf(b);
        });

        for (const us of orderedStories) {
            const rowIndex = rowCounter++;
            const fid = feature.id;
            if (!us.plannedTask) {
                addNode({
                    id: `open:${us.id}`, kind: 'story-open',
                    label: `▫ ${us.title || us.id} (offen)`,
                    storyId: us.id, storyTitle: us.title,
                    containerId: fid, rowIndex, xIndex: 1, subRow: 0
                });
                continue;
            }

            const pos = orderIndex.get(us.plannedTask) ?? fallback++;
            const taskNodeId = `task:${us.plannedTask}`;
            const trig = us.trigger;
            // Neu: trigger.kind==='event'; Legacy-Spiegel: plannedEvent/plannedComponent
            const evName = trig?.kind === 'event' ? trig.event : us.plannedEvent;
            const evCompName = trig?.kind === 'event'
                ? (trig.component?.name || trig.component?.componentName)
                : (us.plannedComponent?.name || us.plannedComponent?.componentName);
            const hasEvent = !!evName;

            if (hasEvent) {
                const comp = evCompName ? ` @${evCompName}` : '';
                const evId = `event:${us.plannedTask}:${evName}`;
                addNode({
                    id: evId, kind: 'event', label: `⚡ ${evName}${comp}`,
                    containerId: fid, rowIndex, xIndex: 0, subRow: 0,
                    triggerText: `${evName}${comp}`
                });
                addEdge(evId, taskNodeId, 'event');
            }

            addNode({
                id: taskNodeId, kind: 'task', label: us.plannedTask, seqNo: pos,
                taskName: us.plannedTask, storyId: us.id, storyTitle: us.title,
                containerId: fid, rowIndex, xIndex: 1, subRow: 0
            });

            if (trig?.kind === 'taskCall' && trig.callerTask) {
                const callerId = `task:${trig.callerTask}`;
                if (!nodes.has(callerId)) {
                    // Caller ohne eigene Story → implizite Hilfszeile in diesem Container
                    addNode({
                        id: callerId, kind: 'implicit', label: trig.callerTask,
                        taskName: trig.callerTask, containerId: fid,
                        rowIndex: rowCounter++, xIndex: 1, subRow: 0
                    });
                }
                addEdge(callerId, taskNodeId, 'declared');
            }
        }
    };

    const walkFeatures = (f: any) => {
        processFeature(f);
        childrenOf(f.id).forEach(walkFeatures);
    };
    if (rootFeature) walkFeatures(rootFeature);

    // ── 2. Transitive Task-Aufrufe — Geschwister stapeln vertikal ─────
    // Direkt aufgerufene Tasks landen in der Spalte rechts neben dem
    // Aufrufer (xIndex+1) und belegen eigene subRows → vertikaler Stapel
    // statt waagerechter Endloskette. Echte Ketten (je 1 Aufruf) bleiben
    // horizontal in derselben subRow.
    const expanded = new Set<string>();
    const colSlot = new Map<string, number>(); // containerId:rowIndex:xIndex → belegte subRows
    const nextSubRow = (cid: string, r: number, x: number, base: number): number => {
        const key = `${cid}:${r}:${x}`;
        const cur = colSlot.get(key) ?? base - 1;
        const next = cur + 1;
        colSlot.set(key, next);
        return next;
    };
    const queue = [...nodes.values()]
        .filter(n => n.kind === 'task' || n.kind === 'implicit')
        .map(n => ({ name: n.taskName!, depth: 0 }));

    while (queue.length) {
        const { name, depth } = queue.shift()!;
        if (expanded.has(name) || depth > FEATURE_CALL_DEPTH) continue;
        expanded.add(name);

        const caller = nodes.get(`task:${name}`);
        const task = resolveTask(project, name);
        if (!caller || !task?.actionSequence) continue;

        const calls: string[] = [];
        collectCalledTasks(task.actionSequence, calls);
        for (const callee of calls) {
            const calleeId = `task:${callee}`;
            if (!nodes.has(calleeId)) {
                addNode({
                    id: calleeId, kind: 'implicit', label: callee,
                    taskName: callee, containerId: caller.containerId,
                    rowIndex: caller.rowIndex,
                    xIndex: caller.xIndex + 1,
                    subRow: nextSubRow(caller.containerId, caller.rowIndex, caller.xIndex + 1, caller.subRow)
                });
                queue.push({ name: callee, depth: depth + 1 });
            }
            addEdge(`task:${name}`, calleeId, 'call');
        }
    }

    return { nodes: [...nodes.values()], edges, container };
}
