import { GameProject, SequenceItem, ProjectVariable, VariableScope } from '../model/types';

export class PascalGenerator {
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
        const progName = (project.meta && project.meta.name) ? project.meta.name.replace(/\s+/g, '_') : 'GameBuilderProject';
        const suffix = activeStage ? `_${activeStage.name.replace(/\s+/g, '_')}` : '';
        lines.push(`${this.span('PROGRAM', '#c586c0', asHtml)} ${this.span(progName + suffix, '#dcdcaa', asHtml)};`);
        lines.push('');
        lines.push(`${this.span('USES', '#c586c0', asHtml)} crt; ${this.span('{ Standard libraries }', '#6a9955', asHtml)}`);
        lines.push('');

        // Global Variables (Always global, unless we want stage locals?)
        // For now, keep project globals available
        const globalVars = (project.variables || []).filter(v => !v.scope || v.scope === 'global');
        if (globalVars.length > 0) {
            lines.push(`${this.span('VAR', '#c586c0', asHtml)} ${this.span('{ GLOBAL VARIABLES }', '#6a9955', asHtml)}`);
            globalVars.forEach(v => {
                const pascalType = (v.type || 'string').charAt(0).toUpperCase() + (v.type || 'string').slice(1);
                lines.push(`  ${this.span(v.name, '#9cdcfe', asHtml)}: ${this.span(pascalType, '#4ec9b0', asHtml)}; ${this.span(`// Default: ${v.defaultValue ?? 'nil'}`, '#6a9955', asHtml)}`);
            });
            lines.push('');
        }

        // Procedures (Tasks)
        // Filter tasks if activeStage is provided
        let tasks = project.tasks || [];
        if (activeStage) {
            const stageTasks = new Set<string>();

            // 1. Explicitly defined in stage flowCharts
            if (activeStage.flowCharts) {
                Object.keys(activeStage.flowCharts).forEach(key => stageTasks.add(key));
            }

            // 2. Used by objects in this stage
            const stageObjects = activeStage.objects || [];
            stageObjects.forEach((obj: any) => {
                if (obj.Tasks) {
                    Object.values(obj.Tasks).forEach((t: any) => stageTasks.add(t));
                }
            });

            // 3. Keep Global Flow tasks only if Main stage or explicitly used?
            // "Global" in flowCharts means visible everywhere, but strictly speaking,
            // if we are in Splash, we only care about Splash stuff.
            // Let's stick to: Show tasks RELEVANT to this stage.
            if (activeStage.type === 'main') {
                // Main stage sees everything usually, or just globals + main specific?
                // For simplicity, let's say Main sees everything for now, OR filter if we had explicit main tasks.
                // But tasks array is flat in project. 
                // Fallback: If no filtering logic, show all.
                // Better: Only show tasks used by objects present in this stage + globals
            }

            // Refined Logic:
            // Include task if:
            // - It is in activeStage.flowCharts
            // - OR it is used by an object in activeStage.objects
            // - OR it is a global task (only if activeStage is Main?) -> Let's show all for now on Main, 
            // but strict for others.

            if (activeStage.type !== 'main') {
                tasks = tasks.filter(t => stageTasks.has(t.name));
            }
        }

        if (tasks.length > 0) {
            tasks.forEach(task => {
                // Pass activeStageObjects to generateProcedure for "Used by" comments?
                // For now just generate code
                lines.push(this.generateProcedure(project, task.name, 0, undefined, asHtml, activeStage ? activeStage.objects : undefined));
                lines.push('');
            });
        } else {
            lines.push(`${this.span('{ NO TASKS DEFINED FOR THIS STAGE }', '#6a9955', asHtml)}`);
            lines.push('');
        }

        // Main Program
        lines.push(`${this.span('BEGIN', '#c586c0', asHtml)} ${this.span('{ Main Program Entry Point }', '#6a9955', asHtml)}`);
        lines.push(`  ${this.span('clrscr', '#dcdcaa', asHtml)};`);

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
                lines.push(`  ${this.span(taskName, '#dcdcaa', asHtml)}(); ${this.span('{ Triggered by onStart }', '#6a9955', asHtml)}`);
            });
        } else {
            lines.push(`  ${this.span('// No onStart tasks defined', '#6a9955', asHtml)}`);
        }

        lines.push(`${this.span('END', '#c586c0', asHtml)}.`);

        return lines.join('\n');
    }

    /**
     * Generates a single Pascal procedure for a task
     */
    public static generateProcedure(project: GameProject, taskName: string, indent: number = 0, sequenceOverride?: SequenceItem[], asHtml: boolean = true, sourceObjects?: any[]): string {
        const task = project.tasks.find(t => t.name === taskName);
        const sequence = sequenceOverride || task?.actionSequence || [];

        const lines: string[] = [];
        const space = ' '.repeat(indent);

        // Header with Usage Comments
        const users = (sourceObjects || project.objects).filter(obj => {
            const tasksMap = (obj as any).Tasks || {};
            return Object.values(tasksMap).includes(taskName);
        }).map(obj => obj.name);

        if (users.length > 0) {
            lines.push(`${space}${this.span('{ Used by: ' + users.join(', ') + ' }', '#6a9955', asHtml)}`);
        }

        lines.push(`${space}${this.span('PROCEDURE', '#c586c0', asHtml)} ${this.span(taskName, '#dcdcaa', asHtml)};`);

        // VAR Section (Task Scoped)
        const taskVars = project.variables.filter(v => (v.scope || '').toLowerCase() === taskName.toLowerCase());
        if (taskVars.length > 0) {
            lines.push(`${space}${this.span('VAR', '#c586c0', asHtml)}`);
            taskVars.forEach(v => {
                const typeStr = v.type || 'string';
                const pascalType = typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
                lines.push(`${space}  ${this.span(v.name, '#9cdcfe', asHtml)}: ${this.span(pascalType, '#4ec9b0', asHtml)};`);
            });
        }

        // BEGIN Section
        lines.push(`${space}${this.span('BEGIN', '#c586c0', asHtml)}`);

        // Recursively render sequence
        this.renderSequenceToPascal(project, sequence, lines, indent + 2, asHtml);

        // END Section
        lines.push(`${space}${this.span('END', '#c586c0', asHtml)};`);

        return lines.join('\n');
    }

    private static renderSequenceToPascal(project: GameProject, sequence: SequenceItem[], lines: string[], indent: number, asHtml: boolean) {
        const space = ' '.repeat(indent);

        if (sequence.length === 0) {
            lines.push(`${space}${this.span('// Empty sequence', '#6a9955', asHtml)}`);
            return;
        }

        sequence.forEach(item => {
            if (item.type === 'action' || !item.type) {
                lines.push(`${space}${this.getActionPascalCode(project, item.name, asHtml)}`);
            } else if (item.type === 'task') {
                lines.push(`${space}${this.span(item.name, '#dcdcaa', asHtml)}; ${this.span('// Task Call', '#6a9955', asHtml)}`);
            } else if (item.type === 'condition') {
                const cond = item.condition;
                if (cond) {
                    const op = cond.operator === '==' ? '=' : (cond.operator === '!=' ? '<>' : cond.operator);
                    const isString = typeof cond.value === 'string';
                    const val = isString ? ("'" + cond.value + "'") : cond.value;
                    const valColor = isString ? '#ce9178' : '#b5cea8'; // Orange for strings, green for numbers
                    let sysVarComment = '';
                    if (cond.variable === 'hitSide') sysVarComment = ` ${this.span('{ System variable: side of collision/boundary }', '#6a9955', asHtml)}`;
                    if (cond.variable === 'direction') sysVarComment = ` ${this.span('{ System variable: move direction (up/down) }', '#6a9955', asHtml)}`;

                    lines.push(`${space}${this.span('IF', '#c586c0', asHtml)} ${this.span(cond.variable, '#9cdcfe', asHtml)} ${op} ${this.span(val.toString(), valColor, asHtml)} ${this.span('THEN', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)}${sysVarComment}`);

                    // Then branch
                    if (item.thenAction) {
                        lines.push(`${space}  ${this.getActionPascalCode(project, item.thenAction, asHtml)}`);
                    } else if (item.thenTask) {
                        lines.push(`${space}  ${this.span(item.thenTask, '#dcdcaa', asHtml)};`);
                    } else if (item.body) {
                        this.renderSequenceToPascal(project, item.body, lines, indent + 2, asHtml);
                    }

                    lines.push(`${space}${this.span('END', '#c586c0', asHtml)}`);

                    if (item.elseAction || item.elseTask) {
                        lines.push(`${space}${this.span('ELSE', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)}`);
                        if (item.elseAction) {
                            lines.push(`${space}  ${this.getActionPascalCode(project, item.elseAction, asHtml)}`);
                        } else if (item.elseTask) {
                            lines.push(`${space}  ${this.span(item.elseTask, '#dcdcaa', asHtml)};`);
                        }
                        lines.push(`${space}${this.span('END', '#c586c0', asHtml)};`);
                    } else {
                        lines[lines.length - 1] += ';';
                    }
                }
            } else if (item.type === 'while') {
                const cond = item.condition;
                if (cond) {
                    const op = cond.operator === '==' ? '=' : (cond.operator === '!=' ? '<>' : cond.operator);
                    const isString = typeof cond.value === 'string';
                    const val = isString ? ("'" + cond.value + "'") : cond.value;
                    const valColor = isString ? '#ce9178' : '#b5cea8';
                    lines.push(`${space}${this.span('WHILE', '#c586c0', asHtml)} ${this.span(cond.variable, '#9cdcfe', asHtml)} ${op} ${this.span(val.toString(), valColor, asHtml)} ${this.span('DO', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)}`);
                    if (item.body) {
                        this.renderSequenceToPascal(project, item.body, lines, indent + 2, asHtml);
                    }
                    lines.push(`${space}${this.span('END', '#c586c0', asHtml)};`);
                }
            } else if (item.type === 'for') {
                lines.push(`${space}${this.span('FOR', '#c586c0', asHtml)} ${this.span(item.iteratorVar || 'i', '#9cdcfe', asHtml)} := ${this.span((item.from ?? 0).toString(), '#b5cea8', asHtml)} ${this.span('TO', '#c586c0', asHtml)} ${this.span((item.to ?? 10).toString(), '#b5cea8', asHtml)} ${this.span('DO', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)}`);
                if (item.body) {
                    this.renderSequenceToPascal(project, item.body, lines, indent + 2, asHtml);
                }
                lines.push(`${space}${this.span('END', '#c586c0', asHtml)};`);
            } else if (item.type === 'foreach') {
                lines.push(`${space}${this.span('FOR', '#c586c0', asHtml)} ${this.span(item.itemVar || 'item', '#9cdcfe', asHtml)} ${this.span('IN', '#c586c0', asHtml)} ${this.span(item.sourceArray || 'list', '#9cdcfe', asHtml)} ${this.span('DO', '#c586c0', asHtml)} ${this.span('BEGIN', '#c586c0', asHtml)}`);
                if (item.body) {
                    this.renderSequenceToPascal(project, item.body, lines, indent + 2, asHtml);
                }
                lines.push(`${space}${this.span('END', '#c586c0', asHtml)};`);
            }
        });
    }

    private static getActionPascalCode(project: GameProject, actionName: string, asHtml: boolean): string {
        const action = project.actions.find(a => a.name === actionName);
        if (!action) return `${this.span(actionName, '#dcdcaa', asHtml)}();`;

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
                    parts.push(`${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)} := ${this.span(valStr, color, asHtml)};`);
                }
                code = parts.join('\n'); // Note: This might need adjustment if used in single line IF
            } else {
                code = `${this.span(actionName, '#dcdcaa', asHtml)}();`;
            }
        } else if (action.type === 'service' && action.service && action.method) {
            const resultPart = action.resultVariable ? `${this.span(action.resultVariable, '#9cdcfe', asHtml)} := ` : '';
            code = `${resultPart}${this.span(action.service, '#4ec9b0', asHtml)}.${this.span(action.method, '#dcdcaa', asHtml)}();`;
        } else if (action.type === 'variable' && action.variableName) {
            const capitalizedProp = action.sourceProperty ? action.sourceProperty.charAt(0).toUpperCase() + action.sourceProperty.slice(1) : '';
            code = `${this.span(action.variableName, '#9cdcfe', asHtml)} := ${this.span(action.source || '', '#9cdcfe', asHtml)}.${this.span(capitalizedProp, '#9cdcfe', asHtml)};`;
        } else if (action.type === 'increment' && action.target && action.changes) {
            const key = Object.keys(action.changes)[0] || 'value';
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
            const amount = action.changes[key] || 1;
            code = `${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)} := ${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)} + ${this.span(amount.toString(), '#b5cea8', asHtml)};`;
        } else if (action.type === 'negate' && action.target && action.changes) {
            const key = Object.keys(action.changes)[0] || 'value';
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
            code = `${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)} := -${this.span(action.target, '#9cdcfe', asHtml)}.${this.span(capitalizedKey, '#9cdcfe', asHtml)};`;
        } else if (action.type === 'calculate' && action.resultVariable) {
            let expr = '';
            if (action.calcSteps && action.calcSteps.length > 0) {
                expr = action.calcSteps.map((s: any, i: number) => {
                    const val = s.operandType === 'variable'
                        ? `${this.span(s.variable || '?', '#9cdcfe', asHtml)}`
                        : `${this.span((s.constant ?? 0).toString(), '#b5cea8', asHtml)}`;
                    return (i === 0 || !s.operator) ? val : `${this.span(s.operator, '#d4d4d4', asHtml)} ${val}`;
                }).join(' ');
            }
            code = `${this.span(action.resultVariable, '#9cdcfe', asHtml)} := ${expr};`;
        } else {
            code = `${this.span(actionName, '#dcdcaa', asHtml)}();`;
        }

        return code;
    }

    /**
     * Parses a full Pascal program and updates the GameProject
     */
    public static parse(project: GameProject, code: string): void {
        console.log('[PascalGenerator] Parsing Pascal program...');

        const foundTasks: Set<string> = new Set();
        const foundVariables: Set<{ name: string, scope: string }> = new Set();

        // 1. Program Name
        const programMatch = code.match(/program\s+([a-zA-Z0-9_]+)\s*;/i);
        if (programMatch) {
            if (!project.meta) project.meta = { name: '', version: '1.0.0', author: 'User' };
            project.meta.name = programMatch[1].replace(/_/g, ' ');
        }

        // 2. Global Variables
        // Only look for global variables BEFORE any PROCEDURE declaration
        const codeBeforeFirstProc = code.split(/PROCEDURE/i)[0];
        const globalVarBlock = codeBeforeFirstProc.match(/VAR\s+({ GLOBAL VARIABLES }|{ GLOBALVARS })?\s*([\s\S]*?)(?=BEGIN|$)/i);
        if (globalVarBlock) {
            this.parseVariables(project, globalVarBlock[2], 'global', foundVariables);
        }

        // 3. Procedures (Tasks)
        const procedureRegex = /PROCEDURE\s+([a-zA-Z0-9_]+)\s*;\s*(?:VAR\s+([\s\S]*?))?\s*BEGIN\s+([\s\S]*?)\s*END\s*;/gi;
        let procMatch;
        while ((procMatch = procedureRegex.exec(code)) !== null) {
            const taskName = procMatch[1];
            const varBlock = procMatch[2];
            const bodyBlock = procMatch[3];
            foundTasks.add(taskName);

            let task = project.tasks.find(t => t.name === taskName);
            if (!task) {
                task = { name: taskName, actionSequence: [] };
                project.tasks.push(task);
            }

            // Parse task variables
            if (varBlock) {
                this.parseVariables(project, varBlock, taskName, foundVariables);
            }

            // Parse body into sequence
            task.actionSequence = this.parseBodyToSequence(project, taskName, bodyBlock);
        }

        // 4. Synchronize Collections (Delete orphans)
        // Remove tasks not found in code
        project.tasks = project.tasks.filter(t => foundTasks.has(t.name));

        // Remove variables not found in code
        project.variables = project.variables.filter(v => {
            const vScope = v.scope || 'global';
            const found = Array.from(foundVariables).some(fv => fv.name === v.name && fv.scope === vScope);
            if (!found && vScope !== 'global') {
                console.log(`[PascalGenerator] Removing orphaned variable: ${v.name} (scope: ${vScope})`);
            }
            return found || vScope === 'global'; // Keep globals for now unless explicitly deleted
        });

        console.log('[PascalGenerator] Parser finished updating project.');
    }

    private static parseVariables(project: GameProject, block: string, scope: string, foundSet: Set<{ name: string, scope: string }>) {
        const varRegex = /([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_]+)\s*;/gi;
        let match;
        while ((match = varRegex.exec(block)) !== null) {
            const name = match[1];
            const type = match[2].toLowerCase() as any;
            foundSet.add({ name, scope });

            let variable = project.variables.find(v => v.name === name && (v.scope || 'global') === scope);
            if (!variable) {
                const newVar: ProjectVariable = {
                    name,
                    type,
                    defaultValue: '',
                    scope: scope as VariableScope
                };
                project.variables.push(newVar);
            } else {
                variable.type = type;
            }
        }
    }

    private static parseBodyToSequence(project: GameProject, taskName: string, body: string, actionCounter: { count: number } = { count: 0 }): SequenceItem[] {
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

        const parseBlock = (): SequenceItem[] => {
            const blockSequence: SequenceItem[] = [];
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

                    const item: SequenceItem = {
                        type: 'condition',
                        name: `if_${actionCounter.count++}`,
                        condition: this.parseCondition(conditionStr.trim())
                    };

                    if (tokens[i]?.trim().toUpperCase() === 'BEGIN') {
                        i++; // consume BEGIN
                        item.body = parseBlock();
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
                            const elseBody = parseBlock();
                            // In our model, condition usually has thenAction, thenTask, elseAction, elseTask, body.
                            // We use 'body' for the 'then' branch if it's a block.
                            (item as any).elseBody = elseBody;
                        }
                    }

                    blockSequence.push(item);
                } else if (upperToken === 'WHILE') {
                    i++; // consume WHILE
                    const conditionStr = consumeUntil('DO');
                    i++; // consume DO
                    const item: SequenceItem = {
                        type: 'while',
                        name: `while_${actionCounter.count++}`,
                        condition: this.parseCondition(conditionStr.trim())
                    };
                    if (tokens[i]?.trim().toUpperCase() === 'BEGIN') {
                        i++; // consume BEGIN
                        item.body = parseBlock();
                    }
                    blockSequence.push(item);
                } else if (upperToken === 'FOR') {
                    i++; // consume FOR
                    const forHeader = consumeUntil('DO');
                    i++; // consume DO

                    const item: SequenceItem = {
                        type: 'for',
                        name: `for_${actionCounter.count++}`
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
                        item.body = parseBlock();
                    }
                    blockSequence.push(item);
                } else if (token === ';') {
                    i++;
                } else if (token.trim() && !['BEGIN'].includes(upperToken)) {
                    // Try to parse as assignment or call
                    const statement = consumeUntil(';');
                    i++; // consume ;
                    const cleanStatement = statement.trim();
                    if (cleanStatement) {
                        const parsed = this.parseSimpleStatement(project, taskName, cleanStatement, actionCounter.count++);
                        if (parsed) blockSequence.push(parsed);
                    }
                } else {
                    i++;
                }
            }
            return blockSequence;
        };

        return parseBlock();
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

    private static parseSimpleStatement(project: GameProject, taskName: string, statement: string, index: number): SequenceItem | null {
        // Assignment
        const assignMatch = statement.match(/^([a-zA-Z0-9_.]+)\s*:=\s*(.+)$/);
        if (assignMatch) {
            const target = assignMatch[1];
            let source = assignMatch[2].trim();
            const actionName = `${taskName}_action_${index}`;

            if (target.includes('.')) {
                const parts = target.split('.');
                const objName = parts[0];
                const propName = parts[1];
                let action = project.actions.find(a => a.name === actionName);
                if (!action) {
                    action = { name: actionName, type: 'property', target: objName, changes: {} };
                    project.actions.push(action);
                }

                let val: any = source;
                if (source.startsWith("'") && source.endsWith("'")) {
                    val = source.slice(1, -1);
                } else if (/^\d+(\.\d+)?$/.test(source)) {
                    val = parseFloat(source);
                } else if (/^[a-zA-Z0-9_$]+$/.test(source)) {
                    // Variable name reference
                    val = `\${${source}}`;
                }

                action.type = 'property';
                action.target = objName;
                action.changes = { [propName]: val };
                return { type: 'action', name: actionName };
            } else {
                let action = project.actions.find(a => a.name === actionName);
                const isNumeric = /^\d+(\.\d+)?$/.test(source);
                const calcStep: any = {
                    operandType: isNumeric ? 'constant' : 'variable',
                    constant: isNumeric ? parseFloat(source) : 0,
                    variable: isNumeric ? undefined : source
                };
                if (!action) {
                    action = { name: actionName, type: 'calculate', resultVariable: target, calcSteps: [calcStep] };
                    project.actions.push(action);
                } else {
                    action.type = 'calculate';
                    action.resultVariable = target;
                    action.calcSteps = [calcStep];
                }
                return { type: 'action', name: actionName };
            }
        }

        // Call
        if (statement.endsWith('()')) {
            const callName = statement.replace('()', '');
            return {
                type: project.tasks.find(t => t.name === callName) ? 'task' : 'action',
                name: callName
            };
        }

        return null;
    }
}
