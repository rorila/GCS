import { GameProject, SequenceItem, ProjectVariable, VariableScope, GameTask } from '../model/types';
import { projectRegistry } from '../services/ProjectRegistry';

export class PascalGenerator {
    private static span(text: string, color: string, asHtml: boolean): string {
        if (!asHtml) return text;
        return `<span style="color: ${color};">${text}</span>`;
    }

    // Generic event handling: we no longer use a hardcoded list.
    // Events are identified by keys starting with 'on' + Uppercase letter convention


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

        // Global Variables (Always global, unless we want stage locals?)
        // For now, keep project globals available
        let globalVars = (project.variables || []).filter(v => !v.scope || v.scope === 'global');

        // Add Stage-Local Variables if in activeStage
        if (activeStage && activeStage.variables) {
            globalVars = [...globalVars, ...activeStage.variables];
        }

        if (globalVars.length > 0) {
            lines.push(`${this.span('VAR', '#c586c0', asHtml)} ${this.span('{ PROJECT & STAGE VARIABLES }', '#6a9955', asHtml)}`);
            globalVars.forEach(v => {
                const pascalType = (v.type || 'string').charAt(0).toUpperCase() + (v.type || 'string').slice(1);
                let metadata = '';
                if (v.threshold !== undefined) metadata += ` Threshold=${v.threshold}`;
                if (v.triggerValue !== undefined) metadata += ` TriggerValue='${v.triggerValue}'`;
                if (v.duration !== undefined) metadata += ` Duration=${v.duration}`;
                if (v.min !== undefined) metadata += ` Min=${v.min}`;
                if (v.max !== undefined) metadata += ` Max=${v.max}`;

                const comment = `// Default: ${v.initialValue ?? v.defaultValue ?? 'nil'}${metadata}`;
                lines.push(`  ${this.span(v.name, '#9cdcfe', asHtml)}: ${this.span(pascalType, '#4ec9b0', asHtml)}; ${this.span(comment, '#6a9955', asHtml)}`);
            });
            lines.push('');
        }

        // Procedures (Tasks)
        // Aggregation: Collect EVERY task from the entire project (global + all stages)
        let allTasks: GameTask[] = [...(project.tasks || [])];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) {
                    s.tasks.forEach((st: any) => {
                        if (!allTasks.some(t => t.name === st.name)) {
                            allTasks.push(st);
                        }
                    });
                }
            });
        }

        let tasksToShow = allTasks;

        if (activeStage) {
            const relevantTaskNames = new Set<string>();

            // 1. Explicitly defined in stage flowCharts (local or global)
            if (activeStage.flowCharts) {
                Object.keys(activeStage.flowCharts).forEach(key => relevantTaskNames.add(key));
            }

            // 2. Defined in global flowCharts OR in any other stage's flowCharts (might be cross-referenced)
            if (project.flowCharts) {
                Object.keys(project.flowCharts).forEach(key => {
                    if (key !== 'global') relevantTaskNames.add(key);
                });
            }
            if (project.stages) {
                project.stages.forEach(s => {
                    if (s.flowCharts) {
                        Object.keys(s.flowCharts).forEach(key => {
                            if (key !== 'global') relevantTaskNames.add(key);
                        });
                    }
                });
            }

            // 3. Used by objects in this stage
            const stageObjects = activeStage.objects || [];
            stageObjects.forEach((obj: any) => {
                const tasksMap = (obj as any).Tasks || {};
                Object.values(tasksMap).forEach((t: any) => {
                    if (typeof t === 'string' && t) relevantTaskNames.add(t);
                });
            });

            // 4. Local tasks are ALWAYS relevant for the stage view
            if (activeStage.tasks) {
                activeStage.tasks.forEach((t: any) => relevantTaskNames.add(t.name));
            }

            // Filter logic:
            // - If Main stage: Show all tasks (Global + all Locals)
            // - If other stage: Show only relevant tasks
            if (activeStage.type !== 'main') {
                tasksToShow = allTasks.filter(t => t && t.name && relevantTaskNames.has(t.name));
            }
        }

        if (tasksToShow.length > 0) {
            tasksToShow.forEach(task => {
                // Pass activeStageObjects to generateProcedure for "Used by" comments?
                // For now just generate code
                lines.push(this.generateProcedure(project, task.name, 0, undefined, asHtml, activeStage));
                lines.push('');
            });
        } else {
            lines.push(`${this.span('{ NO TASKS DEFINED FOR THIS STAGE }', '#6a9955', asHtml)}`);
            lines.push('');
        }

        // Object Event Handlers (Wiring)
        if (activeStage && activeStage.objects && activeStage.objects.length > 0) {
            lines.push(`${this.span('{ OBJECT EVENT HANDLERS }', '#6a9955', asHtml)}`);
            activeStage.objects.forEach((obj: any) => {
                const tasksMap = obj.Tasks || {};
                const events = Object.keys(tasksMap);

                events.forEach(event => {
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

        // VARIABLE EVENT HANDLERS
        const relevantVars = [...(project.variables || []).filter(v => !v.scope || v.scope === 'global')];
        if (activeStage && activeStage.variables) {
            relevantVars.push(...activeStage.variables);
        }

        if (relevantVars.length > 0) {
            const varLines: string[] = [];
            relevantVars.forEach(v => {
                // Generic Event Discovery
                // We check both the top-level properties (for compatibility) 
                // and the 'Tasks' object (standard TComponent pattern)
                const eventMap: Record<string, string> = {};

                // 1. Top-level properties (legacy/simple)
                Object.keys(v).forEach(key => {
                    if (key.startsWith('on') && key.length > 2) {
                        const val = (v as any)[key];
                        if (typeof val === 'string' && val.length > 0) {
                            eventMap[key] = val;
                        }
                    }
                });

                // 2. Tasks object (standard for components)
                const tasksMap = (v as any).Tasks || {};
                Object.keys(tasksMap).forEach(key => {
                    if (key.startsWith('on') && key.length > 2) {
                        const val = tasksMap[key];
                        if (typeof val === 'string' && val.length > 0) {
                            eventMap[key] = val;
                        }
                    }
                });

                // Generate Code for all discovered events
                Object.keys(eventMap).forEach(key => {
                    const eventTaskName = eventMap[key];
                    varLines.push(`${PascalGenerator.span('PROCEDURE', '#c586c0', asHtml)} ${PascalGenerator.span(v.name, '#9cdcfe', asHtml)}.${PascalGenerator.span(key, '#dcdcaa', asHtml)}();`);
                    varLines.push(`${PascalGenerator.span('BEGIN', '#c586c0', asHtml)}`);
                    varLines.push(`  ${PascalGenerator.span(eventTaskName, '#dcdcaa', asHtml)}();`);
                    varLines.push(`${PascalGenerator.span('END', '#c586c0', asHtml)};`);
                    varLines.push('');
                });
            });

            if (varLines.length > 0) {
                lines.push(`${this.span('{ VARIABLE EVENT HANDLERS }', '#6a9955', asHtml)}`);
                lines.push(...varLines);
            }
        }

        // Main Program
        lines.push(`${this.span('BEGIN', '#c586c0', asHtml)} ${this.span('{ Main Program Entry Point }', '#6a9955', asHtml)} `);
        lines.push(`  ${this.span('clrscr', '#dcdcaa', asHtml)}; `);

        // Find all tasks triggered by onStart events (Stage Specific!)
        const startTasks: string[] = [];
        const sourceObjects = activeStage ? activeStage.objects : project.objects;

        sourceObjects.forEach((obj: any) => {
            const tasksMap = (obj as any).Tasks || {};
            if (tasksMap.onStart) {
                startTasks.push(tasksMap.onStart);
            }
        });

        if (startTasks.length > 0) {
            [...new Set(startTasks)].forEach(taskName => {
                lines.push(`  ${this.span(taskName, '#dcdcaa', asHtml)} (); ${this.span('{ Triggered by onStart }', '#6a9955', asHtml)} `);
            });
        } else {
            lines.push(`  ${this.span('// No onStart tasks defined', '#6a9955', asHtml)} `);
        }

        lines.push(`${this.span('END', '#c586c0', asHtml)}.`);

        return lines.join('\n');
    }

    /**
     * Generates a single Pascal procedure for a task
     */
    public static generateProcedure(project: GameProject, taskName: string, indent: number = 0, sequenceOverride?: SequenceItem[], asHtml: boolean = true, activeStage?: any): string {
        // Robust Search: Global -> Active Stage -> Any other Stage
        let task = project.tasks.find(t => t.name === taskName);
        if (!task && activeStage) {
            task = activeStage.tasks?.find((t: any) => t.name === taskName);
        }
        if (!task && project.stages) {
            for (const s of project.stages) {
                const found = s.tasks?.find((t: any) => t.name === taskName);
                if (found) {
                    task = found;
                    break;
                }
            }
        }

        const sequence = sequenceOverride || task?.actionSequence || [];

        const lines: string[] = [];
        const space = ' '.repeat(indent);

        // Header with Usage Comments
        const users = (activeStage?.objects || project.objects).filter((obj: any) => {
            const tasksMap = (obj as any).Tasks || {};
            return Object.values(tasksMap).includes(taskName);
        }).map((obj: any) => obj.name);

        if (users.length > 0) {
            lines.push(`${space}${this.span('{ Used by: ' + users.join(', ') + ' }', '#6a9955', asHtml)} `);
        }

        lines.push(`${space}${this.span('PROCEDURE', '#c586c0', asHtml)} ${this.span(taskName, '#dcdcaa', asHtml)}; `);

        // VAR Section (Task Scoped)
        const taskVars = project.variables.filter(v => (v.scope || '').toLowerCase() === taskName.toLowerCase());
        if (taskVars.length > 0) {
            lines.push(`${space}${this.span('VAR', '#c586c0', asHtml)} `);
            taskVars.forEach(v => {
                const typeStr = v.type || 'string';
                const pascalType = typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
                let metadata = '';
                if (v.threshold !== undefined) metadata += ` Threshold = ${v.threshold} `;
                if (v.triggerValue !== undefined) metadata += ` TriggerValue = '${v.triggerValue}'`;
                if (v.duration !== undefined) metadata += ` Duration = ${v.duration} `;
                if (v.min !== undefined) metadata += ` Min = ${v.min} `;
                if (v.max !== undefined) metadata += ` Max = ${v.max} `;

                const comment = ` { Default: ${v.initialValue ?? v.defaultValue ?? 'nil'}${metadata} } `;
                lines.push(`${space}  ${this.span(v.name, '#9cdcfe', asHtml)}: ${this.span(pascalType, '#4ec9b0', asHtml)};${this.span(comment, '#6a9955', asHtml)} `);
            });
        }

        // BEGIN Section
        lines.push(`${space}${this.span('BEGIN', '#c586c0', asHtml)} `);

        // Recursively render sequence
        this.renderSequenceToPascal(project, sequence, lines, indent + 2, asHtml, activeStage);

        // END Section
        lines.push(`${space}${this.span('END', '#c586c0', asHtml)}; `);

        return lines.join('\n');
    }

    private static renderSequenceToPascal(project: GameProject, sequence: SequenceItem[], lines: string[], indent: number, asHtml: boolean, activeStage?: any) {
        const space = ' '.repeat(indent);

        if (sequence.length === 0) {
            lines.push(`${space}${this.span('// Empty sequence', '#6a9955', asHtml)} `);
            return;
        }

        sequence.forEach(item => {
            if (item.type === 'action' || !item.type) {
                // Support both standalone actions (by name) and embedded action data
                lines.push(`${space}${this.getActionPascalCode(project, item.name, asHtml, activeStage, (item as any).data)} `);
            } else if (item.type === 'task') {
                lines.push(`${space}${this.span(item.name, '#dcdcaa', asHtml)}; ${this.span('// Task Call', '#6a9955', asHtml)} `);
            } else if (item.type === 'condition') {
                const cond = item.condition;
                if (cond) {
                    const op = cond.operator === '==' ? '=' : (cond.operator === '!=' ? '<>' : cond.operator);
                    const isString = typeof cond.value === 'string';
                    const val = isString ? ("'" + cond.value + "'") : cond.value;
                    const valColor = isString ? '#ce9178' : '#b5cea8'; // Orange for strings, green for numbers
                    let sysVarComment = '';
                    if (cond.variable === 'hitSide') sysVarComment = ` ${this.span('{ System variable: side of collision/boundary }', '#6a9955', asHtml)} `;
                    if (cond.variable === 'direction') sysVarComment = ` ${this.span('{ System variable: move direction (up/down) }', '#6a9955', asHtml)} `;

                    lines.push(`${space}${this.span('IF', '#c586c0', asHtml)} ${this.span(cond.variable, '#9cdcfe', asHtml)} ${op} ${this.span(val.toString(), valColor, asHtml)} ${this.span('THEN', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)}${sysVarComment} `);

                    // Then branch
                    if (item.thenAction) {
                        lines.push(`${space}  ${this.getActionPascalCode(project, item.thenAction, asHtml, activeStage)} `);
                    } else if (item.thenTask) {
                        lines.push(`${space}  ${this.span(item.thenTask, '#dcdcaa', asHtml)}; `);
                    } else if (item.body) {
                        this.renderSequenceToPascal(project, item.body, lines, indent + 2, asHtml, activeStage);
                    }

                    lines.push(`${space}${this.span('END', '#c586c0', asHtml)} `);

                    if (item.elseAction || item.elseTask || (item as any).elseBody) {
                        lines.push(`${space}${this.span('ELSE', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)} `);
                        if (item.elseAction) {
                            lines.push(`${space}  ${this.getActionPascalCode(project, item.elseAction, asHtml, activeStage)} `);
                        } else if (item.elseTask) {
                            lines.push(`${space}  ${this.span(item.elseTask, '#dcdcaa', asHtml)}; `);
                        } else if ((item as any).elseBody) {
                            this.renderSequenceToPascal(project, (item as any).elseBody, lines, indent + 2, asHtml, activeStage);
                        }
                        lines.push(`${space}${this.span('END', '#c586c0', asHtml)}; `);
                    } else {
                        lines[lines.length - 1] += ';';
                    }
                }
            } else if (item.type === 'data_action') {
                const action = item as any;
                const method = action.method || 'GET';
                const url = action.url || '';
                const result = action.resultVariable ? `${this.span(action.resultVariable, '#9cdcfe', asHtml)} := ` : '';

                lines.push(`${space}${this.span('IF', '#c586c0', asHtml)} ${result}${this.span('API', '#4ec9b0', asHtml)}.${this.span('DataAction', '#dcdcaa', asHtml)}('${method}', '${url}') ${this.span('THEN', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)}`);

                if (action.successBody) {
                    this.renderSequenceToPascal(project, action.successBody, lines, indent + 2, asHtml, activeStage);
                }

                lines.push(`${space}${this.span('END', '#c586c0', asHtml)}`);

                if (action.errorBody && action.errorBody.length > 0) {
                    lines.push(`${space}${this.span('ELSE', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)}`);
                    this.renderSequenceToPascal(project, action.errorBody, lines, indent + 2, asHtml, activeStage);
                    lines.push(`${space}${this.span('END', '#c586c0', asHtml)};`);
                } else {
                    lines[lines.length - 1] += ';';
                }
            } else if (item.type === 'while') {
                const cond = item.condition;
                if (cond) {
                    const op = cond.operator === '==' ? '=' : (cond.operator === '!=' ? '<>' : cond.operator);
                    const isString = typeof cond.value === 'string';
                    const val = isString ? ("'" + cond.value + "'") : cond.value;
                    const valColor = isString ? '#ce9178' : '#b5cea8';
                    lines.push(`${space}${this.span('WHILE', '#c586c0', asHtml)} ${this.span(cond.variable, '#9cdcfe', asHtml)} ${op} ${this.span(val.toString(), valColor, asHtml)} ${this.span('DO', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)} `);
                    if (item.body) {
                        this.renderSequenceToPascal(project, item.body, lines, indent + 2, asHtml, activeStage);
                    }
                    lines.push(`${space}${this.span('END', '#c586c0', asHtml)}; `);
                }
            } else if (item.type === 'for') {
                lines.push(`${space}${this.span('FOR', '#c586c0', asHtml)} ${this.span(item.iteratorVar || 'i', '#9cdcfe', asHtml)} := ${this.span((item.from ?? 0).toString(), '#b5cea8', asHtml)} ${this.span('TO', '#c586c0', asHtml)} ${this.span((item.to ?? 10).toString(), '#b5cea8', asHtml)} ${this.span('DO', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)} `);
                if (item.body) {
                    this.renderSequenceToPascal(project, item.body, lines, indent + 2, asHtml, activeStage);
                }
                lines.push(`${space}${this.span('END', '#c586c0', asHtml)}; `);
            } else if (item.type === 'foreach') {
                lines.push(`${space}${this.span('FOR', '#c586c0', asHtml)} ${this.span(item.itemVar || 'item', '#9cdcfe', asHtml)} ${this.span('IN', '#c586c0', asHtml)} ${this.span(item.sourceArray || 'list', '#9cdcfe', asHtml)} ${this.span('DO', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)} `);
                if (item.body) {
                    this.renderSequenceToPascal(project, item.body, lines, indent + 2, asHtml, activeStage);
                }
                lines.push(`${space}${this.span('END', '#c586c0', asHtml)}; `);
            }
        });
    }

    private static getActionPascalCode(project: GameProject, actionName: string, asHtml: boolean, activeStage?: any, embeddedData?: any): string {
        const action = (embeddedData || project.actions.find(a => a.name === actionName) || (activeStage?.actions?.find((a: any) => a.name === actionName))) as any;
        if (!action) return `${this.span(actionName, '#dcdcaa', asHtml)} (); `;

        let code = '';
        if (action.type === 'property' && action.target && action.changes) {
            const changeKeys = Object.keys(action.changes);
            if (changeKeys.length > 0) {
                const parts: string[] = [];
                for (const key of changeKeys) {
                    const value = action.changes[key];
                    let valStr = value.toString();
                    let color = '#ce9178'; // string color

                    if (typeof value === 'string') {
                        const match = value.match(/^\$\{(.+)\}$/);
                        if (match) {
                            valStr = match[1];
                            color = '#9cdcfe'; // variable color
                        } else {
                            valStr = `'${value}'`;
                        }
                    } else if (typeof value === 'number') {
                        color = '#b5cea8'; // number color
                    }

                    // Capitalize property name to match Editor (Text instead of text)
                    const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                    parts.push(`${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)} := ${this.span(valStr, color, asHtml)}; `);
                }
                code = parts.join('\n'); // Note: This might need adjustment if used in single line IF
            } else {
                code = `${this.span(actionName, '#dcdcaa', asHtml)} (); `;
            }
        } else if (action.type === 'service' && action.service && action.method) {
            const resultPart = action.resultVariable ? `${this.span(action.resultVariable, '#9cdcfe', asHtml)} := ` : '';
            code = `${resultPart}${this.span(action.service, '#4ec9b0', asHtml)}.${this.span(action.method, '#dcdcaa', asHtml)} (); `;
        } else if (action.type === 'variable' && action.variableName) {
            const capitalizedProp = action.sourceProperty ? action.sourceProperty.charAt(0).toUpperCase() + action.sourceProperty.slice(1) : '';
            code = `${this.span(action.variableName, '#9cdcfe', asHtml)} := ${this.span(action.source || '', '#9cdcfe', asHtml)}.${this.span(capitalizedProp, '#9cdcfe', asHtml)}; `;
        } else if (action.type === 'increment' && action.target && action.changes) {
            const key = Object.keys(action.changes)[0] || 'value';
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
            const amount = action.changes[key] || 1;
            code = `${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)} := ${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)} + ${this.span(amount.toString(), '#b5cea8', asHtml)}; `;
        } else if (action.type === 'negate' && action.target && action.changes) {
            const key = Object.keys(action.changes)[0] || 'value';
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
            code = `${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)} := -${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)}; `;
        } else if (action.type === 'calculate' && action.resultVariable) {
            let expr = '';
            if (action.formula) {
                // Use the generated formula if available (it represents the runtime logic)
                expr = this.span(action.formula, '#ce9178', asHtml);
            } else if (action.calcSteps && action.calcSteps.length > 0) {
                expr = action.calcSteps.map((s: any, i: number) => {
                    let val = '';
                    if (s.operandType === 'variable') {
                        val = `${this.span(s.variable || '?', '#9cdcfe', asHtml)} `;
                    } else {
                        const constVal = s.constant;
                        if (typeof constVal === 'string') {
                            val = `${this.span("'" + constVal + "'", '#ce9178', asHtml)} `;
                        } else {
                            val = `${this.span((constVal ?? 0).toString(), '#b5cea8', asHtml)} `;
                        }
                    }
                    return (i === 0 || !s.operator) ? val : `${this.span(s.operator, '#d4d4d4', asHtml)} ${val} `;
                }).join(' ');
            }
            code = `${this.span(action.resultVariable, '#9cdcfe', asHtml)} := ${expr}; `;
        } else if (action.type === 'call_method' && action.target && action.method) {
            code = `${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(action.method, '#dcdcaa', asHtml)} (); `;
        } else if (action.type === 'navigate_stage') {
            code = `${this.span('Application', '#4ec9b0', asHtml)}.${this.span('GoToStage', '#dcdcaa', asHtml)} (${this.span("'" + (action.params?.stageId || action.target || '?') + "'", '#ce9178', asHtml)}); `;
        } else if (action.type === 'data_action') {
            const method = action.method || 'GET';
            const url = action.url || '';
            const resultVar = action.resultVariable ? `${this.span(action.resultVariable, '#9cdcfe', asHtml)} := ` : '';
            code = `${resultVar}${this.span('API', '#4ec9b0', asHtml)}.${this.span('DataAction', '#dcdcaa', asHtml)}('${method}', '${url}'); `;
        } else {
            // Generic fallback for any other type
            const typeLabel = action.type ? ` { ${action.type} } ` : '';
            code = `${this.span(actionName, '#dcdcaa', asHtml)} (); ${this.span(typeLabel, '#6a9955', asHtml)} `;
        }

        return code;
    }

    /**
     * Parses a full Pascal program and updates the GameProject
     * @param targetStage If provided, the parser will prioritize updating this stage's tasks/variables
     */
    public static parse(project: GameProject, code: string, targetStage?: any): void {
        console.log('[PascalGenerator] Parsing Pascal program...');

        const foundTasks: Set<string> = new Set();
        const foundVariables: Set<{ name: string, scope: string }> = new Set();
        const foundHandlers: Set<{ objectName: string, eventName: string, targetTask: string }> = new Set();

        // 1. Program Name
        const programMatch = code.match(/program\s+([a-zA-Z0-9_]+)\s*;/i);
        if (programMatch) {
            if (!project.meta) project.meta = { name: '', version: '1.0.0', author: 'User' };
            project.meta.name = programMatch[1].replace(/_/g, ' ');
        }

        // 2. Variables (Global & Task-Scoped)
        const codeBeforeFirstProc = code.split(/PROCEDURE/i)[0];
        const globalVarBlock = codeBeforeFirstProc.match(/VAR\s+({[\s\S]*?})?\s*([\s\S]*?)(?=BEGIN|PROCEDURE|$)/i);
        if (globalVarBlock) {
            this.parseVariables(project, globalVarBlock[2], 'global', foundVariables, targetStage);
        }

        // 3. Procedures (Tasks & Event Handlers)
        // Match both: 
        // - PROCEDURE TaskName(p1: type; ...);
        // - PROCEDURE ObjectName.EventName();
        const procedureRegex = /PROCEDURE\s+([a-zA-Z0-9_.]+)(?:\s*\(([\s\S]*?)\))?\s*;\s*(?:VAR\s+([\s\S]*?))?\s*BEGIN\s+([\s\S]*?)\s*END\s*;/gi;
        let procMatch;

        // Pre-parse: Collect all procedures from code to identify renames
        const codeTasks: Map<string, { params: string, varBlock: string, bodyBlock: string, signature: string }> = new Map();
        while ((procMatch = procedureRegex.exec(code)) !== null) {
            const ident = procMatch[1];
            const paramsStr = procMatch[2] || '';
            const varBlock = procMatch[3] || '';
            const bodyBlock = procMatch[4];

            if (ident.includes('.')) {
                const [objName, eventName] = ident.split('.');
                const callMatch = bodyBlock.match(/([a-zA-Z0-9_]+)\(\);/);
                if (callMatch) foundHandlers.add({ objectName: objName, eventName, targetTask: callMatch[1] });
            } else {
                const tempSeq = this.parseBodyToSequence(project, ident, bodyBlock, { count: 0 }, [], targetStage);
                codeTasks.set(ident, {
                    params: paramsStr,
                    varBlock: varBlock,
                    bodyBlock,
                    signature: this.getLogicSignature(tempSeq)
                });
            }
        }

        // Identify Renames and Updates
        const jsonTasks = [...(targetStage?.tasks || project.tasks || [])] as GameTask[];
        const matchedJsonTasks: Set<string> = new Set();

        codeTasks.forEach((codeData, taskName) => {
            foundTasks.add(taskName);

            // 1. Exact Match by Name
            let task = jsonTasks.find(t => t.name === taskName);
            if (task) {
                matchedJsonTasks.add(task.name);
            } else {
                // 2. Potential Rename: Match by Logic Signature
                const potentialOldTask = jsonTasks.find(t =>
                    !matchedJsonTasks.has(t.name) &&
                    !codeTasks.has(t.name) &&
                    this.getLogicSignature(t.actionSequence) === codeData.signature
                );

                if (potentialOldTask) {
                    console.log(`[PascalGenerator] Detected rename: ${potentialOldTask.name} -> ${taskName} `);
                    projectRegistry.renameTask(potentialOldTask.name, taskName);
                    task = potentialOldTask;
                    matchedJsonTasks.add(taskName);
                } else {
                    // 3. Truly New Task
                    task = { name: taskName, actionSequence: [] };
                    if (targetStage) {
                        if (!targetStage.tasks) targetStage.tasks = [];
                        targetStage.tasks.push(task);
                    } else {
                        project.tasks.push(task);
                    }
                }
            }

            // Update matched task
            if (task) {
                // Sync Parameters
                if (codeData.params) {
                    const paramPairs = codeData.params.split(';').filter((p: string) => p.trim());
                    task.params = paramPairs.map((pair: string) => {
                        const parts = pair.split(':').map((s: string) => s.trim());
                        return { name: parts[0], type: (parts[1] || 'string').toLowerCase() };
                    });
                } else {
                    delete task.params;
                }

                if (codeData.varBlock) {
                    this.parseVariables(project, codeData.varBlock, `task:${taskName} `, foundVariables, targetStage);
                }
                const oldSequence = task.actionSequence || [];
                const newSequence = this.parseBodyToSequence(project, taskName, codeData.bodyBlock, { count: 0 }, oldSequence, targetStage);

                if (JSON.stringify(oldSequence) !== JSON.stringify(newSequence)) {
                    console.log(`[PascalGenerator] Task "${taskName}" updated.Invalidating FlowChart.`);
                    task.actionSequence = newSequence;
                    if (targetStage?.flowCharts?.[taskName]) delete targetStage.flowCharts[taskName];
                    if (project.flowCharts?.[taskName]) delete project.flowCharts[taskName];
                }
            }
        });

        // 4. Update Event Handlers on Objects
        const stageToUse = targetStage || project.stages?.find(s => s.type === 'main');
        if (stageToUse && stageToUse.objects) {
            foundHandlers.forEach(h => {
                const obj = stageToUse.objects.find((o: any) => o.name === h.objectName);
                if (obj) {
                    if (!obj.Tasks) obj.Tasks = {};
                    obj.Tasks[h.eventName] = h.targetTask;
                }
            });
        }

        // 4b. Update Event Handlers on Variables
        // Variables can be global or in targetStage
        const targetVariables = [
            ...(targetStage?.variables || []),
            ...(project.variables || [])
        ];

        if (targetVariables.length > 0) {
            foundHandlers.forEach(h => {
                // Try to find a variable matching the objectName (which is VarName in this case)
                const variable = targetVariables.find((v: any) => v.name === h.objectName);
                if (variable) {
                    // Check if it's a known variable event (generic check)
                    if (h.eventName.startsWith('on') && h.eventName.length > 2) {
                        (variable as any)[h.eventName] = h.targetTask;
                    }
                }
            });
        }

        // 5. Synchronize Collections (CLEVER deletion)
        // Only delete tasks that were "supposed" to be in this code block
        if (!targetStage) {
            // Global view: We can safely delete global orphans
            project.tasks = project.tasks.filter(t => foundTasks.has(t.name));
        } else {
            // Stage view: Only delete tasks from targetStage that aren't in code
            if (targetStage.tasks) {
                targetStage.tasks = targetStage.tasks.filter((t: any) => foundTasks.has(t.name));
            }
            // Do NOT delete project.tasks here, as they might not be visible in isolated view
        }

        // Handle variables similarly... (omitted for brevity in first pass or implemented robustly)
        // For now, let's keep variables as is to avoid accidental loss of global vars

        console.log('[PascalGenerator] Parser finished updating project.');
    }

    private static parseVariables(project: GameProject, block: string, scope: string, foundSet: Set<{ name: string, scope: string }>, targetStage?: any) {
        const varRegex = /([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_]+)\s*;/gi;
        let match;
        while ((match = varRegex.exec(block)) !== null) {
            const name = match[1];
            const type = match[2].toLowerCase() as any;
            foundSet.add({ name, scope });

            // Find existing variable (in Stage OR Global)
            let variable = (targetStage?.variables?.find((v: any) => v.name === name && (v.scope || 'global') === scope)) ||
                project.variables.find(v => v.name === name && (v.scope || 'global') === scope);

            if (!variable) {
                const newVar: ProjectVariable = {
                    name,
                    type,
                    defaultValue: '',
                    scope: scope as VariableScope
                };
                if (targetStage) {
                    if (!targetStage.variables) targetStage.variables = [];
                    targetStage.variables.push(newVar);
                } else {
                    project.variables.push(newVar);
                }
            } else {
                variable.type = type;
            }
        }
    }

    private static parseBodyToSequence(project: GameProject, taskName: string, body: string, actionCounter: { count: number } = { count: 0 }, oldSequence: SequenceItem[] = [], targetStage?: any): SequenceItem[] {
        // Instead of line by line, let's look for tokens
        const tokens = body.split(/(\bBEGIN\b|\bEND\b|\bIF\b|\bTHEN\b|\bELSE\b|\bWHILE\b|\bDO\b|\bFOR\b|\bTO\b|\bIN\b|;)/i);

        let i = 0;
        const consumeUntil = (targetToken: string): string => {
            let content = '';
            while (i < tokens.length && tokens[i].toUpperCase() !== targetToken) {
                content += tokens[i];
                i++;
            }
            return content;
        };

        const parseBlock = (oldSubSeq: SequenceItem[] = []): SequenceItem[] => {
            const blockSequence: SequenceItem[] = [];
            let itemIndex = 0;
            while (i < tokens.length) {
                let token = tokens[i].trim();
                let upperToken = token.toUpperCase();

                if (upperToken === 'END') {
                    i++; // consume END
                    break;
                }

                if (upperToken === 'IF') {
                    i++; // consume IF
                    const conditionStr = consumeUntil('THEN');
                    i++; // consume THEN

                    const oldItem = oldSubSeq[itemIndex];
                    let item: SequenceItem;

                    // CHECK FOR DataAction in Condition
                    const dataActionMatch = conditionStr.match(/(?:([a-zA-Z0-9_]+)\s*:=\s*)?API\.DataAction\('([^']+)',\s*'([^']+)'\)/i);
                    if (dataActionMatch) {
                        const resultVar = dataActionMatch[1];
                        const method = dataActionMatch[2];
                        const url = dataActionMatch[3];

                        item = {
                            type: 'data_action',
                            name: oldItem && oldItem.type === 'data_action' ? oldItem.name : `data_${actionCounter.count++}`,
                            method,
                            url,
                            resultVariable: resultVar || undefined
                        } as any;

                        if (tokens[i]?.trim().toUpperCase() === 'BEGIN') {
                            i++; // consume BEGIN
                            (item as any).successBody = parseBlock((oldItem as any)?.successBody || []);
                        } else {
                            // Single line then
                            const nextLine = consumeUntil(';');
                            i++; // consume ;
                            const callName = nextLine.trim().replace('();', '');
                            if (callName) (item as any).thenAction = callName;
                        }

                        // Check for ELSE
                        if (tokens[i]?.trim().toUpperCase() === 'ELSE') {
                            i++; // consume ELSE
                            if (tokens[i]?.trim().toUpperCase() === 'BEGIN') {
                                i++; // consume BEGIN
                                (item as any).errorBody = parseBlock((oldItem as any)?.errorBody || []);
                            } else {
                                const nextLine = consumeUntil(';');
                                i++; // consume ;
                                const callName = nextLine.trim().replace('();', '');
                                if (callName) (item as any).elseAction = callName;
                            }
                        }
                    } else {
                        item = {
                            type: 'condition',
                            name: oldItem && oldItem.type === 'condition' ? oldItem.name : `if_${actionCounter.count++} `,
                            condition: this.parseCondition(conditionStr.trim())
                        };

                        if (tokens[i]?.trim().toUpperCase() === 'BEGIN') {
                            i++; // consume BEGIN
                            item.body = parseBlock(oldItem && oldItem.body ? oldItem.body : []);
                        } else {
                            // Single line then? Support only simple calls for now in single line IF
                            const nextLine = consumeUntil(';');
                            i++; // consume ;
                            const callName = nextLine.trim().replace('();', '');
                            if (callName) {
                                item.thenAction = callName;
                            }
                        }

                        // Check for ELSE
                        if (tokens[i]?.trim().toUpperCase() === 'ELSE') {
                            i++; // consume ELSE
                            if (tokens[i]?.trim().toUpperCase() === 'BEGIN') {
                                i++; // consume BEGIN
                                const elseBody = parseBlock((oldItem as any)?.elseBody || []);
                                // In our model, condition usually has thenAction, thenTask, elseAction, elseTask, body.
                                // We use 'body' for the 'then' branch if it's a block.
                                (item as any).elseBody = elseBody;
                            }
                        }
                    }

                    blockSequence.push(item);
                    itemIndex++;
                } else if (upperToken === 'WHILE') {
                    i++; // consume WHILE
                    const conditionStr = consumeUntil('DO');
                    i++; // consume DO
                    const oldItem = oldSubSeq[itemIndex];
                    const item: SequenceItem = {
                        type: 'while',
                        name: oldItem && oldItem.type === 'while' ? oldItem.name : `while_${actionCounter.count++} `,
                        condition: this.parseCondition(conditionStr.trim())
                    };
                    if (tokens[i]?.trim().toUpperCase() === 'BEGIN') {
                        i++; // consume BEGIN
                        item.body = parseBlock(oldItem && oldItem.body ? oldItem.body : []);
                    }
                    blockSequence.push(item);
                    itemIndex++;
                } else if (upperToken === 'FOR') {
                    i++; // consume FOR
                    const forHeader = consumeUntil('DO');
                    i++; // consume DO

                    const oldItem = oldSubSeq[itemIndex];
                    const item: SequenceItem = {
                        type: 'for',
                        name: oldItem && oldItem.type === 'for' ? oldItem.name : `for_${actionCounter.count++} `
                    };
                    // Parse: iterator := start TO end
                    const forMatch = forHeader.match(/([a-zA-Z0-9_]+)\s*:=\s*([0-9]+)\s+TO\s+([0-9]+)/i);
                    if (forMatch) {
                        item.iteratorVar = forMatch[1];
                        item.from = parseInt(forMatch[2]);
                        item.to = parseInt(forMatch[3]);
                    } else {
                        // Check for FOREACH: item IN list
                        const inMatch = forHeader.match(/([a-zA-Z0-9_]+)\s+IN\s+([a-zA-Z0-9_]+)/i);
                        if (inMatch) {
                            item.type = 'foreach';
                            item.itemVar = inMatch[1];
                            item.sourceArray = inMatch[2];
                        }
                    }

                    if (tokens[i]?.trim().toUpperCase() === 'BEGIN') {
                        i++; // consume BEGIN
                        item.body = parseBlock(oldItem && oldItem.body ? oldItem.body : []);
                    }
                    blockSequence.push(item);
                    itemIndex++;
                } else if (token === ';') {
                    i++;
                } else if (token.trim() && !['BEGIN'].includes(upperToken)) {
                    // Try to parse as assignment or call
                    const statement = consumeUntil(';');
                    i++; // consume ;
                    const cleanStatement = statement.trim();
                    if (cleanStatement) {
                        const oldItem = oldSubSeq[itemIndex];

                        const parsed = this.parseSimpleStatement(project, taskName, cleanStatement, actionCounter.count++, oldItem, targetStage);
                        if (parsed) {
                            blockSequence.push(parsed);
                            itemIndex++;
                        }
                    }
                } else {
                    i++;
                }
            }
            return blockSequence;
        };

        return parseBlock(oldSequence);
    }

    private static parseCondition(condStr: string): any {
        const match = condStr.match(/([a-zA-Z0-9_.]+)\s*(=|<>|<|>|<=|>=)\s*(.+)/);
        if (match) {
            let val: any = match[3].trim();
            if (val.startsWith("'") && val.endsWith("'")) {
                val = val.substring(1, val.length - 1);
            } else if (!isNaN(Number(val))) {
                val = Number(val);
            }
            return {
                variable: match[1],
                operator: match[2] === '=' ? '==' : (match[2] === '<>' ? '!=' : match[2]),
                value: val
            };
        }
        return { variable: condStr, operator: '==', value: true };
    }

    public static getLogicSignature(sequence: SequenceItem[]): string {
        if (!sequence || sequence.length === 0) return 'empty';

        return sequence.map(item => {
            const anyItem = item as any;
            let part = `[${item.type}]`;
            if (item.type === 'action') {
                const anyAction = item as any;
                // Include target and sorted property keys
                const keys = Object.keys(anyAction.changes || {}).sort().join(',');
                part += `:${anyAction.target}:${keys} `;
            } else if (item.type === 'task') {
                part += `:${item.name} `;
            } else if (item.type === 'condition' || item.type === 'while') {
                // Include condition structure and branches
                const branchA = anyItem.thenTask || anyItem.thenAction || '';
                const branchB = anyItem.elseTask || anyItem.elseAction || '';
                part += `:${branchA}| ${branchB} `;
                if (anyItem.body) {
                    part += `{${this.getLogicSignature(anyItem.body)} } `;
                }
            }
            return part;
        }).join(';');
    }

    private static getPreferredCasing(project: GameProject, propName: string, targetStage?: any): string {
        const searchString = propName.toLowerCase();

        // 1. Search in targetStage.actions matching the target property name
        if (targetStage && targetStage.actions) {
            for (const action of targetStage.actions) {
                if (action.changes) {
                    const key = Object.keys(action.changes).find(k => k.toLowerCase() === searchString);
                    if (key) return key;
                }
            }
        }

        // 2. Search in project.actions
        for (const action of project.actions) {
            const anyAction = action as any;
            if (anyAction.changes) {
                const key = Object.keys(anyAction.changes).find(k => k.toLowerCase() === searchString);
                if (key) return key;
            }
        }

        // 3. Fallback to lowercase (standard for engine)
        return searchString;
    }

    private static parseSimpleStatement(project: GameProject, taskName: string, statement: string, index: number, oldItem?: SequenceItem, targetStage?: any): SequenceItem | null {
        // Assignment
        const assignMatch = statement.match(/^([a-zA-Z0-9_.]+)\s*:=\s*(.+)$/);
        if (assignMatch) {
            const target = assignMatch[1];
            let source = assignMatch[2].trim();

            let val: any = source;
            if (source.startsWith("'") && source.endsWith("'")) {
                val = source.slice(1, -1);
            } else if (/^\d+(\.\d+)?$/.test(source)) {
                val = parseFloat(source);
            } else if (source.toLowerCase() === 'true') {
                val = true;
            } else if (source.toLowerCase() === 'false') {
                val = false;
            } else if (/^[a-zA-Z0-9_$]+$/.test(source)) {
                // Variable name reference
                val = `\${${source}}`;
            }

            if (target.includes('.')) {
                // Property change: Object.Property := Value
                const parts = target.split('.');
                const objName = parts[0];
                const propName = parts[1];

                // FIND EXISTING ACTION CANDIDATE
                // 1. Try to use oldItem if it was a property action on the same target
                let action: any = null;
                if (oldItem && oldItem.type === 'action') {
                    const candidate = (targetStage?.actions || project.actions || []).find((a: any) => a.name === oldItem.name);
                    if (candidate && candidate.type === 'property' && candidate.target.toLowerCase() === objName.toLowerCase()) {
                        action = candidate;
                    }
                }

                // 2. If no oldItem match, look for ANY action with same target and property (case-insensitive)
                if (!action) {
                    action = (targetStage?.actions || project.actions || []).find((a: any) =>
                        a.type === 'property' && a.target.toLowerCase() === objName.toLowerCase() && (a.changes && Object.keys(a.changes).some(k => k.toLowerCase() === propName.toLowerCase()))
                    );
                }

                // 3. Fallback: Create new action name
                const actionName = action ? action.name : `${taskName}_action_${index}`;

                if (!action) {
                    action = { name: actionName, type: 'property', target: objName, changes: {} };
                    if (targetStage) {
                        if (!targetStage.actions) targetStage.actions = [];
                        targetStage.actions.push(action);
                    } else {
                        project.actions.push(action);
                    }
                }

                // Update or add property change
                action.type = 'property';
                action.target = objName;
                // Smart-Sync: Nutze die projektweit bevorzugte Schreibweise (z.B. fillColor)
                // oder einen bereits in DIESER Action existierenden Key
                if (!action.changes) action.changes = {};
                const existingInAction = Object.keys(action.changes).find(k => k.toLowerCase() === propName.toLowerCase());
                const finalKey = existingInAction || this.getPreferredCasing(project, propName, targetStage);

                action.changes[finalKey] = val;

                return { type: 'action', name: actionName };
            } else {
                // Variable assignment: Var := Value
                // FIND EXISTING CALCULATE CANDIDATE
                let action: any = null;
                if (oldItem && oldItem.type === 'action') {
                    const candidate = (targetStage?.actions || project.actions || []).find((a: any) => a.name === oldItem.name);
                    if (candidate && candidate.type === 'calculate' && candidate.resultVariable.toLowerCase() === target.toLowerCase()) {
                        action = candidate;
                    }
                }

                const actionName = action ? action.name : `${taskName}_action_${index}`;

                // Try to parse basic expression (A + B + C)
                // We support +, -, *, /, % for calcSteps
                const parts = source.split(/(\+|-|\*|\/|%)/);
                const calcSteps: any[] = [];
                let formula = '';

                for (let j = 0; j < parts.length; j++) {
                    const part = parts[j].trim();
                    if (!part) continue;

                    if (['+', '-', '*', '/', '%'].includes(part)) {
                        if (calcSteps.length > 0) {
                            calcSteps[calcSteps.length - 1].nextOperator = part; // Temp storage if needed, but our model uses operator on the NEXT step
                        }
                        formula += ` ${part} `;
                    } else {
                        const isNumeric = /^\d+(\.\d+)?$/.test(part);
                        const isQuoted = (part.startsWith("'") && part.endsWith("'")) || (part.startsWith('"') && part.endsWith('"'));
                        let val: any = part;
                        if (isQuoted) val = part.slice(1, -1);
                        else if (isNumeric) val = parseFloat(part);

                        const step: any = {
                            operandType: isNumeric || isQuoted ? 'constant' : 'variable',
                            constant: isNumeric || isQuoted ? val : undefined,
                            variable: isNumeric || isQuoted ? undefined : val
                        };

                        // If NOT the first step, we need the operator from the previous loop iteration
                        if (calcSteps.length > 0) {
                            const prevOp = parts[j - 1]?.trim();
                            if (['+', '-', '*', '/', '%'].includes(prevOp)) {
                                step.operator = prevOp;
                            } else {
                                step.operator = '+'; // Fallback
                            }
                        }

                        calcSteps.push(step);
                        formula += isQuoted ? `"${val}"` : (isNumeric ? val : val);
                    }
                }

                if (!action) {
                    action = { name: actionName, type: 'calculate', resultVariable: target, calcSteps: calcSteps, formula: formula };
                    if (targetStage) {
                        if (!targetStage.actions) targetStage.actions = [];
                        targetStage.actions.push(action);
                    } else {
                        project.actions.push(action);
                    }
                } else {
                    action.type = 'calculate';
                    action.resultVariable = target;
                    action.calcSteps = calcSteps;
                    action.formula = formula;
                }
                return { type: 'action', name: actionName };
            }
        }

        // Call (either Task or Action)
        if (statement.endsWith('()')) {
            const callName = statement.replace('()', '');

            // Check if it's a Task (Global or Stage-Local)
            const isTask = project.tasks.some(t => t.name === callName) || (targetStage?.tasks?.some((t: any) => t.name === callName));

            return {
                type: isTask ? 'task' : 'action',
                name: callName
            };
        }

        return null;
    }
}
