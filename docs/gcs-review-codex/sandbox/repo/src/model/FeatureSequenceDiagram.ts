/**
 * FeatureSequenceDiagram — erzeugt ein Mermaid-sequenceDiagram pro User Story.
 *
 * Read-only Projektion, analog zu FeatureFlowAnalysis:
 *  - Auslöser (Event/Task-Aufruf) → geplanter Task → expandierte actionSequence
 *  - Aufgerufene Tasks erscheinen als Lebenslinien (NICHT expandiert —
 *    deren Flow öffnet der Klick im Diagramm)
 *  - action-Items werden zur Action-Definition aufgelöst:
 *      http            → Nachricht an Server-Lifeline (nur METHOD url)
 *      navigate_stage  → Nachricht an Navigation
 *      call_method     → Nachricht an Ziel-Komponente
 *      property/calculate/increment/sonstige → Selbstnachricht
 *  - condition → alt/else-Fragment, while/for/foreach → loop-Fragment
 */

export type SequenceRole = 'actor' | 'task' | 'server' | 'nav' | 'component';

export interface SequenceParticipant {
    label: string;
    role: SequenceRole;
}

export interface SequenceDiagramResult {
    /** Mermaid-Quelltext (sequenceDiagram). */
    code: string;
    /** Alle Task-Namen, die als Lebenslinien vorkommen (für Klick-Navigation). */
    taskNames: string[];
    /** Teilnehmer mit Rolle — für Rollen-Färbung im Dialog. */
    participants: SequenceParticipant[];
    /** true, wenn die Story keinen geplanten Task hat. */
    empty: boolean;
}

const esc = (s: any): string =>
    String(s ?? '').replace(/[\r\n]+/g, ' ').replace(/["#]/g, '').trim() || '?';

const shortName = (name: string): string => esc(name.replace(/^Act_/, ''));

function resolveAction(project: any, name: string): any | null {
    for (const stage of project?.stages || []) {
        const found = stage.actions?.find((a: any) => a.name === name);
        if (found) return found;
    }
    return (project?.actions || []).find((a: any) => a.name === name) || null;
}

function resolveTask(project: any, name: string): any | null {
    for (const stage of project?.stages || []) {
        const found = stage.tasks?.find((t: any) => t.name === name);
        if (found) return found;
    }
    return (project?.tasks || []).find((t: any) => t.name === name) || null;
}

export function buildStorySequenceDiagram(project: any, story: any): SequenceDiagramResult {
    const taskNames = new Set<string>();
    const decls: string[] = [];
    const declSeen = new Set<string>();
    const lines: string[] = [];

    let counter = 0;
    const aliasFor = (prefix: string, key: string): string => {
        const clean = String(key).replace(/[^A-Za-z0-9_]/g, '_');
        return `${prefix}_${clean}_${++counter}`;
    };

    // Lebenslinien-Registry: logischer Schlüssel → Alias; Reihenfolge = Auftreten.
    const lifelines = new Map<string, string>();
    const participants: SequenceParticipant[] = [];
    const lifeline = (key: string, label: string, prefix: string, role: SequenceRole): string => {
        const existing = lifelines.get(key);
        if (existing) return existing;
        const alias = aliasFor(prefix, key);
        lifelines.set(key, alias);
        participants.push({ label: esc(label), role });
        if (!declSeen.has(alias)) {
            declSeen.add(alias);
            decls.push(`    participant ${alias} as ${esc(label)}`);
        }
        return alias;
    };

    const taskLine = (name: string): string => {
        taskNames.add(name);
        return lifeline(`task:${name}`, `Task: ${name}`, 'T', 'task');
    };
    const SERVER = () => lifeline('server', 'Server', 'S', 'server');
    const NAV = () => lifeline('nav', 'Navigation', 'N', 'nav');
    const COMP = (name: string) => lifeline(`comp:${name}`, name, 'C', 'component');

    // ── Action-Item → Nachricht ──────────────────────────────────────
    const emitActionItem = (self: string, actionName: string): void => {
        const def = resolveAction(project, actionName);
        if (!def) {
            lines.push(`    ${self}->>${self}: ${shortName(actionName)}`);
            return;
        }
        switch (def.type) {
            case 'http':
                lines.push(`    ${self}->>${SERVER()}: ${esc(def.method || 'GET')} ${esc(def.url || '')}`);
                return;
            case 'navigate_stage': {
                const stage = (project?.stages || []).find((s: any) => s.id === def.stageId);
                lines.push(`    ${self}->>${NAV()}: ${esc(stage?.name || def.stageId || '?')}`);
                return;
            }
            case 'call_method':
                lines.push(`    ${self}->>${COMP(def.target || '?')}: ${esc(def.method || '?')}()`);
                return;
            default:
                lines.push(`    ${self}->>${self}: ${shortName(def.name || actionName)}`);
        }
    };

    const condLabel = (it: any): string =>
        it.condition ? `${it.condition.variable} ${it.condition.operator} ${it.condition.value}` : (it.name || 'Bedingung');

    const loopLabel = (it: any): string => {
        if (it.type === 'for') return `for ${esc(it.iteratorVar || 'i')} = ${esc(it.from ?? 0)}..${esc(it.to ?? '?')}`;
        if (it.type === 'foreach') return `foreach ${esc(it.itemVar || 'item')} in ${esc(it.sourceArray || '?')}`;
        return condLabel(it);
    };

    const emitTaskCall = (self: string, name: string): void => {
        lines.push(`    ${self}->>${taskLine(name)}: ${esc(name)}`);
    };

    const emitItems = (seq: any[] | undefined, self: string): void => {
        for (const it of seq || []) {
            switch (it.type) {
                case 'task':
                case 'execute_task':
                    emitTaskCall(self, it.name);
                    break;
                case 'condition': {
                    const label = esc(condLabel(it));
                    // Legacy-Format nutzt body/elseBody statt then/else
                    const thenArr = it.then || it.body;
                    const elseArr = it.else || it.elseBody;
                    const hasBranches = (thenArr?.length) || (elseArr?.length);
                    const hasShortcuts = it.thenTask || it.elseTask || it.thenAction || it.elseAction;
                    if (!hasBranches && !hasShortcuts) {
                        lines.push(`    Note over ${self}: ${label}`);
                        break;
                    }
                    lines.push(`    alt ${label}`);
                    if (hasBranches) {
                        emitItems(thenArr, self);
                        if (elseArr?.length) { lines.push('    else'); emitItems(elseArr, self); }
                    } else {
                        if (it.thenTask) emitTaskCall(self, it.thenTask);
                        if (it.thenAction) emitActionItem(self, it.thenAction);
                        if (it.elseTask || it.elseAction) {
                            lines.push('    else');
                            if (it.elseTask) emitTaskCall(self, it.elseTask);
                            if (it.elseAction) emitActionItem(self, it.elseAction);
                        }
                    }
                    lines.push('    end');
                    break;
                }
                case 'while':
                case 'for':
                case 'foreach':
                    lines.push(`    loop ${esc(loopLabel(it))}`);
                    emitItems(it.body, self);
                    lines.push('    end');
                    break;
                case 'action':
                case 'data_action':
                default:
                    if (it.name) emitActionItem(self, it.name);
            }
        }
    };

    // ── Story-Einstieg ───────────────────────────────────────────────
    const taskName = story?.plannedTask;
    if (!taskName) {
        return {
            code: `sequenceDiagram\n    actor U as Benutzer\n    Note over U: ${esc(story?.title || story?.id)} (offen — kein Task geplant)`,
            taskNames: [], participants: [{ label: 'Benutzer', role: 'actor' }], empty: true
        };
    }

    const trig = story?.trigger;
    const evName = trig?.kind === 'event' ? trig.event : story?.plannedEvent;
    const evCompName = trig?.kind === 'event'
        ? (trig.component?.name || trig.component?.componentName)
        : (story?.plannedComponent?.name || story?.plannedComponent?.componentName);
    // Komponente vor dem Task deklarieren → Leserichtung links→rechts
    const comp = evName && evCompName ? COMP(evCompName) : null;
    const main = taskLine(taskName);

    if (evName) {
        if (comp) {
            lines.push(`    U->>${comp}: ${esc(evName)}`);
            lines.push(`    ${comp}->>${main}: startet`);
        } else {
            lines.push(`    U->>${main}: ${esc(evName)}`);
        }
    } else if (trig?.kind === 'taskCall' && trig.callerTask) {
        const caller = taskLine(trig.callerTask);
        lines.push(`    ${caller}->>${main}: ruft auf`);
    }

    const task = resolveTask(project, taskName);
    if (task?.actionSequence?.length) {
        emitItems(task.actionSequence, main);
    } else {
        lines.push(`    Note over ${main}: Task ohne actionSequence`);
    }

    const code = [
        'sequenceDiagram',
        '    actor U as Benutzer',
        ...decls,
        `    Note over ${main}: ${esc(story?.title || story?.id)}`,
        ...lines
    ].join('\n');

    return {
        code,
        taskNames: [...taskNames],
        participants: [{ label: 'Benutzer', role: 'actor' }, ...participants],
        empty: false
    };
}
