import { GameProject, StageDefinition, GameTask, BaseAction } from './types';

export interface LifecyclePhase {
    stageId: string;
    stageName: string;
    isBlueprint: boolean;
    features: { id: string; name: string }[];
    tasks: { name: string; label: string; triggers: string[] }[];
    transitions: { targetStageId: string; targetStageName: string; triggeredByTask?: string }[];
    /** Task→Task-Aufrufe innerhalb des Projekts (Quelle liegt in dieser Phase) */
    calls: { from: string; to: string }[];
}

export interface GameLifecycleModel {
    phases: LifecyclePhase[];
    mermaidCode: string;
    taskNames: string[];
    featureIds: string[];
    /** Mermaid-Knoten-ID → Link-Ziel (für robuste Klick-Zuordnung im SVG) */
    nodeLinks: Record<string, { kind: 'task' | 'feature'; ref: string }>;
    totalPhases: number;
    totalTasks: number;
    totalTransitions: number;
}

/** Max. Anzahl Einstiegs-Tasks pro Zeile (Raster-Umbruch statt endloser Breite) */
const GRID_COLUMNS = 4;

const esc = (s: unknown): string =>
    String(s ?? '').replace(/[\r\n]+/g, ' ').replace(/["#;[\]{}()<>]/g, '').trim() || '?';

const safeId = (prefix: string, raw: string): string =>
    `${prefix}_${String(raw).replace(/[^A-Za-z0-9_]/g, '_')}`;

function findStageById(project: GameProject, id: string): StageDefinition | null {
    return (project.stages || []).find(s => s.id === id) || null;
}

function resolveAction(project: GameProject, stage: StageDefinition, name: string): BaseAction | null {
    const fromStage = stage.actions?.find(a => a.name === name);
    if (fromStage) return fromStage;
    const globalStage = (project.stages || []).find(s => s.type === 'blueprint' || s.id === 'stage_blueprint');
    const fromBp = globalStage?.actions?.find(a => a.name === name);
    if (fromBp) return fromBp;
    return (project.actions || []).find(a => a.name === name) || null;
}

function getTaskActionNames(task: GameTask): string[] {
    const result: string[] = [];
    const walk = (seq: any[] | undefined) => {
        for (const item of seq || []) {
            if (item.name) result.push(item.name);
            if (item.body) walk(item.body);
            if (item.then) walk(item.then);
            if (item.else) walk(item.else);
        }
    };
    walk(task.actionSequence);
    return result;
}

/** Ermittelt, welche anderen Tasks ein Task in seiner actionSequence referenziert (inkl. verschachtelter Zweige). */
function findCalledTasks(task: GameTask, allTaskNames: Set<string>): string[] {
    const json = JSON.stringify(task.actionSequence || []);
    const result: string[] = [];
    for (const other of allTaskNames) {
        if (other === task.name) continue;
        if (json.includes(JSON.stringify(other))) result.push(other);
    }
    return result;
}

export function analyzeGameLifecycle(project: GameProject): GameLifecycleModel {
    if (!project || !project.stages || project.stages.length === 0) {
        return {
            phases: [],
            mermaidCode: 'flowchart TD\n    empty["Keine Stages im Projekt definiert"]',
            taskNames: [],
            featureIds: [],
            nodeLinks: {},
            totalPhases: 0,
            totalTasks: 0,
            totalTransitions: 0
        };
    }

    const phases: LifecyclePhase[] = [];
    const allTaskNames = new Set<string>();
    const allFeatureIds = new Set<string>();
    let totalTransitions = 0;

    for (const stage of project.stages) {
        for (const t of stage.tasks || []) allTaskNames.add(t.name);
    }

    // Stories und Trigger sammeln
    const stories = project.userStories?.userStories || [];
    const taskTriggerMap = new Map<string, string[]>();
    const addTrigger = (taskName: string, label: string) => {
        const triggers = taskTriggerMap.get(taskName) || [];
        if (!triggers.includes(label)) triggers.push(label);
        taskTriggerMap.set(taskName, triggers);
    };
    for (const story of stories) {
        if (!story.plannedTask) continue;
        const trig = story.trigger;
        const label = (trig && trig.kind === 'event') ? trig.event : (story.plannedEvent || story.title || 'Event');
        addTrigger(story.plannedTask, label);
    }

    // Komponenten-Events aller Stages analysieren (vor der Phasenbildung, damit globale Trigger greifen)
    for (const stage of project.stages) {
        for (const obj of stage.objects || []) {
            const rawEvents = (obj as any).events || {};
            for (const [ev, targetTask] of Object.entries(rawEvents)) {
                if (typeof targetTask === 'string' && targetTask.trim()) {
                    addTrigger(targetTask.trim(), `${obj.name}.${ev}`);
                }
            }
            if (typeof (obj as any).onClick === 'string' && (obj as any).onClick.trim()) {
                addTrigger((obj as any).onClick.trim(), `${obj.name}.click`);
            }
        }
    }

    // Blueprint zuerst
    const sortedStages = [...project.stages].sort((a, b) => {
        const aBp = a.type === 'blueprint' || a.id === 'stage_blueprint';
        const bBp = b.type === 'blueprint' || b.id === 'stage_blueprint';
        if (aBp && !bBp) return -1;
        if (!aBp && bBp) return 1;
        return 0;
    });

    for (const stage of sortedStages) {
        const isBp = stage.type === 'blueprint' || stage.id === 'stage_blueprint';

        const phaseFeatures = (stage.features || []).map(f => {
            allFeatureIds.add(f.id);
            return { id: f.id, name: f.name || f.id };
        });

        const phaseTasks: LifecyclePhase['tasks'] = [];
        const phaseTransitions: LifecyclePhase['transitions'] = [];
        const phaseCalls: LifecyclePhase['calls'] = [];

        for (const task of stage.tasks || []) {
            phaseTasks.push({
                name: task.name,
                label: esc(task.name),
                triggers: taskTriggerMap.get(task.name) || []
            });

            for (const called of findCalledTasks(task, allTaskNames)) {
                phaseCalls.push({ from: task.name, to: called });
            }

            for (const aName of getTaskActionNames(task)) {
                const actDef = resolveAction(project, stage, aName);
                if (actDef && actDef.type === 'navigate_stage' && actDef.stageId) {
                    const target = findStageById(project, actDef.stageId);
                    phaseTransitions.push({
                        targetStageId: actDef.stageId,
                        targetStageName: target ? target.name : actDef.stageId,
                        triggeredByTask: task.name
                    });
                    totalTransitions++;
                }
            }
        }

        phases.push({
            stageId: stage.id,
            stageName: stage.name || stage.id,
            isBlueprint: isBp,
            features: phaseFeatures,
            tasks: phaseTasks,
            transitions: phaseTransitions,
            calls: phaseCalls
        });
    }

    const { code, nodeLinks } = buildMermaid(phases);
    const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);

    return {
        phases,
        mermaidCode: code,
        taskNames: [...allTaskNames],
        featureIds: [...allFeatureIds],
        nodeLinks,
        totalPhases: phases.length,
        totalTasks,
        totalTransitions
    };
}

/**
 * Baut ein vertikales Flowchart:
 * - Task→Task-Aufrufe als Pfeile (erzeugen echte Ebenen von oben nach unten)
 * - Einstiegs-Tasks (ohne Aufrufer) im Raster mit GRID_COLUMNS Spalten (unsichtbare Kanten `~~~`)
 * - Leere Blueprint-Phase wird ausgeblendet
 */
function buildMermaid(phases: LifecyclePhase[]): { code: string; nodeLinks: GameLifecycleModel['nodeLinks'] } {
    const lines: string[] = ['flowchart TD'];
    const edgeLines: string[] = [];
    const nodeLinks: GameLifecycleModel['nodeLinks'] = {};
    const taskNodeIds = new Set<string>();
    const featureNodeIds: string[] = [];

    const visiblePhases = phases.filter(p => !(p.isBlueprint && p.tasks.length === 0 && p.features.length === 0));
    const visiblePhaseIds = new Set(visiblePhases.map(p => p.stageId));

    visiblePhases.forEach((phase, index) => {
        const phaseId = safeId('P', phase.stageId || `idx_${index}`);
        const phaseTitle = phase.isBlueprint ? '⚙️ Initialisierung - Blueprint' : `🎮 Phase: ${esc(phase.stageName)}`;
        const phaseTaskNames = new Set(phase.tasks.map(t => t.name));

        lines.push(`    subgraph ${phaseId}["${phaseTitle}"]`);
        lines.push('        direction TB');

        phase.features.forEach(f => {
            const fId = safeId('F', f.id);
            featureNodeIds.push(fId);
            nodeLinks[fId] = { kind: 'feature', ref: f.id };
            lines.push(`        ${fId}(["📦 ${esc(f.name)}"])`);
        });

        phase.tasks.forEach(t => {
            const tId = safeId('T', t.name);
            taskNodeIds.add(tId);
            nodeLinks[tId] = { kind: 'task', ref: t.name };
            const trig = t.triggers.length > 0 ? `<br/><small>⚡ ${esc(t.triggers.join(', '))}</small>` : '';
            lines.push(`        ${tId}["${esc(t.name)}${trig}"]`);
        });

        if (phase.features.length === 0 && phase.tasks.length === 0) {
            lines.push(`        ${safeId('Empty', phase.stageId)}["Noch keine Tasks oder Features"]`);
        }

        // Aufrufkanten innerhalb der Phase
        const incoming = new Set<string>();
        phase.calls.forEach(c => {
            if (phaseTaskNames.has(c.to)) {
                incoming.add(c.to);
                lines.push(`        ${safeId('T', c.from)} --> ${safeId('T', c.to)}`);
            }
        });

        // Einstiegs-Tasks im Raster anordnen
        const roots = phase.tasks.filter(t => !incoming.has(t.name)).map(t => safeId('T', t.name));
        for (let i = 0; i + GRID_COLUMNS < roots.length; i++) {
            lines.push(`        ${roots[i]} ~~~ ${roots[i + GRID_COLUMNS]}`);
        }
        // Features oberhalb der ersten Rasterzeile platzieren
        phase.features.forEach(f => {
            roots.slice(0, GRID_COLUMNS).forEach(r => lines.push(`        ${safeId('F', f.id)} ~~~ ${r}`));
        });

        lines.push('    end');

        // Aufrufe in andere Phasen + Stage-Wechsel außerhalb des Subgraphen
        phase.calls.forEach(c => {
            if (!phaseTaskNames.has(c.to)) edgeLines.push(`    ${safeId('T', c.from)} -.-> ${safeId('T', c.to)}`);
        });
        phase.transitions.forEach(tr => {
            if (!visiblePhaseIds.has(tr.targetStageId)) return;
            const fromId = tr.triggeredByTask ? safeId('T', tr.triggeredByTask) : phaseId;
            edgeLines.push(`    ${fromId} ==>|Wechsel zu ${esc(tr.targetStageName)}| ${safeId('P', tr.targetStageId)}`);
        });
    });

    if (edgeLines.length === 0 && visiblePhases.length > 1) {
        for (let i = 0; i < visiblePhases.length - 1; i++) {
            edgeLines.push(`    ${safeId('P', visiblePhases[i].stageId)} -.->|Nächste Stage| ${safeId('P', visiblePhases[i + 1].stageId)}`);
        }
    }

    lines.push(...edgeLines);

    lines.push('    classDef featureClass fill:#3b2d5c,stroke:#9d7bd8,stroke-width:2px,color:#ffffff;');
    lines.push('    classDef taskClass fill:#1e3a2f,stroke:#74c69d,stroke-width:1.5px,color:#ffffff;');
    if (featureNodeIds.length) lines.push(`    class ${featureNodeIds.join(',')} featureClass;`);
    if (taskNodeIds.size) lines.push(`    class ${[...taskNodeIds].join(',')} taskClass;`);

    return { code: lines.join('\n'), nodeLinks };
}
