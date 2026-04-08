import { coreStore } from './CoreStore';
import { projectActionRegistry } from './ActionRegistry';
import { projectTaskRegistry } from './TaskRegistry';


class ReferenceTracker {
    public findReferences(name: string): string[] {
        const refs: string[] = [];
        if (!coreStore.project) return refs;

        const taskRefs = this.getTaskUsage(name);
        const actionRefs = this.getActionUsage(name);
        const varRefs = this.getVariableUsage(name);
        const objRefs = this.getObjectUsage(name);

        return [...taskRefs, ...actionRefs, ...varRefs, ...objRefs].filter((v, i, a) => a.indexOf(v) === i);
    }

    public getObjectUsage(name: string): string[] {
        const refs: string[] = [];
        const project = coreStore.project;
        if (!project) return refs;

        projectActionRegistry.getActions('all', false).forEach((action: any) => {
            const anyAction = action as any;
            if (anyAction.target === name) refs.push(`Aktion: ${action.name} -> Target ist Objekt: ${name}`);
            if (anyAction.source === name) refs.push(`Aktion: ${action.name} -> Source ist Objekt: ${name}`);
            if (anyAction.changes) {
                const str = JSON.stringify(anyAction.changes);
                if (str.includes(`\${${name}.`)) refs.push(`Aktion: ${action.name} -> Referenziert Objekt: ${name}`);
            }
        });

        const checkInput = (input: any, source: string) => {
            if (input.player1Target === name) refs.push(`${source} -> Player 1 Target ist: ${name}`);
            if (input.player2Target === name) refs.push(`${source} -> Player 2 Target ist: ${name}`);
        };

        if (project.input) checkInput(project.input, 'Global Input');
        project.stages?.forEach(stage => {
            if (stage.input) checkInput(stage.input, `Stage: ${stage.name} Input`);
        });

        const objRegex = new RegExp(`\\$\\{${name}\\.`, 'g');
        projectTaskRegistry.getTasks('all', false).forEach((task: any) => {
            const str = JSON.stringify(task.actionSequence);
            if (objRegex.test(str)) refs.push(`Task: ${task.name} -> Referenziert Objekt: ${name}`);
        });

        this.getAllObjectsWithSource().forEach(({ obj, source }) => {
            const str = JSON.stringify(obj);
            if (objRegex.test(str)) refs.push(`${source} Objekt: ${obj.name} -> Binding auf Objekt: ${name}`);
        });

        return refs;
    }

    public getAllReferencedTaskNames(): Set<string> {
        const referenced = new Set<string>();
        if (!coreStore.project) return referenced;

        projectTaskRegistry.getTasks('all', false).forEach((task: any) => {
            const scanSeq = (seq: any[]) => {
                if (!seq || !Array.isArray(seq)) return;
                seq.forEach(item => {
                    if (item.type === 'task' && item.name) referenced.add(item.name);
                    if (item.thenTask) referenced.add(item.thenTask);
                    if (item.elseTask) referenced.add(item.elseTask);
                    if (item.body) scanSeq(item.body);
                });
            };
            scanSeq(task.actionSequence);
        });

        const allPotentialHolders: any[] = [];
        this.getAllObjectsWithSource().forEach(({ obj }) => allPotentialHolders.push(obj));
        if (coreStore.project.variables) coreStore.project.variables.forEach(v => allPotentialHolders.push(v));
        if (coreStore.project.stages) {
            coreStore.project.stages.forEach(s => {
                if (s.variables) s.variables.forEach(v => allPotentialHolders.push(v));
            });
        }

        allPotentialHolders.forEach(item => {
            const checkProps = (target: any) => {
                if (!target || typeof target !== 'object') return;
                Object.entries(target).forEach(([key, val]) => {
                    if (typeof val === 'string' && (key.startsWith('on') || key === 'onChange' || key === 'onValueTrue' || key === 'onValueFalse')) {
                        referenced.add(val);
                    }
                    if (key === 'Tasks' || key === 'events' || key === 'properties') checkProps(val);
                });
            };
            checkProps(item);
        });

        return referenced;
    }

    public getTaskUsage(name: string): string[] {
        const refs: string[] = [];
        const project = coreStore.project;
        if (!project) return refs;

        projectTaskRegistry.getTasks('all', false).forEach((task: any) => {
            if (task.name === name) return;
            const scanSeq = (seq: any[]) => {
                if (!seq || !Array.isArray(seq)) return;
                seq.forEach(item => {
                    if (item.type === 'task' && item.name === name) refs.push(`➡️ Wird aufgerufen von Task: "${task.name}"`);
                    if (item.thenTask === name) refs.push(`➡️ Aufruf (Folge-Task) in: "${task.name}"`);
                    if (item.elseTask === name) refs.push(`➡️ Aufruf (Else-Zweig) in: "${task.name}"`);
                    if (item.resultTask === name) refs.push(`➡️ Aufruf (Ergebnis-Zweig) in: "${task.name}"`);
                    if (item.body) scanSeq(item.body);
                });
            };
            scanSeq(task.actionSequence);
        });

        const allPotentialHolders: { item: any, source: string }[] = [];
        this.getAllObjectsWithSource().forEach(({ obj, source }) => {
            allPotentialHolders.push({ item: obj, source: `Objekt: ${obj.name} (${source})` });
        });

        if (project.variables) project.variables.forEach(v => allPotentialHolders.push({ item: v, source: `Glb-Variable: ${v.name}` }));
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.variables) s.variables.forEach(v => allPotentialHolders.push({ item: v, source: `Stage-Variable: ${v.name} (${s.name || s.id})` }));
            });
        }

        allPotentialHolders.forEach(({ item, source }) => {
            const checkProps = (target: any, path: string = '') => {
                if (!target || typeof target !== 'object') return;
                Object.entries(target).forEach(([key, val]) => {
                    if (val === name) {
                        const isLikelyEvent = key.startsWith('on') || key === 'onValueTrue' || key === 'onValueFalse' || key === 'onChange';
                        const cleanKey = key.replace(/^on/, '');
                        if (isLikelyEvent) {
                            refs.push(`⚡ Gestartet durch Event "${cleanKey}" von ${source}`);
                        } else {
                            refs.push(`🔗 Referenziert in Eigenschaft "${path}${key}" von ${source}`);
                        }
                    }
                    if (key === 'Tasks' || key === 'events' || key === 'properties') checkProps(val, `${key}.`);
                });
            };
            checkProps(item);
        });

        return refs;
    }

    public getActionUsage(name: string): string[] {
        const refs: string[] = [];
        const project = coreStore.project;
        if (!project) return refs;

        projectTaskRegistry.getTasks('all', false).forEach((task: any) => {
            const scanSeq = (seq: any[]) => {
                if (!seq || !Array.isArray(seq)) return;
                seq.forEach(item => {
                    if (item.type === 'action' && item.name === name) refs.push(`🎬 Wird ausgeführt von Task: "${task.name}"`);
                    if (item.thenAction === name) refs.push(`🎬 Aufruf (Folge-Aktion) in: "${task.name}"`);
                    if (item.elseAction === name) refs.push(`🎬 Aufruf (Else-Zweig) in: "${task.name}"`);
                    if (item.body) scanSeq(item.body);
                });
            };
            scanSeq(task.actionSequence);
        });

        const scanFlow = (flow: any, sourceName: string) => {
            if (!flow || !flow.elements || !Array.isArray(flow.elements)) return;
            flow.elements.forEach((el: any) => {
                const type = (el.type || '').toLowerCase();
                if (type === 'action' || type === 'data_action' || type === 'httpaction') {
                    const elName = el.Name || el.data?.name || el.data?.actionName || el.properties?.name || el.properties?.text;
                    if (elName === name) {
                        refs.push(`🎨 Visuell verwendet im Flow: "${sourceName}"`);
                    }
                }
            });
        };

        if (project.flow) scanFlow(project.flow, 'Global Flow');
        if (project.flowCharts) {
            Object.entries(project.flowCharts).forEach(([key, flow]) => {
                scanFlow(flow, `Flow: ${key}`);
            });
        }

        projectTaskRegistry.getTasks('all', false).forEach((task: any) => {
            if (task.flowChart) scanFlow(task.flowChart, `Task Flow: "${task.name}"`);
        });

        return [...new Set(refs)];
    }

    public getVariableUsage(name: string): string[] {
        const refs: string[] = [];
        if (!coreStore.project) return refs;

        const varRegex = new RegExp(`\\$\\{${name}([.}]|$)`);
        projectTaskRegistry.getTasks('all', false).forEach((task: any) => {
            const scanSeq = (seq: any[]) => {
                if (!seq || !Array.isArray(seq)) return;
                seq.forEach(item => {
                    if (varRegex.test(JSON.stringify(item))) refs.push(`📦 Referenziert in Task: "${task.name}"`);
                    if (item.type === 'action') {
                        const action = item as any;
                        if (action.variableName === name || action.resultVariable === name) {
                            refs.push(`📦 Genutzt als Ziel/Quelle in Aktion von Task: "${task.name}"`);
                        }
                    }
                    if (item.condition && (item.condition.variable === name)) {
                        refs.push(`📦 Genutzt in Bedingung von Task: "${task.name}"`);
                    }
                    if (item.body) scanSeq(item.body);
                });
            };
            scanSeq(task.actionSequence);
        });

        this.getAllObjectsWithSource().forEach(({ obj, source }) => {
            if (varRegex.test(JSON.stringify(obj))) refs.push(`🔗 Gebunden an Objekt "${obj.name}" (${source})`);
        });

        return refs;
    }

    public getAllObjectsWithSource(): { obj: any, source: string }[] {
        const results: { obj: any, source: string }[] = [];
        const project = coreStore.project;
        if (!project) return results;
        (project.objects || []).forEach(obj => results.push({ obj, source: 'Global' }));
        if (project.stages) {
            project.stages.forEach(s => {
                (s.objects || []).forEach((obj: any) => results.push({ obj, source: `Stage: ${s.name || s.id}` }));
            });
        }
        return results;
    }

    public updateReferencesInProperties(oldName: string, newName: string) {
        const project = coreStore.project;
        if (!project) return;
        
        const regex = new RegExp(`\\$\\{${oldName}\\}`, 'g');
        const regexNested = new RegExp(`\\$\\{${oldName}\\.`, 'g');
        const replaceInString = (str: string) => str.replace(regex, `\${${newName}}`).replace(regexNested, `\${${newName}.`);

        const traverseAndReplace = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            Object.keys(obj).forEach(key => {
                const val = obj[key];
                if (typeof val === 'string') { obj[key] = replaceInString(val); }
                else if (typeof val === 'object') { traverseAndReplace(val); }
            });
        };

        const allObjects = [...(project.objects || [])];
        if (project.stages) project.stages.forEach(s => { if (s.objects) allObjects.push(...s.objects); });
        allObjects.forEach(obj => traverseAndReplace(obj));
        project.actions.forEach(act => traverseAndReplace(act));
        if (project.stages) project.stages.forEach(stage => { if (stage.actions) stage.actions.forEach(act => traverseAndReplace(act)); });
        projectTaskRegistry.getTasks('all', false).forEach((t: any) => traverseAndReplace(t));
    }

    public updateReferencesInActions(oldName: string, newName: string) {
        const project = coreStore.project;
        if (!project) return;
        
        project.tasks.forEach(task => {
            task.actionSequence.forEach(item => {
                if (item.type === 'action') {
                    const action = item as any;
                    if (action.variableName === oldName) action.variableName = newName;
                    if (action.resultVariable === oldName) action.resultVariable = newName;
                    if (action.calcSteps) action.calcSteps.forEach((step: any) => { if (step.operandType === 'variable' && step.variable === oldName) step.variable = newName; });
                } else if (item.type === 'condition' || item.type === 'while') {
                    if (item.condition && item.condition.variable === oldName) item.condition.variable = newName;
                }
            });
        });
    }

    public getLogicalUsage(): { tasks: Set<string>, actions: Set<string>, variables: Set<string> } {
        const project = coreStore.project;
        if (!project) return { tasks: new Set(), actions: new Set(), variables: new Set() };

        const usedTasks = new Set<string>();
        const usedActions = new Set<string>();
        const usedVariables = new Set<string>();

        coreStore.logger.info(`Starting Static Deep-Scan for Project: ${project.meta.name}`);

        const allTasks = projectTaskRegistry.getTasks('all', false).map((t: any) => t.name.trim());
        const allActions = projectActionRegistry.getActions('all', false).map((a: any) => a.name.trim());
        const allVars: string[] = [];

        (project.variables || []).forEach(v => { if (v.name) allVars.push(v.name.trim()); });
        project.stages?.forEach(s => {
            (s.variables || []).forEach(v => { if (v.name) allVars.push(v.name.trim()); });
            (s.objects || []).forEach((obj: any) => {
                if ((obj.isVariable || obj.type === 'TVariable' || obj.type === 'TTimer' || obj.type === 'TWindow') && obj.name) {
                    const trimmed = obj.name.trim();
                    if (!allVars.includes(trimmed)) allVars.push(trimmed);
                }
            });
        });

        const definitionObjects = new Set<any>();
        project.tasks?.forEach(t => definitionObjects.add(t));
        project.actions?.forEach(a => definitionObjects.add(a));
        project.variables?.forEach(v => definitionObjects.add(v));
        project.stages?.forEach(s => {
            s.tasks?.forEach((t: any) => definitionObjects.add(t));
            s.actions?.forEach((a: any) => definitionObjects.add(a));
            s.variables?.forEach((v: any) => definitionObjects.add(v));
            s.objects?.forEach((o: any) => {
                if (o.isVariable || o.type === 'TVariable' || o.type === 'TTimer' || o.type === 'TWindow') {
                    definitionObjects.add(o);
                }
            });
        });

        const scanValue = (val: any, path: string = '', parentObj: any = null) => {
            if (val === null || val === undefined) return;

            if (typeof val === 'string') {
                const trimmed = val.trim();
                const key = path.split('.').pop() || '';

                if ((key === 'name' || key === 'taskName') && definitionObjects.has(parentObj)) {
                    return;
                }

                if (allTasks.includes(trimmed)) {
                    if (!usedTasks.has(trimmed)) usedTasks.add(trimmed);
                }
                else if (allActions.includes(trimmed)) {
                    if (!usedActions.has(trimmed)) usedActions.add(trimmed);
                }
                else if (allVars.includes(trimmed)) {
                    if (!usedVariables.has(trimmed)) usedVariables.add(trimmed);
                }

                if (trimmed.includes('${')) {
                    const regex = /\$\{([^}.]+)[}.]/g;
                    let match;
                    while ((match = regex.exec(trimmed)) !== null) {
                        const varName = match[1].trim();
                        if (allVars.includes(varName) && !usedVariables.has(varName)) {
                            usedVariables.add(varName);
                        }
                    }
                }
                return;
            }

            if (Array.isArray(val)) {
                val.forEach((item, i) => scanValue(item, `${path}[${i}]`, val));
                return;
            }

            if (typeof val === 'object') {
                Object.entries(val).forEach(([k, subVal]) => {
                    scanValue(subVal, path ? `${path}.${k}` : k, val);
                });
            }
        };

        scanValue(project);
        coreStore.logger.info(`Finished. Marked as used: ${usedTasks.size} Tasks, ${usedActions.size} Actions, ${usedVariables.size} Variables.`);
        return { tasks: usedTasks, actions: usedActions, variables: usedVariables };
    }
}

export const projectReferenceTracker = new ReferenceTracker();
