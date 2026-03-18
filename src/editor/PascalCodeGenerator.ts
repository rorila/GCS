import { GameProject, SequenceItem, GameTask } from '../model/types';
import { actionRegistry } from '../runtime/ActionRegistry';

/**
 * PascalCodeGenerator - Encapsulates the logic for generating Pascal code from a GameProject.
 */
export class PascalCodeGenerator {
    private static span(text: string, color: string, asHtml: boolean): string {
        if (!asHtml) return text;
        return `<span style="color: ${color};">${text}</span>`;
    }

    /**
     * Generates a full Pascal program representation of the project
     */
    public static generateFullProgram(project: GameProject, asHtml: boolean = true, activeStage?: any): string {
        const lines: string[] = [];

        // Program Header
        const mainStage = project.stages?.find(s => s.type === 'main');
        const projName = mainStage?.gameName || project.meta?.name || 'GameBuilderProject';
        const suffix = (activeStage && activeStage.type !== 'main') ? `_${activeStage.name.replace(/\s+/g, '_')}` : '';
        lines.push(`${this.span('PROGRAM', '#c586c0', asHtml)} ${this.span(projName.replace(/\s+/g, '_') + suffix, '#dcdcaa', asHtml)};`);
        lines.push('');
        lines.push(`${this.span('USES', '#c586c0', asHtml)} crt; ${this.span('{ Standard libraries }', '#6a9955', asHtml)}`);
        lines.push('');

        // Global Variables
        let globalVars = (project.variables || []).filter(v => !v.scope || v.scope === 'global');
        if (activeStage && activeStage.variables) {
            globalVars = [...globalVars, ...activeStage.variables];
        }

        if (globalVars.length > 0) {
            lines.push(`${this.span('VAR', '#c586c0', asHtml)} ${this.span('{ PROJECT & STAGE VARIABLES }', '#6a9955', asHtml)}`);
            globalVars.forEach(v => {
                const pascalType = (v.type || 'string').charAt(0).toUpperCase() + (v.type || 'string').slice(1);
                let metadata = '';
                if (v.threshold !== undefined) metadata += ` Threshold=${v.threshold}`;
                const comment = `// Default: ${v.initialValue ?? v.defaultValue ?? 'nil'}${metadata}`;
                lines.push(`  ${this.span(v.name, '#9cdcfe', asHtml)}: ${this.span(pascalType, '#4ec9b0', asHtml)}; ${this.span(comment, '#6a9955', asHtml)}`);
            });
            lines.push('');
        }

        // STAGE COMPONENTS (New Section)
        if (activeStage && activeStage.objects && activeStage.objects.length > 0) {
            lines.push(`${this.span('VAR', '#c586c0', asHtml)} ${this.span('{ STAGE COMPONENTS }', '#6a9955', asHtml)}`);
            activeStage.objects.forEach((obj: any) => {
                const className = obj.className || obj.constructor?.name || 'TComponent';
                lines.push(`  ${this.span(obj.name, '#9cdcfe', asHtml)}: ${this.span(className, '#4ec9b0', asHtml)};`);
            });
            lines.push('');
        }

        // Procedures (Tasks)
        let allTasks: GameTask[] = [...(project.tasks || [])];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) {
                    s.tasks.forEach((st: any) => {
                        if (!allTasks.some(t => t.name === st.name)) allTasks.push(st);
                    });
                }
            });
        }

        let tasksToShow = allTasks;
        if (activeStage && activeStage.type !== 'main') {
            const relevantTaskNames = new Set<string>();
            if (activeStage.flowCharts) Object.keys(activeStage.flowCharts).forEach(key => relevantTaskNames.add(key));
            if (activeStage.tasks) activeStage.tasks.forEach((t: any) => relevantTaskNames.add(t.name));

            // Collect usages by objects
            activeStage.objects?.forEach((obj: any) => {
                Object.values(obj.events || obj.Tasks || {}).forEach((t: any) => {
                    if (typeof t === 'string' && t) relevantTaskNames.add(t);
                });
            });

            tasksToShow = allTasks.filter(t => t && t.name && relevantTaskNames.has(t.name));
        }

        if (tasksToShow.length > 0) {
            tasksToShow.forEach(task => {
                lines.push(this.generateProcedure(project, task.name, 0, undefined, asHtml, activeStage));
                lines.push('');
            });
        }

        // Object Event Handlers
        if (activeStage && activeStage.objects) {
            lines.push(`${this.span('{ OBJECT EVENT HANDLERS }', '#6a9955', asHtml)}`);
            activeStage.objects.forEach((obj: any) => {
                const tasksMap = obj.events || obj.Tasks || {};
                Object.keys(tasksMap).forEach(event => {
                    const targetTask = tasksMap[event];
                    if (targetTask) {
                        lines.push(`${this.span('PROCEDURE', '#c586c0', asHtml)} ${this.span(obj.name, '#9cdcfe', asHtml)}.${this.span(event, '#dcdcaa', asHtml)}();`);
                        lines.push(`${this.span('BEGIN', '#c586c0', asHtml)}`);
                        lines.push(`  ${this.span(targetTask, '#dcdcaa', asHtml)}();`);
                        lines.push(`${this.span('END', '#c586c0', asHtml)};`);
                        lines.push('');
                    }
                });
            });
        }

        // Main Program
        lines.push(`${this.span('BEGIN', '#c586c0', asHtml)} ${this.span('{ Main Program Entry Point }', '#6a9955', asHtml)} `);
        lines.push(`  ${this.span('clrscr', '#dcdcaa', asHtml)}; `);

        const startTasks: string[] = [];
        (activeStage ? activeStage.objects : project.objects || []).forEach((obj: any) => {
            const onStartTask = obj.events?.onStart || obj.Tasks?.onStart;
            if (onStartTask) startTasks.push(onStartTask);
        });

        [...new Set(startTasks)].forEach(taskName => {
            lines.push(`  ${this.span(taskName, '#dcdcaa', asHtml)} (); ${this.span('{ Triggered by onStart }', '#6a9955', asHtml)} `);
        });

        lines.push(`${this.span('END', '#c586c0', asHtml)}.`);
        return lines.join('\n');
    }

    /**
     * Generates Pascal code filtered for a single task and its related actions.
     * Shows: the task as main procedure + each referenced action as sub-procedure.
     */
    public static generateForTask(project: GameProject, taskName: string, asHtml: boolean = true, activeStage?: any): string {
        const lines: string[] = [];

        // Header
        lines.push(`${this.span('PROGRAM', '#c586c0', asHtml)} ${this.span('Task_' + taskName.replace(/\s+/g, '_'), '#dcdcaa', asHtml)};`);
        lines.push('');

        // Finde den Task
        let task = project.tasks?.find(t => t.name === taskName);
        if (!task && activeStage) task = activeStage.tasks?.find((t: any) => t.name === taskName);
        // Blueprint-Stage durchsuchen
        if (!task && project.stages) {
            for (const stage of project.stages) {
                const found = stage.tasks?.find((t: any) => t.name === taskName);
                if (found) { task = found as any; break; }
            }
        }

        if (!task) {
            lines.push(`${this.span('{ Task nicht gefunden: ' + taskName + ' }', '#6a9955', asHtml)}`);
            lines.push(`${this.span('END', '#c586c0', asHtml)}.`);
            return lines.join('\n');
        }

        // Sammle alle referenzierten Action-Namen rekursiv aus der actionSequence
        const referencedActions = new Set<string>();
        this.collectActionNames(task.actionSequence || [], referencedActions);

        // Sammle alle manipulierten Targets aus den referenzierten Actions
        const targetNames = new Set<string>();
        referencedActions.forEach(actionName => {
            const blueprintStage = project.stages?.find((s: any) => s.type === 'blueprint');
            const action = (
                project.actions?.find(a => a.name === actionName) ||
                blueprintStage?.actions?.find((a: any) => a.name === actionName) ||
                activeStage?.actions?.find((a: any) => a.name === actionName)
            ) as any;
            if (action?.target) targetNames.add(action.target);
        });

        // VAR-Sektion: Task-Parameter + manipulierte Komponenten
        const params = (task as any).params || [];
        const hasVars = params.length > 0 || targetNames.size > 0;

        if (hasVars) {
            lines.push(`${this.span('VAR', '#c586c0', asHtml)}`);

            // Task-Parameter
            if (params.length > 0) {
                lines.push(`  ${this.span('{ Task-Parameter }', '#6a9955', asHtml)}`);
                params.forEach((p: any) => {
                    const pascalType = (p.type || 'string').charAt(0).toUpperCase() + (p.type || 'string').slice(1);
                    lines.push(`  ${this.span(p.name, '#9cdcfe', asHtml)}: ${this.span(pascalType, '#4ec9b0', asHtml)};`);
                });
            }

            // Manipulierte Komponenten
            if (targetNames.size > 0) {
                lines.push(`  ${this.span('{ Manipulierte Komponenten }', '#6a9955', asHtml)}`);
                const allObjects = [
                    ...(activeStage?.objects || []),
                    ...(project.stages?.find((s: any) => s.type === 'blueprint')?.objects || [])
                ];
                targetNames.forEach(targetName => {
                    const obj = allObjects.find((o: any) => o.name === targetName);
                    const className = obj?.className || obj?.constructor?.name || 'TComponent';
                    lines.push(`  ${this.span(targetName, '#9cdcfe', asHtml)}: ${this.span(className, '#4ec9b0', asHtml)};`);
                });
            }

            lines.push('');
        }

        // Der Task als Hauptprozedur
        lines.push(this.generateProcedure(project, taskName, 0, undefined, asHtml, activeStage));
        lines.push('');

        // Event-Handler, die diesen Task referenzieren
        const eventHandlers: string[] = [];
        const stagesToCheck = activeStage ? [activeStage] : (project.stages || []);
        stagesToCheck.forEach((stage: any) => {
            (stage.objects || []).forEach((obj: any) => {
                const tasks = obj.events || obj.Tasks || {};
                Object.entries(tasks).forEach(([event, tName]) => {
                    if (tName === taskName) {
                        eventHandlers.push(`${this.span('// Auslöser:', '#6a9955', asHtml)} ${this.span(obj.name, '#9cdcfe', asHtml)}.${this.span(event, '#dcdcaa', asHtml)}`);
                    }
                });
            });
        });

        if (eventHandlers.length > 0) {
            lines.push(`${this.span('{ ─── Event-Auslöser ─── }', '#6a9955', asHtml)}`);
            eventHandlers.forEach(h => lines.push(h));
            lines.push('');
        }

        lines.push(`${this.span('END', '#c586c0', asHtml)}.`);
        return lines.join('\n');
    }

    /**
     * Sammelt rekursiv alle Action-Namen aus einer actionSequence.
     */
    private static collectActionNames(sequence: SequenceItem[], result: Set<string>) {
        if (!sequence) return;
        sequence.forEach(item => {
            if ((item.type === 'action' || !item.type) && item.name) {
                result.add(item.name);
            }
            if (item.thenAction) result.add(item.thenAction);
            if (item.elseAction) result.add(item.elseAction);
            if (item.body) this.collectActionNames(item.body, result);
            if ((item as any).elseBody) this.collectActionNames((item as any).elseBody, result);
        });
    }


    /**
     * Generiert nur die Action-Anweisungen eines Tasks — ohne PROGRAM/VAR/PROCEDURE Wrapper.
     * Zeigt z.B.:  LeftPaddle.VelocityY := -0.5;
     */
    public static generateSequenceOnly(project: GameProject, taskName: string, asHtml: boolean = true, activeStage?: any): string {
        let task = (project.tasks || []).find(t => t.name === taskName) as any;
        if (!task && activeStage) task = activeStage.tasks?.find((t: any) => t.name === taskName);
        if (!task && project.stages) {
            for (const stage of project.stages) {
                const found = stage.tasks?.find((t: any) => t.name === taskName);
                if (found) { task = found; break; }
            }
        }

        if (!task || !task.actionSequence || task.actionSequence.length === 0) {
            return this.span('{ Keine Actions }', '#6a9955', asHtml);
        }

        const lines: string[] = [];
        this.renderSequenceToPascal(project, task.actionSequence, lines, 0, asHtml, activeStage);
        return lines.join('\n');
    }

    public static generateProcedure(project: GameProject, taskName: string, indent: number = 0, sequenceOverride?: SequenceItem[], asHtml: boolean = true, activeStage?: any): string {
        let task = project.tasks.find(t => t.name === taskName);
        if (!task && activeStage) task = activeStage.tasks?.find((t: any) => t.name === taskName);

        const sequence = sequenceOverride || task?.actionSequence || [];
        const lines: string[] = [];
        const space = ' '.repeat(indent);

        lines.push(`${space}${this.span('PROCEDURE', '#c586c0', asHtml)} ${this.span(taskName, '#dcdcaa', asHtml)}; `);
        lines.push(`${space}${this.span('BEGIN', '#c586c0', asHtml)} `);

        this.renderSequenceToPascal(project, sequence, lines, indent + 2, asHtml, activeStage);

        lines.push(`${space}${this.span('END', '#c586c0', asHtml)}; `);
        return lines.join('\n');
    }


    private static renderSequenceToPascal(project: GameProject, sequence: SequenceItem[], lines: string[], indent: number, asHtml: boolean, activeStage?: any) {
        const space = ' '.repeat(indent);

        if (!sequence || sequence.length === 0) {
            lines.push(`${space}${this.span('// Empty sequence', '#6a9955', asHtml)} `);
            return;
        }

        sequence.forEach(item => {
            if (item.type === 'action' || !item.type) {
                lines.push(`${space}${this.getActionPascalCode(project, item.name, asHtml, activeStage, (item as any).data)} `);
            } else if (item.type === 'task') {
                lines.push(`${space}${this.span(item.name, '#dcdcaa', asHtml)}; ${this.span('// Task Call', '#6a9955', asHtml)} `);
            } else if (item.type === 'condition') {
                const cond = item.condition;
                if (cond) {
                    // Unterstütze beide Formate: alt (variable/value) und neu (leftValue/rightValue)
                    const leftVar = cond.variable || (cond as any).leftValue || '?';
                    const rightVal = cond.value ?? (cond as any).rightValue ?? '?';
                    const op = cond.operator === '==' ? '=' : (cond.operator === '!=' ? '<>' : (cond.operator || '='));
                    const val = typeof rightVal === 'string' ? ("'" + rightVal + "'") : String(rightVal);
                    const valColor = typeof rightVal === 'string' ? '#ce9178' : '#b5cea8';

                    lines.push(`${space}${this.span('IF', '#c586c0', asHtml)} ${this.span(leftVar, '#9cdcfe', asHtml)} ${op} ${this.span(val, valColor, asHtml)} ${this.span('THEN', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)}`);

                    if (item.body && item.body.length > 0) {
                        this.renderSequenceToPascal(project, item.body, lines, indent + 2, asHtml, activeStage);
                    } else if (item.thenAction) {
                        lines.push(`${space}  ${this.getActionPascalCode(project, item.thenAction, asHtml, activeStage)} `);
                    }

                    lines.push(`${space}${this.span('END', '#c586c0', asHtml)};`);

                    if (item.elseAction || item.elseTask || (item as any).elseBody) {
                        lines.push(`${space}${this.span('ELSE', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)} `);
                        if (item.elseAction) {
                            lines.push(`${space}  ${this.getActionPascalCode(project, item.elseAction, asHtml, activeStage)} `);
                        } else if ((item as any).elseBody) {
                            this.renderSequenceToPascal(project, (item as any).elseBody, lines, indent + 2, asHtml, activeStage);
                        }
                        lines.push(`${space}${this.span('END', '#c586c0', asHtml)}; `);
                    }
                }
            } else if (item.type === 'while') {
                const cond = item.condition;
                if (cond) {
                    const leftVar = cond.variable || (cond as any).leftValue || '?';
                    const rightVal = cond.value ?? (cond as any).rightValue ?? '?';
                    const op = cond.operator === '==' ? '=' : (cond.operator === '!=' ? '<>' : (cond.operator || '='));
                    const val = typeof rightVal === 'string' ? ("'" + rightVal + "'") : String(rightVal);
                    lines.push(`${space}${this.span('WHILE', '#c586c0', asHtml)} ${this.span(leftVar, '#9cdcfe', asHtml)} ${op} ${this.span(val, '#ce9178', asHtml)} ${this.span('DO', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)} `);
                    if (item.body) this.renderSequenceToPascal(project, item.body, lines, indent + 2, asHtml, activeStage);
                    lines.push(`${space}${this.span('END', '#c586c0', asHtml)}; `);
                }
            } else if (item.type === 'for') {
                lines.push(`${space}${this.span('FOR', '#c586c0', asHtml)} ${this.span(item.iteratorVar || 'i', '#9cdcfe', asHtml)} := ${this.span((item.from ?? 0).toString(), '#b5cea8', asHtml)} ${this.span('TO', '#c586c0', asHtml)} ${this.span((item.to ?? 10).toString(), '#b5cea8', asHtml)} ${this.span('DO', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)} `);
                if (item.body) this.renderSequenceToPascal(project, item.body, lines, indent + 2, asHtml, activeStage);
                lines.push(`${space}${this.span('END', '#c586c0', asHtml)}; `);
            }
        });
    }

    private static getActionPascalCode(project: GameProject, actionName: string, asHtml: boolean, activeStage?: any, embeddedData?: any): string {
        // Suche Action: Blueprint-Stage (global) > project.actions > activeStage.actions
        const blueprintStage = project.stages?.find((s: any) => s.type === 'blueprint');
        const action = (embeddedData || 
            project.actions?.find(a => a.name === actionName) || 
            blueprintStage?.actions?.find((a: any) => a.name === actionName) ||
            activeStage?.actions?.find((a: any) => a.name === actionName)) as any;
        if (!action) return `${this.span(actionName, '#dcdcaa', asHtml)} (); `;

        let code = '';
        if (action.type === 'property' && action.target && action.changes) {
            const parts: string[] = [];
            Object.keys(action.changes).forEach(key => {
                const value = action.changes[key];
                if (value === undefined || value === null) return;
                const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                let valStr = String(value);
                let color = '#ce9178';

                if (typeof value === 'string') {
                    const match = value.match(/^\$\{(.+)\}$/);
                    if (match) {
                        valStr = match[1];
                        color = '#9cdcfe';
                    } else {
                        valStr = `'${value}'`;
                    }
                } else if (typeof value === 'number') {
                    color = '#b5cea8';
                }
                parts.push(`${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)} := ${this.span(valStr, color, asHtml)}; `);
            });
            code = parts.join(' ');
        } else if (action.type === 'negate' && action.target) {
            // Negate: Invertiert den Wert einer Eigenschaft
            const prop = action.property || 'velocityX';
            const capitalizedProp = prop.charAt(0).toUpperCase() + prop.slice(1);
            code = `${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedProp, '#9cdcfe', asHtml)} := ${this.span('-', '#d4d4d4', asHtml)}${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedProp, '#9cdcfe', asHtml)}; ${this.span('{ Negate }', '#6a9955', asHtml)} `;
        } else if (action.type === 'calculate' && action.resultVariable) {
            const expr = action.formula ? this.span(action.formula, '#ce9178', asHtml) : this.span('0', '#b5cea8', asHtml);
            code = `${this.span(action.resultVariable, '#9cdcfe', asHtml)} := ${expr}; `;
        } else if (action.type === 'increment' && action.target && action.changes) {
            const key = Object.keys(action.changes)[0] || 'value';
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
            const amount = action.changes[key] || 1;
            code = `${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)} := ${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)} + ${this.span(String(amount), '#b5cea8', asHtml)}; `;
        } else if (action.type === 'navigate_stage') {
            const sid = action.stageId || action.params?.stageId || action.target || '?';
            code = `${this.span('Application', '#4ec9b0', asHtml)}.${this.span('GoToStage', '#dcdcaa', asHtml)} (${this.span("'" + sid + "'", '#ce9178', asHtml)}); `;
        } else if (action.type === 'call_method' && action.target && action.method) {
            code = `${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(action.method, '#dcdcaa', asHtml)} (); `;
        } else {
            // --- Dynamic Registry Fallback ---
            const meta = actionRegistry.getMetadata(action.type);
            if (meta && meta.parameters && meta.parameters.length > 0) {
                const parts: string[] = [];
                meta.parameters.forEach(p => {
                    const val = action[p.name] ?? (action.params && action.params[p.name]);
                    if (val !== undefined && val !== null && val !== '') {
                        parts.push(`${p.name}: ${this.span(String(val), '#ce9178', asHtml)}`);
                    }
                });
                const paramsStr = parts.join(', ');
                code = `${this.span(action.type, '#dcdcaa', asHtml)} (${paramsStr}); `;
            } else {
                // Fallback: Unbekannter Typ als Prozedur-Aufruf darstellen
                code = `${this.span(actionName, '#dcdcaa', asHtml)} (); ${this.span('{ ' + (action.type || 'unknown') + ' }', '#6a9955', asHtml)} `;
            }
        }

        return code;
    }
}
