import { GameProject, SequenceItem } from '../model/types';

export class RefactoringManager {
    /**
     * Renames a variable project-wide
     */
    public static renameVariable(project: GameProject, oldName: string, newName: string): void {
        if (!oldName || !newName || oldName === newName) return;

        // 1. Update project variables list
        project.variables.forEach(v => {
            if (v.name === oldName) v.name = newName;
        });

        // 1b. Update stage-local variables list
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.variables) {
                    stage.variables.forEach(v => {
                        if (v.name === oldName) v.name = newName;
                    });
                }
            });
        }

        // 2. Update actions
        project.actions.forEach(action => {
            // Variable assignments and reads
            if (action.variableName === oldName) action.variableName = newName;
            if (action.resultVariable === oldName) action.resultVariable = newName;

            // Calculation steps
            if (action.calcSteps) {
                action.calcSteps.forEach(step => {
                    if (step.operandType === 'variable' && step.variable === oldName) {
                        step.variable = newName;
                    }
                });
            }

            // String interpolation in property changes
            if (action.type === 'property' && action.changes) {
                for (const key in action.changes) {
                    let val = action.changes[key];
                    if (typeof val === 'string') {
                        action.changes[key] = this.replaceInterpolation(val, oldName, newName);
                    }
                }
            }

            // Service params interpolation
            if (action.serviceParams) {
                for (const key in action.serviceParams) {
                    action.serviceParams[key] = this.replaceInterpolation(action.serviceParams[key], oldName, newName);
                }
            }
        });

        // 3. Update task sequences
        project.tasks.forEach(task => {
            this.processSequenceItems(task.actionSequence, (item) => {
                if (item.type === 'condition' && item.condition) {
                    if (item.condition.variable === oldName) item.condition.variable = newName;
                }
                if (item.type === 'while' && item.condition) {
                    if (item.condition.variable === oldName) item.condition.variable = newName;
                }
                if (item.type === 'for') {
                    if (item.iteratorVar === oldName) item.iteratorVar = newName;
                    if (typeof item.from === 'string') item.from = this.replaceInterpolation(item.from, oldName, newName);
                    if (typeof item.to === 'string') item.to = this.replaceInterpolation(item.to, oldName, newName);
                }
                if (item.type === 'foreach') {
                    if (item.sourceArray === oldName) item.sourceArray = newName;
                    if (item.itemVar === oldName) item.itemVar = newName;
                    if (item.indexVar === oldName) item.indexVar = newName;
                }
            });
        });

        // 5. Update all stages
        if (project.stages) {
            project.stages.forEach(stage => {
                // Update stage objects
                if (stage.objects) {
                    stage.objects.forEach(obj => {
                        // String interpolation in properties
                        for (const key in obj) {
                            if (typeof (obj as any)[key] === 'string') {
                                (obj as any)[key] = this.replaceInterpolation((obj as any)[key], oldName, newName);
                            }
                        }
                    });
                }

                // Update stage flow charts
                if (stage.flowCharts) {
                    Object.keys(stage.flowCharts).forEach(key => {
                        const flowChart = stage.flowCharts![key];
                        if (flowChart?.elements) {
                            flowChart.elements.forEach((el: any) => {
                                if (el.type === 'Condition' && el.data?.condition) {
                                    if (el.data.condition.variable === oldName) {
                                        el.data.condition.variable = newName;
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    }

    /**
     * Renames a task project-wide
     */
    public static renameTask(project: GameProject, oldName: string, newName: string): void {
        if (!oldName || !newName || oldName === newName) return;

        // 1. Update project tasks list (Global)
        project.tasks.forEach(task => {
            if (task.name === oldName) task.name = newName;
        });

        // 1b. Update stage-specific tasks
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.tasks) {
                    stage.tasks.forEach(task => {
                        if (task.name === oldName) task.name = newName;
                    });
                }
            });
        }

        // 2. Update task calls in sequences (Global + all Stages)
        const allTasks = [...project.tasks];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) allTasks.push(...s.tasks);
            });
        }

        allTasks.forEach(task => {
            this.processSequenceItems(task.actionSequence, (item) => {
                if (item.type === 'task' && item.name === oldName) item.name = newName;
                if (item.thenTask === oldName) item.thenTask = newName;
                if (item.elseTask === oldName) item.elseTask = newName;
            });
        });

        // 3. Update object event bindings
        project.objects.forEach(obj => {
            const evts = (obj as any).events || (obj as any).Tasks;
            if (evts) {
                for (const event in evts) {
                    if (evts[event] === oldName) {
                        evts[event] = newName;
                    }
                }
            }
        });

        // 4. Update variable scopes
        project.variables.forEach(v => {
            if (v.scope === oldName) v.scope = newName;
        });

        // 5. Update flowChart key if task was renamed (Global)
        if (project.flowCharts && project.flowCharts[oldName]) {
            project.flowCharts[newName] = project.flowCharts[oldName];
            delete project.flowCharts[oldName];
        }
        // 5b. Update flowChart key in all stages
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.flowCharts && s.flowCharts[oldName]) {
                    s.flowCharts[newName] = s.flowCharts[oldName];
                    delete s.flowCharts[oldName];
                }
            });
        }

        // 6. Update Task nodes within all flowCharts that might refer to this task
        const charts: { [key: string]: any } = { ... (project.flowCharts || {}) };
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.flowCharts) {
                    Object.assign(charts, stage.flowCharts);
                }
            });
        }

        Object.keys(charts).forEach(key => {
            const flowChart = charts[key];
            if (flowChart?.elements) {
                flowChart.elements.forEach((el: any) => {
                    if (el.type === 'Task' && el.data?.taskName === oldName) {
                        el.data.taskName = newName;
                    }
                });
            }
        });

        // 7. Update object event bindings in all stages
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.objects) {
                    stage.objects.forEach(obj => {
                        const evts = (obj as any).events || (obj as any).Tasks;
                        if (evts) {
                            for (const event in evts) {
                                if (evts[event] === oldName) {
                                    evts[event] = newName;
                                }
                            }
                        }
                    });
                }
            });
        }
    }

    /**
     * Renames an object project-wide
     */
    public static renameObject(project: GameProject, oldName: string, newName: string): void {
        if (!oldName || !newName || oldName === newName) return;

        console.log(`[Refactoring] Umbenennung Objekt: ${oldName} -> ${newName}`);

        // 1. Update object name itself (Global + Stages)
        let renameCount = 0;
        project.objects.forEach(obj => {
            if (obj.name === oldName) {
                obj.name = newName;
                renameCount++;
            }
        });

        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.objects) {
                    stage.objects.forEach(obj => {
                        if (obj.name === oldName) {
                            obj.name = newName;
                            renameCount++;
                        }
                    });
                }
            });
        }
        console.log(`[Refactoring] Objektnamen aktualisiert: ${renameCount}`);

        // 2. Update all actions (Global + Stages)
        // 2. Update all actions (Global + Stages)
        const allActions = [...project.actions];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.actions) allActions.push(...s.actions);
            });
        }

        // NEW: Check for actions that "belong" to this object (e.g. "Label_7.captionTrue")
        // and rename them as well.
        allActions.forEach(action => {
            if (action.name.startsWith(oldName + '.') || action.name.startsWith(oldName + '_')) {
                const newActionName = action.name.replace(oldName, newName);
                console.log(`[Refactoring] Automatische Umbenennung zugehöriger Aktion: ${action.name} -> ${newActionName}`);
                this.renameAction(project, action.name, newActionName);
                // Update the local variable strictly for the next loop (though renameAction handles the project lists)
                action.name = newActionName;
            }
        });

        let actionUpdateCount = 0;
        console.log(`[Refactoring] Scanne ${allActions.length} Aktionen...`);
        allActions.forEach((action, idx) => {
            let changed = false;
            // DEBUG: Log every action target
            if (action.target || action.source) {
                console.log(`[Refactoring] Aktion [${idx}] "${action.name}": target="${action.target}", source="${action.source}"`);
            }
            if (action.target === oldName) {
                console.log(`[Refactoring] Treffer in Aktion "${action.name}": target "${oldName}" -> "${newName}"`);
                action.target = newName;
                changed = true;
            }
            if (action.source === oldName) {
                console.log(`[Refactoring] Treffer in Aktion "${action.name}": source "${oldName}" -> "${newName}"`);
                action.source = newName;
                changed = true;
            }

            if (action.changes) {
                for (const key in action.changes) {
                    let val = action.changes[key];
                    if (typeof val === 'string') {
                        if (val === oldName) {
                            action.changes[key] = newName;
                            changed = true;
                        } else if (val.includes(`\${${oldName}`)) {
                            action.changes[key] = this.replaceObjectInterpolation(val, oldName, newName);
                            changed = true;
                        }
                    }
                }
            }

            if (action.serviceParams) {
                for (const key in action.serviceParams) {
                    let val = action.serviceParams[key];
                    if (typeof val === 'string') {
                        if (val === oldName) {
                            action.serviceParams[key] = newName;
                            changed = true;
                        } else if (val.includes(`\${${oldName}`)) {
                            action.serviceParams[key] = this.replaceObjectInterpolation(val, oldName, newName);
                            changed = true;
                        }
                    }
                }
            }
            if (changed) actionUpdateCount++;
        });
        console.log(`[Refactoring] Aktionen aktualisiert: ${actionUpdateCount}`);

        // 3. Update all task sequences (Global + Stages)
        const allTasks = [...project.tasks];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) allTasks.push(...s.tasks);
            });
        }

        let sequenceUpdateCount = 0;
        console.log(`[Refactoring] Scanne ${allTasks.length} Tasks...`);
        allTasks.forEach(task => {
            let taskChanged = false;
            this.processSequenceItems(task.actionSequence, (item) => {
                const str = JSON.stringify(item);
                // Check for literal "Label_7" or interpolated ${Label_7}
                if (str.includes(`"${oldName}"`) || str.includes(`\${${oldName}`)) {
                    console.log(`[Refactoring] Potenzieller Treffer in Task "${task.name}", Element:`, item);
                    const changed = this.replaceInObjectRecursive(item, oldName, newName);
                    if (changed) taskChanged = true;
                }
            });
            if (taskChanged) sequenceUpdateCount++;
        });
        console.log(`[Refactoring] Task-Sequenzen aktualisiert: ${sequenceUpdateCount}`);

        // 4. Update input targets
        if (project.input) {
            if (project.input.player1Target === oldName) project.input.player1Target = newName;
            if (project.input.player2Target === oldName) project.input.player2Target = newName;
        }

        // 5. Update Flow Charts
        const charts: { [key: string]: any } = { ... (project.flowCharts || {}) };
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.flowCharts) Object.assign(charts, stage.flowCharts);
            });
        }

        let flowUpdateCount = 0;
        console.log(`[Refactoring] Scanne Flow-Charts: ${Object.keys(charts).length}...`);
        Object.keys(charts).forEach(key => {
            const chart = charts[key];
            if (chart?.elements) {
                chart.elements.forEach((el: any) => {
                    let nodeChanged = false;
                    // Check element data (properties, params, etc.)
                    if (el.data) {
                        const strBefore = JSON.stringify(el.data);
                        if (this.replaceInObjectRecursive(el.data, oldName, newName)) {
                            nodeChanged = true;
                        }
                        if (JSON.stringify(el.data) !== strBefore) nodeChanged = true;
                    }

                    // Check properties specifically (some nodes use this)
                    if (el.properties) {
                        if (this.replaceInObjectRecursive(el.properties, oldName, newName)) {
                            nodeChanged = true;
                        }
                    }

                    if (nodeChanged) {
                        console.log(`[Refactoring] Treffer in Flow-Chart "${key}", Node "${el.id}": ${oldName} -> ${newName}`);
                        flowUpdateCount++;
                    }
                });
            }
        });
        console.log(`[Refactoring] Flow-Charts Nodes aktualisiert: ${flowUpdateCount}`);
        // 6. Update all objects properties for interpolations (Global + Stages)
        let objectPropUpdateCount = 0;
        const allObjectsToScan = [...project.objects];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.objects) allObjectsToScan.push(...s.objects);
            });
        }
        allObjectsToScan.forEach(obj => {
            const strBefore = JSON.stringify(obj);
            this.replaceInObjectRecursive(obj, oldName, newName);
            if (JSON.stringify(obj) !== strBefore) objectPropUpdateCount++;
        });
        console.log(`[Refactoring] Objekt-Properties aktualisiert: ${objectPropUpdateCount}`);
    }

    /**
     * Helper to replace ${obj.prop} or ${obj} in strings
     */
    private static replaceObjectInterpolation(text: string, oldName: string, newName: string): string {
        // Match ${oldName} or ${oldName.something}
        const pattern = new RegExp(`\\$\\{${oldName}([.}])`, 'g');
        return text.replace(pattern, (_, suffix) => `\${${newName}${suffix}`);
    }

    /**
     * Helper to recursively replace object references in any object
     * Returns true if anything was changed
     */
    private static replaceInObjectRecursive(obj: any, oldName: string, newName: string): boolean {
        if (!obj || typeof obj !== 'object') return false;
        let changed = false;

        if (Array.isArray(obj)) {
            obj.forEach(item => {
                if (this.replaceInObjectRecursive(item, oldName, newName)) changed = true;
            });
            return changed;
        }

        for (const key in obj) {
            const val = obj[key];
            if (typeof val === 'string') {
                if (val === oldName) {
                    obj[key] = newName;
                    changed = true;
                } else if (val.includes(`\${${oldName}`)) {
                    obj[key] = this.replaceObjectInterpolation(val, oldName, newName);
                    changed = true;
                }
            } else if (typeof val === 'object') {
                if (this.replaceInObjectRecursive(val, oldName, newName)) changed = true;
            }
        }
        return changed;
    }

    /**
     * Renames an action project-wide
     */
    public static renameAction(project: GameProject, oldName: string, newName: string): void {
        if (!oldName || !newName || oldName === newName) return;

        // 1. Update project actions list (Global)
        project.actions.forEach(action => {
            if (action.name === oldName) action.name = newName;
        });

        // 2. Update stage-specific actions
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.actions) {
                    stage.actions.forEach(action => {
                        if (action.name === oldName) action.name = newName;
                    });
                }
            });
        }

        // 3. Update task sequences (Global + all Stages)
        project.tasks.forEach(task => {
            this.processSequenceItems(task.actionSequence, (item) => {
                if (item.type === 'action' && item.name === oldName) {
                    item.name = newName;
                }
            });
        });

        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.tasks) {
                    stage.tasks.forEach(task => {
                        this.processSequenceItems(task.actionSequence, (item) => {
                            if (item.type === 'action' && item.name === oldName) {
                                item.name = newName;
                            }
                        });
                    });
                }
            });
        }


        // 3. Update flow chart elements (ghost nodes or nested actions)
        const charts: { [key: string]: any } = { ... (project.flowCharts || {}) };
        if ((project as any).flow) charts['__legacy_flow__'] = (project as any).flow;

        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.flowCharts) {
                    Object.assign(charts, stage.flowCharts);
                }
            });
        }

        let flowUpdateCount = 0;
        console.log(`[Refactoring] Scanne Flow-Charts für Aktion "${oldName}": ${Object.keys(charts).length}...`);
        Object.keys(charts).forEach(key => {
            const chart = charts[key];
            if (chart?.elements) {
                chart.elements.forEach((el: any) => {
                    let nodeChanged = false;

                    // Specific Handling for Action Type Nodes
                    if (el.type === 'Action') {
                        // Update Check 1: properties.name
                        if (el.properties && el.properties.name === oldName) {
                            el.properties.name = newName;
                            nodeChanged = true;
                        }
                        // Update Check 2: data properties explicitly
                        if (el.data) {
                            if (el.data.name === oldName) { el.data.name = newName; nodeChanged = true; }
                            if (el.data.actionName === oldName) { el.data.actionName = newName; nodeChanged = true; }
                        }
                    } else if (el.type === 'Condition') {
                        if (el.data) {
                            if (el.data.thenAction === oldName) { el.data.thenAction = newName; nodeChanged = true; }
                            if (el.data.elseAction === oldName) { el.data.elseAction = newName; nodeChanged = true; }
                        }
                    }

                    // GENERAL RECURSIVE CHECK (covers parameters, interpolation in data, etc.)
                    // This is crucial for things like "Label_7.captionTrue" inside data objects
                    if (el.data) {
                        const strBefore = JSON.stringify(el.data);
                        // Be careful not to double-replace if we handled it above, but recursive handles partials
                        if (this.replaceInObjectRecursive(el.data, oldName, newName)) nodeChanged = true;

                        // Explicit string check to be sure
                        if (JSON.stringify(el.data) !== strBefore) nodeChanged = true;
                    }

                    if (nodeChanged) {
                        console.log(`[Refactoring] Treffer für Aktion in Flow-Chart "${key}", Node "${el.id}": ${oldName} -> ${newName}`);
                        flowUpdateCount++;
                    }
                });
            }
        });
        console.log(`[Refactoring] Flow-Chart Nodes für Aktion aktualisiert: ${flowUpdateCount}`);
    }

    /**
     * Renames a service project-wide
     */
    public static renameService(project: GameProject, oldName: string, newName: string): void {
        if (!oldName || !newName || oldName === newName) return;

        project.actions.forEach(action => {
            if (action.type === 'service' && action.service === oldName) {
                action.service = newName;
            }
        });
    }

    /**
     * Checks how many times an action is used across all tasks and stages.
     */
    public static getActionUsageCount(project: GameProject, actionName: string): number {
        let count = 0;

        const allTasks = [...(project.tasks || [])];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) allTasks.push(...s.tasks);
            });
        }

        allTasks.forEach(task => {
            // 1. Check in ActionSequence
            if (task.actionSequence) {
                this.processSequenceItems(task.actionSequence, (item) => {
                    const anyItem = item as any;
                    // Debug logging for usage check
                    // console.log(`[RefactoringManager] Checking usage in ${task.name}: ${anyItem.name} (${anyItem.type}) vs ${actionName}`);

                    if (item.type === 'action' && item.name === actionName) {
                        console.log(`[RefactoringManager] Found usage (Action) in ${task.name}: ${actionName}`);
                        count++;
                    } else if (anyItem.type === 'data_action' && anyItem.action === actionName) {
                        console.log(`[RefactoringManager] Found usage (DataAction.action) in ${task.name}: ${actionName}`);
                        count++;
                    }
                    else if (anyItem.type === 'data_action' && anyItem.name === actionName) {
                        console.log(`[RefactoringManager] Found usage (DataAction.name) in ${task.name}: ${actionName}`);
                        count++;
                    }
                });
            }

            // 2. Check in FlowChart (Visual nodes)
            // Note: FlowChart nodes usually map to sequence items, but we check to be thorough
            // However, counting both might double-count.
            // Strategy: We count Logical Usages (Sequence). 
            // If FlowCharts are purely visual representations of Sequence, sequence check is enough.
            // BUT: In current architecture, FlowCharts might exist independently or as Source of Truth.

            // Let's rely on Sequence as the primary logic container for now, as that's what the runtime executes.
            // If the user deletes a node in Flow Editor, they are effectively removing it from the FlowChart.
            // If we only check Sequence, we might miss "unconnected" nodes?
            // "ActionVisualisierungsSynchronisation" implies Sequence is Truth.
        });

        return count;
    }

    /**
     * Deletes an action project-wide (references in flows and sequences)
     */
    public static deleteAction(project: GameProject, actionName: string): void {
        if (!actionName) return;

        // 1. Remove from global list and all stages
        project.actions = project.actions.filter(a => a.name !== actionName);
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.actions) s.actions = s.actions.filter(a => a.name !== actionName);
            });
        }

        // 2. Remove from task sequences (Global + Stages)
        const allTasks = [...project.tasks];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) allTasks.push(...s.tasks);
            });
        }

        allTasks.forEach(task => {
            if (task.actionSequence) {
                task.actionSequence = this.filterSequenceItems(task.actionSequence, actionName, 'action');
            }
        });

        // 3. Remove from flow charts
        const charts: { [key: string]: any } = { ... (project.flowCharts || {}) };
        if ((project as any).flow) charts['__legacy_flow__'] = (project as any).flow;

        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.flowCharts) {
                    Object.assign(charts, stage.flowCharts);
                }
            });
        }

        Object.keys(charts).forEach(key => {
            const flowChart = charts[key];
            if (flowChart?.elements) {
                flowChart.elements = flowChart.elements.filter((el: any) => {
                    const elName = el.data?.name || el.data?.actionName || el.properties?.name;
                    return !(el.type === 'Action' && elName === actionName);
                });
            }
        });
    }

    /**
     * Deletes a task project-wide
     */
    public static deleteTask(project: GameProject, taskName: string): void {
        if (!taskName) return;

        // 1. Remove from global list and all stages
        project.tasks = project.tasks.filter(t => t.name !== taskName);
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) s.tasks = s.tasks.filter(t => t.name !== taskName);
            });
        }

        // 2. Remove from object mappings in all stages
        const allObjects = [...project.objects];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.objects) allObjects.push(...s.objects);
            });
        }

        allObjects.forEach(obj => {
            const mappings = (obj as any).Tasks;
            if (mappings) {
                Object.keys(mappings).forEach(evt => {
                    if (mappings[evt] === taskName) delete mappings[evt];
                });
            }
        });

        // 3. Clean up sequence calls (Global + Stages)
        const allTasksToClean = [...project.tasks];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) allTasksToClean.push(...s.tasks);
            });
        }

        allTasksToClean.forEach(task => {
            if (task.actionSequence) {
                task.actionSequence = this.filterSequenceItems(task.actionSequence, taskName, 'task');
            }
        });

        // 4. Remove flow chart (from project and all stages)
        if (project.flowCharts) delete project.flowCharts[taskName];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.flowCharts) delete s.flowCharts[taskName];
            });
        }
    }

    private static filterSequenceItems(sequence: SequenceItem[], name: string, type: 'action' | 'task'): SequenceItem[] {
        if (!sequence) return [];
        return sequence.filter(item => {
            if (!item) return false;
            if (typeof item === 'string') return item !== name; // Very old legacy support
            const seqItem = item as any;

            // CHECK 1: Match 'action' OR 'data_action' if filtering for actions
            const isMatch = (seqItem.type === type) || (type === 'action' && seqItem.type === 'data_action');
            if (isMatch && seqItem.name === name) {
                console.log(`[RefactoringManager] Filtering out item: ${seqItem.name} (Type: ${seqItem.type})`);
                return false;
            }

            // Recurse into standard body
            if (seqItem.body) {
                seqItem.body = this.filterSequenceItems(seqItem.body, name, type);
            }
            // Recurse into DataAction bodies
            if (seqItem.successBody) {
                console.log(`[RefactoringManager] Recursing into successBody of ${seqItem.name}`);
                seqItem.successBody = this.filterSequenceItems(seqItem.successBody, name, type);
            }
            if (seqItem.errorBody) {
                console.log(`[RefactoringManager] Recursing into errorBody of ${seqItem.name}`);
                seqItem.errorBody = this.filterSequenceItems(seqItem.errorBody, name, type);
            }
            // Recurse into Condition elseBody
            if (seqItem.elseBody) {
                seqItem.elseBody = this.filterSequenceItems(seqItem.elseBody, name, type);
            }

            return true;
        });
    }

    /**
     * Helper to replace ${varName} interpolation in strings
     */
    private static replaceInterpolation(text: string, oldName: string, newName: string): string {
        const pattern = new RegExp(`\\$\\{${oldName}\\}`, 'g');
        return text.replace(pattern, `\${${newName}}`);
    }

    /**
     * Helper to recursively scan sequence items
     */
    private static processSequenceItems(sequence: SequenceItem[], callback: (item: SequenceItem) => void): void {
        if (!sequence) return;
        sequence.forEach(item => {
            callback(item);
            const anyItem = item as any;
            if (anyItem.body) {
                this.processSequenceItems(anyItem.body, callback);
            }
            if (anyItem.successBody) {
                this.processSequenceItems(anyItem.successBody, callback);
            }
            if (anyItem.errorBody) {
                this.processSequenceItems(anyItem.errorBody, callback);
            }
            if (anyItem.elseBody) {
                this.processSequenceItems(anyItem.elseBody, callback);
            }
        });
    }

    /**
     * Cleans up all action sequences in the project by removing empty or invalid items.
     * Prevents "ghost" nodes in diagrams and logic issues.
     */
    public static cleanActionSequences(project: GameProject): void {
        const allTasks = [...(project.tasks || [])];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) allTasks.push(...s.tasks);
            });
        }

        allTasks.forEach(task => {
            if (task.actionSequence) {
                task.actionSequence = task.actionSequence.filter(item => {
                    if (!item) return false;
                    // If it's a string, it's a legacy action name - keep it
                    if (typeof item === 'string') return true;
                    // If it's an object, it must have a type or at least a name
                    const obj = item as any;
                    return obj.type !== undefined || obj.name !== undefined || obj.condition !== undefined;
                });
            }
        });

        console.log('[RefactoringManager] Action sequences cleaned');

        // HOTFIX: Repair corrupted UserData object name (persisted from previous TPanel bug)
        // Check objects in stages
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.objects) {
                    const userData = stage.objects.find((o: any) => o.id === 'obj_userData');
                    if (userData && userData.name !== 'UserData') {
                        console.warn(`[RefactoringManager] Fixing corrupted UserData name: "${userData.name}" -> "UserData"`);
                        userData.name = 'UserData';
                    }
                }
            });
        }
        // Check global objects (legacy)
        if (project.objects) {
            const userData = project.objects.find((o: any) => o.id === 'obj_userData');
            if (userData && userData.name !== 'UserData') {
                console.warn(`[RefactoringManager] Fixing corrupted UserData name (global): "${userData.name}" -> "UserData"`);
                userData.name = 'UserData';
            }
        }
    }

    /**
     * Performs a full project hygiene check and sanitization.
     * - Removes flow charts that don't have a corresponding task
     * - Cleans up action sequences
     * - Returns a report of what was cleaned
     */
    public static sanitizeProject(project: GameProject): string[] {
        const report: string[] = [];
        if (!project) return report;

        const taskNames = new Set<string>();
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) s.tasks.forEach(t => taskNames.add(t.name));
            });
        }

        // Safety: Remove tasks from root project.tasks if they already exist in a stage
        // This fixes the "Double Entry" bug in the Flow Editor dropdown
        const rootTaskCountBefore = project.tasks.length;
        project.tasks = project.tasks.filter(t => !taskNames.has(t.name));
        if (project.tasks.length < rootTaskCountBefore) {
            const diffSize = rootTaskCountBefore - project.tasks.length;
            report.push(`${diffSize} doppelte globale Tasks wurden entfernt (bereits in Stages vorhanden).`);
        }

        // Now collect all names for flowChart cleanup (including the remaining root tasks)
        project.tasks.forEach(t => taskNames.add(t.name));
        const cleanFlowCharts = (charts: Record<string, any> | undefined, label: string) => {
            if (!charts) return;
            Object.keys(charts).forEach(key => {
                // Keep the global flow chart and other essentials
                if (key === 'global' || key === 'event-map' || key === 'element-overview' || key === '__legacy_flow__') return;

                if (!taskNames.has(key)) {
                    delete charts[key];
                    report.push(`Entfernter verwaister Flow-Chart in ${label}: ${key}`);
                }
            });
        };

        cleanFlowCharts(project.flowCharts, 'Projekt');
        if (project.stages) {
            project.stages.forEach(s => cleanFlowCharts(s.flowCharts, `Stage ${s.name}`));
        }

        // 2. Clean action sequences
        this.cleanActionSequences(project);
        report.push('Action-Sequenzen bereinigt');

        // 3. Remove task mappings for non-existent tasks (all stages)
        // Note: taskNames already includes all tasks from all stages now.
        const allObjectsScope = [...project.objects, ...(project.variables || [])];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.objects) allObjectsScope.push(...s.objects);
                if (s.variables) allObjectsScope.push(...(s.variables as any));
            });
        }

        allObjectsScope.forEach(obj => {
            if ((obj as any).Tasks) {
                const tasks = (obj as any).Tasks;
                Object.keys(tasks).forEach(key => {
                    const mappedTask = tasks[key];
                    if (mappedTask && !taskNames.has(mappedTask)) {
                        delete tasks[key];
                        report.push(`Entfernte verwaiste Task-Zuweisung in ${obj.name}: ${key} -> ${mappedTask}`);
                    }
                });
            }
        });

        // 4. Migrate FlowChart actions to Single Source of Truth
        this.migrateFlowChartActions(project, report);

        // 5. Clean up old manager tables from persistent data
        const managerNames = ['VisualObjects', 'Tasks', 'Actions', 'Variables', 'FlowCharts'];
        const cleanManagers = (objs: any[]) => {
            if (!objs) return [];
            return objs.filter(obj => {
                const isMgr = (obj as any).isManager === true ||
                    (obj as any).isTransient === true ||
                    (managerNames.includes(obj.name) && (obj.className === 'TObjectList' || obj.className === 'TTable' || obj.className === 'TWindow'));
                if (isMgr) report.push(`Manager-Leiche entfernt: ${obj.name} (${obj.id})`);
                return !isMgr;
            });
        };

        if (project.objects) project.objects = cleanManagers(project.objects);
        if (project.variables) project.variables = (project.variables as any[]).filter(v => !(v as any).isManager);
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.objects) s.objects = cleanManagers(s.objects);
                if (s.variables) s.variables = (s.variables as any[]).filter(v => !(v as any).isManager);
            });
        }

        if (report.length > 0) {
            console.log('[RefactoringManager] Project sanitized:', report);
        }
        return report;
    }

    /**
     * Migrates all actions in all flowCharts to links (Single Source of Truth).
     * Removes redundant data copies from the project file.
     * Also cleans up transient UI data like _formValues, taskName, actionName.
     */
    public static migrateFlowChartActions(project: GameProject, report: string[] = []): void {
        // Fields that should be removed from action definitions (transient/legacy)
        const transientFields = ['_formValues', 'taskName', 'actionName'];
        let cleanupCount = 0;

        // 1. Clean up project.actions
        if (project.actions) {
            project.actions.forEach(action => {
                transientFields.forEach(field => {
                    if ((action as any)[field] !== undefined) {
                        delete (action as any)[field];
                        cleanupCount++;
                    }
                });
            });
        }

        if (!project.flowCharts) {
            if (cleanupCount > 0) {
                report.push(`${cleanupCount} transiente Felder aus Actions entfernt.`);
            }
            return;
        }

        const globalActionNames = new Set((project.actions || []).map(a => a.name));
        let migrationCount = 0;

        const migrateCharts = (charts: Record<string, any> | undefined) => {
            if (!charts) return;
            Object.keys(charts).forEach(contextKey => {
                const flowChart = charts[contextKey];
                if (!flowChart || !flowChart.elements) return;

                flowChart.elements.forEach((el: any) => {
                    if (el.type === 'Action') {
                        const actionName = el.properties?.name || el.data?.name;

                        // Clean transient fields from element data
                        if (el.data) {
                            transientFields.forEach(field => {
                                if (el.data[field] !== undefined) {
                                    delete el.data[field];
                                    cleanupCount++;
                                }
                            });
                        }

                        if (actionName && globalActionNames.has(actionName)) {
                            // Check if it's already a clean link
                            const isMinimalLink = el.data?.isLinked && Object.keys(el.data).length <= 2; // name + isLinked

                            if (!isMinimalLink) {
                                // MIGRATE: Replace full data with minimal link
                                el.data = {
                                    name: actionName,
                                    isLinked: true
                                };
                                migrationCount++;
                            }
                        }
                    }
                });
            });
        };

        migrateCharts(project.flowCharts);
        if (project.stages) {
            project.stages.forEach(s => migrateCharts(s.flowCharts));
        }

        if (migrationCount > 0) {
            report.push(`${migrationCount} FlowChart-Aktionen auf Single-Source-of-Truth (Links) migriert.`);
        }
        if (cleanupCount > 0) {
            report.push(`${cleanupCount} transiente Felder (_formValues, taskName, actionName) entfernt.`);
        }
    }
}
