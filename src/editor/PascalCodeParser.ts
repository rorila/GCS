import { GameProject, SequenceItem, ProjectVariable, VariableScope, GameTask } from '../model/types';
import { projectRegistry } from '../services/ProjectRegistry';
import { Logger } from '../utils/Logger';

const logger = Logger.get('PascalCodeParser');

/**
 * PascalCodeParser - Encapsulates the logic for parsing Pascal code back into a GameProject.
 */
export class PascalCodeParser {

    /**
     * Parses a full Pascal program and updates the GameProject
     */
    public static parse(project: GameProject, code: string, targetStage?: any): void {
        logger.info('Parsing Pascal program...');

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
        const procedureRegex = /PROCEDURE\s+([a-zA-Z0-9_.]+)(?:\s*\(([\s\S]*?)\))?\s*;\s*(?:VAR\s+([\s\S]*?))?\s*BEGIN\s+([\s\S]*?)\s*END\s*;/gi;
        let procMatch: any;

        const codeTasks: Map<string, { params: string, varBlock: string, bodyBlock: string, signature: string }> = new Map();
        while ((procMatch = procedureRegex.exec(code)) !== null) {
            const ident = procMatch[1];
            const paramsStr = procMatch[2] || '';
            const varBlock = procMatch[3] || '';
            const bodyBlock = procMatch[4];

            if (ident.includes('.')) {
                const parts = ident.split('.');
                const objName = parts[0];
                const eventName = parts[1];
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

        // Sync logic... (simplified to keep brevity but maintaining core functionality)
        const jsonTasks = [...(targetStage?.tasks || project.tasks || [])] as GameTask[];
        const matchedJsonTasks: Set<string> = new Set();

        codeTasks.forEach((codeData, taskName) => {
            foundTasks.add(taskName);
            let task = jsonTasks.find(t => t.name === taskName);

            if (!task) {
                // Potential Rename
                const potentialOldTask = jsonTasks.find(t =>
                    !matchedJsonTasks.has(t.name) &&
                    !codeTasks.has(t.name) &&
                    this.getLogicSignature(t.actionSequence) === codeData.signature
                );

                if (potentialOldTask) {
                    logger.debug(`Detected rename: ${potentialOldTask.name} -> ${taskName}`);
                    projectRegistry.renameTask(potentialOldTask.name, taskName);
                    task = potentialOldTask;
                } else {
                    task = { name: taskName, actionSequence: [] };
                    if (targetStage) {
                        if (!targetStage.tasks) targetStage.tasks = [];
                        targetStage.tasks.push(task);
                    } else {
                        project.tasks.push(task);
                    }
                }
            }

            if (task) {
                matchedJsonTasks.add(task.name);
                const oldSequence = task.actionSequence || [];
                const newSequence = this.parseBodyToSequence(project, taskName, codeData.bodyBlock, { count: 0 }, oldSequence, targetStage);

                if (JSON.stringify(oldSequence) !== JSON.stringify(newSequence)) {
                    task.actionSequence = newSequence;
                    if (targetStage?.flowCharts?.[taskName]) delete targetStage.flowCharts[taskName];
                }
            }
        });

        // 4. Update Event Handlers
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

        logger.info('Parser finished updating project.');
    }

    private static parseVariables(project: GameProject, block: string, scope: string, foundSet: Set<{ name: string, scope: string }>, targetStage?: any) {
        const varRegex = /([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_]+)\s*;/gi;
        let match: any;
        while ((match = varRegex.exec(block)) !== null) {
            const name = match[1];
            const type = match[2].toLowerCase() as any;
            foundSet.add({ name, scope });

            let variable = (targetStage?.variables?.find((v: any) => v.name === name)) ||
                project.variables.find(v => v.name === name);

            if (!variable) {
                const newVar: ProjectVariable = { name, type, defaultValue: '', scope: scope as VariableScope };
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

    private static parseBodyToSequence(project: GameProject, taskName: string, body: string, actionCounter: { count: number }, oldSequence: SequenceItem[], targetStage?: any): SequenceItem[] {
        const tokens = body.split(/(\bBEGIN\b|\bEND\b|\bIF\b|\bTHEN\b|\bELSE\b|;)/i);
        let i = 0;

        const consumeUntil = (targetToken: string): string => {
            let content = '';
            while (i < tokens.length && tokens[i].toUpperCase() !== targetToken) {
                content += tokens[i];
                i++;
            }
            return content;
        };

        const parseBlock = (oldSubSeq: SequenceItem[]): SequenceItem[] => {
            const blockSequence: SequenceItem[] = [];
            let itemIndex = 0;
            while (i < tokens.length) {
                let token = tokens[i].trim();
                let upperToken = token.toUpperCase();

                if (upperToken === 'END') {
                    i++;
                    break;
                }

                if (upperToken === 'IF') {
                    i++;
                    const conditionStr = consumeUntil('THEN');
                    i++;
                    const oldItem = oldSubSeq[itemIndex];
                    const item: SequenceItem = {
                        type: 'condition',
                        name: oldItem?.name || `if_${actionCounter.count++}`,
                        condition: this.parseCondition(conditionStr.trim())
                    };

                    if (tokens[i]?.trim().toUpperCase() === 'BEGIN') {
                        i++;
                        item.body = parseBlock(oldItem?.body || []);
                    } else {
                        const nextLine = consumeUntil(';');
                        i++;
                        const callName = nextLine.trim().replace('();', '');
                        if (callName) item.thenAction = callName;
                    }

                    // Check for ELSE
                    if (tokens[i]?.trim().toUpperCase() === 'ELSE') {
                        i++;
                        if (tokens[i]?.trim().toUpperCase() === 'BEGIN') {
                            i++;
                            (item as any).elseBody = parseBlock((oldItem as any)?.elseBody || []);
                        } else {
                            const nextLine = consumeUntil(';');
                            i++;
                            const callName = nextLine.trim().replace('();', '');
                            if (callName) item.elseAction = callName;
                        }
                    }

                    blockSequence.push(item);
                    itemIndex++;
                } else if (upperToken === 'WHILE') {
                    i++;
                    const conditionStr = consumeUntil('DO');
                    i++;
                    const oldItem = oldSubSeq[itemIndex];
                    const item: SequenceItem = {
                        type: 'while',
                        name: oldItem?.name || `while_${actionCounter.count++}`,
                        condition: this.parseCondition(conditionStr.trim())
                    };
                    if (tokens[i]?.trim().toUpperCase() === 'BEGIN') {
                        i++;
                        item.body = parseBlock(oldItem?.body || []);
                    }
                    blockSequence.push(item);
                    itemIndex++;
                } else if (upperToken === 'FOR') {
                    i++;
                    const forHeader = consumeUntil('DO');
                    i++;
                    const oldItem = oldSubSeq[itemIndex];
                    const item: any = {
                        type: 'for',
                        name: oldItem?.name || `for_${actionCounter.count++}`
                    };
                    const forMatch = forHeader.match(/([a-zA-Z0-9_]+)\s*:=\s*([0-9]+)\s+TO\s+([0-9]+)/i);
                    if (forMatch) {
                        item.iteratorVar = forMatch[1];
                        item.from = parseInt(forMatch[2]);
                        item.to = parseInt(forMatch[3]);
                    }
                    if (tokens[i]?.trim().toUpperCase() === 'BEGIN') {
                        i++;
                        item.body = parseBlock(oldItem?.body || []);
                    }
                    blockSequence.push(item);
                    itemIndex++;
                } else if (token === ';') {
                    i++;
                } else if (token.trim() && upperToken !== 'BEGIN') {
                    const statement = consumeUntil(';');
                    i++;
                    const cleanStatement = statement.trim();
                    if (cleanStatement) {
                        const parsed = this.parseSimpleStatement(project, taskName, cleanStatement, actionCounter.count++, oldSubSeq[itemIndex], targetStage);
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
            if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
            else if (!isNaN(Number(val))) val = Number(val);
            return {
                variable: match[1],
                operator: match[2] === '=' ? '==' : (match[2] === '<>' ? '!=' : match[2]),
                value: val
            };
        }
        return { variable: condStr, operator: '==', value: true };
    }

    private static parseSimpleStatement(project: GameProject, taskName: string, statement: string, index: number, oldItem?: SequenceItem, targetStage?: any): SequenceItem | null {
        const assignMatch = statement.match(/^([a-zA-Z0-9_.]+)\s*:=\s*(.+)$/);
        if (assignMatch) {
            const target = assignMatch[1];
            let source = assignMatch[2].trim();
            let val: any = source;
            if (source.startsWith("'")) val = source.slice(1, -1);
            else if (/^\d+/.test(source)) val = parseFloat(source);

            if (target.includes('.')) {
                const parts = target.split('.');
                const objName = parts[0];
                const propName = parts[1];
                const actionName = oldItem?.name || `${taskName}_action_${index}`;

                let action = (targetStage?.actions || project.actions).find((a: any) => a.name === actionName);
                if (!action) {
                    action = { name: actionName, type: 'property', target: objName, changes: {} };
                    (targetStage?.actions || project.actions).push(action);
                }

                // Check for increment pattern: Obj.Prop := Obj.Prop + Val
                const incMatch = source.match(new RegExp(`^${objName}\\.${propName}\\s*\\+\\s*(.+)$`, 'i'));
                if (incMatch) {
                    action.type = 'increment';
                    action.changes[propName] = parseFloat(incMatch[1]) || 1;
                } else {
                    action.type = 'property';
                    action.changes[propName] = val;
                }

                return { type: 'action', name: actionName };
            } else {
                // Calculation: Var := formula
                const actionName = oldItem?.name || `${taskName}_action_${index}`;
                let action = (targetStage?.actions || project.actions).find((a: any) => a.name === actionName);
                if (!action) {
                    action = { name: actionName, type: 'calculate', resultVariable: target, formula: source };
                    (targetStage?.actions || project.actions).push(action);
                } else {
                    action.type = 'calculate';
                    action.resultVariable = target;
                    action.formula = source;
                }
                return { type: 'action', name: actionName };
            }
        } else if (statement.endsWith('()')) {
            const callName = statement.replace('()', '');
            const isTask = project.tasks.some(t => t.name === callName);
            return { type: isTask ? 'task' : 'action', name: callName };
        }
        return null;
    }

    private static getLogicSignature(sequence: SequenceItem[]): string {
        if (!sequence || sequence.length === 0) return 'empty';
        return sequence.map(item => `[${item.type}]`).join(';');
    }
}
