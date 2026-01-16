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

        // 4. Update flow chart condition nodes
        if (project.flowCharts) {
            Object.keys(project.flowCharts).forEach(key => {
                const flowChart = project.flowCharts![key];
                if (flowChart?.elements) {
                    flowChart.elements.forEach(el => {
                        if (el.type === 'Condition' && el.data?.condition) {
                            if (el.data.condition.variable === oldName) {
                                el.data.condition.variable = newName;
                            }
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

        // 1. Update project tasks list
        project.tasks.forEach(task => {
            if (task.name === oldName) task.name = newName;
        });

        // 2. Update task calls in sequences
        project.tasks.forEach(task => {
            this.processSequenceItems(task.actionSequence, (item) => {
                if (item.type === 'task' && item.name === oldName) item.name = newName;
                if (item.thenTask === oldName) item.thenTask = newName;
                if (item.elseTask === oldName) item.elseTask = newName;
            });
        });

        // 3. Update object event bindings
        project.objects.forEach(obj => {
            if (obj.Tasks) {
                for (const event in obj.Tasks) {
                    if (obj.Tasks[event] === oldName) {
                        obj.Tasks[event] = newName;
                    }
                }
            }
        });

        // 4. Update variable scopes
        project.variables.forEach(v => {
            if (v.scope === oldName) v.scope = newName;
        });

        // 5. Update flowChart key if task was renamed
        if (project.flowCharts && project.flowCharts[oldName]) {
            project.flowCharts[newName] = project.flowCharts[oldName];
            delete project.flowCharts[oldName];
        }

        // 6. Update Task nodes within all flowCharts that might refer to this task
        if (project.flowCharts) {
            Object.keys(project.flowCharts).forEach(key => {
                const flowChart = project.flowCharts![key];
                if (flowChart?.elements) {
                    flowChart.elements.forEach(el => {
                        if (el.type === 'Task' && el.data?.taskName === oldName) {
                            el.data.taskName = newName;
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

        // 1. Update object name itself
        project.objects.forEach(obj => {
            if (obj.name === oldName) obj.name = newName;
        });

        // 2. Update actions targeting or using the object
        project.actions.forEach(action => {
            if (action.target === oldName) action.target = newName;
            if (action.source === oldName) action.source = newName;

            // 3. Update interpolations in property changes (e.g., "${OldName.text}")
            if (action.changes) {
                for (const key in action.changes) {
                    let val = action.changes[key];
                    if (typeof val === 'string') {
                        action.changes[key] = this.replaceInterpolation(val, oldName, newName);
                    }
                }
            }

            // 4. Update interpolations in service params
            if (action.serviceParams) {
                for (const key in action.serviceParams) {
                    action.serviceParams[key] = this.replaceInterpolation(action.serviceParams[key], oldName, newName);
                }
            }
        });

        // 5. Update input targets
        if (project.input) {
            if (project.input.player1Target === oldName) project.input.player1Target = newName;
            if (project.input.player2Target === oldName) project.input.player2Target = newName;
        }
    }

    /**
     * Renames an action project-wide
     */
    public static renameAction(project: GameProject, oldName: string, newName: string): void {
        if (!oldName || !newName || oldName === newName) return;

        // 1. Update project actions list
        project.actions.forEach(action => {
            if (action.name === oldName) action.name = newName;
        });

        // 2. Update task sequences
        project.tasks.forEach(task => {
            this.processSequenceItems(task.actionSequence, (item) => {
                if (item.type === 'action' && item.name === oldName) {
                    item.name = newName;
                }
            });
        });

        // 3. Update flow chart elements (ghost nodes or nested actions)
        const charts: { [key: string]: any } = { ... (project.flowCharts || {}) };
        if ((project as any).flow) charts['__legacy_flow__'] = (project as any).flow;

        Object.keys(charts).forEach(key => {
            const flowChart = charts[key];
            if (flowChart?.elements) {
                flowChart.elements.forEach((el: any) => {
                    if (el.type === 'Action') {
                        // Update various possible name fields
                        if (el.properties && el.properties.name === oldName) {
                            el.properties.name = newName;
                        }
                        if (el.data) {
                            if (el.data.name === oldName) el.data.name = newName;
                            if (el.data.actionName === oldName) el.data.actionName = newName;
                        }
                    } else if (el.type === 'Condition') {
                        if (el.data) {
                            if (el.data.thenAction === oldName) el.data.thenAction = newName;
                            if (el.data.elseAction === oldName) el.data.elseAction = newName;
                        }
                    }
                });
            }
        });
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
     * Deletes an action project-wide (references in flows and sequences)
     */
    public static deleteAction(project: GameProject, actionName: string): void {
        if (!actionName) return;

        // 1. Remove from global list
        project.actions = project.actions.filter(a => a.name !== actionName);

        // 2. Remove from task sequences
        project.tasks.forEach(task => {
            if (task.actionSequence) {
                task.actionSequence = this.filterSequenceItems(task.actionSequence, actionName, 'action');
            }
        });

        // 3. Remove from flow charts
        const charts: { [key: string]: any } = { ... (project.flowCharts || {}) };
        if ((project as any).flow) charts['__legacy_flow__'] = (project as any).flow;

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

        // 1. Remove from global list
        project.tasks = project.tasks.filter(t => t.name !== taskName);

        // 2. Remove from object mappings
        project.objects.forEach(obj => {
            const mappings = (obj as any).Tasks;
            if (mappings) {
                Object.keys(mappings).forEach(evt => {
                    if (mappings[evt] === taskName) delete mappings[evt];
                });
            }
        });

        // 3. Clean up sequence calls
        project.tasks.forEach(task => {
            if (task.actionSequence) {
                task.actionSequence = this.filterSequenceItems(task.actionSequence, taskName, 'task');
            }
        });

        // 4. Remove flow chart
        if (project.flowCharts) delete project.flowCharts[taskName];
    }

    private static filterSequenceItems(sequence: SequenceItem[], name: string, type: 'action' | 'task'): SequenceItem[] {
        if (!sequence) return [];
        return sequence.filter(item => {
            if (!item) return false;
            if (typeof item === 'string') return item !== name; // Very old legacy support
            const seqItem = item as any;
            if (seqItem.type === type && seqItem.name === name) return false;
            if (seqItem.body) {
                seqItem.body = this.filterSequenceItems(seqItem.body, name, type);
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
            if (item.body) {
                this.processSequenceItems(item.body, callback);
            }
        });
    }

    /**
     * Cleans up all action sequences in the project by removing empty or invalid items.
     * Prevents "ghost" nodes in diagrams and logic issues.
     */
    public static cleanActionSequences(project: GameProject): void {
        if (!project.tasks) return;

        project.tasks.forEach(task => {
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

        // 1. Clean up orphaned flow charts
        if (project.flowCharts) {
            const taskNames = new Set(project.tasks.map(t => t.name));
            Object.keys(project.flowCharts).forEach(key => {
                // Keep the global flow chart and other essentials
                if (key === 'global' || key === 'event-map' || key === 'element-overview' || key === '__legacy_flow__') return;

                if (!taskNames.has(key)) {
                    delete project.flowCharts![key];
                    report.push(`Entfernter verwaister Flow-Chart: ${key}`);
                }
            });
        }

        // 2. Clean action sequences
        this.cleanActionSequences(project);
        report.push('Action-Sequenzen bereinigt');

        // 3. Remove task mappings for non-existent tasks
        const taskNames = new Set(project.tasks.map(t => t.name));
        project.objects.forEach(obj => {
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

        if (report.length > 0) {
            console.log('[RefactoringManager] Project sanitized:', report);
        }
        return report;
    }
}
