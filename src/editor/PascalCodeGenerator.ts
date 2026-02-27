import { GameProject, SequenceItem, GameTask } from '../model/types';

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
                Object.values(obj.Tasks || {}).forEach((t: any) => {
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
                const tasksMap = obj.Tasks || {};
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
            if (obj.Tasks?.onStart) startTasks.push(obj.Tasks.onStart);
        });

        [...new Set(startTasks)].forEach(taskName => {
            lines.push(`  ${this.span(taskName, '#dcdcaa', asHtml)} (); ${this.span('{ Triggered by onStart }', '#6a9955', asHtml)} `);
        });

        lines.push(`${this.span('END', '#c586c0', asHtml)}.`);
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
                    const op = cond.operator === '==' ? '=' : (cond.operator === '!=' ? '<>' : cond.operator);
                    const val = typeof cond.value === 'string' ? ("'" + cond.value + "'") : cond.value;
                    const valColor = typeof cond.value === 'string' ? '#ce9178' : '#b5cea8';

                    lines.push(`${space}${this.span('IF', '#c586c0', asHtml)} ${this.span(cond.variable, '#9cdcfe', asHtml)} ${op} ${this.span(val.toString(), valColor, asHtml)} ${this.span('THEN', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)}`);

                    if (item.body) {
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
                    const op = cond.operator === '==' ? '=' : (cond.operator === '!=' ? '<>' : cond.operator);
                    const val = typeof cond.value === 'string' ? ("'" + cond.value + "'") : cond.value;
                    lines.push(`${space}${this.span('WHILE', '#c586c0', asHtml)} ${this.span(cond.variable, '#9cdcfe', asHtml)} ${op} ${this.span(val.toString(), '#ce9178', asHtml)} ${this.span('DO', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)} `);
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
        const action = (embeddedData || project.actions.find(a => a.name === actionName) || (activeStage?.actions?.find((a: any) => a.name === actionName))) as any;
        if (!action) return `${this.span(actionName, '#dcdcaa', asHtml)} (); `;

        let code = '';
        if (action.type === 'property' && action.target && action.changes) {
            const parts: string[] = [];
            Object.keys(action.changes).forEach(key => {
                const value = action.changes[key];
                const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                let valStr = value.toString();
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
        } else if (action.type === 'calculate' && action.resultVariable) {
            const expr = action.formula ? this.span(action.formula, '#ce9178', asHtml) : this.span('0', '#b5cea8', asHtml);
            code = `${this.span(action.resultVariable, '#9cdcfe', asHtml)} := ${expr}; `;
        } else if (action.type === 'increment' && action.target && action.changes) {
            const key = Object.keys(action.changes)[0] || 'value';
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
            const amount = action.changes[key] || 1;
            code = `${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)} := ${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)} + ${this.span(amount.toString(), '#b5cea8', asHtml)}; `;
        } else if (action.type === 'navigate_stage') {
            code = `${this.span('Application', '#4ec9b0', asHtml)}.${this.span('GoToStage', '#dcdcaa', asHtml)} (${this.span("'" + (action.params?.stageId || action.target || '?') + "'", '#ce9178', asHtml)}); `;
        } else if (action.type === 'call_method' && action.target && action.method) {
            code = `${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(action.method, '#dcdcaa', asHtml)} (); `;
        } else {
            code = `${this.span(actionName, '#dcdcaa', asHtml)} (); `;
        }

        return code;
    }
}
